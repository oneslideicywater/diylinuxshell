/**
 * 设置状态管理Store
 * 管理应用设置，包括主题、字体、终端配置等
 * @module stores/settings
 */

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { AppConfig, TerminalConfig } from '@shared/types'

// 本地存储键名
const STORAGE_KEY = 'app-settings'

// 默认配置
const defaultConfig: AppConfig = {
  theme: 'dark',
  language: 'zh-CN',
  terminal: {
    fontSize: 14,
    fontFamily: 'Cascadia Code',
    cursorStyle: 'block',
    cursorBlink: true,
    scrollback: 10000,
    terminalType: 'xterm-256color'
  },
  connectionTimeout: 30000,
  keepaliveInterval: 30000,
  autoReconnect: true,
  reconnectAttempts: 3
}

// 深色主题配色
const darkTheme = {
  background: '#1e1e1e',
  foreground: '#cccccc',
  cursor: '#ffffff',
  cursorAccent: '#000000',
  selection: 'rgba(65, 62, 62, 0.71)',
  selectionForeground: '#ffffff',
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
}

// 浅色主题配色
const lightTheme = {
  background: '#ffffff',
  foreground: '#333333',
  cursor: '#000000',
  cursorAccent: '#ffffff',
  selection: '#add6ff',
  selectionForeground: '#000000',
  black: '#000000',
  red: '#cd3131',
  green: '#008000',
  yellow: '#949800',
  blue: '#0451a5',
  magenta: '#bc05bc',
  cyan: '#0598bc',
  white: '#555555',
  brightBlack: '#666666',
  brightRed: '#cd3131',
  brightGreen: '#008000',
  brightYellow: '#949800',
  brightBlue: '#0451a5',
  brightMagenta: '#bc05bc',
  brightCyan: '#0598bc',
  brightWhite: '#a5a5a5'
}

/**
 * 从本地存储加载设置
 */
const loadSettings = (): AppConfig => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AppConfig>
      // 合并默认配置，确保所有字段都有值
      // 注意：主题始终使用默认值（深色），除非用户主动切换
      return {
        ...defaultConfig,
        ...parsed,
        theme: defaultConfig.theme, // 强制使用默认主题（深色）
        terminal: {
          ...defaultConfig.terminal,
          ...parsed.terminal
        }
      }
    }
  } catch (error) {
    console.error('加载设置失败:', error)
  }
  return { ...defaultConfig }
}

/**
 * 保存设置到本地存储
 */
const saveSettings = (config: AppConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch (error) {
    console.error('保存设置失败:', error)
  }
}

/**
 * 应用主题到文档
 */
const applyTheme = (theme: 'dark' | 'light'): void => {
  // 设置文档根元素的 data-theme 属性
  document.documentElement.setAttribute('data-theme', theme)
  
  // 更新 CSS 变量
  const root = document.documentElement
  if (theme === 'dark') {
    // 深色主题
    root.style.setProperty('--bg-color', '#1e1e1e')
    root.style.setProperty('--text-color', '#cccccc')
    root.style.setProperty('--border-color', '#333333')
    root.style.setProperty('--hover-bg', '#2a2a2a')
    root.style.setProperty('--active-bg', '#094771')
    root.style.setProperty('--sidebar-bg', '#252526')
    root.style.setProperty('--header-bg', '#252526')
    root.style.setProperty('--tab-bg', '#2d2d2d')
    root.style.setProperty('--tab-hover-bg', '#3c3c3c')
    root.style.setProperty('--tab-active-bg', '#1e1e1e')
    root.style.setProperty('--tab-text-color', '#ffffff')
    root.style.setProperty('--text-secondary', '#808080')
    root.style.setProperty('--text-tertiary', '#606060')
    root.style.setProperty('--scrollbar-thumb', '#424242')
    root.style.setProperty('--card-bg', '#2d2d2d')
    // 修复 BUG-007: 添加输入框和按钮相关 CSS 变量
    root.style.setProperty('--input-bg', '#3c3c3c') // 输入框背景色：深灰色
    root.style.setProperty('--primary-color', '#0e639c') // 主色调：蓝色
    root.style.setProperty('--primary-hover', '#1177bb') // 主色调悬停：浅蓝色
    root.style.setProperty('--button-bg', '#0e639c') // 按钮背景色：蓝色
    root.style.setProperty('--button-hover-bg', '#1177bb') // 按钮悬停背景色：浅蓝色
  } else {
    // 浅色主题
    root.style.setProperty('--bg-color', '#ffffff')
    root.style.setProperty('--text-color', '#333333')
    root.style.setProperty('--border-color', '#e0e0e0')
    root.style.setProperty('--hover-bg', '#f0f0f0')
    root.style.setProperty('--active-bg', '#e6f3ff')
    root.style.setProperty('--sidebar-bg', '#f3f3f3')
    root.style.setProperty('--header-bg', '#f3f3f3')
    root.style.setProperty('--tab-bg', '#e8e8e8')
    root.style.setProperty('--tab-hover-bg', '#d4d4d4')
    root.style.setProperty('--tab-active-bg', '#ffffff')
    root.style.setProperty('--tab-text-color', '#333333')
    root.style.setProperty('--text-secondary', '#666666')
    root.style.setProperty('--text-tertiary', '#999999')
    root.style.setProperty('--scrollbar-thumb', '#c1c1c1')
    root.style.setProperty('--card-bg', '#ffffff')
    // 修复 BUG-007: 添加输入框和按钮相关 CSS 变量
    root.style.setProperty('--input-bg', '#ffffff') // 输入框背景色：白色
    root.style.setProperty('--primary-color', '#0e639c') // 主色调：蓝色
    root.style.setProperty('--primary-hover', '#1177bb') // 主色调悬停：浅蓝色
    root.style.setProperty('--button-bg', '#0e639c') // 按钮背景色：蓝色
    root.style.setProperty('--button-hover-bg', '#1177bb') // 按钮悬停背景色：浅蓝色
  }
}

