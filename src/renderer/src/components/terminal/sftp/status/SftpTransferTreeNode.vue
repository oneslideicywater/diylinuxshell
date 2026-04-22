/**
 * SFTP 传输树节点组件
 * 显示单个文件传输状态，支持树形缩进
 * 
 * 重构说明：
 * - 静态字段（name、size、path 等）从 props 获取（不变）
 * - 动态字段（speed、progress、status、time）从 Pinia Store 直接读取（实时响应）
 * - 通过 taskId + nodeId 在 Store 树中定位最新节点状态
 * @module components/session/sftp/SftpTransferTreeNode
 */

<template>
  <div class="tree-node">
    <!-- 节点内容 -->
    <div v-if="node" class="node-row" :class="{ 'is-folder': node.isDirectory, 'is-error': liveStatus === 'error' }">
      <!-- 复选框占位列（与表头对齐） -->
      <div class="column checkbox-column">
        <span class="checkbox-placeholder"></span>
      </div>

      <!-- 名称列（根据层级动态调整左侧缩进） -->
      <div class="column name-column" :style="{ paddingLeft: (level * 20) + 'px' }">
        <!-- 文件夹展开/折叠图标 -->
        <span v-if="node.isDirectory" class="expand-icon" @click="toggleExpand">
          <svg v-if="isExpanded" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </span>
        <!-- 文件的占位图标（不可见，用于保持与文件夹的对齐） -->
        <span v-else class="expand-placeholder">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"></svg>
        </span>
        <!-- 文件类型图标 -->
        <span class="file-icon" :class="{ 'is-folder': node.isDirectory }">
          <svg v-if="node.isDirectory" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M14 13.5C14 14.3284 13.3284 15 12.5 15H3.5C2.67157 15 2 14.3284 2 13.5V5.5C2 4.67157 2.67157 4 3.5 4H6.5L7.5 5H12.5C13.3284 5 14 5.67157 14 6.5V13.5Z" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M9 1H4C2.89543 1 2 1.89543 2 3V13C2 14.1046 2.89543 15 4 15H12C13.1046 15 14 14.1046 14 13V6L9 1Z" stroke="currentColor" stroke-width="1.5"/>
            <path d="M9 1V6H14" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </span>
        <!-- 文件名 -->
        <span class="file-name" :title="node.name">
          {{ node.name }}
          <!-- 如果是文件夹且有总文件数信息，显示总体进度 -->
          <span v-if="node.isDirectory && node.totalFiles !== undefined" class="folder-progress">
            ({{ liveCompletedFiles || 0 }}/{{ node.totalFiles }})
          </span>
        </span>
      </div>

      <!-- 状态列（从 Store 实时读取） -->
      <div class="column status-column">
        <span :class="'status-' + liveStatus">{{ statusText }}</span>
      </div>

      <!-- 进度列（从 Store 实时读取） -->
      <div class="column progress-column">
        <div v-if="liveStatus === 'transferring' || liveStatus === 'pending'" class="progress-bar">
          <div class="progress-fill" :style="{ width: liveProgress + '%' }"></div>
        </div>
        <div v-else-if="liveStatus === 'scanning'" class="scanning-indicator">
          <span class="scanning-dot"></span>
          <span>扫描中...</span>
        </div>
        <span v-else-if="liveStatus === 'completed'" class="progress-percent">100%</span>
        <span v-else class="progress-percent">-</span>
      </div>

      <!-- 大小列（静态，从 props 获取） -->
      <div class="column size-column">
        {{ formatSize(node.size) }}
      </div>

      <!-- 本地路径列（静态） -->
      <div class="column local-path-column" :title="node.localPath">
        {{ node.localPath || '-' }}
      </div>

      <!-- 箭头列（静态） -->
      <div class="column arrow-column">
        {{ node.type === 'upload' ? '→' : (node.type === 'download' ? '←' : '×') }}
      </div>

      <!-- 远程路径列（静态） -->
      <div class="column remote-path-column" :title="node.remotePath">
        {{ node.remotePath || '-' }}
      </div>

      <!-- 速度列（从 Store 实时读取） -->
      <div class="column speed-column">
        {{ formatSpeed(liveSpeed) }}
      </div>

      <!-- 估计剩余列（从 Store 实时读取） -->
      <div class="column remaining-column">
        {{ liveRemaining }}
      </div>

      <!-- 经过时间列（从 Store 实时读取） -->
      <div class="column elapsed-column">
        {{ liveElapsed }}
      </div>
    </div>

    <!-- 子节点 -->
    <div v-if="node.isDirectory && isExpanded && node.children && node.children.length > 0" class="children">
      <SftpTransferTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :task-id="taskId"
        :level="level + 1"
        @update:node-expanded="handleChildExpanded"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { TransferNode } from '@shared/types/sftp'
