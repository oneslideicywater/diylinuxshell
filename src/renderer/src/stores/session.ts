import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Session, SessionGroup } from '@shared/types'

/**
 * 会话状态管理Store
 * 管理会话配置信息和分组
 */
export const useSessionStore = defineStore('session', () => {
  // 会话列表
  const sessions = ref<Session[]>([])

  // 会话分组列表
  const sessionGroups = ref<SessionGroup[]>([])

  // 当前激活的会话ID
  const activeSessionId = ref<string>('')

  // 计算属性：当前激活的会话
  const activeSession = computed(() => {
    return sessions.value.find(s => s.id === activeSessionId.value)
  })

  // 计算属性：未分组的会话
  const ungroupedSessions = computed(() => {
    return sessions.value.filter(s => !s.groupId)
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
   * 清空所有会话
   */
  function clearSessions(): void {
    sessions.value = []
    activeSessionId.value = ''
  }

  /**
   * 获取分组中的会话
   */
  function getGroupSessions(groupId: string): Session[] {
    return sessions.value.filter(s => s.groupId === groupId)
  }

  /**
   * 添加会话分组
   */
  function addSessionGroup(group: SessionGroup): void {
    sessionGroups.value.push(group)
  }

  /**
   * 移除会话分组
   */
  function removeSessionGroup(id: string): void {
    const index = sessionGroups.value.findIndex(g => g.id === id)
    if (index !== -1) {
      sessionGroups.value.splice(index, 1)
      // 将该分组下的会话移至未分组
      sessions.value.forEach(s => {
        if (s.groupId === id) {
          s.groupId = undefined
        }
      })
    }
  }

  /**
   * 更新会话分组
   */
  function updateSessionGroup(id: string, updates: Partial<SessionGroup>): void {
    const group = sessionGroups.value.find(g => g.id === id)
    if (group) {
      Object.assign(group, updates, { updatedAt: Date.now() })
    }
  }

  /**
   * 根据ID获取会话分组
   */
  function getSessionGroupById(id: string): SessionGroup | undefined {
    return sessionGroups.value.find(g => g.id === id)
  }

  /**
   * 清空所有会话分组
   */
  function clearSessionGroups(): void {
    sessionGroups.value = []
    // 将所有会话移至未分组
    sessions.value.forEach(s => {
      s.groupId = undefined
    })
  }

  return {
    sessions,
    sessionGroups,
    activeSessionId,
    activeSession,
    ungroupedSessions,
    addSession,
    removeSession,
    updateSession,
    setActiveSession,
    getSessionById,
    clearSessions,
    getGroupSessions,
    addSessionGroup,
    removeSessionGroup,
    updateSessionGroup,
    getSessionGroupById,
    clearSessionGroups
  }
})
