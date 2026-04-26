/**
 * SFTP 服务模块
 * 提供与远程服务器的 SFTP 文件传输功能
 * @module services/sftp
 */

import { Client } from 'ssh2'
import * as fs from 'fs'
import * as path from 'path'
import type { TransferNode } from '../../shared/types/sftp'

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
  isSymbolicLink?: boolean  // 符号链接标识
  linkTarget?: string       // 符号链接目标路径
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
  
  /** 并发传输的最大并行数（可配置，默认5） */
  private static readonly MAX_CONCURRENCY: number = 5

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

          // 处理文件列表（修复符号链接显示问题）
          for (const item of list) {
            const fullPath = path.posix.join(remotePath, item.filename)
            
            // 默认使用 readdir 返回的属性
            let isDirectory = item.attrs.isDirectory()
            const isSymbolicLink = item.attrs.isSymbolicLink()
            let linkTarget: string | undefined = undefined
            
            // 如果是符号链接，需要跟随链接判断目标类型并读取目标路径
            // 修复：/bin、/lib64、/sbin 等符号链接目录显示为文件的问题
            if (isSymbolicLink) {
              try {
                // 使用 stat 获取符号链接目标的属性（stat 会自动跟随符号链接）
                const stats = await new Promise<any>((resolve, reject) => {
                  this.sftpHandle.stat(fullPath, (err: Error, stats: any) => {
                    if (err) reject(err)
                    else resolve(stats)
                  })
                })
                isDirectory = stats.isDirectory()
                console.log(`[SFTP] 符号链接 ${fullPath} → 目标类型：${isDirectory ? '目录' : '文件'}`)
              } catch (error: any) {
                console.warn(`[SFTP] 无法获取符号链接目标类型：${fullPath}`, error.message)
                // 如果 stat 失败（断链），保持原判断（显示为文件）
              }
              
              // 读取符号链接的目标路径（用于 tooltip 显示）
              try {
                linkTarget = await new Promise<string>((resolve, reject) => {
                  this.sftpHandle.readlink(fullPath, (err: Error, target: string) => {
                    if (err) reject(err)
                    else resolve(target)
                  })
                })
                console.log(`[SFTP] 符号链接 ${fullPath} → ${linkTarget}`)
              } catch (error: any) {
                console.warn(`[SFTP] 无法读取符号链接目标：${fullPath}`, error.message)
              }
            }
            
            files.push({
              name: item.filename,
              path: fullPath,
              isDirectory,
              isSymbolicLink,
              linkTarget,
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
    taskId: string,
    node: TransferNode,
    onProgress?: (speed: number, transferredBytes: number, taskId: string, node: TransferNode) => void
  ): Promise<void> {
    if (!this.sftpHandle) {
      throw new Error('SFTP not connected')
    }

    const remotePath = node.remotePath!
    const localPath = node.localPath!

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
          
          // ── 优化 P1：增大下载缓冲区（32KB → 256KB）────────────────────
          // 原因：
          //   - 32KB 在现代高带宽网络（100Mbps+）下太小
          //   - 导致频繁的 sftpHandle.read 回调调用，CPU 浪费在调度上
          //   - 无法充分利用网络带宽，小文件传输效率低
          // 
          // 为什么选 256KB 而不是更大（如 1MB）：
          //   - SFTP 协议本身有包大小限制（通常 32KB-64KB）
          //   - 过大的 buffer 会增加内存占用，对大文件场景不友好
          //   - 256KB 是带宽利用率和内存占用的平衡点
          const buffer = Buffer.alloc(256 * 1024) // 256KB buffer（原 32KB）

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
                    // ── 文件下载完成：触发最后一次进度回调（100%） ─────────
                    // 必须无条件调用（包括空文件）：
                    //   空文件 bytesRead==0 直接进入此分支，per-chunk 回调从未执行
                    //   前端需要收到此次回调才能将进度更新为 completed
                    if (onProgress) {
                      const finalSpeed = this.calculateTransferSpeed(
                        downloadedBytes,
                        lastUpdateTime,
                        lastDownloadedBytes
                      )
                      onProgress(finalSpeed, downloadedBytes, taskId, node)
                    }
                    resolve()
                  })
                  return
                }

                // 写入数据
                writeStream.write(data.slice(0, bytesRead), () => {
                  downloadedBytes += bytesRead
                  
                  // ── 每次读取 chunk 写入本地后：触发进度回调 ─────────────
                  // 计算逻辑：
                  //   1. speed = (当前已传字节 - 上次已传字节) / (当前时间 - 上次时间)
                  //   2. 更新 lastUpdateTime / lastTransferredBytes 为下一次计算做准备
                  //   3. 调用 onProgress 将数据传给 IPC 层，最终到达前端 UI
                  if (onProgress && fileSize > 0) {
                    const speed = this.calculateTransferSpeed(
                      downloadedBytes,
                      lastUpdateTime,
                      lastDownloadedBytes
                    )
                    
                    lastUpdateTime = Date.now()
                    lastDownloadedBytes = downloadedBytes
                    
                    onProgress(speed, downloadedBytes, taskId, node)
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
   * 递归下载文件夹（并发版本）
   * 
   * 优化说明（解决 P0 问题）：
   *   - 原实现：for 循环 + await，文件完全串行传输
   *   - 新实现：使用 runConcurrent 并发池，最多同时传输 5 个文件
   *   - 性能提升：假设 100 个小文件（每个 1MB），RTT=50ms
   *     串行：100 × (50ms + 传输时间) ≈ 5秒+ 纯等待开销
   *     并发：100/5 × (50ms + 传输时间) ≈ 1秒+ 等待开销（5倍提升）
   * 
   * 为什么目录也要递归进入：
   *   - 目录本身不传输数据，但需要先创建本地目录结构
   *   - 子目录的文件可以与兄弟目录的文件并发执行
   * 
   * 进度回调机制保持不变：
   *   - 文件夹本身不上报进度
   *   - 叶子节点（文件）逐个触发 onProgress 回调
   *   - 前端根据 taskId + node.id 聚合进度
   */
  async downloadFolder(
    taskId: string,
    node: TransferNode,
    onProgress?: (speed: number, transferredBytes: number, taskId: string, childNode: TransferNode) => void
  ): Promise<void> {
    if (!this.sftpHandle) {
      throw new Error('SFTP not connected')
    }

    const localPath = node.localPath!

    // 创建本地目录（必须同步完成，否则子文件写入可能失败）
    if (!fs.existsSync(localPath)) {
      fs.mkdirSync(localPath, { recursive: true })
    }

    if (!node.children || node.children.length === 0) {
      return
    }

    // ── 构建任务数组：将所有子节点的传输任务封装为函数 ────────────
    // 使用函数包裹是为了延迟执行（runConcurrent 内部按需调用）
    const tasks: (() => Promise<void>)[] = node.children.map((child) => {
      return async () => {
        if (child.isDirectory) {
          // 目录：递归进入（内部也会并发处理其子节点）
          await this.downloadFolder(taskId, child, onProgress)
        } else {
          // 文件：直接下载（单个文件的 chunk 仍然是串行的）
          await this.downloadFile(taskId, child, onProgress)
        }
      }
    })

    // ── 并发执行所有子节点任务（最大并行数 = MAX_CONCURRENCY=5）────
    // runConcurrent 会自动控制并发数，避免同时打开过多 SFTP 连接
    // 任一任务失败会立即 reject（与原串行行为的错误传播一致）
    await this.runConcurrent(tasks)
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
   * @param transferredBytes - 已传输的字节数
   * @param lastUpdateTime - 上次更新时间戳
   * @param lastTransferredBytes - 上次已传输的字节数
   * @returns 传输速度（字节/秒）
   */
  private calculateTransferSpeed(
    transferredBytes: number,
    lastUpdateTime: number,
    lastTransferredBytes: number
  ): number {
    const now = Date.now()
    const timeDiff = (now - lastUpdateTime) / 1000
    return timeDiff > 0 ? (transferredBytes - lastTransferredBytes) / timeDiff : 0
  }

  /**
   * 并发池执行器（Promise Pool）
   * 
   * 设计说明：
   *   - 解决 P0 问题：将串行 await 改为受控并发执行
   *   - 核心原理：维护一个运行队列，最多同时运行 N 个任务
   *   - 当某个任务完成时，自动从等待队列取出下一个任务启动
   *   - 相比 Promise.all() 的优势：不会一次性启动所有任务导致内存/连接压力过大
   * 
   * 时间线对比（3个文件，并发数=2）：
   *   串行：[文件1完成] → [文件2完成] → [文件3完成]  总耗时：T1+T2+T3
   *   并发：[文件1][文件2] → [文件3]                    总耗时：max(T1,T2) + T3
   * 
   * @param tasks - 任务数组（返回 Promise 的函数）
   * @param concurrency - 最大并发数（默认使用 MAX_CONCURRENCY=5）
   * @returns 所有任务完成的 Promise（任一失败则 reject）
   */
  private async runConcurrent<T>(
    tasks: (() => Promise<T>)[],
    concurrency: number = SFTPService.MAX_CONCURRENCY
  ): Promise<T[]> {
    const results: T[] = []
    const executing: Set<Promise<void>> = new Set()

    for (const task of tasks) {
      // 创建任务包装器：执行任务并收集结果
      const promise = task().then(result => {
        results.push(result)
        // 任务完成后从 executing 集合中移除（通过 finally 实现）
      })

      // 将当前任务加入执行集合
      const promiseWrapper = promise.then(() => {
        executing.delete(promiseWrapper)
      })
      executing.add(promiseWrapper)

      // 达到并发上限时，等待任意一个任务完成后再继续
      if (executing.size >= concurrency) {
        await Promise.race(executing)
      }
    }

    // 等待所有剩余任务完成
    await Promise.all(executing)
    return results
  }

  /**
   * 上传文件
   */
  async uploadFile(
    taskId: string,
    node: TransferNode,
    onProgress?: (speed: number, transferredBytes: number, taskId: string, node: TransferNode) => void
  ): Promise<void> {
    if (!this.sftpHandle) {
      throw new Error('SFTP not connected')
    }

    const localPath = node.localPath!
    const remotePath = node.remotePath!

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

          // ── 背压控制：暂停读取流直到 write 回调完成 ─────────────────
          // 设计说明：
          //   - readStream.on('data') 持续触发会导致大量 write 请求堆积在内存中
          //   - 网络慢时可能内存溢出（大文件上传场景）
          //   - position 变量在回调乱序时可能出现竞态条件
          // 解决方案：
          //   - 每次收到 data 事件后立即 pause()
          //   - write 回调完成后 resume() 继续读取下一个 chunk
          //   - 与 downloadFile 的递归 readChunk() 模式对齐（串行写入）
          readStream.on('data', (chunk) => {
            // 收到数据后立即暂停读取流（背压控制核心）
            readStream.pause()

            // 检查是否被取消
            if (this.uploadCancelled) {
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

              // ── 每次 chunk 写入远程后：触发进度回调 + 恢复读取 ────────
              if (onProgress && fileSize > 0) {
                const speed = this.calculateTransferSpeed(
                  uploadedBytes,
                  lastUpdateTime,
                  lastUploadedBytes
                )
                
                lastUpdateTime = Date.now()
                lastUploadedBytes = uploadedBytes
                
                onProgress(speed, uploadedBytes, taskId, node)
              }

              // 写入完成，恢复读取流（背压控制：允许读取下一个 chunk）
              readStream.resume()
            })
          })

          readStream.on('end', () => {
            try {
              this.sftpHandle.close(handle)
            } catch (closeErr) {
              // 忽略关闭错误
            }
            // ── 文件上传完成（readStream end 事件）：触发最后一次进度回调 ──
            // 需要在此处补发的原因：
            //   1. 空文件（0 字节）不会触发 data 事件，进度回调永远不会执行
            //   2. 非空文件最后一个 chunk 的 write 回调可能滞后于 end 事件
            //      导致最后一次进度丢失，前端进度条卡在 99%
            if (onProgress) {
              const speed = this.calculateTransferSpeed(
                uploadedBytes,
                lastUpdateTime,
                lastUploadedBytes
              )
              onProgress(speed, uploadedBytes, taskId, node)
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
    taskId: string,
    node: TransferNode,
    onProgress?: (speed: number, transferredBytes: number, taskId: string, node: TransferNode) => void
  ): Promise<void> {
    if (!this.sftpHandle) {
      throw new Error('SFTP not connected')
    }

    const remotePath = node.remotePath!

    try {
      await this.mkdir(remotePath)
    } catch (error: any) {
      throw error
    }

    await this.uploadDirectoryRecursive(taskId, node, onProgress)
  }

  /**
   * 递归上传目录（并发版本）
   * 
   * 优化说明（解决 P0 问题）：
   *   - 原实现：for 循环 + await，文件完全串行上传
   *   - 新实现：使用 runConcurrent 并发池，最多同时上传 5 个文件
   *   - 与 downloadFolder 对称设计，保持一致的并发策略
   * 
   * 取消机制保持不变：
   *   - 每个任务开始前检查 this.uploadCancelled 标志
   *   - uploadFile 内部也会检查该标志（细粒度取消）
   */
  private async uploadDirectoryRecursive(
    taskId: string,
    node: TransferNode,
    onProgress?: (speed: number, transferredBytes: number, taskId: string, childNode: TransferNode) => void
  ): Promise<void> {
    if (this.uploadCancelled) {
      throw new Error('Upload cancelled')
    }

    const remoteDir = node.remotePath!

    // 创建远程目录（必须同步完成，否则子文件上传可能失败）
    try {
      await this.mkdir(remoteDir)
    } catch (error: any) {
      throw error
    }

    if (!node.children || node.children.length === 0) {
      return
    }

    // ── 构建任务数组：将所有子节点的上传任务封装为函数 ────────────
    const tasks: (() => Promise<void>)[] = node.children.map((child) => {
      return async () => {
        // 检查是否被取消（在任务开始前）
        if (this.uploadCancelled) {
          throw new Error('Upload cancelled')
        }

        if (child.isDirectory) {
          // 目录：递归进入（内部也会并发处理其子节点）
          await this.uploadDirectoryRecursive(taskId, child, onProgress)
        } else {
          // 文件：直接上传
          await this.uploadFile(taskId, child, onProgress)
        }
      }
    })

    // ── 并发执行所有子节点任务 ─────────────────────────────────────
    await this.runConcurrent(tasks)
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
   * 删除远程文件或目录（递归，并发版本）
   * 
   * 优化说明（解决 P2 问题）：
   *   - 原实现：for 循环 + await，子项完全串行删除
   *   - 新实现：使用 runConcurrent 并发池，最多同时删除 5 个子项
   *   - 性能提升：假设 100 个文件，RTT=50ms
   *     串行：100 × 50ms = 5秒 纯网络等待
   *     并发：100/5 × 50ms = 1秒 网络等待（5倍提升）
   * 
   * 设计约束：
   *   - 必须等所有子项删除完成后才能 rmdir（否则目录非空会失败）
   *   - 进度上报调整为：开始0% → 完成100%（不再逐个上报中间进度）
   *     原因：并发执行时，完成顺序不确定，按顺序上报中间进度无意义
   *   - 错误传播机制保持不变：任一子项失败立即 reject
   */
  async deleteFile(
    taskId: string,
    node: TransferNode,
    onProgress?: (speed: number, transferredBytes: number, taskId: string, childNode: TransferNode) => void
  ): Promise<void> {
    if (!this.sftpHandle) {
      throw new Error('SFTP not connected')
    }

    const remotePath = node.remotePath!

    // ── 删除开始：上报 0% 进度 ─────────────────────────────────────
    if (onProgress) {
      onProgress(0, 0, taskId, node)
    }

    return new Promise((resolve, reject) => {
      this.sftpHandle.stat(remotePath, (err: Error, stats: any) => {
        if (err) {
          console.error('SFTPService.deleteFile stat 失败:', { remotePath, error: err.message })
          reject(err)
          return
        }

        if (stats.isDirectory()) {
          // ── 目录：并发删除子项，完成后上报 100% ───────────────────
          this.sftpHandle.readdir(remotePath, async (err: Error, entries: any[]) => {
            if (err) {
              console.error('SFTPService.deleteFile readdir 失败:', { remotePath, error: err.message })
              reject(err)
              return
            }

            // 过滤有效子项（排除 . 和 ..）
            const validEntries = entries.filter(e => e.filename !== '.' && e.filename !== '..')

            if (validEntries.length === 0) {
              // ── 空目录：直接 rmdir ─────────────────────────────────
              this.sftpHandle.rmdir(remotePath, (err: Error) => {
                if (err) {
                  console.error('SFTPService.deleteFile rmdir 失败:', { remotePath, error: err.message })
                  reject(err)
                } else {
                  console.log('SFTPService.deleteFile 目录删除成功:', { remotePath})
                  if (onProgress) {
                    onProgress(0, node.size || 0, taskId, node)
                  }
                  resolve()
                }
              })
              return
            }

            // ── 构建任务数组：将所有子项的删除任务封装为函数 ──────────
            const tasks: (() => Promise<void>)[] = validEntries.map((entry) => {
              return async () => {
                // 使用 path.posix.join 拼接远程路径（SFTP 服务器是 Linux，分隔符固定为 /）
                const childPath = path.posix.join(remotePath, entry.filename)

                // 在 TransferNode 树中查找匹配的子节点（扫描阶段已构建好的树结构）
                const childNode = node.children?.find(c => c.remotePath === childPath)
                
                if (childNode) {
                  // ── 正常路径：子节点在树中找到了 ──────────────────────
                  await this.deleteFile(taskId, childNode, onProgress)
                } else {
                  // ── 异常回退路径：子节点不在树中 ──────────────────────
                  await this.deleteFileByPath(taskId, childPath, node, onProgress)
                }
              }
            })

            try {
              // ── 并发执行所有子项删除任务 ─────────────────────────────
              // runConcurrent 会自动控制并发数（默认5），避免服务器压力过大
              // 任一任务失败会抛出异常（与原串行行为的错误传播一致）
              await this.runConcurrent(tasks)

              // ── 所有子项删除完毕：rmdir 空目录 + 上报 100% ─────────────
              this.sftpHandle.rmdir(remotePath, (err: Error) => {
                if (err) {
                  console.error('SFTPService.deleteFile rmdir 失败:', { remotePath, error: err.message })
                  reject(err)
                } else {
                  console.log('SFTPService.deleteFile 目录删除成功:', { remotePath})
                  if (onProgress) {
                    onProgress(0, node.size || 0, taskId, node)
                  }
                  resolve()
                }
              })
            } catch (error: any) {
              console.error('SFTPService.deleteFile 并发删除子项失败:', { remotePath, error: error.message })
              reject(error)
            }
          })
        } else {
          // ── 文件：unlink + 上报 100% ────────────────────────────────
          this.sftpHandle.unlink(remotePath, (err: Error) => {
            if (err) {
              console.error('SFTPService.deleteFile unlink 失败:', { remotePath, error: err.message })
              reject(err)
            } else {
              console.log('SFTPService.deleteFile 文件删除成功:', { remotePath})
              if (onProgress) {
                onProgress(0, node.size || 0, taskId, node)
              }
              resolve()
            }
          })
        }
      })
    })
  }

  /**
   * 回退方法：当子节点不在 TransferNode 树中时，用路径方式删除
   * 仅在 deleteFile 内部调用，保持对外 API 统一
   * 
   * 调用场景（何时触发此方法）：
   *   1. 扫描目录树后，其他进程新建了文件/文件夹（readdir 返回了但树中没有）
   *   2. 扫描时因权限不足跳过了某些隐藏文件
   *   3. 符号链接等特殊文件类型未被 scanRemoteTree 收录到树中
   * 
   * 注意：此方法没有对应的 TransferNode 子对象，进度统一关联到 parentNode（父节点）
   * 
   * 进度上报策略：
   *   - 特殊文件的 size 未被计入 parentNode.size（扫描时未收录）
   *   - 因此完成时不能传 parentNode.size（否则前端计算 100%，导致父节点提前跳满）
   *   - 只在开始时上报 0% 告知前端"在工作中"，完成后不上报（避免干扰正常进度）
   */
  private async deleteFileByPath(
    taskId: string,
    remotePath: string,
    parentNode: TransferNode,
    onProgress?: (speed: number, transferredBytes: number, taskId: string, childNode: TransferNode) => void
  ): Promise<void> {
    if (!this.sftpHandle) {
      throw new Error('SFTP not connected')
    }

    // ── 回退路径开始：上报 0% 进度（关联到父节点） ──────────────────
    // 仅告知前端"正在处理回退路径"，不改变实际百分比
    if (onProgress) {
      onProgress(0, 0, taskId, parentNode)
    }

    return new Promise((resolve, reject) => {
      this.sftpHandle.stat(remotePath, (err: Error, stats: any) => {
        if (err) {
          reject(err)
          return
        }

        if (stats.isDirectory()) {
          // ── 回退目录：递归删除子项 ────────────────────────────────
          this.sftpHandle.readdir(remotePath, async (err: Error, entries: any[]) => {
            if (err) { reject(err); return }

            // 过滤有效子项
            const validEntries = entries.filter(e => e.filename !== '.' && e.filename !== '..')

            for (const entry of validEntries) {
              const childPath = path.posix.join(remotePath, entry.filename)
              await this.deleteFileByPath(taskId, childPath, parentNode, onProgress)
            }

            // ── 回退目录所有子项删除完毕：rmdir ─────────────────────
            // 注意：不上报 100% 进度！因为此目录的 size 未计入 parentNode.size
            // 如果传 parentNode.size 会导致前端计算 progress=100%，父节点提前跳满
            this.sftpHandle.rmdir(remotePath, (err: Error) => {
              if (err) { reject(err) } else { resolve() }
            })
          })
        } else {
          // ── 回退文件：unlink ─────────────────────────────────────
          // 同样不上报 100%，原因同上
          this.sftpHandle.unlink(remotePath, (err: Error) => {
            if (err) { reject(err) } else { resolve() }
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

  // ==================== v5 优化：文件树扫描方法 ====================

  /** Windows 系统受保护目录列表（扫描时自动跳过） */
  private static readonly SYSTEM_PROTECTED_DIRS: string[] = [
    'System Volume Information',
    '$Recycle.Bin',
    '$RECYCLE.BIN',
    'Recovery',
    'Config.Msi'
  ]

  /**
   * 扫描本地文件树（用于上传前的文件扫描）
   * 
   * v5 优化：直接返回 TransferNode 对象（无循环引用，可安全通过 IPC 序列化）
   * 支持单文件和文件夹（含空目录）
   * 
   * @param folderPath 要扫描的本地路径（文件或文件夹）
   * @param remoteBasePath 远程基础路径（用于生成远程路径）
   * @returns 扫描结果（包含 TransferNode 根节点和统计信息）
   */
  async scanLocalTree(
    folderPath: string,
    remoteBasePath: string
  ): Promise<{ success: boolean; root?: TransferNode; totalFiles?: number; totalBytes?: number; error?: string }> {
    const normalizedFolderPath = path.normalize(folderPath)
    const folderName = path.basename(normalizedFolderPath)

    try {
      // 验证路径存在
      const stat = await fs.promises.stat(normalizedFolderPath)

      // 单文件：直接返回文件节点作为根
      if (stat.isFile()) {
        const fileNode: TransferNode = {
          id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: folderName,
          isDirectory: false,
          type: 'upload',
          status: 'pending',
          progress: 0,
          size: stat.size,
          localPath: normalizedFolderPath,
          remotePath: path.posix.join(remoteBasePath, folderName),
          speed: 0,
          transferredBytes: 0
        }
        console.log(`[scanLocalTree] 单文件扫描完成: ${folderName}, 大小 ${stat.size} 字节`)
        return { success: true, root: fileNode, totalFiles: 1, totalBytes: stat.size }
      }

      // 文件夹：创建根节点并递归扫描
      const rootNode: TransferNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: folderName,
      isDirectory: true,
      type: 'upload',
      status: 'pending',
      progress: 0,
      size: 0,
      localPath: normalizedFolderPath,
      remotePath: path.posix.join(remoteBasePath, folderName),
      speed: 0,
      transferredBytes: 0,
      children: []
    }

    // 递归扫描函数（内部辅助函数，并发版本）
      // 设计思路：分类后并发（与 scanRemoteDir 一致）
      async function scanDir(
        this: SFTPService,
        currentPath: string,
        currentNode: TransferNode,
        currentRemotePath: string
      ): Promise<{ files: number; bytes: number }> {
        let totalFiles = 0
        let totalBytes = 0

        // 读取目录内容（必须先获取完整列表才能分类）
        const entries = await fs.promises.readdir(currentPath, { withFileTypes: true })

        // 分类：分离文件和目录条目
        const fileEntries: typeof entries = []
        const dirEntries: typeof entries = []

        for (const entry of entries) {
          if (entry.name === '.' || entry.name === '..') {
            continue
          }
          if (entry.isDirectory()) {
            dirEntries.push(entry)
          } else if (entry.isFile()) {
            fileEntries.push(entry)
          }
        }

        // 处理文件：纯内存操作，无需并发
        for (const entry of fileEntries) {
          const fullPath = path.join(currentPath, entry.name)
          const fullRemotePath = path.posix.join(currentRemotePath, entry.name)

          try {
            const fileStat = await fs.promises.stat(fullPath)

            const fileNode: TransferNode = {
              id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: entry.name,
              isDirectory: false,
              type: 'upload',
              status: 'pending',
              progress: 0,
              size: fileStat.size,
              localPath: path.normalize(fullPath),
              remotePath: fullRemotePath,
              speed: 0,
              transferredBytes: 0,
              parentId: currentNode.id
            }

            currentNode.children?.push(fileNode)
            totalFiles++
            totalBytes += fileStat.size

          } catch (fileError: any) {
            console.warn(`[scanLocalTree] 无法读取文件 ${fullPath}，已跳过:`, fileError.message)
          }
        }

        // 处理目录：并发扫描（核心优化点）
        if (dirEntries.length > 0) {
          // 构建延迟执行任务数组：每个任务负责扫描一个子目录
          const dirTasks: (() => Promise<{ files: number; bytes: number; node: TransferNode }>)[] =
            dirEntries.map((entry) => {
              return async () => {
                const fullPath = path.join(currentPath, entry.name)
                const fullRemotePath = path.posix.join(currentRemotePath, entry.name)

                // 跳过 Windows 系统受保护目录
                if (SFTPService.SYSTEM_PROTECTED_DIRS.includes(entry.name)) {
                  console.warn(`[scanLocalTree] 跳过系统受保护目录: ${entry.name}`)
                  return { files: 0, bytes: 0, node: null as unknown as TransferNode }
                }

                // 创建子目录节点
                const subNode: TransferNode = {
                  id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  name: entry.name,
                  isDirectory: true,
                  type: 'upload',
                  status: 'pending',
                  progress: 0,
                  size: 0,
                  localPath: path.normalize(fullPath),
                  remotePath: fullRemotePath,
                  speed: 0,
                  transferredBytes: 0,
                  parentId: currentNode.id,
                  children: []
                }

                try {
                  // 递归并发扫描子目录（内部也会对其子目录并发处理）
                  const subResult = await scanDir.call(this, fullPath, subNode, fullRemotePath)

                  // 更新子节点统计信息
                  subNode.totalFiles = subResult.files
                  subNode.size = subResult.bytes

                  return { ...subResult, node: subNode }

                } catch (subError: any) {
                  console.warn(`[scanLocalTree] 无法访问子目录 ${fullPath}，已跳过:`, subError.message)

                  // 扫描失败：创建错误节点，返回空统计
                  const errorNode: TransferNode = {
                    id: `node-error-${Date.now()}`,
                    name: entry.name,
                    isDirectory: true,
                    type: 'upload',
                    status: 'error',
                    progress: 0,
                    size: 0,
                    localPath: path.normalize(fullPath),
                    remotePath: fullRemotePath,
                    speed: 0,
                    transferredBytes: 0,
                    parentId: currentNode.id,
                    error: `无法访问: ${subError.message}`
                  }

                  return { files: 0, bytes: 0, node: errorNode }
                }
              }
            })

          // 并发执行所有目录扫描任务
          const results = await this!.runConcurrent(dirTasks, SFTPService.MAX_CONCURRENCY)

          // 汇聚统计信息并按名称排序插入 children（保持确定性顺序）
          const sortedResults = results
            .filter(r => r.node !== null)
            .sort((a, b) => a.node!.name.localeCompare(b.node!.name))
          for (const result of sortedResults) {
            totalFiles += result.files
            totalBytes += result.bytes
            currentNode.children?.push(result.node!)
          }
        }

        // 最终排序：文件和目录混合后统一按名称排序（保证确定性顺序）
        if (currentNode.children && currentNode.children.length > 1) {
          currentNode.children.sort((a, b) => a.name.localeCompare(b.name))
        }

        // 更新当前节点的统计信息
        currentNode.totalFiles = totalFiles
        currentNode.size = totalBytes

        return { files: totalFiles, bytes: totalBytes }
      }

      // 开始递归扫描（绑定 this 上下文以访问 runConcurrent 实例方法）
      await scanDir.call(this, normalizedFolderPath, rootNode, rootNode.remotePath || '')

      console.log(`[scanLocalTree] 扫描完成：${rootNode.totalFiles} 个文件，总大小 ${rootNode.size} 字节`)

      return { success: true, root: rootNode, totalFiles: rootNode.totalFiles, totalBytes: rootNode.size }

    } catch (error: any) {
      console.error(`[scanLocalTree] 扫描失败: ${folderPath}`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 扫描远程文件树（用于下载/删除前的文件扫描）
   * 
   * v5 优化：直接返回 TransferNode 对象（无循环引用，可安全通过 IPC 序列化）
   * 远程路径统一使用 / 分隔符（SFTP 标准），本地路径使用 path.join 屏蔽系统差异
   * 支持单文件和文件夹（含空目录）
   * 
   * @param remotePath 要扫描的远程路径（文件或文件夹）
   * @param localBasePath 本地基础路径（可选，下载时用于生成本地路径）
   * @returns 扫描结果（包含 TransferNode 根节点和统计信息）
   */
  async scanRemoteTree(
    remotePath: string,
    localBasePath?: string
  ): Promise<{ success: boolean; root?: TransferNode; totalFiles?: number; totalBytes?: number; error?: string }> {
    const remoteName = remotePath.split('/').pop() || remotePath

    try {
      // 验证 SFTP 连接状态
      if (!this.sftpHandle) {
        throw new Error('SFTP 未连接')
      }

      // 判断远程路径是文件还是目录（Promise 包装 callback 风格的 stat）
      const stats = await new Promise<any>((resolve, reject) => {
        this.sftpHandle!.stat(remotePath, (err: Error, s: any) => {
          if (err) reject(err)
          else resolve(s)
        })
      })

      // 单文件：直接返回文件节点作为根
      if (!stats.isDirectory()) {
        const fileNode: TransferNode = {
          id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: remoteName,
          isDirectory: false,
          type: localBasePath ? 'download' : 'delete',
          status: 'pending',
          progress: 0,
          size: stats.size || 0,
          localPath: localBasePath ? path.normalize(path.join(localBasePath, remoteName)) : '',
          remotePath: remotePath,
          speed: 0,
          transferredBytes: 0
        }
        console.log(`[scanRemoteTree] 单文件扫描完成: ${remoteName}, 大小 ${stats.size || 0} 字节`)
        return { success: true, root: fileNode, totalFiles: 1, totalBytes: stats.size || 0 }
      }

      // 文件夹：创建根节点并递归扫描
      const rootNode: TransferNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: remoteName,
      isDirectory: true,
      type: localBasePath ? 'download' : 'delete',
      status: 'pending',
      progress: 0,
      size: 0,
      localPath: localBasePath ? path.normalize(path.join(localBasePath, remoteName)) : '',
      remotePath: remotePath,
      speed: 0,
      transferredBytes: 0,
      children: []
    }

    // 递归扫描函数（内部辅助函数，并发版本）
      // 设计思路：分类后并发
      // 1. listDir 获取完整列表（必须串行）
      // 2. 分离文件（纯内存，直接处理）和目录（需要网络，并发扫描）
      // 3. 目录使用 runConcurrent 并发递归扫描
      // 4. 所有子项完成后统一汇聚统计信息
      async function scanRemoteDir(
        this: SFTPService,
        currentRemotePath: string,
        currentNode: TransferNode,
        currentLocalBase: string
      ): Promise<{ files: number; bytes: number }> {
        let totalFiles = 0
        let totalBytes = 0

        // 列出远程目录内容（必须先获取完整列表才能分类）
        const entries = await this!.listDir(currentRemotePath)

        // 分类：分离文件和目录条目
        const fileEntries: typeof entries = []
        const dirEntries: typeof entries = []

        for (const entry of entries) {
          if (entry.name === '.' || entry.name === '..') {
            continue
          }
          if (entry.isDirectory) {
            dirEntries.push(entry)
          } else {
            fileEntries.push(entry)
          }
        }

        // 处理文件：纯内存操作（创建节点），无需并发
        for (const entry of fileEntries) {
          const fullRemotePath = `${currentRemotePath}/${entry.name}`
          const fullLocalPath = path.normalize(path.join(currentLocalBase, entry.name))

          const fileNode: TransferNode = {
            id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: entry.name,
            isDirectory: false,
            type: localBasePath ? 'download' : 'delete',
            status: 'pending',
            progress: 0,
            size: entry.size || 0,
            localPath: fullLocalPath,
            remotePath: fullRemotePath,
            speed: 0,
            transferredBytes: 0,
            parentId: currentNode.id
          }

          currentNode.children?.push(fileNode)
          totalFiles++
          totalBytes += entry.size || 0
        }

        // 处理目录：并发扫描（核心优化点）
        if (dirEntries.length > 0) {
          // 构建延迟执行任务数组：每个任务负责扫描一个子目录
          const dirTasks: (() => Promise<{ files: number; bytes: number; node: TransferNode }>)[] =
            dirEntries.map((entry) => {
              return async () => {
                const fullRemotePath = `${currentRemotePath}/${entry.name}`
                const fullLocalPath = path.normalize(path.join(currentLocalBase, entry.name))

                // 创建子目录节点
                const subNode: TransferNode = {
                  id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  name: entry.name,
                  isDirectory: true,
                  type: localBasePath ? 'download' : 'delete',
                  status: 'pending',
                  progress: 0,
                  size: 0,
                  localPath: fullLocalPath,
                  remotePath: fullRemotePath,
                  speed: 0,
                  transferredBytes: 0,
                  parentId: currentNode.id,
                  children: [],
                  totalFiles: 0,
                  completedFiles: 0,
                  expanded: false
                }

                try {
                  // 递归并发扫描子目录（内部也会对其子目录并发处理）
                  const subResult = await scanRemoteDir.call(
                    this, fullRemotePath, subNode, fullLocalPath
                  )

                  // 更新子节点统计信息
                  subNode.totalFiles = subResult.files
                  subNode.size = subResult.bytes

                  return { ...subResult, node: subNode }

                } catch (subError: any) {
                  console.warn(`[scanRemoteTree] 无法访问远程子目录 ${fullRemotePath}，已跳过:`, subError.message)

                  // 扫描失败：创建错误节点，返回空统计
                  const errorNode: TransferNode = {
                    id: `node-error-${Date.now()}`,
                    name: entry.name,
                    isDirectory: true,
                    type: localBasePath ? 'download' : 'delete',
                    status: 'error',
                    progress: 0,
                    size: 0,
                    localPath: fullLocalPath,
                    remotePath: fullRemotePath,
                    speed: 0,
                    transferredBytes: 0,
                    parentId: currentNode.id,
                    error: `无法访问目录: ${subError.message}`,
                    children: []
                  }

                  return { files: 0, bytes: 0, node: errorNode }
                }
              }
            })

          // 并发执行所有目录扫描任务，复用已有的 runConcurrent 方法
          const results = await this!.runConcurrent(dirTasks, SFTPService.MAX_CONCURRENCY)

          // 汇聚统计信息并按名称排序插入 children（保持确定性顺序）
          const sortedResults = results.sort((a, b) =>
            a.node.name.localeCompare(b.node.name)
          )
          for (const result of sortedResults) {
            totalFiles += result.files
            totalBytes += result.bytes
            currentNode.children?.push(result.node)
          }
        }

        // 最终排序：文件和目录混合后统一按名称排序（保证确定性顺序）
        if (currentNode.children && currentNode.children.length > 1) {
          currentNode.children.sort((a, b) => a.name.localeCompare(b.name))
        }

        // 更新当前节点的统计信息
        currentNode.totalFiles = totalFiles
        currentNode.size = totalBytes

        return { files: totalFiles, bytes: totalBytes }
      }

      // 开始递归扫描（绑定 this 上下文）
      // 注意：currentLocalBase 必须传入 rootNode.localPath（含文件夹名），
      //       而非原始 localBasePath，否则子节点的 localPath 会缺少父目录层级
      const boundScanRemoteDir = scanRemoteDir.bind(this)
      await boundScanRemoteDir(remotePath, rootNode, rootNode.localPath || '')

      console.log(`[scanRemoteTree] 扫描完成：${rootNode.totalFiles} 个文件，总大小 ${rootNode.size} 字节`)

      return { success: true, root: rootNode, totalFiles: rootNode.totalFiles, totalBytes: rootNode.size }

    } catch (error: any) {
      console.error(`[scanRemoteTree] 扫描失败: ${remotePath}`, error)
      return { success: false, error: error.message }
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
