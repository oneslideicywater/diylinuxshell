/**
 * 终端组件
 * 基于 xterm.js 实现终端显示和交互
 * 支持动态应用设置（字体大小、字体类型、主题等）
 * @module components/terminal/XTerminal
 */

<template>
  <div 
    ref="terminalContainer" 
    class="x-terminal"
    @contextmenu.prevent="handleContextMenu"
  >
    <!-- 右键菜单 -->
    <div 
      v-show="contextMenuVisible" 
      ref="contextMenu"
      class="context-menu"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
    >
      <!-- 复制菜单项 -->
      <div class="context-menu-item" @click="handleCopy">
        <span>复制</span>
      </div>
      <!-- 粘贴菜单项 -->
      <div class="context-menu-item" @click="handlePaste">
        <span>粘贴</span>
      </div>
      <!-- 分隔线 -->
      <div class="context-menu-divider"></div>
      <!-- 全选菜单项 -->
      <div class="context-menu-item" @click="handleSelectAll">
        <span>全选</span>
      </div>
      <!-- 审查元素菜单项 -->
      <div class="context-menu-item" @click="handleInspectElement">
        <span>审查元素</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { useTerminalStore } from '@/stores/terminal'
import { useSettingsStore } from '@/stores/settings'
import { useContextMenuStore } from '@/stores/contextMenu'
import type { Tab, TerminalSize } from '@shared/types'

import 'xterm/css/xterm.css'

// 定义属性
const props = defineProps<{
  tab: Tab
}>()

// 终端容器引用
const terminalContainer = ref<HTMLDivElement | null>(null)

// 右键菜单引用
const contextMenu = ref<HTMLDivElement | null>(null)

// 右键菜单状态
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })

// 右键点击的全局坐标（用于审查元素）
const contextMenuGlobalPosition = ref({ x: 0, y: 0 })

// 终端实例
let terminal: Terminal | null = null

// 状态管理
const terminalStore = useTerminalStore()
const settingsStore = useSettingsStore()
const contextMenuStore = useContextMenuStore()
let fitAddon: FitAddon | null = null

// 数据监听清理函数
let cleanupDataListener: (() => void) | null = null
let cleanupCloseListener: (() => void) | null = null
let cleanupErrorListener: (() => void) | null = null

/**
 * 初始化终端
 */
const initTerminal = () => {
  if (!terminalContainer.value) return

  // 获取当前设置
  const terminalConfig = settingsStore.getTerminalConfig()
  const themeColors = settingsStore.getThemeColors()

  // 创建xterm.js终端实例，应用设置
  terminal = new Terminal({
    fontSize: terminalConfig.fontSize,
    fontFamily: `${terminalConfig.fontFamily}, Consolas, Monaco, "Courier New", monospace`,
    theme: themeColors,
    cursorBlink: terminalConfig.cursorBlink,
    cursorStyle: terminalConfig.cursorStyle,
    scrollback: terminalConfig.scrollback,
    allowProposedApi: true
  })

  // 加载插件
  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(new WebLinksAddon())

  // 打开终端
  terminal.open(terminalContainer.value)

  // 自适应大小
  fitAddon.fit()

  /**
   * 处理用户输入
   * 当用户在终端中输入内容（按键、粘贴文本等）时触发
   * 数据流向: 用户输入 → xterm.js → IPC → 主进程 → SSH 服务器
   * @param data - 用户输入的内容，可能是单个字符、控制序列或粘贴的多行文本
   */
  terminal.onData((data) => {
    // 通过 IPC 将用户输入发送到主进程，主进程会通过 SSH 连接转发到远程服务器
    // props.tab.id 用于标识是哪个标签页的 SSH 连接
    window.api.terminal.write(props.tab.id, data)
  })

  // 处理终端大小变化
  terminal.onResize(({ cols, rows }) => {
    const size: TerminalSize = {
      cols,
      rows,
      width: terminalContainer.value?.clientWidth || 0,
      height: terminalContainer.value?.clientHeight || 0
    }
    window.api.terminal.resize(props.tab.id, size)
    terminalStore.updateTerminalSize(props.tab.id, size)
  })

  // 保存终端 ID
  props.tab.terminalId = `terminal-${props.tab.id}`
}

/**
 * 应用终端设置
 * 当设置变化时更新终端配置
 */
