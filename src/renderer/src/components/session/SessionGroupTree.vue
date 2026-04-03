/**
 * 会话分组树形组件（递归组件）
 * 用于显示嵌套的子分组结构
 * @module components/session/SessionGroupTree
 */

<template>
  <div class="sub-groups">
    <div
      v-for="subGroup in subGroups"
      :key="subGroup.id"
      class="session-group sub-group"
      :data-group-id="subGroup.id"
      :data-group-depth="subGroup.depth"
      :style="{ paddingLeft: `${(subGroup.depth - 1) * 8}px` }"
      @contextmenu.prevent="handleGroupContextMenu($event, subGroup)"
    >
      <!-- 子分组头部 -->
      <div
        class="group-header"
        :class="{ 'depth-limit-reached': !canCreateSubGroupIn(subGroup.id) }"
        @click="handleToggleGroup(subGroup.id)"
        @contextmenu.prevent.stop="handleGroupContextMenu($event, subGroup)"
        :title="getGroupHeaderTooltip(subGroup)"
      >
        <svg
          class="expand-icon"
          :class="{ expanded: expandedGroups.has(subGroup.id) }"
          width="12"
          height="12"
          viewBox="0 0 12 12"
        >
          <path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="2" fill="none" />
        </svg>
        <span class="group-name">{{ subGroup.name }}</span>
        <span class="group-count">{{ getGroupSessionCount(subGroup.id) }}</span>
        <!-- 新建子分组按钮（仅在未达到层级限制时显示） -->
        <button
          v-if="canCreateSubGroupIn(subGroup.id)"
          class="add-subgroup-btn"
          @click.stop="handleCreateSubGroup(subGroup)"
          title="新建子分组"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1V11M1 6H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      
      <!-- 子分组内容 -->
      <div v-show="expandedGroups.has(subGroup.id)" class="group-content">
        <!-- 递归渲染更深层的子分组 -->
        <SessionGroupTree
          v-if="hasSubGroups(subGroup.id)"
          :parent-group-id="subGroup.id"
          :all-groups="allGroups"
          :sessions="sessions"
          :expanded-groups="expandedGroups"
          :active-session-id="activeSessionId"
          @toggle-group="handleToggleGroup"
          @select-session="handleSelectSession"
          @connect-session="handleConnectSession"
          @edit-session="handleEditSession"
          @delete-session="handleDeleteSession"
          @duplicate-session="handleDuplicateSession"
          @properties-session="handlePropertiesSession"
          @group-contextmenu="handleGroupContextMenu"
          @session-contextmenu="handleSessionContextMenu"
          @create-subgroup="handleCreateSubGroup"
        />
        
        <!-- 当前子分组的会话 -->
        <div class="group-sessions">
          <SessionItem
            v-for="session in getDirectGroupSessions(subGroup.id)"
            :key="session.id"
            :session="session"
            :active="session.id === activeSessionId"
            @click="handleSelectSession(session)"
            @dblclick="handleConnectSession(session)"
            @connect="handleConnectSession(session)"
            @edit="handleEditSession(session)"
            @delete="handleDeleteSession(session)"
            @duplicate="handleDuplicateSession(session)"
            @properties="handlePropertiesSession(session)"
            @contextmenu.prevent="handleSessionContextMenu($event, session)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Session, SessionGroup } from '@shared/types'
import SessionItem from './SessionItem.vue'
import { MAX_GROUP_DEPTH } from '@shared/types'

/**
 * Props 定义
 */
interface Props {
  parentGroupId: string
  allGroups: SessionGroup[]
  sessions: Session[]
  expandedGroups: Set<string>
  activeSessionId?: string
}

const props = withDefaults(defineProps<Props>(), {
  activeSessionId: undefined
})

/**
 * Emits 定义
 */
const emit = defineEmits<{
  toggleGroup: [groupId: string]
  selectSession: [session: Session]
  connectSession: [session: Session]
  editSession: [session: Session]
  deleteSession: [session: Session]
  duplicateSession: [session: Session]
  propertiesSession: [session: Session]
  groupContextmenu: [event: MouseEvent, group: SessionGroup]
  sessionContextmenu: [event: MouseEvent, session: Session]
  createSubgroup: [group: SessionGroup]
}>()

/**
 * 获取直接子分组
 */
const subGroups = computed(() => {
  return props.allGroups.filter(g => g.parentId === props.parentGroupId)
})

