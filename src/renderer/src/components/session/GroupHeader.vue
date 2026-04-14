/**
 * 分组头部组件（带右键菜单）
 * 显示分组的展开/折叠、图标、名称、数量和添加按钮
 * 包含分组管理的右键菜单（添加会话、新建子分组、编辑、删除等）
 * 用于 SessionList 和 SessionGroupTree 的公共 UI 组件
 * @module components/session/GroupHeader
 */

<template>
  <div class="group-header-wrapper" ref="headerWrapperRef">
    <!-- 分组头部 -->
    <div
      class="group-header"
      :class="{ 'depth-limit-reached': !canCreateSubGroup }"
      @click="$emit('toggle')"
      @contextmenu.prevent.stop="handleContextMenu($event)"
      :title="tooltip"
    >
      <!-- 展开箭头图标 -->
      <svg
        class="expand-icon"
        :class="{ expanded: isExpanded }"
        width="12"
        height="12"
        viewBox="0 0 12 12"
      >
        <path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="2" fill="none" />
      </svg>

      <!-- 分组图标 -->
      <GroupIcon :size="16" />

      <!-- 分组名称 -->
      <span class="group-name">{{ group.name }}</span>

      <!-- 分组会话数量 -->
      <span class="group-count">{{ sessionCount }}</span>
    </div>

    <!-- 分组管理右键菜单 -->
    <div
      v-if="contextMenuVisible"
      class="context-menu"
      :style="contextMenuStyle"
      @click.stop
    >
      <!-- 添加会话 -->
      <div class="menu-item" @click="handleAddSessionFromMenu" title="添加会话到当前分组">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1V13M1 7H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <span>添加会话</span>
      </div>

      <!-- 新建子分组 -->
      <div v-if="canCreateSubGroup" class="menu-item" @click="handleCreateSubGroupFromMenu" title="在当前分组内创建子分组">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1V13M1 7H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <span>新建子分组</span>
      </div>

      <div class="menu-divider"></div>

      <!-- 编辑分组 -->
      <div class="menu-item" @click="handleEditGroup" title="双击分组名称，可修改分组名">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M10 2L12 4L4.5 11.5H2.5V9.5L10 2Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"
            stroke-linejoin="round" />
        </svg>
        <span>编辑分组</span>
      </div>

      <!-- 删除分组 -->
      <div class="menu-item danger" @click="handleDeleteGroup" title="删除分组将会话全部删除，操作不可逆">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M2 4H12M5 4V3C5 2.44772 5.44772 2 6 2H8C8.55228 2 9 2.44772 9 3V4M11 4V11C11 11.5523 10.5523 12 10 12H4C3.44772 12 3 11.5523 3 11V4H11Z"
            stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>删除分组</span>
      </div>

      <div class="menu-divider"></div>

      <!-- 审查元素 -->
      <div class="menu-item" @click="handleInspectElement" title="打开开发者工具并审查当前元素">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 13L5 9M3 3H5L12 10V12H10L3 3Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>审查元素</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { SessionGroup } from '@shared/types'
import GroupIcon from './GroupIcon.vue'
import { MAX_GROUP_DEPTH } from '@shared/types'

/**
 * Props 定义
 */
interface Props {
  /** 当前分组对象 */
  group: SessionGroup
  /** 是否展开 */
  isExpanded: boolean
  /** 分组内的会话数量（包括子分组） */
  sessionCount: number
  /** 是否可以创建子分组 */
  canCreateSubGroup: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isExpanded: false,
  sessionCount: 0,
  canCreateSubGroup: true
})

/**
 * Emits 定义
 */
const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'contextmenu', event: MouseEvent): void
  (e: 'add-session-to-group', group: SessionGroup): void
  (e: 'create-subgroup', group: SessionGroup): void
  (e: 'edit-group', group: SessionGroup): void
  (e: 'delete-group', group: SessionGroup): void
  (e: 'inspect-element', event: MouseEvent, group: SessionGroup): void
}>()

/** 组件引用 */
const headerWrapperRef = ref<HTMLElement | null>(null)

/** 右键菜单状态 */
const contextMenuVisible = ref(false)
const contextMenuStyle = ref<Record<string, string>>({})

/**
 * 计算分组头部 tooltip 文本
 * 根据展开状态和层级限制显示不同的提示信息
 */
