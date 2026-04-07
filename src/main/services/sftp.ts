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
          privateKey: config.privateKey
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
          
          // 添加父目录
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
   * 下载文件
   */
  async downloadFile(remotePath: string, localPath: string, onProgress?: (progress: number) => void): Promise<void> {
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
                  this.sftpHandle.close(handle)
                  reject(err)
                  return
                }

                if (bytesRead === 0) {
                  // 读取完成
                  this.sftpHandle.close(handle)
                  writeStream.end()
                  resolve()
                  return
                }

                // 写入数据
                writeStream.write(data.slice(0, bytesRead), () => {
                  downloadedBytes += bytesRead
                  
                  if (onProgress && fileSize > 0) {
                    onProgress((downloadedBytes / fileSize) * 100)
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
   * 上传文件
   */
  async uploadFile(localPath: string, remotePath: string, onProgress?: (progress: number) => void): Promise<void> {
    if (!this.sftpHandle) {
      throw new Error('SFTP not connected')
    }

    return new Promise((resolve, reject) => {
      // 获取本地文件大小
      fs.stat(localPath, (err, stats) => {
        if (err) {
          reject(err)
          return
        }

        const fileSize = stats.size
        let uploadedBytes = 0

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
            this.sftpHandle.write(handle, chunk, 0, chunk.length, position, (err: Error) => {
              if (err) {
                this.sftpHandle.close(handle)
                reject(err)
                return
              }

              position += chunk.length
              uploadedBytes += chunk.length

              if (onProgress && fileSize > 0) {
                onProgress((uploadedBytes / fileSize) * 100)
              }
            })
          })

          readStream.on('end', () => {
            this.sftpHandle.close(handle)
            resolve()
          })

          readStream.on('error', (err) => {
            this.sftpHandle.close(handle)
            reject(err)
          })
        })
      })
    })
  }

  /**
   * 上传文件夹（递归）
   */
  async uploadFolder(localPath: string, remotePath: string, onProgress?: (progress: number, currentFile: string) => void): Promise<void> {
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
    onProgress?: (progress: number, currentFile: string) => void
  ): Promise<void> {
    // 首先创建远程目录
    try {
      await this.mkdir(remoteDir)
    } catch (error: any) {
      throw error
    }
    
    const entries = fs.readdirSync(localDir)

    for (const entry of entries) {
      const localPath = path.join(localDir, entry)
      const remotePath = `${remoteDir}/${entry}`
      const stats = fs.statSync(localPath)

      if (stats.isDirectory()) {
        // 递归上传子目录
        await this.uploadDirectoryRecursive(localPath, remotePath, onProgress)
      } else {
        // 上传文件
        try {
          await this.uploadFile(localPath, remotePath, (progress) => {
            if (onProgress) {
              onProgress(progress, localPath)
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
   * 删除文件
   */
  async deleteFile(remotePath: string): Promise<void> {
    if (!this.sftpHandle) {
      throw new Error('SFTP not connected')
    }

    return new Promise((resolve, reject) => {
      this.sftpHandle.stat(remotePath, (err: Error, stats: any) => {
        if (err) {
          reject(err)
          return
        }

        if (stats.isDirectory()) {
          this.sftpHandle.rmdir(remotePath, (err: Error) => {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          })
        } else {
          this.sftpHandle.unlink(remotePath, (err: Error) => {
            if (err) {
              reject(err)
            } else {
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
