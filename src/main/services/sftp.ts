/**
 * SFTP 服务模块
 * 提供与远程服务器的 SFTP 文件传输功能
 * @module services/sftp
 */

import { Client } from 'ssh2'
import * as fs from 'fs'
import * as path from 'path'

/**
 * SFTP 连接配置
 */
export interface SFTPConfig {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  /** 私钥密码短语（用于加密的私钥） */
  passphrase?: string
}

/**
 * 文件信息
 */
export interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifyTime: Date
}

/**
 * SFTP 服务类
 */
export class SFTPService {
  private client: Client
  private sftpHandle: any = null
  private connected: boolean = false
  private uploadCancelled: boolean = false

  constructor() {
    this.client = new Client()
  }

  /**
   * 连接到 SFTP 服务器
   */
  async connect(config: SFTPConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client
        .on('ready', () => {
          this.connected = true
          // 获取 SFTP 句柄
          this.client.sftp((err, sftp) => {
            if (err) {
              this.connected = false
              reject(err)
              return
            }
            this.sftpHandle = sftp
            console.log('SFTP handle initialized')
            resolve()
          })
        })
        .on('error', (err) => {
          this.connected = false
          reject(err)
        })
        .connect({
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          privateKey: config.privateKey,
          passphrase: config.passphrase
        })
    })
  }

  /**
   * 列出目录内容
   */
  async listDir(remotePath: string): Promise<FileInfo[]> {
    if (!this.sftpHandle) {
      throw new Error('SFTP not connected')
    }

    return new Promise((resolve, reject) => {
      this.sftpHandle.readdir(remotePath, async (err: Error, list: any[]) => {
        if (err) {
          reject(err)
          return
        }

        try {
          const files: FileInfo[] = []
          
          // 添加父目录（用于 UI 导航）
          if (remotePath !== '/') {
            files.push({
              name: '..',
              path: path.dirname(remotePath),
              isDirectory: true,
              size: 0,
              modifyTime: new Date()
            })
          }

          // 处理文件列表
          for (const item of list) {
            const fullPath = path.posix.join(remotePath, item.filename)
            files.push({
              name: item.filename,
              path: fullPath,
              isDirectory: item.attrs.isDirectory(),
              size: item.attrs.size,
              modifyTime: new Date(item.attrs.mtime * 1000)
            })
          }

          // 目录在前，文件在后
          files.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1
            if (!a.isDirectory && b.isDirectory) return 1
            return a.name.localeCompare(b.name)
          })

          resolve(files)
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  /**
   * 下载文件（带实时进度回调）
   * 与 uploadFile 保持一致的进度报告机制
   */
  async downloadFile(
    remotePath: string,
    localPath: string,
    onProgress?: (progress: number, size: number, transferredSize: number, speed: number) => void
  ): Promise<void> {
    if (!this.sftpHandle) {
      throw new Error('SFTP not connected')
    }

    return new Promise((resolve, reject) => {
      // 获取文件大小
      this.sftpHandle.stat(remotePath, (err: Error, stats: any) => {
        if (err) {
          reject(err)
          return
        }

        const fileSize = stats.size
        let downloadedBytes = 0
        
        // 时间追踪变量（用于速度计算）
        const startTime = Date.now()
        let lastUpdateTime = startTime
        let lastDownloadedBytes = 0

        // 创建本地目录
        const localDir = path.dirname(localPath)
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true })
        }

        // 打开远程文件
        this.sftpHandle.open(remotePath, 'r', (err: Error, handle: any) => {
          if (err) {
            reject(err)
            return
          }

          // 创建本地文件
          const writeStream = fs.createWriteStream(localPath)
          let buffer = Buffer.alloc(32 * 1024) // 32KB buffer

          const readChunk = () => {
            this.sftpHandle.read(
              handle,
              buffer,
              0,
              buffer.length,
              downloadedBytes,
              (err: Error, bytesRead: number, data: Buffer) => {
                if (err) {
                  try {
                    this.sftpHandle.close(handle)
                  } catch (closeErr: any) {
                    console.error('[SFTP] 下载文件时关闭句柄失败:', closeErr.message)
                  }
                  reject(err)
                  return
                }

                if (bytesRead === 0) {
                  // 读取完成 - 关闭文件并触发最后一次进度回调
                  try {
                    this.sftpHandle.close(handle)
                  } catch (closeErr: any) {
                    console.error('[SFTP] 下载完成时关闭句柄失败:', closeErr.message)
                  }
                  
                  writeStream.end(() => {
                    // 确保在文件下载完成时触发最后一次进度回调（100%）
                    if (onProgress && fileSize > 0) {
                      const finalSpeed = this.calculateTransferSpeed(
                        downloadedBytes,
                        startTime,
                        lastUpdateTime,
                        lastDownloadedBytes
                      )
                      onProgress(100, fileSize, downloadedBytes, finalSpeed)
                    }
                    resolve()
                  })
                  return
                }

                // 写入数据
                writeStream.write(data.slice(0, bytesRead), () => {
                  downloadedBytes += bytesRead
                  
                  if (onProgress && fileSize > 0) {
                    // 计算进度百分比
                    const progress = (downloadedBytes / fileSize) * 100
                    
                    // 计算传输速度
                    const speed = this.calculateTransferSpeed(
                      downloadedBytes,
                      startTime,
                      lastUpdateTime,
                      lastDownloadedBytes
                    )
                    
                    // 更新时间和已传输字节
                    lastUpdateTime = Date.now()
                    lastDownloadedBytes = downloadedBytes
                    
                    // 调用进度回调（传递完整数据）
                    onProgress(progress, fileSize, downloadedBytes, speed)
                  }

                  readChunk()
                })
              }
            )
          }

          readChunk()
        })
      })
    })
  }

  /**
   * 递归下载文件夹
   */
  async downloadFolder(remotePath: string, localPath: string, onProgress?: (progress: number, currentFile: string) => void): Promise<void> {
    if (!this.sftpHandle) {
      throw new Error('SFTP not connected')
    }

    // 创建本地目录
    if (!fs.existsSync(localPath)) {
      fs.mkdirSync(localPath, { recursive: true })
    }

    // 读取远程目录内容
    const entries = await this.listDir(remotePath)
    
    for (const entry of entries) {
      if (entry.name === '.' || entry.name === '..') {
        continue
      }

      const remoteFilePath = `${remotePath}/${entry.name}`
      const localFilePath = `${localPath}/${entry.name}`

      if (entry.isDirectory) {
        // 递归下载子文件夹
        await this.downloadFolder(remoteFilePath, localFilePath, onProgress)
      } else {
        // 下载文件
        if (onProgress) {
          onProgress(0, entry.name)
        }
        await this.downloadFile(remoteFilePath, localFilePath, (progress) => {
          if (onProgress) {
            onProgress(progress, entry.name)
          }
        })
      }
    }
  }

  /**
   * 取消上传
   */
  cancelUpload(): void {
    this.uploadCancelled = true
    console.log('上传已取消')
  }

  /**
   * 重置取消标志
   */
  resetUploadCancelled(): void {
    this.uploadCancelled = false
  }

  /**
   * 计算传输速度
   * @param uploadedBytes - 已传输的字节数
   * @param startTime - 开始时间戳
   * @param lastUpdateTime - 上次更新时间戳
   * @param lastUploadedBytes - 上次已传输的字节数
   * @returns 传输速度（字节/秒）
   */
  private calculateTransferSpeed(
    uploadedBytes: number,
    startTime: number,
    lastUpdateTime: number,
    lastUploadedBytes: number
  ): number {
    const now = Date.now()
    const timeDiff = (now - lastUpdateTime) / 1000 // 转换为秒
    const bytesDiff = uploadedBytes - lastUploadedBytes
    
    // 计算瞬时速度（字节/秒）
    const instantSpeed = timeDiff > 0 ? bytesDiff / timeDiff : 0
    
    // 计算平均速度（字节/秒）
    const totalTime = (now - startTime) / 1000
    const avgSpeed = totalTime > 0 ? uploadedBytes / totalTime : 0
    
    // 使用平均速度和瞬时速度的较大值，避免速度为 0
    return Math.max(instantSpeed, avgSpeed)
  }

  /**
   * 上传文件
   */
  async uploadFile(
    localPath: string,
    remotePath: string,
    onProgress?: (progress: number, size: number, transferredSize: number, speed: number) => void
  ): Promise<void> {
    if (!this.sftpHandle) {
      throw new Error('SFTP not connected')
    }

    // 重置取消标志
    this.uploadCancelled = false

    return new Promise((resolve, reject) => {
      // 获取本地文件大小
      fs.stat(localPath, (err, stats) => {
        if (err) {
          reject(err)
          return
        }

        const fileSize = stats.size
        let uploadedBytes = 0
        const startTime = Date.now()
        let lastUpdateTime = startTime
        let lastUploadedBytes = 0

        // 打开远程文件
        this.sftpHandle.open(remotePath, 'w', (err: Error, handle: any) => {
          if (err) {
            reject(err)
            return
          }

          // 读取本地文件
          const readStream = fs.createReadStream(localPath)
          let position = 0

          readStream.on('data', (chunk) => {
            // 检查是否被取消
            if (this.uploadCancelled) {
              // 取消时尝试关闭 handle，但忽略错误
              try {
                this.sftpHandle.close(handle)
              } catch (closeErr) {
                // 忽略关闭错误
              }
              reject(new Error('Upload cancelled'))
              return
            }

            this.sftpHandle.write(handle, chunk, 0, chunk.length, position, (err: Error) => {
              if (err) {
                // 如果是取消导致的错误，忽略
                if (this.uploadCancelled) {
                  try {
                    this.sftpHandle.close(handle)
                  } catch (closeErr) {
                    // 忽略关闭错误
                  }
                  reject(new Error('Upload cancelled'))
                  return
                }
                try {
                  this.sftpHandle.close(handle)
                } catch (closeErr) {
                  // 忽略关闭错误
                }
                reject(err)
                return
              }

              position += chunk.length
              uploadedBytes += chunk.length

              if (onProgress && fileSize > 0) {
                const speed = this.calculateTransferSpeed(
                  uploadedBytes,
                  startTime,
                  lastUpdateTime,
                  lastUploadedBytes
                )
                
                // 更新时间和已传输字节
                lastUpdateTime = Date.now()
                lastUploadedBytes = uploadedBytes
                
                onProgress((uploadedBytes / fileSize) * 100, fileSize, uploadedBytes, speed)
              }
            })
          })

          readStream.on('end', () => {
            try {
              this.sftpHandle.close(handle)
            } catch (closeErr) {
              // 忽略关闭错误
            }
            // Bug 修复：确保在文件上传完成时触发最后一次进度回调
            // 对于空文件（0 字节），不会触发 data 事件，需要在 end 事件中触发进度回调
            // 对于非空文件，如果最后一个 data 事件的回调执行滞后，也需要在 end 事件中确保触发最后的进度回调
            if (onProgress) {
              const speed = this.calculateTransferSpeed(
                uploadedBytes,
                startTime,
                lastUpdateTime,
                lastUploadedBytes
              )
              onProgress(100, fileSize, uploadedBytes, speed)
            }
            resolve()
          })

          readStream.on('error', (err) => {
            try {
              this.sftpHandle.close(handle)
            } catch (closeErr) {
              // 忽略关闭错误
            }
            reject(err)
          })
        })
      })
    })
  }

  /**
   * 上传文件夹（递归）
   */
  async uploadFolder(
    localPath: string, 
    remotePath: string, 
    onProgress?: (progress: number, currentFile: string, size: number, transferredSize: number, speed: number) => void
  ): Promise<void> {
    if (!this.sftpHandle) {
      throw new Error('SFTP not connected')
    }

    // 首先创建远程目录
    try {
      await this.mkdir(remotePath)
    } catch (error: any) {
      throw error
    }

    // 递归上传所有文件和子目录
    await this.uploadDirectoryRecursive(localPath, remotePath, onProgress)
  }

  /**
   * 递归上传目录
   */
  private async uploadDirectoryRecursive(
    localDir: string,
    remoteDir: string,
    onProgress?: (progress: number, currentFile: string, size: number, transferredSize: number, speed: number) => void
  ): Promise<void> {
    // 检查是否被取消
    if (this.uploadCancelled) {
      throw new Error('Upload cancelled')
    }

    // 首先创建远程目录
    try {
      await this.mkdir(remoteDir)
    } catch (error: any) {
      throw error
    }
    
    const entries = fs.readdirSync(localDir)

    for (const entry of entries) {
      // 检查是否被取消
      if (this.uploadCancelled) {
        throw new Error('Upload cancelled')
      }

      // 跳过 . 和 .. 目录
      if (entry === '.' || entry === '..') {
        continue
      }
      
      const localPath = path.join(localDir, entry)
      const remotePath = `${remoteDir}/${entry}`
      const stats = fs.statSync(localPath)

      if (stats.isDirectory()) {
        // 递归上传子目录
        await this.uploadDirectoryRecursive(localPath, remotePath, onProgress)
      } else {
        // 上传文件
        try {
          await this.uploadFile(localPath, remotePath, (progress, size, transferredSize, speed) => {
            if (onProgress) {
              onProgress(progress, localPath, size, transferredSize, speed)
            }
          })
        } catch (error: any) {
          throw error
        }
      }
    }
  }

  /**
   * 创建目录
   */
  async mkdir(remotePath: string): Promise<void> {
    if (!this.sftpHandle) {
      throw new Error('SFTP not connected')
    }

    return new Promise((resolve, reject) => {
      // 尝试创建目录，如果已存在则忽略错误
      this.sftpHandle.mkdir(remotePath, { mode: 0o755 }, (err: Error) => {
        if (err) {
          // 如果错误是因为目录已存在，则忽略
          if (err.message.includes('Failure') || err.message.includes('already exists')) {
            // 检查目录是否存在
            this.sftpHandle.stat(remotePath, (statErr: Error) => {
              if (statErr) {
                reject(err)
              } else {
                resolve()
              }
            })
          } else {
            reject(err)
          }
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * 删除远程文件或目录（递归）
   */
  async deleteFile(remotePath: string, onProgress?: (currentPath: string) => void): Promise<void> {
    if (!this.sftpHandle) {
      throw new Error('SFTP not connected')
    }

    return new Promise((resolve, reject) => {
      this.sftpHandle.stat(remotePath, (err: Error, stats: any) => {
        if (err) {
          console.error('SFTPService.deleteFile stat 失败:', { remotePath, error: err.message })
          reject(err)
          return
        }

        if (stats.isDirectory()) {
          console.log('SFTPService.deleteFile 开始删除目录:', { remotePath })
          // 递归删除目录内容
          this.sftpHandle.readdir(remotePath, async (err: Error, entries: any[]) => {
            if (err) {
              console.error('SFTPService.deleteFile readdir 失败:', { remotePath, error: err.message })
              reject(err)
              return
            }

            // 删除所有子文件和子目录
            for (const entry of entries) {
              if (entry.filename === '.' || entry.filename === '..') {
                continue
              }
              const childPath = `${remotePath}/${entry.filename}`
              try {
                if (onProgress) {
                  onProgress(childPath)
                }
                await this.deleteFile(childPath, onProgress)
              } catch (error: any) {
                console.error('SFTPService.deleteFile 删除子项失败:', { childPath, error: error.message })
                reject(error)
                return
              }
            }

            // 删除空目录
            console.log('SFTPService.deleteFile 删除空目录:', { remotePath })
            
            // 触发进度回调（通知渲染进程正在删除此空目录）
            if (onProgress) {
              onProgress(remotePath)
            }
            
            this.sftpHandle.rmdir(remotePath, (err: Error) => {
              if (err) {
                console.error('SFTPService.deleteFile rmdir 失败:', { remotePath, error: err.message })
                reject(err)
              } else {
                console.log('SFTPService.deleteFile 目录删除成功:', { remotePath })
                resolve()
              }
            })
          })
        } else {
          // 删除文件
          console.log('SFTPService.deleteFile 删除文件:', { remotePath })
          
          // 触发进度回调（通知渲染进程正在删除此文件）
          if (onProgress) {
            onProgress(remotePath)
          }
          
          this.sftpHandle.unlink(remotePath, (err: Error) => {
            if (err) {
              console.error('SFTPService.deleteFile unlink 失败:', { remotePath, error: err.message })
              reject(err)
            } else {
              console.log('SFTPService.deleteFile 文件删除成功:', { remotePath })
              resolve()
            }
          })
        }
      })
    })
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.connected) {
      this.client.end()
      this.connected = false
      this.sftpHandle = null
    }
  }
}

/**
 * SFTP 连接池（单例模式）
 */
class SFTPConnectionPool {
  private static instance: SFTPConnectionPool
  private connections: Map<string, SFTPService> = new Map()

  private constructor() {}

  static getInstance(): SFTPConnectionPool {
    if (!SFTPConnectionPool.instance) {
      SFTPConnectionPool.instance = new SFTPConnectionPool()
    }
    return SFTPConnectionPool.instance
  }

  /**
   * 获取或创建 SFTP 连接
   */
  getConnection(sessionId: string): SFTPService {
    if (!this.connections.has(sessionId)) {
      const service = new SFTPService()
      this.connections.set(sessionId, service)
    }
    return this.connections.get(sessionId)!
  }

  /**
   * 移除连接
   */
  removeConnection(sessionId: string): void {
    const connection = this.connections.get(sessionId)
    if (connection) {
      connection.disconnect()
      this.connections.delete(sessionId)
    }
  }

  /**
   * 清理所有连接
   */
  cleanup(): void {
    for (const connection of this.connections.values()) {
      connection.disconnect()
    }
    this.connections.clear()
  }
}

export const sftpPool = SFTPConnectionPool.getInstance()
