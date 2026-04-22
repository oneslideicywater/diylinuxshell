import type { TransferTask, TransferNode } from '@shared/types/sftp'
import { useSftpTransferStore } from '@/stores/sftpTransfer'
import { formatSize, createTransferNode, createTransferTask, isTaskCancelled, propagateViaParentChain } from './utils'

/**
 * 上传单个文件（利用 Pinia reactive 特性）
 * 通过 Store API 更新状态，自动触发视图响应式更新
 * 
 * @param node 文件节点
 * @param session SSH 会话
 * @param taskId 任务 ID（用于 Store 更新）
 */
/**
 * 上传单个文件（内部函数，使用 sftpConnectionId）
 * 
 * 安全架构 v4：
 * - 不再依赖 session 对象
 * - 直接使用已建立的 SFTP 连接标识符（sftpConnectionId）
 * - 连接在 TerminalTab 点击时建立，此处直接复用
 * 
 * @param node - 文件传输节点
 * @param sftpConnectionId - SFTP 连接标识符（已在组件初始化时建立）
 * @param taskId - 任务 ID（用于 Store 状态更新）
 */
async function uploadSingleFile(
  node: TransferNode, 
  sftpConnectionId: string,
  taskId: string,
  parentNode?: TransferNode
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  if (!sftpConnectionId || !node.localPath || !node.remotePath) {
    throw new Error('缺少必要参数：sftpConnectionId 或文件路径')
  }
  
  // ✅ 检查任务是否已被取消（真正的取消机制）
  if (isTaskCancelled(taskId, `跳过上传: ${node.name}`)) {
    return
  }
  
  // 检查任务状态：如果当前是 pending，则更新为 transferring
  // 只有当第一个文件节点真正开始传输并收到进度回调时，才改变任务状态
  const currentTask = sftpTransferStore.getTask(taskId)
  if (currentTask && currentTask.status === 'pending') {
    sftpTransferStore.updateTaskStatus(taskId, 'transferring')
    console.log('[upload] 任务状态从 pending 转换为 transferring（首个文件开始传输）')
  }
  
  // 通过 Store 更新节点状态为传输中（利用 reactive 特性，直接修改即可触发更新）
  sftpTransferStore.mutateNode(taskId, node.id, {
    status: 'transferring',
    progress: 0,
    startTime: Date.now()
  })
  
  // ✅ 直接使用传入的 sftpConnectionId（连接已在 TerminalTab 初始化时建立）
  const connectionId = sftpConnectionId
  
  try {
    // 监听上传进度（500ms 定时器已控制 UI 刷新频率，无需节流）
    const cleanupProgress = window.api.sftp.onUploadProgress((data) => {
      if (isTaskCancelled(taskId)) { return }

      if (data.nodeId === node.id) {
        const progress = node.size > 0 ? Math.round((data.transferredBytes / node.size) * 100) : 0
        const speed = data.speed

        console.log(`[upload] 进度回调: ${node.name} | progress=${progress}% speed=${formatSize(speed)}/s`)

        sftpTransferStore.mutateNode(taskId, node.id, { progress, speed, transferredBytes: data.transferredBytes })

        if (parentNode) {
          propagateViaParentChain(taskId, parentNode, sftpTransferStore)
        }
      }
    })
    
    // 调用 Electron API 上传文件（使用已建立的 sftpConnectionId）
    const result = await window.api.sftp.upload(connectionId, taskId, node)
    
    // 清理进度监听
    cleanupProgress()
    
    // ✅ 上传完成后再次检查是否已被取消
    if (isTaskCancelled(taskId, `上传完成但任务已取消: ${node.name}`)) {
      return  // 不更新状态，保持 cancelled
    }
    
    if (!result.success) {
      throw new Error(result.error || '上传失败')
    }
    
    // 上传完成 - 更新最终状态
    sftpTransferStore.mutateNode(taskId, node.id, {
      status: 'completed',
      progress: 100
    })
    
  } catch (error: any) {
    console.error(`[upload] 文件上传失败: ${node.localPath}`, error)
    
    // 错误状态更新
    sftpTransferStore.mutateNode(taskId, node.id, {
      status: 'error',
      error: error.message
    })
  }
}

