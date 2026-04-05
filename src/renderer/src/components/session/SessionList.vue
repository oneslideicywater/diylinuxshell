/**
* 会话列表组件
* 显示所有会话，支持分组显示
* @module components/session/SessionList
*/

<template>
  <div class="session-list-container">
    <div class="session-list">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <span>加载中...</span>
      </div>

      <!-- 空状态：既没有会话也没有分组时显示 -->
      <div v-else-if="sessions.length === 0 && sessionGroups.length === 0" class="empty-state" @contextmenu.prevent="handleListContextMenu">
        <p>暂无会话</p>
        <p class="hint">点击上方 + 按钮创建新会话</p>
      </div>

      <!-- 会话列表 -->
      <div v-else class="session-groups" @contextmenu.prevent="handleListContextMenu">
        <!-- 未分组会话 -->
        <div v-if="ungroupedSessions.length > 0" class="session-group" @contextmenu.prevent="handleListContextMenu">
          <SessionItem v-for="session in ungroupedSessions" :key="session.id" :session="session"
            :active="session.id === activeSessionId" @click="handleSelect(session)" @dblclick="handleConnect(session)"
            @connect="handleConnect(session)" @edit="handleEdit(session)" @delete="handleDelete(session)"
            @duplicate="handleDuplicate(session)" @properties="handleProperties(session)"
            @contextmenu.prevent="handleSessionContextMenu($event, session)" />
        </div>

        <!-- 分组会话（支持嵌套） -->
        <template v-for="group in sessionGroups" :key="group.id">
          <div v-if="!group.parentId" class="session-group" :data-group-id="group.id" :data-group-depth="group.depth"
            @contextmenu.prevent="handleGroupContextMenu($event, group)">
            <!-- 分组头部 -->
            <div class="group-header" :class="{ 'depth-limit-reached': !canCreateSubGroupIn(group.id) }"
              @click="toggleGroup(group.id)" @contextmenu.prevent.stop="handleGroupContextMenu($event, group)"
              :title="getGroupHeaderTooltip(group)">
              <svg class="expand-icon" :class="{ expanded: expandedGroups.has(group.id) }" width="12" height="12"
                viewBox="0 0 12 12">
                <path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="2" fill="none" />
              </svg>
              <!-- 分组图标 -->
              <GroupIcon :icon-type="group.icon" :size="16" />
              <span class="group-name">{{ group.name }}</span>
              <span class="group-count">{{ getGroupSessionCount(group.id) }}</span>
              <!-- 新建子分组按钮（仅在未达到层级限制时显示） -->
              <button v-if="canCreateSubGroupIn(group.id)" class="add-subgroup-btn"
                @click.stop="handleCreateSubGroup(group)" title="新建子分组">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1V11M1 6H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                </svg>
              </button>
            </div>

            <!-- 分组内容（包含子分组和会话） -->
            <div v-show="expandedGroups.has(group.id)" class="group-content">
              <!-- 递归渲染子分组 -->
              <SessionGroupTree v-if="hasSubGroups(group.id)" :parent-group-id="group.id" :all-groups="sessionGroups"
                :sessions="sessions" :expanded-groups="expandedGroups" :active-session-id="activeSessionId"
                @toggle-group="toggleGroup" @select-session="handleSelect" @connect-session="handleConnect"
                @edit-session="handleEdit" @delete-session="handleDelete" @duplicate-session="handleDuplicate"
                @properties-session="handleProperties" @group-contextmenu="handleGroupContextMenu"
                @session-contextmenu="handleSessionContextMenu" @create-subgroup="handleCreateSubGroup" />

              <!-- 当前分组的会话 -->
              <div class="group-sessions">
                <SessionItem v-for="session in getDirectGroupSessions(group.id)" :key="session.id" :session="session"
                  :active="session.id === activeSessionId" @click="handleSelect(session)"
                  @dblclick="handleConnect(session)" @connect="handleConnect(session)" @edit="handleEdit(session)"
                  @delete="handleDelete(session)" @duplicate="handleDuplicate(session)"
                  @properties="handleProperties(session)"
                  @contextmenu.prevent="handleSessionContextMenu($event, session)" />
              </div>
            </div>
          </div>
        </template>

        <!-- 空白占位区域，用于捕获右键点击 -->
        <div class="session-list-spacer" @contextmenu.prevent="handleListContextMenu"></div>
      </div>

      <!-- 列表右键菜单（新建分组） -->
      <div v-show="listContextMenuVisible" class="context-menu" :style="listContextMenuStyle" @click.stop>
        <div class="menu-item" @click="handleCreateGroup" title="创建会话分组，归类管理远程主机连接">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1V13M1 7H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <span>新建分组</span>
        </div>
      </div>

      <!-- 分组管理右键菜单 -->
      <div v-if="groupContextMenuVisible" class="context-menu" :style="groupContextMenuStyle" @click.stop>
        <div class="menu-item" @click="handleNewSessionFromMenu" title="添加会话到当前分组">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1V13M1 7H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <span>添加会话</span>
        </div>
        <div v-if="selectedGroup && canCreateSubGroupIn(selectedGroup.id)" class="menu-item"
          @click="handleCreateSubGroupFromMenu" title="在当前分组内创建子分组">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1V13M1 7H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <span>新建子分组</span>
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item" @click="handleEditGroup" title="双击分组名称，可修改分组名">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M10 2L12 4L4.5 11.5H2.5V9.5L10 2Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"
              stroke-linejoin="round" />
          </svg>
          <span>编辑分组</span>
        </div>
        <div class="menu-item danger" @click="handleDeleteGroup" title="删除分组将会话全部删除，操作不可逆">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 4H12M5 4V3C5 2.44772 5.44772 2 6 2H8C8.55228 2 9 2.44772 9 3V4M11 4V11C11 11.5523 10.5523 12 10 12H4C3.44772 12 3 11.5523 3 11V4H11Z"
              stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>删除分组</span>
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item" @click="handleInspectElement" title="打开开发者工具并审查当前元素">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 13L5 9M3 3H5L12 10V12H10L3 3Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>审查元素</span>
        </div>
      </div>

      <!-- 会话右键菜单（完整菜单项） -->
      <div v-if="sessionContextMenuVisible" class="context-menu" :style="sessionContextMenuStyle" @click.stop>
        <div class="menu-item" @click="handleNewSessionFromMenu" title="添加会话到当前分组">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1V13M1 7H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <span>添加会话</span>
        </div>
        <div class="menu-item" @click="handleConnectFromMenu" title="连接到当前会话">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M12 2L7 7M12 2l-1 5-2-2M12 2l-5 1 2 2M5 9l-3 3M4 10l-1 1"
              stroke="currentColor"
              stroke-width="1.2"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>连接</span>
        </div>
        <div class="menu-item" @click="handleEditFromMenu" title="编辑当前会话配置">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M10.5 2l1.5 1.5-6 6H4V8l6-6zM3 12h8"
              stroke="currentColor"
              stroke-width="1.5"
              fill="none"
            />
          </svg>
          <span>编辑</span>
        </div>
        <div class="menu-item" @click="handleDuplicateFromMenu" title="复制当前会话">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="3" width="14" height="10" rx="1" stroke="currentColor" stroke-width="1.5" fill="none" />
            <path d="M4 7h8M4 10h5" stroke="currentColor" stroke-width="1" />
          </svg>
          <span>复制会话</span>
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item has-submenu" @click="handleMoveToGroup" title="将当前会话移动到指定分组">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M12 11C12 11.8284 11.3284 12.5 10.5 12.5H3.5C2.67157 12.5 2 11.8284 2 10.5V3.5C2 2.67157 2.67157 2 3.5 2H6L7 3.5H10.5C11.3284 3.5 12 4.17157 12 5V11Z"
              stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>移动到分组</span>
          <svg class="submenu-arrow" width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M4 2L7 5L4 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"
              stroke-linejoin="round" />
          </svg>

          <!-- 子菜单 -->
          <div class="submenu" v-if="showGroupSubmenu">
            <div class="menu-item" @click.stop="handleMoveToSpecificGroup('')" title="将当前会话移至未分组">
              <span>未分组</span>
            </div>
            <div v-for="group in sessionGroups" :key="group.id" class="menu-item"
              :class="{ active: selectedSessionForMove?.groupId === group.id }"
              @click.stop="handleMoveToSpecificGroup(group.id)" :title="`将当前会话移动到 ${group.name} 分组`">
              <span>{{ group.name }}</span>
            </div>
          </div>
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item danger" @click="handleDeleteFromMenu" title="删除当前会话">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 4H12M5 4V3C5 2.44772 5.44772 2 6 2H8C8.55228 2 9 2.44772 9 3V4M11 4V11C11 11.5523 10.5523 12 10 12H4C3.44772 12 3 11.5523 3 11V4H11Z"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>删除</span>
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item" @click="handlePropertiesFromMenu" title="查看和修改会话属性">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="3" stroke="currentColor" stroke-width="1.5" />
            <path d="M7 1v2M7 11v2M1 7h2M11 7h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <span>属性</span>
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item" @click="handleSessionInspectElement" title="打开开发者工具并审查当前元素">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 13L5 9M3 3H5L12 10V12H10L3 3Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>审查元素</span>
        </div>
      </div>
    </div>

    <!-- 分组表单对话框 -->
    <SessionGroupForm :visible="groupFormVisible" :group="editingGroup" @close="handleCloseGroupForm"
      @submit="handleSubmitGroupForm" />

    <!-- 确认对话框 -->
    <ConfirmDialog :visible="confirmDialogVisible" :title="confirmDialogTitle" :message="confirmDialogMessage"
      :is-warning="confirmDialogIsWarning" @close="handleConfirmDialogClose" @confirm="handleConfirmDialogConfirm"
      @cancel="handleConfirmDialogCancel" />

    <!-- 连接错误对话框 -->
    <ErrorDialog :visible="errorDialogVisible" :title="errorDialogTitle" :message="errorDialogMessage"
      :session-id="errorDialogSessionId" :show-retry="true" :show-edit="true" @close="handleCloseErrorDialog"
      @retry="handleRetryConnect" @edit="handleEditFromError" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useTerminalStore } from '@/stores/terminal'
