/**
 * 点击Session连接按钮,会创建一个标签页 
 * 单个标签页组件
 * 显示标签页标题、连接状态和关闭按钮
 * @module components/terminal/TerminalTab
 */

<template>
  <div 
    class="terminal-tab" 
    :class="{ active, 'sftp-tab': tab.type === 'sftp' }" 
    @click="$emit('click')"
    @contextmenu.prevent="handleContextMenu"
  >
    <!-- 连接状态指示器 -->
    <span class="status-indicator" :class="tab.status">
      <span class="status-dot"></span>
    </span>

    <!-- 标签类型图标：SFTP 显示文件夹图标 -->
    <span v-if="tab.type === 'sftp'" class="type-icon sftp-icon" title="SFTP 文件传输">
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
        <path
          d="M10 1H4a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V5l-2-2zM10 1v4h4"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
    
    <!-- 标签标题 -->
    <span class="tab-title">{{ tab.title }}</span>

    <!-- 关闭按钮 -->
    <button class="close-btn" title="关闭" @click.stop="$emit('close')">
      <svg width="10" height="10" viewBox="0 0 10 10">
        <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.5" />
      </svg>
    </button>

    <!-- 连接错误对话框 -->
    <ErrorDialog
      :visible="errorDialogVisible"
      :title="errorDialogTitle"
      :message="errorDialogMessage"
      :session-id="errorDialogSessionId"
      :show-retry="true"
      :show-edit="true"
      @close="handleCloseErrorDialog"
      @retry="handleRetryConnect"
      @edit="handleEditFromError"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTerminalStore } from '@/stores/terminal'
import { useSessionStore } from '@/stores/session'
import { useContextMenuStore } from '@/stores/contextMenu'
import { useErrorDialogStore } from '@/stores/errorDialog'
import ErrorDialog from '@/components/common/ErrorDialog.vue'
import type { Tab } from '@shared/types'

// 定义属性
const props = defineProps<{
  tab: Tab
  active: boolean
}>()

// 定义事件
defineEmits<{
  (e: 'click'): void
  (e: 'close'): void
}>()

// 状态管理
const terminalStore = useTerminalStore()
const sessionStore = useSessionStore()
const contextMenuStore = useContextMenuStore()
const errorDialogStore = useErrorDialogStore()

/** 标签页右键菜单 owner ID */
const menuOwnerId = 'tab'

// 错误对话框相关计算属性
const errorDialogVisible = computed(() => errorDialogStore.visible)
const errorDialogTitle = computed(() => errorDialogStore.title)
const errorDialogMessage = computed(() => errorDialogStore.message)
const errorDialogSessionId = computed(() => errorDialogStore.sessionId)

/** 从 terminalStore 获取标签页实时连接状态 */
const tabStatus = computed(() => {
  const storeTab = terminalStore.getTabById(props.tab.id)
  return storeTab?.status ?? props.tab.status
})

/** 计算属性：是否可以断开会话 */
const canDisconnect = computed(() => {
  return tabStatus.value === 'connected' || tabStatus.value === 'connecting'
})

/** 计算属性：是否可以重连会话 */
const canReconnect = computed(() => {
  return tabStatus.value === 'disconnected' || tabStatus.value === 'error'
})

/**
 * 处理右键菜单显示：使用全局 GlobalContextMenu 组件
 */
const handleContextMenu = (event: MouseEvent): void => {
  let x = event.clientX
  let y = event.clientY

  /* 确保菜单不超出窗口右边界 */
  const menuWidth = 160
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10
  }

  /* 确保菜单不超出窗口下边界 */
  const menuHeight = 120
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10
  }

  const menuItems = [
    { action: 'duplicate', title: '复制会话', icon: 'duplicate' },
    {
      action: 'disconnect',
      title: '断开会话',
      icon: 'disconnect',
      visible: canDisconnect.value
    },
    {
      action: 'reconnect',
      title: '重连会话',
      icon: 'connect',
      visible: canReconnect.value
    }
  ]

  contextMenuStore.showContextMenu(menuOwnerId, { x, y }, menuItems, (action: string) => {
    switch (action) {
      case 'duplicate':
        handleDuplicateSession()
        break
      case 'disconnect':
        handleDisconnectSession()
        break
      case 'reconnect':
        handleReconnectSession()
        break
    }
  })
}

/**
 * 处理复制会话
 */
const handleDuplicateSession = async (): Promise<void> => {
  // 获取当前会话信息
  const session = await sessionStore.getSessionById(props.tab.sessionId)
  if (!session) return
  
  // 创建新标签页
  const newTab = terminalStore.createTab(session.name, session.id)
  
  // 连接会话
  try {
    terminalStore.updateTabStatus(newTab.id, 'connecting')
    await window.api.session.connect(newTab.id, session.id)
    terminalStore.updateTabStatus(newTab.id, 'connected')
  } catch (error: unknown) {
    console.error('Failed to connect:', error)
    terminalStore.updateTabStatus(newTab.id, 'error')
    
    // 显示错误对话框
    const errorMessage = error instanceof Error ? error.message : String(error)
    showErrorDialog('连接失败', errorMessage, session.id)
  }
}

/**
 * 处理断开会话
 */
