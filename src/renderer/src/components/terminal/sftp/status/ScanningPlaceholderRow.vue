/**
 * SFTP 扫描中占位行组件
 * 当任务处于 scanning 状态（root 尚未设置）时，展示扫描占位信息
 * 
 * Props: scanningNode — 来自 TransferTask.scanningNode 的基础属性
 * @module components/terminal/sftp/status/ScanningPlaceholderRow
 */

<template>
  <div class="scanning-placeholder-row">
    <!-- 复选框列（支持选中/取消，与正常任务行为一致） -->
    <div class="column checkbox-column">
      <input
        type="checkbox"
        :checked="isSelected"
        :disabled="!taskId"
        title="选择任务"
        @change="$emit('toggle-selection')"
      >
    </div>
    <!-- 名称列 -->
    <div class="column name-column">
      <span class="file-icon">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M9 1H4C2.89543 1 2 1.89543 2 3V13C2 14.1046 2.89543 15 4 15H12C13.1046 15 14 14.1046 14 13V6L9 1Z"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path
            d="M9 1V6H14"
            stroke="currentColor"
            stroke-width="1.5"
          />
        </svg>
      </span>
      <span
        class="file-name"
        :title="node.name"
      >{{ node.name }}</span>
    </div>
    <!-- 状态列 -->
    <div class="status-column">
      <span :class="isCancelled ? 'status-cancelled' : 'status-scanning'">
        {{ isCancelled ? '已取消' : '扫描中...' }}
      </span>
    </div>
    <!-- 进度列 -->
    <div class="progress-column">
      <div
        v-if="!isCancelled"
        class="scanning-indicator"
      >
        <span class="scanning-dot" />
        <span>扫描中</span>
      </div>
      <span
        v-else
        class="cancelled-text"
      >—</span>
    </div>
    <!-- 大小列（扫描中未知） -->
    <div class="column size-column">
      -
    </div>
    <!-- 本地路径列 -->
    <div
      class="column local-path-column"
      :title="node.localPath"
    >
      {{ node.localPath || '-' }}
    </div>
    <!-- 箭头列 -->
    <div class="column arrow-column">
      {{ node.type === 'upload' ? '→' : '←' }}
    </div>
    <!-- 远程路径列 -->
    <div
      class="column remote-path-column"
      :title="node.remotePath"
    >
      {{ node.remotePath || '-' }}
    </div>
    <!-- 速度/剩余/经过 列（扫描中无数据） -->
    <div class="column speed-column">
      -
    </div>
    <div class="column remaining-column">
      -
    </div>
    <div class="column elapsed-column">
      -
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TransferTask } from '@shared/types/sftp'
import { useSftpTransferStore } from '@/stores/sftpTransfer'

/**
 * 使用 SFTP 传输任务 Store（用于读取任务状态）
 */
const sftpTransferStore = useSftpTransferStore()

/**
 * 扫描占位节点数据（Pick 子集，含 status 字段支持取消状态展示）
 */
interface Props {
  /** 来自 TransferTask.scanningNode 的占位数据 */
  node: NonNullable<TransferTask['scanningNode']>
  /** 任务 ID（用于选中/取消操作） */
  taskId: string
  /** 当前任务是否被选中 */
  isSelected: boolean
}

const props = withDefaults(defineProps<Props>(), {
  taskId: '',
  isSelected: false
})

/** 定义组件事件 */
defineEmits<{
  /** 复选框选中状态变化事件 */
  (e: 'toggle-selection'): void
}>()

/**
 * 判断当前占位节点是否已被取消
 * 优先读取 scanningNode.status（取消操作直接写入该字段）
 * 兜底从 Store 获取任务状态（防止极端时序问题）
 */
const isCancelled = computed((): boolean => {
  return props.node.status === 'cancelled' ||
    sftpTransferStore.getTask(props.taskId)?.status === 'cancelled'
})
</script>

<style scoped>
/* 占位行容器（min-width: max-content 与表头/数据行一致，防止 flex 压缩导致错位） */
.scanning-placeholder-row {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0;
  min-width: max-content;
}

/* 列样式（与 SftpTransferTreeNode 对齐） */
.column {
  padding: 6px 12px;
  display: flex;
  align-items: center;
}

.checkbox-column {
  width: 40px;
  min-width: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox-column input[type="checkbox"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: var(--primary-color, #409eff);
}

.checkbox-column input[type="checkbox"]:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.name-column {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 400px;
  min-width: 400px;
  flex-shrink: 0;
}

.file-icon {
  display: flex;
  align-items: center;
  color: var(--primary-color, #409eff);
  flex-shrink: 0;
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-column {
  width: 100px;
  min-width: 100px;
  flex-shrink: 0;
}

.status-scanning {
  color: var(--warning-color, #e6a23c);
}

/** 已取消状态 */
.status-cancelled {
  color: var(--danger-color, #f56c6c);
}

.cancelled-text {
  font-size: 11px;
  color: var(--text-color-secondary, #999999);
}

.progress-column {
  width: 150px;
  min-width: 150px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
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
</style>
