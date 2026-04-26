import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TransferTask, TransferNode } from '@shared/types/sftp'
import { formatSize } from '@/components/terminal/sftp/script/utils'
import { transferTaskFSM } from '@/components/terminal/sftp/fsm/TaskStateMachine'
import { transferNodeFSM } from '@/components/terminal/sftp/fsm/NodeStateMachine'

/**
 * SFTP 传输任务状态管理 Store
 * 管理所有文件传输（上传、下载、删除）任务的状态
 * 
 * 核心特性：
 * - 使用 reactive() 确保深层响应式
 * - 提供节点级别的状态更新方法
 * - 支持树形结构的实时更新
 * 
 * ⚠️ 任务状态更新规范（所有调用方必须遵守）：
 *   1. 修改任务状态 → 必须使用 updateTaskStatus(taskId, status)
 *      该方法会经过 FSM 状态机校验，确保状态转换合法（如 pending→scanning→transferring→completed）
 *   2. 更新非状态字段（completedAt/elapsedTime/transferredBytes 等）→ 使用 updateTask(taskId, updates)
 *      注意：updateTask 禁止传入 status 字段，否则会报错拒绝！
 *   3. ❌ 绝对禁止：task.status = 'xxx' 或 updateTask({ status: 'xxx' })
 *      这会绕过 FSM 导致状态不一致（如待开始:1 但已完成列表有数据）
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
   * 添加传输任务（只做 push，不建索引）
   * 
   * 索引时机：单文件任务在 addTask 后由调用方调 initNodeIndex；
   * 文件夹任务在扫描完成、设置 root 后调 initNodeIndex。
   * 
   * @param task 任务数据
   */
  function addTask(task: TransferTask): void {
    cleanupCompletedTasks()
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
   * 更新传输任务的顶层属性（非状态字段）
   * 
   * ⚠️ 状态字段（status）禁止通过此方法修改！
   *    修改任务状态必须使用 updateTaskStatus()，该方法会经过 FSM 状态机校验。
   *    若此方法检测到 updates 中包含 status 字段，将直接拒绝并打印错误日志。
   * 
   * 用途：更新 completedAt、elapsedTime、transferredBytes、totalBytes 等非状态属性
   * 
   * @param taskId 任务 ID
   * @param updates 要更新的字段（不得包含 status）
   */
  function updateTask(taskId: string, updates: Partial<TransferTask>): void {
    // 防御性检查：禁止通过此方法绕过 FSM 修改任务状态
    if ('status' in updates) {
      console.error(
        `[sftpTransfer] 🚫 updateTask() 拒绝：检测到 status 字段！` +
        `修改任务状态必须使用 updateTaskStatus(taskId, status) 以经过 FSM 校验。` +
        `调用栈信息请检查上方日志。`
      )
      return
    }

    const task = transferTasks.value.find(t => t.id === taskId)
    if (!task) return
    Object.assign(task, updates)
  }

  /**
   * 状态机守卫：查询任务当前状态，判断是否允许转换到目标状态
   *
   * @param taskId 任务 ID
   * @param targetStatus 目标状态
   * @param callerName 调用方名称（用于日志定位）
   * @returns true = 允许执行，false = 拒绝并打印 warn
   */
  function shouldAllowTransition(
    taskId: string,
    targetStatus: string,
    callerName: string = ''
  ): boolean {
    const task = transferTasks.value.find(t => t.id === taskId)
    if (!task) return true

    if (!transferTaskFSM.canTransition(task.status, targetStatus)) {
      console.warn(
        `[sftpTransfer] 🚫 ${callerName ? callerName + ' ' : ''}状态机拒绝: ` +
        `任务 ${taskId} "${task.status}" → "${targetStatus}" 不在合法转换表中`
      )
      return false
    }

    return true
  }

  /**
   * 更新任务状态（带状态机保护）
   *
   * @param taskId 任务 ID
   * @param status 新状态
   */
  function updateTaskStatus(taskId: string, status: TransferTask['status']): void {
    if (!shouldAllowTransition(taskId, status)) return
    updateTask(taskId, { status })
  }

  /**
   * 判断节点状态转换是否合法（使用 Node FSM）
   *
   * 与 shouldAllowTransition 的区别：
   * - shouldAllowTransition → 使用 Task FSM，校验**任务**状态（7 状态）
   * - shouldAllowNodeTransition → 使用 Node FSM，校验**节点**状态（5 状态）
   *
   * @param node 当前节点
   * @param targetStatus 目标状态
   * @param callerName 调用方名称（用于日志定位）
   * @returns true = 允许执行，false = 拒绝并打印 warn
   */
  function shouldAllowNodeTransition(
    node: TransferNode,
    targetStatus: string,
    callerName: string = ''
  ): boolean {
    if (!transferNodeFSM.canTransition(node.status, targetStatus)) {
      console.warn(
        `[sftpTransfer] 🚫 ${callerName ? callerName + ' ' : ''}节点状态机拒绝: ` +
        `节点 ${node.name}(${node.id}) "${node.status}" → "${targetStatus}" 不在 Node FSM 合法转换表中`
      )
      return false
    }
    return true
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
   * 设计说明：deltaBytes 由函数内部自动计算（newValue - oldValue），
   * 调用方只需传入绝对值 transferredBytes，无需关心增量计算。
   *
   * @param taskId 任务 ID
   * @param nodeId 节点 ID
   * @param updates 要更新的字段（Partial<TransferNode>）
   */
  function mutateNode(taskId: string, nodeId: string, updates: Partial<TransferNode>): void {
    const node = nodeIndexMap.get(`${taskId}::${nodeId}`)
    if (!node) {
      console.warn(`[sftpTransfer] ⚠️ mutateNode 未找到节点: taskId=${taskId} nodeId=${nodeId}（索引可能未重建）`)
      return
    }

    // 递增版本号 → 触发所有依赖 version 的 computed 重算
    version.value++

    // 记录旧值（用于计算 delta 和日志）
    const oldTransferredBytes = node.transferredBytes || 0

    // 日志：每次 mutateNode 打印节点完整状态变化（不区分根/非根）
    const oldState = {
      status: node.status,
      progress: node.progress,
      speed: node.speed,
      transferredBytes: node.transferredBytes,
      startTime: node.startTime,
      endTime: node.endTime,
      completedFiles: node.completedFiles
    }

    // 保护 startTime/endTime 不被重复覆盖：
    // 祖先传播逻辑（下方）对祖先节点做了 ancestor.startTime 检查，
    // 但 Object.assign 对当前节点自身无保护。
    // 场景：子节点开始传输时传入新的 startTime，会覆盖根节点已有的原始 startTime
    if (node.startTime != null && 'startTime' in updates) {
      delete (updates as Record<string, unknown>).startTime
    }
    if (node.endTime != null && 'endTime' in updates) {
      delete (updates as Record<string, unknown>).endTime
    }

    /** 终态保护：使用 Node FSM 校验节点状态转换合法性 */
    if ('status' in updates && !shouldAllowNodeTransition(node, (updates as any).status, 'mutateNode')) {
      return
    }

    Object.assign(node, updates)

    // 自动计算 deltaBytes（用于向上传播给父节点）
    const deltaBytes = (node.transferredBytes || 0) - oldTransferredBytes

    console.log(
      `[sftpTransfer] 🕐 mutateNode | ` +
      `节点: ${node.name} (${node.isDirectory ? '目录' : '文件'}) path=${node.remotePath || node.localPath || '-'} | ` +
      `updates: ${JSON.stringify(Object.keys(updates))} deltaBytes=${deltaBytes > 0 ? deltaBytes : 0} | ` +
      `status: ${oldState.status} → ${node.status} | ` +
      `progress: ${oldState.progress} → ${node.progress}% | ` +
      `speed: ${oldState.speed} → ${node.speed} B/s | ` +
      `transferredBytes: ${oldState.transferredBytes} → ${node.transferredBytes} | ` +
      `startTime: ${oldState.startTime ?? 'null'} → ${node.startTime ?? 'null'} | ` +
      `endTime: ${oldState.endTime ?? 'null'} → ${node.endTime ?? 'null'}`
    )

    const chain = getAncestorChain(taskId, nodeId)

    if (chain.length <= 1) return

    // ========== 反向遍历（自身 → 根），向上传播传输字节增量 ==========
    // 统一使用自动计算的 deltaBytes（文件和目录都用差值，无需区分）
    if (deltaBytes <= 0) return

    for (let i = 1; i < chain.length; i++) {
      const parent = nodeIndexMap.get(`${taskId}::${chain[i]}`)
      if (!parent) continue

      const folderSize = parent.size || 0
      const newParentTransferred = (parent.transferredBytes || 0) + deltaBytes

      let folderSpeed = 0
      if (newParentTransferred > 0 && parent.startTime) {
        const elapsed = (Date.now() - parent.startTime) / 1000
        folderSpeed = elapsed > 0 ? Math.round(newParentTransferred / elapsed) : 0
      }

      console.log(
          `[sftpTransfer] [version= ${version.value }]🕐 祖先传播 transferBytes | ` +
          `path=${parent.remotePath} ` +
          `transferredBytes=${newParentTransferred} ` +
          `chain=${chain.length}`
        )
      Object.assign(parent, {
        transferredBytes: newParentTransferred,
        progress: folderSize > 0 ? Math.round((newParentTransferred / folderSize * 100)) : 0,
        speed: folderSpeed
      })
    }
  }

  /**
   * 初始化任务节点索引（扫描完成后、设置 root 后调用一次即可）
   * 
   * @param taskId 任务 ID
   */
  function initNodeIndex(taskId: string): void {
    const task = transferTasks.value.find(t => t.id === taskId)
    if (!task || !task.root) return

    buildNodeIndex(taskId, task.root)

    console.log(`[sftpTransfer] 🔨 索引初始化完成: taskId=${taskId}, 根节点="${task.root.name}"`)
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
    
    if (!task.root) return
    
    // 在树中查找并更新目标节点
    const updated = updateNodeInTree(task.root, nodeId, updates, taskId)
    
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
    updates: Partial<TransferNode>,
    taskId: string
  ): boolean {
    if (node.id === nodeId) {
      /** 终态保护：使用 Node FSM 校验节点状态转换合法性 */
      if ('status' in updates && !shouldAllowNodeTransition(node, (updates as any).status, 'updateNodeInTree')) {
        return false
      }
      // 找到目标节点，应用更新
      Object.assign(node, updates)
      return true
    }
    
    // 递归搜索子节点
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        if (updateNodeInTree(child, nodeId, updates, taskId)) {
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
      if (task.root) {
        setNodeExpandedRecursive(task.root, expanded)
      }
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
   * 打印树形结构（调试用，输出到控制台）
   * 
   * 以缩进树形格式打印任务的所有节点信息，
   * 包括节点名称、类型、状态、进度、大小等关键属性
   * 
   * @param taskId 任务 ID（不传则打印所有任务的树）
   * @param maxDepth 最大递归深度，防止过深树导致输出过长，默认 10
   */
  function printTree(taskId?: string, maxDepth: number = 10): void {
    const tasksToPrint = taskId 
      ? transferTasks.value.filter(t => t.id === taskId)
      : transferTasks.value.filter(t => t.root)

    for (const task of tasksToPrint) {
      console.log(`%c📦 任务: ${task.id} | 状态=${task.status} | 类型=${task.type}`, 'color: #2196F3; font-weight: bold')
      if (task.root) {
        printNodeRecursive(task.root, '', 0, maxDepth)
      } else {
        console.log('   (root 为空，可能正在扫描中)')
      }
      console.log('')
    }
  }

  /**
   * 递归打印单个节点的树形结构
   * @param node 当前节点
   * @param prefix 缩进前缀字符串
   * @param depth 当前深度
   * @param maxDepth 最大允许深度
   */
  function printNodeRecursive(node: TransferNode, prefix: string, depth: number, maxDepth: number): void {
    if (depth > maxDepth) {
      console.log(`${prefix}... (depth > ${maxDepth}, 截断)`)
      return
    }

    const icon = node.isDirectory ? '📁' : '📄'
    const statusIcon: Record<string, string> = {
      pending: '⏳',
      scanning: '🔍',
      transferring: '🔄',
      completed: '✅',
      error: '❌',
      cancelled: '🚫'
    }
    
    const sizeStr = node.size != null ? formatSize(node.size) : '-'
    const transferredStr = node.transferredBytes != null ? formatSize(node.transferredBytes) : '-'
    const progressStr = node.progress != null ? `${node.progress}%` : '-'

    console.log(
      `${prefix}${icon} ${node.name} ` +
      `[${statusIcon[node.status] || node.status}] ` +
      `progress=${progressStr} ` +
      `size=${sizeStr} ` +
      `transferred=${transferredStr}`
    )

    if (node.children && node.children.length > 0) {
      const childPrefix = prefix + '│  '
      const lastPrefix = prefix + '└── '
      const midPrefix = prefix + '├── '
      
      node.children.forEach((child, index) => {
        const isLast = index === node.children!.length - 1
        const currentPrefix = isLast ? lastPrefix : midPrefix
        const nextPrefix = isLast ? childPrefix.replace('│', ' ') : childPrefix
        
        // 临时替换前缀来打印当前子行，然后用 nextPrefix 继续递归
        printNodeRecursiveWithPrefix(child, currentPrefix, nextPrefix, depth + 1, maxDepth)
      })
    }
  }

  /**
   * 带自定义前缀的递归打印辅助函数
   * @param node 当前节点
   * @param displayPrefix 显示前缀（当前行的缩进）
   * @param childPrefix 子节点前缀（下一层级的缩进）
   * @param depth 当前深度
   * @param maxDepth 最大允许深度
   */
  function printNodeRecursiveWithPrefix(
    node: TransferNode, 
    displayPrefix: string, 
    childPrefix: string,
    depth: number, 
    maxDepth: number
  ): void {
    if (depth > maxDepth) {
      console.log(`${displayPrefix}... (depth > ${maxDepth})`)
      return
    }

    const icon = node.isDirectory ? '📁' : '📄'
    const statusIcon: Record<string, string> = {
      pending: '⏳',
      scanning: '🔍',
      transferring: '🔄',
      completed: '✅',
      error: '❌',
      cancelled: '🚫'
    }
    
    const sizeStr = node.size != null ? formatSize(node.size) : '-'
    const transferredStr = node.transferredBytes != null ? formatSize(node.transferredBytes) : '-'
    const progressStr = node.progress != null ? `${node.progress}%` : '-'

    console.log(
      `${displayPrefix}${icon} ${node.name} ` +
      `[${statusIcon[node.status] || node.status}] ` +
      `progress=${progressStr} size=${sizeStr} transferred=${transferredStr}`
    )

    if (node.children && node.children.length > 0) {
      node.children.forEach((child, index) => {
        const isLast = index === node.children!.length - 1
        const nextDisplayPrefix = childPrefix + (isLast ? '└── ' : '├── ')
        const nextChildPrefix = childPrefix + (isLast ? '    ' : '│   ')
        printNodeRecursiveWithPrefix(child, nextDisplayPrefix, nextChildPrefix, depth + 1, maxDepth)
      })
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
   * 取消所有选中的任务（仅限 pending、scanning 和 transferring 状态）
   * 将选中的可取消任务及其所有子节点状态更新为 cancelled
   * 
   * 覆盖两种场景：
   * - 有 root（真实节点树）：递归标记所有子节点为 cancelled
   * - 无 root（扫描中占位）：标记 scanningNode.status 为 cancelled
   */
  function cancelSelectedTasks(): void {
    const taskIdsToCancel = Array.from(selectedTaskIds.value)
    
    for (const taskId of taskIdsToCancel) {
      const taskIndex = transferTasks.value.findIndex(t => t.id === taskId)
      if (taskIndex === -1) continue
      
      const task = transferTasks.value[taskIndex]
      
      // 取消可取消的任务：pending（待开始）、scanning（扫描中）、transferring（传输中）
      if (task.status === 'pending' || task.status === 'scanning' || task.status === 'transferring') {
        // 更新任务状态为 cancelled
        updateTaskStatus(taskId, 'cancelled')
        
        if (task.root) {
          // 场景1：有真实节点树 → 递归标记所有子节点为 cancelled
          markAllNodesCancelled(task.root, taskId)
        } else if (task.scanningNode) {
          // 场景2：扫描中无 root → 标记占位节点为 cancelled（让 UI 显示已取消状态）
          updateTask(taskId, { scanningNode: { ...task.scanningNode, status: 'cancelled' } })
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
    initNodeIndex,          // 扫描后初始化节点索引（只需调用一次）

    updateNodeStatus,       // 兼容旧接口（树遍历查找）
    // 其他方法
    removeTask,
    clearCompletedTasks,
    clearAllTasks,
    getTask,
    getNode,                // 获取指定任务的指定节点最新状态（实时数据）
    setAllNodesExpanded,
    printTree,              // 打印树形结构（调试用）
    // ========== 任务选中相关方法 ==========
    toggleTaskSelection,     // 切换任务选中状态
    cancelSelectedTasks,     // 取消选中的任务
    clearSelectedTasks       // 清空选中状态
  }
})
