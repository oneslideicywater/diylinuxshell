/**
 * SFTP 传输树节点组件
 * 显示单个文件传输状态，支持树形缩进
 * @module components/session/sftp/SftpTransferTreeNode
 */

<template>
  <div class="tree-node" :style="{ paddingLeft: (level * 20) + 'px' }">
    <!-- 节点内容 -->
    <div v-if="node" class="node-row" :class="{ 'is-folder': node.isDirectory, 'is-error': node.status === 'error' }">
      <!-- 名称列 -->
      <div class="column name-column">
        <!-- 文件夹展开/折叠图标 -->
        <span v-if="node.isDirectory" class="expand-icon" @click="toggleExpand">
          <svg v-if="isExpanded" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
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
            ({{ node.completedFiles || 0 }}/{{ node.totalFiles }})
          </span>
        </span>
      </div>

      <!-- 状态列 -->
      <div class="column status-column">
        <span :class="'status-' + node.status">{{ statusText }}</span>
      </div>

      <!-- 进度列 -->
      <div class="column progress-column">
        <div v-if="node.status === 'transferring' || node.status === 'pending'" class="progress-bar">
          <div class="progress-fill" :style="{ width: node.progress + '%' }"></div>
        </div>
        <span v-else-if="node.status === 'completed'" class="progress-percent">100%</span>
        <span v-else class="progress-percent">-</span>
      </div>

      <!-- 大小列 -->
      <div class="column size-column">
        {{ formatSize(node.size) }}
      </div>

      <!-- 本地路径列 -->
      <div class="column local-path-column" :title="node.localPath">
        {{ node.localPath || '-' }}
      </div>

      <!-- 箭头列 -->
      <div class="column arrow-column">
        {{ node.type === 'upload' ? '→' : (node.type === 'download' ? '←' : '×') }}
      </div>

      <!-- 远程路径列 -->
      <div class="column remote-path-column" :title="node.remotePath">
        {{ node.remotePath || '-' }}
      </div>

      <!-- 速度列 -->
      <div class="column speed-column">
        {{ formatSpeed(node.speed) }}
      </div>

      <!-- 估计剩余列 -->
      <div class="column remaining-column">
        {{ node.remaining }}
      </div>

      <!-- 经过时间列 -->
      <div class="column elapsed-column">
        {{ node.elapsed }}
      </div>
    </div>

    <!-- 子节点 -->
    <div v-if="node.isDirectory && isExpanded && node.children && node.children.length > 0" class="children">
      <SftpTransferTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :level="level + 1"
        @update:node-expanded="handleChildExpanded"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TransferNode } from '@shared/types/sftp'
import { formatSize, formatSpeed } from '@/utils/fs-utils'

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
  /** 传输节点 */
  node: TransferNode
  /** 缩进层级 */
  level: number
}

const props = defineProps<Props>()

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
  // 触发更新事件，由父组件处理状态更新
  emit('update:node-expanded', props.node.id, !isExpanded.value)
}

/**
 * 处理子节点的展开状态变化
 * 将事件向上传递给父组件
 */
function handleChildExpanded(nodeId: string, expanded: boolean): void {
  // 向上传递事件
  emit('update:node-expanded', nodeId, expanded)
}

/**
 * 状态文本
 */
const statusText = computed(() => {
  const statusMap: Record<string, string> = {
    pending: '等待中',
    transferring: '传输中',
    completed: '已完成',
    error: '错误',
    cancelled: '已取消'
  }
  return statusMap[props.node.status] || props.node.status
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
  padding: 0 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.name-column {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 200px;
  min-width: 200px;
  flex-shrink: 0;
}

.expand-icon {
  cursor: pointer;
  display: flex;
  align-items: center;
  color: var(--text-color-secondary, #666666);
}

.expand-icon:hover {
  color: var(--text-color, #333333);
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

/* 子节点容器 */
.children {
  border-top: 1px dashed var(--border-color, #e0e0e0);
}
</style>
