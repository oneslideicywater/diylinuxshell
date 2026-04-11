/**
 * SFTP 下载功能模块
 * 支持单文件、文件夹、批量下载
 * 使用统一的树形组件显示下载进度
 * @module sftp/download
 */

import type { Session } from '@shared/types'
import type { TransferTask, TransferNode } from '@shared/types/sftp'
import { useSftpTransferStore } from '@/stores/sftpTransfer'

/**
 * 递归扫描远程文件夹并构建传输节点树
 * @param remotePath 远程文件夹路径
 * @param localBasePath 本地基础路径（当前本地目录）
 * @param session SSH 会话
 * @returns 根节点和文件统计信息
 */
async function scanRemoteFolderRecursive(
  remotePath: string,
  localBasePath: string,
  session: Session
): Promise<{ rootNode: TransferNode; totalFiles: number; totalBytes: number }> {
  // 获取文件夹名称
  const folderName = remotePath.split('/').pop() || 'folder'
  
  // 创建当前文件夹节点（type 为 'download'）
  const currentNode: TransferNode = {
    id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: folderName,
    isDirectory: true,
    type: 'download',
    status: 'pending',
    progress: 0,
    size: 0,
    localPath: `${localBasePath}/${folderName}`,
    remotePath: remotePath,
    speed: 0,
    remaining: '',
    elapsed: '',
    children: [],
    totalFiles: 0,
    completedFiles: 0,
    expanded: false
  }
  
  let totalFiles = 0
  let totalBytes = 0
  
  try {
    // 通过 Electron API 列出远程目录内容
    const result = await window.api.sftp.listDir(session.id || session.host, remotePath)
    
    if (!result.success || !result.data) {
      throw new Error(result.error || '无法读取远程目录')
    }
    
    const entries = result.data

    // 遍历远程目录项，跳过父目录导航项
    for (const entry of entries) {
      // 跳过父目录导航项（.. 和 .）
      if (entry.name === '..' || entry.name === '.') {
        console.log(`[download] 跳过导航项: ${entry.name}`)
        continue
      }

      const fullRemotePath = `${remotePath}/${entry.name}`
      const fullLocalPath = `${localBasePath}/${folderName}/${entry.name}`

      if (entry.type === 'd' || entry.isDirectory) {
        // 递归扫描子文件夹（添加异常处理，跳过无权限访问的目录）
        try {
          const subResult = await scanRemoteFolderRecursive(
            fullRemotePath, 
            `${localBasePath}/${folderName}`, 
            session
          )

          if (currentNode.children) {
            currentNode.children.push(subResult.rootNode)
          }

          totalFiles += subResult.totalFiles
          totalBytes += subResult.totalBytes
        } catch (subError: any) {
          // 跳过无法访问的子目录，记录警告但不中断整个下载
          console.warn(`[download] 无法访问远程子目录 ${fullRemotePath}，已跳过:`, subError.message)
          
          // 创建错误标记节点
          const errorNode: TransferNode = {
            id: `node-error-${Date.now()}`,
            name: entry.name,
            isDirectory: true,
            type: 'download',
            status: 'error',
            progress: 0,
            size: 0,
            localPath: fullLocalPath,
            remotePath: fullRemotePath,
            speed: 0,
            remaining: '',
            elapsed: '',
            error: subError.message
          }
          
          if (currentNode.children) {
            currentNode.children.push(errorNode)
          }
        }
      } else {
        // 创建文件节点
        const fileNode: TransferNode = {
          id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: entry.name,
          isDirectory: false,
          type: 'download',
          status: 'pending',
          progress: 0,
          size: entry.size || 0,
          localPath: fullLocalPath,
          remotePath: fullRemotePath,
          speed: 0,
          remaining: '',
          elapsed: ''
        }
        
        if (currentNode.children) {
          currentNode.children.push(fileNode)
        }
        
        totalFiles += 1
        totalBytes += entry.size || 0
      }
    }

    // 更新文件夹节点的统计信息
    currentNode.totalFiles = totalFiles
    currentNode.size = totalBytes
    
  } catch (error: any) {
    console.error(`[download] 扫描远程文件夹失败 ${remotePath}:`, error)
    throw error
  }

  return { rootNode: currentNode, totalFiles, totalBytes }
}

/**
 * 下载单个文件（核心函数）
 * 通过 Store API 更新状态，支持进度回调
 * 
 * @param node 文件传输节点
 * @param session SSH 会话
 * @param taskId 任务 ID（用于 Store 更新）
 */
