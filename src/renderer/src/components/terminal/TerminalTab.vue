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
    <!-- 标签类型图标：SFTP 显示文件夹图标，SSH 显示链接图标，颜色跟随连接状态 -->
    <span v-if="tab.type === 'sftp'" class="type-icon sftp-icon" :class="tabStatus" title="SFTP 文件传输">
      <svg width="12" height="12" viewBox="0 0 1024 1024" fill="none">
        <path d="M908.255415 327.14824v498.886615c0 28.900021-23.409017 52.309038-52.309038 52.309038h-687.820504c-28.900021 0-52.309038-23.409017-52.309038-52.309038V240.231426c0-28.900021 23.409017-52.309038 52.309038-52.309038h306.195724c15.244761 0 29.911522 5.996754 40.82128 16.617512l45.445284 44.361532c17.051012 16.617512 39.882029 25.937769 63.724546 25.937769h231.63367c28.900021 0 52.309038 23.409017 52.309038 52.309039z" fill="currentColor" />
        <path d="M795.545333 385.454032H223.758414c-17.773513 0-32.223524 14.450011-32.223524 32.223524V449.395329h638.112468v-29.767022c0.07225-18.857264-15.244761-34.174275-34.102025-34.174275z" fill="currentColor" opacity="0.3" />
      </svg>
    </span>
    <span v-if="tab.type === 'ssh'" class="type-icon ssh-icon" :class="tabStatus" title="SSH 连接">
      <svg width="14" height="12" viewBox="0 0 2474 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1126.306141 694.811432c30.120157 0 54.566119 24.573952 54.56612 54.864762v50.726439c0 123.424381-99.618365 223.554704-222.445463 223.554704H509.39755C229.228898 1023.914674 0 793.533872 0 511.957337S229.228898 0 509.39755 0h448.986585c122.869761 0 222.445463 100.002333 222.445463 223.469378v50.769102c0 30.290809-24.445963 54.864761-54.608783 54.864761-30.16282 0-54.608783-24.573952-54.608783-54.864761v-50.769102a113.569203 113.569203 0 0 0-113.227897-113.782519H509.39755C288.402633 109.729523 109.217565 289.810516 109.217565 511.957337c0 222.146821 179.185068 402.270477 400.265311 402.270477h448.986585a113.611866 113.611866 0 0 0 113.270561-113.825181v-50.769102c0-30.248146 24.4033-54.822098 54.608782-54.822099zM1964.977585 0c280.168653 0 509.39755 230.380802 509.39755 511.957337s-229.228898 511.957337-509.39755 511.957337H1516.076327c-122.869761 0-222.445463-100.087659-222.445463-223.554704v-50.683776c0-30.290809 24.445963-54.864761 54.608783-54.864762 30.120157 0 54.566119 24.573952 54.566119 54.864762v50.726439a113.569203 113.569203 0 0 0 113.270561 113.825181h448.943921c221.03758 0 400.265311-180.123656 400.265312-402.270477s-179.185068-402.227814-400.265312-402.227814H1516.076327a113.526539 113.526539 0 0 0-113.270561 113.782518v50.769102c0 30.290809-24.445963 54.864761-54.608782 54.864762-30.120157 0-54.608783-24.573952-54.608783-54.864762v-50.769102C1293.630864 100.044996 1393.249229 0 1516.11899 0h448.943921zM626.806433 511.957337c0-30.290809 24.445963-54.822098 54.608782-54.822098h1111.630031c30.120157 0 54.608783 24.531289 54.608783 54.822098s-24.488626 54.864761-54.608783 54.864761H681.415215c-30.16282 0-54.608782-24.573952-54.608782-54.864761z" fill="currentColor" />
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
  
  // 连接会话（传入终端初始尺寸，确保远程 PTY 与前端终端大小一致）
  try {
    terminalStore.updateTabStatus(newTab.id, 'connecting')
    const initialSize = terminalStore.getTerminalSize(newTab.id)
    await window.api.session.connect(newTab.id, session.id, initialSize ? { cols: initialSize.cols, rows: initialSize.rows } : undefined)
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
      const initialSize = terminalStore.getTerminalSize(props.tab.id)
      await window.api.session.connect(props.tab.id, props.tab.sessionId, initialSize ? { cols: initialSize.cols, rows: initialSize.rows } : undefined)
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
  background-color: var(--tab-bg, var(--bg-color, #2d2d2d));
  border-right: 1px solid var(--border-color, #3c3c3c);
  cursor: pointer;
  min-width: 100px;
  max-width: 200px;
  transition: background-color 0.15s;
  -webkit-app-region: no-drag;
}

.terminal-tab:hover {
  background-color: var(--tab-hover-bg, var(--hover-bg, #3c3c3c));
}

.terminal-tab.active {
  background-color: var(--tab-active-bg, var(--bg-color, #1e1e1e));
}

/* SFTP 标签页特殊样式 */
.terminal-tab.sftp-tab {
  background-color: var(--tab-bg, var(--bg-color, #2d2d2d));
  border-left: 3px solid transparent;
}

.terminal-tab.sftp-tab:hover {
  background-color: var(--tab-hover-bg, var(--hover-bg, #3c3c3c));
}

/* SFTP 激活状态：主题色高亮 + 左侧指示条 */
.terminal-tab.sftp-tab.active {
  background-color: var(--tab-active-bg, var(--bg-color, #1e1e1e));
  border-left: 3px solid var(--primary-color, #0e639c);
}

/* SFTP 未激活：图标和文字变暗 */
.terminal-tab.sftp-tab:not(.active) .type-icon.sftp-icon {
  opacity: 0.5;
}

/* SSH 未激活：图标和文字变暗 */
.terminal-tab:not(.active) .type-icon.ssh-icon {
  opacity: 0.5;
}

.terminal-tab.sftp-tab:not(.active) .tab-title {
  opacity: 0.6;
}

/* SFTP 激活：图标使用主题色 */
.terminal-tab.sftp-tab.active .type-icon.sftp-icon {
  color: var(--primary-color, #0e639c);
}

.terminal-tab.sftp-tab.active .tab-title {
  color: var(--tab-text-color, #ffffff);
}

/* 标签类型图标 */
.type-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #808080);
  flex-shrink: 0;
}

/* SFTP 图标连接状态颜色 */
.type-icon.sftp-icon {
  color: var(--text-tertiary, #606060);
}

/* 已连接 - 绿色 */
.type-icon.sftp-icon.connected {
  color: #4ec9b0;
}

/* 连接中 - 黄色闪烁 */
.type-icon.sftp-icon.connecting {
  color: #dcdcaa;
  animation: pulse 1s infinite;
}

/* 断开 - 灰色 */
.type-icon.sftp-icon.disconnected {
  color: var(--text-tertiary, #606060);
}

/* 错误 - 红色 */
.type-icon.sftp-icon.error {
  color: #f14c4c;
}

/* ========== SSH 图标连接状态颜色（与 SFTP 对称） ========== */
.type-icon.ssh-icon {
  color: var(--text-tertiary, #606060);
}

.type-icon.ssh-icon.connected {
  color: #4ec9b0;
}

.type-icon.ssh-icon.connecting {
  color: #dcdcaa;
  animation: pulse 1s infinite;
}

.type-icon.ssh-icon.disconnected {
  color: var(--text-tertiary, #606060);
}

.type-icon.ssh-icon.error {
  color: #f14c4c;
}

/* 激活态 + 连接状态：状态颜色优先于主题色 */
.terminal-tab.sftp-tab.active .type-icon.sftp-icon.connected {
  color: #41f30bec;
}

.terminal-tab.sftp-tab.active .type-icon.sftp-icon.connecting {
  color: #dcdcaa;
  animation: pulse 1s infinite;
}

.terminal-tab.sftp-tab.active .type-icon.sftp-icon.disconnected {
  color: var(--text-tertiary, #606060);
}

.terminal-tab.sftp-tab.active .type-icon.sftp-icon.error {
  color: #f14c4c;
}

/* SSH 激活态 + 连接状态 */
.terminal-tab.active .type-icon.ssh-icon.connected {
  color: #41f30bec;
}

.terminal-tab.active .type-icon.ssh-icon.connecting {
  color: #dcdcaa;
  animation: pulse 1s infinite;
}

.terminal-tab.active .type-icon.ssh-icon.disconnected {
  color: var(--text-tertiary, #606060);
}

.terminal-tab.active .type-icon.ssh-icon.error {
  color: #f14c4c;
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
  color: var(--tab-text-color, #ffffff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.terminal-tab.active .tab-title {
  color: var(--tab-text-color, #ffffff);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: var(--text-tertiary, #606060);
  cursor: pointer;
  border-radius: 3px;
  opacity: 0;
  transition: all 0.15s;
}

.terminal-tab:hover .close-btn {
  opacity: 1;
}

.close-btn:hover {
  background-color: var(--hover-bg, #3c3c3c);
  color: var(--tab-text-color, #ffffff);
}

/* SFTP 激活：图标使用主题色 */
.terminal-tab.sftp-tab.active .type-icon.sftp-icon {
  color: var(--primary-color, #0e639c);
}

.terminal-tab.sftp-tab.active .tab-title {
  color: var(--tab-text-color, #ffffff);
}
</style>
