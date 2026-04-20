import type { TransferTask, TransferNode } from '@shared/types/sftp'
import { useSftpTransferStore } from '@/stores/sftpTransfer'
import { formatTime, formatSize, createTransferNode, createTransferTask } from './utils'

/**
 * 递归扫描文件夹并构建传输节点树
 * @param folderPath 文件夹路径
 * @param remoteBasePath 远程基础路径
 * @returns 根节点和文件统计信息
 */
async function scanFolderRecursive(
  folderPath: string,
  remoteBasePath: string
): Promise<{ rootNode: TransferNode; totalFiles: number; totalBytes: number }> {
  // 获取文件夹名称
  const folderName = folderPath.split(/[\\/]/).pop() || 'folder'
  
  // 创建当前文件夹节点
  const currentNode: TransferNode = {
    id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: folderName,
    isDirectory: true,
    type: 'upload',
    status: 'pending',
    progress: 0,
    size: 0,
    localPath: folderPath,
    remotePath: `${remoteBasePath}/${folderName}`,
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
    // 通过 Electron API 读取目录内容
    const result = await window.api.sftp.getLocalFiles(folderPath)
    
    if (!result.success || !result.data) {
      throw new Error(result.error || '无法读取目录')
    }
    
    const entries = result.data

    // 遍历目录项，跳过父目录导航项和隐藏的系统文件夹
    for (const entry of entries) {
      // 跳过父目录导航项（..），避免递归到上级目录
      if (entry.name === '..' || entry.name === '.') {
        console.log(`[upload] 跳过导航项: ${entry.name}`)
        continue
      }

      // 跳过 Windows 系统受保护目录
      const systemProtectedDirs = [
        'System Volume Information',
        '$Recycle.Bin',
        '$RECYCLE.BIN',
        'Recovery',
        'Config.Msi'
      ]
      
      if (systemProtectedDirs.includes(entry.name)) {
        console.warn(`[upload] 跳过系统受保护目录: ${entry.name}`)
        continue
      }

      const fullPath = `${folderPath}/${entry.name}`
      const remoteFullPath = `${remoteBasePath}/${folderName}/${entry.name}`

      if (entry.isDirectory) {
        // 递归扫描子文件夹（添加异常处理，跳过无权限访问的目录）
        try {
          const subResult = await scanFolderRecursive(fullPath, `${remoteBasePath}/${folderName}`)

          if (currentNode.children) {
            currentNode.children.push(subResult.rootNode)
          }

          totalFiles += subResult.totalFiles
          totalBytes += subResult.totalBytes
        } catch (subError: any) {
          // 跳过无法访问的子目录，记录警告但不中断整个上传
          console.warn(`[upload] 无法访问子目录 ${fullPath}，已跳过:`, subError.message)
          
          // 创建错误标记节点（可选）
          const errorNode: TransferNode = {
            id: `node-error-${Date.now()}`,
            name: entry.name,
            isDirectory: true,
            type: 'upload',
            status: 'error',
            progress: 0,
            size: 0,
            localPath: fullPath,
            remotePath: remoteFullPath,
            speed: 0,
            remaining: '',
            elapsed: '',
            error: `无法访问: ${subError.message}`
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
          type: 'upload',
          localPath: fullPath,
          remotePath: remoteFullPath,
          size: entry.size || 0
        })
        
        if (currentNode.children) {
          currentNode.children.push(fileNode)
        }
        
        totalFiles++
        totalBytes += entry.size || 0
      }
    }
    
    // 更新文件夹节点的统计信息
    currentNode.totalFiles = totalFiles
    currentNode.size = totalBytes
    
  } catch (error: any) {
    console.error(`[upload] 扫描文件夹失败: ${folderPath}`, error)
    currentNode.status = 'error'
    currentNode.error = error.message
  }
  
  return { rootNode: currentNode, totalFiles, totalBytes }
}

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
  taskId: string
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  if (!sftpConnectionId || !node.localPath || !node.remotePath) {
    throw new Error('缺少必要参数：sftpConnectionId 或文件路径')
  }
  
  // 检查任务状态：如果当前是 pending，则更新为 transferring
  // 只有当第一个文件节点真正开始传输并收到进度回调时，才改变任务状态
  const currentTask = sftpTransferStore.getTask(taskId)
  if (currentTask && currentTask.status === 'pending') {
    sftpTransferStore.updateTaskStatus(taskId, 'transferring')
    console.log('[upload] 任务状态从 pending 转换为 transferring（首个文件开始传输）')
  }
  
  // 通过 Store 更新节点状态为传输中（利用 reactive 特性，直接修改即可触发更新）
  sftpTransferStore.updateNodeStatus(taskId, node.id, {
    status: 'transferring',
    progress: 0,
    startTime: Date.now()
  })
  
  // ✅ 直接使用传入的 sftpConnectionId（连接已在 TerminalTab 初始化时建立）
  const connectionId = sftpConnectionId
  
  try {
    // 监听上传进度
    const cleanupProgress = window.api.sftp.onUploadProgress((data) => {
      if (data.localPath === node.localPath && data.remotePath === node.remotePath) {
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
          speed,
          remaining,
          elapsed
        })
      }
    })
    
    // 调用 Electron API 上传文件（使用已建立的 sftpConnectionId）
    const result = await window.api.sftp.upload(connectionId, node.localPath, node.remotePath)
    
    // 清理进度监听
    cleanupProgress()
    
    if (!result.success) {
      throw new Error(result.error || '上传失败')
    }
    
    // 上传完成 - 更新最终状态
    sftpTransferStore.updateNodeStatus(taskId, node.id, {
      status: 'completed',
      progress: 100
    })
    
  } catch (error: any) {
    console.error(`[upload] 文件上传失败: ${node.localPath}`, error)
    
    // 错误状态更新
    sftpTransferStore.updateNodeStatus(taskId, node.id, {
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
  taskId: string
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  if (!sftpConnectionId) return
  
  if (node.isDirectory && node.children && node.children.length > 0) {
    // 如果是文件夹，先在远程创建目录（使用已建立的连接）
    if (node.remotePath) {
      try {
        await window.api.sftp.mkdir(sftpConnectionId, node.remotePath)
      } catch (error: any) {
        console.warn(`[upload] 创建远程目录失败（可能已存在）: ${node.remotePath}`, error)
      }
    }
    
    // 通过 Store 更新状态为传输中（利用 Pinia reactive 特性）
    sftpTransferStore.updateNodeStatus(taskId, node.id, {
      status: 'transferring'
    })
    
    // 递归上传所有子节点（传递 sftpConnectionId）
    for (const child of node.children) {
      await uploadFolderContent(child, sftpConnectionId, taskId)
      
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
    
    // 所有子节点上传完成 - 更新最终状态
    sftpTransferStore.updateNodeStatus(taskId, node.id, {
      status: 'completed',
      progress: 100
    })
    
  } else if (node.isDirectory) {
    // ✅ 空文件夹处理：直接创建远程目录并标记完成
    console.log(`[upload] 检测到空文件夹，创建远程目录: ${node.name}`)
    
    // 更新节点状态为传输中
    sftpTransferStore.updateNodeStatus(taskId, node.id, {
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
      const endTime = Date.now()
      const elapsedSeconds = Math.round((endTime - (node.startTime || endTime)) / 1000)
      
      sftpTransferStore.updateNodeStatus(taskId, node.id, {
        status: 'completed',
        progress: 100,
        elapsed: formatTime(elapsedSeconds)
      })
      
    } catch (error: any) {
      console.error(`[upload] ❌ 空文件夹创建失败: ${node.name}`, error)
      
      // 更新错误状态
      sftpTransferStore.updateNodeStatus(taskId, node.id, {
        status: 'error',
        error: error.message || '空文件夹创建失败'
      })
      
      throw error
    }
    
  } else if (!node.isDirectory) {
    // 如果是文件，执行上传（传递 sftpConnectionId）
    await uploadSingleFile(node, sftpConnectionId, taskId)
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
    
    // 第一步：递归扫描文件夹并构建树形结构
    console.log('[upload] 正在扫描文件夹...')
    const scanResult = await scanFolderRecursive(folderPath, remoteBasePath)
    
    const rootNode = scanResult.rootNode
    
    console.log(`[upload] 扫描完成：${scanResult.totalFiles} 个文件，总大小 ${formatSize(scanResult.totalBytes)}`)
    
    // 第二步：创建传输任务并添加到 Store（安全架构 v4：直接使用 sftpConnectionId）
    const task = createTransferTask({
      type: 'upload',
      root: rootNode,
      sftpConnectionId: sftpConnectionId,
      sessionId: sessionId,
      totalBytes: scanResult.totalBytes
    })
    
    // 添加到 Store（任务会被转换为 reactive 对象）
    sftpTransferStore.addTask(task)
    
    
    // 第三步：开始上传（传递 taskId 以确保响应式更新）
    console.log('[upload] 开始上传文件...')
    
    // 更新根节点初始状态
    sftpTransferStore.updateTaskRoot(task.id, {
      startTime: Date.now()
    })
    
    await uploadFolderContent(rootNode, sftpConnectionId, task.id)
    
    // 第四步：更新任务状态
    task.status = 'completed'
    task.completedAt = Date.now()
    task.elapsedTime = Math.round((task.completedAt - task.createdAt) / 1000)
    task.transferredBytes = task.totalBytes
    
    sftpTransferStore.updateTaskStatus(task.id, 'completed')
    

    
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
          console.log(`[upload] 扫描文件夹: ${filePath}`)
          const folderResult = await scanFolderRecursive(filePath, remoteBasePath)
          taskRootNode = folderResult.rootNode
          taskTotalBytes = folderResult.totalBytes
          
          console.log(`[upload] 文件夹扫描完成: ${folderResult.totalFiles} 个文件, ${formatSize(taskTotalBytes)}`)
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
            remaining: '',
            elapsed: ''
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