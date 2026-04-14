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
      :style="{ paddingLeft: '12px' }"
      @contextmenu.prevent="handleGroupContextMenu($event, subGroup)"
    >
      <!-- 子分组头部 -->
      <GroupHeader
        :group="subGroup"
        :is-expanded="expandedGroups.has(subGroup.id)"
        :session-count="getGroupSessionCount(subGroup.id)"
        :can-create-sub-group="canCreateSubGroupIn(subGroup.id)"
        @toggle="handleToggleGroup(subGroup.id)"
        @contextmenu.prevent.stop="handleGroupContextMenu($event, subGroup)"
        @add-session-to-group="handleAddSessionToGroup"
        @create-subgroup="handleCreateSubGroupFromGroupHeader"
        @edit-group="handleEditGroupFromGroupHeader"
        @delete-group="handleDeleteGroupFromGroupHeader"
      />
      
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
          @add-session-to-group="handleAddSessionToGroup"
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
import GroupIcon from './GroupIcon.vue'
import GroupHeader from './GroupHeader.vue'
import { useSessionGroup } from './script/useSessionGroup'
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
  addSessionToGroup: [group: SessionGroup]
}>()

/**
 * 获取直接子分组
 */
const subGroups = computed(() => {
  return props.allGroups.filter(g => g.parentId === props.parentGroupId)
})

// 使用分组工具函数 composable（提取公共逻辑，避免与 SessionList 重复）
const {
  getDirectGroupSessions,
  getGroupSessionCount,
  hasSubGroups,
  canCreateSubGroupIn
} = useSessionGroup({
  allGroups: () => props.allGroups,
  sessions: () => props.sessions
})

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

/**
 * 添加会话到分组
 */
const handleAddSessionToGroup = (group: SessionGroup) => {
  emit('addSessionToGroup', group)
}

/**
 * 从 GroupHeader 创建子分组（修复 Bug 1）
 * 直接传递给父组件处理
 */
const handleCreateSubGroupFromGroupHeader = (group: SessionGroup) => {
  emit('createSubgroup', group)
}

/**
 * 从 GroupHeader 编辑分组
 * 直接传递给父组件处理
 */
const handleEditGroupFromGroupHeader = (group: SessionGroup) => {
  // 编辑分组功能暂时未实现，可以后续扩展
  console.log('[SessionGroupTree] 编辑分组:', group.name)
}

/**
 * 从 GroupHeader 删除分组
 * 直接传递给父组件处理
 */
const handleDeleteGroupFromGroupHeader = (group: SessionGroup) => {
  // 删除分组功能暂时未实现，可以后续扩展
  console.log('[SessionGroupTree] 删除分组:', group.name)
}
</script>

<style scoped>
.sub-groups {
  display: flex;
  flex-direction: column;
}

.session-group.sub-group {
  position: relative;
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
  color: var(--text-color, #cccccc);
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

/* 层级限制达到时的样式 - 显式设置 opacity 为 1，使文字显示效果与其他层一致 */
.group-header.depth-limit-reached {
  opacity: 1; /* 保持与其他分组相同的显示效果 */
}

.group-header.depth-limit-reached:hover {
  background-color: var(--el-fill-color);
}

/* 添加会话按钮 */
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

.group-content {
  display: flex;
  flex-direction: column;
}

.group-sessions {
  display: flex;
  flex-direction: column;
  padding-left: 24px;
}
</style>
