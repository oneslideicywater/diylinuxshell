/**
 * SFTP 传输树节点组件
 * 显示单个文件传输状态，支持树形缩进
 * 
 * 重构说明：
 * - 所有数据（静态 + 动态）均通过 taskId + nodeId 从 Pinia Store 获取
 * - 不再接收 node 对象 prop，完全依赖 Store 的响应式数据
 * - 依赖 store.version 确保每次 mutateNode 后自动重算
 * @module components/session/sftp/SftpTransferTreeNode
 */

<template>
  <!-- hideIdleNodes 开启且节点为空闲态时隐藏（error 始终显示） -->
  <div
    v-if="node && !shouldHide"
    class="tree-node"
  >
    <!-- 节点内容 -->
    <div
      class="node-row"
      :class="{ 'is-folder': node.isDirectory, 'is-error': liveStatus === 'error' }"
    >
      <!-- 复选框占位列（与表头对齐） -->
      <div class="column checkbox-column">
        <span class="checkbox-placeholder" />
      </div>

      <!-- 名称列（根据层级动态调整左侧缩进） -->
      <div
        class="column name-column"
        :style="{ paddingLeft: (level * 20) + 'px' }"
      >
        <!-- 文件夹展开/折叠图标 -->
        <span
          v-if="node.isDirectory"
          class="expand-icon"
          @click="toggleExpand"
        >
          <svg
            v-if="isExpanded"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
          <svg
            v-else
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              d="M4.5 3L7.5 6L4.5 9"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </span>
        <!-- 文件的占位图标（不可见，用于保持与文件夹的对齐） -->
        <span
          v-else
          class="expand-placeholder"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          />
        </span>
        <!-- 文件类型图标 -->
        <span
          class="file-icon"
          :class="{ 'is-folder': node.isDirectory }"
        >
          <svg
            v-if="node.isDirectory"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M14 13.5C14 14.3284 13.3284 15 12.5 15H3.5C2.67157 15 2 14.3284 2 13.5V5.5C2 4.67157 2.67157 4 3.5 4H6.5L7.5 5H12.5C13.3284 5 14 5.67157 14 6.5V13.5Z"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
          <svg
            v-else
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
        <!-- 文件名 -->
        <span
          class="file-name"
          :title="node.name"
        >
          {{ node.name }}
          <!-- 如果是文件夹且有总文件数信息，显示总体进度 -->
          <span
            v-if="node.isDirectory && node.totalFiles !== undefined"
            class="folder-progress"
          >
            ({{ liveCompletedFiles || 0 }}/{{ node.totalFiles }})
          </span>
        </span>
      </div>

      <!-- 状态列（从 Store 实时读取） -->
      <div class="column status-column">
        <span :class="'status-' + liveStatus">{{ statusText }}</span>
      </div>

      <!-- 进度列（从 Store 实时读取，进度条内嵌百分比文字） -->
      <div class="column progress-column">
        <div
          v-if="liveStatus === 'transferring' || liveStatus === 'pending'"
          class="progress-bar"
        >
          <div
            class="progress-fill"
            :style="{ width: liveProgress + '%' }"
          />
          <span class="progress-text">{{ Math.round(liveProgress) }}%</span>
        </div>
        <span
          v-else-if="liveStatus === 'completed'"
          class="progress-percent"
        >100%</span>
        <span
          v-else
          class="progress-percent"
        >-</span>
      </div>

      <!-- 大小列（从 Store 获取，格式：已传输/总大小） -->
      <div class="column size-column">
        {{ sizeDisplayText }}
      </div>

      <!-- 本地路径列（从 Store 获取） -->
      <div
        class="column local-path-column"
        :title="node.localPath"
      >
        {{ node.localPath || '-' }}
      </div>

      <!-- 箭头列（从 Store 获取） -->
      <div class="column arrow-column">
        {{ node.type === 'upload' ? '→' : (node.type === 'download' ? '←' : '×') }}
      </div>

      <!-- 远程路径列（从 Store 获取） -->
      <div
        class="column remote-path-column"
        :title="node.remotePath"
      >
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

    <!-- 子节点（递归渲染，所有子节点数据均从 Store 获取） -->
    <div
      v-if="node.isDirectory && isExpanded && node.children && node.children.length > 0"
      class="children"
    >
      <SftpTransferTreeNode
        v-for="child in node.children"
        :key="child.id"
        :task-id="taskId"
        :node-id="child.id"
        :level="level + 1"
        :hide-idle-nodes="hideIdleNodes"
        @update:node-expanded="handleChildExpanded"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
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
  /** 任务 ID（用于从 Pinia Store 查询节点数据） */
  taskId: string
  /** 节点 ID（用于在 Store 树中定位当前节点） */
  nodeId: string
  /** 缩进层级 */
  level: number
  /** 是否隐藏空闲节点（pending/completed/cancelled，error 始终显示） */
  hideIdleNodes?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  taskId: '',
  nodeId: '',
  level: 0,
  hideIdleNodes: false
})

