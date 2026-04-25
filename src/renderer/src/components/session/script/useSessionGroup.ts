/**
 * 分组工具函数 Composable
 * 提供分组的查询和操作工具函数
 * 用于 SessionList 和 SessionGroupTree 组件共享逻辑
 * @module components/session/script/useSessionGroup
 */

import type { Session, SessionGroup } from '@shared/types'
import type { ComputedRef } from 'vue'
import { MAX_GROUP_DEPTH } from '@shared/types'

/**
 * 分组工具函数接口定义
 */
interface UseSessionGroupOptions {
  /** 所有分组列表（支持数组、函数或 ComputedRef） */
  allGroups: SessionGroup[] | (() => SessionGroup[]) | ComputedRef<SessionGroup[]>
  /** 所有会话列表（支持数组、函数或 ComputedRef） */
  sessions: Session[] | (() => Session[]) | ComputedRef<Session[]>
}

/**
 * 分组工具函数返回类型
 */
interface UseSessionGroupReturn {
  /** 获取直接子分组的会话列表 */
  getDirectGroupSessions: (groupId: string) => Session[]
  /** 获取分组会话数量（包括子分组） */
  getGroupSessionCount: (groupId: string) => number
  /** 获取分组会话列表（包括子分组） */
  getGroupSessions: (groupId: string) => Session[]
  /** 检查是否有子分组 */
  hasSubGroups: (groupId: string) => boolean
  /** 检查是否可以在目标分组下创建子分组 */
  canCreateSubGroupIn: (groupId: string) => boolean
}

/**
 * 分组工具函数 Composable
 * @param options - 配置选项，包含分组列表和会话列表
 * @returns 分组操作工具函数集合
 *
 * @example
 * ```ts
 * // 在组件中使用
 * const { getGroupSessionCount, hasSubGroups } = useSessionGroup({
 *   allGroups: computed(() => sessionStore.sessionGroups),
 *   sessions: computed(() => sessionStore.sessions)
 * })
 * ```
 */
export function useSessionGroup(options: UseSessionGroupOptions): UseSessionGroupReturn {
  /**
   * 获取所有分组列表（支持数组、函数或 ComputedRef）
   * 兼容多种数据源类型，确保返回正确的数组
   */
  const getAllGroups = (): SessionGroup[] => {
    const value = options.allGroups
    
    // 处理 ComputedRef 类型（Vue computed() 返回的对象）
    if (typeof value === 'object' && value !== null && 'value' in value) {
      return (value as ComputedRef<SessionGroup[]>).value
    }
    
    // 处理函数类型
    if (typeof value === 'function') {
      return (value as () => SessionGroup[])()
    }
    
    // 处理普通数组
    return value
  }

  /**
   * 获取所有会话列表（支持数组、函数或 ComputedRef）
   * 兼容多种数据源类型，确保返回正确的数组
   */
  const getAllSessions = (): Session[] => {
    const value = options.sessions
    
    // 处理 ComputedRef 类型（Vue computed() 返回的对象）
    if (typeof value === 'object' && value !== null && 'value' in value) {
      return (value as ComputedRef<Session[]>).value
    }
    
    // 处理函数类型
    if (typeof value === 'function') {
      return (value as () => Session[])()
    }
    
    // 处理普通数组
    return value
  }

  /**
   * 递归获取所有子分组 ID
   * @param gid - 父分组 ID
   * @returns 所有子分组 ID 数组（扁平化）
   *
   * @example
   * ```ts
   * // 假设结构：A -> A-1 -> A-1-1
   * getAllSubGroupIds('A') // 返回 ['A-1', 'A-1-1']
   * ```
   */
  const getAllSubGroupIds = (gid: string): string[] => {
    const groups = getAllGroups()
    const children = groups.filter(g => g.parentId === gid)
    const ids = children.map(c => c.id)
    return [...ids, ...children.flatMap(c => getAllSubGroupIds(c.id))]
  }

  /**
   * 获取直接属于指定分组的会话列表（不包括子分组中的会话）
   * @param groupId - 分组 ID
   * @returns 直接属于该分组的会话数组
   */
  const getDirectGroupSessions = (groupId: string): Session[] => {
    const sessionsList = getAllSessions()
    return sessionsList.filter(s => s.groupId === groupId)
  }

  /**
   * 获取分组会话数量（包括所有子分组中的会话）
   * @param groupId - 分组 ID
   * @returns 该分组及其所有子分组中的会话总数
   *
   * @example
   * ```ts
   * // 假设 A 有 2 个直接会话，A-1 有 1 个会话，A-1-1 有 1 个会话
   * getGroupSessionCount('A') // 返回 4
   * ```
   */
  const getGroupSessionCount = (groupId: string): number => {
    const sessionsList = getAllSessions()
    const subGroupIds = getAllSubGroupIds(groupId)
    return sessionsList.filter(s => s.groupId && [groupId, ...subGroupIds].includes(s.groupId)).length
  }

  /**
   * 获取分组会话列表（包括子分组中的会话）
   * @param groupId - 分组 ID
   * @returns 该分组及其所有子分组中的会话数组
   */
  const getGroupSessions = (groupId: string): Session[] => {
    const sessionsList = getAllSessions()
    const subGroupIds = getAllSubGroupIds(groupId)
    return sessionsList.filter(s => s.groupId && [groupId, ...subGroupIds].includes(s.groupId))
  }

  /**
   * 检查指定分组是否包含子分组
   * @param groupId - 分组 ID
   * @returns 如果有子分组返回 true，否则返回 false
   */
  const hasSubGroups = (groupId: string): boolean => {
    const groups = getAllGroups()
    return groups.some(g => g.parentId === groupId)
  }

  /**
 * 检查是否可以在目标分组下创建新的子分组
 * 业务规则：
 * 1. 默认分组不允许创建子分组（保持良好的分组规范）
 * 2. 基于最大嵌套深度限制（MAX_GROUP_DEPTH）
 * @param groupId - 目标分组 ID
 * @returns 如果可以创建子分组返回 true，否则返回 false
 *
 * @example
 * ```ts
 * // 默认分组不允许创建子分组
 * canCreateSubGroupIn('default-group-id') // 返回 false
 *
 * // 普通分组在层级限制内可以创建子分组
 * canCreateSubGroupIn('normal-group-id') // 返回 true（depth < MAX_GROUP_DEPTH）
 *
 * // 达到层级上限的分组不能创建子分组
 * canCreateSubGroupIn('deep-group-id') // 返回 false（depth >= MAX_GROUP_DEPTH）
 * ```
 */
const canCreateSubGroupIn = (groupId: string): boolean => {
  const groups = getAllGroups()
  const group = groups.find(g => g.id === groupId)
  if (!group) return false

  // 业务规则：默认分组不允许创建子分组
  if (group.name === '默认分组') {
    return false
  }

  // 检查层级深度限制
  return group.depth < MAX_GROUP_DEPTH
}

  return {
    getDirectGroupSessions,
    getGroupSessionCount,
    getGroupSessions,
    hasSubGroups,
    canCreateSubGroupIn
  }
}
