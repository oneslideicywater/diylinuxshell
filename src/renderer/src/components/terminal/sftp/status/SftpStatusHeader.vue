/**
 * SFTP 状态头组件
 * 显示文件传输状态的表头
 * @module components/session/sftp/SftpStatusHeader
 */

<template>
  <div class="sftp-transfer-tree">
    <!-- 表头（水平位置跟随内容区滚动） -->
    <div
      class="tree-header"
      :style="{ transform: `translateX(${headerScrollLeft}px)` }"
    >
      <!-- 复选框列 -->
      <div class="header-column checkbox-column">
        <input 
          type="checkbox" 
          :checked="isSelected"
          :disabled="!taskId"
          title="选择任务"
          @change="handleToggle"
        >
      </div>
      <div class="header-column name-column">
        名称
      </div>
      <div class="header-column status-column">
        状态
      </div>
      <div class="header-column progress-column">
        进度
      </div>
      <div class="header-column size-column">
        已传输/总体
      </div>
      <div class="header-column local-path-column">
        本地路径
      </div>
      <div class="header-column arrow-column">
        ↔
      </div>
      <div class="header-column remote-path-column">
        远程路径
      </div>
      <div class="header-column speed-column">
        速度
      </div>
      <div class="header-column remaining-column">
        估计剩余
      </div>
      <div class="header-column elapsed-column">
        经过时间
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Props 定义
 */
interface Props {
  /** 任务 ID */
  taskId?: string
  /** 是否被选中 */
  isSelected: boolean
  /** 表头水平偏移量（由父组件传入，用于同步内容区水平滚动） */
  headerScrollLeft?: number
}

withDefaults(defineProps<Props>(), {
  taskId: '',
  isSelected: false,
  headerScrollLeft: 0
})

/**
 * 定义组件事件
 */
const emit = defineEmits<{
  /** 切换选中状态事件 */
  (e: 'toggle-selection'): void
}>()

/**
 * 处理复选框状态变化
 */
function handleToggle(): void {
  emit('toggle-selection')
}



</script>

<style scoped>
/* 传输树容器 */
.sftp-transfer-tree {
  display: flex;
  flex-direction: column;
  background: var(--bg-color, #1e1e1e);
  border-top: 1px solid var(--border-color, #333);
  font-size: 12px;
  min-width: max-content;
}

/* 表头（固定高度 36px 与数据行对齐，使用 --header-bg 变量支持主题切换） */
.tree-header {
  display: flex;
  align-items: center;
  height: 36px;
  background: var(--header-bg, var(--sidebar-bg, var(--bg-color, #252526)));
  border-bottom: 1px solid var(--border-color, #333);
  font-weight: 500;
  user-select: none;
}

/* 表头列（配合 36px 固定高度行，与数据行 .column 对齐）
 * 注意：不设置 border-right，避免每列多 1px 导致与数据行累计偏移
 */
.header-column {
  padding: 0 10px;
  display: flex;
  align-items: center;
  text-align: left;
  color: var(--text-secondary, var(--text-color, #888));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 复选框列 */
.checkbox-column {
  width: 40px;
  min-width: 40px;
  flex-shrink: 0;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox-column input[type="checkbox"] {
  cursor: pointer;
  width: 14px;
  height: 14px;
  accent-color: var(--primary-color, #409eff);
}

.checkbox-column input[type="checkbox"]:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.name-column {
  width: 400px;
  min-width: 400px;
  flex-shrink: 0;
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
}

.size-column {
  width: 140px;
  min-width: 140px;
  flex-shrink: 0;
}

/* 本地路径列（固定最大宽度，与数据行 .local-path-column 对齐） */
.local-path-column {
  width: 220px;
  max-width: 220px;
  min-width: 120px;
}

.arrow-column {
  width: 40px;
  min-width: 40px;
  flex-shrink: 0;
  text-align: center;
  color: var(--primary-color, #409eff);
}

/* 远程路径列（固定最大宽度，与数据行 .remote-path-column 对齐） */
.remote-path-column {
  width: 220px;
  max-width: 220px;
  min-width: 120px;
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
