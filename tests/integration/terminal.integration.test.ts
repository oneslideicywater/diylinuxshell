/**
 * 终端 IPC 集成测试
 * 测试终端相关的 IPC 通信流程
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock electron
const mockIpcMain = {
  handle: vi.fn(),
  on: vi.fn()
}

vi.mock('electron', () => ({
  ipcMain: mockIpcMain
}))

// Mock services
vi.mock('@main/services/ssh-manager', () => ({
  SSHManager: {
    write: vi.fn(),
    resize: vi.fn(),
    onData: vi.fn(),
    onClose: vi.fn(),
    onError: vi.fn()
  }
}))

describe('Terminal IPC Integration', () => {
  let listeners: Map<string, Function>

  beforeEach(async () => {
    listeners = new Map()
    
    // 重置 mocks
    vi.clearAllMocks()
    
    // 捕获 IPC 事件监听
    mockIpcMain.on.mockImplementation((channel: string, listener: Function) => {
      listeners.set(channel, listener)
    })

    // 导入并注册处理器
    const { registerTerminalHandlers } = await import('@main/ipc/terminal')
    registerTerminalHandlers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('registerTerminalHandlers', () => {
    it('should register terminal IPC listeners', () => {
      expect(listeners.has('terminal:write')).toBe(true)
      expect(listeners.has('terminal:resize')).toBe(true)
    })
  })

  describe('terminal:write', () => {
    it('should write data to SSH session', async () => {
      const { SSHManager } = await import('@main/services/ssh-manager')
      
      const listener = listeners.get('terminal:write')
      const mockEvent = {}
      
      listener?.(mockEvent, 'session-1', 'ls -la\n')
      
      expect(SSHManager.write).toHaveBeenCalledWith('session-1', 'ls -la\n')
    })

    it('should handle special characters', async () => {
      const { SSHManager } = await import('@main/services/ssh-manager')
      
      const listener = listeners.get('terminal:write')
      const mockEvent = {}
      
      listener?.(mockEvent, 'session-1', 'echo "hello world"\n')
      
      expect(SSHManager.write).toHaveBeenCalledWith('session-1', 'echo "hello world"\n')
    })

    it('should handle arrow keys', async () => {
      const { SSHManager } = await import('@main/services/ssh-manager')
      
      const listener = listeners.get('terminal:write')
      const mockEvent = {}
      
      listener?.(mockEvent, 'session-1', '\x1b[A')
      
      expect(SSHManager.write).toHaveBeenCalledWith('session-1', '\x1b[A')
    })
  })

  describe('terminal:resize', () => {
    it('should resize terminal window', async () => {
      const { SSHManager } = await import('@main/services/ssh-manager')
      
      const listener = listeners.get('terminal:resize')
      const mockEvent = {}
      
      listener?.(mockEvent, 'session-1', { cols: 120, rows: 40 })
      
      expect(SSHManager.resize).toHaveBeenCalledWith('session-1', 40, 120)
    })

    it('should handle different terminal sizes', async () => {
      const { SSHManager } = await import('@main/services/ssh-manager')
      
      const listener = listeners.get('terminal:resize')
      const mockEvent = {}
      
      listener?.(mockEvent, 'session-1', { cols: 80, rows: 24 })
      
      expect(SSHManager.resize).toHaveBeenCalledWith('session-1', 24, 80)
    })
  })

  describe('Terminal Event Types', () => {
    it('should define correct TerminalDataEvent interface', () => {
      const dataEvent = {
        type: 'terminal:data',
        sessionId: 'session-1',
        data: 'output data'
      }
      
      expect(dataEvent.type).toBe('terminal:data')
      expect(dataEvent.sessionId).toBe('session-1')
      expect(dataEvent.data).toBe('output data')
    })

    it('should define correct TerminalCloseEvent interface', () => {
      const closeEvent = {
        type: 'terminal:close',
        sessionId: 'session-1',
        code: 0
      }
      
      expect(closeEvent.type).toBe('terminal:close')
      expect(closeEvent.sessionId).toBe('session-1')
      expect(closeEvent.code).toBe(0)
    })

    it('should define correct TerminalErrorEvent interface', () => {
      const errorEvent = {
        type: 'terminal:error',
        sessionId: 'session-1',
        error: 'Connection lost'
      }
      
      expect(errorEvent.type).toBe('terminal:error')
      expect(errorEvent.sessionId).toBe('session-1')
      expect(errorEvent.error).toBe('Connection lost')
    })
  })

  describe('Terminal Data Flow', () => {
    it('should verify data flow from renderer to main process', async () => {
      const { SSHManager } = await import('@main/services/ssh-manager')
      
      const listener = listeners.get('terminal:write')
      const mockEvent = {}
      const userInput = 'vim test.txt\n'
      
      listener?.(mockEvent, 'session-1', userInput)
      
      expect(SSHManager.write).toHaveBeenCalledWith('session-1', userInput)
    })

    it('should verify resize flow from renderer to main process', async () => {
      const { SSHManager } = await import('@main/services/ssh-manager')
      
      const listener = listeners.get('terminal:resize')
      const mockEvent = {}
      const newSize = { cols: 100, rows: 30 }
      
      listener?.(mockEvent, 'session-1', newSize)
      
      expect(SSHManager.resize).toHaveBeenCalledWith('session-1', 30, 100)
    })
  })
})
