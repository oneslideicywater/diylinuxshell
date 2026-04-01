import { describe, it, expect, beforeEach } from 'vitest'
import { useTerminalStore } from '@/stores/terminal'
import { createPinia, setActivePinia } from 'pinia'

/**
 * Terminal Store 单元测试
 */
describe('TerminalStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('initial state', () => {
    it('should have empty tabs array initially', () => {
      const store = useTerminalStore()
      expect(store.tabs).toEqual([])
    })

    it('should have no active tab initially', () => {
      const store = useTerminalStore()
      expect(store.activeTabId).toBe('')
    })

    it('should have zero tab count initially', () => {
      const store = useTerminalStore()
      expect(store.tabCount).toBe(0)
    })
  })

  describe('createTab', () => {
    it('should create a new tab', () => {
      const store = useTerminalStore()
      const tab = store.createTab('Test Tab', 'session-1')

      expect(store.tabs).toHaveLength(1)
      expect(tab.title).toBe('Test Tab')
      expect(tab.sessionId).toBe('session-1')
    })

    it('should set the new tab as active', () => {
      const store = useTerminalStore()
      const tab = store.createTab('Test Tab', 'session-1')

      expect(store.activeTabId).toBe(tab.id)
    })

    it('should increment tab count', () => {
      const store = useTerminalStore()
      store.createTab('Tab 1', 'session-1')
      store.createTab('Tab 2', 'session-2')

      expect(store.tabCount).toBe(2)
    })
  })

  describe('closeTab', () => {
    it('should close a tab by id', () => {
      const store = useTerminalStore()
      const tab = store.createTab('Test Tab', 'session-1')

      store.closeTab(tab.id)

      expect(store.tabs).toHaveLength(0)
    })

    it('should switch to adjacent tab when closing active tab', () => {
      const store = useTerminalStore()
      const tab1 = store.createTab('Tab 1', 'session-1')
      const tab2 = store.createTab('Tab 2', 'session-2')

      store.closeTab(tab2.id)

      expect(store.activeTabId).toBe(tab1.id)
    })

    it('should clear active tab id when closing last tab', () => {
      const store = useTerminalStore()
      const tab = store.createTab('Test Tab', 'session-1')

      store.closeTab(tab.id)

      expect(store.activeTabId).toBe('')
    })
  })

  describe('setActiveTab', () => {
    it('should set active tab id', () => {
      const store = useTerminalStore()
      const tab = store.createTab('Test Tab', 'session-1')

      store.createTab('Tab 2', 'session-2')
      store.setActiveTab(tab.id)

      expect(store.activeTabId).toBe(tab.id)
    })

    it('should not set active tab id for non-existent tab', () => {
      const store = useTerminalStore()
      store.createTab('Test Tab', 'session-1')

      store.setActiveTab('non-existent')

      expect(store.activeTabId).not.toBe('non-existent')
    })
  })

  describe('updateTabTitle', () => {
    it('should update tab title', () => {
      const store = useTerminalStore()
      const tab = store.createTab('Test Tab', 'session-1')

      store.updateTabTitle(tab.id, 'Updated Title')

      expect(store.tabs[0].title).toBe('Updated Title')
    })
  })

  describe('getTabById', () => {
    it('should return tab by id', () => {
      const store = useTerminalStore()
      const tab = store.createTab('Test Tab', 'session-1')

      const result = store.getTabById(tab.id)

      expect(result).toEqual(tab)
    })

    it('should return undefined for non-existent tab', () => {
      const store = useTerminalStore()
      const result = store.getTabById('non-existent')

      expect(result).toBeUndefined()
    })
  })

  describe('terminalSizes', () => {
    it('should update and get terminal size', () => {
      const store = useTerminalStore()
      const tab = store.createTab('Test Tab', 'session-1')
      const size = { cols: 80, rows: 24, width: 800, height: 600 }

      store.updateTerminalSize(tab.id, size)
      const result = store.getTerminalSize(tab.id)

      expect(result).toEqual(size)
    })

    it('should delete terminal size when closing tab', () => {
      const store = useTerminalStore()
      const tab = store.createTab('Test Tab', 'session-1')
      const size = { cols: 80, rows: 24, width: 800, height: 600 }

      store.updateTerminalSize(tab.id, size)
      store.closeTab(tab.id)
      const result = store.getTerminalSize(tab.id)

      expect(result).toBeUndefined()
    })
  })

  describe('clearTabs', () => {
    it('should clear all tabs', () => {
      const store = useTerminalStore()
      store.createTab('Tab 1', 'session-1')
      store.createTab('Tab 2', 'session-2')

      store.clearTabs()

      expect(store.tabs).toHaveLength(0)
      expect(store.activeTabId).toBe('')
    })
  })
})