import { useErrorDialogStore } from '@/stores/errorDialog'
import SessionItem from './SessionItem.vue'
import SessionGroupForm from './SessionGroupForm.vue'
import ErrorDialog from '@/components/common/ErrorDialog.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import SessionGroupTree from './SessionGroupTree.vue'
import GroupIcon from './GroupIcon.vue'
import type { Session, SessionGroup } from '@shared/types'
import { MAX_GROUP_DEPTH } from '@shared/types'

// 状态管理
const sessionStore = useSessionStore()
const terminalStore = useTerminalStore()
const errorDialogStore = useErrorDialogStore()

// 加载状态
const loading = ref(false)

// 错误对话框相关计算属性
const errorDialogVisible = computed(() => errorDialogStore.visible)
const errorDialogTitle = computed(() => errorDialogStore.title)
const errorDialogMessage = computed(() => errorDialogStore.message)
const errorDialogSessionId = computed(() => errorDialogStore.sessionId)

// 展开的分组
const expandedGroups = ref<Set<string>>(new Set())

// 本地存储的 key
const EXPANDED_GROUPS_STORAGE_KEY = 'session-expanded-groups'

/**
 * 从 localStorage 加载展开状态
 */
const loadExpandedGroups = () => {
  try {
    const stored = localStorage.getItem(EXPANDED_GROUPS_STORAGE_KEY)
    if (stored) {
      const groupIds = JSON.parse(stored)
      expandedGroups.value = new Set(groupIds)
    }
  } catch (error) {
    console.error('Failed to load expanded groups:', error)
  }
}

