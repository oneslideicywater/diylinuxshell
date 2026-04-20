/**
* 会话侧边栏容器组件
* 管理会话列表、分组、表单对话框等
* @module components/session/SessionSidebarContainer
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
            @duplicate="handleDuplicate(session)" @properties="handleProperties(session)" @sftp="handleSftp(session)"
            @add-session="(groupId?: string) => handleAddSessionFromItem(groupId, session)" />
        </div>

        <!-- 分组会话（支持嵌套） -->
        <template v-for="group in sessionGroups" :key="group.id">
          <div v-if="!group.parentId" class="session-group" :data-group-id="group.id" :data-group-depth="group.depth">
            <!-- 分组头部 -->
            <GroupHeader
              :group="group"
              :is-expanded="expandedGroups.has(group.id)"
              :session-count="getGroupSessionCount(group.id)"
              :can-create-sub-group="canCreateSubGroupIn(group.id)"
              @toggle="toggleGroup(group.id)"
              @add-session-to-group="handleAddSessionToGroup"
              @create-subgroup="handleCreateSubGroupFromGroupHeader"
              @edit-group="handleEditGroupFromGroupHeader"
              @delete-group="handleDeleteGroupFromGroupHeader"
            />

            <!-- 分组内容（包含子分组和会话） -->
            <div v-show="expandedGroups.has(group.id)" class="group-content">
              <!-- 递归渲染子分组 -->
              <SessionGroupTree v-if="hasSubGroups(group.id)" :parent-group-id="group.id" :all-groups="sessionGroups"
                :sessions="sessions" :expanded-groups="expandedGroups" :active-session-id="activeSessionId"
                @toggle-group="toggleGroup" @select-session="handleSelect" @connect-session="handleConnect"
                @edit-session="handleEdit" @delete-session="handleDelete" @duplicate-session="handleDuplicate"
                @properties-session="handleProperties"
                @create-subgroup="handleCreateSubGroup"
                @add-session-to-group="handleAddSessionToGroup" />

              <!-- 当前分组的会话 -->
              <div class="group-sessions">
                <SessionItem v-for="session in getDirectGroupSessions(group.id)" :key="session.id" :session="session"
                  :active="session.id === activeSessionId" @click="handleSelect(session)"
                  @dblclick="handleConnect(session)" @connect="handleConnect(session)" @edit="handleEdit(session)"
                  @delete="handleDelete(session)" @duplicate="handleDuplicate(session)"
                  @properties="handleProperties(session)" @sftp="handleSftp(session)"
                  @add-session="(groupId?: string) => handleAddSessionFromItem(groupId, session)" />
              </div>
            </div>
          </div>
        </template>

        <!-- 空白占位区域，用于捕获右键点击 -->
        <div class="session-list-spacer" @contextmenu.prevent="handleListContextMenu"></div>
      </div>
  </div>

    <!-- 分组表单对话框 -->
    <SessionGroupForm :visible="groupFormVisible" :group="editingGroup" @close="handleCloseGroupForm"
      @submit="handleSubmitGroupForm" />

    <!-- 会话表单对话框 -->
    <SessionForm :visible="sessionFormVisible" :session="editingSession" @close="handleCloseSessionForm"
      @save="handleSubmitSessionForm" />

    <!-- 确认对话框 -->
    <ConfirmDialog :visible="confirmDialogVisible" :title="confirmDialogTitle" :message="confirmDialogMessage"
      :is-warning="confirmDialogIsWarning" @close="handleConfirmDialogClose" @confirm="handleConfirmDialogConfirm"
      @cancel="handleConfirmDialogCancel" />

    <!-- 连接错误对话框 -->
    <ErrorDialog :visible="errorDialogVisible" :title="errorDialogTitle" :message="errorDialogMessage"
      :session-id="errorDialogSessionId" :show-retry="true" :show-edit="true" @close="handleCloseErrorDialog"
      @retry="handleRetryConnect" @edit="handleEditFromError" />

    <!-- 统一提示对话框（替代 alert） -->
    <AlertDialog
      :visible="alertDialogVisible"
      :title="alertDialogConfig.title"
      :message="alertDialogConfig.message"
      :is-error="alertDialogConfig.isError"
      @confirm="handleAlertDialogClose"
      @close="handleAlertDialogClose"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useTerminalStore } from '@/stores/terminal'
import { useErrorDialogStore } from '@/stores/errorDialog'
import { useContextMenuStore, type ContextMenuItem } from '@/stores/contextMenu'
import SessionItem from './SessionItem.vue'
import SessionGroupForm from './SessionGroupForm.vue'
import SessionForm from './SessionForm.vue'
import ErrorDialog from '@/components/common/ErrorDialog.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import AlertDialog from '@/components/common/AlertDialog.vue'
import SessionGroupTree from './SessionGroupTree.vue'
import GroupHeader from './GroupHeader.vue'
import { useSessionGroup } from './script/useSessionGroup'
import type { Session, SessionGroup } from '@shared/types'

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

/** 统一提示对话框状态（替代 alert） */
const alertDialogVisible = ref(false)
const alertDialogConfig = ref({ title: '提示', message: '', isError: false })

