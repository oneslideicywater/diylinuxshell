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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { SessionGroup } from '@shared/types'
import GroupIcon from './GroupIcon.vue'
import { MAX_GROUP_DEPTH } from '@shared/types'
import { useContextMenuStore } from '@/stores/contextMenu'

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
  (e: 'add-session-to-group', group: SessionGroup): void
  (e: 'create-subgroup', group: SessionGroup): void
  (e: 'edit-group', group: SessionGroup): void
  (e: 'delete-group', group: SessionGroup): void
}>()

/** 组件引用 */
const headerWrapperRef = ref<HTMLElement | null>(null)

/* 右键菜单 Store（全局唯一管理） */
const contextMenuStore = useContextMenuStore()

/* 当前组件的唯一标识 */
const menuOwnerId = computed(() => `group-${props.group.id}`)

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
 * 通过全局 Store 管理菜单状态，传入动态 menuItems 和 actionCallback
 */
const handleContextMenu = (event: MouseEvent) => {
  let x = event.clientX
  let y = event.clientY

  /* 边界检测 */
  const menuWidth = 180
  const menuHeight = 260
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10
  }

  /* 构建菜单项列表 */
  const menuItems = [
    { action: 'add-session', title: '添加会话', description: '添加会话到当前分组' },
    { action: 'create-subgroup', title: '新建子分组', description: '在当前分组内创建子分组', visible: props.canCreateSubGroup },
    { action: 'edit-group', title: '编辑分组', description: '双击分组名称，可修改分组名' },
    { action: 'delete-group', title: '删除分组', description: '删除分组将会话全部删除，操作不可逆' },
    { action: 'inspect', title: '审查元素', description: '打开开发者工具并审查当前元素' }
  ]

  /* 通过 Store 显示右键菜单（注册所有权 + 菜单项 + 回调） */
  contextMenuStore.showContextMenu(menuOwnerId.value, { x, y }, menuItems, (action: string) => {
    switch (action) {
      case 'add-session':
        emit('add-session-to-group', props.group)
        break
      case 'create-subgroup':
        emit('create-subgroup', props.group)
        break
      case 'edit-group':
        emit('edit-group', props.group)
        break
      case 'delete-group':
        emit('delete-group', props.group)
        break
      case 'inspect':
        if (window.api?.openDevTools) {
          const pos = contextMenuStore.position
          window.api.openDevTools({ ...pos })
        }
        break
    }
  })
}
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
  opacity: 1;
}

.group-header.depth-limit-reached:hover {
  background-color: var(--el-fill-color);
}
</style>
