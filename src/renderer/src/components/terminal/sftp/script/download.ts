/**
 * SFTP 下载功能模块（安全架构 v4）
 * 支持单文件、文件夹、批量下载
 * 使用统一的树形组件显示下载进度
 * 
 * 设计原则：
 * - 不再依赖 session 对象
 * - 直接使用 sftpConnectionId（SFTP 连接已在 TerminalTab 初始化时建立）
 * @module sftp/download
 */

import type { TransferTask, TransferNode } from '@shared/types/sftp'
import { useSftpTransferStore } from '@/stores/sftpTransfer'
import { formatTime, formatSize, createTransferNode, createTransferTask } from './utils'

/**
 * 递归扫描远程文件夹并构建传输节点树
 * @param remotePath 远程文件夹路径
 * @param localBasePath 本地基础路径（当前本地目录）
 * @param sftpConnectionId SFTP 连接标识符（已在 TerminalTab 初始化时建立）
 * @returns 根节点和文件统计信息
 */
async function scanRemoteFolderRecursive(
  remotePath: string,
  localBasePath: string,
  sftpConnectionId: string
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
            sftpConnectionId
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
        const fileNode = createTransferNode({
          name: entry.name,
          isDirectory: false,
          type: 'download',
          localPath: fullLocalPath,
          remotePath: fullRemotePath,
          size: entry.size || 0
        })
        
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
 * @param node - 文件传输节点
 * @param sftpConnectionId - SFTP 连接标识符（已在 TerminalTab 初始化时建立）
 * @param taskId - 任务 ID（用于 Store 更新）
 */
async function downloadSingleFile(
  node: TransferNode, 
  sftpConnectionId: string,
  taskId: string
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  console.log(`[download] 开始下载文件: ${node.name}`)
  console.log(`[download] 远程路径: ${node.remotePath}`)
  console.log(`[download] 本地路径: ${node.localPath}`)
  
  if (!sftpConnectionId) {
    throw new Error('SFTP 连接标识符不能为空（连接未建立）')
  }
  
  // 检查任务状态：如果当前是 pending，则更新为 transferring
  // 只有当第一个文件节点真正开始传输时，才改变任务状态
  const currentTask = sftpTransferStore.getTask(taskId)
  if (currentTask && currentTask.status === 'pending') {
    sftpTransferStore.updateTaskStatus(taskId, 'transferring')
    console.log('[download] 任务状态从 pending 转换为 transferring（首个文件开始下载）')
  }
  
  // 更新节点状态为传输中
  sftpTransferStore.updateNodeStatus(taskId, node.id, {
    status: 'transferring',
    progress: 0,
    startTime: Date.now()
  })
  
  const startTime = Date.now()
  
  // ✅ 直接使用传入的 sftpConnectionId（连接已在 TerminalTab 初始化时建立）
  const connectionId = sftpConnectionId
  
  try {
    // 验证路径存在
    if (!node.localPath || !node.remotePath) {
      throw new Error('本地路径或远程路径为空')
    }
    
    // 确保本地目录存在（通过 Electron API 创建目录）
    const localDir = node.localPath.substring(0, node.localPath.lastIndexOf('/')) || 
                     node.localPath.substring(0, node.localPath.lastIndexOf('\\'))
    
    if (localDir) {
      // 使用 SFTP API 确保本地目录存在（递归创建）
      try {
        const result = await window.api.sftp.ensureDir(localDir)
        if (!result.success) {
          console.warn(`[download] 创建本地目录失败（可能已存在）: ${localDir}`, result.error)
        }
      } catch (dirError: any) {
        console.warn(`[download] 创建本地目录异常: ${localDir}`, dirError)
      }
    }
    
    // 监听下载进度（实时更新节点状态）
    const cleanupProgress = window.api.sftp.onDownloadProgress((data) => {
      // 匹配当前正在下载的文件（通过远程路径和本地路径）
      if (data.remotePath === node.remotePath && data.localPath === node.localPath) {
        // 计算进度信息
        const progress = Math.round((data.transferredSize / data.size) * 100)
        const speed = data.speed
        
        // 计算剩余时间
        let remaining = ''
        if (speed > 0) {
          const remainingBytes = data.size - data.transferredSize
          remaining = formatTime(Math.ceil(remainingBytes / speed))
        }
        
        // 计算已用时间
        let elapsed = ''
        if (node.startTime) {
          elapsed = formatTime(Math.round((Date.now() - node.startTime) / 1000))
        }
        
        // 实时更新视图（通过 Store API，利用 Pinia reactive 特性）
        sftpTransferStore.updateNodeStatus(taskId, node.id, {
          progress,
          size: data.size,
          speed,
          remaining,
          elapsed
        })
      }
    })
    
    // 执行下载操作（使用已建立的 sftpConnectionId，带进度回调）
    const result = await window.api.sftp.download(connectionId, node.remotePath, node.localPath)
    
    // 清理进度监听
    cleanupProgress()
    
    if (!result.success) {
      throw new Error(result.error || '下载失败')
    }
    
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
/**
 * 递归下载文件夹内容（安全架构 v4）
 * 
 * 设计原则：
 * - 不再依赖 session 对象
 * - 直接使用 sftpConnectionId 调用 SFTP API
 * - 递归处理文件夹结构，更新节点进度
 * 
 * @param node - 当前传输节点（文件或文件夹）
 * @param sftpConnectionId - SFTP 连接标识符（已在 TerminalTab 初始化时建立）
 * @param taskId - 任务 ID（用于 Store 状态更新）
 */
async function downloadFolderContent(
  node: TransferNode, 
  sftpConnectionId: string,
  taskId: string
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  if (!sftpConnectionId) return
  
  if (node.isDirectory && node.children && node.children.length > 0) {
    // 如果是文件夹，先在本地创建目录
    if (node.localPath) {
      try {
        // 使用 SFTP API 确保本地目录存在（递归创建）
        const result = await window.api.sftp.ensureDir(node.localPath)
        if (!result.success) {
          console.warn(`[download] 创建本地目录失败（可能已存在）: ${node.localPath}`, result.error)
        } else {
          console.log(`[download] 创建本地目录: ${node.localPath}`)
        }
      } catch (error: any) {
        console.warn(`[download] 创建本地目录异常: ${node.localPath}`, error)
      }
    }
    
    // 检查任务状态：如果当前是 pending，则更新为 transferring
    const currentTask = sftpTransferStore.getTask(taskId)
    if (currentTask && currentTask.status === 'pending') {
      sftpTransferStore.updateTaskStatus(taskId, 'transferring')
      console.log('[download] 任务状态从 pending 转换为 transferring（文件夹下载开始）')
    }
    
    // 通过 Store 更新状态为传输中（利用 Pinia reactive 特性）
    sftpTransferStore.updateNodeStatus(taskId, node.id, {
      status: 'transferring',
      startTime: Date.now()
    })
    
    // 递归下载所有子节点（传递 sftpConnectionId）
    for (const child of node.children) {
      await downloadFolderContent(child, sftpConnectionId, taskId)
      
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
    
  } else if (node.isDirectory) {
    // ✅ 空文件夹处理：直接创建本地目录并标记完成
    console.log(`[download] 检测到空文件夹，创建本地目录: ${node.name}`)
    
    // 更新节点状态为传输中
    sftpTransferStore.updateNodeStatus(taskId, node.id, {
      status: 'transferring',
      startTime: Date.now()
    })
    
    try {
      // 在本地创建空目录（使用已建立的 sftpConnectionId）
      if (node.localPath) {
        const result = await window.api.sftp.ensureDir(node.localPath)
        if (!result.success) {
          throw new Error(result.error || '创建本地目录失败')
        }
        console.log(`[download] ✅ 空文件夹已创建: ${node.localPath}`)
      }
      
      // 更新节点状态为已完成
      const endTime = Date.now()
      const elapsedSeconds = Math.round((endTime - (node.startTime || endTime)) / 1000)
      
      sftpTransferStore.updateNodeStatus(taskId, node.id, {
        status: 'completed',
        progress: 100,
        elapsed: formatTime(elapsedSeconds)
      })
      
    } catch (error: any) {
      console.error(`[download] ❌ 空文件夹创建失败: ${node.name}`, error)
      
      // 更新错误状态
      sftpTransferStore.updateNodeStatus(taskId, node.id, {
        status: 'error',
        error: error.message || '空文件夹创建失败'
      })
      
      throw error
    }
    
  } else if (!node.isDirectory) {
    // 如果是文件，执行下载（传递 sftpConnectionId）
    await downloadSingleFile(node, sftpConnectionId, taskId)
  }
}

/**
 * 下载单个文件（导出函数，安全架构 v4）
 * 
 * 设计原则：
 * - 不再接收 session 对象（避免在渲染进程传递敏感信息）
 * - 直接使用 sftpConnectionId（SFTP 连接已在 TerminalTab 初始化时建立）
 * - 可选接收 sessionId（用于通过 SessionStore 获取会话名称等非敏感信息显示）
 * 
 * @param remotePath - 远程文件路径
 * @param sftpConnectionId - SFTP 连接标识符（必填，对应已建立的连接）
 * @param sessionId - 会话 ID（可选，用于 UI 显示会话信息）
 * @param localPath - 本地目标路径（可以是字符串或 Ref<string>）
 */
export async function downloadFile(
  remotePath: string,
  sftpConnectionId: string,
  sessionId?: string,
  localPath?: string | { value: string }
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  console.log('[download] 开始下载文件:', remotePath, '连接ID:', sftpConnectionId)
  
  if (!sftpConnectionId) {
    throw new Error('SFTP 连接标识符不能为空（连接未建立）')
  }
  
  if (!remotePath) {
    throw new Error('远程文件路径不能为空')
  }
  
  try {
    // 获取文件名和本地基础路径（localPath 现在是可选参数，需要提供默认值）
    const fileName = remotePath.split('/').pop() || 'file'
    const localBasePath = typeof localPath === 'string' 
      ? localPath 
      : (localPath?.value || '')
    
    // 创建文件节点（type 为 'download'）
    const fileNode = createTransferNode({
      name: fileName,
      isDirectory: false,
      type: 'download',
      localPath: `${localBasePath}/${fileName}`,
      remotePath: remotePath
    })
    
    // 创建传输任务并添加到 Store（安全架构 v4：直接使用 sftpConnectionId）
    const task = createTransferTask({
      type: 'download',
      root: fileNode,
      sftpConnectionId: sftpConnectionId,
      sessionId: sessionId
    })
    
    // 添加到 Store（返回 reactive 对象）
    sftpTransferStore.addTask(task)
    
    // 开始下载（传递 taskId 和 sftpConnectionId 以确保响应式更新）
    console.log('[download] 正在下载文件...')
    
    // 注意：任务状态会在 downloadSingleFile 中当首个文件节点开始传输时自动从 pending 转换为 transferring
    
    await downloadSingleFile(fileNode, sftpConnectionId, task.id)
    
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
 * 下载文件夹主函数（安全架构 v4）
 * 
 * 设计原则：
 * - 不再接收 session 对象
 * - 直接使用 sftpConnectionId（SFTP 连接已在 TerminalTab 初始化时建立）
 * - 可选接收 sessionId（用于 UI 显示会话信息）
 * 
 * @param remotePath - 远程文件夹路径
 * @param sftpConnectionId - SFTP 连接标识符（必填，对应已建立的连接）
 * @param sessionId - 会话 ID（可选，用于 UI 显示会话信息）
 * @param localPath - 本地目标路径（可以是字符串或 Ref<string>）
 */
export async function downloadFolder(
  remotePath: string,
  sftpConnectionId: string,
  sessionId?: string,
  localPath?: string | { value: string }
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  console.log('[download] 开始下载文件夹:', remotePath, '连接ID:', sftpConnectionId)
  
  if (!sftpConnectionId) {
    throw new Error('SFTP 连接标识符不能为空（连接未建立）')
  }
  
  if (!remotePath) {
    throw new Error('远程文件夹路径不能为空')
  }
  
  try {
    // 获取文件夹名和本地基础路径（localPath 现在是可选参数）
    const folderName = remotePath.split('/').pop() || 'folder'
    const localBasePath = typeof localPath === 'string' 
      ? localPath 
      : (localPath?.value || '')
    
    console.log(`[download] 文件夹名: ${folderName}`)
    console.log(`[download] 本地目标路径: ${localBasePath}`)
    
    // 递归扫描远程文件夹结构（使用已建立的 sftpConnectionId）
    console.log('[download] 正在扫描远程文件夹结构...')
    const scanResult = await scanRemoteFolderRecursive(remotePath, localBasePath, sftpConnectionId)
    
    console.log(`[download] 扫描完成：${scanResult.totalFiles} 个文件，总计 ${(scanResult.totalBytes / 1024 / 1024).toFixed(2)} MB`)
    
    // 创建传输任务（安全架构 v4：直接使用 sftpConnectionId）
    const task = createTransferTask({
      type: 'download',
      root: scanResult.rootNode,
      sftpConnectionId: sftpConnectionId,
      sessionId: sessionId,
      totalBytes: scanResult.totalBytes
    })
    
    // 添加到 Store
    sftpTransferStore.addTask(task)
    
    // 开始递归下载文件夹内容（传递 sftpConnectionId）
    console.log('[download] 开始下载文件夹内容...')
    
    await downloadFolderContent(scanResult.rootNode, sftpConnectionId, task.id)
    
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

/**
 * 批量下载主函数（支持混合选择文件和文件夹）
 * 
 * ✅ 新架构：每个选中的文件/文件夹创建独立的 TransferTask
 * - 选择 N 个项目 → 创建 N 个 TransferTask
 * - 每个任务独立管理进度、状态、取消操作
 * - 符合用户期望的"多任务"模式（与 uploadBatch 对称）
 */
export async function downloadBatch(
  paths: string[],
  sftpConnectionId: string,
  sessionId?: string,
  localPath?: string | { value: string }
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  console.log('[download] 开始批量下载:', paths.length, '个文件/文件夹')
  console.log('[download] 连接ID:', sftpConnectionId)
  
  if (!sftpConnectionId) {
    throw new Error('SFTP 连接标识符不能为空（连接未建立）')
  }
  
  if (!paths || paths.length === 0) {
    throw new Error('下载路径列表不能为空')
  }

  try {
    const localBasePath = typeof localPath === 'string' 
      ? localPath 
      : (localPath?.value || '')
    
    console.log('[download] 本地目标路径:', localBasePath)
    
    const createdTasks: TransferTask[] = []
    
    for (const remoteFilePath of paths) {
      try {
        const fileName = remoteFilePath.split('/').pop() || 'file'
        
        let taskRootNode: TransferNode
        let taskTotalBytes = 0
        
        const listResult = await window.api.sftp.listDir(sftpConnectionId, remoteFilePath.replace(/\/[^/]+$/, '/') || '/')
        
        if (listResult.success && listResult.data) {
          const entry = listResult.data.find((item: any) => item.name === fileName)
          
          if (entry && (entry.type === 'd' || entry.isDirectory)) {
            console.log(`[download] 扫描远程文件夹: ${remoteFilePath}`)
            const folderResult = await scanRemoteFolderRecursive(remoteFilePath, localBasePath, sftpConnectionId)
            
            taskRootNode = folderResult.rootNode
            taskTotalBytes = folderResult.totalBytes
            
            console.log(`[download] 远程文件夹扫描完成: ${folderResult.totalFiles} 个文件, ${formatSize(taskTotalBytes)}`)
          } else {
            const fileSize = entry?.size || 0
            
            taskRootNode = {
              id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: fileName,
              isDirectory: false,
              type: 'download',
              status: 'pending',
              progress: 0,
              size: fileSize,
              localPath: `${localBasePath}/${fileName}`,
              remotePath: remoteFilePath,
              speed: 0,
              remaining: '',
              elapsed: ''
            }
            
            taskTotalBytes = fileSize
          }
        } else {
          const fileNode: TransferNode = {
            id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: fileName,
            isDirectory: false,
            type: 'download',
            status: 'pending',
            progress: 0,
            size: 0,
            localPath: `${localBasePath}/${fileName}`,
            remotePath: remoteFilePath,
            speed: 0,
            remaining: '',
            elapsed: ''
          }
          
          taskRootNode = fileNode
          taskTotalBytes = 0
        }
        
        const task = createTransferTask({
          type: 'download',
          root: taskRootNode,
          sftpConnectionId: sftpConnectionId,
          sessionId: sessionId,
          totalBytes: taskTotalBytes
        })
        
        sftpTransferStore.addTask(task)
        createdTasks.push(task)
        
        console.log(`[download] ✅ 已创建下载任务 #${createdTasks.length}: ${taskRootNode.name} (${formatSize(taskTotalBytes)})`)
        
      } catch (error: any) {
        console.error(`[download] 处理远程路径失败: ${remoteFilePath}`, error)
      }
    }
    
    console.log(`[download] 📊 共创建 ${createdTasks.length} 个下载任务`)
    
    for (let i = 0; i < createdTasks.length; i++) {
      const task = createdTasks[i]
      
      console.log(`[download] 开始下载任务 ${i + 1}/${createdTasks.length}: ${task.root.name}`)
      
      sftpTransferStore.updateTaskRoot(task.id, {
        startTime: Date.now()
      })
      
      try {
        await downloadFolderContent(task.root, sftpConnectionId, task.id)
        
        task.status = 'completed'
        task.completedAt = Date.now()
        task.elapsedTime = Math.round((task.completedAt - task.createdAt) / 1000)
        task.transferredBytes = task.totalBytes
        
        sftpTransferStore.updateTaskStatus(task.id, 'completed')
        
        console.log(`[download] ✅ 任务 ${i + 1} 完成: ${task.root.name}`)
        
      } catch (error: any) {
        console.error(`[download] ❌ 任务 ${i + 1} 失败: ${task.root.name}`, error)
        
        task.status = 'error'
        sftpTransferStore.updateTaskStatus(task.id, 'error')
      }
    }
    
    const successCount = createdTasks.filter(t => t.status === 'completed').length
    const failCount = createdTasks.filter(t => t.status === 'error').length
    
    console.log(`[download] 🎉 批量下载完成！成功: ${successCount}, 失败: ${failCount}, 总计: ${createdTasks.length}`)
    
  } catch (error: any) {
    console.error('[download] ❌ 批量下载失败:', error)
    throw error
  }
}