/**
 * 保存展开状态到 localStorage
 */
const saveExpandedGroups = () => {
  try {
    const groupIds = Array.from(expandedGroups.value)
    localStorage.setItem(EXPANDED_GROUPS_STORAGE_KEY, JSON.stringify(groupIds))
  } catch (error) {
    console.error('Failed to save expanded groups:', error)
  }
}

// 分组管理相关状态
const groupContextMenuVisible = ref(false)
const groupContextMenuStyle = ref({})
const selectedGroup = ref<SessionGroup | null>(null)
const contextMenuPosition = ref<{ x: number; y: number }>({ x: 0, y: 0 })
const groupFormVisible = ref(false)
const editingGroup = ref<SessionGroup | null>(null)

// 列表右键菜单状态
const listContextMenuVisible = ref(false)
const listContextMenuStyle = ref({})

// 会话右键菜单状态
const sessionContextMenuVisible = ref(false)
const sessionContextMenuStyle = ref({})
const sessionContextMenuPosition = ref<{ x: number; y: number }>({ x: 0, y: 0 })
const selectedSessionForMove = ref<Session | null>(null)
const showGroupSubmenu = ref(false)

// 确认对话框状态
const confirmDialogVisible = ref(false)
const confirmDialogTitle = ref('')
const confirmDialogMessage = ref('')
const confirmDialogIsWarning = ref(false)
let confirmDialogResolve: ((value: boolean) => void) | null = null

// 会话列表
const sessions = computed(() => sessionStore.sessions)

// 当前激活的会话
const activeSessionId = computed(() => sessionStore.activeSessionId)

// 会话分组列表
const sessionGroups = computed(() => {
  const groups = sessionStore.sessionGroups
  
  // 找到默认分组
  const defaultGroup = groups.find(g => g.name === '默认分组')
  
  if (!defaultGroup) {
    // 没有默认分组，直接返回所有分组（按 order 排序）
    return [...groups].sort((a, b) => a.order - b.order)
  }
  
  // 过滤出非默认分组
  const otherGroups = groups.filter(g => g.name !== '默认分组')
  
  // 默认分组排在最前面，其他分组按 order 排序
  return [defaultGroup, ...otherGroups.sort((a, b) => a.order - b.order)]
})

// 未分组的会话
const ungroupedSessions = computed(() => {
  return sessions.value.filter(s => !s.groupId)
})

