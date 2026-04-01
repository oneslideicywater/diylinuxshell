import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '@/stores/session'
import { createPinia, setActivePinia } from 'pinia'

/**
 * Session Store 单元测试
 */
describe('SessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('initial state', () => {
    it('should have empty sessions array initially', () => {
      const store = useSessionStore()
      expect(store.sessions).toEqual([])
    })

    it('should have no active session initially', () => {
      const store = useSessionStore()
      expect(store.activeSessionId).toBe('')
    })
  })

  describe('addSession', () => {
    it('should add a new session', () => {
      const store = useSessionStore()
      const session = {
        id: 'test-1',
        name: 'Test Session',
        host: 'localhost',
        port: 22,
        username: 'test',
        authType: 'password' as const,
        status: 'disconnected' as const,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      store.addSession(session)

      expect(store.sessions).toHaveLength(1)
      expect(store.sessions[0]).toEqual(session)
    })
  })

  describe('removeSession', () => {
    it('should remove a session by id', () => {
      const store = useSessionStore()
      const session = {
        id: 'test-1',
        name: 'Test Session',
        host: 'localhost',
        port: 22,
        username: 'test',
        authType: 'password' as const,
        status: 'disconnected' as const,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      store.addSession(session)
      store.removeSession('test-1')

      expect(store.sessions).toHaveLength(0)
    })

    it('should not throw if session not found', () => {
      const store = useSessionStore()
      expect(() => store.removeSession('non-existent')).not.toThrow()
    })
  })

  describe('updateSession', () => {
    it('should update an existing session', () => {
      const store = useSessionStore()
      const session = {
        id: 'test-1',
        name: 'Test Session',
        host: 'localhost',
        port: 22,
        username: 'test',
        authType: 'password' as const,
        status: 'disconnected' as const,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      store.addSession(session)
      store.updateSession('test-1', { name: 'Updated Session' })

      expect(store.sessions[0].name).toBe('Updated Session')
    })
  })

  describe('setActiveSession', () => {
    it('should set active session id', () => {
      const store = useSessionStore()
      store.setActiveSession('test-1')
      expect(store.activeSessionId).toBe('test-1')
    })
  })

  describe('getSessionById', () => {
    it('should return session by id', () => {
      const store = useSessionStore()
      const session = {
        id: 'test-1',
        name: 'Test Session',
        host: 'localhost',
        port: 22,
        username: 'test',
        authType: 'password' as const,
        status: 'disconnected' as const,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      store.addSession(session)
      const result = store.getSessionById('test-1')

      expect(result).toEqual(session)
    })

    it('should return undefined if session not found', () => {
      const store = useSessionStore()
      const result = store.getSessionById('non-existent')
      expect(result).toBeUndefined()
    })
  })
})