const applyTerminalSettings = () => {
  if (!terminal) return

  const terminalConfig = settingsStore.getTerminalConfig()
  const themeColors = settingsStore.getThemeColors()

  // 应用字体设置
  terminal.options.fontSize = terminalConfig.fontSize
  terminal.options.fontFamily = `${terminalConfig.fontFamily}, Consolas, Monaco, "Courier New", monospace`

  // 应用滚动缓冲区设置
  terminal.options.scrollback = terminalConfig.scrollback

  // 应用主题颜色
  terminal.options.theme = themeColors

  // 应用光标设置（必须在设置主题之后，确保光标闪烁生效）
  terminal.options.cursorStyle = terminalConfig.cursorStyle
  terminal.options.cursorBlink = terminalConfig.cursorBlink

  // 重新适配终端大小
  if (fitAddon) {
    fitAddon.fit()
  }
}

/**
 * 监听终端数据
 * 设置 IPC 事件监听器，接收来自 SSH 服务器的输出数据
 */
const setupDataListeners = () => {
  /**
   * 监听终端输出数据
   * 当 SSH 服务器返回数据时（如命令执行结果、Shell 提示符等），主进程会通过 IPC 发送数据
   * 数据格式: { tabId: string, data: string }
   * - tabId: 标签页 ID，用于区分不同的 SSH 连接
   * - data: SSH 服务器返回的原始文本（包含 ANSI 转义序列）
   */
  cleanupDataListener = window.api.terminal.onData((_event: unknown, data: unknown) => {
    // 解构赋值：从 data 中提取 tabId 和终端输出内容
    // data: terminalData 表示将 data 属性重命名为 terminalData，避免与外层参数名冲突
    const { tabId, data: terminalData } = data as { tabId: string; data: string }
    
    // 检查数据是否属于当前标签页，且终端实例存在
    if (tabId === props.tab.id && terminal) {
      // 将 SSH 服务器返回的数据写入 xterm.js 终端进行渲染
      // terminalData 包含 ANSI 转义序列，xterm.js 会自动解析并显示颜色、样式等
      terminal.write(terminalData)
      
      // 更新标签页状态为已连接
      terminalStore.updateTabStatus(props.tab.id, 'connected')
    }
  })

  // 监听终端关闭事件
  cleanupCloseListener = window.api.terminal.onClose((_event: unknown, data: unknown) => {
    const { tabId } = data as { tabId: string }
    if (tabId === props.tab.id) {
      terminal?.write('\r\n\x1b[33m[连接已关闭]\x1b[0m\r\n')
      // 更新标签页状态为断开
      terminalStore.updateTabStatus(props.tab.id, 'disconnected')
    }
  })

  // 监听终端错误事件
  cleanupErrorListener = window.api.terminal.onError((_event: unknown, data: unknown) => {
    const { tabId, error } = data as { tabId: string; error: string }
    if (tabId === props.tab.id) {
      terminal?.write(`\r\n\x1b[31m[错误: ${error}]\x1b[0m\r\n`)
      // 更新标签页状态为错误
      terminalStore.updateTabStatus(props.tab.id, 'error')
    }
  })
}

// IntersectionObserver 用于监听元素可见性变化
let resizeObserver: ResizeObserver | null = null
let intersectionObserver: IntersectionObserver | null = null

// 标记是否需要延迟 fit（用于 v-show 切换场景）
let pendingFit = false

/**
 * 处理窗口大小变化
 */
const handleResize = () => {
  if (fitAddon && terminal) {
    // 如果当前不可见，标记为需要延迟 fit
    if (terminalContainer.value && terminalContainer.value.offsetParent === null) {
      pendingFit = true
      return
    }
    
    fitAddon.fit()
    pendingFit = false
  }
}

/**
 * 延迟执行 fit（当元素从不可见变为可见时调用）
 */
const delayedFit = () => {
  if (!pendingFit || !fitAddon || !terminal) return
  
  nextTick(() => {
    handleResize()
  })
}

/**
 * 处理右键菜单显示
 * 在终端中右键点击时显示上下文菜单
 */
const handleContextMenu = (event: MouseEvent): void => {
  event.preventDefault()
  
  // 打开终端菜单（会自动关闭其他菜单）
  contextMenuStore.openMenu('terminal')
  
  // 保存右键点击的全局坐标（相对于窗口，用于审查元素）
  contextMenuGlobalPosition.value = { x: event.clientX, y: event.clientY }
  
  // 计算菜单位置，确保不超出容器边界
  const containerRect = terminalContainer.value?.getBoundingClientRect()
  if (!containerRect) return
  
  let x = event.clientX - containerRect.left
  let y = event.clientY - containerRect.top
  
  // 确保菜单不超出右边界
  const menuWidth = 160
  if (x + menuWidth > containerRect.width) {
    x = containerRect.width - menuWidth - 10
  }
  
  // 确保菜单不超出下边界（更新高度：4个菜单项 + 1个分隔线）
  const menuHeight = 180
  if (y + menuHeight > containerRect.height) {
    y = containerRect.height - menuHeight - 10
  }
  
  contextMenuPosition.value = { x, y }
  contextMenuVisible.value = true
}