// 定义事件
const emit = defineEmits<{
  (e: 'select', session: Session): void
  (e: 'add-session', groupId?: string): void
  (e: 'edit-session', session: Session): void
}>()

/**
 * 显示确认对话框
 */
const showConfirmDialog = (
  title: string,
  message: string,
  isWarning: boolean = false
): Promise<boolean> => {
  return new Promise((resolve) => {
    confirmDialogTitle.value = title
    confirmDialogMessage.value = message
    confirmDialogIsWarning.value = isWarning
    confirmDialogVisible.value = true
    confirmDialogResolve = resolve
  })
}

/**
 * 处理确认对话框的确认操作
 */
const handleConfirmDialogConfirm = () => {
  if (confirmDialogResolve) {
    confirmDialogResolve(true)
    confirmDialogResolve = null
  }
  // 关闭对话框
  confirmDialogVisible.value = false
}

/**
 * 处理确认对话框的取消操作
 */
const handleConfirmDialogCancel = () => {
  if (confirmDialogResolve) {
    confirmDialogResolve(false)
    confirmDialogResolve = null
  }
  // 关闭对话框
  confirmDialogVisible.value = false
}

/**
 * 处理确认对话框的关闭操作（点击遮罩层）
 */
const handleConfirmDialogClose = () => {
  if (confirmDialogResolve) {
    confirmDialogResolve(false)
    confirmDialogResolve = null
  }
  // 关闭对话框
  confirmDialogVisible.value = false
}

/**
 * 切换分组展开状态
 */
const toggleGroup = (groupId: string) => {
  if (expandedGroups.value.has(groupId)) {
    expandedGroups.value.delete(groupId)
  } else {
    expandedGroups.value.add(groupId)
  }
  // 保存展开状态
  saveExpandedGroups()
}

/**
 * 获取分组会话列表（仅直接子会话，不包括子分组）
 */
const getDirectGroupSessions = (groupId: string): Session[] => {
  return sessions.value.filter(s => s.groupId === groupId)
}

/**
 * 获取分组会话数量（包括子分组）
 */
const getGroupSessionCount = (groupId: string): number => {
  // 递归获取所有子分组 ID
  const getAllSubGroupIds = (gid: string): string[] => {
    const children = sessionStore.sessionGroups.filter(g => g.parentId === gid)
    const ids = children.map(c => c.id)
    return [...ids, ...children.flatMap(c => getAllSubGroupIds(c.id))]
  }

  const subGroupIds = getAllSubGroupIds(groupId)
  return sessions.value.filter(s => s.groupId && [groupId, ...subGroupIds].includes(s.groupId)).length
}

/**
 * 获取分组会话列表（包括子分组）
 */
const getGroupSessions = (groupId: string): Session[] => {
  // 递归获取所有子分组 ID
  const getAllSubGroupIds = (gid: string): string[] => {
    const children = sessionStore.sessionGroups.filter(g => g.parentId === gid)
    const ids = children.map(c => c.id)
    return [...ids, ...children.flatMap(c => getAllSubGroupIds(c.id))]
  }

  const subGroupIds = getAllSubGroupIds(groupId)
  return sessions.value.filter(s => s.groupId && [groupId, ...subGroupIds].includes(s.groupId))
}

/**
 * 检查是否有子分组
 */
const hasSubGroups = (groupId: string): boolean => {
  return sessionStore.sessionGroups.some(g => g.parentId === groupId)
}

/**
 * 检查是否可以在目标分组下创建子分组
 */
const canCreateSubGroupIn = (groupId: string): boolean => {
  const group = sessionStore.sessionGroups.find(g => g.id === groupId)
  if (!group) return false

  return group.depth < MAX_GROUP_DEPTH
}

/**
 * 获取分组头部 tooltip
 */
const getGroupHeaderTooltip = (group: SessionGroup): string => {
  const depthInfo = `层级：${group.depth}/${MAX_GROUP_DEPTH}`
  const expandInfo = expandedGroups.value.has(group.id)
    ? '点击折叠分组，精简会话列表'
    : '点击展开分组，查看会话列表'

  if (!canCreateSubGroupIn(group.id)) {
    return `${expandInfo} | ${depthInfo}（已达层级上限）`
  }

  return `${expandInfo} | ${depthInfo}`
}

/**
 * 创建子分组
 */
