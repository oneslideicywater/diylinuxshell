/**
 * 点击Session连接按钮,会创建一个标签页 
 * 单个标签页组件
 * 显示标签页标题、连接状态和关闭按钮
 * @module components/terminal/TerminalTab
 */

<template>
  <div 
    class="terminal-tab" 
    :class="{ active }" 
    @click="$emit('click')"
    @contextmenu.prevent="handleContextMenu"
  >
    <!-- 连接状态指示器 -->
    <span class="status-indicator" :class="tab.status">
      <span class="status-dot"></span>
    </span>

    <!-- 标签标题 -->
    <span class="tab-title">{{ tab.title }}</span>

    <!-- 关闭按钮 -->
    <button class="close-btn" title="关闭" @click.stop="$emit('close')">
      <svg width="10" height="10" viewBox="0 0 10 10">
        <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.5" />
      </svg>
    </button>

    <!-- 右键菜单 -->
    <div 
      v-show="contextMenuVisible" 
      ref="contextMenu"
      class="context-menu"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
    >
      <!-- 复制会话菜单项 -->
      <div class="context-menu-item" @click.stop="handleDuplicateSession">
        <span>复制会话</span>
      </div>
      <!-- 断开会话菜单项 -->
      <div 
        class="context-menu-item" 
        :class="{ disabled: !canDisconnect }"
        @click.stop="handleDisconnectSession"
      >
        <span>断开会话</span>
      </div>
      <!-- 重连会话菜单项 -->
      <div 
        class="context-menu-item" 
        :class="{ disabled: !canReconnect }"
        @click.stop="handleReconnectSession"
      >
        <span>重连会话</span>
      </div>
    </div>

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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
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
const emit = defineEmits<{
  (e: 'click'): void
  (e: 'close'): void
}>()

// 状态管理
const terminalStore = useTerminalStore()
const sessionStore = useSessionStore()
const contextMenuStore = useContextMenuStore()
const errorDialogStore = useErrorDialogStore()

// 右键菜单引用
const contextMenu = ref<HTMLDivElement | null>(null)

// 右键菜单状态
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })

// 错误对话框相关计算属性
const errorDialogVisible = computed(() => errorDialogStore.visible)
const errorDialogTitle = computed(() => errorDialogStore.title)
const errorDialogMessage = computed(() => errorDialogStore.message)
const errorDialogSessionId = computed(() => errorDialogStore.sessionId)

// 计算属性：是否可以断开会话
const canDisconnect = computed(() => {
  return props.tab.status === 'connected' || props.tab.status === 'connecting'
})

// 计算属性：是否可以重连会话
const canReconnect = computed(() => {
  return props.tab.status === 'disconnected' || props.tab.status === 'error'
})

/**
 * 处理右键菜单显示
 */
const handleContextMenu = (event: MouseEvent): void => {
  // 打开标签页菜单（会自动关闭其他菜单）
  contextMenuStore.openMenu('tab')
  
  // 使用全局坐标（相对于窗口）
  let x = event.clientX
  let y = event.clientY
  
  // 确保菜单不超出窗口右边界
  const menuWidth = 160
  const windowWidth = window.innerWidth
  if (x + menuWidth > windowWidth) {
    x = windowWidth - menuWidth - 10
  }
  
  // 确保菜单不超出窗口下边界
  const menuHeight = 120
  const windowHeight = window.innerHeight
  if (y + menuHeight > windowHeight) {
    y = windowHeight - menuHeight - 10
  }
  
  contextMenuPosition.value = { x, y }
  contextMenuVisible.value = true
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
  
  // 隐藏菜单
  contextMenuVisible.value = false
}

/**
 * 处理断开会话
 */
const handleDisconnectSession = async (): Promise<void> => {
  if (!canDisconnect.value) return
  
  try {
    await window.api.session.disconnect(props.tab.id)
    terminalStore.updateTabStatus(props.tab.id, 'disconnected')
  } catch (error) {
    console.error('Failed to disconnect:', error)
  }
  
  // 隐藏菜单
  contextMenuVisible.value = false
}

/**
 * 处理重连会话
 */
const handleReconnectSession = async (): Promise<void> => {
  if (!canReconnect.value) return
  
  try {
    terminalStore.updateTabStatus(props.tab.id, 'connecting')
    await window.api.session.connect(props.tab.id, props.tab.sessionId)
    terminalStore.updateTabStatus(props.tab.id, 'connected')
  } catch (error: unknown) {
    console.error('Failed to reconnect:', error)
    terminalStore.updateTabStatus(props.tab.id, 'error')
    
    // 显示错误对话框
    const errorMessage = error instanceof Error ? error.message : String(error)
    showErrorDialog('重连失败', errorMessage, props.tab.sessionId)
  }
  
  // 隐藏菜单
  contextMenuVisible.value = false
}

/**
 * 点击菜单外部关闭菜单
 */
const handleClickOutside = (event: MouseEvent): void => {
  if (contextMenu.value && !contextMenu.value.contains(event.target as Node)) {
    contextMenuVisible.value = false
  }
}

// 监听菜单状态变化，确保菜单互斥
watch(
  () => contextMenuStore.currentMenu,
  (newMenu) => {
    // 如果当前菜单不是标签页菜单，关闭标签页菜单
    if (newMenu !== 'tab') {
      contextMenuVisible.value = false
    }
  }
)

onMounted(() => {
  // 监听点击事件，用于关闭右键菜单
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

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
  background-color: var(--tab-bg, #2d2d2d);
  border-right: 1px solid var(--border-color, #3c3c3c);
  cursor: pointer;
  min-width: 100px;
  max-width: 200px;
  transition: background-color 0.15s;
  -webkit-app-region: no-drag;
}

.terminal-tab:hover {
  background-color: var(--tab-hover-bg, #3c3c3c);
}

.terminal-tab.active {
  background-color: var(--tab-active-bg, #1e1e1e);
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
  background-color: var(--text-tertiary, #606060);
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
  background-color: var(--text-tertiary, #606060);
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
  color: var(--text-secondary, #808080);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.terminal-tab.active .tab-title {
  color: var(--text-color, #cccccc);
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
  background-color: var(--hover-bg, #4c4c4c);
  color: var(--text-color, #cccccc);
}

/* 右键菜单样式 */
.context-menu {
  position: fixed;
  background-color: var(--card-bg, #2d2d2d);
  border: 1px solid var(--border-color, #3d3d3d);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  min-width: 160px;
  padding: 6px 0;
  backdrop-filter: blur(10px);
}

.context-menu-item {
  display: flex;
  align-items: center;
  padding: 8px 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-color, #e0e0e0);
  font-size: 13px;
  user-select: none;
}

.context-menu-item:hover {
  background-color: var(--primary-color, #0e639c);
  color: #ffffff;
}

.context-menu-item:active {
  background-color: var(--primary-hover, #1177bb);
}

.context-menu-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.context-menu-item.disabled:hover {
  background-color: transparent;
  color: var(--text-color, #e0e0e0);
}
</style>
