/**
 * SFTP 删除功能模块（安全架构 v4）
 * 支持单文件、文件夹、批量删除
 * 使用统一的树形组件显示删除进度
 * 
 * 设计原则：
 * - 不再依赖 session 对象
 * - 直接使用 sftpConnectionId（SFTP 连接已在 TerminalTab 初始化时建立）
 * - 可选接收 sessionId（用于通过 SessionStore 获取会话名称等非敏感信息显示）
 * 
 * PRD 要求：
 * - 删除前显示确认对话框（显示待删除项列表）
 * - 使用 SftpTransferTreeNode 组件实时显示删除进度
 * - 支持取消批量删除任务
 * - 显示已删除数量、总数量、剩余时间、经过时间
 * - 删除完成后刷新远程文件列表
 * @module sftp/delete
 */

import type { TransferTask, TransferNode } from '@shared/types/sftp'
import { useSftpTransferStore } from '@/stores/sftpTransfer'

/**
 * 递归扫描远程文件夹并构建传输节点树（用于删除）
 * 
 * 安全架构 v4：
 * - 不再依赖 session 对象
 * - 直接使用 sftpConnectionId 调用 SFTP API
 * 
 * @param remotePath 远程文件夹路径
 * @param sftpConnectionId SFTP 连接标识符（已在 TerminalTab 初始化时建立）
 * @returns 根节点和文件统计信息
 */