const handleCreateSubGroup = async (parentGroup: SessionGroup) => {
  // 检查层级限制
  const checkResult = await window.api.sessionGroup.checkCanCreateSubGroup(parentGroup.id)
  if (!checkResult.canCreate) {
    // 显示错误提示
    showLevelLimitAlert(checkResult.error || '无法创建子分组')
    return
  }

  // 打开分组表单，设置父分组
  editingGroup.value = {
    id: '',
    name: '',
    parentId: parentGroup.id,
    depth: parentGroup.depth + 1,
    order: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  groupFormVisible.value = true
  groupContextMenuVisible.value = false
}

/**
 * 处理分组右键菜单
 */
const handleGroupContextMenu = (event: MouseEvent, group: SessionGroup) => {
  // 阻止默认浏览器右键菜单
  event.preventDefault()
  event.stopPropagation()

  // 关闭其他菜单
  closeAllContextMenus()

  selectedGroup.value = group
  currentRightClickGroupId.value = group.id
  groupContextMenuVisible.value = true

  // 保存右键点击坐标
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }

  // 计算菜单位置
  const x = event.clientX
  const y = event.clientY

  groupContextMenuStyle.value = {
    position: 'fixed',
    left: `${x}px`,
    top: `${y}px`,
    zIndex: 1000
  }
}

/**
 * 处理审查元素
 */
const handleInspectElement = () => {
  console.log('[Renderer] handleInspectElement called')
  console.log('[Renderer] contextMenuPosition:', contextMenuPosition.value)
  console.log('[Renderer] window.api exists:', typeof window.api !== 'undefined')
  if (window.api) {
    console.log('[Renderer] window.api.openDevTools exists:', typeof window.api.openDevTools !== 'undefined')
  }
  
  groupContextMenuVisible.value = false
  
  if (window.api && window.api.openDevTools) {
    console.log('[Renderer] Calling window.api.openDevTools with:', contextMenuPosition.value)
    // 将响应式 Proxy 对象转换为普通对象，避免 IPC 克隆错误
    const plainPosition = { ...contextMenuPosition.value }
    window.api.openDevTools(plainPosition)
  } else {
    console.error('[Renderer] window.api.openDevTools is not available')
  }
}

/**
 * 处理会话审查元素
 */
const handleSessionInspectElement = () => {
  console.log('[Renderer] handleSessionInspectElement called')
  console.log('[Renderer] sessionContextMenuPosition:', sessionContextMenuPosition.value)
  console.log('[Renderer] window.api exists:', typeof window.api !== 'undefined')
  if (window.api) {
    console.log('[Renderer] window.api.openDevTools exists:', typeof window.api.openDevTools !== 'undefined')
  }
  
  sessionContextMenuVisible.value = false
  showGroupSubmenu.value = false
  
  if (window.api && window.api.openDevTools) {
    console.log('[Renderer] Calling window.api.openDevTools with:', sessionContextMenuPosition.value)
    // 将响应式 Proxy 对象转换为普通对象，避免 IPC 克隆错误
    const plainPosition = { ...sessionContextMenuPosition.value }
    window.api.openDevTools(plainPosition)
  } else {
    console.error('[Renderer] window.api.openDevTools is not available')
  }
}

/**
 * 从右键菜单连接会话
 */
const handleConnectFromMenu = () => {
  if (selectedSessionForMove.value) {
    handleConnect(selectedSessionForMove.value)
    sessionContextMenuVisible.value = false
    showGroupSubmenu.value = false
  }
}

/**
 * 从右键菜单编辑会话
 */
const handleEditFromMenu = () => {
  if (selectedSessionForMove.value) {
    handleEdit(selectedSessionForMove.value)
    sessionContextMenuVisible.value = false
    showGroupSubmenu.value = false
  }
}

/**
 * 从右键菜单复制会话
 */
const handleDuplicateFromMenu = () => {
  if (selectedSessionForMove.value) {
    handleDuplicate(selectedSessionForMove.value)
    sessionContextMenuVisible.value = false
    showGroupSubmenu.value = false
  }
}

/**
 * 从右键菜单删除会话
 */
const handleDeleteFromMenu = () => {
  if (selectedSessionForMove.value) {
    handleDelete(selectedSessionForMove.value)
    sessionContextMenuVisible.value = false
    showGroupSubmenu.value = false
  }
}

/**
 * 从右键菜单查看属性
 */
const handlePropertiesFromMenu = () => {
  if (selectedSessionForMove.value) {
    handleProperties(selectedSessionForMove.value)
    sessionContextMenuVisible.value = false
    showGroupSubmenu.value = false
  }
}

// 当前右键点击的分组 ID（用于添加会话）
const currentRightClickGroupId = ref<string | undefined>(undefined)

/**
 * 从右键菜单添加会话
 */
const handleNewSessionFromMenu = () => {
  // 关闭所有右键菜单
  closeAllContextMenus()
  
  // 传递当前右键点击的分组 ID，如果未指定则传到默认分组
  emit('add-session', currentRightClickGroupId.value)
  currentRightClickGroupId.value = undefined
}

/**
 * 处理列表右键菜单（新建分组）
 */
