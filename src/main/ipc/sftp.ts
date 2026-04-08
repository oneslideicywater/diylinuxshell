/**
 * SFTP IPC 处理器
 * 处理渲染进程的 SFTP 相关 IPC 通信
 * @module ipc/sftp
 */

import { ipcMain, dialog, BrowserWindow } from 'electron'
import { sftpPool, type SFTPConfig, type FileInfo } from '../services/sftp'
import * as fs from 'fs'
import * as path from 'path'

/**
 * 注册 SFTP 相关的 IPC 处理器
 */
export function registerSFTPIpcHandlers(): void {
  /**
   * 连接 SFTP 服务器
   */
  ipcMain.handle('sftp:connect', async (_event, sessionId: string, config: SFTPConfig) => {
    try {
      console.log('Connecting to:', config.host, 'with session:', sessionId)
      const service = sftpPool.getConnection(sessionId)
      await service.connect(config)
      console.log('Connected successfully to:', config.host, 'session:', sessionId)
      return { success: true }
    } catch (error: any) {
      console.error('Connect error:', error.message)
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
    async (event, sessionId: string, remotePath: string, localPath: string) => {
      try {
        const service = sftpPool.getConnection(sessionId)
        const window = BrowserWindow.fromWebContents(event.sender)
        if (!window) {
          throw new Error('BrowserWindow not found')
        }

        // 进度回调函数
        const onProgress = (progress: number) => {
          window.webContents.send('sftp:downloadProgress', {
            sessionId,
            localPath,
            remotePath,
            progress,
            size: 0,
            transferredSize: 0,
            speed: 0
          })
        }

        await service.downloadFile(remotePath, localPath, onProgress)
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
    async (event, sessionId: string, remotePath: string, localPath: string) => {
      try {
        const service = sftpPool.getConnection(sessionId)
        const window = BrowserWindow.fromWebContents(event.sender)
        if (!window) {
          throw new Error('BrowserWindow not found')
        }

        // 进度回调函数
        const onProgress = (progress: number, currentFile: string) => {
          const currentRemotePath = `${remotePath}/${currentFile}`
          const currentLocalPath = `${localPath}/${currentFile}`
          window.webContents.send('sftp:downloadProgress', {
            sessionId,
            localPath: currentLocalPath,
            remotePath: currentRemotePath,
            progress,
            size: 0,
            transferredSize: 0,
            speed: 0
          })
        }

        await service.downloadFolder(remotePath, localPath, onProgress)
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
    async (event, sessionId: string, localPath: string, remotePath: string) => {
      try {
        const service = sftpPool.getConnection(sessionId)
        const window = BrowserWindow.fromWebContents(event.sender)
        if (!window) {
          throw new Error('BrowserWindow not found')
        }
        
        // 带进度回调的上传
        await service.uploadFile(localPath, remotePath, (progress: number, size: number, transferredSize: number, speed: number) => {
          // 发送进度事件到渲染进程
          window.webContents.send('sftp:uploadProgress', {
            sessionId,
            localPath,
            remotePath,
            progress,
            size,
            transferredSize,
            speed
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
    async (event, sessionId: string, localPath: string, remotePath: string) => {
      try {
        console.log('uploadFolder 被调用:', { sessionId, localPath, remotePath })
        // 检查本地路径是否存在
        if (!fs.existsSync(localPath)) {
          console.error('本地路径不存在:', localPath)
          return { success: false, error: `本地路径不存在：${localPath}` }
        }
        const service = sftpPool.getConnection(sessionId)
        const window = BrowserWindow.fromWebContents(event.sender)
        if (!window) {
          throw new Error('BrowserWindow not found')
        }
        
        // 带进度回调的上传
        await service.uploadFolder(localPath, remotePath, (progress: number, currentFile: string, size: number, transferredSize: number, speed: number) => {
          // 发送进度事件到渲染进程
          window.webContents.send('sftp:uploadProgress', {
            sessionId,
            localPath: currentFile,
            remotePath,
            progress,
            size,
            transferredSize,
            speed
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
   * 删除远程文件
   */
  ipcMain.handle('sftp:delete', async (event, sessionId: string, remotePath: string) => {
    try {
      const service = sftpPool.getConnection(sessionId)
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window) {
        throw new Error('BrowserWindow not found')
      }

      // 进度回调函数
      const onProgress = (currentPath: string) => {
        window.webContents.send('sftp:deleteProgress', {
          sessionId,
          currentPath
        })
      }

      await service.deleteFile(remotePath, onProgress)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

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
      const homeDir = require('os').homedir()
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
   * 选择本地文件
   */
  ipcMain.handle('sftp:selectLocalFile', async (_event, options: { selectFolder?: boolean }) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: options?.selectFolder ? ['openDirectory'] : ['openFile'],
        defaultPath: require('os').homedir()
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

