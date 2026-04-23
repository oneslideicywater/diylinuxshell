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
   * 节点 ID → 节点引用的快速查找索引
   * 在 addTask 时构建，getNode 直接 O(1) 查表
   * key 格式: "taskId::nodeId"
   */
  const nodeIndexMap = new Map<string, TransferNode>()

  /**
   * 版本计数器：每次 mutateNode 调用时递增
   * 用于驱动 Vue 组件的 computed 重新计算（替代旧的 setInterval 定时刷新方案）
   * 组件通过依赖此值实现精确的数据驱动更新
   */
  const version = ref(0)


  /**
   * 递归构建节点索引（将树中所有节点存入 Map）
   */
  function buildNodeIndex(taskId: string, node: TransferNode): void {
    nodeIndexMap.set(`${taskId}::${node.id}`, node)
    if (node.children) {
      for (const child of node.children) {
        buildNodeIndex(taskId, child)
      }
    }
  }

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
   * 
   * 注意：此处不构建节点索引！
   * 正确的索引时机是：扫描完成后子节点填充完毕，调用 rebuildNodeIndex 统一重建。
   * 如果在 addTask 时对空根节点建索引，后续扫描填充子节点后需要补丁式 indexSubTree，
   * 容易导致 Proxy 引用混乱（普通对象 vs reactive Proxy 混用）→ 响应式更新失效。
   * 
   * @param task 任务数据（root 可以为空 children 的占位节点）
   */
  function addTask(task: TransferTask): void {
    cleanupCompletedTasks()
    transferTasks.value.push(task)
    // 不在此处 buildNodeIndex，等扫描完成后由调用方触发 rebuildNodeIndex
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
   * 当 root 被替换时自动重建节点索引（两阶段策略的关键）
   * 
   * @param taskId 任务 ID
   * @param updates 要更新的字段
   */
  function updateTask(taskId: string, updates: Partial<TransferTask>): void {
    const task = transferTasks.value.find(t => t.id === taskId)
    if (!task) return
    
    // 如果 root 被整体替换（两阶段策略：占位节点 → 真实树），必须重建索引
    if (updates.root && task.root !== updates.root) {
      // 清除该任务的所有旧索引
      for (const key of Array.from(nodeIndexMap.keys())) {
        if (key.startsWith(`${taskId}::`)) {
          nodeIndexMap.delete(key)
        }
      }
      // 用新 root 重建索引
      buildNodeIndex(taskId, updates.root)
      console.log(`[sftpTransfer] 🔄 任务 ${taskId} 索引已重建（root 替换）`)
    }

    Object.assign(task, updates)
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
   * 获取从指定节点到根节点的祖先链 ID 列表（含自身）
   * 
   * 通过 parentId 链向上遍历，返回 [nodeId, parentId, grandParentId, ..., rootId]
   * 数组第一个元素为指定节点自身，最后一个元素为根节点
   * 
   * @param taskId 任务 ID
   * @param nodeId 起始节点 ID
   * @returns 祖先链 ID 数组（从叶子到根），未找到节点时返回空数组
   */
  function getAncestorChain(taskId: string, nodeId: string): string[] {
    const chain: string[] = []
    let currentId: string | undefined = nodeId

    while (currentId) {
      chain.push(currentId)
      const node = nodeIndexMap.get(`${taskId}::${currentId}`)
      if (!node) break
      currentId = node.parentId
    }

    return chain
  }


  /**
   * 更新指定节点的状态并沿祖先链传播属性
   * 
   * @param taskId 任务 ID
   * @param nodeId 节点 ID
   * @param updates 要更新的字段（Partial<TransferNode>）
   * @param deltaBytes 本次回调的增量传输字节数（仅对文件/叶子节点有意义）
   */
  function mutateNode(taskId: string, nodeId: string, updates: Partial<TransferNode>, deltaBytes?: number): void {
    const node = nodeIndexMap.get(`${taskId}::${nodeId}`)
    if (!node) {
      console.warn(`[sftpTransfer] ⚠️ mutateNode 未找到节点: taskId=${taskId} nodeId=${nodeId}（索引可能未重建）`)
      return
    }

    // 递增版本号 → 触发所有依赖 version 的 computed 重算
    version.value++

    const isFile = !node.isDirectory

    // ========== 更新当前节点 ==========
    if (isFile && typeof deltaBytes === 'number' && deltaBytes > 0) {
      // 文件节点：transferredBytes 为累计值 = 旧值 + 增量
      updates.transferredBytes = (node.transferredBytes || 0) + deltaBytes
    }
    Object.assign(node, updates)

    // 获取祖先链 [自身, 父, 祖父, ..., 根]
    const chain = getAncestorChain(taskId, nodeId)
    if (chain.length <= 1) return  // 无祖先节点，无需传播

    // ========== 第一遍：正向遍历（根 → 自身），传播 startTime ==========
    const hasStartTime = typeof updates.startTime === 'number'
    if (hasStartTime) {
      for (let i = chain.length - 1; i >= 0; i--) {
        const ancestor = nodeIndexMap.get(`${taskId}::${chain[i]}`)
        if (!ancestor) continue
        if (!ancestor.startTime) {
          Object.assign(ancestor, { startTime: updates.startTime! })
        }
      }
    }

    // ========== 第二遍：反向遍历（自身 → 根），向上传播传输字节增量 ==========
    // 计算本次对父节点的有效增量
    let effectiveDelta = 0
    if (isFile && typeof deltaBytes === 'number' && deltaBytes > 0) {
      // 文件节点：使用传入的增量字节
      effectiveDelta = deltaBytes
    } else if (!isFile && typeof updates.transferredBytes === 'number' && updates.transferredBytes > 0) {
      // 目录节点完成时：transferredBytes = 文件夹总大小，增量 = 最终值 - 旧值
      effectiveDelta = updates.transferredBytes - (node.transferredBytes || 0)
    }
    if (effectiveDelta <= 0) return

    for (let i = 1; i < chain.length; i++) {
      const parent = nodeIndexMap.get(`${taskId}::${chain[i]}`)
      if (!parent) continue

      const folderSize = parent.size || 0
      const newParentTransferred = (parent.transferredBytes || 0) + effectiveDelta

      let folderSpeed = 0
      if (newParentTransferred > 0 && parent.startTime) {
        const elapsed = (Date.now() - parent.startTime) / 1000
        folderSpeed = elapsed > 0 ? Math.round(newParentTransferred / elapsed) : 0
      }

      Object.assign(parent, {
        transferredBytes: newParentTransferred,
        progress: folderSize > 0 ? Math.round((newParentTransferred / folderSize) * 100) : 0,
        speed: folderSpeed
      })
    }
  }

  /**
   * 重建任务的完整节点索引（扫描完成后必须调用）
   * 
   * 使用时机：addTask 时根节点是空 children（scanning 状态），
   * 异步扫描完成并填充子节点后，调用此方法一次性重建整棵树的索引。
   * 此时 task.root 及其所有子节点都已在 reactive 数组中，
   * buildNodeIndex 取到的全部是 Vue Proxy → mutateNode 的 Object.assign 能正确触发 Proxy.set。
   * 
   * @param taskId 任务 ID
   */
  function rebuildNodeIndex(taskId: string): void {
    const task = transferTasks.value.find(t => t.id === taskId)
    if (!task || !task.root) return

    // 先清除该任务的所有旧索引（防止重复）
    for (const key of Array.from(nodeIndexMap.keys())) {
      if (key.startsWith(`${taskId}::`)) {
        nodeIndexMap.delete(key)
      }
    }

    // 重建完整树索引（此时子节点已填充完毕，全部是 reactive Proxy）
    buildNodeIndex(taskId, task.root)

    console.log(`[sftpTransfer] 🔨 重建索引完成: taskId=${taskId}, 根节点="${task.root.name}"`)
  }

  /**

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
   * 获取指定任务的指定节点的最新状态
   * 使用 nodeIndexMap 实现 O(1) 查找，避免遍历整棵树
   * 
   * @param taskId 任务 ID
   * @param nodeId 节点 ID
   * @returns 最新状态的节点引用，或 undefined
   */
  function getNode(taskId: string, nodeId: string): TransferNode | undefined {
    // 触发 transferTasks 的响应式依赖收集（确保 Store 变化时 computed 重算）
    void transferTasks.value.length
    return nodeIndexMap.get(`${taskId}::${nodeId}`)
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
    version,                // 版本号（mutateNode 时递增，驱动 computed 重算）
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
    mutateNode,             // O(1) 直接变异 + 响应式触发（配合 parent 链使用）
    rebuildNodeIndex,       // 扫描完成后重建整棵树索引（必须调用）
    getAncestorChain,       // 获取从指定节点到根节点的祖先链 ID（含自身）
    updateNodeStatus,       // 兼容旧接口（树遍历查找）
    // 其他方法
    removeTask,
    clearCompletedTasks,
    clearAllTasks,
    getTask,
    getNode,                // 获取指定任务的指定节点最新状态（实时数据）
    setAllNodesExpanded,
    // ========== 任务选中相关方法 ==========
    toggleTaskSelection,     // 切换任务选中状态
    cancelSelectedTasks,     // 取消选中的任务
    clearSelectedTasks       // 清空选中状态
  }
})
