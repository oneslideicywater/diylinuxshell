/**
 * 终端组件
 * 基于 xterm.js 实现终端显示和交互
 * @module components/terminal/XTerminal
 */

<template>
  <div ref="terminalContainer" class="x-terminal"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { useTerminalStore } from '@/stores/terminal'
import type { Tab, TerminalSize } from '@shared/types'

import 'xterm/css/xterm.css'

// 定义属性
const props = defineProps<{
  tab: Tab
}>()

// 终端容器引用
const terminalContainer = ref<HTMLDivElement | null>(null)

// 终端实例
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null

// 终端状态管理
const terminalStore = useTerminalStore()

// 数据监听清理函数
let cleanupDataListener: (() => void) | null = null
let cleanupCloseListener: (() => void) | null = null
let cleanupErrorListener: (() => void) | null = null

/**
 * 初始化终端
 */
const initTerminal = () => {
  if (!terminalContainer.value) return

  // 创建xterm.js终端实例
  terminal = new Terminal({
    fontSize: 14,
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    theme: {
      background: '#1e1e1e',
      foreground: '#cccccc',
      cursor: '#ffffff',
      cursorAccent: '#000000',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#e5e5e5'
    },
    cursorBlink: true,
    cursorStyle: 'block',
    scrollback: 10000,
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
    // props.tab.sessionId 用于标识是哪个 SSH 会话
    window.api.terminal.write(props.tab.sessionId, data)
  })

  // 处理终端大小变化
  terminal.onResize(({ cols, rows }) => {
    const size: TerminalSize = {
      cols,
      rows,
      width: terminalContainer.value?.clientWidth || 0,
      height: terminalContainer.value?.clientHeight || 0
    }
    window.api.terminal.resize(props.tab.sessionId, size)
    terminalStore.updateTerminalSize(props.tab.id, size)
  })

  // 保存终端 ID
  props.tab.terminalId = `terminal-${props.tab.id}`
}

/**
 * 监听终端数据
 * 设置 IPC 事件监听器，接收来自 SSH 服务器的输出数据
 */
const setupDataListeners = () => {
  /**
   * 监听终端输出数据
   * 当 SSH 服务器返回数据时（如命令执行结果、Shell 提示符等），主进程会通过 IPC 发送数据
   * 数据格式: { sessionId: string, data: string }
   * - sessionId: 会话 ID，用于区分不同的 SSH 连接
   * - data: SSH 服务器返回的原始文本（包含 ANSI 转义序列）
   */
  cleanupDataListener = window.api.terminal.onData((_event: unknown, data: unknown) => {
    // 解构赋值：从 data 中提取 sessionId 和终端输出内容
    // data: terminalData 表示将 data 属性重命名为 terminalData，避免与外层参数名冲突
    const { sessionId, data: terminalData } = data as { sessionId: string; data: string }
    
    // 检查数据是否属于当前标签页的会话，且终端实例存在
    if (sessionId === props.tab.sessionId && terminal) {
      // 将 SSH 服务器返回的数据写入 xterm.js 终端进行渲染
      // terminalData 包含 ANSI 转义序列，xterm.js 会自动解析并显示颜色、样式等
      terminal.write(terminalData)
    }
  })

  // 监听终端关闭事件
  cleanupCloseListener = window.api.terminal.onClose((_event: unknown, data: unknown) => {
    const { sessionId } = data as { sessionId: string }
    if (sessionId === props.tab.sessionId) {
      terminal?.write('\r\n\x1b[33m[连接已关闭]\x1b[0m\r\n')
    }
  })

  // 监听终端错误事件
  cleanupErrorListener = window.api.terminal.onError((_event: unknown, data: unknown) => {
    const { sessionId, error } = data as { sessionId: string; error: string }
    if (sessionId === props.tab.sessionId) {
      terminal?.write(`\r\n\x1b[31m[错误: ${error}]\x1b[0m\r\n`)
    }
  })
}

/**
 * 处理窗口大小变化
 */
const handleResize = () => {
  if (fitAddon && terminal) {
    fitAddon.fit()
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

onMounted(() => {
  initTerminal()
  setupDataListeners()

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  // 清理事件监听
  cleanupDataListener?.()
  cleanupCloseListener?.()
  cleanupErrorListener?.()
  window.removeEventListener('resize', handleResize)

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
  background-color: #1e1e1e;
}
</style>