function showAlert(message: string, title = '提示', isError = false): void {
  alertDialogConfig.value = { title, message, isError }
  alertDialogVisible.value = true
}

function handleAlertDialogClose(): void {
  alertDialogVisible.value = false
}

/* 全局右键菜单 Store */
const contextMenuStore = useContextMenuStore()

/* 列表右键菜单唯一标识 */
const listMenuOwnerId = 'session-sidebar-list'

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
const groupFormVisible = ref(false)
const editingGroup = ref<SessionGroup | null>(null)

// 会话表单相关状态
const sessionFormVisible = ref(false)
const editingSession = ref<Session | null>(null)

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

// 使用分组工具函数 composable（提取公共逻辑，避免与 SessionGroupTree 重复）
const {
  getDirectGroupSessions,
  getGroupSessionCount,
  hasSubGroups,
  canCreateSubGroupIn
} = useSessionGroup({
  allGroups: computed(() => sessionStore.sessionGroups),
  sessions: computed(() => sessions.value)
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
}

/**
 * 关闭所有上下文菜单
 * 用于在打开新菜单或点击外部时清除所有已打开的菜单状态
 */
const closeAllContextMenus = () => {
  contextMenuStore.hideContextMenu()
}

/**
 * 添加会话到分组
 */
const handleAddSessionToGroup = async (group: SessionGroup) => {
  // 关闭分组菜单
  closeAllContextMenus()
  
  // 打开会话表单，设置分组 ID
  editingSession.value = {
    id: '',
    name: '',
    host: '',
    port: 22,
    username: 'root',
    authType: 'password',
    groupId: group.id,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  sessionFormVisible.value = true
}

/**
 * 从 SessionItem 组件接收添加会话请求
 * @param groupId - 目标分组 ID（可选）
 * @param session - 触发事件的会话（用于获取上下文信息）
 */
const handleAddSessionFromItem = (groupId?: string, _session?: Session): void => {
  emit('add-session', groupId)
}

/**
 * 处理列表右键菜单（新建分组）
 * 通过全局 Store 管理菜单状态
 */
const handleListContextMenu = (event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()

  let x = event.clientX
  let y = event.clientY

  /* 边界检测：防止菜单超出窗口 */
  const menuWidth = 160
  const menuHeight = 40
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10
  }

  /* 构建菜单项列表 */
  const menuItems: ContextMenuItem[] = [
    { action: 'create-group', title: '新建分组', icon: 'create-folder', description: '创建会话分组，归类管理远程主机连接' }
  ]

  /* 通过 Store 显示右键菜单（注册所有权 + 菜单项 + 回调） */
  contextMenuStore.showContextMenu(listMenuOwnerId, { x, y }, menuItems, (action: string) => {
    switch (action) {
      case 'create-group':
        handleCreateGroup()
        break
    }
  })
}

/**
 * 创建新分组
 */
const handleCreateGroup = () => {
  editingGroup.value = null
  groupFormVisible.value = true
}

/**
 * 从 GroupHeader 创建子分组（修复 Bug 1：确保在正确的父分组下创建）
 * @param group - 当前右键点击的分组（作为父分组）
 */
const handleCreateSubGroupFromGroupHeader = async (group: SessionGroup) => {
  // 检查层级限制
  const checkResult = await window.api.sessionGroup.checkCanCreateSubGroup(group.id)
  if (!checkResult.canCreate) {
    // 显示错误提示
    showLevelLimitAlert(checkResult.error || '无法创建子分组')
    return
  }

  // 打开分组表单，设置父分组为当前右键的分组（修复 Bug 1 的关键）
  editingGroup.value = {
    id: '',
    name: '',
    parentId: group.id,  // ✅ 使用传入的 group.id 而不是 selectedGroup
    depth: group.depth + 1,
    order: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  groupFormVisible.value = true
}

/**
 * 从 GroupHeader 编辑分组
 * @param group - 当前右键点击的分组
 */
const handleEditGroupFromGroupHeader = (group: SessionGroup) => {
  editingGroup.value = group
  groupFormVisible.value = true
}

/**
 * 从 GroupHeader 删除分组
 * @param group - 当前右键点击的分组
 */
const handleDeleteGroupFromGroupHeader = async (group: SessionGroup) => {
  const sessionCount = getGroupSessionCount(group.id)

  // 根据分组内是否有会话显示不同的确认对话框
  if (sessionCount > 0) {
    // 有会话时需要二次确认
    const confirmed = await showConfirmDialog(
      '删除分组确认',
      `该分组包含 ${sessionCount} 个会话，删除分组将会话全部删除，确定继续？`,
      true // 显示警告样式
    )

    if (!confirmed) return
  } else {
    // 没有会话时简单确认
    const confirmed = await showConfirmDialog(
      '删除分组确认',
      `确定要删除分组 "${group.name}" 吗？`
    )

    if (!confirmed) return
  }

  try {
    await window.api.sessionGroup.delete(group.id)
    sessionStore.removeSessionGroup(group.id)
  } catch (error) {
    console.error('Failed to delete group:', error)
    showAlert('删除分组失败', '错误', true)
  }
}

/**
 * 显示层级限制提示
 */
const showLevelLimitAlert = (message: string): void => {
  showAlert(message, '层级限制提示', true)
}

/**
 * 关闭分组表单
 */
const handleCloseGroupForm = () => {
  groupFormVisible.value = false
  editingGroup.value = null
}

/**
 * 关闭会话表单
 */
const handleCloseSessionForm = () => {
  sessionFormVisible.value = false
  editingSession.value = null
}

/**
 * 打开 SFTP 文件传输（创建 SFTP 标签页）
 */
const handleSftp = (session: Session) => {
  if (!session) {
    console.error('Session is null')
    return
  }
  
  // 切换到 SFTP 模式
  terminalStore.switchMode('sftp')
  
  // 调用 terminal store 创建 SFTP 标签页
  const sftpTab = terminalStore.createSftpTab(session.name, session)
  console.log(`[SessionList] 创建 SFTP 标签页: ${sftpTab.title} (ID: ${sftpTab.id})`)
}

/**
 * 提交分组表单
 */
const handleSubmitGroupForm = async (data: { name: string; parentId?: string; depth?: number }) => {
  try {
    if (editingGroup.value && editingGroup.value.id) {
      // 更新分组
      await window.api.sessionGroup.update(editingGroup.value.id, data)
      sessionStore.updateSessionGroup(editingGroup.value.id, data)
    } else {
      // 创建分组（修复：正确传递 parentId 作为第二个参数）
      const parentId = data.parentId || editingGroup.value?.parentId
      
      const group = await window.api.sessionGroup.create(
        { name: data.name },  // 第一个参数：基本数据
        parentId              // 第二个参数：父分组 ID（关键修复！）
      )
      sessionStore.addSessionGroup(group)
    }
    handleCloseGroupForm()
  } catch (error) {
    console.error('Failed to save group:', error)
    const errorMessage = error instanceof Error ? error.message : '保存分组失败'
    showAlert(errorMessage, '错误', true)
  }
}

/**
 * 提交会话表单
 */
const handleSubmitSessionForm = async (data: Partial<Session>) => {
  try {
    if (data.id) {
      // 更新会话
      await window.api.session.update(data.id, data)
      sessionStore.updateSession(data.id, data)
    } else {
      // 创建会话（SessionForm 已确保必填字段不为空）
      const session = await window.api.session.create(data as Omit<Session, 'id' | 'createdAt' | 'updatedAt'>)
      sessionStore.addSession(session)
    }
    handleCloseSessionForm()
  } catch (error) {
    console.error('Failed to save session:', error)
    const errorMessage = error instanceof Error ? error.message : '保存会话失败'
    showAlert(errorMessage, '错误', true)
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
    // 切换到 SSH 模式
    terminalStore.switchMode('ssh')

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
  console.log('[SessionList] handleEdit 被调用, session:', session.name)
  emit('edit-session', session)
}

/**
 * 删除会话
 */
const handleDelete = async (session: Session) => {
  const confirmed = await showConfirmDialog(
    '确认删除',
    `确定要删除会话 "${session.name}" 吗？`
  )
  if (!confirmed) return
  await window.api.session.delete(session.id)
  sessionStore.removeSession(session.id)
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
  // 打开编辑表单
  emit('edit-session', session)
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
    emit('edit-session', session)
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
    emit('edit-session', session)
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
const handleClickOutside = (_event: MouseEvent) => {
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
  color: var(--text-secondary, #808080);
  opacity: 0;
  transition: all 0.2s;
  flex-shrink: 0;
  margin-left: 4px;
}

.group-header:hover .add-session-btn {
  opacity: 1;
}

.add-session-btn:hover {
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
</style>
