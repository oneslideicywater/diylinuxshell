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
          const buffer = Buffer.alloc(32 * 1024) // 32KB buffer

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
   * 递归下载文件夹
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

    if (!fs.existsSync(localPath)) {
      fs.mkdirSync(localPath, { recursive: true })
    }

    if (!node.children || node.children.length === 0) {
      return
    }

    // ── 遍历子节点：将同一 onProgress 回调透传给子文件/子文件夹 ─────
    // 文件夹本身不上报进度，进度由叶子节点（文件）逐个触发回调后前端聚合
    // ── 遍历子节点：将同一 onProgress 回调透传给子文件/子文件夹 ─────
    // 与 downloadFolder 对称设计：文件夹不上报进度，叶子文件逐个触发
    for (const child of node.children) {
      if (child.isDirectory) {
        await this.downloadFolder(taskId, child, onProgress)
      } else {
        await this.downloadFile(taskId, child, onProgress)
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
   * 递归上传目录
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

    try {
      await this.mkdir(remoteDir)
    } catch (error: any) {
      throw error
    }

    if (!node.children || node.children.length === 0) {
      return
    }

    for (const child of node.children) {
      if (this.uploadCancelled) {
        throw new Error('Upload cancelled')
      }

      if (child.isDirectory) {
        await this.uploadDirectoryRecursive(taskId, child, onProgress)
      } else {
        await this.uploadFile(taskId, child, onProgress)
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
   * 
   * 设计对齐 uploadFile/downloadFile 模式：
   *   - 接收 TransferNode 而非 remotePath 字符串
   *   - 回调签名统一为 (speed, transferredBytes, taskId, node)
   *   - 文件：删除前 0%，删除完成 100%
   *   - 目录：删除前 0%，递归删完子项后 100%
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
          // ── 目录：递归删除子项，完成后上报 100% ───────────────────
          this.sftpHandle.readdir(remotePath, async (err: Error, entries: any[]) => {
            if (err) {
              console.error('SFTPService.deleteFile readdir 失败:', { remotePath, error: err.message })
              reject(err)
              return
            }

            // 过滤有效子项（排除 . 和 ..）
            const validEntries = entries.filter(e => e.filename !== '.' && e.filename !== '..')
            const totalChildren = validEntries.length

            // 删除所有子文件和子目录（通过 node.children 匹配子节点）
            // 每完成一个子项，上报父节点中间进度（避免长时间卡在 0%）
            for (let i = 0; i < validEntries.length; i++) {
              const entry = validEntries[i]
              
              // 使用 path.posix.join 拼接远程路径（SFTP 服务器是 Linux，分隔符固定为 /）
              // 注意：不能用 path.join！Windows 下 path.join 会输出 \ 分隔符，导致远程路径错误
              // 例：path.posix.join('/tmp', 'file') → '/tmp/file' ✅
              //     path.join('/tmp', 'file') (Windows) → '\tmp\file' ❌
              const childPath = path.posix.join(remotePath, entry.filename)

              // 在 TransferNode 树中查找匹配的子节点（扫描阶段已构建好的树结构）
              const childNode = node.children?.find(c => c.remotePath === childPath)
              
              if (childNode) {
                // ── 正常路径：子节点在树中找到了 ──────────────────────
                // childNode 包含完整的 TransferNode 信息（id、size、name 等）
                // 调用 deleteFile 时能正确传递 nodeId 给进度回调，
                // 前端可以精确匹配到对应节点并更新其进度条
                try {
                  await this.deleteFile(taskId, childNode, onProgress)
                } catch (error: any) {
                  console.error('SFTPService.deleteFile 删除子项失败:', { childPath, error: error.message })
                  reject(error)
                  return
                }
              } else {
                // ── 异常回退路径：子节点不在树中 ──────────────────────
                // 触发场景：
                //   1. 扫描目录树后，其他进程新建了文件/文件夹
                //   2. 扫描时因权限不足跳过了某些隐藏文件
                //   3. 符号链接等特殊文件类型未被收录到树中
                // 此时没有对应的 TransferNode 对象，只能用纯路径字符串删除
                // 进度会关联到 parentNode（父节点），而非具体的子节点
                try {
                  await this.deleteFileByPath(taskId, childPath, node, onProgress)
                } catch (error: any) {
                  console.error('SFTPService.deleteFile 删除子项失败(回退):', { childPath, error: error.message })
                  reject(error)
                  return
                }
              }

              // 每删除完一个子项，上报父节点中间进度
              // 进度 = (已完成数 / 总数) * 节点总大小，让父文件夹逐步推进而非卡在0%
              if (onProgress && totalChildren > 0 && node.size) {
                const completedRatio = (i + 1) / totalChildren
                const intermediateBytes = Math.floor(node.size * completedRatio)
                onProgress(0, intermediateBytes, taskId, node)
              }
            }

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

    // 递归扫描函数（内部辅助函数）
      async function scanDir(
        currentPath: string,
        currentNode: TransferNode,
        currentRemotePath: string
      ): Promise<{ files: number; bytes: number }> {
        let files = 0
        let bytes = 0

        // 读取目录内容
        const entries = await fs.promises.readdir(currentPath, { withFileTypes: true })

        for (const entry of entries) {
          // 跳过 . 和 .. 目录项
          if (entry.name === '.' || entry.name === '..') {
            continue
          }

          // 使用 path.join 拼接完整路径（屏蔽系统差异）
          const fullPath = path.join(currentPath, entry.name)
          const fullRemotePath = path.posix.join(currentRemotePath, entry.name)

          if (entry.isDirectory()) {
            // 跳过 Windows 系统受保护目录
            if (SFTPService.SYSTEM_PROTECTED_DIRS.includes(entry.name)) {
              console.warn(`[scanLocalTree] 跳过系统受保护目录: ${entry.name}`)
              continue
            }

            try {
              // 创建子目录节点（设置 parentId 建立父子关系）
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

              // 递归扫描子目录
              const subResult = await scanDir(fullPath, subNode, fullRemotePath)

              files += subResult.files
              bytes += subResult.bytes

              // 添加到当前节点的子节点列表
              currentNode.children?.push(subNode)

            } catch (subError: any) {
              console.warn(`[scanLocalTree] 无法访问子目录 ${fullPath}，已跳过:`, subError.message)

              // 创建错误节点
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

              currentNode.children?.push(errorNode)
            }

          } else if (entry.isFile()) {
            try {
              // 获取文件大小
              const fileStat = await fs.promises.stat(fullPath)

              // 创建文件节点（设置 parentId）
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

              files++
              bytes += fileStat.size

            } catch (fileError: any) {
              console.warn(`[scanLocalTree] 无法读取文件 ${fullPath}，已跳过:`, fileError.message)
            }
          }
        }

        // 更新当前节点的统计信息
        currentNode.totalFiles = files
        currentNode.size = bytes

        return { files, bytes }
      }

      // 开始递归扫描
      await scanDir(normalizedFolderPath, rootNode, rootNode.remotePath || '')

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

    // 递归扫描函数（内部辅助函数）
      async function scanRemoteDir(
        this: SFTPService,
        currentRemotePath: string,
        currentNode: TransferNode,
        currentLocalBase: string
      ): Promise<{ files: number; bytes: number }> {
        let files = 0
        let bytes = 0

        // 列出远程目录内容（使用实例方法 listDir）
        const entries = await this!.listDir(currentRemotePath)

        for (const entry of entries) {
          if (entry.name === '.' || entry.name === '..') {
            continue
          }

          // 构建完整路径（远程使用 /，本地使用 path.join）
          const fullRemotePath = `${currentRemotePath}/${entry.name}`
          const fullLocalPath = path.normalize(path.join(currentLocalBase, entry.name))

          if (entry.isDirectory) {
            try {
              // 创建子目录节点（设置 parentId）
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

              // 递归扫描子目录
              const subResult = await scanRemoteDir.call(this, fullRemotePath, subNode, fullLocalPath)

              files += subResult.files
              bytes += subResult.bytes

              currentNode.children?.push(subNode)

            } catch (subError: any) {
              console.warn(`[scanRemoteTree] 无法访问远程子目录 ${fullRemotePath}，已跳过:`, subError.message)

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

              currentNode.children?.push(errorNode)
            }
          } else {
            // 创建文件节点（设置 parentId）
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

            files++
            bytes += entry.size || 0
          }
        }

        // 更新当前节点的统计信息
        currentNode.totalFiles = files
        currentNode.size = bytes

        return { files, bytes }
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