import { formatSize, formatSpeed } from '@/utils/fs-utils'
import { formatTime } from '../script/utils'
import { getStatusText } from '../script/statusText'
import { useSftpTransferStore } from '@/stores/sftpTransfer'

/**
 * 组件名称（用于递归调用）
 */
defineOptions({
  name: 'SftpTransferTreeNode'
})

/**
 * Props 定义
 */
interface Props {
  /** 传输节点（提供静态信息：name、size、path、children 结构等） */
  node: TransferNode
  /** 缩进层级 */
  level: number
  /** 任务 ID（用于从 Pinia Store 查询实时动态数据） */
  taskId: string
}

const props = defineProps<Props>()

const sftpTransferStore = useSftpTransferStore()

/**
 * 定时刷新计数器
 * 通过 setInterval 定时递增，驱动 liveNode 等 computed 强制重算
 * 解决 mutateNode 直接变异响应式对象时部分 computed 不触发的问题
 */
const refreshTick = ref(0)
let refreshTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  // 每 500ms 强制刷新一次，确保传输中的节点实时显示速度/进度/时间
  refreshTimer = setInterval(() => {
    refreshTick.value++
  }, 500)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})

/**
 * 从 Store 中查找当前节点的最新状态
 * 依赖 refreshTick 确保定时重算，即使底层 reactive 对象的属性被直接变异也能感知变化
 */
const liveNode = computed((): TransferNode | undefined => {
  void refreshTick.value  // 触发依赖收集
  return sftpTransferStore.getNode(props.taskId, props.node.id)
})

/** 实时速度（字节/秒） */
const liveSpeed = computed(() => liveNode.value?.speed ?? 0)

/** 实时进度百分比 */
const liveProgress = computed(() => liveNode.value?.progress ?? 0)

/** 实时状态 */
const liveStatus = computed(() => liveNode.value?.status ?? props.node.status)

/** 实时剩余时间（根据 size/TransferredBytes/speed 计算） */
const liveRemaining = computed(() => {
  const node = liveNode.value
  if (!node) return ''
  const { size = 0, transferredBytes = 0, speed = 0 } = node
  if (speed <= 0 || size <= transferredBytes) return ''
  return formatTime(Math.ceil((size - transferredBytes) / speed))
})

/** 实时经过时间（根据 TransferredBytes/speed 或 startTime 计算） */
const liveElapsed = computed(() => {
  const node = liveNode.value
  if (!node) return ''
  if (node.startTime) return formatTime(Math.round((Date.now() - node.startTime) / 1000))
  const { transferredBytes = 0, speed = 0 } = node
  if (speed <= 0 || transferredBytes <= 0) return ''
  return formatTime(Math.ceil(transferredBytes / speed))
})

/** 已完成文件数（文件夹专用） */
const liveCompletedFiles = computed(() => liveNode.value?.completedFiles ?? 0)

/**
 * 获取节点的展开状态（默认为 false，即默认折叠）
 */
const isExpanded = computed(() => {
  return props.node.expanded ?? false
})

/**
 * 定义组件事件
 */
const emit = defineEmits<{
  /** 展开状态变化事件（包含节点 ID） */
  (e: 'update:node-expanded', nodeId: string, expanded: boolean): void
}>()

/**
 * 切换展开/折叠状态
 * 触发父组件的 update 事件来更新节点状态
 */
