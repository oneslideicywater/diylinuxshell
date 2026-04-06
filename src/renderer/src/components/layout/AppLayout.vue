/**
 * 应用布局组件
 * 提供整体页面布局结构
 * @module components/layout/AppLayout
 */

<template>
  <div class="app-layout">
    <!-- 顶部标题栏 -->
    <header class="app-header">
      <div class="header-left" :style="{ width: `${sidebarWidth}px` }">
        <span class="app-title">DIY Linux Shell</span>
      </div>
      <div class="header-center">
        <!-- 标签页区域 -->
        <!-- 修复 BUG-009: 监听 new-tab 事件，触发新建会话流程 -->
        <TerminalTabs @new-tab="emit('add-session')" />
      </div>
      <div class="header-right">
        <!-- 窗口控制按钮 -->
        <div class="window-controls">
          <button class="control-btn minimize" @click="handleMinimize" title="最小化">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect y="5" width="12" height="2" fill="currentColor" />
            </svg>
          </button>
          <button class="control-btn maximize" @click="handleMaximize" title="最大化">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="1" y="1" width="10" height="10" stroke="currentColor" stroke-width="2" fill="none" />
            </svg>
          </button>
          <button class="control-btn close" @click="handleClose" title="关闭">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" stroke-width="2" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- 主体内容区域 -->
    <div class="app-body">
      <!-- 左侧边栏 -->
      <aside 
        class="app-sidebar" 
        :style="{ width: `${sidebarWidth}px` }"
      >
        <Sidebar 
          @add-session="(groupId?: string) => emit('add-session', groupId)" 
          @edit-session="(s) => emit('edit-session', s)" 
          @open-settings="emit('open-settings')" 
        />
      </aside>

      <!-- 拖拽调整手柄 -->
      <div
        class="sidebar-resize-handle"
        :class="{ 'resizing': isResizing }"
        @mousedown="handleResizeStart"
        title="拖拽调整侧边栏宽度"
      >
        <div class="resize-line"></div>
      </div>

      <!-- 主内容区 -->
      <main class="app-main">
        <slot>
          <!-- 默认内容：终端区域 -->
          <!-- 为每个标签页创建独立的终端实例，切换时保持各自的状态和历史记录 -->
          <div class="terminal-area">
            <template v-for="tab in tabs" :key="tab.id">
              <XTerminal 
                v-show="tab.id === activeTabId" 
                :tab="tab" 
              />
            </template>
            <div v-if="tabs.length === 0" class="empty-state">
              <p>请选择或创建一个会话</p>
            </div>
          </div>
        </slot>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useTerminalStore } from '@/stores/terminal'
import Sidebar from './Sidebar.vue'
import TerminalTabs from '@/components/terminal/TerminalTabs.vue'
import XTerminal from '@/components/terminal/XTerminal.vue'
import type { Session } from '@shared/types'

// 终端状态管理
const terminalStore = useTerminalStore()

// 定义事件
const emit = defineEmits<{
  (e: 'add-session', groupId?: string): void
  (e: 'edit-session', session: Session): void
  (e: 'open-settings'): void
}>()

// 所有标签页
const tabs = computed(() => terminalStore.tabs)

// 当前激活的标签页ID
const activeTabId = computed(() => terminalStore.activeTabId)

// 当前激活的标签页
const activeTab = computed(() => terminalStore.activeTab)

// 窗口最大化状态
const isMaximized = ref(false)

// 侧边栏宽度相关
const SIDEBAR_MIN_WIDTH = 200
const SIDEBAR_MAX_WIDTH = 500
const SIDEBAR_DEFAULT_WIDTH = 240
const SIDEBAR_WIDTH_STORAGE_KEY = 'app-sidebar-width'

const sidebarWidth = ref(SIDEBAR_DEFAULT_WIDTH)
const isResizing = ref(false)

/**
 * 从 localStorage 加载侧边栏宽度
 */
const loadSidebarWidth = () => {
  try {
    const stored = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
    if (stored) {
      const width = parseInt(stored, 10)
      if (width >= SIDEBAR_MIN_WIDTH && width <= SIDEBAR_MAX_WIDTH) {
        sidebarWidth.value = width
      }
    }
  } catch (error) {
    console.error('Failed to load sidebar width:', error)
  }
}

/**
 * 保存侧边栏宽度到 localStorage
 */
const saveSidebarWidth = () => {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, sidebarWidth.value.toString())
  } catch (error) {
    console.error('Failed to save sidebar width:', error)
  }
}

/**
 * 开始调整侧边栏宽度
 */