async function downloadSingleFile(
  node: TransferNode, 
  session: Session,
  taskId: string
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  console.log(`[download] 开始下载文件: ${node.name}`)
  console.log(`[download] 远程路径: ${node.remotePath}`)
  console.log(`[download] 本地路径: ${node.localPath}`)
  
  // 更新状态为传输中
  sftpTransferStore.updateNodeStatus(taskId, node.id, { status: 'transferring' })
  
  const startTime = Date.now()
  
  try {
    // 验证路径存在
    if (!node.localPath || !node.remotePath) {
      throw new Error('本地路径或远程路径为空')
    }
    
    // 确保本地目录存在（通过 Electron API 创建目录）
    const localDir = node.localPath.substring(0, node.localPath.lastIndexOf('/')) || 
                     node.localPath.substring(0, node.localPath.lastIndexOf('\\'))
    
    if (localDir) {
      // 使用 Node.js fs 模块确保目录存在（通过 IPC 调用）
      // 注意：如果 window.api.fs 不存在，可以尝试使用其他方式创建目录
      try {
        if ((window.api as any).fs?.ensureDir) {
          await (window.api as any).fs.ensureDir(localDir)
        } else {
          // 备用方案：使用 shell 命令创建目录（如果 API 不可用）
          console.warn('[download] fs.ensureDir API 不可用，跳过目录创建')
        }
      } catch (dirError: any) {
        console.warn(`[download] 创建本地目录失败（可能已存在）: ${localDir}`, dirError)
      }
    }
    
    // 执行下载操作（带进度回调）
    await window.api.sftp.download(
      session.id || session.host,
      node.remotePath,
      node.localPath
    )
    
    // 下载完成 - 更新最终状态
    const endTime = Date.now()
    const elapsedSeconds = Math.round((endTime - startTime) / 1000)
    
    sftpTransferStore.updateNodeStatus(taskId, node.id, {
      status: 'completed',
      progress: 100,
      size: node.size || 0,
      speed: 0,
      remaining: '00:00:00',
      elapsed: formatTime(elapsedSeconds)
    })
    
    console.log(`[download] ✅ 文件下载完成: ${node.name} (${formatTime(elapsedSeconds)})`)
    
  } catch (error: any) {
    console.error(`[download] ❌ 文件下载失败: ${node.name}`, error)
    
    // 更新错误状态
    sftpTransferStore.updateNodeStatus(taskId, node.id, {
      status: 'error',
      error: error.message || '下载失败'
    })
    
    throw error
  }
}

/**
 * 递归下载文件夹内容（利用 Pinia reactive 特性）
 * 通过 Store API 更新节点状态，自动触发视图响应式更新
 * 
 * @param node 当前节点（文件夹或文件）
 * @param session SSH 会话
 * @param taskId 任务 ID（用于 Store 更新）
 */
async function downloadFolderContent(
  node: TransferNode, 
  session: Session,
  taskId: string
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  if (!session) return
  
  if (node.isDirectory && node.children && node.children.length > 0) {
    // 如果是文件夹，先在本地创建目录
    if (node.localPath) {
      try {
        // 使用安全的 API 调用方式
        if ((window.api as any).fs?.ensureDir) {
          await (window.api as any).fs.ensureDir(node.localPath)
        } else {
          console.warn('[download] fs.ensureDir API 不可用，跳过目录创建')
        }
        console.log(`[download] 创建本地目录: ${node.localPath}`)
      } catch (error: any) {
        console.warn(`[download] 创建本地目录失败（可能已存在）: ${node.localPath}`, error)
      }
    }
    
    // 通过 Store 更新状态为传输中（利用 Pinia reactive 特性）
    sftpTransferStore.updateNodeStatus(taskId, node.id, {
      status: 'transferring'
    })
    
    // 递归下载所有子节点
    for (const child of node.children) {
      await downloadFolderContent(child, session, taskId)
      
      // 计算父节点的完成统计
      let completedFiles = 0
      let progress = 0
      
      if (node.children && node.children.length > 0) {
        completedFiles = node.children.filter(c => c.status === 'completed').length
        progress = Math.round((completedFiles / node.children.length) * 100)
      }
      
      // 每完成一个子文件就更新父节点状态（通过 Store API）
      sftpTransferStore.updateNodeStatus(taskId, node.id, {
        completedFiles,
        progress
      })
    }
    
    // 所有子节点下载完成 - 更新最终状态
    sftpTransferStore.updateNodeStatus(taskId, node.id, {
      status: 'completed',
      progress: 100
    })
    
  } else if (!node.isDirectory) {
    // 如果是文件，执行下载
    await downloadSingleFile(node, session, taskId)
  }
}

/**
 * 格式化时间（秒 -> HH:MM:SS）
 * @param seconds 秒数
 * @returns 格式化的时间字符串
 */
function formatTime(seconds: number): string {
  if (seconds < 0) return '00:00:00'
  
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':')
}

/**
 * 下载单个文件（独立函数）
 * @param remotePath 远程文件路径
 * @param session SSH 会话
 * @param localPath 本地目标路径（可以是字符串或 Ref<string>）
 */