function toggleExpand(): void {
  emit('update:node-expanded', props.node.id, !isExpanded.value)
}

/**
 * 处理子节点的展开状态变化
 * 将事件向上传递给父组件
 */
function handleChildExpanded(nodeId: string, expanded: boolean): void {
  emit('update:node-expanded', nodeId, expanded)
}

/**
 * 状态文本（根据任务类型和实时状态动态显示）
 */
const statusText = computed(() => {
  return getStatusText(props.node.type, liveStatus.value)
})
</script>

<style scoped>
/* 树节点容器 */
.tree-node {
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

/* 节点行 */
.node-row {
  display: flex;
  align-items: center;
  padding: 6px 0;
  transition: background 0.2s;
}

.node-row:hover {
  background: var(--hover-bg, rgba(255, 255, 255, 0.05));
}

.node-row.is-folder {
  font-weight: 500;
}

.node-row.is-error {
  color: var(--danger-color, #f56c6c);
}

/* 列样式 */
.column {
  padding: 6px 12px;
  display: flex;
  align-items: center;
}

/* 复选框占位列（与表头对齐） */
.checkbox-column {
  width: 40px;
  min-width: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox-placeholder {
  display: inline-block;
  width: 14px;
  height: 14px;
}

.name-column {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 400px;
  min-width: 400px;
  flex-shrink: 0;
}

.expand-icon {
  cursor: pointer;
  display: flex;
  align-items: center;
  color: var(--text-color-secondary, #666666);
  flex-shrink: 0;
}

.expand-icon:hover {
  color: var(--text-color, #333333);
}

/* 文件节点的占位图标（与展开/折叠图标同尺寸，保持对齐） */
.expand-placeholder {
  display: flex;
  align-items: center;
  visibility: hidden;
  flex-shrink: 0;
}

.file-icon {
  display: flex;
  align-items: center;
  color: var(--primary-color, #409eff);
}

.file-icon.is-folder {
  color: var(--warning-color, #e6a23c);
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 6px;
}

.folder-progress {
  font-size: 11px;
  color: var(--text-color-secondary, #999999);
  font-weight: normal;
}

.status-column {
  width: 100px;
  min-width: 100px;
  flex-shrink: 0;
}

.progress-column {
  width: 150px;
  min-width: 150px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.size-column {
  width: 120px;
  min-width: 120px;
  flex-shrink: 0;
}

.local-path-column {
  flex: 1;
  min-width: 200px;
  color: var(--text-color-secondary, #999999);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow-column {
  width: 40px;
  min-width: 40px;
  flex-shrink: 0;
  text-align: center;
  font-weight: bold;
}

.remote-path-column {
  flex: 1;
  min-width: 200px;
  color: var(--text-color-secondary, #999999);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.speed-column {
  width: 100px;
  min-width: 100px;
  flex-shrink: 0;
}

.remaining-column {
  width: 80px;
  min-width: 80px;
  flex-shrink: 0;
}

.elapsed-column {
  width: 80px;
  min-width: 80px;
  flex-shrink: 0;
}

/* 状态样式 */
.status-pending {
  color: var(--text-color-secondary, #999999);
}

.status-transferring {
  color: var(--primary-color, #409eff);
}

.status-completed {
  color: var(--success-color, #67c23a);
}

.status-error {
  color: var(--danger-color, #f56c6c);
}

.status-cancelled {
  color: var(--text-color-secondary, #999999);
  text-decoration: line-through;
}

.status-scanning {
  color: var(--warning-color, #e6a23c);
}

/* 进度条 */
.progress-bar {
  width: 100%;
  height: 6px;
  background: var(--bg-color, #ffffff);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color, #409eff);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-percent {
  font-size: 11px;
  color: var(--text-color-secondary, #999999);
}

/* 扫描中指示器 */
.scanning-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--warning-color, #e6a23c);
}

.scanning-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--warning-color, #e6a23c);
  animation: scanning-pulse 1s ease-in-out infinite;
}

@keyframes scanning-pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

/* 子节点容器 */
.children {
  border-top: 1px dashed var(--border-color, #e0e0e0);
}
</style>