/**
 * 检查是否有子分组
 */
const hasSubGroups = (groupId: string): boolean => {
  return props.allGroups.some(g => g.parentId === groupId)
}

/**
 * 获取分组会话数量（包括子分组）
 */
const getGroupSessionCount = (groupId: string): number => {
  // 获取所有子分组 ID
  const getAllSubGroupIds = (gid: string): string[] => {
    const children = props.allGroups.filter(g => g.parentId === gid)
    const ids = children.map(c => c.id)
    return [...ids, ...children.flatMap(c => getAllSubGroupIds(c.id))]
  }
  
  const subGroupIds = getAllSubGroupIds(groupId)
  return props.sessions.filter(s => s.groupId && [groupId, ...subGroupIds].includes(s.groupId)).length
}

/**
 * 获取直接子分组的会话
 */
const getDirectGroupSessions = (groupId: string): Session[] => {
  return props.sessions.filter(s => s.groupId === groupId)
}

/**
 * 检查是否可以在目标分组下创建子分组
 */
const canCreateSubGroupIn = (groupId: string): boolean => {
  const group = props.allGroups.find(g => g.id === groupId)
  if (!group) return false
  
  return group.depth < MAX_GROUP_DEPTH
}

/**
 * 获取分组头部 tooltip
 */
const getGroupHeaderTooltip = (group: SessionGroup): string => {
  const depthInfo = `层级：${group.depth}/${MAX_GROUP_DEPTH}`
  const expandInfo = props.expandedGroups.has(group.id) 
    ? '点击折叠分组，精简会话列表' 
    : '点击展开分组，查看会话列表'
  
  if (!canCreateSubGroupIn(group.id)) {
    return `${expandInfo} | ${depthInfo}（已达层级上限）`
  }
  
  return `${expandInfo} | ${depthInfo}`
}

/**
 * 切换分组展开状态
 */
const handleToggleGroup = (groupId: string) => {
  emit('toggleGroup', groupId)
}

/**
 * 处理分组右键菜单
 */
const handleGroupContextMenu = (event: MouseEvent, group: SessionGroup) => {
  emit('groupContextmenu', event, group)
}

/**
 * 处理会话右键菜单
 */
const handleSessionContextMenu = (event: MouseEvent, session: Session) => {
  emit('sessionContextmenu', event, session)
}

/**
 * 选择会话
 */
const handleSelectSession = (session: Session) => {
  emit('selectSession', session)
}

/**
 * 连接会话
 */
const handleConnectSession = (session: Session) => {
  emit('connectSession', session)
}

/**
 * 编辑会话
 */
const handleEditSession = (session: Session) => {
  emit('editSession', session)
}

/**
 * 删除会话
 */
const handleDeleteSession = (session: Session) => {
  emit('deleteSession', session)
}

/**
 * 复制会话
 */
const handleDuplicateSession = (session: Session) => {
  emit('duplicateSession', session)
}

/**
 * 显示会话属性
 */
const handlePropertiesSession = (session: Session) => {
  emit('propertiesSession', session)
}

/**
 * 创建子分组
 */
const handleCreateSubGroup = (group: SessionGroup) => {
  emit('createSubgroup', group)
}
</script>

<style scoped>
.sub-groups {
  display: flex;
  flex-direction: column;
  /* 移除 padding-left 和 margin-left，仅使用动态 paddingLeft 控制缩进 */
}

.session-group.sub-group {
  /* 移除 margin-left，使用 paddingLeft 控制缩进 */
  position: relative;
}

/* 子分组连接线 */
.session-group.sub-group::before {
  content: '';
  position: absolute;
  left: -4px;
  top: 0;
  bottom: 0;
  width: 1px;
  background-color: var(--el-border-color-light);
}

.group-header {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
  user-select: none;
}

.group-header:hover {
  background-color: var(--el-fill-color-light);
}

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

.group-name {
  flex: 1;
  font-size: 13px;
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

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
  opacity: 0.7;
}

.group-header.depth-limit-reached:hover {
  background-color: var(--el-fill-color);
}

/* 新建子分组按钮 */
.add-subgroup-btn {
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

.group-header:hover .add-subgroup-btn {
  opacity: 1;
}

.add-subgroup-btn:hover {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.group-content {
  display: flex;
  flex-direction: column;
}

.group-sessions {
  display: flex;
  flex-direction: column;
}
</style>