export async function downloadFile(
  remotePath: string,
  session: Session | null,
  localPath: string | { value: string }
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  console.log('[download] 开始下载文件:', remotePath)
  
  if (!session) {
    throw new Error('会话不存在')
  }
  
  if (!remotePath) {
    throw new Error('远程文件路径不能为空')
  }
  
  try {
    // 获取文件名和本地基础路径
    const fileName = remotePath.split('/').pop() || 'file'
    const localBasePath = typeof localPath === 'string' ? localPath : localPath.value
    
    // 创建文件节点（type 为 'download'）
    const fileNode: TransferNode = {
      id: `node-${Date.now()}`,
      name: fileName,
      isDirectory: false,
      type: 'download',
      status: 'pending',
      progress: 0,
      size: 0, // 稍后通过进度回调更新
      localPath: `${localBasePath}/${fileName}`,
      remotePath: remotePath,
      speed: 0,
      remaining: '',
      elapsed: ''
    }
    
    // 创建传输任务并添加到 Store（type 为 'download'）
    const task: TransferTask = {
      id: `task-${Date.now()}`,
      type: 'download', // 关键：标记为下载任务
      status: 'pending',
      root: fileNode,
      totalBytes: 0,
      transferredBytes: 0,
      remainingTime: 0,
      elapsedTime: 0,
      createdAt: Date.now()
    }
    
    // 添加到 Store（返回 reactive 对象）
    sftpTransferStore.addTask(task)
    
    // 开始下载（传递 taskId 以确保响应式更新）
    console.log('[download] 正在下载文件...')
    
    // 注意：任务状态会在 downloadSingleFile 中当首个文件节点开始传输时自动从 pending 转换为 transferring
    
    await downloadSingleFile(fileNode, session, task.id)
    
    // 更新任务状态和统计
    task.status = 'completed'
    task.completedAt = Date.now()
    task.elapsedTime = Math.round((task.completedAt - task.createdAt) / 1000)
    task.totalBytes = fileNode.size
    task.transferredBytes = fileNode.size
    
    sftpTransferStore.updateTaskStatus(task.id, 'completed')
    
    console.log('[download] ✅ 文件下载完成！')
    
  } catch (error: any) {
    console.error('[download] ❌ 文件下载失败:', error)
    throw error
  }
}

/**
 * 下载文件夹主函数
 * @param remotePath 远程文件夹路径
 * @param session SSH 会话
 * @param localPath 本地目标路径（可以是字符串或 Ref<string>）
 */
export async function downloadFolder(
  remotePath: string,
  session: Session | null,
  localPath: string | { value: string }
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  console.log('[download] 开始下载文件夹:', remotePath)
  
  if (!session) {
    throw new Error('会话不存在')
  }
  
  if (!remotePath) {
    throw new Error('远程文件夹路径不能为空')
  }
  
  try {
    // 获取文件夹名和本地基础路径
    const folderName = remotePath.split('/').pop() || 'folder'
    const localBasePath = typeof localPath === 'string' ? localPath : localPath.value
    
    console.log(`[download] 文件夹名: ${folderName}`)
    console.log(`[download] 本地目标路径: ${localBasePath}`)
    
    // 递归扫描远程文件夹结构
    console.log('[download] 正在扫描远程文件夹结构...')
    const scanResult = await scanRemoteFolderRecursive(remotePath, localBasePath, session)
    
    console.log(`[download] 扫描完成：${scanResult.totalFiles} 个文件，总计 ${(scanResult.totalBytes / 1024 / 1024).toFixed(2)} MB`)
    
    // 创建传输任务（type 为 'download'）
    const task: TransferTask = {
      id: `task-${Date.now()}`,
      type: 'download', // 关键：标记为下载任务
      status: 'pending',
      root: scanResult.rootNode,
      totalBytes: scanResult.totalBytes,
      transferredBytes: 0,
      remainingTime: 0,
      elapsedTime: 0,
      createdAt: Date.now()
    }
    
    // 添加到 Store
    sftpTransferStore.addTask(task)
    
    // 开始递归下载文件夹内容
    console.log('[download] 开始下载文件夹内容...')
    
    await downloadFolderContent(scanResult.rootNode, session, task.id)
    
    // 更新任务状态和统计
    task.status = 'completed'
    task.completedAt = Date.now()
    task.elapsedTime = Math.round((task.completedAt - task.createdAt) / 1000)
    task.transferredBytes = scanResult.totalBytes
    
    sftpTransferStore.updateTaskStatus(task.id, 'completed')
    
    console.log('[download] ✅ 文件夹下载完成！')
    
  } catch (error: any) {
    console.error('[download] ❌ 文件夹下载失败:', error)
    throw error
  }
}
