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
import { formatSize, createTransferTask, isTaskCancelled } from './utils'

/**
 * 递归扫描远程文件夹并构建传输节点树
 * @param remotePath 远程文件夹路径
 * @param localBasePath 本地基础路径（当前本地目录）
 * @param sftpConnectionId SFTP 连接标识符（已在 TerminalTab 初始化时建立）
 * @returns 根节点和文件统计信息
 */
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
  
  // ✅ 检查任务是否已被取消（真正的取消机制）
  if (isTaskCancelled(taskId, `跳过下载: ${node.name}`)) {
    return
  }
  
  // 检查任务状态：如果当前是 pending 或 scanning，则更新为 transferring
  // 只有当第一个文件节点真正开始传输时，才改变任务状态
  const currentTask = sftpTransferStore.getTask(taskId)
  if (currentTask && (currentTask.status === 'pending' || currentTask.status === 'scanning')) {
    sftpTransferStore.updateTaskStatus(taskId, 'transferring')
    console.log(`[download] 任务状态从 ${currentTask.status} 转换为 transferring（首个文件开始下载）`)
  }
  
  // 更新节点状态为传输中
  sftpTransferStore.mutateNode(taskId, node.id, {
    status: 'transferring',
    progress: 0,
    startTime: Date.now()
  })

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
    
    // 监听下载进度（500ms 定时器已控制 UI 刷新频率，无需节流）
    let lastSpeed = 0
    const cleanupProgress = window.api.sftp.onDownloadProgress((data) => {
      if (isTaskCancelled(taskId)) { return }

      if (data.nodeId === node.id) {
        const progress = node.size > 0 ? Math.round((data.transferredBytes / node.size) * 100) : 0
        const speed = data.speed
        lastSpeed = speed

        console.log(`[download] 进度回调: ${node.name} | progress=${progress}% speed=${formatSize(speed)}/s`)

        // 首次收到进度回调时初始化 startTime（文件和目录统一）
        const liveNode = sftpTransferStore.getNode(taskId, node.id)
        const updates: Partial<TransferNode> = { progress, speed, transferredBytes: data.transferredBytes }
        if (liveNode && !liveNode.startTime) {
          updates.startTime = Date.now()
        }

        sftpTransferStore.mutateNode(taskId, node.id, updates)

        // 标记当前活跃传输节点（用于 UI 高亮定位）
        sftpTransferStore.updateTask(taskId, { activeNodeId: node.id })
      }
    })
    
    // 执行下载操作（使用已建立的 sftpConnectionId，带进度回调）
    const result = await window.api.sftp.download(connectionId, taskId, node)
    
    // 清理进度监听
    cleanupProgress()
    
    // ✅ 下载完成后再次检查是否已被取消
    if (isTaskCancelled(taskId, `下载完成但任务已取消: ${node.name}`)) {
      return  // 不更新状态，保持 cancelled
    }
    
    if (!result.success) {
      throw new Error(result.error || '下载失败')
    }
    
    // 下载完成 - 更新最终状态

    sftpTransferStore.mutateNode(taskId, node.id, {
      status: 'completed',
      progress: 100,
      size: node.size || 0,
      speed: lastSpeed,
      transferredBytes: node.size || 0,
      endTime: Date.now()
    })
    
    console.log(`[download] ✅ 文件下载完成: ${node.name}`)
    
  } catch (error: any) {
    console.error(`[download] ❌ 文件下载失败: ${node.name}`, error)
    
    sftpTransferStore.mutateNode(taskId, node.id, {
      status: 'error',
      error: error.message || '下载失败',
      endTime: Date.now()
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
    // ✅ 检查任务是否已被取消（在文件夹处理开始前）
    if (isTaskCancelled(taskId, `跳过文件夹: ${node.name}`)) {
      return
    }
    
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
    
    // 检查任务状态：如果当前是 pending 或 scanning，则更新为 transferring
    const currentTask = sftpTransferStore.getTask(taskId)
    if (currentTask && (currentTask.status === 'pending' || currentTask.status === 'scanning')) {
      sftpTransferStore.updateTaskStatus(taskId, 'transferring')
      console.log(`[download] 任务状态从 ${currentTask.status} 转换为 transferring（文件夹下载开始）`)
    }
    
    sftpTransferStore.mutateNode(taskId, node.id, {
      status: 'transferring',
      startTime: Date.now()
    })
    
    // 递归下载所有子节点
    for (const child of node.children) {
      if (isTaskCancelled(taskId, `停止下载剩余子节点: ${node.name}`)) {
        break
      }
      
      await downloadFolderContent(child, sftpConnectionId, taskId)
      
    }
    
    if (isTaskCancelled(taskId, `文件夹下载完成但任务已取消: ${node.name}`)) {
      return
    }
    
    sftpTransferStore.mutateNode(taskId, node.id, {
      status: 'completed',
      progress: 100,
      endTime: Date.now()
    })

    // 完成后更新节点状态
    
    
  } else if (node.isDirectory) {
    console.log(`[download] 检测到空文件夹，创建本地目录: ${node.name}`)
    
    sftpTransferStore.mutateNode(taskId, node.id, {
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
      sftpTransferStore.mutateNode(taskId, node.id, {
        status: 'completed',
        progress: 100,
        transferredBytes: 0,
        endTime: Date.now()
      })

      // 完成后更新节点
      
    } catch (error: any) {
      console.error(`[download] ❌ 空文件夹创建失败: ${node.name}`, error)
      
      sftpTransferStore.mutateNode(taskId, node.id, {
        status: 'error',
        error: error.message || '空文件夹创建失败',
        endTime: Date.now()
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
    // 获取本地基础路径
    const localBasePath = typeof localPath === 'string' 
      ? localPath 
      : (localPath?.value || '')
    
    
    // 先创建任务（root 暂时为 undefined，扫描中显示占位信息）
    const task = createTransferTask({
      type: 'download',
      sftpConnectionId: sftpConnectionId,
      sessionId: sessionId
    })
    
    sftpTransferStore.addTask(task)
    
    // 统一使用扫描 API（支持单文件和文件夹，返回完整 TransferNode 树）
    console.log(`[download] 扫描远程路径: ${remotePath}`)
    sftpTransferStore.updateTaskStatus(task.id, 'scanning')
    const scanResult = await window.api.sftp.scanRemoteTree(sftpConnectionId, remotePath, localBasePath)
    
    if (!scanResult.success || !scanResult.root) {
      throw new Error(scanResult.error || '扫描失败')
    }
    
    // 直接使用 IPC 返回的节点作为根节点
    const ipcRoot = scanResult.root as TransferNode
    task.root = ipcRoot
    task.totalBytes = scanResult.totalBytes || 0
    
    // 建立索引
    sftpTransferStore.initNodeIndex(task.id)

    // 扫描完成，任务进入传输阶段
    sftpTransferStore.updateTaskStatus(task.id, 'transferring')

    // 更新根节点状态为传输中
    sftpTransferStore.mutateNode(task.id, ipcRoot.id, {
      status: 'transferring',
      startTime: Date.now()
    })
    
    // 开始下载
    console.log('[download] 正在下载文件...')
    
    await downloadSingleFile(ipcRoot, sftpConnectionId, task.id)
    
    // 更新任务状态和统计（若已被用户取消则跳过，避免覆盖 cancelled 状态）
    if (task.status === 'cancelled') return
    
    // 使用 updateTask 更新非状态字段（completedAt/elapsedTime/totalBytes/transferredBytes）
    sftpTransferStore.updateTask(task.id, {
      completedAt: Date.now(),
      elapsedTime: Math.round((Date.now() - task.createdAt) / 1000),
      totalBytes: task.root!.size || 0,
      transferredBytes: task.root!.size || 0
    })
    
    // 使用 updateTaskStatus 更新任务状态（经过 FSM 校验 + version++ 触发 UI 刷新）
    // 注意：不要先用 task.status='completed' 直接赋值，否则 FSM 会拒绝 completed→completed
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

    const folderName = remotePath.split('/').pop() || 'folder'
    const localBasePath = typeof localPath === 'string' 
      ? localPath 
      : (localPath?.value || '')
    
    console.log(`[download] 文件夹名: ${folderName}`)
    console.log(`[download] 本地目标路径: ${localBasePath}`)
    
    console.log(`[download] 创建文件夹下载任务: ${folderName}`)

    // 构建扫描占位节点的本地路径（使用 pathJoin 屏蔽系统差异）
    const scanningLocalPath = localBasePath
      ? (await window.api.sftp.pathJoin(localBasePath, folderName)).data || ''
      : ''

    // 先创建 task（root 暂时为 undefined，扫描中显示占位信息）
    const task = createTransferTask({
      type: 'download',
      sftpConnectionId: sftpConnectionId,
      sessionId: sessionId,
      totalBytes: 0,
      scanningNode: {
        name: folderName,
        type: 'download',
        localPath: scanningLocalPath,
        remotePath: remotePath,
        status: 'pending'
      }
    })

    sftpTransferStore.addTask(task)

    console.log(`[download] ✅ 已创建下载任务（扫描中）: ${folderName}`)

    try {
      console.log('[download] 正在扫描远程文件夹结构（主进程扫描）...')
      
      // 设置任务状态为"扫描中"
      sftpTransferStore.updateTaskStatus(task.id, 'scanning')
      
      // 调用主进程扫描 API（一次性返回完整树结构）
      const dlScanResult = await window.api.sftp.scanRemoteTree(sftpConnectionId, remotePath, localBasePath)
      
      if (!dlScanResult.success || !dlScanResult.root) {
        throw new Error(dlScanResult.error || '扫描远程文件夹失败')
      }

      // 扫描完成后检查是否已被用户取消（避免取消后仍进入传输阶段）
      if (sftpTransferStore.getTask(task.id)?.status === 'cancelled') {
        console.log(`[download] 任务已被用户取消，跳过传输: ${folderName}`)
        return
      }
      
      console.log(`[download] 扫描完成：${dlScanResult.totalFiles} 个文件，总计 ${(dlScanResult.totalBytes || 0 / 1024 / 1024).toFixed(2)} MB`)
      
      // 直接使用 IPC 返回的整棵树作为根节点（parentId 链完整，无需修正）
      const ipcRoot = dlScanResult.root as TransferNode
      
      // 设置任务根节点
      task.root = ipcRoot
      task.totalBytes = dlScanResult.totalBytes || 0

      // 重建索引
      sftpTransferStore.initNodeIndex(task.id)

      // 扫描完成，任务进入传输阶段
      sftpTransferStore.updateTaskStatus(task.id, 'transferring')

      // 更新根节点状态为传输中
      sftpTransferStore.mutateNode(task.id, ipcRoot.id, {
        status: 'transferring',
        totalFiles: dlScanResult.totalFiles || 0,
        size: dlScanResult.totalBytes || 0,
        startTime: Date.now()
      })

      sftpTransferStore.updateTask(task.id, { totalBytes: dlScanResult.totalBytes || 0 })

    } catch (scanError: any) {
      console.error(`[download] 扫描远程文件夹失败: ${remotePath}`, scanError)

      sftpTransferStore.updateTaskStatus(task.id, 'error')
      throw scanError
    }
    
    // 开始递归下载文件夹内容（传递 sftpConnectionId）
    console.log('[download] 开始下载文件夹内容...')
    
    await downloadFolderContent(task.root!, sftpConnectionId, task.id)
    
    // 更新任务状态和统计（若已被用户取消则跳过）
    if (task.status === 'cancelled') return
    
    // 使用 updateTask 更新非状态字段
    sftpTransferStore.updateTask(task.id, {
      completedAt: Date.now(),
      elapsedTime: Math.round((Date.now() - task.createdAt) / 1000),
      transferredBytes: task.totalBytes
    })
    
    // 使用 updateTaskStatus 更新任务状态（经过 FSM 校验 + version++ 触发 UI 刷新）
    sftpTransferStore.updateTaskStatus(task.id, 'completed')
    
    // 更新根节点最终统计信息（节点 status 已在 downloadFolderContent 中设为 completed，此处只更新非状态字段）
    sftpTransferStore.mutateNode(task.id, task.root!.id, {
      progress: 100,
      speed: 0,
      transferredBytes: task.root!.size || 0,
      completedFiles: task.root!.totalFiles || 0,
      endTime: Date.now()
    })
    
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
        // 调用主进程接口获取文件名和父目录（使用 Node.js path 模块，屏蔽系统差异）
        const [fileNameResult, parentResult] = await Promise.all([
          window.api.sftp.basename(remoteFilePath),
          window.api.sftp.dirname(remoteFilePath)
        ])
        
        const fileName = fileNameResult.data || 'file'
        const remoteParentPath = parentResult.data || '/'
        
        // 判断是否为目录（通过 listDir 获取条目信息）
        let isDirectory = false
        
        const listResult = await window.api.sftp.listDir(sftpConnectionId, remoteParentPath)
        
        if (listResult.success && listResult.data) {
          const entry = listResult.data.find((item: any) => item.name === fileName)
          isDirectory = !!(entry && (entry.type === 'd' || entry.isDirectory))
        }
        
        if (isDirectory) {
          console.log(`[download] 创建文件夹下载任务: ${remoteFilePath}`)

          // 构建扫描占位节点的本地路径（使用 pathJoin 屏蔽系统差异，修复缺少路径分隔符的 bug）
          const scanningLocalPath = localBasePath
            ? (await window.api.sftp.pathJoin(localBasePath, fileName)).data || ''
            : ''

          // 先创建 task（root 暂时为 undefined，扫描中显示占位信息）
          const task = createTransferTask({
            type: 'download',
            sftpConnectionId: sftpConnectionId,
            sessionId: sessionId,
            totalBytes: 0,
            scanningNode: {
              name: fileName,
              type: 'download',
              localPath: scanningLocalPath,
              remotePath: remoteFilePath,
              status: 'pending'
            }
          })

          sftpTransferStore.addTask(task)
          createdTasks.push(task)

          console.log(`[download] ✅ 已创建下载任务 #${createdTasks.length}（扫描中）: ${fileName}`)

          try {
            console.log(`[download] 扫描远程文件夹（主进程扫描）: ${remoteFilePath}`)
            
            // 设置任务状态为"扫描中"
            sftpTransferStore.updateTaskStatus(task.id, 'scanning')
            
            // 调用主进程扫描 API（一次性返回完整树结构）
            const dlBatchScanResult = await window.api.sftp.scanRemoteTree(sftpConnectionId, remoteFilePath, localBasePath)
            
            if (!dlBatchScanResult.success || !dlBatchScanResult.root) {
              throw new Error(dlBatchScanResult.error || '扫描远程文件夹失败')
            }

            // 扫描完成后检查是否已被用户取消（避免取消后仍进入传输阶段）
            if (sftpTransferStore.getTask(task.id)?.status === 'cancelled') {
              console.log(`[download] 批量下载任务已被用户取消，跳过传输: ${fileName}`)
              continue
            }
            
            console.log(`[download] 远程文件夹扫描完成: ${dlBatchScanResult.totalFiles} 个文件, ${formatSize(dlBatchScanResult.totalBytes || 0)}`)
            
            // 直接使用 IPC 返回的整棵树作为根节点（parentId 链完整，无需修正）
            const ipcRoot = dlBatchScanResult.root as TransferNode
            
            // 设置任务根节点
            task.root = ipcRoot
            task.totalBytes = dlBatchScanResult.totalBytes || 0

            // 建立索引
            sftpTransferStore.initNodeIndex(task.id)

            // 扫描完成，任务进入传输阶段
            sftpTransferStore.updateTaskStatus(task.id, 'transferring')

            // 更新根节点状态为传输中
            sftpTransferStore.mutateNode(task.id, ipcRoot.id, {
              status: 'transferring',
              totalFiles: dlBatchScanResult.totalFiles || 0,
              size: dlBatchScanResult.totalBytes || 0,
              startTime: Date.now()
            })

            sftpTransferStore.updateTask(task.id, { totalBytes: dlBatchScanResult.totalBytes || 0 })

          } catch (scanError: any) {
            console.error(`[download] 扫描远程文件夹失败: ${remoteFilePath}`, scanError)
            sftpTransferStore.updateTaskStatus(task.id, 'error')
          }

          continue
        } else {
          // 单文件：统一走扫描 API（scanRemoteTree 已支持单文件）
          console.log(`[download] 创建单文件下载任务: ${remoteFilePath}`)

          const task = createTransferTask({
            type: 'download',
            sftpConnectionId: sftpConnectionId,
            sessionId: sessionId,
            totalBytes: 0,
            scanningNode: {
              name: fileName,
              type: 'download',
              localPath: localBasePath ? `${localBasePath}${fileName}` : '',
              remotePath: remoteFilePath,
              status: 'pending'
            }
          })

          sftpTransferStore.addTask(task)
          createdTasks.push(task)

          try {
            console.log(`[download] 扫描远程文件（主进程扫描）: ${remoteFilePath}`)
            
            // 设置任务状态为"扫描中"
            sftpTransferStore.updateTaskStatus(task.id, 'scanning')
            
            const dlFileScanResult = await window.api.sftp.scanRemoteTree(sftpConnectionId, remoteFilePath, localBasePath)
            
            if (!dlFileScanResult.success || !dlFileScanResult.root) {
              throw new Error(dlFileScanResult.error || '扫描失败')
            }
            
            console.log(`[download] 文件扫描完成: ${formatSize(dlFileScanResult.totalBytes || 0)}`)
            
            const ipcRoot = dlFileScanResult.root as TransferNode
            
            task.root = ipcRoot
            task.totalBytes = dlFileScanResult.totalBytes || 0

            sftpTransferStore.initNodeIndex(task.id)

            // 扫描完成，任务进入传输阶段
            sftpTransferStore.updateTaskStatus(task.id, 'transferring')

            sftpTransferStore.mutateNode(task.id, ipcRoot.id, {
              status: 'transferring',
              startTime: Date.now()
            })

          } catch (scanError: any) {
            console.error(`[download] 扫描远程文件失败: ${remoteFilePath}`, scanError)
            sftpTransferStore.updateTaskStatus(task.id, 'error')
          }
        }
        
      } catch (error: any) {
        console.error(`[download] 处理远程路径失败: ${remoteFilePath}`, error)
      }
    }
    
    console.log(`[download] 📊 共创建 ${createdTasks.length} 个下载任务`)
    
    for (let i = 0; i < createdTasks.length; i++) {
      const task = createdTasks[i]
      
      console.log(`[download] 开始下载任务 ${i + 1}/${createdTasks.length}: ${task.root!.name}`)
      
      sftpTransferStore.updateTaskRoot(task.id, {
        startTime: Date.now()
      })
      
      try {
        await downloadFolderContent(task.root!, sftpConnectionId, task.id)
        
        // 若已被用户取消则跳过，避免覆盖 cancelled 状态
        if (task.status === 'cancelled') continue
        
        // 使用 updateTask 更新非状态字段（completedAt/elapsedTime/transferredBytes）
        sftpTransferStore.updateTask(task.id, {
          completedAt: Date.now(),
          elapsedTime: Math.round((Date.now() - task.createdAt) / 1000),
          transferredBytes: task.totalBytes
        })
        
        // 使用 updateTaskStatus 更新任务状态（经过 FSM 校验 + version++ 触发 UI 刷新）
        // 注意：不要先用 task.status='completed' 直接赋值，否则 FSM 会拒绝 completed→completed
        sftpTransferStore.updateTaskStatus(task.id, 'completed')
        
        // 更新根节点最终统计信息（节点 status 已在 downloadFolderContent 中设为 completed，此处只更新非状态字段）
        sftpTransferStore.mutateNode(task.id, task.root!.id, {
          progress: 100,
          speed: 0,
          transferredBytes: task.root!.size || 0,
          completedFiles: task.root!.totalFiles || 0,
          endTime: Date.now()
        })
        
        console.log(`[download] ✅ 任务 ${i + 1} 完成: ${task.root!.name}`)
        
      } catch (error: any) {
        console.error(`[download] ❌ 任务 ${i + 1} 失败: ${task.root!.name}`, error)
        
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