const tooltip = computed(() => {
  const depthInfo = `层级：${props.group.depth}/${MAX_GROUP_DEPTH}`
  const expandInfo = props.isExpanded
    ? '点击折叠分组，精简会话列表'
    : '点击展开分组，查看会话列表'

  if (!props.canCreateSubGroup) {
    return `${expandInfo} | ${depthInfo}（已达层级上限）`
  }

  return `${expandInfo} | ${depthInfo}`
})

/**
 * 处理右键点击事件
 * 显示分组管理菜单
 */
const handleContextMenu = (event: MouseEvent) => {
  // 关闭其他可能存在的菜单
  emit('contextmenu', event)

  // 记录菜单位置
  const x = event.clientX
  const y = event.clientY

  contextMenuStyle.value = {
    position: 'fixed',
    left: `${x}px`,
    top: `${y}px`,
    zIndex: 1000
  }

  contextMenuVisible.value = true
}

/**
 * 从菜单添加会话到当前分组
 */
const handleAddSessionFromMenu = () => {
  contextMenuVisible.value = false
  emit('add-session-to-group', props.group)
}

/**
 * 从菜单创建子分组
 * 确保在当前分组下创建（修复 Bug 1）
 */
const handleCreateSubGroupFromMenu = () => {
  contextMenuVisible.value = false
  emit('create-subgroup', props.group)
}

/**
 * 编辑分组
 */
const handleEditGroup = () => {
  contextMenuVisible.value = false
  emit('edit-group', props.group)
}

/**
 * 删除分组
 */
const handleDeleteGroup = () => {
  contextMenuVisible.value = false
  emit('delete-group', props.group)
}

/**
 * 审查元素
 */
const handleInspectElement = () => {
  contextMenuVisible.value = false
  
  if (window.api && window.api.openDevTools) {
    window.api.openDevTools({ x: parseInt(contextMenuStyle.value.left || '0'), y: parseInt(contextMenuStyle.value.top || '0') })
  }
  
  emit('inspect-element', new MouseEvent('click'), props.group)
}

/**
 * 点击外部关闭菜单
 */
const handleClickOutside = (event: MouseEvent) => {
  if (contextMenuVisible.value && headerWrapperRef.value && !headerWrapperRef.value.contains(event.target as Node)) {
    contextMenuVisible.value = false
  }
}

/**
 * 监听全局点击事件
 */
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.group-header-wrapper {
  position: relative;
  width: 100%;
}

.group-header {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
  user-select: none;
  color: var(--text-color, #cccccc);
  font-size: 13px;
}

.group-header:hover {
  background-color: var(--el-color-primary-light-9);
}

/* 展开箭头样式 */
.expand-icon {
  width: 12px;
  height: 12px;
  margin-right: 6px;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

/* 分组名称样式 */
.group-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-color, #cccccc);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-left: 6px;
}

/* 分组数量标签样式 */
.group-count {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-left: 8px;
  padding: 1px 6px;
  background-color: var(--el-fill-color);
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

/* 层级限制达到时的样式 */
.group-header.depth-limit-reached {
  opacity: 1; /* 保持与其他分组相同的显示效果 */
}

.group-header.depth-limit-reached:hover {
  background-color: var(--el-fill-color);
}

/* 添加会话按钮样式 */
.add-session-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  opacity: 0;
  transition: all 0.2s;
  flex-shrink: 0;
  margin-left: 4px;
}

.group-header:hover .add-session-btn {
  opacity: 1;
}

.add-session-btn:hover {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

/* 右键菜单样式 */
.context-menu {
  position: fixed;
  background-color: var(--el-bg-color, #ffffff);
  border: 1px solid var(--el-border-color-light, #e4e7ed);
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 160px;
  z-index: 2000;
  user-select: none;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-primary, #303133);
  transition: background-color 0.2s;
  gap: 8px;
}

.menu-item:hover {
  background-color: var(--el-fill-color-light, #f5f7fa);
}

.menu-item.danger {
  color: var(--el-color-danger, #f56c6c);
}

.menu-item.danger:hover {
  background-color: var(--el-color-danger-light-9, #fef0f0);
}

.menu-divider {
  height: 1px;
  background-color: var(--el-border-color-lighter, #ebeef5);
  margin: 4px 0;
}
</style>