const handleListContextMenu = (event: MouseEvent) => {
  // 阻止默认浏览器右键菜单
  event.preventDefault()
  event.stopPropagation()

  // 关闭其他菜单
  closeAllContextMenus()

  // 空白区域右键，清除分组 ID，这样新增会话时会使用默认分组
  currentRightClickGroupId.value = undefined
  
  listContextMenuVisible.value = true

  // 计算菜单位置
  const x = event.clientX
  const y = event.clientY

  listContextMenuStyle.value = {
    position: 'fixed',
    left: `${x}px`,
    top: `${y}px`,
    zIndex: 1000
  }
}

/**
 * 处理会话右键菜单（移动到分组）
 */
const handleSessionContextMenu = (event: MouseEvent, session: Session) => {
  // 阻止默认浏览器右键菜单
  event.preventDefault()
  event.stopPropagation()

  // 关闭其他菜单
  closeAllContextMenus()

  selectedSessionForMove.value = session
  sessionContextMenuVisible.value = true
  showGroupSubmenu.value = false

  // 计算菜单位置
  const x = event.clientX
  const y = event.clientY

  // 保存右键点击的全局坐标（用于审查元素）
  sessionContextMenuPosition.value = { x, y }

  sessionContextMenuStyle.value = {
    position: 'fixed',
    left: `${x}px`,
    top: `${y}px`,
    zIndex: 1000
  }
}

/**
 * 关闭所有上下文菜单
 */
const closeAllContextMenus = () => {
  groupContextMenuVisible.value = false
  listContextMenuVisible.value = false
  sessionContextMenuVisible.value = false
  showGroupSubmenu.value = false
}

/**
 * 创建新分组
 */
const handleCreateGroup = () => {
  editingGroup.value = null
  groupFormVisible.value = true
  listContextMenuVisible.value = false
}

/**
 * 创建子分组（从右键菜单）
 */