const sftpTransferStore = useSftpTransferStore()

/**
 * 从 Store 中查找当前节点的最新状态（全部字段：静态 + 动态）
 * 依赖 store.version 确保每次 mutateNode 后自动重算（替代旧的 setInterval 定时刷新）
 */
const node = computed((): TransferNode | undefined => {
  void sftpTransferStore.version
  return sftpTransferStore.getNode(props.taskId, props.nodeId)
})

/**
 * 是否隐藏当前节点
 * 条件：hideIdleNodes 开启 + 节点状态为 pending/completed/cancelled（非活跃态）+ 任务状态为 transferring
 * 注意：error 节点始终显示，不参与隐藏
 */
const shouldHide = computed((): boolean => {
  if (!props.hideIdleNodes) return false
  const n = node.value
  if (!n) return false
  /** 仅隐藏空闲终态（pending / completed / cancelled），error 始终可见 */
  if (n.status !== 'pending' && n.status !== 'completed' && n.status !== 'cancelled') return false
  const task = sftpTransferStore.getTask(props.taskId)
  return task?.status === 'transferring'
})

/** 实时速度
 *  统一逻辑（文件和目录一致）：
 *    - 进行中（transferring）：显示活跃节点实时速度
 *    - 已完成（completed）：显示平均速度 = 总大小 / 传输耗时
 */
const liveSpeed = computed(() => {
  void sftpTransferStore.version

  const n = node.value
  if (!n) return 0
  if (!n.startTime) return n.speed ?? 0

  // 已完成：显示平均速度 = 总大小 / (endTime - startTime)
  if (n.status === 'completed' && n.endTime && n.size > 0) {
    const elapsedSec = (n.endTime - n.startTime) / 1000
    return elapsedSec > 0 ? Math.round(n.size / elapsedSec) : 0
  }

  // 进行中：目录取活跃子节点速度，文件取自身速度
  if (n.isDirectory) {
    const task = sftpTransferStore.getTask(props.taskId)
    const activeNode = task?.activeNodeId ? sftpTransferStore.getNode(props.taskId, task.activeNodeId) : undefined
    return activeNode?.speed ?? 0
  }

  return n.speed ?? 0
})

/** 实时进度百分比 */
const liveProgress = computed(() => {
  void sftpTransferStore.version

  console.log('liveProgress 重新计算', node?.value?.localPath, node.value?.progress ?? 0, node.value?.transferredBytes,node.value?.size)
  return node.value?.progress ?? 0
})

/** 大小列显示文本（格式：已传输大小 / 总大小）
 *  - 进行中 / 待传输：显示 "1.5MB / 3.0MB" 双值格式
 *  - 已完成：仅显示总大小 "3.0MB"
 *  - 其他状态（error/cancelled）：显示当前已传 / 总大小
 */
const sizeDisplayText = computed((): string => {
  void sftpTransferStore.version

  const n = node.value
  if (!n) return '-'
  const totalSize: number = n.size ?? 0
  const transferred: number = n.transferredBytes ?? 0

  if (totalSize <= 0) return '-'

  /* 已完成状态：只显示总大小，无需双值 */
  if (n.status === 'completed') {
    return formatSize(totalSize)
  }

  /* 进行中 / 待传输 / 错误 / 取消：显示 已传/总计 */
  return `${formatSize(transferred)} / ${formatSize(totalSize)}`
})

/** 实时状态 */
const liveStatus = computed(() => {
  void sftpTransferStore.version

  return node.value?.status ?? 'pending'
})

/** 实时剩余时间
 *  进行中：(总大小-已传输字节) / 当前速度
 *  已完成 / 无速度：显示 00:00:00 或 x
 */
