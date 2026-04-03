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
      status: 'disconnected'
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

  return {
    tabs,
    activeTabId,
    activeTab,
    tabCount,
    terminalSizes,
    createTab,
    closeTab,
    setActiveTab,
    updateTabTitle,
    updateTabTerminalId,
    updateTabStatus,
    getTabById,
    updateTerminalSize,
    getTerminalSize,
    clearTabs
  }
})