/**
 * 递归上传文件夹内容（利用 Pinia reactive 特性）
 * 通过 Store API 更新节点状态，自动触发视图响应式更新
 * 
 * @param node 当前节点（文件夹或文件）
 * @param session SSH 会话
 * @param taskId 任务 ID（用于 Store 更新）
 */
/**
 * 递归上传文件夹内容（安全架构 v4）
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
async function uploadFolderContent(
  node: TransferNode, 
  sftpConnectionId: string,
  taskId: string,
  parentNode?: TransferNode
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  if (!sftpConnectionId) return
  
  if (node.isDirectory && node.children && node.children.length > 0) {
    // ✅ 检查任务是否已被取消（在文件夹处理开始前）
    if (isTaskCancelled(taskId, `跳过文件夹: ${node.name}`)) {
      return
    }
    
    // 如果是文件夹，先在远程创建目录（使用已建立的连接）
    if (node.remotePath) {
      try {
        await window.api.sftp.mkdir(sftpConnectionId, node.remotePath)
      } catch (error: any) {
        console.warn(`[upload] 创建远程目录失败（可能已存在）: ${node.remotePath}`, error)
      }
    }
    
    // 通过 Store 更新状态为传输中（利用 Pinia reactive 特性）
    sftpTransferStore.mutateNode(taskId, node.id, {
      status: 'transferring'
    })
    
    // 递归上传所有子节点（传递 sftpConnectionId 和当前节点作为父节点）
    for (const child of node.children) {
      // ✅ 检查任务是否已被取消（在每个子文件上传前）
      if (isTaskCancelled(taskId, `停止上传剩余子节点: ${node.name}`)) {
        break  // 跳出循环，不再上传剩余子节点
      }
      
      await uploadFolderContent(child, sftpConnectionId, taskId, node)
      
      // 每完成一个子节点就聚合更新父节点状态（含速度、剩余时间等）
      propagateViaParentChain(taskId, node, sftpTransferStore)
    }
    
    // 所有子节点上传完成 - 检查是否被取消
    if (isTaskCancelled(taskId, `文件夹上传完成但任务已取消: ${node.name}`)) {
      return  // 不更新状态，保持 cancelled
    }
    
    // 更新最终状态
    sftpTransferStore.mutateNode(taskId, node.id, {
      status: 'completed',
      progress: 100
    })
    
  } else if (node.isDirectory) {
    // ✅ 空文件夹处理：直接创建远程目录并标记完成
    console.log(`[upload] 检测到空文件夹，创建远程目录: ${node.name}`)
    
    // 更新节点状态为传输中
    sftpTransferStore.mutateNode(taskId, node.id, {
      status: 'transferring',
      startTime: Date.now()
    })
    
    try {
      // 在远程创建空目录（使用已建立的 sftpConnectionId）
      if (node.remotePath) {
        const result = await window.api.sftp.mkdir(sftpConnectionId, node.remotePath)
        if (!result.success) {
          throw new Error(result.error || '创建远程目录失败')
        }
        console.log(`[upload] ✅ 空文件夹已创建: ${node.remotePath}`)
      }
      
      // 更新节点状态为已完成
      sftpTransferStore.mutateNode(taskId, node.id, {
        status: 'completed',
        progress: 100,
        transferredBytes: 0
      })
      
    } catch (error: any) {
      console.error(`[upload] ❌ 空文件夹创建失败: ${node.name}`, error)
      
      // 更新错误状态
      sftpTransferStore.mutateNode(taskId, node.id, {
        status: 'error',
        error: error.message || '空文件夹创建失败'
      })
      
      throw error
    }
    
  } else if (!node.isDirectory) {
    // 如果是文件，执行上传（传递 sftpConnectionId 和父节点用于进度传播）
    await uploadSingleFile(node, sftpConnectionId, taskId, parentNode)
  }
}

/**
 * 上传单个文件（导出函数，安全架构 v4）
 * 
 * 设计原则：
 * - 不再接收 session 对象（避免在渲染进程传递敏感信息）
 * - 直接使用 sftpConnectionId（SFTP 连接已在 TerminalTab 初始化时建立）
 * - 可选接收 sessionId（用于通过 SessionStore 获取会话名称等非敏感信息显示）
 * 
 * @param filePath - 本地文件路径
 * @param sftpConnectionId - SFTP 连接标识符（必填，对应已建立的连接）
 * @param sessionId - 会话 ID（可选，用于 UI 显示会话信息）
 * @param remotePath - 远程目标路径（可以是字符串或 Ref<string>）
 */
