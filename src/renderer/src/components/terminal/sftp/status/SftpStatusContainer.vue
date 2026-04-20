/**
 * SFTP 状态容器组件
 * 显示文件传输和删除操作的状态信息
 * @module components/session/sftp/SftpStatusContainer
 */

<template>
  <div class="sftp-footer-container" ref="containerRef">
    <!-- 简化状态栏 -->
    <div class="sftp-footer">
      <div class="footer-item">
        <span class="footer-label">本地:</span>
        <span class="footer-value">{{ localFileCount }} 个项目</span>
      </div>
      <div class="footer-item">
        <span class="footer-label">远程:</span>
        <span class="footer-value">{{ remoteFileCount }} 个项目</span>
      </div>
    </div>

    <!-- 树形传输详情 -->
    <div class="tree-panel" :style="{ height: treePanelHeight + 'px' }">
      <!-- 拖拽手柄 -->
      <div class="resize-handle" @mousedown="startResize">
        <svg width="16" height="4" viewBox="0 0 16 4" fill="none">
          <circle cx="3" cy="2" r="1.5" fill="currentColor"/>
          <circle cx="8" cy="2" r="1.5" fill="currentColor"/>
          <circle cx="13" cy="2" r="1.5" fill="currentColor"/>
        </svg>
      </div>

      <!-- 工具栏：全部展开/全部折叠/状态筛选按钮 -->
      <div class="tree-toolbar">
        <button class="toolbar-btn" @click="expandAllNodes" title="全部展开">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M10.5 5.25L7 8.75L3.5 5.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>全部展开</span>
        </button>
        <button class="toolbar-btn" @click="collapseAllNodes" title="全部折叠">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5.25 3.5L8.75 7L5.25 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>全部折叠</span>
        </button>
        
        <!-- 取消选中任务按钮 -->
        <button 
          class="toolbar-btn cancel-btn" 
          @click="handleCancelSelectedTasks"
          :disabled="!hasSelectedCancellableTasks"
          title="取消选中的任务"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>取消选中</span>
        </button>
        
        <!-- 状态筛选下拉菜单 -->
        <div class="filter-dropdown" ref="filterDropdownRef">
          <button 
            class="toolbar-btn filter-btn" 
            @click="toggleFilterDropdown"
            title="状态筛选"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 2h12l-4.5 6v4l-3 1.5V8L1 2z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>{{ currentFilterLabel }}</span>
            <svg width="10" height="6" viewBox="0 0 10 6" class="dropdown-arrow" :class="{ 'is-open': showFilterDropdown }">
              <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          
          <!-- 下拉菜单内容：显示全部5种状态 -->
          <div v-show="showFilterDropdown" class="dropdown-menu">
            <div 
              class="dropdown-item"
              :class="{ 'is-active': taskFilter === 'pending' }"
              @click="setTaskFilter('pending')"
            >
              <span class="item-icon">⏸️</span>
              <span class="item-text">待开始</span>
              <span class="item-count">{{ pendingCount }}</span>
            </div>
            <div 
              class="dropdown-item"
              :class="{ 'is-active': taskFilter === 'transferring' }"
              @click="setTaskFilter('transferring')"
            >
              <span class="item-icon">⏳</span>
              <span class="item-text">传输中</span>
              <span class="item-count">{{ transferringCount }}</span>
            </div>
            <div 
              class="dropdown-item"
              :class="{ 'is-active': taskFilter === 'completed' }"
              @click="setTaskFilter('completed')"
            >
              <span class="item-icon">✅</span>
              <span class="item-text">已完成</span>
              <span class="item-count">{{ completedCount }}/{{ MAX_COMPLETED_TASKS }}</span>
            </div>
            <div 
              class="dropdown-item"
              :class="{ 'is-active': taskFilter === 'error' }"
              @click="setTaskFilter('error')"
            >
              <span class="item-icon">❌</span>
              <span class="item-text">错误</span>
              <span class="item-count">{{ errorCount }}</span>
            </div>
            <div 
              class="dropdown-item"
              :class="{ 'is-active': taskFilter === 'cancelled' }"
              @click="setTaskFilter('cancelled')"
            >
              <span class="item-icon">🚫</span>
              <span class="item-text">已取消</span>
              <span class="item-count">{{ cancelledCount }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 传输任务列表（使用 filteredTasks 显示过滤后的任务） -->
      <div class="tasks-content">
        <!-- 传输任务 -->
        <SftpTaskStatus
          v-for="task in filteredTasks"
          :key="task.id"
          :task-root="task.root"
          :task-id="task.id"
          @update:node-expanded="handleNodeExpanded"
        />
        
        <!-- 空状态提示（根据当前过滤器显示不同的提示信息） -->
        <div v-if="filteredTasks.length === 0" class="empty-state">
          <span class="empty-icon">{{ emptyStateIcon }}</span>
          <span class="empty-text">
            {{ emptyStateText }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'  // ✅ 新增导入
import SftpTaskStatus from './SftpTaskStatus.vue'
import { useSftpTransferStore } from '@/stores/sftpTransfer'
import type { TransferNode } from '@shared/types/sftp'

/**
 * 使用 SFTP 传输任务 Store
 */
const sftpTransferStore = useSftpTransferStore()

/**
 * Props 定义
 */
interface Props {
  /** 本地文件数量 */
  localFileCount: number
  /** 远程文件数量 */
  remoteFileCount: number
  /** SFTP 连接标识符（用于隔离不同连接的任务） */
  connectionId?: string
}

const props = withDefaults(defineProps<Props>(), {
  localFileCount: 0,
  remoteFileCount: 0,
  connectionId: ''
})

/**
 * ✅ 使用 storeToRefs 解构，保持响应性！
 * 这样解构出来的属性仍然是 ref，会随 Store 更新而更新
 */
const { 
  transferTasks,       // ← 使用完整的任务列表，在组件内根据过滤器筛选
  selectedTaskIds      // 选中的任务 ID 集合
} = storeToRefs(sftpTransferStore)

/**
 * 当前连接的传输任务（按 sftpConnectionId 过滤）
 * 如果没有指定 sftpConnectionId，则返回所有任务（兼容旧逻辑）
 */
const currentConnectionTasks = computed(() => {
  if (!props.connectionId) {
    return transferTasks.value
  }
  return transferTasks.value.filter(task => task.sftpConnectionId === props.connectionId)
})

// ========== 任务过滤相关逻辑 ==========

/** 已完成任务最大保留数量 */
const MAX_COMPLETED_TASKS = 100

/**
 * 任务过滤器类型（符合 TransferStatus 标准）
 * 支持5种状态：pending、transferring、completed、error、cancelled
 */
type TaskFilterType = 'pending' | 'transferring' | 'completed' | 'error' | 'cancelled'

/** 当前选中的过滤器类型（默认显示"传输中"状态） */
const taskFilter = ref<TaskFilterType>('transferring')

/** 下拉菜单是否显示 */
const showFilterDropdown = ref(false)

/** 下拉菜单 DOM 引用 */
const filterDropdownRef = ref<HTMLDivElement | null>(null)

/**
 * 当前过滤器的显示标签
 */
const currentFilterLabel = computed(() => {
  const labelMap: Record<TaskFilterType, string> = {
    'pending': '待开始',
    'transferring': '传输中',
    'completed': '已完成',
    'error': '错误',
    'cancelled': '已取消'
  }
  return labelMap[taskFilter.value]
})

/**
 * 过滤后的任务列表（用于实际渲染）
 * 根据当前选择的过滤器返回对应状态的任务
 * 排序：按创建时间降序（最新任务排在最前面）
 */
const filteredTasks = computed(() => {
  // 从当前连接任务列表中根据过滤器筛选
  return currentConnectionTasks.value
    .filter(task => task.status === taskFilter.value)
    .sort((a, b) => b.createdAt - a.createdAt)  // 按创建时间降序排列
})

/**
 * 待开始任务的数量
 */
const pendingCount = computed(() => {
  return currentConnectionTasks.value.filter(task => task.status === 'pending').length
})

/**
 * 传输中任务的数量
 */
const transferringCount = computed(() => {
  return currentConnectionTasks.value.filter(task => task.status === 'transferring').length
})

/**
 * 已完成任务的数量
 */
const completedCount = computed(() => {
  return currentConnectionTasks.value.filter(task => task.status === 'completed').length
})

/**
 * 错误任务的数量
 */
const errorCount = computed(() => {
  return currentConnectionTasks.value.filter(task => task.status === 'error').length
})

/**
 * 已取消任务的数量
 */
const cancelledCount = computed(() => {
  return currentConnectionTasks.value.filter(task => task.status === 'cancelled').length
})

/**
 * 空状态图标（根据当前过滤器显示不同的图标）
 */
const emptyStateIcon = computed((): string => {
  const iconMap: Record<TaskFilterType, string> = {
    'pending': '⏸️',
    'transferring': '⏳',
    'completed': '✅',
    'error': '❌',
    'cancelled': '🚫'
  }
  return iconMap[taskFilter.value]
})

/**
 * 空状态提示文本（根据当前过滤器显示不同的提示信息）
 */
const emptyStateText = computed((): string => {
  const textMap: Record<TaskFilterType, string> = {
    'pending': '暂无待开始的任务',
    'transferring': '暂无传输中的任务',
    'completed': '暂无已完成的任务',
    'error': '暂无错误任务',
    'cancelled': '暂无已取消的任务'
  }
  return textMap[taskFilter.value]
})

/**
 * 切换下拉菜单显示/隐藏
 */
function toggleFilterDropdown(): void {
  showFilterDropdown.value = !showFilterDropdown.value
}

/**
 * 设置任务过滤器
 * @param filter 过滤器类型
 */
function setTaskFilter(filter: TaskFilterType): void {
  taskFilter.value = filter
  showFilterDropdown.value = false
}

/**
 * 点击外部关闭下拉菜单
 */
function handleClickOutside(event: MouseEvent): void {
  if (filterDropdownRef.value && !filterDropdownRef.value.contains(event.target as Node)) {
    showFilterDropdown.value = false
  }
}

/**
 * 组件挂载时添加全局点击事件监听
 */
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

/**
 * 组件卸载时移除全局点击事件监听
 */
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

/**
 * 监控 transferTasks 变化，用于调试
 */
watch(transferTasks, (newVal) => {
  console.log('[SftpStatusContainer] 📊 transferTasks 变化:', {
    taskCount: newVal.length,
    tasks: newVal.map(t => ({
      id: t.id,
      status: t.status,
      type: t.type,
      hasRoot: !!t.root,
      rootName: t.root?.name,
      rootChildrenCount: t.root?.children?.length || 0
    }))
  })
}, { deep: true, immediate: true })

/**
 * 监控 filteredTasks 变化，用于调试
 */
watch(filteredTasks, (newVal) => {
  console.log('[SftpStatusContainer] 🔍 filteredTasks (当前过滤器: ' + taskFilter.value + '):', {
    taskCount: newVal.length
  })
}, { immediate: true })

/**
 * 组件容器 DOM 引用（用于拖拽计算）
 */
const containerRef = ref<HTMLDivElement | null>(null)

/**
 * 树形面板高度
 */
const treePanelHeight = ref(500) // 默认 500px

/**
 * 最小高度
 */
const MIN_HEIGHT = 200

/**
 * 最大高度
 */
const MAX_HEIGHT = 800

/**
 * 是否正在拖拽
 */
let isResizing = false

/**
 * 开始拖拽
 */
function startResize(): void {
  isResizing = true
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
}

/**
 * 处理拖拽
 */
function handleResize(event: MouseEvent): void {
  if (!isResizing) return
  
  // ✅ 使用组件内部的 ref 引用，而不是全局 querySelector
  const container = containerRef.value
  if (!container) return
  
  const rect = container.getBoundingClientRect()
  const newHeight = rect.bottom - event.clientY
  
  // 限制高度范围
  if (newHeight >= MIN_HEIGHT && newHeight <= MAX_HEIGHT) {
    treePanelHeight.value = newHeight
  }
}

/**
 * 停止拖拽
 */
function stopResize(): void {
  isResizing = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

/**
 * 处理节点展开状态变化
 * 通过 Store 更新指定节点的展开状态
 */
function handleNodeExpanded(nodeId: string, expanded: boolean): void {
  // 遍历当前连接的所有任务，找到包含该节点的任务并更新其展开状态
  for (const task of currentConnectionTasks.value) {
    if (task.root && findNodeInTree(task.root, nodeId)) {
      // 找到任务，使用 Store API 更新节点状态
      sftpTransferStore.updateNodeStatus(task.id, nodeId, { expanded })
      console.log(`[SftpStatusContainer] Node ${nodeId} ${expanded ? 'expanded' : 'collapsed'} (Task: ${task.id})`)
      break
    }
  }
}

/**
 * 在树形结构中递归查找节点
 * @param node 当前节点
 * @param nodeId 目标节点 ID
 * @returns 是否找到节点
 */
function findNodeInTree(node: TransferNode, nodeId: string): boolean {
  if (node.id === nodeId) {
    return true
  }
  
  // 递归搜索子节点
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      if (findNodeInTree(child, nodeId)) {
        return true
      }
    }
  }
  
  return false
}

/**
 * 全部展开（调用 Store 方法）
 */
function expandAllNodes(): void {
  sftpTransferStore.setAllNodesExpanded(true)
}

/**
 * 全部折叠（调用 Store 方法）
 */
function collapseAllNodes(): void {
  sftpTransferStore.setAllNodesExpanded(false)
}

/**
 * 是否有选中的可取消任务（pending 或 transferring 状态）
 */
const hasSelectedCancellableTasks = computed((): boolean => {
  if (selectedTaskIds.value.size === 0) return false
  
  // 检查选中的任务中是否有可取消的任务
  for (const taskId of selectedTaskIds.value) {
    const task = transferTasks.value.find(t => t.id === taskId)
    if (task && (task.status === 'pending' || task.status === 'transferring')) {
      return true
    }
  }
  
  return false
})

/**
 * 处理取消选中的任务
 */
function handleCancelSelectedTasks(): void {
  if (!hasSelectedCancellableTasks.value) return
  
  // 调用 Store 方法取消选中的任务
  sftpTransferStore.cancelSelectedTasks()
  
  console.log('[SftpStatusContainer] 🚫 已取消选中的任务')
}


</script>

<style scoped>
/* 状态栏容器 */
.sftp-footer-container {
  display: flex;
  flex-direction: column;
}

/* 状态栏 */
.sftp-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--sidebar-bg, var(--bg-color, #ffffff));
  border-top: 1px solid var(--border-color, #e0e0e0);
  font-size: 12px;
}

.footer-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.footer-label {
  color: var(--text-secondary, var(--text-color, #999999));
  font-weight: 500;
}

.footer-value {
  color: var(--text-color, #333333);
  font-weight: 500;
}

/* 展开/折叠按钮 */
.toggle-tree-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  background: transparent;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-secondary, var(--text-color, #999999));
  transition: all 0.2s;
}

.toggle-tree-btn:hover {
  background: var(--hover-bg, #f0f0f0);
  color: var(--text-color, #333333);
}

/* 树形面板 */
.tree-panel {
  border-top: 1px solid var(--border-color, #e0e0e0);
  min-height: 200px;
  max-height: 800px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: slideDown 0.3s ease;
  position: relative;
}

/* 传输任务列表容器 */
.tasks-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;  /* 启用水平滚动 */
}

/* 拖拽手柄 */
.resize-handle {
  height: 12px;
  cursor: row-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-secondary, var(--text-color, #666666));
  background: linear-gradient(to bottom, var(--hover-bg, rgba(0, 0, 0, 0.05)), transparent);
  border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  transition: all 0.2s;
  flex-shrink: 0;
}

.resize-handle:hover {
  background: linear-gradient(to bottom, var(--hover-bg, rgba(255, 255, 255, 0.1)), transparent);
  border-bottom-color: var(--primary-color, #409eff);
}

.resize-handle svg {
  opacity: 0.6;
  transition: opacity 0.2s;
}

.resize-handle:hover svg {
  opacity: 1;
}

/* 树形工具栏 - 使用 --sidebar-bg 变量以支持主题切换 */
.tree-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  background: var(--sidebar-bg, var(--bg-color, #ffffff));
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--bg-color, #ffffff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-color, #333333);
  font-size: 12px;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: var(--hover-bg, #e8e8e8);
  border-color: var(--primary-color, #409eff);
  color: var(--primary-color, #409eff);
}

/* 取消按钮特殊样式 */
.cancel-btn:hover:not(:disabled) {
  background: #fee;
  border-color: #f56c6c;
  color: #f56c6c;
}

.cancel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ========== 下拉菜单样式 ========== */

/* 过滤下拉菜单容器 */
.filter-dropdown {
  position: relative;
  display: inline-block;
}

/* 过滤按钮 */
.filter-btn {
  position: relative;
}

/* 下拉箭头 */
.dropdown-arrow {
  margin-left: 2px;
  transition: transform 0.3s ease;
}

.dropdown-arrow.is-open {
  transform: rotate(180deg);
}

/* 下拉菜单 */
.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 160px;
  background: var(--bg-color, #ffffff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
  animation: fadeIn 0.2s ease;
}

/* 下拉菜单项 */
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-color, #333333);
  transition: all 0.2s;
  background: transparent;
}

.dropdown-item:hover {
  background: var(--hover-bg, #f0f0f0);
}

.dropdown-item.is-active {
  background: var(--primary-color-light, rgba(64, 158, 255, 0.1));
  color: var(--primary-color, #409eff);
}

/* 菜单项图标 */
.item-icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
}

/* 菜单项文本 */
.item-text {
  flex: 1;
  font-weight: 500;
}

/* 菜单项计数 */
.item-count {
  font-size: 11px;
  color: var(--text-secondary, var(--text-color, #999999));
  background: var(--hover-bg, rgba(0, 0, 0, 0.05));
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 500;
}

.dropdown-item.is-active .item-count {
  background: var(--primary-color, #409eff);
  color: #ffffff;
}

/* 空状态提示 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-secondary, var(--text-color, #999999));
  gap: 12px;
}

.empty-icon {
  font-size: 32px;
  opacity: 0.5;
}

.empty-text {
  font-size: 13px;
  font-weight: 500;
}
</style>