export const useSettingsStore = defineStore('settings', () => {
  // 加载初始设置
  const initialConfig = loadSettings()
  
  // 应用初始主题到 DOM
  applyTheme(initialConfig.theme)
  
  // 主题设置
  const theme = ref<'dark' | 'light'>(initialConfig.theme)
  
  // 语言设置
  const language = ref(initialConfig.language)
  
  // 终端配置
  const terminal = ref<TerminalConfig>({ ...initialConfig.terminal })
  
  // 连接配置
  const connectionTimeout = ref(initialConfig.connectionTimeout)
  const keepaliveInterval = ref(initialConfig.keepaliveInterval)
  const autoReconnect = ref(initialConfig.autoReconnect)
  const reconnectAttempts = ref(initialConfig.reconnectAttempts)

  // 完整配置对象（用于保存）
  const config = ref<AppConfig>({ ...initialConfig })

  /**
   * 获取当前主题配色
   */
  const getThemeColors = () => {
    return theme.value === 'dark' ? darkTheme : lightTheme
  }

  /**
   * 获取终端配置
   */
  const getTerminalConfig = (): TerminalConfig => {
    return { ...terminal.value }
  }

  /**
   * 更新主题
   */
  const setTheme = (newTheme: 'dark' | 'light'): void => {
    theme.value = newTheme
    config.value.theme = newTheme
    applyTheme(newTheme)
    // 保存到本地存储
    saveSettings(config.value)
  }

  /**
   * 更新字体大小
   */
  const setFontSize = (size: number): void => {
    terminal.value.fontSize = size
  }

  /**
   * 更新字体类型
   */
  const setFontFamily = (font: string): void => {
    terminal.value.fontFamily = font
  }

  /**
   * 更新光标样式
   */
  const setCursorStyle = (style: 'block' | 'underline' | 'bar'): void => {
    terminal.value.cursorStyle = style
  }

  /**
   * 更新光标闪烁
   */
  const setCursorBlink = (blink: boolean): void => {
    terminal.value.cursorBlink = blink
  }

  /**
   * 更新滚动缓冲区大小
   */
  const setScrollback = (size: number): void => {
    terminal.value.scrollback = size
  }

  /**
   * 更新终端类型
   */
  const setTerminalType = (type: string): void => {
    terminal.value.terminalType = type
  }

  /**
   * 更新连接超时时间
   */
  const setConnectionTimeout = (timeout: number): void => {
    connectionTimeout.value = timeout
  }

  /**
   * 更新心跳间隔
   */
  const setKeepaliveInterval = (interval: number): void => {
    keepaliveInterval.value = interval
  }

  /**
   * 更新自动重连设置
   */
  const setAutoReconnect = (enabled: boolean): void => {
    autoReconnect.value = enabled
  }

  /**
   * 更新重连次数
   */
  const setReconnectAttempts = (attempts: number): void => {
    reconnectAttempts.value = attempts
  }

  /**
   * 重置所有设置为默认值
   */
  const resetSettings = (): void => {
    theme.value = defaultConfig.theme
    language.value = defaultConfig.language
    terminal.value = { ...defaultConfig.terminal }
    connectionTimeout.value = defaultConfig.connectionTimeout
    keepaliveInterval.value = defaultConfig.keepaliveInterval
    autoReconnect.value = defaultConfig.autoReconnect
    reconnectAttempts.value = defaultConfig.reconnectAttempts
    applyTheme(defaultConfig.theme)
  }

  // 监听设置变化，自动保存（主题除外，主题由 setTheme 手动保存）
  watch(
    [language, terminal, connectionTimeout, keepaliveInterval, autoReconnect, reconnectAttempts],
    () => {
      config.value = {
        theme: theme.value,
        language: language.value,
        terminal: { ...terminal.value },
        connectionTimeout: connectionTimeout.value,
        keepaliveInterval: keepaliveInterval.value,
        autoReconnect: autoReconnect.value,
        reconnectAttempts: reconnectAttempts.value
      }
      saveSettings(config.value)
    },
    { deep: true }
  )

  // 初始化时应用主题
  applyTheme(theme.value)

  return {
    // 状态
    theme,
    language,
    terminal,
    connectionTimeout,
    keepaliveInterval,
    autoReconnect,
    reconnectAttempts,
    config,
    
    // 方法
    getThemeColors,
    getTerminalConfig,
    setTheme,
    setFontSize,
    setFontFamily,
    setCursorStyle,
    setCursorBlink,
    setScrollback,
    setTerminalType,
    setConnectionTimeout,
    setKeepaliveInterval,
    setAutoReconnect,
    setReconnectAttempts,
    resetSettings
  }
})
