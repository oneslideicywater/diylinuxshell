/**
 * StoreService 单元测试
 * 测试数据存储服务的核心功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Session, SessionGroup, AppConfig } from '@shared/types'

// Mock electron-store
const mockStore: Record<string, unknown> = {}

vi.mock('electron-store', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      get: vi.fn((key: string, defaultValue: unknown) => mockStore[key] ?? defaultValue),
      set: vi.fn((key: string, value: unknown) => {
        mockStore[key] = value
      }),
      clear: vi.fn(() => {
        Object.keys(mockStore).forEach(key => delete mockStore[key])
      })
    }))
  }
})

// 重新导入以应用 mock
const { StoreService } = await import('../store')

describe('StoreService', () => {
  beforeEach(() => {
    // 清空 mock store
    Object.keys(mockStore).forEach(key => delete mockStore[key])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Session Management', () => {
    describe('getSessions', () => {
      it('should return empty array when no sessions', () => {
        const sessions = StoreService.getSessions()
        expect(sessions).toEqual([])
      })

      it('should return all sessions', () => {
        const mockSession: Session = {
          id: 'session-1',
          name: 'Test Session',
          host: 'localhost',
          port: 22,
          username: 'test',
          authType: 'password',
          status: 'disconnected',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        StoreService.addSession(mockSession)
        
        const sessions = StoreService.getSessions()
        expect(sessions).toHaveLength(1)
        expect(sessions[0].id).toBe('session-1')
      })
    })

    describe('addSession', () => {
      it('should add a new session', () => {
        const session: Session = {
          id: 'session-1',
          name: 'Test Session',
          host: '192.168.1.1',
          port: 22,
          username: 'admin',
          authType: 'password',
          status: 'disconnected',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }

        StoreService.addSession(session)
        const sessions = StoreService.getSessions()

        expect(sessions).toHaveLength(1)
        expect(sessions[0]).toEqual(session)
      })

      it('should add multiple sessions', () => {
        const session1: Session = {
          id: 'session-1',
          name: 'Session 1',
          host: 'host1',
          port: 22,
          username: 'user1',
          authType: 'password',
          status: 'disconnected',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        const session2: Session = {
          id: 'session-2',
          name: 'Session 2',
          host: 'host2',
          port: 22,
          username: 'user2',
          authType: 'password',
          status: 'disconnected',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }

        StoreService.addSession(session1)
        StoreService.addSession(session2)
        const sessions = StoreService.getSessions()

        expect(sessions).toHaveLength(2)
      })
    })

    describe('updateSession', () => {
      it('should update an existing session', () => {
        const session: Session = {
          id: 'session-1',
          name: 'Original Name',
          host: 'localhost',
          port: 22,
          username: 'test',
          authType: 'password',
          status: 'disconnected',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }

        StoreService.addSession(session)
        StoreService.updateSession('session-1', { name: 'Updated Name' })
        const sessions = StoreService.getSessions()

        expect(sessions[0].name).toBe('Updated Name')
      })

      it('should not modify other sessions', () => {
        const session1: Session = {
          id: 'session-1',
          name: 'Session 1',
          host: 'host1',
          port: 22,
          username: 'user1',
          authType: 'password',
          status: 'disconnected',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        const session2: Session = {
          id: 'session-2',
          name: 'Session 2',
          host: 'host2',
          port: 22,
          username: 'user2',
          authType: 'password',
          status: 'disconnected',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }

        StoreService.addSession(session1)
        StoreService.addSession(session2)
        StoreService.updateSession('session-1', { name: 'Updated' })
        const sessions = StoreService.getSessions()

        expect(sessions[0].name).toBe('Updated')
        expect(sessions[1].name).toBe('Session 2')
      })
    })

    describe('deleteSession', () => {
      it('should delete a session by id', () => {
        const session: Session = {
          id: 'session-1',
          name: 'Test Session',
          host: 'localhost',
          port: 22,
          username: 'test',
          authType: 'password',
          status: 'disconnected',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }

        StoreService.addSession(session)
        StoreService.deleteSession('session-1')
        const sessions = StoreService.getSessions()

        expect(sessions).toHaveLength(0)
      })

      it('should only delete the specified session', () => {
        const session1: Session = {
          id: 'session-1',
          name: 'Session 1',
          host: 'host1',
          port: 22,
          username: 'user1',
          authType: 'password',
          status: 'disconnected',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        const session2: Session = {
          id: 'session-2',
          name: 'Session 2',
          host: 'host2',
          port: 22,
          username: 'user2',
          authType: 'password',
          status: 'disconnected',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }

        StoreService.addSession(session1)
        StoreService.addSession(session2)
        StoreService.deleteSession('session-1')
        const sessions = StoreService.getSessions()

        expect(sessions).toHaveLength(1)
        expect(sessions[0].id).toBe('session-2')
      })
    })

    describe('getSessionById', () => {
      it('should return session by id', () => {
        const session: Session = {
          id: 'session-1',
          name: 'Test Session',
          host: 'localhost',
          port: 22,
          username: 'test',
          authType: 'password',
          status: 'disconnected',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }

        StoreService.addSession(session)
        const result = StoreService.getSessionById('session-1')

        expect(result).toEqual(session)
      })

      it('should return undefined for non-existent session', () => {
        const result = StoreService.getSessionById('non-existent')
        expect(result).toBeUndefined()
      })
    })
  })

  describe('Session Group Management', () => {
    describe('getSessionGroups', () => {
      it('should return empty array when no groups', () => {
        const groups = StoreService.getSessionGroups()
        expect(groups).toEqual([])
      })
    })

    describe('addSessionGroup', () => {
      it('should add a new session group', () => {
        const group: SessionGroup = {
          id: 'group-1',
          name: 'Production',
          order: 0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }

        StoreService.addSessionGroup(group)
        const groups = StoreService.getSessionGroups()

        expect(groups).toHaveLength(1)
        expect(groups[0].name).toBe('Production')
      })
    })

    describe('updateSessionGroup', () => {
      it('should update an existing group', () => {
        const group: SessionGroup = {
          id: 'group-1',
          name: 'Original',
          order: 0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }

        StoreService.addSessionGroup(group)
        StoreService.updateSessionGroup('group-1', { name: 'Updated' })
        const groups = StoreService.getSessionGroups()

        expect(groups[0].name).toBe('Updated')
      })
    })

    describe('deleteSessionGroup', () => {
      it('should delete a group by id', () => {
        const group: SessionGroup = {
          id: 'group-1',
          name: 'Test Group',
          order: 0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }

        StoreService.addSessionGroup(group)
        StoreService.deleteSessionGroup('group-1')
        const groups = StoreService.getSessionGroups()

        expect(groups).toHaveLength(0)
      })
    })
  })

  describe('Config Management', () => {
    describe('getConfig', () => {
      it('should return default config when not set', () => {
        const config = StoreService.getConfig()
        expect(config).toBeDefined()
        expect(config.theme).toBe('dark')
        expect(config.terminal).toBeDefined()
      })
    })

    describe('setConfig', () => {
      it('should update config', () => {
        StoreService.setConfig({ theme: 'light' })
        const config = StoreService.getConfig()
        expect(config.theme).toBe('light')
      })

      it('should merge with existing config', () => {
        StoreService.setConfig({ theme: 'light' })
        StoreService.setConfig({ language: 'en-US' })
        const config = StoreService.getConfig()
        
        expect(config.theme).toBe('light')
        expect(config.language).toBe('en-US')
      })
    })

    describe('resetConfig', () => {
      it('should reset config to default', () => {
        StoreService.setConfig({ theme: 'light' })
        StoreService.resetConfig()
        const config = StoreService.getConfig()
        
        expect(config.theme).toBe('dark')
      })
    })
  })

  describe('Data Export/Import', () => {
    it('should export all data', () => {
      const session: Session = {
        id: 'session-1',
        name: 'Test',
        host: 'localhost',
        port: 22,
        username: 'test',
        authType: 'password',
        status: 'disconnected',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      StoreService.addSession(session)

      const data = StoreService.exportAll()
      expect(data.sessions).toHaveLength(1)
      expect(data.config).toBeDefined()
    })

    it('should import data', () => {
      const importData = {
        sessions: [{
          id: 'imported-1',
          name: 'Imported Session',
          host: 'remote',
          port: 22,
          username: 'admin',
          authType: 'password' as const,
          status: 'disconnected' as const,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }],
        sessionGroups: [],
        commandSnippets: [],
        commandSnippetGroups: [],
        config: {
          theme: 'dark',
          language: 'zh-CN',
          terminal: {
            fontSize: 14,
            fontFamily: 'Consolas',
            cursorStyle: 'block' as const,
            cursorBlink: true,
            scrollback: 10000,
            terminalType: 'xterm-256color'
          },
          connectionTimeout: 30000,
          keepaliveInterval: 30000,
          autoReconnect: true,
          reconnectAttempts: 3
        }
      }

      StoreService.importData(importData)
      const sessions = StoreService.getSessions()
      
      expect(sessions).toHaveLength(1)
      expect(sessions[0].name).toBe('Imported Session')
    })
  })

  describe('clearAll', () => {
    it('should clear all data', () => {
      const session: Session = {
        id: 'session-1',
        name: 'Test',
        host: 'localhost',
        port: 22,
        username: 'test',
        authType: 'password',
        status: 'disconnected',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      StoreService.addSession(session)
      StoreService.clearAll()
      
      const sessions = StoreService.getSessions()
      expect(sessions).toHaveLength(0)
    })
  })
})