const handleCreateSubGroupFromMenu = async () => {
  if (!selectedGroup.value) return

  // 检查层级限制
  const checkResult = await window.api.sessionGroup.checkCanCreateSubGroup(selectedGroup.value.id)
  if (!checkResult.canCreate) {
    // 显示错误提示
    showLevelLimitAlert(checkResult.error || '无法创建子分组')
    return
  }

  // 打开分组表单，设置父分组
  editingGroup.value = {
    id: '',
    name: '',
    parentId: selectedGroup.value.id,
    depth: selectedGroup.value.depth + 1,
    order: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  groupFormVisible.value = true
  groupContextMenuVisible.value = false
}

/**
 * 显示层级限制提示
 */
const showLevelLimitAlert = (message: string) => {
  // 使用确认对话框显示错误信息
  confirmDialogTitle.value = '层级限制提示'
  confirmDialogMessage.value = message
  confirmDialogIsWarning.value = true
  confirmDialogVisible.value = true
}

/**
 * 添加会话到分组
 */
const handleAddSessionToGroup = () => {
  // TODO: 打开会话选择对话框
  // 暂时先打开会话表单
  alert('请通过编辑会话来将其添加到此分组')
  groupContextMenuVisible.value = false
}

/**
 * 编辑分组
 */
const handleEditGroup = () => {
  if (selectedGroup.value) {
    editingGroup.value = selectedGroup.value
    groupFormVisible.value = true
    groupContextMenuVisible.value = false
  }
}

/**
 * 删除分组
 */
const handleDeleteGroup = async () => {
  if (selectedGroup.value) {
    const sessionCount = getGroupSessionCount(selectedGroup.value.id)

    // 根据分组内是否有会话显示不同的确认对话框
    if (sessionCount > 0) {
      // 有会话时需要二次确认
      const confirmed = await showConfirmDialog(
        '删除分组确认',
        `该分组包含 ${sessionCount} 个会话，删除分组将会话全部删除，确定继续？`,
        true // 显示警告样式
      )

      if (!confirmed) {
        groupContextMenuVisible.value = false
        return
      }
    } else {
      // 没有会话时简单确认
      const confirmed = await showConfirmDialog(
        '删除分组确认',
        `确定要删除分组 "${selectedGroup.value.name}" 吗？`
      )

      if (!confirmed) {
        groupContextMenuVisible.value = false
        return
      }
    }

    try {
      await window.api.sessionGroup.delete(selectedGroup.value.id)
      sessionStore.removeSessionGroup(selectedGroup.value.id)
    } catch (error) {
      console.error('Failed to delete group:', error)
      alert('删除分组失败')
    }
    groupContextMenuVisible.value = false
  }
}

/**
 * 关闭分组表单
 */
const handleCloseGroupForm = () => {
  groupFormVisible.value = false
  editingGroup.value = null
}

/**
 * 提交分组表单
 */
const handleSubmitGroupForm = async (data: { name: string; icon?: string }) => {
  try {
    if (editingGroup.value && editingGroup.value.id) {
      // 更新分组
      await window.api.sessionGroup.update(editingGroup.value.id, data)
      sessionStore.updateSessionGroup(editingGroup.value.id, data)
    } else {
      // 创建分组（支持子分组）
      const parentId = editingGroup.value?.parentId
      const group = await window.api.sessionGroup.create(data, parentId)
      sessionStore.addSessionGroup(group)
    }
    handleCloseGroupForm()
  } catch (error) {
    console.error('Failed to save group:', error)
    const errorMessage = error instanceof Error ? error.message : '保存分组失败'
    alert(errorMessage)
  }
}

/**
 * 显示移动到分组的子菜单
 */
const handleMoveToGroup = () => {
  showGroupSubmenu.value = !showGroupSubmenu.value
}

/**
 * 移动会话到指定分组
 */
const handleMoveToSpecificGroup = async (groupId: string) => {
  if (!selectedSessionForMove.value) return

  try {
    // 更新会话的分组
    await window.api.session.update(selectedSessionForMove.value.id, {
      groupId: groupId || undefined
    })

    // 更新本地状态
    const session = sessionStore.sessions.find(s => s.id === selectedSessionForMove.value!.id)
    if (session) {
      session.groupId = groupId || undefined
    }

    // 关闭菜单
    closeAllContextMenus()
  } catch (error) {
    console.error('Failed to move session:', error)
    alert('移动会话失败')
  }
}

/**
 * 选择会话
 */
const handleSelect = (session: Session) => {
  sessionStore.setActiveSession(session.id)
  emit('select', session)
}

/**
 * 连接会话
 * 双击会话时创建标签页并连接
 */
const handleConnect = async (session: Session) => {
  try {
    // 创建标签页（初始状态为disconnected）
    const tab = terminalStore.createTab(session.name, session.id)

    // 更新标签页状态为连接中
    terminalStore.updateTabStatus(tab.id, 'connecting')

    // 连接会话（使用tabId作为连接标识）
    await window.api.session.connect(tab.id, session.id)

    // 更新标签页状态为已连接
    terminalStore.updateTabStatus(tab.id, 'connected')
  } catch (error: unknown) {
    console.error('Failed to connect:', error)

    // 连接失败，更新标签页状态为错误
    const tab = terminalStore.tabs.find(t => t.sessionId === session.id)
    if (tab) {
      terminalStore.updateTabStatus(tab.id, 'error')
    }

    // 显示错误对话框
    const errorMessage = error instanceof Error ? error.message : String(error)
    showErrorDialog('连接失败', errorMessage, session.id)
  }
}

/**
 * 编辑会话
 */
const handleEdit = (session: Session) => {
  emit('edit', session)
}

/**
 * 删除会话
 */
const handleDelete = async (session: Session) => {
  if (confirm(`确定要删除会话 "${session.name}" 吗？`)) {
    await window.api.session.delete(session.id)
    sessionStore.removeSession(session.id)
  }
}

/**
 * 复制会话
 */
const handleDuplicate = async (session: Session) => {
  try {
    // 创建新会话配置
    const newSession = {
      ...session,
      id: undefined,
      name: `${session.name} (副本)`
    }

    // 保存新会话
    const createdSession = await window.api.session.create(newSession)
    sessionStore.addSession(createdSession)
  } catch (error) {
    console.error('Failed to duplicate session:', error)
  }
}

/**
 * 显示会话属性
 */
const handleProperties = (session: Session) => {
  // TODO: 实现属性对话框
  emit('edit', session)
}

/**
 * 显示错误对话框
 * @param title - 错误标题
 * @param message - 错误信息
 * @param sessionId - 会话ID
 */
const showErrorDialog = (title: string, message: string, sessionId: string): void => {
  errorDialogStore.showError(title, message, sessionId)
}

/**
 * 关闭错误对话框
 */
const handleCloseErrorDialog = (): void => {
  errorDialogStore.closeError()
}

/**
 * 重试连接
 * 从错误对话框中点击"重新输入密码"
 */
const handleRetryConnect = (sessionId: string): void => {
  // 找到对应的会话
  const session = sessions.value.find(s => s.id === sessionId)
  if (session) {
    // 打开编辑表单，让用户重新输入密码
    emit('edit', session)
  }
}

/**
 * 从错误对话框中编辑会话
 */
const handleEditFromError = (sessionId: string): void => {
  // 找到对应的会话
  const session = sessions.value.find(s => s.id === sessionId)
  if (session) {
    // 打开编辑表单
    emit('edit', session)
  }
}

// 初始化加载会话列表和分组
onMounted(async () => {
  loading.value = true
  try {
    // 加载会话列表
    const sessionList = await window.api.session.getAll()
    sessionStore.sessions = sessionList

    // 加载会话分组
    const groups = await window.api.sessionGroup.getAll()
    sessionStore.sessionGroups = groups

    // 加载展开状态
    loadExpandedGroups()
  } catch (error) {
    console.error('Failed to load sessions:', error)
  } finally {
    loading.value = false
  }
})

/**
 * 点击外部关闭菜单
 */
const handleClickOutside = (event: MouseEvent) => {
  closeAllContextMenus()
}

// 添加和移除全局点击事件监听
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.session-list-container {
  display: flex;
  height: 100%;
  position: relative;
}

.session-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  padding: 24px;
  color: var(--text-secondary, #808080);
  font-size: 13px;
}

.empty-state .hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-tertiary, #606060);
}

