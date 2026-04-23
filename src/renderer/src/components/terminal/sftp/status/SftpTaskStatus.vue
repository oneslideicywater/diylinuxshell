/**
 * SFTP 单个传输任务状态组件
 * 显示单个传输任务的完整信息（表头 + 树形节点）
 * 
 * 重构说明：
 * - 不再接收 taskRoot 对象 prop
 * - 仅通过 taskId 从 Store 获取任务数据，根节点 ID 由 Store 推导
 * @module components/session/sftp/SftpTaskStatus
 */

<template>
  <div class="sftp-task-status">
    <!-- 任务表头 -->
    <SftpStatusHeader :task-id="taskId" :is-selected="isSelectedComputed" @toggle-selection="handleToggleSelection" />

    <!-- 传输树节点（从根节点开始渲染，所有数据从 Store 获取） -->
    <div v-if="rootNodeId" class="tree-content">
      <SftpTransferTreeNode
        :task-id="taskId"
        :node-id="rootNodeId"
        :level="0"
        @update:node-expanded="handleNodeExpanded"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import SftpTransferTreeNode from './SftpTransferTreeNode.vue'
import SftpStatusHeader from './SftpStatusHeader.vue'
import { useSftpTransferStore } from '@/stores/sftpTransfer'

/**
 * 使用 SFTP 传输任务 Store
 */
const sftpTransferStore = useSftpTransferStore()

/**
 * Props 定义
 */
interface Props {
  /** 任务 ID */
  taskId: string
}

const props = withDefaults(defineProps<Props>(), {
  taskId: ''
})

/**
 * 从 Store 获取选中任务 ID 集合
 */
const { selectedTaskIds } = storeToRefs(sftpTransferStore)

/**
 * 当前任务是否被选中（使用 computed 保持响应式）
 */
const isSelectedComputed = computed((): boolean => {
  return !!props.taskId && selectedTaskIds.value.has(props.taskId)
})

/** 根节点 ID：从 Store 获取任务的 root 节点 id */
const rootNodeId = computed((): string | undefined => {
  const task = sftpTransferStore.transferTasks.find(t => t.id === props.taskId)
  return task?.root?.id
})

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

/**
 * 处理复选框选中状态变化
 */
function handleToggleSelection(): void {
  if (props.taskId) {
    sftpTransferStore.toggleTaskSelection(props.taskId)
  }
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