const liveRemaining = computed(() => {
  void sftpTransferStore.version

  const n = node.value
  if (!n) return ''
  if (n.status === 'completed') return '00:00:00'

  const { size = 0, transferredBytes = 0 } = n
  // 使用 liveSpeed 的值（已包含目录/文件、进行中/完成的统一逻辑）
  const speed = liveSpeed.value

  if (speed <= 0 || size <= transferredBytes) return 'x'
  return formatTime(Math.ceil((size - transferredBytes) / speed))
})

/** 实时经过时间
 *  显式依赖 store.version：确保任何节点的 mutateNode 都会触发所有节点重算
 *  原因：Date.now() 不是 Vue 响应式依赖，不添加 version 的话非活跃节点不会自动刷新
 */
const liveElapsed = computed(() => {
  void sftpTransferStore.version

  const n = node.value
  if (!n) return ''
  // 已结束（completed/error/cancelled）：用 endTime - startTime 得到精确实际耗时
  if (n.status === 'completed' && n.endTime && n.startTime) {
    console.log('liveElapsed 重新计算', node.value.localPath, formatTime(Math.round((n.endTime - n.startTime) / 1000)))
    return formatTime(Math.round((n.endTime - n.startTime) / 1000))
  }
  // 进行中：实时计算
  if (n.startTime) {
    console.log('liveElapsed 重新计算', node.value.localPath, formatTime(Math.round((Date.now() - n.startTime) / 1000)))
    return formatTime(Math.round((Date.now() - n.startTime) / 1000))
  }
  console.log('liveElapsed 重新计算', node.value.localPath, formatTime(0))
  return formatTime(0)
})

/** 已完成文件数（文件夹专用） */
const liveCompletedFiles = computed(() => node.value?.completedFiles ?? 0)

/**
 * 获取节点的展开状态（默认为 false，即默认折叠）
 */
const isExpanded = computed(() => {
  return node.value?.expanded ?? false
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
  emit('update:node-expanded', props.nodeId, !isExpanded.value)
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
  const n = node.value
  if (!n) return ''
  return getStatusText(n.type, liveStatus.value)
})
</script>

<style scoped>
/* 树节点容器（min-width: max-content 与表头 .sftp-transfer-tree 一致，
 * 确保窗口变窄时不会被 flex 压缩，而是通过外层 .tree-content 的 overflow: auto 水平滚动） */
.tree-node {
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  min-width: max-content;
}

/* 节点行（固定高度，所有子元素垂直居中） */
.node-row {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0;
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

/* 列样式（配合 36px 固定高度行，垂直居中） */
.column {
  padding: 0 10px;
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

/* 大小列（固定宽度，强制单行显示，超出截断省略） */
.size-column {
  width: 140px;
  min-width: 140px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 本地路径列（固定最大宽度，超出截断显示省略号） */
.local-path-column {
  width: 220px;
  max-width: 220px;
  min-width: 120px;
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

/* 远程路径列（固定最大宽度，超出截断显示省略号） */
.remote-path-column {
  width: 220px;
  max-width: 220px;
  min-width: 120px;
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

/* 进度条（容器相对定位，用于叠加百分比文字）
 * 设计要点：
 *   - 高度 100% 自适应父容器 .progress-column（配合 36px 行高）
 *   - 轨道背景使用 --bg-color-tertiary 响应主题切换（亮/暗色）
 *   - 填充层使用 --primary-color 保持品牌一致性
 *   - 文字通过 mix-blend-mode: difference 自动适配双色背景
 */
.progress-bar {
  position: relative;
  width: 100%;
  height: 22px;
  background: var(--bg-color-tertiary, #2d2d30);
  border-radius: var(--border-radius-sm, 4px);
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
}

.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, var(--primary-color-dark, #337ecc), var(--primary-color, #409eff));
  border-radius: var(--border-radius-sm, 4px);
  transition: width var(--transition-normal, 0.3s ease);
  z-index: 1;
}

/* 百分比文字：居中叠加在进度条上
 * mix-blend-mode: difference 实现智能反色：
 *   - 在深色轨道背景上显示为浅色文字
 *   - 在蓝色填充区域上自动反转为深色文字
 *   无需手动判断进度位置，始终保证 WCAG 4.5:1 对比度
 */
.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  font-size: 11px;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
  mix-blend-mode: difference;
  letter-spacing: 0.3px;
  /* 微弱阴影增强边缘可读性 */
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.3));
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
