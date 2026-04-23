/**
 * SFTP IPC 处理器
 * 处理渲染进程的 SFTP 相关 IPC 通信
 * 安全改进：连接配置从主进程 Store 获取，不在 IPC 中传输密码
 * @module ipc/sftp
 */

import { ipcMain, dialog, BrowserWindow } from 'electron'
import { exec } from 'child_process'
import { sftpPool, type SFTPConfig, type FileInfo } from '../services/sftp'
import type { TransferNode } from '../../shared/types/sftp'
import { StoreService } from '../services/store'
import { CryptoService } from '../services/crypto'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

/**
 * 注册 SFTP 相关的 IPC 处理器
 */
export function registerSFTPIpcHandlers(): void {
  /**
   * 连接 SFTP 服务器（安全改进版）
   * 
   * 改进说明：
   * - 旧接口：connect(sftpConnectionId, config) ← 渲染进程传完整配置（含密码）
   * - 新接口：connect(sftpConnectionId, sessionId) ← 只传两个 ID，配置从 Store 获取
   * 
   * 优势：
   * - 密码不离开主进程，安全性更高
   * - 与 SSH 连接架构统一
   * - 配置集中管理，修改一处全局生效
   */
  ipcMain.handle('sftp:connect', async (_event, sftpConnectionId: string, sessionId: string) => {
    try {
      console.log(`[SFTP] 创建连接: ${sftpConnectionId} for session: ${sessionId}`)
      
      // 从 StoreService 获取会话配置（包含加密的密码）
      const session = StoreService.getSessionById(sessionId)
      if (!session) {
        throw new Error(`会话不存在: ${sessionId}`)
      }
      
      // 解密密码和密钥短语（安全操作，只在主进程执行）
      const config: SFTPConfig = {
        host: session.host,
        port: session.port || 22,
        username: session.username,
        password: session.password ? CryptoService.decrypt(session.password) : undefined,
        privateKey: session.keyPath,  // Session 使用 keyPath 字段
        passphrase: session.keyPassphrase ? CryptoService.decrypt(session.keyPassphrase) : undefined
      }
      
      // 从连接池获取或创建服务实例
      const service = sftpPool.getConnection(sftpConnectionId)
      
      // 使用解密后的配置建立连接
      await service.connect(config)
      
      console.log(`[SFTP] 连接成功: ${sftpConnectionId} → ${config.host}:${config.port}`)
      return { success: true }
    } catch (error: any) {
      console.error('[SFTP] Connect error:', error.message)
      return { success: false, error: error.message }
    }
  })

  /**
   * 列出远程目录内容
   */
  ipcMain.handle('sftp:listDir', async (_event, sessionId: string, remotePath: string) => {
    try {
      const service = sftpPool.getConnection(sessionId)
      // 检查服务是否已连接
      if (!(service as any).sftpHandle) {
        throw new Error('SFTP not connected. Please connect first.')
      }
      const files = await service.listDir(remotePath)
      return { success: true, data: files }
    } catch (error: any) {
      console.error('listDir error:', error.message)
      return { success: false, error: error.message }
    }
  })

  /**
   * 下载文件
   */
  ipcMain.handle(
    'sftp:download',
    async (event, sessionId: string, taskId: string, node: TransferNode) => {
      try {
        const service = sftpPool.getConnection(sessionId)
        const window = BrowserWindow.fromWebContents(event.sender)
        if (!window) {
          throw new Error('BrowserWindow not found')
        }

        // ── 下载进度回调：Service 层每次写入 chunk 后触发 ───────────────
        // 回调参数说明：
        //   speed           - 瞬时传输速度（字节/秒），由 Service 层 calculateTransferSpeed 计算
        //   transferredBytes - 当前文件已传输的总字节数（累加值）
        //   taskId          - 所属传输任务的唯一标识，前端用于定位 Store 中的任务
        //   node            - 正在传输的子节点对象（文件节点），包含 id/localPath/remotePath/size 等
        //
        // IPC 层职责：将回调数据转发给渲染进程（通过 webContents.send）
        // 前端通过 nodeId 匹配到具体节点，更新 UI 进度条和速度显示
        await service.downloadFile(taskId, node, (speed, transferredBytes, taskId, node) => {
          window.webContents.send('sftp:downloadProgress', {
            taskId,
            nodeId: node.id,
            speed,
            transferredBytes
          })
        })

        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  /**
   * 下载文件夹（递归）
   */
  ipcMain.handle(
    'sftp:downloadFolder',
    async (event, sessionId: string, taskId: string, node: TransferNode) => {
      try {
        const service = sftpPool.getConnection(sessionId)
        const window = BrowserWindow.fromWebContents(event.sender)
        if (!window) {
          throw new Error('BrowserWindow not found')
        }

        // ── 下载文件夹进度回调：递归下载每个子文件时触发 ──────────────
        // 与 downloadFile 共用同一回调签名，childNode 为当前正在传输的子节点
        // 文件夹本身无进度，进度由子文件逐个上报后前端聚合计算
        await service.downloadFolder(taskId, node, (speed, transferredBytes, taskId, childNode) => {
          window.webContents.send('sftp:downloadProgress', {
            taskId,
            nodeId: childNode.id,
            speed,
            transferredBytes
          })
        })

        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  /**
   * 上传文件
   */
  ipcMain.handle(
    'sftp:upload',
    async (event, sessionId: string, taskId: string, node: TransferNode) => {
      try {
        const service = sftpPool.getConnection(sessionId)
        const window = BrowserWindow.fromWebContents(event.sender)
        if (!window) {
          throw new Error('BrowserWindow not found')
        }
        
        // ── 上传进度回调：Service 层每次写入 chunk 后触发 ───────────────
        // 回调参数说明同 download，node 为当前正在上传的文件节点
        await service.uploadFile(taskId, node, (speed, transferredBytes, taskId, node) => {
          window.webContents.send('sftp:uploadProgress', {
            taskId,
            nodeId: node.id,
            speed,
            transferredBytes
          })
        })
        
        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  /**
   * 上传文件夹（递归）
   */
  ipcMain.handle(
    'sftp:uploadFolder',
    async (event, sessionId: string, taskId: string, node: TransferNode) => {
      try {
        console.log('uploadFolder 被调用:', { sessionId, taskId, nodeId: node.id })
        const service = sftpPool.getConnection(sessionId)
        const window = BrowserWindow.fromWebContents(event.sender)
        if (!window) {
          throw new Error('BrowserWindow not found')
        }
        
        // ── 上传文件夹进度回调：递归上传每个子文件时触发 ──────────────
        // 与 uploadFile 共用同一回调签名，childNode 为当前正在传输的子节点
        await service.uploadFolder(taskId, node, (speed, transferredBytes, taskId, childNode) => {
          window.webContents.send('sftp:uploadProgress', {
            taskId,
            nodeId: childNode.id,
            speed,
            transferredBytes
          })
        })
        
        return { success: true }
      } catch (error: any) {
        console.error('uploadFolder error:', error.message)
        return { success: false, error: error.message }
      }
    }
  )

  /**
   * 创建远程目录
   */
  ipcMain.handle('sftp:mkdir', async (_event, sessionId: string, remotePath: string) => {
    try {
      const service = sftpPool.getConnection(sessionId)
      await service.mkdir(remotePath)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * 删除远程文件或目录（递归）
   * 对齐 upload/download 模式：接收 TransferNode，进度事件携带 taskId + nodeId
   */
  ipcMain.handle(
    'sftp:delete',
    async (event, sessionId: string, taskId: string, node: TransferNode) => {
      try {
        const service = sftpPool.getConnection(sessionId)
        const window = BrowserWindow.fromWebContents(event.sender)
        if (!window) {
          throw new Error('BrowserWindow not found')
        }

        // ── 删除进度回调：Service 层每个节点删除前后触发 ─────────────
        // 回调参数说明：
        //   speed            - 删除操作无速度概念，固定为 0
        //   transferredBytes - 完成时为 node.size（表示已删除字节数），否则为 0
        //   taskId           - 所属传输任务的唯一标识
        //   childNode        - 当前正在删除的节点（文件或目录）
        //
        // IPC 层职责：将回调数据转发给渲染进程
        // 前端通过 nodeId 匹配到具体节点，更新 UI 进度条（0% → 100%）
        await service.deleteFile(taskId, node, (speed, transferredBytes, taskId, childNode) => {
          window.webContents.send('sftp:deleteProgress', {
            taskId,
            nodeId: childNode.id,
            speed,
            transferredBytes
          })
        })

        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  /**
   * 断开 SFTP 连接
   */
  ipcMain.handle('sftp:disconnect', async (_event, sessionId: string) => {
    try {
      sftpPool.removeConnection(sessionId)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * 取消上传
   */
  ipcMain.handle('sftp:cancelUpload', async (_event, sessionId: string) => {
    try {
      const service = sftpPool.getConnection(sessionId)
      if (service) {
        service.cancelUpload()
      }
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * 获取用户主目录
   */
  ipcMain.handle('sftp:getHomeDir', async () => {
    try {
      // 返回当前用户的家目录
      const homeDir = os.homedir()
      return { success: true, data: homeDir }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * 获取本地文件列表
   */
  ipcMain.handle('sftp:getLocalFiles', async (_event, localPath: string) => {
    try {
      const files = await getLocalDirectoryContents(localPath)
      return { success: true, data: files }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * 获取系统盘符列表（仅 Windows）
   * 返回所有可用盘符的文件信息，用于"此电脑"视图
   */
  ipcMain.handle('sftp:getDrives', async () => {
    try {
      const drives = await getSystemDrives()
      return { success: true, data: drives }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * 获取当前操作系统平台
   */
  ipcMain.handle('sftp:getPlatform', async () => {
    return { success: true, data: process.platform }
  })

  /**
   * 获取路径的父目录（使用 Node.js path.dirname，屏蔽系统差异）
   */
  ipcMain.handle('sftp:dirname', async (_event, filePath: string) => {
    return { success: true, data: path.dirname(filePath) }
  })

  /**
   * 选择本地文件
   */
  ipcMain.handle('sftp:selectLocalFile', async (_event, options: { selectFolder?: boolean }) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: options?.selectFolder ? ['openDirectory'] : ['openFile'],
        defaultPath: os.homedir()
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false }
      }

      return { success: true, path: result.filePaths[0] }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * 创建本地文件夹
   */
  ipcMain.handle('sftp:create-local-folder', async (_event, parentPath: string, folderName: string) => {
    try {
      const fullPath = path.join(parentPath, folderName)
      await fs.promises.mkdir(fullPath, { recursive: true })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * 获取本地文件/文件夹状态信息
   */
  ipcMain.handle('sftp:stat-local', async (_event, localPath: string) => {
    try {
      const stat = await fs.promises.stat(localPath)
      return {
        success: true,
        data: {
          isDirectory: stat.isDirectory(),
          size: stat.size
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * 删除本地文件或文件夹（对齐 upload/download 模式）
   * 接收 TransferNode，进度事件携带 taskId + nodeId
   */
  ipcMain.handle(
    'sftp:delete-local',
    async (event, taskId: string, node: TransferNode) => {
      try {
        const window = BrowserWindow.fromWebContents(event.sender)
        if (!window) {
          throw new Error('BrowserWindow not found')
        }

        const localPath = node.localPath!

        // ── 删除开始：上报 0% 进度 ─────────────────────────────────────
        window.webContents.send('sftp:delete-local-progress', {
          taskId,
          nodeId: node.id,
          speed: 0,
          transferredBytes: 0
        })

        const stat = await fs.promises.stat(localPath)

        if (stat.isDirectory()) {
          // 文件夹：递归删除所有内容后删除文件夹本身
          await fs.promises.rm(localPath, { recursive: true, force: true })
        } else {
          // 单文件：直接删除
          await fs.promises.unlink(localPath)
        }

        // ── 删除完成：上报 100% 进度 ───────────────────────────────────
        if (window) {
          window.webContents.send('sftp:delete-local-progress', {
            taskId,
            nodeId: node.id,
            speed: 0,
            transferredBytes: node.size || 0
          })
        }

        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  /**
   * 确保本地目录存在（递归创建）
   */
  ipcMain.handle('sftp:ensure-dir', async (_event, dirPath: string) => {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ==================== v5 优化：文件树扫描 API ====================
  
  /**
   * 扫描本地文件树（用于上传前的文件扫描）
   * 
   * IPC 层只做薄封装，业务逻辑在 SFTPService.scanLocalTree() 中实现
   * 优势：
   * - 直接使用 Node.js fs 和 path 模块，性能更高
   * - 使用 path.join 屏蔽操作系统路径差异
   * - 一次性返回完整 TransferNode 树结构（无循环引用）
   */
  ipcMain.handle('sftp:scanLocalTree', async (_event, folderPath: string, remoteBasePath: string) => {
    try {
      console.log(`[SFTP] 开始扫描本地文件夹: ${folderPath}`)
      
      // 创建临时 SFTPService 实例（本地扫描不需要连接）
      const tempService = new (await import('../services/sftp')).SFTPService()
      const result = await tempService.scanLocalTree(folderPath, remoteBasePath)
      
      console.log(`[SFTP] 本地扫描完成：${result.totalFiles} 个文件`)
      return result
    } catch (error: any) {
      console.error(`[SFTP] scanLocalTree 异常:`, error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 扫描远程文件树（用于下载/删除前的文件扫描）
   * 
   * IPC 层只做薄封装，业务逻辑在 SFTPService.scanRemoteTree() 中实现
   * 优势：
   * - 直接调用 SFTP 服务层方法，减少 IPC 往返次数
   * - 在主进程中完成所有递归逻辑
   * - 远程路径统一使用 / 分隔符（SFTP 标准）
   * - 本地路径使用 path.join 屏蔽系统差异
   */
  ipcMain.handle('sftp:scanRemoteTree', async (_event, sessionId: string, remotePath: string, localBasePath?: string) => {
    try {
      console.log(`[SFTP] 开始扫描远程文件夹: ${remotePath}`)
      
      // 获取已连接的 SFTP 服务实例
      const service = sftpPool.getConnection(sessionId)
      const result = await service.scanRemoteTree(remotePath, localBasePath)
      
      console.log(`[SFTP] 远程扫描完成：${result.totalFiles} 个文件`)
      return result
    } catch (error: any) {
      console.error(`[SFTP] scanRemoteTree 异常:`, error)
      return { success: false, error: error.message }
    }
  })
}

/**
 * 获取本地目录内容
 */
async function getLocalDirectoryContents(dirPath: string): Promise<FileInfo[]> {
  return new Promise((resolve, reject) => {
    fs.readdir(dirPath, { withFileTypes: true }, (err, dirents) => {
      if (err) {
        reject(err)
        return
      }

      const files: FileInfo[] = []

      // 添加父目录（用于 UI 导航）
      const parentDir = path.dirname(dirPath)
      if (parentDir !== dirPath) {
        files.push({
          name: '..',
          path: parentDir,
          isDirectory: true,
          size: 0,
          modifyTime: new Date()
        })
      }

      // 处理文件列表
      for (const dirent of dirents) {
        // 跳过 . 和 .. 目录
        if (dirent.name === '.' || dirent.name === '..') {
          continue
        }
        
        const fullPath = path.join(dirPath, dirent.name)
        
        try {
          const stats = fs.statSync(fullPath)
          files.push({
            name: dirent.name,
            path: fullPath,
            isDirectory: dirent.isDirectory(),
            size: stats.size,
            modifyTime: stats.mtime
          })
        } catch (error: any) {
          // 跳过无法访问的文件
          console.warn(`无法访问文件：${fullPath}`, error)
        }
      }

      resolve(files)
    })
  })
}

/**
 * 获取系统盘符列表（仅 Windows 平台）
 * 返回所有可用盘符的文件信息，用于"此电脑"视图
 * @returns 盘符文件信息数组
 */
async function getSystemDrives(): Promise<FileInfo[]> {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') {
      resolve([{
        name: '/',
        path: '/',
        isDirectory: true,
        size: 0,
        modifyTime: new Date()
      }])
      return
    }

    exec('wmic logicaldisk get name', (error: Error | null, stdout: string) => {
      if (error) {
        console.error('[SFTP] 获取盘符列表失败:', error)
        reject(error)
        return
      }

      console.log('[SFTP] wmic 输出:', stdout)

      const drives: FileInfo[] = []
      
      const lines = stdout.split('\n')
        .map(line => line.trim())
        .filter(line => /^[A-Za-z]:$/.test(line))

      console.log('[SFTP] 解析到的盘符:', lines)

      for (const driveLetter of lines) {
        const drivePath = `${driveLetter}\\`
        
        try {
          const stats = fs.statSync(drivePath)
          drives.push({
            name: driveLetter,
            path: drivePath,
            isDirectory: true,
            size: stats.size,
            modifyTime: stats.mtime
          })
          console.log('[SFTP] 成功添加盘符:', driveLetter, drivePath)
        } catch (error: any) {
          console.warn(`[SFTP] 无法访问盘符：${drivePath}`, error)
        }
      }

      console.log('[SFTP] 最终盘符列表:', drives.length, '个')
      resolve(drives)
    })
  })
}