/**
 * 处理复制操作
 * 将终端中选中的文本复制到剪贴板
 */
const handleCopy = async (): Promise<void> => {
  if (!terminal) return
  
  const selection = terminal.getSelection()
  if (selection) {
    try {
      await navigator.clipboard.writeText(selection)
    } catch (error) {
      console.error('复制失败:', error)
    }
  }
  
  // 隐藏菜单
  contextMenuVisible.value = false
}

/**
 * 处理粘贴操作
 * 从剪贴板读取文本并粘贴到终端
 */
const handlePaste = async (): Promise<void> => {
  if (!terminal) return
  
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      terminal.paste(text)
    }
  } catch (error) {
    console.error('粘贴失败:', error)
  }
  
  // 隐藏菜单
  contextMenuVisible.value = false
}

/**
 * 处理全选操作
 * 选中终端中的所有内容
 */
const handleSelectAll = (): void => {
  if (!terminal) return
  
  // 使用 xterm.js 的 selectAll 方法选中所有内容
  terminal.selectAll()
  
  // 隐藏菜单
  contextMenuVisible.value = false
}

/**
 * 处理审查元素操作
 * 打开开发者工具并检查元素
 */
const handleInspectElement = (): void => {
  // 在 Electron 中打开开发者工具并检查指定位置的元素
  // 通过 window.electron API 发送 IPC 消息，传递右键点击的坐标
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.send('open-devtools', {
      x: contextMenuGlobalPosition.value.x,
      y: contextMenuGlobalPosition.value.y
    })
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

// 监听 tab 变化
watch(
  () => props.tab,
  () => {
    nextTick(() => {
      handleResize()
    })
  }
)

// 监听设置变化，应用到终端
watch(
  () => settingsStore.terminal,
  () => {
    applyTerminalSettings()
  },
  { deep: true }
)

// 监听主题变化
watch(
  () => settingsStore.theme,
  () => {
    applyTerminalSettings()
  }
)

// 监听菜单状态变化，确保菜单互斥
watch(
  () => contextMenuStore.currentMenu,
  (newMenu) => {
    // 如果当前菜单不是终端菜单，关闭终端菜单
    if (newMenu !== 'terminal') {
      contextMenuVisible.value = false
    }
  }
)

onMounted(() => {
  initTerminal()
  setupDataListeners()

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
  
  // 监听点击事件，用于关闭右键菜单
  document.addEventListener('click', handleClickOutside)

  // 使用 ResizeObserver 监听容器尺寸变化（处理 v-show 切换后的 resize）
  if (terminalContainer.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          // 容器有尺寸时，执行 fit
          nextTick(() => {
            handleResize()
          })
        }
      }
    })
    
    resizeObserver.observe(terminalContainer.value)
  }

  // 使用 IntersectionObserver 监听可见性变化
  if (terminalContainer.value && typeof IntersectionObserver !== 'undefined') {
    intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio > 0) {
          // 元素从不可见变为可见，延迟执行 fit
          delayedFit()
        }
      }
    }, { threshold: 0 })
    
    intersectionObserver.observe(terminalContainer.value)
  }
})

onUnmounted(() => {
  // 清理事件监听
  cleanupDataListener?.()
  cleanupCloseListener?.()
  cleanupErrorListener?.()
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('click', handleClickOutside)

  // 清理 ResizeObserver
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  // 清理 IntersectionObserver
  if (intersectionObserver) {
    intersectionObserver.disconnect()
    intersectionObserver = null
  }

  // 销毁终端实例
  terminal?.dispose()
  terminal = null
})
</script>

<style scoped>
.x-terminal {
  width: 100%;
  height: 100%;
  padding: 8px;
  background-color: var(--bg-color, #1e1e1e);
  transition: background-color 0.3s;
  position: relative;
}

/* 终端选中文字样式 - 确保对比度 */
.x-terminal :deep(.xterm-selection) {
  opacity: 1 !important;
}

/* 浅色主题下的终端装饰元素样式 - 用于显示选中效果 */
[data-theme="light"] .x-terminal :deep(.xterm-decoration-top) {
  background-color: var(--selection-bg, rgba(55, 58, 56, 0.322)) !important;
}

/* 右键菜单样式 */
.context-menu {
  position: absolute;
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

/* 分隔线样式 */
.context-menu-divider {
  height: 1px;
  background-color: var(--border-color, #3d3d3d);
  margin: 4px 0;
}

/* 移除旧的 menu-icon 样式 */
</style>
