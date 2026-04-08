/**
 * SFTP 单个传输任务状态组件
 * 显示单个传输任务的完整信息（表头 + 树形节点）
 * @module components/session/sftp/SftpTaskStatus
 */

<template>
  <div class="sftp-task-status">
    <!-- 任务表头 -->
    <SftpStatusHeader />

    <!-- 传输树节点 -->
    <div class="tree-content">
      <SftpTransferTreeNode 
        v-for="node in taskNodes" 
        :key="node.id" 
        :node="node" 
        :level="0"
        @update:node-expanded="handleNodeExpanded"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TransferNode } from '@shared/types/sftp'
import SftpTransferTreeNode from './SftpTransferTreeNode.vue'
import SftpStatusHeader from './SftpStatusHeader.vue'

/**
 * Props 定义
 */
interface Props {
  /** 传输任务节点列表 */
  taskNodes: TransferNode[]
}

defineProps<Props>()

/**
 * 定义组件事件
 */
const emit = defineEmits<{
  /** 节点展开状态变化事件 */
  (e: 'update:node-expanded', nodeId: string, expanded: boolean): void
}>()

/**
 * 处理节点展开状态变化
 */
function handleNodeExpanded(nodeId: string, expanded: boolean): void {
  emit('update:node-expanded', nodeId, expanded)
}
</script>

<style scoped>
/* 单个任务状态容器 */
.sftp-task-status {
  display: flex;
  flex-direction: column;
  border-bottom: 2px solid var(--border-color, #333);
}

/* 树形内容区域 */
.tree-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--bg-color, #1e1e1e);
}

/* 滚动条样式 */
.tree-content::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.tree-content::-webkit-scrollbar-track {
  background: var(--bg-color, #1e1e1e);
}

.tree-content::-webkit-scrollbar-thumb {
  background: var(--border-color, #333);
  border-radius: 4px;
}

.tree-content::-webkit-scrollbar-thumb:hover {
  background: var(--text-color-secondary, #888);
}
</style>
