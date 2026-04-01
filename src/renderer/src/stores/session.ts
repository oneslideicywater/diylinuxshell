import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Session } from '@shared/types'

/**
 * 会话状态管理Store
 */
export const useSessionStore = defineStore('session', () => {
  // 会话列表
  const sessions = ref<Session[]>([])

  // 当前激活的会话ID
  const activeSessionId = ref<string>('')

  // 计算属性：当前激活的会话
  const activeSession = computed(() => {
    return sessions.value.find(s => s.id === activeSessionId.value)
  })

  // 计算属性：已连接的会话
  const connectedSessions = computed(() => {
    return sessions.value.filter(s => s.status === 'connected')
  })

  /**
   * 添加会话
   */
  function addSession(session: Session): void {
    sessions.value.push(session)
  }

  /**
   * 移除会话
   */
  function removeSession(id: string): void {
    const index = sessions.value.findIndex(s => s.id === id)
    if (index !== -1) {
      sessions.value.splice(index, 1)
      // 如果移除的是当前激活的会话，清除激活状态
      if (activeSessionId.value === id) {
        activeSessionId.value = ''
      }
    }
  }

  /**
   * 更新会话
   */
  function updateSession(id: string, updates: Partial<Session>): void {
    const session = sessions.value.find(s => s.id === id)
    if (session) {
      Object.assign(session, updates, { updatedAt: Date.now() })
    }
  }

  /**
   * 设置当前激活的会话
   */
  function setActiveSession(id: string): void {
    activeSessionId.value = id
  }

  /**
   * 根据ID获取会话
   */
  function getSessionById(id: string): Session | undefined {
    return sessions.value.find(s => s.id === id)
  }

  /**
   * 更新会话状态
   */
  function updateSessionStatus(id: string, status: Session['status']): void {
    updateSession(id, { status })
  }

  /**
   * 清空所有会话
   */
  function clearSessions(): void {
    sessions.value = []
    activeSessionId.value = ''
  }

  return {
    sessions,
    activeSessionId,
    activeSession,
    connectedSessions,
    addSession,
    removeSession,
    updateSession,
    setActiveSession,
    getSessionById,
    updateSessionStatus,
    clearSessions
  }
})
