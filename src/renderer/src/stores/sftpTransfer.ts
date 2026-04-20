import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TransferTask, TransferNode } from '@shared/types/sftp'

/**
 * SFTP 传输任务状态管理 Store
 * 管理所有文件传输（上传、下载、删除）任务的状态
 * 
 * 核心特性：
 * - 使用 reactive() 确保深层响应式
 * - 提供节点级别的状态更新方法
 * - 支持树形结构的实时更新
 */
export const useSftpTransferStore = defineStore('sftpTransfer', () => {
  /**
   * 传输任务列表（使用 ref 存储数组）
   */
  const transferTasks = ref<TransferTask[]>([])

  /**
   * 选中的任务 ID 集合（用于批量取消操作）
   */
  const selectedTaskIds = ref<Set<string>>(new Set())

  /**
   * 计算属性：待开始的任务列表（pending 状态）
   */
  const pendingTasks = computed(() => {
    return transferTasks.value.filter(task => task.status === 'pending')
  })

  /**
   * 计算属性：传输中的任务列表（transferring 状态）
   */
  const transferringTasks = computed(() => {
    return transferTasks.value.filter(task => task.status === 'transferring')
  })

  /**
   * 计算属性：已完成的任务列表（completed 状态）
   */
  const completedTasks = computed(() => {
    return transferTasks.value.filter(task => task.status === 'completed')
  })

  /**
   * 计算属性：错误状态的任务列表（error 状态）
   */
  const errorTasks = computed(() => {
    return transferTasks.value.filter(task => task.status === 'error')
  })

  /**
   * 计算属性：已取消的任务列表（cancelled 状态）
   */
  const cancelledTasks = computed(() => {
    return transferTasks.value.filter(task => task.status === 'cancelled')
  })

  /**
   * 已完成任务最大保留数量
   */
  const MAX_COMPLETED_TASKS = 100

  /**
   * 添加传输任务
   * @param task 任务数据
   */
  function addTask(task: TransferTask): void {
    // 清理超出限制的已完成任务
    cleanupCompletedTasks()
    
    // 直接 push 到 ref 数组中，Vue 3 会自动处理响应式
    transferTasks.value.push(task)
  }

  /**
   * 清理超出限制的已完成任务
   * 保留最近的 MAX_COMPLETED_TASKS 个已完成任务，删除最早的记录
   */
  function cleanupCompletedTasks(): void {
    const completedTasks = transferTasks.value.filter(task => task.status === 'completed')
    
    if (completedTasks.length >= MAX_COMPLETED_TASKS) {
      // 计算需要删除的数量（保留最新的 MAX_COMPLETED_TASKS 个）
      const excessCount = completedTasks.length - MAX_COMPLETED_TASKS + 1
      
      if (excessCount > 0) {
        // 获取最早的 excessCount 个已完成任务的 ID
        const taskIdsToRemove = completedTasks
          .slice(0, excessCount)
          .map(task => task.id)
        
        // 从任务列表中移除这些任务
        transferTasks.value = transferTasks.value.filter(
          task => !taskIdsToRemove.includes(task.id)
        )
        
        console.log(`[sftpTransfer] 🧹 清理了 ${excessCount} 个已完成的任务，当前共 ${completedTasks.length - excessCount} 个`)
      }
    }
  }

  /**
   * 更新传输任务的顶层属性
   * @param taskId 任务 ID
   * @param updates 要更新的字段
   */
  function updateTask(taskId: string, updates: Partial<TransferTask>): void {
    const task = transferTasks.value.find(t => t.id === taskId)
    if (task) {
      Object.assign(task, updates)
    }
  }

  /**
   * 更新任务状态
   * @param taskId 任务 ID
   * @param status 新状态
   */
  function updateTaskStatus(taskId: string, status: TransferTask['status']): void {
    updateTask(taskId, { status })
  }

  /**
   * 更新根节点的属性（利用 reactive 特性）
   * @param taskId 任务 ID
   * @param rootUpdates 根节点要更新的字段
   */
  function updateTaskRoot(taskId: string, rootUpdates: Partial<TransferNode>): void {
    const task = transferTasks.value.find(t => t.id === taskId)
    if (task && task.root) {
      // 直接修改 reactive 对象的属性，Vue 会自动追踪变化
      Object.assign(task.root, rootUpdates)
    }
  }

  /**
   * 更新指定节点的状态（核心方法）
   * 通过查找节点并修改属性来更新状态
   * 使用 Object.assign 确保触发 Vue 响应式系统
   * 
   * @param taskId 任务 ID
   * @param nodeId 节点 ID
   * @param updates 要更新的字段
   */
  function updateNodeStatus(
    taskId: string, 
    nodeId: string, 
    updates: Partial<TransferNode>
  ): void {
    const taskIndex = transferTasks.value.findIndex(t => t.id === taskId)
    if (taskIndex === -1) return
    
    const task = transferTasks.value[taskIndex]
    
    // 在树中查找并更新目标节点
    const updated = updateNodeInTree(task.root, nodeId, updates)
    
    if (updated) {
      // 通过重新赋值整个任务来强制触发响应式更新
      // 这是最可靠的方式确保 Vue 检测到深层变化
      transferTasks.value[taskIndex] = { ...task }
    }
  }

  /**
   * 在树形结构中递归查找并更新节点
   * @param node 当前节点
   * @param nodeId 目标节点 ID
   * @param updates 要更新的字段
   * @returns 是否找到并更新了节点
   */
  function updateNodeInTree(
    node: TransferNode, 
    nodeId: string, 
    updates: Partial<TransferNode>
  ): boolean {
    if (node.id === nodeId) {
      // 找到目标节点，应用更新
      Object.assign(node, updates)
      return true
    }
    
    // 递归搜索子节点
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        if (updateNodeInTree(child, nodeId, updates)) {
          return true
        }
      }
    }
    
    return false
  }

  /**
   * 移除传输任务
   * @param taskId 任务 ID
   */
  function removeTask(taskId: string): void {
    const index = transferTasks.value.findIndex(t => t.id === taskId)
    if (index !== -1) {
      transferTasks.value.splice(index, 1)
    }
  }

  /**
   * 清除已完成的任务
   * 保留最近的任务历史记录，避免列表过长
   */
  function clearCompletedTasks(): void {
    // 只保留活跃的任务和最近完成的5个任务
    const active = transferTasks.value.filter(t => 
      t.status === 'pending' || t.status === 'transferring'
    )
    const completed = transferTasks.value
      .filter(t => t.status === 'completed' || t.status === 'cancelled')
      .slice(-5)
    
    transferTasks.value = [...active, ...completed]
  }

  /**
   * 清除所有任务
   */
  function clearAllTasks(): void {
    transferTasks.value = []
  }

  /**
   * 获取指定任务（返回 reactive 对象）
   * @param taskId 任务 ID
   * @returns 任务对象或 undefined
   */
  function getTask(taskId: string): TransferTask | undefined {
    return transferTasks.value.find(t => t.id === taskId)
  }

  /**
   * 设置所有节点的展开状态
   * @param expanded 是否展开
   */
  function setAllNodesExpanded(expanded: boolean): void {
    transferTasks.value.forEach(task => {
      setNodeExpandedRecursive(task.root, expanded)
    })
  }

  /**
   * 递归设置节点展开状态
   * @param node 当前节点
   * @param expanded 是否展开
   */
  function setNodeExpandedRecursive(node: TransferNode, expanded: boolean): void {
    node.expanded = expanded
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => setNodeExpandedRecursive(child, expanded))
    }
  }

  /**
   * 切换任务选中状态
   * @param taskId 任务 ID
   */
  function toggleTaskSelection(taskId: string): void {
    if (selectedTaskIds.value.has(taskId)) {
      selectedTaskIds.value.delete(taskId)
    } else {
      selectedTaskIds.value.add(taskId)
    }
    // 触发响应式更新（Set 需要重新赋值）
    selectedTaskIds.value = new Set(selectedTaskIds.value)
  }

  /**
   * 取消所有选中的任务（仅限 pending 和 transferring 状态）
   * 将选中的可取消任务及其所有子节点状态更新为 cancelled
   */
  function cancelSelectedTasks(): void {
    const taskIdsToCancel = Array.from(selectedTaskIds.value)
    
    for (const taskId of taskIdsToCancel) {
      const taskIndex = transferTasks.value.findIndex(t => t.id === taskId)
      if (taskIndex === -1) continue
      
      const task = transferTasks.value[taskIndex]
      
      // 只取消待开始或传输中的任务
      if (task.status === 'pending' || task.status === 'transferring') {
        // 更新任务状态
        updateTaskStatus(taskId, 'cancelled')
        
        // 递归标记所有子节点为 cancelled
        if (task.root) {
          markAllNodesCancelled(task.root, taskId)
        }
        
        console.log(`[sftpTransfer] 🚫 已取消任务: ${taskId} (含所有子节点)`)
      }
    }
    
    // 清空选中状态
    selectedTaskIds.value = new Set()
  }

  /**
   * 递归标记树中所有节点为已取消状态
   * @param node 当前节点
   * @param taskId 任务 ID（用于更新 Store 状态）
   */
  function markAllNodesCancelled(node: TransferNode, taskId: string): void {
    // 标记当前节点为 cancelled
    updateNodeStatus(taskId, node.id, { 
      status: 'cancelled',
      progress: 0 
    })
    
    // 递归处理所有子节点
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        markAllNodesCancelled(child, taskId)
      }
    }
  }

  /**
   * 清空所有任务的选中状态
   */
  function clearSelectedTasks(): void {
    selectedTaskIds.value = new Set()
  }

  return {
    // 状态
    transferTasks,
    selectedTaskIds,      // 选中的任务 ID 集合
    
    // ========== 按状态分类的任务列表 ==========
    pendingTasks,           // 待开始的任务
    transferringTasks,     // 传输中的任务
    completedTasks,        // 已完成的任务
    errorTasks,            // 错误状态的任务
    cancelledTasks,        // 已取消的任务
    
    // 任务管理方法
    addTask,
    updateTask,
    updateTaskStatus,
    updateTaskRoot,
    // 节点状态更新方法（核心）
    updateNodeStatus,
    // 其他方法
    removeTask,
    clearCompletedTasks,
    clearAllTasks,
    getTask,
    setAllNodesExpanded,
    // ========== 任务选中相关方法 ==========
    toggleTaskSelection,     // 切换任务选中状态
    cancelSelectedTasks,     // 取消选中的任务
    clearSelectedTasks       // 清空选中状态
  }
})