export async function uploadFile(
  filePath: string,
  sftpConnectionId: string,
  sessionId?: string,
  remotePath?: string | { value: string }
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  console.log('[upload] 开始上传文件:', filePath, '连接ID:', sftpConnectionId)
  
  if (!sftpConnectionId) {
    throw new Error('SFTP 连接标识符不能为空（连接未建立）')
  }
  
  if (!filePath) {
    throw new Error('文件路径不能为空')
  }
  
  try {
    // 获取文件名和远程基础路径（remotePath 现在是可选参数）
    const fileName = filePath.split(/[\\/]/).pop() || 'file'
    const remoteBasePath = typeof remotePath === 'string' 
      ? remotePath 
      : (remotePath?.value || '/')
    
    // 创建文件节点
    const fileNode = createTransferNode({
      name: fileName,
      isDirectory: false,
      type: 'upload',
      localPath: filePath,
      remotePath: `${remoteBasePath}/${fileName}`
    })
    
    // 创建传输任务并添加到 Store（安全架构 v4：直接使用 sftpConnectionId）
    const task = createTransferTask({
      type: 'upload',
      root: fileNode,
      sftpConnectionId: sftpConnectionId,
      sessionId: sessionId
    })
    
    // 添加到 Store（返回 reactive 对象）
    sftpTransferStore.addTask(task)
    
    // 单文件根节点也需要建立索引，否则 mutateNode 找不到
    sftpTransferStore.rebuildNodeIndex(task.id)
    
    // 开始上传（传递 taskId 和 sftpConnectionId 以确保响应式更新）
    console.log('[upload] 正在上传文件...')
    
    // 注意：任务状态会在 uploadSingleFile 中当首个文件节点开始传输时自动从 pending 转换为 transferring
    
    await uploadSingleFile(fileNode, sftpConnectionId, task.id)
    
    // 更新任务状态和统计
    task.status = 'completed'
    task.completedAt = Date.now()
    task.elapsedTime = Math.round((task.completedAt - task.createdAt) / 1000)
    task.totalBytes = fileNode.size
    task.transferredBytes = fileNode.size
    
    sftpTransferStore.updateTaskStatus(task.id, 'completed')
    
    console.log('[upload] 文件上传完成！')
    
  } catch (error: any) {
    console.error('[upload] 文件上传失败:', error)
    throw error
  }
}

/**
 * 上传文件夹主函数（安全架构 v4）
 * 
 * 设计原则：
 * - 不再接收 session 对象
 * - 直接使用 sftpConnectionId（SFTP 连接已在 TerminalTab 初始化时建立）
 * - 可选接收 sessionId（用于 UI 显示会话信息）
 * 
 * @param folderPath - 本地文件夹路径
 * @param sftpConnectionId - SFTP 连接标识符（必填，对应已建立的连接）
 * @param sessionId - 会话 ID（可选，用于 UI 显示会话信息）
 * @param remotePath - 远程目标路径（可以是字符串或 Ref<string>）
 */
