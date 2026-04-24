/**
 * SFTP 单个传输任务状态组件
 * 显示单个传输任务的完整信息（表头 + 树形节点）
 * 
 * 重构说明：
 * - 不再接收 taskRoot 对象 prop
 * - 仅通过 taskId 从 Store 获取任务数据，根节点 ID 由 Store 推导
 * - 扫描状态时使用 ScanningPlaceholderRow 组件展示占位信息
 * @module components/session/sftp/SftpTaskStatus
 */

<template>
  <div class="sftp-task-status">
    <!-- 任务表头（水平位置由 JS 同步内容区滚动） -->
    <SftpStatusHeader 
      :task-id="taskId" 
      :is-selected="isSelectedComputed" 
      @toggle-selection="handleToggleSelection" 
      :header-scroll-left="headerScrollLeft"
    />

    <!-- 扫描中占位行（root 为空且存在 scanningNode 时显示，支持选中/取消） -->
    <div v-if="!rootNodeId && scanningNodeData" class="tree-content" @scroll.passive="handleContentScroll">
      <ScanningPlaceholderRow
        :node="scanningNodeData"
        :task-id="taskId"
        :is-selected="isSelectedComputed"
        @toggle-selection="handleToggleSelection"
      />
    </div>

    <!-- 传输树节点（从根节点开始渲染，所有数据从 Store 获取） -->
    <div v-if="rootNodeId" class="tree-content" @scroll.passive="handleContentScroll">
      <SftpTransferTreeNode
        :task-id="taskId"
        :node-id="rootNodeId"
        :level=0
        :hide-idle-nodes="hideIdleNodes"
        @update:node-expanded="handleNodeExpanded"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import SftpTransferTreeNode from './SftpTransferTreeNode.vue'
import SftpStatusHeader from './SftpStatusHeader.vue'
import ScanningPlaceholderRow from './ScanningPlaceholderRow.vue'
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
  /** 是否隐藏空闲节点（pending/completed/cancelled，error 始终显示） */
  hideIdleNodes?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  taskId: '',
  hideIdleNodes: false
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

/** 扫描占位节点数据（root 为空时用于 UI 展示基础信息） */
const scanningNodeData = computed(() => {
  const task = sftpTransferStore.transferTasks.find(t => t.id === props.taskId)
  return task?.scanningNode ?? null
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

/** 表头水平偏移量（同步内容区 scrollLeft） */
const headerScrollLeft = ref(0)

/**
 * 处理内容区域滚动事件
 * 内容区同时拥有水平和竖向滚动能力：
 * - 竖向：内容区自身处理（overflow-y: auto）
 * - 水平：内容区自身处理（overflow-x: auto），同时同步表头的 translateX
 */
function handleContentScroll(event: Event): void {
  const target = event.target as HTMLElement
  headerScrollLeft.value = -target.scrollLeft
}
</script>

<style scoped>
/* 单个任务状态容器 */
.sftp-task-status {
  display: flex;
  flex-direction: column;
  border-bottom: 2px solid var(--border-color, #333);
  overflow: hidden;
}

/**
 * 树形内容区域 — 滚动条持有者
 * 采用单层滚动方案：同时持有水平滚动（overflow-x: auto）和竖向滚动（overflow-y: auto）
 * 水平滚动时通过 @scroll 事件同步表头 translateX，实现表头跟随效果
 *
 * 关于水平滚动条位置：
 * CSS 原生不支持将水平滚动条定位到容器顶部。
 * 浏览器规范规定水平滚动条始终出现在 overflow 容器的底部，
 * 竖向滚动条始终在右侧。这是浏览器引擎的硬性行为，无法通过 CSS 属性改变。
 * 因此当前方案接受水平滚动条在内容区底部的事实，通过 transform 同步表头来保证可用性。
 *
 * 关键：min-width: 0 允许 flex 子项收缩到小于内容宽度，
 *       内部子元素保持 min-width 不换行，
 *       当内容超出容器宽度时触发水平滚动条
 */
.tree-content {
  flex: 1;
  overflow: auto;
  background: var(--bg-color, #1e1e1e);
  min-width: 0;
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
