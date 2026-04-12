import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Tab, TerminalSize, ConnectionStatus } from '@shared/types'

/**
 * 终端状态管理Store
 */
export const useTerminalStore = defineStore('terminal', () => {
  // 标签页列表
  const tabs = ref<Tab[]>([])

  // 当前激活的标签页ID
  const activeTabId = ref<string>('')

  // 终端尺寸映射
  const terminalSizes = ref<Map<string, TerminalSize>>(new Map())

  // 当前模式：SSH终端 或 SFTP文件传输
  const currentMode = ref<'ssh' | 'sftp'>('ssh')

  // 计算属性：当前激活的标签页
  const activeTab = computed(() => {
    return tabs.value.find(t => t.id === activeTabId.value)
  })

  // 计算属性：标签页数量
  const tabCount = computed(() => tabs.value.length)

  /**
   * 创建新标签页
   * @param title 标签页标题
   * @param sessionId 关联的会话ID
   * @returns 新创建的标签页
   */
  function createTab(title: string, sessionId: string): Tab {
    const tab: Tab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      sessionId,
      status: 'disconnected',
      type: 'ssh'
    }
    tabs.value.push(tab)
    activeTabId.value = tab.id
    return tab
  }

  /**
   * 创建 SFTP 文件传输标签页
   * 每个标签页有独立的 SFTP 连接，避免多标签相互干扰
   * 
   * 安全设计（v2）：
   * - 完全移除 session 对象存储，只保留 sessionId 标识符
   * - 组件通过 SessionStore 自行获取会话信息（非敏感部分）
   * - 密码等敏感信息完全由主进程管理，不进入渲染进程状态树
   * 
   * @param title 标签页标题（通常为会话名称）
   * @param session 会话对象（仅用于提取 sessionId 和 title，不保存到 Tab）
   * @returns 新创建的 SFTP 标签页
   */
  function createSftpTab(title: string, session: any): Tab {
    const tabId = `sftp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const tab: Tab = {
      id: tabId,
      title: `${title} - SFTP`,
      sessionId: session.id || session.host,
      status: 'disconnected',
      type: 'sftp',
      sftpConnectionId: tabId
    }
    tabs.value.push(tab)
    activeTabId.value = tab.id
    return tab
  }

  /**
   * 关闭标签页
   */
  function closeTab(id: string): void {
    const index = tabs.value.findIndex(t => t.id === id)
    if (index !== -1) {
      tabs.value.splice(index, 1)
      terminalSizes.value.delete(id)

      // 如果关闭的是当前标签，切换到相邻标签
      if (activeTabId.value === id) {
        if (tabs.value.length > 0) {
          const newIndex = Math.min(index, tabs.value.length - 1)
          activeTabId.value = tabs.value[newIndex].id
        } else {
          activeTabId.value = ''
        }
      }
    }
  }

  /**
   * 设置激活标签页
   */
  function setActiveTab(id: string): void {
    if (tabs.value.some(t => t.id === id)) {
      activeTabId.value = id
    }
  }

  /**
   * 更新标签页标题
   */
  function updateTabTitle(id: string, title: string): void {
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      tab.title = title
    }
  }

  /**
   * 更新标签页终端ID
   */
  function updateTabTerminalId(id: string, terminalId: string): void {
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      tab.terminalId = terminalId
    }
  }

  /**
   * 更新标签页连接状态
   * @param id 标签页ID
   * @param status 连接状态
   */
  function updateTabStatus(id: string, status: ConnectionStatus): void {
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      tab.status = status
    }
  }

  /**
   * 根据ID获取标签页
   */
  function getTabById(id: string): Tab | undefined {
    return tabs.value.find(t => t.id === id)
  }

  /**
   * 更新终端尺寸
   */
  function updateTerminalSize(id: string, size: TerminalSize): void {
    terminalSizes.value.set(id, size)
  }

  /**
   * 获取终端尺寸
   */
  function getTerminalSize(id: string): TerminalSize | undefined {
    return terminalSizes.value.get(id)
  }

  /**
   * 清空所有标签页
   */
  function clearTabs(): void {
    tabs.value = []
    activeTabId.value = ''
    terminalSizes.value.clear()
  }

  /**
   * 切换 SSH/SFTP 模式
   * @param mode - 目标模式：'ssh' 或 'sftp'
   */
  function switchMode(mode: 'ssh' | 'sftp'): void {
    if (currentMode.value !== mode) {
      currentMode.value = mode
      console.log(`[TerminalStore] 切换到 ${mode.toUpperCase()} 模式`)
    }
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    tabCount,
    terminalSizes,
    currentMode,
    createTab,
    createSftpTab,
    closeTab,
    setActiveTab,
    switchMode,
    updateTabTitle,
    updateTabTerminalId,
    updateTabStatus,
    getTabById,
    updateTerminalSize,
    getTerminalSize,
    clearTabs
  }
})
