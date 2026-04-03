/**
 * 会话 IPC 集成测试
 * 测试会话相关的 IPC 通信流程
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Session } from '@shared/types'

// Mock electron
const mockIpcMain = {
  handle: vi.fn(),
  on: vi.fn()
}

const mockBrowserWindow = {
  fromWebContents: vi.fn(() => ({
    webContents: {
      send: vi.fn()
    }
  }))
}

vi.mock('electron', () => ({
  ipcMain: mockIpcMain,
  BrowserWindow: mockBrowserWindow
}))

// Mock services
vi.mock('@main/services/store', () => ({
  StoreService: {
    getSessions: vi.fn(() => []),
    getSessionById: vi.fn(),
    addSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn()
  }
}))

vi.mock('@main/services/crypto', () => ({
  CryptoService: {
    generateSessionId: vi.fn(() => 'session-test-id'),
    encrypt: vi.fn((text: string) => `encrypted:${text}`),
    decrypt: vi.fn((text: string) => text.replace('encrypted:', ''))
  }
}))

vi.mock('@main/services/ssh-manager', () => ({
  SSHManager: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    hasConnection: vi.fn(() => false),
    getStatus: vi.fn(),
    onData: vi.fn(),
    onClose: vi.fn(),
    onError: vi.fn()
  }
}))

describe('Session IPC Integration', () => {
  let handlers: Map<string, Function>
  let mockSession: Session

  beforeEach(async () => {
    handlers = new Map()
    
    // 重置 mocks
    vi.clearAllMocks()
    
    // 捕获 IPC 处理器注册
    mockIpcMain.handle.mockImplementation((channel: string, handler: Function) => {
      handlers.set(channel, handler)
    })

    mockSession = {
      id: 'session-1',
      name: 'Test Session',
      host: 'localhost',
      port: 22,
      username: 'testuser',
      authType: 'password',
      password: 'encrypted:test-password',
      status: 'disconnected',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    // 导入并注册处理器
    const { registerSessionHandlers } = await import('@main/ipc/session')
    registerSessionHandlers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('registerSessionHandlers', () => {
    it('should register all session IPC handlers', () => {
      expect(handlers.has('session:get-all')).toBe(true)
      expect(handlers.has('session:get-by-id')).toBe(true)
      expect(handlers.has('session:create')).toBe(true)
      expect(handlers.has('session:update')).toBe(true)
      expect(handlers.has('session:delete')).toBe(true)
      expect(handlers.has('session:connect')).toBe(true)
      expect(handlers.has('session:disconnect')).toBe(true)
      expect(handlers.has('session:get-status')).toBe(true)
    })
  })

  describe('session:get-all', () => {
    it('should return all sessions', async () => {
      const { StoreService } = await import('@main/services/store')
      vi.mocked(StoreService.getSessions).mockReturnValue([mockSession])
      
      const handler = handlers.get('session:get-all')
      const result = await handler?.({})
      
      expect(result).toEqual([mockSession])
    })
  })

  describe('session:get-by-id', () => {
    it('should return session by id', async () => {
      const { StoreService } = await import('@main/services/store')
      vi.mocked(StoreService.getSessionById).mockReturnValue(mockSession)
      
      const handler = handlers.get('session:get-by-id')
      const result = await handler?.({}, 'session-1')
      
      expect(result).toEqual(mockSession)
    })
  })

  describe('session:create', () => {
    it('should create a new session with encrypted password', async () => {
      const { StoreService } = await import('@main/services/store')
      const { CryptoService } = await import('@main/services/crypto')
      
      const handler = handlers.get('session:create')
      const sessionData = {
        name: 'New Session',
        host: '192.168.1.1',
        port: 22,
        username: 'admin',
        authType: 'password' as const,
        password: 'plain-password',
        status: 'disconnected' as const
      }
      
      const result = await handler?.({}, sessionData)
      
      expect(CryptoService.encrypt).toHaveBeenCalledWith('plain-password')
      expect(StoreService.addSession).toHaveBeenCalled()
      expect(result.id).toBe('session-test-id')
    })
  })

  describe('session:update', () => {
    it('should update session and encrypt password if provided', async () => {
      const { StoreService } = await import('@main/services/store')
      const { CryptoService } = await import('@main/services/crypto')
      vi.mocked(StoreService.getSessionById).mockReturnValue(mockSession)
      
      const handler = handlers.get('session:update')
      await handler?.({}, 'session-1', { password: 'new-password' })
      
      expect(CryptoService.encrypt).toHaveBeenCalledWith('new-password')
      expect(StoreService.updateSession).toHaveBeenCalled()
    })

    it('should update session without encrypting when password not provided', async () => {
      const { StoreService } = await import('@main/services/store')
      const { CryptoService } = await import('@main/services/crypto')
      vi.mocked(StoreService.getSessionById).mockReturnValue(mockSession)
      
      const handler = handlers.get('session:update')
      await handler?.({}, 'session-1', { name: 'Updated Name' })
      
      expect(CryptoService.encrypt).not.toHaveBeenCalled()
      expect(StoreService.updateSession).toHaveBeenCalledWith('session-1', { name: 'Updated Name' })
    })
  })

  describe('session:delete', () => {
    it('should delete session and disconnect if connected', async () => {
      const { StoreService } = await import('@main/services/store')
      const { SSHManager } = await import('@main/services/ssh-manager')
      vi.mocked(SSHManager.hasConnection).mockReturnValue(true)
      
      const handler = handlers.get('session:delete')
      await handler?.({}, 'session-1')
      
      expect(SSHManager.disconnect).toHaveBeenCalledWith('session-1')
      expect(StoreService.deleteSession).toHaveBeenCalledWith('session-1')
    })

    it('should delete session without disconnecting if not connected', async () => {
      const { StoreService } = await import('@main/services/store')
      const { SSHManager } = await import('@main/services/ssh-manager')
      vi.mocked(SSHManager.hasConnection).mockReturnValue(false)
      
      const handler = handlers.get('session:delete')
      await handler?.({}, 'session-1')
      
      expect(SSHManager.disconnect).not.toHaveBeenCalled()
      expect(StoreService.deleteSession).toHaveBeenCalledWith('session-1')
    })
  })

  describe('session:connect', () => {
    it('should connect to session successfully', async () => {
      const { StoreService } = await import('@main/services/store')
      const { SSHManager } = await import('@main/services/ssh-manager')
      
      vi.mocked(StoreService.getSessionById).mockReturnValue(mockSession)
      vi.mocked(SSHManager.connect).mockResolvedValue(undefined)
      vi.mocked(SSHManager.onData).mockReturnValue(() => {})
      vi.mocked(SSHManager.onClose).mockReturnValue(() => {})
      vi.mocked(SSHManager.onError).mockReturnValue(() => {})
      
      const mockEvent = {
        sender: {}
      }
      
      const handler = handlers.get('session:connect')
      const result = await handler?.(mockEvent, 'session-1')
      
      expect(StoreService.updateSession).toHaveBeenCalledWith('session-1', { status: 'connecting' })
      expect(SSHManager.connect).toHaveBeenCalledWith(mockSession)
      expect(result).toEqual({ success: true, sessionId: 'session-1' })
    })

    it('should throw error if session not found', async () => {
      const { StoreService } = await import('@main/services/store')
      vi.mocked(StoreService.getSessionById).mockReturnValue(undefined)
      
      const handler = handlers.get('session:connect')
      
      await expect(handler?.({}, 'non-existent')).rejects.toThrow('Session not found')
    })

    it('should handle connection error', async () => {
      const { StoreService } = await import('@main/services/store')
      const { SSHManager } = await import('@main/services/ssh-manager')
      
      vi.mocked(StoreService.getSessionById).mockReturnValue(mockSession)
      vi.mocked(SSHManager.connect).mockRejectedValue(new Error('Connection refused'))
      
      const mockEvent = {
        sender: {}
      }
      
      const handler = handlers.get('session:connect')
      
      await expect(handler?.(mockEvent, 'session-1')).rejects.toThrow('Connection refused')
      expect(StoreService.updateSession).toHaveBeenCalledWith('session-1', { status: 'disconnected' })
    })
  })

  describe('session:disconnect', () => {
    it('should disconnect session', async () => {
      const { StoreService } = await import('@main/services/store')
      const { SSHManager } = await import('@main/services/ssh-manager')
      
      const handler = handlers.get('session:disconnect')
      await handler?.({}, 'session-1')
      
      expect(SSHManager.disconnect).toHaveBeenCalledWith('session-1')
      expect(StoreService.updateSession).toHaveBeenCalledWith('session-1', { status: 'disconnected' })
    })
  })

  describe('session:get-status', () => {
    it('should return connection status', async () => {
      const { SSHManager } = await import('@main/services/ssh-manager')
      vi.mocked(SSHManager.getStatus).mockReturnValue('connected')
      
      const handler = handlers.get('session:get-status')
      const result = await handler?.({}, 'session-1')
      
      expect(result).toBe('connected')
    })
  })
})