export async function uploadFolder(
  folderPath: string,
  sftpConnectionId: string,
  sessionId?: string,
  remotePath?: string | { value: string }
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  console.log('[upload] 开始上传文件夹:', folderPath, '连接ID:', sftpConnectionId)
  
  if (!sftpConnectionId) {
    throw new Error('SFTP 连接标识符不能为空（连接未建立）')
  }
  
  if (!folderPath) {
    throw new Error('文件夹路径不能为空')
  }
  
  try {
    // 获取远程基础路径（remotePath 现在是可选参数，需要提供默认值）
    const remoteBasePath = typeof remotePath === 'string' 
      ? remotePath 
      : (remotePath?.value || '/')
    
    const folderName = folderPath.split(/[\\/]/).pop() || 'folder'

    console.log(`[upload] 创建文件夹上传任务: ${folderName}`)

    // 创建真实根节点（status: scanning，后续扫描填充子节点，不再替换 root）
    const rootNode = createTransferNode({
      name: folderName,
      isDirectory: true,
      type: 'upload',
      localPath: folderPath,
      remotePath: `${remoteBasePath}/${folderName}`,
      children: [],
      totalFiles: 0,
      completedFiles: 0,
      expanded: false,
      status: 'scanning'
    })

    const task = createTransferTask({
      type: 'upload',
      root: rootNode,
      sftpConnectionId: sftpConnectionId,
      sessionId: sessionId,
      totalBytes: 0
    })

    sftpTransferStore.addTask(task)

    console.log(`[upload] ✅ 已创建上传任务（扫描中）: ${folderName}`)

    // 扫描子节点，使用主进程 API 一次性获取完整文件树
    try {
      console.log('[upload] 正在扫描文件夹（主进程扫描）...')
      
      // 调用主进程扫描 API（一次性返回完整树结构）
      const scanResult = await window.api.sftp.scanLocalTree(folderPath, remoteBasePath)
      
      if (!scanResult.success || !scanResult.root) {
        throw new Error(scanResult.error || '扫描文件夹失败')
      }
      
      console.log(`[upload] 扫描完成：${scanResult.totalFiles} 个文件，总大小 ${formatSize(scanResult.totalBytes || 0)}`)
      
      // v5 优化：主进程直接返回 TransferNode（无循环引用），无需类型转换
      const ipcRoot = scanResult.root as TransferNode
      
      // 替换根节点的子节点（保留原根节点的 reactive 引用）
      if (ipcRoot.children && rootNode.children) {
        rootNode.children.length = 0  // 清空原数组
        rootNode.children.push(...ipcRoot.children)  // 直接使用主进程返回的 TransferNode
      }
      
      // 统一重建索引（确保所有新节点都可被 mutateNode 找到）
      sftpTransferStore.rebuildNodeIndex(task.id)

      sftpTransferStore.mutateNode(task.id, rootNode.id, {
        status: 'transferring',
        totalFiles: scanResult.totalFiles || 0,
        size: scanResult.totalBytes || 0
      })

      sftpTransferStore.updateTask(task.id, { totalBytes: scanResult.totalBytes || 0 })
      
      task.totalBytes = scanResult.totalBytes || 0
      
    } catch (scanError: any) {
      console.error(`[upload] 扫描文件夹失败: ${folderName}`, scanError)

      sftpTransferStore.mutateNode(task.id, rootNode.id, {
        status: 'error',
        error: `扫描失败: ${scanError.message}`
      })
      sftpTransferStore.updateTaskStatus(task.id, 'error')
      throw scanError
    }
    
    // 开始上传（传递 taskId 以确保响应式更新）
    console.log('[upload] 开始上传文件...')
    
    // 更新根节点初始状态
    sftpTransferStore.updateTaskRoot(task.id, {
      startTime: Date.now()
    })
    
    await uploadFolderContent(task.root, sftpConnectionId, task.id)
    
    // 第四步：更新任务状态
    task.status = 'completed'
    task.completedAt = Date.now()
    task.elapsedTime = Math.round((task.completedAt - task.createdAt) / 1000)
    task.transferredBytes = task.totalBytes
    
    sftpTransferStore.updateTaskStatus(task.id, 'completed')
    
    // 更新根节点最终状态
    sftpTransferStore.mutateNode(task.id, rootNode.id, {
      status: 'completed',
      progress: 100,
      speed: 0,
      transferredBytes: rootNode.size || 0,
      completedFiles: rootNode.totalFiles || 0
    })
    

    
    console.log('[upload] 文件夹上传完成！')
    
  } catch (error: any) {
    console.error('[upload] 文件夹上传失败:', error)
    throw error
  }
}

