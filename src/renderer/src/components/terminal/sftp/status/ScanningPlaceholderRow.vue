/**
 * SFTP 扫描中占位行组件
 * 当任务处于 scanning 状态（root 尚未设置）时，展示扫描占位信息
 * 
 * Props: scanningNode — 来自 TransferTask.scanningNode 的基础属性
 * @module components/terminal/sftp/status/ScanningPlaceholderRow
 */

<template>
  <div class="scanning-placeholder-row">
    <!-- 复选框占位列 -->
    <div class="column checkbox-column">
      <span class="checkbox-placeholder"></span>
    </div>
    <!-- 名称列 -->
    <div class="column name-column">
      <span class="file-icon">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M9 1H4C2.89543 1 2 1.89543 2 3V13C2 14.1046 2.89543 15 4 15H12C13.1046 15 14 14.1046 14 13V6L9 1Z" stroke="currentColor" stroke-width="1.5"/>
          <path d="M9 1V6H14" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </span>
      <span class="file-name" :title="node.name">{{ node.name }}</span>
    </div>
    <!-- 状态列 -->
    <div class="column status-column">
      <span class="status-scanning">扫描中...</span>
    </div>
    <!-- 进度列 -->
    <div class="column progress-column">
      <div class="scanning-indicator">
        <span class="scanning-dot"></span>
        <span>扫描中</span>
      </div>
    </div>
    <!-- 大小列（扫描中未知） -->
    <div class="column size-column">-</div>
    <!-- 本地路径列 -->
    <div class="column local-path-column" :title="node.localPath">
      {{ node.localPath || '-' }}
    </div>
    <!-- 箭头列 -->
    <div class="column arrow-column">
      {{ node.type === 'upload' ? '→' : '←' }}
    </div>
    <!-- 远程路径列 -->
    <div class="column remote-path-column" :title="node.remotePath">
      {{ node.remotePath || '-' }}
    </div>
    <!-- 速度/剩余/经过 列（扫描中无数据） -->
    <div class="column speed-column">-</div>
    <div class="column remaining-column">-</div>
    <div class="column elapsed-column">-</div>
  </div>
</template>

<script setup lang="ts">
import type { TransferTask } from '@shared/types/sftp'

/**
 * 扫描占位节点数据（Pick 子集，仅含 UI 展示所需的 4 个字段）
 */
interface Props {
  /** 来自 TransferTask.scanningNode 的占位数据 */
  node: NonNullable<TransferTask['scanningNode']>
}

defineProps<Props>()
</script>

<style scoped>
/* 占位行容器 */
.scanning-placeholder-row {
  display: flex;
  align-items: center;
  padding: 6px 0;
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