.session-groups {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.session-list-spacer {
  flex: 1;
  min-height: 100px;
  pointer-events: auto;
}

.session-group {
  margin-bottom: 4px;
}

.group-header {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  color: var(--text-color, #cccccc);
  font-size: 12px;
  transition: background-color 0.15s;
  position: relative;
}

.group-header:hover {
  background-color: var(--hover-bg, #2a2a2a);
}

/* 层级限制达到时的样式 - 显式设置 opacity 为 1，使文字显示效果与其他层一致 */
.group-header.depth-limit-reached {
  opacity: 1; /* 保持与其他分组相同的显示效果 */
  cursor: not-allowed;
}

.group-header.depth-limit-reached:hover {
  background-color: transparent;
}

.expand-icon {
  margin-right: 6px;
  transition: transform 0.15s;
  flex-shrink: 0;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.group-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-count {
  font-size: 11px;
  color: var(--text-tertiary, #606060);
  margin-left: 8px;
  padding: 1px 6px;
  background-color: var(--hover-bg, #2a2a2a);
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
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
  color: var(--text-secondary, #808080);
  opacity: 0;
  transition: all 0.2s;
  flex-shrink: 0;
  margin-left: 4px;
}

.group-header:hover .add-subgroup-btn {
  opacity: 1;
}

.add-subgroup-btn:hover {
  background-color: var(--color-primary-light-9, rgba(64, 158, 255, 0.1));
  color: var(--color-primary, #409eff);
}

/* 分组内容区域 */
.group-content {
  display: flex;
  flex-direction: column;
}

/* 会话项容器，确保嵌套时会话项宽度正确 */
.group-sessions {
  padding-left: 24px;
}

/* 右键菜单样式 */
.context-menu {
  position: fixed;
  background: var(--bg-secondary, #2a2a2a);
  border: 1px solid var(--border-color, #3a3a3a);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  padding: 4px 0;
  min-width: 160px;
  z-index: 1000;
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  color: var(--text-primary, #e0e0e0);
  font-size: 13px;
  transition: background-color 0.15s;
}

.menu-item:hover {
  background-color: var(--hover-bg, #3a3a3a);
}

.menu-item.danger {
  color: #ff6b6b;
}

.menu-item.danger:hover {
  background-color: rgba(255, 107, 107, 0.1);
}

.menu-item svg {
  flex-shrink: 0;
}

/* 菜单分隔线 */
.menu-divider {
  height: 1px;
  background: var(--border-color, #3a3a3a);
  margin: 4px 0;
}

/* 子菜单相关 */
.menu-item.has-submenu {
  position: relative;
}

.submenu-arrow {
  margin-left: auto;
  opacity: 0.6;
}

.menu-item.has-submenu:hover .submenu-arrow {
  opacity: 1;
}

.submenu {
  position: absolute;
  left: 100%;
  top: -4px;
  background: var(--bg-secondary, #2a2a2a);
  border: 1px solid var(--border-color, #3a3a3a);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  padding: 4px 0;
  min-width: 140px;
  margin-left: 4px;
  animation: slideIn 0.15s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.submenu .menu-item {
  padding: 8px 12px;
}

.submenu .menu-item.active {
  background: var(--primary-color, #0e639c);
  color: white;
}


/* 深色主题 */
[data-theme='dark'] .context-menu {
  background: #2a2a2a;
  border-color: #3a3a3a;
}

/* 浅色主题 */
[data-theme='light'] .context-menu {
  background: #ffffff;
  border-color: #e0e0e0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

[data-theme='light'] .menu-item {
  color: #333333;
}

[data-theme='light'] .menu-item:hover {
  background-color: #f5f5f5;
}

[data-theme='light'] .menu-item.danger:hover {
  background-color: rgba(255, 107, 107, 0.1);
}

[data-theme='light'] .submenu {
  background: #ffffff;
  border-color: #e0e0e0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

[data-theme='light'] .submenu .menu-item:hover {
  background-color: #f5f5f5;
}

[data-theme='light'] .submenu .menu-item.active {
  background: var(--primary-color, #0e639c);
  color: white;
}
</style>
