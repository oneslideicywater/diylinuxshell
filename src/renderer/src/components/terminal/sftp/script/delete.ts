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
import { formatTime, createTransferNode, createTransferTask } from './utils'

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
export async function scanRemoteFolderForDelete(
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
export async function deleteFolderContent(
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
 * 批量删除本地文件/文件夹（支持混合选择）
 * 
 * ✅ 新架构：每个选中的文件/文件夹创建独立的 TransferTask
 * - 选择 N 个项目 → 创建 N 个 TransferTask
 * - 每个任务独立管理进度、状态、取消操作
 * - 符合用户期望的"多任务"模式（与 uploadBatch/downloadBatch 对称）
 * 
 * @param paths - 本地文件/文件夹路径数组
 * @param sftpConnectionId - SFTP 连接标识符（用于任务隔离）
 */
export async function deleteLocalBatch(
  paths: string[],
  sftpConnectionId: string
): Promise<{ success: number; failed: number }> {
  const sftpTransferStore = useSftpTransferStore()
  
  console.log('[delete-local] 开始批量删除:', paths.length, '个文件/文件夹')
  
  const createdTasks: TransferTask[] = []
  
  for (const filePath of paths) {
    try {
      const fileName = filePath.split(/[/\\]/).pop() || filePath
      
      let isDirectory = false
      
      try {
        const stat = await window.api.sftp.statLocal(filePath)
        isDirectory = stat.success && stat.data?.isDirectory
      } catch (statError: any) {
        console.warn(`[delete-local] 无法判断路径类型: ${filePath}`, statError.message)
      }
      
      const startTime = Date.now()
      
      const node = createTransferNode({
        name: fileName,
        isDirectory: isDirectory,
        type: 'delete',
        localPath: filePath
      })
      
      node.startTime = startTime
      
      const task = createTransferTask({
        type: 'delete',
        root: node,
        sftpConnectionId: sftpConnectionId
      })
      
      sftpTransferStore.addTask(task)
      createdTasks.push(task)
      
      console.log(`[delete-local] ✅ 已创建删除任务 #${createdTasks.length}: ${fileName}`)
      
    } catch (error: any) {
      console.error(`[delete-local] 处理本地路径失败: ${filePath}`, error)
    }
  }
  
  console.log(`[delete-local] 📊 共创建 ${createdTasks.length} 个本地删除任务`)
  
  for (let i = 0; i < createdTasks.length; i++) {
    const task = createdTasks[i]
    
    console.log(`[delete-local] 开始删除任务 ${i + 1}/${createdTasks.length}: ${task.root.name}`)
    
    sftpTransferStore.updateTaskRoot(task.id, {
      startTime: Date.now()
    })
    
    try {
      sftpTransferStore.updateTaskStatus(task.id, 'transferring')
      sftpTransferStore.updateNodeStatus(task.id, task.root.id, {
        status: 'transferring',
        startTime: Date.now()
      })
      
      const result = await window.api.sftp.deleteLocalFile(task.root.localPath)
      
      if (!result.success) {
        throw new Error(result.error || '删除失败')
      }
      
      sftpTransferStore.updateNodeStatus(task.id, task.root.id, {
        status: 'completed',
        progress: 100
      })
      
      task.status = 'completed'
      sftpTransferStore.updateTaskStatus(task.id, 'completed')
      
      console.log(`[delete-local] ✅ 任务 ${i + 1} 完成: ${task.root.name}`)
      
    } catch (error: any) {
      console.error(`[delete-local] ❌ 任务 ${i + 1} 失败: ${task.root.name}`, error)
      
      task.status = 'error'
      sftpTransferStore.updateTaskStatus(task.id, 'error')
    }
  }

  const successCount = createdTasks.filter(t => t.status === 'completed').length
  const failCount = createdTasks.filter(t => t.status === 'error').length
  
  console.log(`[delete-local] 🎉 批量本地文件删除完成！成功: ${successCount}, 失败: ${failCount}, 总计: ${createdTasks.length}`)
  
  return { success: successCount, failed: failCount }
}

/**
 * 批量删除远程文件/文件夹（支持混合选择）
 * 
 * ✅ 新架构：每个选中的文件/文件夹创建独立的 TransferTask
 * - 选择 N 个项目 → 创建 N 个 TransferTask
 * - 每个任务独立管理进度、状态、取消操作
 * - 符合用户期望的"多任务"模式（与 uploadBatch/downloadBatch 对称）
 * 
 * @param paths - 远程文件/文件夹路径数组
 * @param sftpConnectionId - SFTP 连接标识符（必填）
 * @param sessionId - 会话 ID（可选，用于 UI 显示）
 */
export async function deleteRemoteBatch(
  paths: string[],
  sftpConnectionId: string,
  sessionId?: string
): Promise<{ success: number; failed: number }> {
  const sftpTransferStore = useSftpTransferStore()
  
  console.log('[delete-remote] 开始批量删除:', paths.length, '个文件/文件夹')
  console.log('[delete-remote] 连接ID:', sftpConnectionId)
  
  const createdTasks: TransferTask[] = []
  
  for (const remotePath of paths) {
    try {
      const itemName = remotePath.split('/').pop() || 'item'
      
      let taskRootNode: TransferNode
      
      // 判断是文件还是文件夹（通过查询远程路径类型）
      const listResult = await window.api.sftp.listDir(
        sftpConnectionId, 
        remotePath.includes('/') ? remotePath.substring(0, remotePath.lastIndexOf('/')) : '/'
      )
      
      const selectedItem = listResult.success && listResult.data ? listResult.data.find(
        (item: any) => item.path === remotePath || item.name === itemName
      ) : null
      
      if (selectedItem && (selectedItem.type === 'd' || selectedItem.isDirectory)) {
        // 文件夹：扫描子项构建树形结构
        console.log(`[delete-remote] 扫描远程文件夹: ${remotePath}`)
        
        const folderResult = await scanRemoteFolderForDelete(remotePath, sftpConnectionId)
        taskRootNode = folderResult.rootNode
        
        console.log(`[delete-remote] 远程文件夹扫描完成: ${folderResult.totalFiles} 个文件`)
      } else {
        // 单文件：直接创建单节点
        taskRootNode = createTransferNode({
          name: itemName,
          isDirectory: false,
          type: 'delete',
          remotePath: remotePath
        })
      }
      
      const task = createTransferTask({
        type: 'delete',
        root: taskRootNode,
        sftpConnectionId: sftpConnectionId,
        sessionId: sessionId,
        totalBytes: taskRootNode.size || 0
      })
      
      sftpTransferStore.addTask(task)
      createdTasks.push(task)
      
      console.log(`[delete-remote] ✅ 已创建删除任务 #${createdTasks.length}: ${taskRootNode.name}`)
      
    } catch (error: any) {
      console.error(`[delete-remote] 处理远程路径失败: ${remotePath}`, error)
    }
  }
  
  console.log(`[delete-remote] 📊 共创建 ${createdTasks.length} 个远程删除任务`)
  
  for (let i = 0; i < createdTasks.length; i++) {
    const task = createdTasks[i]
    
    console.log(`[delete-remote] 开始删除任务 ${i + 1}/${createdTasks.length}: ${task.root.name}`)
    
    sftpTransferStore.updateTaskRoot(task.id, {
      startTime: Date.now()
    })
    
    try {
      await deleteFolderContent(task.root, sftpConnectionId, task.id)
      
      const completedAt = Date.now()
      const elapsedTime = Math.round((completedAt - task.createdAt) / 1000)
      
      task.status = 'completed'
      task.completedAt = completedAt
      task.elapsedTime = elapsedTime
      task.transferredBytes = task.totalBytes
      
      sftpTransferStore.updateTask(task.id, {
        status: 'completed',
        completedAt,
        elapsedTime,
        transferredBytes: task.totalBytes
      })
      
      console.log(`[delete-remote] ✅ 任务 ${i + 1} 完成: ${task.root.name}`)
      
    } catch (error: any) {
      console.error(`[delete-remote] ❌ 任务 ${i + 1} 失败: ${task.root.name}`, error)
      
      task.status = 'error'
      sftpTransferStore.updateTaskStatus(task.id, 'error')
    }
  }

  const successCount = createdTasks.filter(t => t.status === 'completed').length
  const failCount = createdTasks.filter(t => t.status === 'error').length
  
  console.log(`[delete-remote] 🎉 批量远程文件删除完成！成功: ${successCount}, 失败: ${failCount}, 总计: ${createdTasks.length}`)
  
  return { success: successCount, failed: failCount }
}
