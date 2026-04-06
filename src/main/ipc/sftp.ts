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
    async (_event, sessionId: string, remotePath: string, localPath: string) => {
      try {
        const service = sftpPool.getConnection(sessionId)
        await service.downloadFile(remotePath, localPath)
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
    async (_event, sessionId: string, remotePath: string, localPath: string) => {
      try {
        const service = sftpPool.getConnection(sessionId)
        await service.downloadFolder(remotePath, localPath)
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
    async (_event, sessionId: string, localPath: string, remotePath: string) => {
      try {
        const service = sftpPool.getConnection(sessionId)
        await service.uploadFile(localPath, remotePath)
        return { success: true }
      } catch (error: any) {
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
  ipcMain.handle('sftp:delete', async (_event, sessionId: string, remotePath: string) => {
    try {
      const service = sftpPool.getConnection(sessionId)
      await service.deleteFile(remotePath)
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
   * 选择本地文件
   */
  ipcMain.handle('sftp:selectLocalFile', async (_event, options: { selectFolder?: boolean }) => {
    try {
      const window = BrowserWindow.fromWebContents(_event.sender)
      const result = await dialog.showOpenDialog(window!, {
        properties: options.selectFolder ? ['openDirectory'] : ['openFile'],
        title: options.selectFolder ? '选择文件夹' : '选择文件'
      })

      if (!result.canceled && result.filePaths.length > 0) {
        return { success: true, path: result.filePaths[0] }
      }

      return { success: false, error: '用户取消选择' }
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

      // 添加父目录
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
        } catch (error) {
          // 跳过无法访问的文件
          console.warn(`无法访问文件：${fullPath}`, error)
        }
      }

      resolve(files)
    })
  })
}