async function scanRemoteFolderForDelete(
  remotePath: string,
  sftpConnectionId: string
): Promise<{ rootNode: TransferNode; totalFiles: number; totalBytes: number }> {
  // 获取文件夹名称
  const folderName = remotePath.split('/').pop() || 'folder'
  
  // 创建当前文件夹节点（type 为 'delete'）
  const currentNode: TransferNode = {
    id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: folderName,
    isDirectory: true,
    type: 'delete',
    status: 'pending',
    progress: 0,
    size: 0,
    localPath: '', // 删除操作不需要本地路径
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
    // 通过 Electron API 列出远程目录内容（使用已建立的 sftpConnectionId）
    const result = await window.api.sftp.listDir(sftpConnectionId, remotePath)
    
    if (!result.success || !result.data) {
      throw new Error(result.error || '无法读取远程目录')
    }
    
    const entries = result.data

    // 遍历远程目录项，跳过父目录导航项
    for (const entry of entries) {
      // 跳过父目录导航项（.. 和 .）
      if (entry.name === '..' || entry.name === '.') {
        console.log(`[delete] 跳过导航项: ${entry.name}`)
        continue
      }

      const fullRemotePath = `${remotePath}/${entry.name}`

      if (entry.type === 'd' || entry.isDirectory) {
        // 递归扫描子文件夹（添加异常处理，跳过无权限访问的目录）
        try {
          const subResult = await scanRemoteFolderForDelete(fullRemotePath, sftpConnectionId)

          if (currentNode.children) {
            currentNode.children.push(subResult.rootNode)
          }

          totalFiles += subResult.totalFiles
          totalBytes += subResult.totalBytes
        } catch (subError: any) {
          // 跳过无法访问的子目录，记录警告但不中断整个删除
          console.warn(`[delete] 无法访问远程子目录 ${fullRemotePath}，已跳过:`, subError.message)
          
          // 创建错误标记节点
          const errorNode: TransferNode = {
            id: `node-error-${Date.now()}`,
            name: entry.name,
            isDirectory: true,
            type: 'delete',
            status: 'error',
            progress: 0,
            size: 0,
            localPath: '',
            remotePath: fullRemotePath,
            speed: 0,
            remaining: '',
            elapsed: '',
            error: `无法访问目录: ${subError.message}`,
            children: []
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
          type: 'delete',
          status: 'pending',
          progress: 0,
          size: entry.size || 0,
          localPath: '',
          remotePath: fullRemotePath,
          speed: 0,
          remaining: '',
          elapsed: ''
        }

        if (currentNode.children) {
          currentNode.children.push(fileNode)
        }

        totalFiles++
        totalBytes += entry.size || 0
      }
    }

    // 更新当前节点的统计信息
    currentNode.totalFiles = totalFiles
    currentNode.size = totalBytes
    
    return { rootNode: currentNode, totalFiles, totalBytes }
    
  } catch (error: any) {
    console.error(`[delete] 扫描远程文件夹失败: ${remotePath}`, error)
    throw error
  }
}

/**
 * 删除单个文件/文件夹（原子操作）
 * 
 * 安全架构 v4：
 * - 不再依赖 session 对象
 * - 直接使用 sftpConnectionId 调用 SFTP API
 * 
 * @param node 当前节点
 * @param sftpConnectionId SFTP 连接标识符（已在 TerminalTab 初始化时建立）
 * @param taskId 任务 ID（用于 Store 更新）
 */
async function deleteSingleItem(
  node: TransferNode, 
  sftpConnectionId: string,
  taskId: string
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  console.log(`[delete] 开始删除: ${node.name}`)
  console.log(`[delete] 远程路径: ${node.remotePath}`)
  
  if (!sftpConnectionId) {
    throw new Error('SFTP 连接标识符不能为空（连接未建立）')
  }
  
  // 更新节点状态为删除中
  sftpTransferStore.updateNodeStatus(taskId, node.id, {
    status: 'transferring',
    progress: 50, // 删除是原子操作，显示中间进度
    startTime: Date.now()
  })
  
  const startTime = Date.now()
  
  // 监听删除进度（实时更新节点状态）
  const cleanupProgress = window.api.sftp.onDeleteProgress((data) => {
    // 匹配当前正在删除的文件（通过远程路径）
    if (node.remotePath && (data.currentPath === node.remotePath || (data.currentPath && data.currentPath.includes(node.remotePath)))) {
      // 计算已用时间
      let elapsed = ''
      if (node.startTime) {
        elapsed = formatTime(Math.round((Date.now() - node.startTime) / 1000))
      }
      
      // 实时更新视图（通过 Store API，利用 Pinia reactive 特性）
      sftpTransferStore.updateNodeStatus(taskId, node.id, {
        progress: 50, // 删除是原子操作，显示中间进度表示正在删除
        speed: 0,    // 删除操作不显示速度
        remaining: '',
        elapsed
      })
    }
  })
  
  try {
    // 验证路径存在
    if (!node.remotePath) {
      throw new Error('远程路径为空')
    }
    
    // 执行删除操作（使用已建立的 sftpConnectionId，通过 Electron API）
    const result = await window.api.sftp.delete(sftpConnectionId, node.remotePath)
    
    if (!result.success) {
      throw new Error(result.error || '删除失败')
    }
    
    // 删除完成 - 更新最终状态
    const endTime = Date.now()
    const elapsedSeconds = Math.round((endTime - startTime) / 1000)
    
    sftpTransferStore.updateNodeStatus(taskId, node.id, {
      status: 'completed',
      progress: 100,
      elapsed: formatTime(elapsedSeconds),
      speed: 0, // 删除操作不显示速度
      remaining: ''
    })
    
    console.log(`[delete] ✅ 删除完成: ${node.name}`)
    
  } catch (error: any) {
    console.error(`[delete] ❌ 删除失败: ${node.name}`, error)
    
    // 更新错误状态
    sftpTransferStore.updateNodeStatus(taskId, node.id, {
      status: 'error',
      error: error.message || '删除失败'
    })
    
    throw error
  } finally {
    // 清理进度监听（无论成功或失败都要清理，防止内存泄漏）
    cleanupProgress()
  }
}

/**
 * 递归删除文件夹内容（安全架构 v4）
 * 
 * 设计原则：
 * - 不再依赖 session 对象
 * - 直接使用 sftpConnectionId 调用 SFTP API
 * - 递归处理文件夹结构，更新节点进度
 * 
 * @param node 当前节点（文件夹或文件）
 * @param sftpConnectionId SFTP 连接标识符（已在 TerminalTab 初始化时建立）
 * @param taskId 任务 ID（用于 Store 更新）
 */
async function deleteFolderContent(
  node: TransferNode, 
  sftpConnectionId: string,
  taskId: string
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  if (!sftpConnectionId) return
  
  if (node.isDirectory && node.children && node.children.length > 0) {
    // 检查任务状态：如果当前是 pending，则更新为 transferring
    const currentTask = sftpTransferStore.getTask(taskId)
    if (currentTask && currentTask.status === 'pending') {
      sftpTransferStore.updateTaskStatus(taskId, 'transferring')
      console.log('[delete] 任务状态从 pending 转换为 transferring（文件夹删除开始）')
    }
    
    // 通过 Store 更新状态为删除中（利用 Pinia reactive 特性）
    sftpTransferStore.updateNodeStatus(taskId, node.id, {
      status: 'transferring',
      startTime: Date.now()
    })
    
    // 先删除所有子文件/子文件夹（从叶子节点开始，传递 sftpConnectionId）
    for (const child of node.children) {
      await deleteFolderContent(child, sftpConnectionId, taskId)
      
      // 计算父节点的完成统计
      let completedItems = 0
      let progress = 0
      
      if (node.children && node.children.length > 0) {
        completedItems = node.children.filter(c => c.status === 'completed' || c.status === 'error').length
        progress = Math.round((completedItems / node.children.length) * 100)
      }
      
      // 每完成一个子项就更新父节点状态（通过 Store API）
      sftpTransferStore.updateNodeStatus(taskId, node.id, {
        completedFiles: completedItems,
        progress
      })
    }
    
    // 所有子项删除完成 - 最后删除父文件夹本身（传递 sftpConnectionId）
    await deleteSingleItem(node, sftpConnectionId, taskId)
    
  } else if (node.isDirectory) {
    // 空目录或无子节点信息的目录 - 直接删除目录本身（传递 sftpConnectionId）
    console.log(`[delete] 检测到空目录/叶子目录，直接删除: ${node.name}`)
    await deleteSingleItem(node, sftpConnectionId, taskId)
    
  } else if (!node.isDirectory) {
    // 如果是文件，执行删除（传递 sftpConnectionId）
    await deleteSingleItem(node, sftpConnectionId, taskId)
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
 * 删除单个文件/文件夹（导出函数，安全架构 v4）
 * 
 * 设计原则：
 * - 不再接收 session 对象（避免在渲染进程传递敏感信息）
 * - 直接使用 sftpConnectionId（SFTP 连接已在 TerminalTab 初始化时建立）
 * - 可选接收 sessionId（用于通过 SessionStore 获取会话名称等非敏感信息显示）
 * 
 * @param remotePath - 远程文件/文件夹路径
 * @param sftpConnectionId - SFTP 连接标识符（必填，对应已建立的连接）
 * @param sessionId - 会话 ID（可选，用于 UI 显示会话信息）
 */
export async function deleteFileOrFolder(
  remotePath: string,
  sftpConnectionId: string,
  sessionId?: string
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  console.log('[delete] 开始删除:', remotePath, '连接ID:', sftpConnectionId)
  
  if (!sftpConnectionId) {
    throw new Error('SFTP 连接标识符不能为空（连接未建立）')
  }
  
  if (!remotePath) {
    throw new Error('远程路径不能为空')
  }
  
  try {
    // 获取文件名/文件夹名
    const itemName = remotePath.split('/').pop() || 'item'
    
    // 判断是文件还是文件夹（通过查询远程路径类型，使用已建立的 sftpConnectionId）
    const listResult = await window.api.sftp.listDir(
      sftpConnectionId, 
      remotePath.includes('/') ? remotePath.substring(0, remotePath.lastIndexOf('/')) : '/'
    )
    
    const selectedItem = listResult.success && listResult.data ? listResult.data.find(
      (item: any) => item.path === remotePath || item.name === itemName
    ) : null
    
    let rootNode: TransferNode
    
    if (selectedItem && (selectedItem.type === 'd' || selectedItem.isDirectory)) {
      // 文件夹：扫描子项构建树形结构（使用 sftpConnectionId）
      console.log('[delete] 检测到文件夹，使用文件夹删除模式')
      const scanResult = await scanRemoteFolderForDelete(remotePath, sftpConnectionId)
      rootNode = scanResult.rootNode
      
      console.log(`[delete] 文件夹扫描完成: ${scanResult.totalFiles} 个文件`)
    } else {
      // 单文件：直接创建单节点
      console.log('[delete] 检测到文件，使用单文件删除模式')
      
      rootNode = {
        id: `node-${Date.now()}`,
        name: itemName,
        isDirectory: false,
        type: 'delete',
        status: 'pending',
        progress: 0,
        size: 0, // 删除操作不需要精确的文件大小
        localPath: '',
        remotePath: remotePath,
        speed: 0,
        remaining: '',
        elapsed: ''
      }
    }
    
    // 创建删除任务（安全架构 v4：直接使用 sftpConnectionId）
    const task: TransferTask = {
      id: `task-delete-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'delete',
      status: 'pending',
      root: rootNode,
      sftpConnectionId: sftpConnectionId,  // ✅ 直接使用传入的连接标识符
      sessionId: sessionId,                // ✅ 可选：用于显示会话信息
      totalBytes: rootNode.size || 0,
      transferredBytes: 0,
      createdAt: Date.now(),
      remainingTime: 0,
      elapsedTime: 0
    }
    
    // 添加任务到 Store（自动触发 UI 更新）
    sftpTransferStore.addTask(task)
    console.log(`[delete] ✅ 删除任务已创建: ${task.id}`)
    
    // 开始执行删除（传递 sftpConnectionId）
    await deleteFolderContent(rootNode, sftpConnectionId, task.id)
    
    // 标记任务完成
    const completedAt = Date.now()
    const elapsedTime = Math.round((completedAt - task.createdAt) / 1000)
    
    sftpTransferStore.updateTask(task.id, {
      status: 'completed' as any,
      completedAt,
      elapsedTime,
      transferredBytes: task.totalBytes
    })
    
    console.log('[delete] ✅ 删除完成！')
    
  } catch (error: any) {
    console.error('[delete] ❌ 删除失败:', error)
    throw error
  }
}
