/**
 * SSHManager 单元测试
 * 测试 SSH 连接管理器的核心功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Session } from '@shared/types'

// Mock ssh2
const mockClient = {
  on: vi.fn(),
  connect: vi.fn(),
  destroy: vi.fn(),
  shell: vi.fn()
}

const mockStream = {
  on: vi.fn(),
  write: vi.fn(),
  end: vi.fn(),
  setWindow: vi.fn(),
  removeListener: vi.fn()
}

vi.mock('ssh2', () => ({
  Client: vi.fn(() => mockClient)
}))

// Mock crypto service
vi.mock('../crypto', () => ({
  CryptoService: {
    decrypt: vi.fn((text: string) => text),
    generateSessionId: vi.fn(() => 'session-test-id')
  }
}))

// Mock fs
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(() => Buffer.from('mock-private-key'))
  }
}))

const { SSHManager } = await import('../ssh-manager')

describe('SSHManager', () => {
  const createMockSession = (overrides: Partial<Session> = {}): Session => ({
    id: 'session-1',
    name: 'Test Session',
    host: 'localhost',
    port: 22,
    username: 'testuser',
    authType: 'password',
    password: 'test-password',
    status: 'disconnected',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // 重置 mock 状态
    mockClient.on.mockClear()
    mockClient.connect.mockClear()
    mockClient.destroy.mockClear()
    mockClient.shell.mockClear()
    mockStream.on.mockClear()
    mockStream.write.mockClear()
    mockStream.end.mockClear()
    mockStream.setWindow.mockClear()
    
    // 清空所有连接
    SSHManager.disconnectAll()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('connect', () => {
    it('should create SSH connection with password auth', async () => {
      const session = createMockSession()
      
      // 模拟成功连接
      mockClient.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          setTimeout(callback, 0)
        }
      })
      mockClient.shell.mockImplementation((callback: (err: null, stream: typeof mockStream) => void) => {
        callback(null, mockStream)
      })

      const result = await SSHManager.connect(session)
      
      expect(result).toBe('session-1')
      expect(mockClient.connect).toHaveBeenCalled()
    })

    it('should disconnect existing connection before creating new one', async () => {
      const session = createMockSession()
      
      // 第一次连接
      mockClient.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          setTimeout(callback, 0)
        }
      })
      mockClient.shell.mockImplementation((callback: (err: null, stream: typeof mockStream) => void) => {
        callback(null, mockStream)
      })

      await SSHManager.connect(session)
      expect(SSHManager.getConnectionCount()).toBe(1)

      // 第二次连接同一个会话
      await SSHManager.connect(session)
      expect(SSHManager.getConnectionCount()).toBe(1)
    })

    it('should handle connection timeout', async () => {
      const session = createMockSession()
      
      // 模拟超时（不触发 ready 事件）
      mockClient.on.mockImplementation(() => {})

      await expect(SSHManager.connect(session)).rejects.toThrow('Connection timeout')
    })

    it('should handle connection error', async () => {
      const session = createMockSession()
      
      mockClient.on.mockImplementation((event: string, callback: (err: Error) => void) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Connection refused')), 0)
        }
      })

      await expect(SSHManager.connect(session)).rejects.toThrow('Connection refused')
    })
  })

  describe('disconnect', () => {
    it('should disconnect an existing connection', async () => {
      const session = createMockSession()
      
      mockClient.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          setTimeout(callback, 0)
        }
      })
      mockClient.shell.mockImplementation((callback: (err: null, stream: typeof mockStream) => void) => {
        callback(null, mockStream)
      })

      await SSHManager.connect(session)
      expect(SSHManager.hasConnection('session-1')).toBe(true)

      await SSHManager.disconnect('session-1')
      expect(SSHManager.hasConnection('session-1')).toBe(false)
      expect(mockClient.destroy).toHaveBeenCalled()
    })

    it('should not throw when disconnecting non-existent connection', async () => {
      await expect(SSHManager.disconnect('non-existent')).resolves.not.toThrow()
    })
  })

  describe('disconnectAll', () => {
    it('should disconnect all connections', async () => {
      const session1 = createMockSession({ id: 'session-1' })
      const session2 = createMockSession({ id: 'session-2' })
      
      mockClient.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          setTimeout(callback, 0)
        }
      })
      mockClient.shell.mockImplementation((callback: (err: null, stream: typeof mockStream) => void) => {
        callback(null, mockStream)
      })

      await SSHManager.connect(session1)
      await SSHManager.connect(session2)
      expect(SSHManager.getConnectionCount()).toBe(2)

      await SSHManager.disconnectAll()
      expect(SSHManager.getConnectionCount()).toBe(0)
    })
  })

  describe('getStatus', () => {
    it('should return connection status', async () => {
      const session = createMockSession()
      
      mockClient.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          setTimeout(callback, 0)
        }
      })
      mockClient.shell.mockImplementation((callback: (err: null, stream: typeof mockStream) => void) => {
        callback(null, mockStream)
      })

      await SSHManager.connect(session)
      const status = SSHManager.getStatus('session-1')
      
      expect(status).toBe('connected')
    })

    it('should return null for non-existent connection', () => {
      const status = SSHManager.getStatus('non-existent')
      expect(status).toBeNull()
    })
  })

  describe('hasConnection', () => {
    it('should return true for existing connection', async () => {
      const session = createMockSession()
      
      mockClient.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          setTimeout(callback, 0)
        }
      })
      mockClient.shell.mockImplementation((callback: (err: null, stream: typeof mockStream) => void) => {
        callback(null, mockStream)
      })

      await SSHManager.connect(session)
      expect(SSHManager.hasConnection('session-1')).toBe(true)
    })

    it('should return false for non-existent connection', () => {
      expect(SSHManager.hasConnection('non-existent')).toBe(false)
    })
  })

  describe('getConnectionCount', () => {
    it('should return correct connection count', async () => {
      expect(SSHManager.getConnectionCount()).toBe(0)

      const session = createMockSession()
      
      mockClient.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          setTimeout(callback, 0)
        }
      })
      mockClient.shell.mockImplementation((callback: (err: null, stream: typeof mockStream) => void) => {
        callback(null, mockStream)
      })

      await SSHManager.connect(session)
      expect(SSHManager.getConnectionCount()).toBe(1)
    })
  })

  describe('write', () => {
    it('should write data to stream', async () => {
      const session = createMockSession()
      
      mockClient.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          setTimeout(callback, 0)
        }
      })
      mockClient.shell.mockImplementation((callback: (err: null, stream: typeof mockStream) => void) => {
        callback(null, mockStream)
      })

      await SSHManager.connect(session)
      SSHManager.write('session-1', 'ls -la\n')
      
      expect(mockStream.write).toHaveBeenCalledWith('ls -la\n')
    })

    it('should not throw when writing to non-existent connection', () => {
      expect(() => SSHManager.write('non-existent', 'test')).not.toThrow()
    })
  })

  describe('resize', () => {
    it('should resize terminal window', async () => {
      const session = createMockSession()
      
      mockClient.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          setTimeout(callback, 0)
        }
      })
      mockClient.shell.mockImplementation((callback: (err: null, stream: typeof mockStream) => void) => {
        callback(null, mockStream)
      })

      await SSHManager.connect(session)
      SSHManager.resize('session-1', 24, 80)
      
      expect(mockStream.setWindow).toHaveBeenCalledWith(24, 80, 480, 640)
    })

    it('should not throw when resizing non-existent connection', () => {
      expect(() => SSHManager.resize('non-existent', 24, 80)).not.toThrow()
    })
  })

  describe('onData', () => {
    it('should register data listener', async () => {
      const session = createMockSession()
      
      mockClient.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          setTimeout(callback, 0)
        }
      })
      mockClient.shell.mockImplementation((callback: (err: null, stream: typeof mockStream) => void) => {
        callback(null, mockStream)
      })

      await SSHManager.connect(session)
      const callback = vi.fn()
      const unsubscribe = SSHManager.onData('session-1', callback)
      
      expect(mockStream.on).toHaveBeenCalledWith('data', expect.any(Function))
      expect(typeof unsubscribe).toBe('function')
    })

    it('should return empty function for non-existent connection', () => {
      const unsubscribe = SSHManager.onData('non-existent', vi.fn())
      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('onClose', () => {
    it('should register close listener', async () => {
      const session = createMockSession()
      
      mockClient.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          setTimeout(callback, 0)
        }
      })
      mockClient.shell.mockImplementation((callback: (err: null, stream: typeof mockStream) => void) => {
        callback(null, mockStream)
      })

      await SSHManager.connect(session)
      const callback = vi.fn()
      const unsubscribe = SSHManager.onClose('session-1', callback)
      
      expect(mockStream.on).toHaveBeenCalledWith('close', callback)
      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('onError', () => {
    it('should register error listener', async () => {
      const session = createMockSession()
      
      mockClient.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          setTimeout(callback, 0)
        }
      })
      mockClient.shell.mockImplementation((callback: (err: null, stream: typeof mockStream) => void) => {
        callback(null, mockStream)
      })

      await SSHManager.connect(session)
      const callback = vi.fn()
      const unsubscribe = SSHManager.onError('session-1', callback)
      
      expect(mockClient.on).toHaveBeenCalledWith('error', callback)
      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('getAllConnections', () => {
    it('should return all connections', async () => {
      const session = createMockSession()
      
      mockClient.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          setTimeout(callback, 0)
        }
      })
      mockClient.shell.mockImplementation((callback: (err: null, stream: typeof mockStream) => void) => {
        callback(null, mockStream)
      })

      await SSHManager.connect(session)
      const connections = SSHManager.getAllConnections()
      
      expect(connections).toHaveLength(1)
      expect(connections[0].sessionId).toBe('session-1')
    })
  })

  describe('getConnection', () => {
    it('should return connection by session id', async () => {
      const session = createMockSession()
      
      mockClient.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          setTimeout(callback, 0)
        }
      })
      mockClient.shell.mockImplementation((callback: (err: null, stream: typeof mockStream) => void) => {
        callback(null, mockStream)
      })

      await SSHManager.connect(session)
      const connection = SSHManager.getConnection('session-1')
      
      expect(connection).toBeDefined()
      expect(connection?.sessionId).toBe('session-1')
    })

    it('should return undefined for non-existent connection', () => {
      const connection = SSHManager.getConnection('non-existent')
      expect(connection).toBeUndefined()
    })
  })
})