const handleDisconnectSession = async (): Promise<void> => {
  if (!canDisconnect.value) return

  try {
    if (props.tab.type === 'sftp' && props.tab.sftpConnectionId) {
      await window.api.sftp.disconnect(props.tab.sftpConnectionId)
    } else {
      await window.api.session.disconnect(props.tab.id)
    }
    terminalStore.updateTabStatus(props.tab.id, 'disconnected')
  } catch (error) {
    console.error('Failed to disconnect:', error)
  }
}

/**
 * 处理重连会话
 */
const handleReconnectSession = async (): Promise<void> => {
  if (!canReconnect.value) return

  try {
    terminalStore.updateTabStatus(props.tab.id, 'connecting')
    if (props.tab.type === 'sftp' && props.tab.sftpConnectionId) {
      const result = await window.api.sftp.connect(props.tab.sftpConnectionId, props.tab.sessionId)
      if (!result.success) {
        throw new Error(result.error || 'SFTP 重连失败')
      }
    } else {
      await window.api.session.connect(props.tab.id, props.tab.sessionId)
    }
    terminalStore.updateTabStatus(props.tab.id, 'connected')
  } catch (error: unknown) {
    console.error('Failed to reconnect:', error)
    terminalStore.updateTabStatus(props.tab.id, 'error')

    const errorMessage = error instanceof Error ? error.message : String(error)
    showErrorDialog('重连失败', errorMessage, props.tab.sessionId)
  }
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
  const session = sessionStore.getSessionById(sessionId)
  if (session) {
    // 发送事件，让父组件打开编辑表单
    // 注意：这里需要父组件监听并处理
    console.log('Retry connect for session:', sessionId)
  }
}

/**
 * 从错误对话框中编辑会话
 */
const handleEditFromError = (sessionId: string): void => {
  // 找到对应的会话
  const session = sessionStore.getSessionById(sessionId)
  if (session) {
    // 发送事件，让父组件打开编辑表单
    // 注意：这里需要父组件监听并处理
    console.log('Edit session:', sessionId)
  }
}
</script>

<style scoped>
.terminal-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 8px 0 12px;
  background-color: var(--tab-bg, var(--bg-color, #f0f0f0));
  border-right: 1px solid var(--border-color, #e0e0e0);
  cursor: pointer;
  min-width: 100px;
  max-width: 200px;
  transition: background-color 0.15s;
  -webkit-app-region: no-drag;
}

.terminal-tab:hover {
  background-color: var(--tab-hover-bg, var(--hover-bg, #e5e5e5));
}

.terminal-tab.active {
  background-color: var(--tab-active-bg, var(--bg-color, #ffffff));
}

/* SFTP 标签页特殊样式 */
.terminal-tab.sftp-tab {
  background: linear-gradient(135deg, var(--tab-bg, var(--bg-color, #f0f0f0)) 0%, rgba(76, 175, 80, 0.06) 100%);
  border-left: 3px solid transparent;
}

.terminal-tab.sftp-tab:hover {
  background: linear-gradient(135deg, var(--tab-hover-bg, var(--hover-bg, #e5e5e5)) 0%, rgba(76, 175, 80, 0.10) 100%);
}

/* SFTP 激活状态：高亮 + 左侧绿色指示条 */
.terminal-tab.sftp-tab.active {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.12) 0%, rgba(76, 175, 80, 0.18) 100%);
  border-left: 3px solid #4CAF50;
  box-shadow: inset 0 0 8px rgba(76, 175, 80, 0.1);
}

/* SFTP 未激活：图标和文字变暗 */
.terminal-tab.sftp-tab:not(.active) .type-icon.sftp-icon {
  opacity: 0.5;
}

.terminal-tab.sftp-tab:not(.active) .tab-title {
  opacity: 0.6;
}

/* SFTP 激活：图标和文字明亮 */
.terminal-tab.sftp-tab.active .type-icon.sftp-icon {
  color: #4CAF50;
}

.terminal-tab.sftp-tab.active .tab-title {
  color: var(--text-color, #333333);
}

/* 标签类型图标 */
.type-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #999);
  flex-shrink: 0;
}

.type-icon.sftp-icon {
  color: #4CAF50;
}

/* 连接状态指示器 */
.status-indicator {
  display: flex;
  align-items: center;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--text-tertiary, #aaaaaa);
}

/* 已连接状态 - 绿色 */
.status-indicator.connected .status-dot {
  background-color: #4ec9b0;
}

/* 连接中状态 - 黄色闪烁 */
.status-indicator.connecting .status-dot {
  background-color: #dcdcaa;
  animation: pulse 1s infinite;
}

/* 断开状态 - 灰色 */
.status-indicator.disconnected .status-dot {
  background-color: var(--text-tertiary, #aaaaaa);
}

/* 错误状态 - 红色 */
.status-indicator.error .status-dot {
  background-color: #f14c4c;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.tab-title {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary, #888888);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.terminal-tab.active .tab-title {
  color: var(--text-color, #333333);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: var(--text-tertiary, #aaaaaa);
  cursor: pointer;
  border-radius: 3px;
  opacity: 0;
  transition: all 0.15s;
}

.terminal-tab:hover .close-btn {
  opacity: 1;
}

.close-btn:hover {
  background-color: var(--hover-bg, #e5e5e5);
  color: var(--text-color, #333333);
}

/* SFTP 激活：图标和文字明亮 */
.terminal-tab.sftp-tab.active .type-icon.sftp-icon {
  color: #4CAF50;
}

.terminal-tab.sftp-tab.active .tab-title {
  color: var(--text-color, #333333);
}
</style>