/**
 * 批量上传主函数（支持混合选择文件和文件夹）
 * 
 * ✅ 新架构：每个选中的文件/文件夹创建独立的 TransferTask
 * - 选择 N 个项目 → 创建 N 个 TransferTask
 * - 每个任务独立管理进度、状态、取消操作
 * - 符合用户期望的"多任务"模式
 */
export async function uploadBatch(
  paths: string[],
  sftpConnectionId: string,
  sessionId?: string,
  remotePath?: string | { value: string }
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  console.log('[upload] 开始批量上传:', paths.length, '个文件/文件夹')
  console.log('[upload] 连接ID:', sftpConnectionId)
  
  if (!sftpConnectionId) {
    throw new Error('SFTP 连接标识符不能为空（连接未建立）')
  }
  
  if (!paths || paths.length === 0) {
    throw new Error('上传路径列表不能为空')
  }

  try {
    const remoteBasePath = typeof remotePath === 'string' 
      ? remotePath 
      : (remotePath?.value || '/')
    
    console.log('[upload] 远程目标路径:', remoteBasePath)
    
    const createdTasks: TransferTask[] = []
    
    for (const filePath of paths) {
      try {
        const parentPath = filePath.replace(/[/\\][^/\\]+$/, '') || '/'
        const fileName = filePath.split(/[\\/]/).pop() || 'file'
        
        const dirResult = await window.api.sftp.getLocalFiles(parentPath)
        
        if (!dirResult.success || !dirResult.data) {
          console.warn(`[upload] 无法读取父目录: ${parentPath}`)
          continue
        }
        
        const entry = dirResult.data.find((item: any) => item.name === fileName)
        
        if (!entry) {
          console.warn(`[upload] 在父目录中未找到: ${fileName}`)
          continue
        }
        
        let taskRootNode: TransferNode
        let taskTotalBytes = 0
        
        if (entry.isDirectory) {
          console.log(`[upload] 创建文件夹上传任务: ${filePath}`)

          const rootNode = createTransferNode({
            name: fileName,
            isDirectory: true,
            type: 'upload',
            localPath: filePath,
            remotePath: `${remoteBasePath}/${fileName}`,
            children: [],
            totalFiles: 0,
            completedFiles: 0,
            expanded: false,
            status: 'scanning'
          })

          taskRootNode = rootNode

          const task = createTransferTask({
            type: 'upload',
            root: rootNode,
            sftpConnectionId: sftpConnectionId,
            sessionId: sessionId,
            totalBytes: 0
          })

          sftpTransferStore.addTask(task)
          createdTasks.push(task)

          console.log(`[upload] ✅ 已创建上传任务 #${createdTasks.length}（扫描中）: ${fileName}`)

          try {
            console.log(`[upload] 扫描文件夹（主进程扫描）: ${filePath}`)
            
            // 调用主进程扫描 API（一次性返回完整树结构）
            const batchScanResult = await window.api.sftp.scanLocalTree(filePath, remoteBasePath)
            
            if (!batchScanResult.success || !batchScanResult.root) {
              throw new Error(batchScanResult.error || '扫描文件夹失败')
            }
            
            console.log(`[upload] 文件夹扫描完成: ${batchScanResult.totalFiles} 个文件, ${formatSize(batchScanResult.totalBytes || 0)}`)
            
            // v5 优化：主进程直接返回 TransferNode（无循环引用），无需类型转换
            const batchIpcRoot = batchScanResult.root as TransferNode
            
            // 替换根节点的子节点（保留原根节点的 reactive 引用）
            if (batchIpcRoot.children && rootNode.children) {
              rootNode.children.length = 0  // 清空原数组
              rootNode.children.push(...batchIpcRoot.children)  // 直接使用主进程返回的 TransferNode
            }

            sftpTransferStore.rebuildNodeIndex(task.id)

            sftpTransferStore.mutateNode(task.id, rootNode.id, {
              status: 'transferring',
              totalFiles: batchScanResult.totalFiles || 0,
              size: batchScanResult.totalBytes || 0
            })

            sftpTransferStore.updateTask(task.id, { totalBytes: batchScanResult.totalBytes || 0 })
            
            task.root = rootNode
            task.totalBytes = batchScanResult.totalBytes || 0

          } catch (scanError: any) {
            console.error(`[upload] 扫描文件夹失败: ${filePath}`, scanError)

            sftpTransferStore.mutateNode(task.id, rootNode.id, {
              status: 'error',
              error: `扫描失败: ${scanError.message}`
            })
            sftpTransferStore.updateTaskStatus(task.id, 'error')
            task.status = 'error'
          }

          continue
        } else {
          const fileSize = entry.size || 0
          
          taskRootNode = {
            id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: fileName,
            isDirectory: false,
            type: 'upload',
            status: 'pending',
            progress: 0,
            size: fileSize,
            localPath: filePath,
            remotePath: `${remoteBasePath}/${fileName}`,
            speed: 0,
            transferredBytes: 0
          }
          
          taskTotalBytes = fileSize
        }
        
        const task = createTransferTask({
          type: 'upload',
          root: taskRootNode,
          sftpConnectionId: sftpConnectionId,
          sessionId: sessionId,
          totalBytes: taskTotalBytes
        })
        
        sftpTransferStore.addTask(task)
        createdTasks.push(task)
        
        console.log(`[upload] ✅ 已创建传输任务 #${createdTasks.length}: ${taskRootNode.name} (${formatSize(taskTotalBytes)})`)
        
      } catch (error: any) {
        console.error(`[upload] 处理路径失败: ${filePath}`, error)
      }
    }
    
    console.log(`[upload] 📊 共创建 ${createdTasks.length} 个传输任务`)
    
    for (let i = 0; i < createdTasks.length; i++) {
      const task = createdTasks[i]
      
      console.log(`[upload] 开始上传任务 ${i + 1}/${createdTasks.length}: ${task.root.name}`)
      
      sftpTransferStore.updateTaskRoot(task.id, {
        startTime: Date.now()
      })
      
      try {
        await uploadFolderContent(task.root, sftpConnectionId, task.id)
        
        task.status = 'completed'
        task.completedAt = Date.now()
        task.elapsedTime = Math.round((task.completedAt - task.createdAt) / 1000)
        task.transferredBytes = task.totalBytes
        
        sftpTransferStore.updateTaskStatus(task.id, 'completed')
        
        // 更新文件夹根节点最终状态
        sftpTransferStore.mutateNode(task.id, task.root.id, {
          status: 'completed',
          progress: 100,
          speed: 0,
          transferredBytes: task.root.size || 0,
          completedFiles: task.root.totalFiles || 0
        })
        
        console.log(`[upload] ✅ 任务 ${i + 1} 完成: ${task.root.name}`)
        
      } catch (error: any) {
        console.error(`[upload] ❌ 任务 ${i + 1} 失败: ${task.root.name}`, error)
        
        task.status = 'error'
        sftpTransferStore.updateTaskStatus(task.id, 'error')
      }
    }
    
    const successCount = createdTasks.filter(t => t.status === 'completed').length
    const failCount = createdTasks.filter(t => t.status === 'error').length
    
    console.log(`[upload] 🎉 批量上传完成！成功: ${successCount}, 失败: ${failCount}, 总计: ${createdTasks.length}`)
    
  } catch (error: any) {
    console.error('[upload] ❌ 批量上传失败:', error)
    throw error
  }
}