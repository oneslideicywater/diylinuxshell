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
 * 
 * ⚠️ 任务状态更新规范（必须遵守）：
 *   1. 修改任务状态 → 必须使用 sftpTransferStore.updateTaskStatus(taskId, status)
 *      该方法会经过 FSM 状态机校验，确保状态转换合法（如 pending→scanning→transferring→completed）
 *   2. 更新非状态字段（completedAt/elapsedTime/transferredBytes 等）→ 使用 sftpTransferStore.updateTask(taskId, updates)
 *      注意：updateTask 禁止传入 status 字段，否则会报错拒绝！
 *   3. ❌ 绝对禁止：task.status = 'xxx' 或 updateTask({ status: 'xxx' })
 *      这会绕过 FSM 导致状态不一致（如待开始:1 但已完成列表有数据）
 * @module sftp/delete
 */

import type { TransferTask, TransferNode } from '@shared/types/sftp'
import { useSftpTransferStore } from '@/stores/sftpTransfer'
import { createTransferTask, isTaskCancelled } from './utils'

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
  
  // 更新节点状态为删除中（Service 层会先报 0%，这里设为初始状态）
  sftpTransferStore.mutateNode(taskId, node.id, {
    status: 'transferring',
    progress: 0,
    startTime: Date.now()
  })

  // 监听删除进度（对齐 upload/download 进度事件格式，按 nodeId 精确匹配）
  const cleanupProgress = window.api.sftp.onDeleteProgress((data) => {
    if (isTaskCancelled(taskId)) { return }

    if (data.nodeId === node.id) {
      // 删除进度：transferredBytes == node.size 时表示删除完成（100%）
      // 删除操作无速度概念，speed 固定为 0
      const progress = node.size > 0 ? Math.round((data.transferredBytes / node.size) * 100) : (data.transferredBytes > 0 ? 100 : 0)

      console.log(`[delete] 进度回调: ${node.name} | progress=${progress}%`)

      // 首次收到进度回调时初始化 startTime（文件和目录统一）
      const liveNode = sftpTransferStore.getNode(taskId, node.id)
      const updates: Partial<TransferNode> = { progress, speed: data.speed, transferredBytes: data.transferredBytes }
      if (liveNode && !liveNode.startTime) {
        updates.startTime = Date.now()
      }

      sftpTransferStore.mutateNode(taskId, node.id, updates)

      // 标记当前活跃传输节点（用于 UI 高亮定位）
      sftpTransferStore.updateTask(taskId, { activeNodeId: node.id })
    }
  })
  
  try {
    if (!node.remotePath) {
      throw new Error('远程路径为空')
    }
    
    // 调用 Electron API 删除文件/目录（对齐 upload/download 签名：connectionId + taskId + node）
    const result = await window.api.sftp.delete(sftpConnectionId, taskId, node)
    
    if (!result.success) {
      throw new Error(result.error || '删除失败')
    }
    
    // 删除完成 - 更新最终状态
    sftpTransferStore.mutateNode(taskId, node.id, {
      status: 'completed',
      progress: 100,
      speed: 0,
      transferredBytes: node.size || 0,
      endTime: Date.now()
    })
    console.log(`[delete] ✅ 删除完成: ${node.name}`)
  } catch (error: any) {
    console.error(`[delete] ❌ 删除失败: ${node.name}`, error)
    
    sftpTransferStore.mutateNode(taskId, node.id, {
      status: 'error',
      error: error.message || '删除失败',
      endTime: Date.now()
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
    
    // 更新状态为删除中
    sftpTransferStore.mutateNode(taskId, node.id, {
      status: 'transferring',
      startTime: Date.now()
    })
    
    // 先删除所有子文件/子文件夹（从叶子节点开始）
    for (const child of node.children) {
      // 检查任务是否已被取消（与 upload/download 保持一致的取消机制）
      if (isTaskCancelled(taskId, `停止删除剩余子项: ${node.name}`)) {
        break
      }
      
      await deleteFolderContent(child, sftpConnectionId, taskId)
    }
    // 所有子项删除完成 - 最后删除父文件夹本身（传递 sftpConnectionId）
    await deleteSingleItem(node, sftpConnectionId, taskId)
    
  } else if (node.isDirectory) {
    // 空目录或无子节点信息的目录 - 直接删除目录本身
    // 检查任务状态：如果当前是 pending，则更新为 transferring（与有子节点的文件夹分支保持一致）
    const emptyDirTask = sftpTransferStore.getTask(taskId)
    if (emptyDirTask && emptyDirTask.status === 'pending') {
      sftpTransferStore.updateTaskStatus(taskId, 'transferring')
      console.log('[delete] 任务状态从 pending 转换为 transferring（空目录删除开始）')
    }
    
    console.log(`[delete] 检测到空目录/叶子目录，直接删除: ${node.name}`)
    await deleteSingleItem(node, sftpConnectionId, taskId)
    
  } else if (!node.isDirectory) {
    // 如果是文件，执行删除
    // 检查任务状态：如果当前是 pending，则更新为 transferring（修复：单文件删除时任务不会卡在 pending）
    const fileTask = sftpTransferStore.getTask(taskId)
    if (fileTask && fileTask.status === 'pending') {
      sftpTransferStore.updateTaskStatus(taskId, 'transferring')
      console.log('[delete] 任务状态从 pending 转换为 transferring（单文件删除开始）')
    }
    
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
      // 调用主进程接口获取文件名（使用 Node.js path.basename，屏蔽系统差异）
      const fileNameResult = await window.api.sftp.basename(filePath)
      const fileName = fileNameResult.data || filePath
      
      // 先创建任务（root 暂时为 undefined）
      const task = createTransferTask({
        type: 'delete',
        sftpConnectionId: sftpConnectionId
      })

      sftpTransferStore.addTask(task)
      createdTasks.push(task)

      // 统一使用扫描 API（支持单文件和文件夹）
      // 本地删除不需要 remoteBasePath，传空字符串
      console.log(`[delete-local] 扫描本地路径: ${filePath}`)
      
      try {
        const delScanResult = await window.api.sftp.scanLocalTree(filePath, '')
        
        if (!delScanResult.success || !delScanResult.root) {
          throw new Error(delScanResult.error || '扫描失败')
        }
        
        const ipcRoot = delScanResult.root as TransferNode
        task.root = ipcRoot
        task.totalBytes = delScanResult.totalBytes || 0

        sftpTransferStore.initNodeIndex(task.id)

        sftpTransferStore.mutateNode(task.id, ipcRoot.id, {
          status: 'transferring',
          startTime: Date.now()
        })
        
        console.log(`[delete-local] ✅ 已创建删除任务 #${createdTasks.length}: ${fileName}`)
        
      } catch (scanError: any) {
        console.error(`[delete-local] 扫描本地路径失败: ${filePath}`, scanError)
        sftpTransferStore.updateTaskStatus(task.id, 'error')
      }
      
    } catch (error: any) {
      console.error(`[delete-local] 处理本地路径失败: ${filePath}`, error)
    }
  }
  
  console.log(`[delete-local] 📊 共创建 ${createdTasks.length} 个本地删除任务`)
  
  for (let i = 0; i < createdTasks.length; i++) {
    const task = createdTasks[i]
    
    console.log(`[delete-local] 开始删除任务 ${i + 1}/${createdTasks.length}: ${task.root!.name}`)
    
    sftpTransferStore.updateTaskRoot(task.id, {
      startTime: Date.now()
    })
    
    sftpTransferStore.updateTaskStatus(task.id, 'transferring')
      sftpTransferStore.mutateNode(task.id, task.root!.id, {
        status: 'transferring',
        startTime: Date.now()
      })
      
      if (!task.root!.localPath) {
        throw new Error('本地路径为空，无法删除')
      }

      // 监听本地删除进度（对齐 upload/download 进度事件格式，按 nodeId 精确匹配）
      const cleanupProgress = window.api.sftp.onDeleteLocalProgress((data) => {
        if (data.nodeId === task.root!.id) {
          const progress = task.root!.size > 0 ? Math.round((data.transferredBytes / task.root!.size) * 100) : (data.transferredBytes > 0 ? 100 : 0)

          // 首次收到进度回调时初始化 startTime
          const liveNode = sftpTransferStore.getNode(task.id, task.root!.id)
          const updates: Partial<TransferNode> = { progress, speed: data.speed, transferredBytes: data.transferredBytes }
          if (liveNode && !liveNode.startTime) {
            updates.startTime = Date.now()
          }

          sftpTransferStore.mutateNode(task.id, task.root!.id, updates)

          // 标记当前活跃传输节点（用于 UI 高亮定位）
          sftpTransferStore.updateTask(task.id, { activeNodeId: task.root!.id })
        }
      })

      try {
        // 调用 Electron API 删除本地文件/目录（对齐 upload/download 签名：taskId + node）
        const result = await window.api.sftp.deleteLocalFile(task.id, task.root!)

        if (!result.success) {
          throw new Error(result.error || '删除失败')
        }

        sftpTransferStore.mutateNode(task.id, task.root!.id, {
          status: 'completed',
          progress: 100,
          speed: 0,
          transferredBytes: task.root!.size || 0,
          endTime: Date.now()
        })

        // 若已被用户取消则跳过
        if (task.status === 'cancelled') continue
        
        // 通过 FSM 状态机转换任务状态
        sftpTransferStore.updateTaskStatus(task.id, 'completed')

        console.log(`[delete-local] ✅ 任务 ${i + 1} 完成: ${task.root!.name}`)
      } catch (error: any) {
        console.error(`[delete-local] ❌ 任务 ${i + 1} 失败: ${task.root!.name}`, error)

        sftpTransferStore.updateTaskStatus(task.id, 'error')
      } finally {
        cleanupProgress()
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
      
      // 判断是文件还是文件夹（通过查询远程路径类型）
      // 计算父目录路径：/tmp/file → /tmp,  /file → /
      const lastSlashIndex = remotePath.lastIndexOf('/')
      const parentPath = (lastSlashIndex > 0) ? remotePath.substring(0, lastSlashIndex) : '/'
      
      const listResult = await window.api.sftp.listDir(sftpConnectionId, parentPath)
      
      // listDir 失败时提前报错（目标路径的父目录不存在或连接异常）
      if (!listResult.success) {
        console.error(`[delete-remote] 无法列出父目录内容: ${parentPath}`, listResult.error)
        throw new Error(`无法访问目录 "${parentPath}"：${listResult.error || '路径不存在'}`)
      }
      
      const selectedItem = listResult.data?.find(
        (item: any) => item.path === remotePath || item.name === itemName
      ) || null
      
      // 目标路径在父目录中不存在（可能已被删除或从未创建）
      if (!selectedItem) {
        console.warn(`[delete-remote] 目标路径不存在: ${remotePath}`)
        throw new Error(`删除失败：路径 "${remotePath}" 不存在`)
      }
      
      if (selectedItem && (selectedItem.type === 'd' || selectedItem.isDirectory)) {
        console.log(`[delete-remote] 创建文件夹删除任务: ${remotePath}`)

        // 先创建 task（root 暂时为 undefined，扫描中显示在"待开始"）
        const task = createTransferTask({
          type: 'delete',
          sftpConnectionId: sftpConnectionId,
          sessionId: sessionId,
          totalBytes: 0
        })

        sftpTransferStore.addTask(task)
        createdTasks.push(task)

        // 任务状态：pending → scanning（遵循 FSM：必须经过 scanning 才能到 transferring）
        sftpTransferStore.updateTaskStatus(task.id, 'scanning')

        console.log(`[delete-remote] ✅ 已创建删除任务 #${createdTasks.length}（扫描中）: ${itemName}`)

        try {
          console.log(`[delete-remote] 扫描远程文件夹（主进程扫描）: ${remotePath}`)
          
          // 调用主进程扫描 API（一次性返回完整树结构，不需要 localBasePath）
          const delScanResult = await window.api.sftp.scanRemoteTree(sftpConnectionId, remotePath)
          
          if (!delScanResult.success || !delScanResult.root) {
            throw new Error(delScanResult.error || '扫描远程文件夹失败')
          }
          
          console.log(`[delete-remote] 远程文件夹扫描完成: ${delScanResult.totalFiles} 个文件`)
          
          // 直接使用 IPC 返回的整棵树作为根节点（parentId 链完整，无需修正）
          const ipcRoot = delScanResult.root as TransferNode
          
          // 设置任务根节点
          task.root = ipcRoot
          task.totalBytes = delScanResult.totalBytes || 0

          // 重建索引
          sftpTransferStore.initNodeIndex(task.id)

          // 更新根节点状态为传输中
          sftpTransferStore.mutateNode(task.id, ipcRoot.id, {
            status: 'transferring',
            totalFiles: delScanResult.totalFiles || 0,
            size: delScanResult.totalBytes || 0,
            startTime: Date.now()
          })

          // 更新任务状态为传输中（修复：单文件/空目录删除时任务不会卡在 pending）
          sftpTransferStore.updateTaskStatus(task.id, 'transferring')

          sftpTransferStore.updateTask(task.id, { totalBytes: delScanResult.totalBytes || 0 })

        } catch (scanError: any) {
          console.error(`[delete-remote] 扫描远程文件夹失败: ${remotePath}`, scanError)

          sftpTransferStore.updateTaskStatus(task.id, 'error')
        }
        
      } else {
        // 单文件：统一走扫描 API（scanRemoteTree 已支持单文件）
        console.log(`[delete-remote] 创建单文件删除任务: ${remotePath}`)

        const task = createTransferTask({
          type: 'delete',
          sftpConnectionId: sftpConnectionId,
          sessionId: sessionId,
          totalBytes: 0
        })

        sftpTransferStore.addTask(task)
        createdTasks.push(task)

        // 任务状态：pending → scanning（遵循 FSM：必须经过 scanning 才能到 transferring）
        sftpTransferStore.updateTaskStatus(task.id, 'scanning')

        try {
          console.log(`[delete-remote] 扫描远程文件（主进程扫描）: ${remotePath}`)
          
          const delFileScanResult = await window.api.sftp.scanRemoteTree(sftpConnectionId, remotePath)
          
          if (!delFileScanResult.success || !delFileScanResult.root) {
            throw new Error(delFileScanResult.error || '扫描失败')
          }
          
          console.log(`[delete-remote] 文件扫描完成`)
          
          const ipcRoot = delFileScanResult.root as TransferNode
          
          task.root = ipcRoot
          task.totalBytes = delFileScanResult.totalBytes || 0

          sftpTransferStore.initNodeIndex(task.id)

          sftpTransferStore.mutateNode(task.id, ipcRoot.id, {
            status: 'transferring',
            startTime: Date.now()
          })

          // 更新任务状态为传输中（修复：单文件删除时任务不会卡在 pending）
          sftpTransferStore.updateTaskStatus(task.id, 'transferring')

        } catch (scanError: any) {
          console.error(`[delete-remote] 扫描远程文件失败: ${remotePath}`, scanError)
          sftpTransferStore.updateTaskStatus(task.id, 'error')
        }
      }
      
    } catch (error: any) {
      console.error(`[delete-remote] 处理远程路径失败: ${remotePath}`, error)
    }
  }
  
  console.log(`[delete-remote] 📊 共创建 ${createdTasks.length} 个远程删除任务`)
  
  for (let i = 0; i < createdTasks.length; i++) {
    const task = createdTasks[i]
    
    console.log(`[delete-remote] 开始删除任务 ${i + 1}/${createdTasks.length}: ${task.root!.name}`)
    
    sftpTransferStore.updateTaskRoot(task.id, {
      startTime: Date.now()
    })
    
    try {
      await deleteFolderContent(task.root!, sftpConnectionId, task.id)
      

      
      // 若已被用户取消则跳过
      if (task.status === 'cancelled') continue
      
      // 通过 FSM 状态机转换任务状态：transferring → completed
      // 注意：必须用 updateTaskStatus（有 FSM 守卫），不能用 updateTask 直接写 status（会绕过 FSM）
      sftpTransferStore.updateTaskStatus(task.id, 'completed')
      
      const completedAt = Date.now()
      const elapsedTime = Math.round((completedAt - task.createdAt) / 1000)
      
      sftpTransferStore.updateTask(task.id, {
        completedAt,
        elapsedTime,
        transferredBytes: task.totalBytes
      })
      
      // 更新根节点最终状态
      sftpTransferStore.mutateNode(task.id, task.root!.id, {
        status: 'completed',
        progress: 100,
        speed: 0,
        transferredBytes: task.root!.size || 0,
        completedFiles: task.root!.totalFiles || 0,
        endTime: Date.now()
      })
      
      console.log(`[delete-remote] ✅ 任务 ${i + 1} 完成: ${task.root!.name}`)
      
    } catch (error: any) {
      console.error(`[delete-remote] ❌ 任务 ${i + 1} 失败: ${task.root!.name}`, error)
      
      sftpTransferStore.updateTaskStatus(task.id, 'error')
    }
  }

  const successCount = createdTasks.filter(t => t.status === 'completed').length
  const failCount = createdTasks.filter(t => t.status === 'error').length
  
  console.log(`[delete-remote] 🎉 批量远程文件删除完成！成功: ${successCount}, 失败: ${failCount}, 总计: ${createdTasks.length}`)
  
  return { success: successCount, failed: failCount }
}