const handleResizeStart = (e: MouseEvent) => {
  console.log('[AppLayout] sidebar mousedown 事件触发', {
    clientX: e.clientX,
    button: e.button
  })
  
  // 阻止默认行为和事件冒泡
  e.preventDefault()
  e.stopPropagation()
  
  isResizing.value = true
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
  
  const startX = e.clientX
  const startWidth = sidebarWidth.value
  
  console.log('[AppLayout] 初始状态', { startX, startWidth })
  
  // 使用闭包保存状态
  const onMouseMove = (moveEvent: MouseEvent) => {
    const delta = moveEvent.clientX - startX
    let newWidth = startWidth + delta
    
    // 限制宽度范围
    newWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, newWidth))
    sidebarWidth.value = newWidth
    
    console.log('[AppLayout] mousemove', {
      clientX: moveEvent.clientX,
      delta,
      newWidth
    })
  }
  
  const onMouseUp = () => {
    console.log('[AppLayout] mouseup 事件触发')
    
    isResizing.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    saveSidebarWidth()
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }
  
  // 立即添加事件监听器
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  
  console.log('[AppLayout] 事件监听器已添加')
}

/**
 * 最小化窗口
 */
const handleMinimize = () => {
  window.api.windowMinimize()
}

/**
 * 最大化/还原窗口
 */
const handleMaximize = () => {
  window.api.windowMaximize()
}

/**
 * 关闭窗口
 */
const handleClose = () => {
  window.api.windowClose()
}

// 监听窗口状态变化
let cleanupMaximize: (() => void) | null = null
let cleanupUnmaximize: (() => void) | null = null

onMounted(async () => {
  // 获取初始最大化状态
  isMaximized.value = await window.api.windowIsMaximized()

  // 监听最大化事件
  cleanupMaximize = window.api.onWindowMaximize(() => {
    isMaximized.value = true
  })

  // 监听取消最大化事件
  cleanupUnmaximize = window.api.onWindowUnmaximize(() => {
    isMaximized.value = false
  })
  
  // 加载侧边栏宽度
  loadSidebarWidth()
})

onUnmounted(() => {
  // 清理事件监听
  cleanupMaximize?.()
  cleanupUnmaximize?.()
})
</script>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--bg-color, #1e1e1e);
  color: var(--text-color, #cccccc);
}

/* 顶部标题栏 */
.app-header {
  display: flex;
  align-items: center;
  height: 36px;
  background-color: var(--header-bg, #252526);
  border-bottom: 1px solid var(--border-color, #3c3c3c);
  -webkit-app-region: drag;
}

.header-left {
  display: flex;
  align-items: center;
  padding: 0 12px;
  flex-shrink: 0; /* 防止被压缩 */
}

.app-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color, #cccccc);
}

.header-center {
  flex: 1;
  display: flex;
  align-items: center;
  overflow: hidden;
  -webkit-app-region: drag;
}

.header-right {
  display: flex;
  align-items: center;
}

/* 窗口控制按钮 */
.window-controls {
  display: flex;
  -webkit-app-region: no-drag;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--text-color, #cccccc);
  cursor: pointer;
  transition: background-color 0.15s;
}

.control-btn:hover {
  background-color: var(--hover-bg, #3c3c3c);
}

.control-btn.close:hover {
  background-color: #e81123;
  color: white;
}

/* 主体内容区域 */
.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 左侧边栏 */
.app-sidebar {
  background-color: var(--sidebar-bg, #252526);
  border-right: 1px solid var(--border-color, #3c3c3c);
  overflow-y: auto;
  flex-shrink: 0;  /* 防止被压缩 */
}

/* 拖拽调整手柄 */
.sidebar-resize-handle {
  width: 8px;
  height: 100%;
  cursor: ew-resize;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  z-index: 10;
  flex-shrink: 0;  /* 防止被压缩 */
}

.sidebar-resize-handle:hover {
  background-color: var(--el-color-primary-light-9, rgba(64, 158, 255, 0.1));
}

.sidebar-resize-handle.resizing {
  background-color: var(--el-color-primary-light-9, rgba(64, 158, 255, 0.2));
}

.resize-line {
  width: 2px;
  height: 24px;
  background-color: var(--el-border-color, #dcdfe6);
  border-radius: 2px;
  transition: background-color 0.2s;
}

.sidebar-resize-handle:hover .resize-line {
  background-color: var(--el-color-primary, #409eff);
}

.sidebar-resize-handle.resizing .resize-line {
  background-color: var(--el-color-primary-dark-2, #337ecc);
}

/* 主内容区 */
.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 终端区域 */
.terminal-area {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

/* 每个终端实例占满整个区域，通过 v-show 控制显示 */
.terminal-area :deep(.x-terminal) {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

/* 空状态 */
.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #808080);
  font-size: 14px;
}
</style>
