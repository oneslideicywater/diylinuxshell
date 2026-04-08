/**
 * SFTP 状态容器组件
 * 显示文件传输和删除操作的状态信息
 * @module components/session/sftp/SftpStatusContainer
 */

<template>
  <div class="sftp-footer-container">
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
      <div class="footer-status">
        <!-- 删除状态 -->
        <span v-if="currentStatus === 'deleting'" class="status-deleting">
          删除中：{{ currentPath }}
        </span>
        <!-- 传输中（通用） -->
        <span v-else-if="currentStatus === 'transferring'" class="status-transferring">
          传输中...
        </span>
        <!-- 就绪状态 -->
        <span v-else class="status-ready">就绪</span>
        
        <!-- 展开/折叠按钮 -->
        <button 
          v-if="hasActiveTransfers" 
          class="toggle-tree-btn" 
          @click="toggleTree"
          :title="showTree ? '折叠传输详情' : '展开传输详情'"
        >
          <svg v-if="showTree" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M10.5 5.25L7 8.75L3.5 5.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5.25 3.5L8.75 7L5.25 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 树形传输详情 -->
    <div v-if="showTree && hasActiveTransfers" class="tree-panel" :style="{ height: treePanelHeight + 'px' }">
      <!-- 工具栏：全部展开/全部折叠按钮 -->
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
      </div>
      
      <!-- 拖拽手柄 -->
      <div class="resize-handle" @mousedown="startResize">
        <svg width="16" height="4" viewBox="0 0 16 4" fill="none">
          <circle cx="3" cy="2" r="1.5" fill="currentColor"/>
          <circle cx="8" cy="2" r="1.5" fill="currentColor"/>
          <circle cx="13" cy="2" r="1.5" fill="currentColor"/>
        </svg>
      </div>
      
      <!-- 传输任务列表 -->
      <div class="tasks-content">
        <!-- 传输任务 -->
        <SftpTaskStatus
          v-for="task in allTasks"
          :key="task.id"
          :task-nodes="task.nodes"
          @update:node-expanded="handleNodeExpanded"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import SftpTaskStatus from './SftpTaskStatus.vue'
import type { TransferTask, TransferNode, DeleteTask } from '@shared/types/sftp'
import { deleteTaskToTransferNode } from '../script/deleteManager'

/**
 * Props 定义
 */
interface Props {
  /** 本地文件数量 */
  localFileCount: number
  /** 远程文件数量 */
  remoteFileCount: number
  /** 当前操作的文件路径 */
  currentPath?: string
  /** 传输任务列表 */
  transferTasks?: TransferTask[]
  /** 删除任务列表 */
  deleteTasks?: DeleteTask[]
}

const props = withDefaults(defineProps<Props>(), {
  localFileCount: 0,
  remoteFileCount: 0,
  currentPath: '',
  transferTasks: () => [],
  deleteTasks: () => []
})

/**
 * 树形面板展开状态
 */
const showTree = ref(false)

/**
 * 树形面板高度
 */
const treePanelHeight = ref(500) // 默认 500px（原 300px + 200px）

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
  
  const container = document.querySelector('.sftp-footer-container')
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
 * 合并所有任务为统一的 TransferTask 格式
 */
const allTasks = computed<TransferTask[]>(() => {
  const tasks: TransferTask[] = []
  
  // 添加传输任务
  if (props.transferTasks && props.transferTasks.length > 0) {
    tasks.push(...props.transferTasks)
  }
  
  // 将删除任务转换为 TransferTask 格式
  if (props.deleteTasks && props.deleteTasks.length > 0) {
    const deleteTasksAsTransferTasks: TransferTask[] = props.deleteTasks.map(task => ({
      id: task.id,
      type: 'delete' as const,
      status: task.status as TransferTask['status'],
      nodes: [deleteTaskToTransferNode(task)],
      totalBytes: 0,
      transferredBytes: 0,
      remainingTime: 0,
      elapsedTime: task.endTime && task.startTime ? Math.round((task.endTime - task.startTime) / 1000) : 0,
      createdAt: task.startTime,
      completedAt: task.endTime,
      error: task.error
    }))
    tasks.push(...deleteTasksAsTransferTasks)
  }
  
  return tasks
})

/**
 * 当前状态（计算属性）
 */
const currentStatus = computed<('ready' | 'transferring' | 'deleting')>(() => {
  // 检查是否有删除任务
  if (props.deleteTasks && props.deleteTasks.length > 0) {
    const hasDeleting = props.deleteTasks.some(task => 
      task.status === 'deleting' || 
      task.status === 'pending' ||
      task.status === 'completed' ||
      task.status === 'failed'
    )
    if (hasDeleting) return 'deleting'
  }
  
  // 检查是否有传输任务
  if (props.transferTasks && props.transferTasks.length > 0) {
    const hasTransferring = props.transferTasks.some(task => 
      task.status === 'active' || 
      task.status === 'pending' ||
      task.status === 'completed'
    )
    if (hasTransferring) return 'transferring'
  }
  
  return 'ready'
})

/**
 * 是否有活跃的传输
 */
const hasActiveTransfers = computed(() => {
  return currentStatus.value !== 'ready'
})

/**
 * 切换树形面板显示
 */
function toggleTree(): void {
  showTree.value = !showTree.value
}

/**
 * 处理节点展开状态变化
 */
function handleNodeExpanded(nodeId: string, expanded: boolean): void {
  // 事件向上传递给父组件，由父组件处理状态更新
  // 父组件会通过 props.transferTasks 传递新的数据
}

/**
 * 递归设置节点的展开状态（在所有任务中）
 */
function setNodeExpanded(tasks: TransferTask[], expanded: boolean): void {
  for (const task of tasks) {
    for (const node of task.nodes) {
      node.expanded = expanded
      if (node.children && node.children.length > 0) {
        setNodeExpandedInChildren(node.children, expanded)
      }
    }
  }
}

/**
 * 在子节点中递归设置展开状态
 */
function setNodeExpandedInChildren(nodes: TransferNode[], expanded: boolean): void {
  for (const node of nodes) {
    node.expanded = expanded
    if (node.children && node.children.length > 0) {
      setNodeExpandedInChildren(node.children, expanded)
    }
  }
}

/**
 * 全部展开
 */
function expandAllNodes(): void {
  setNodeExpanded(props.transferTasks, true)
}

/**
 * 全部折叠
 */
function collapseAllNodes(): void {
  setNodeExpanded(props.transferTasks, false)
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
  color: var(--text-color-secondary, #999999);
  font-weight: 500;
}

.footer-value {
  color: var(--text-color, #333333);
  font-weight: 500;
}

.footer-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 状态样式 */
.status-ready {
  color: var(--text-color-secondary, #999999);
}

.status-transferring {
  color: var(--primary-color, #409eff);
  animation: pulse 1.5s infinite;
}

.status-uploading {
  color: var(--primary-color, #409eff);
  animation: pulse 1.5s infinite;
}

.status-downloading {
  color: var(--primary-color, #409eff);
  animation: pulse 1.5s infinite;
}

.status-deleting {
  color: var(--danger-color, #f56c6c);
  animation: pulse 1.5s infinite;
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
  color: var(--text-color-secondary, #999999);
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
  overflow-x: hidden;
}

/* 拖拽手柄 */
.resize-handle {
  height: 12px;
  cursor: row-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-color-secondary, #666666);
  background: linear-gradient(to bottom, var(--bg-color-secondary, rgba(0, 0, 0, 0.05)), transparent);
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

/* 树形工具栏 */
.tree-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  background: var(--bg-color-secondary, #f5f5f5);
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
</style>
