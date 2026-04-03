/**
 * 分组工具函数
 * 提供分组层级计算、验证等功能
 */

import type { SessionGroup } from '@shared/types'
import { MAX_GROUP_DEPTH } from '@shared/types'

/**
 * 计算分组的层级深度
 * @param groupId - 分组 ID
 * @param allGroups - 所有分组列表
 * @returns 分组层级深度（根分组为 1）
 */
export function calculateGroupDepth(groupId: string, allGroups: SessionGroup[]): number {
  const group = allGroups.find(g => g.id === groupId)
  if (!group) {
    return 1
  }

  // 如果已有深度值，直接返回
  if (group.depth) {
    return group.depth
  }

  // 递归计算父分组深度
  if (group.parentId) {
    const parentDepth = calculateGroupDepth(group.parentId, allGroups)
    return parentDepth + 1
  }

  // 根分组深度为 1
  return 1
}

/**
 * 检查是否可以在目标分组下创建子分组
 * @param targetGroupId - 目标分组 ID
 * @param allGroups - 所有分组列表
 * @returns true 表示可以创建，false 表示超出层级限制
 */
export function canCreateSubGroup(targetGroupId: string | undefined, allGroups: SessionGroup[]): boolean {
  // 如果没有目标分组（创建根分组），总是允许
  if (!targetGroupId) {
    return true
  }

  const targetGroup = allGroups.find(g => g.id === targetGroupId)
  if (!targetGroup) {
    return true
  }

  // 计算目标分组的深度
  const depth = targetGroup.depth || calculateGroupDepth(targetGroupId, allGroups)
  
  // 检查是否达到最大层级限制
  return depth < MAX_GROUP_DEPTH
}

/**
 * 检查是否可以将分组移动到目标分组下
 * @param sourceGroupId - 源分组 ID
 * @param targetGroupId - 目标分组 ID
 * @param allGroups - 所有分组列表
 * @returns true 表示可以移动，false 表示超出层级限制或循环引用
 */
export function canMoveGroup(
  sourceGroupId: string,
  targetGroupId: string | undefined,
  allGroups: SessionGroup[]
): boolean {
  // 如果没有目标分组（移动到根级别），总是允许
  if (!targetGroupId) {
    return true
  }

  // 不能将分组移动到自身下
  if (sourceGroupId === targetGroupId) {
    return false
  }

  // 检查是否会导致循环引用（目标分组不能是源分组的子分组）
  if (isDescendant(targetGroupId, sourceGroupId, allGroups)) {
    return false
  }

  // 计算目标分组的深度
  const targetDepth = calculateGroupDepth(targetGroupId, allGroups)
  
  // 检查移动后是否超出最大层级限制
  return targetDepth < MAX_GROUP_DEPTH
}

/**
 * 检查 targetGroup 是否是 sourceGroup 的后代分组
 * @param targetGroupId - 目标分组 ID
 * @param sourceGroupId - 源分组 ID
 * @param allGroups - 所有分组列表
 * @returns true 表示 targetGroup 是 sourceGroup 的后代
 */
function isDescendant(targetGroupId: string, sourceGroupId: string, allGroups: SessionGroup[]): boolean {
  const targetGroup = allGroups.find(g => g.id === targetGroupId)
  if (!targetGroup) {
    return false
  }

  // 如果目标分组没有父分组，说明是根分组
  if (!targetGroup.parentId) {
    return false
  }

  // 如果目标分组的父分组是源分组，说明是直接子分组
  if (targetGroup.parentId === sourceGroupId) {
    return true
  }

  // 递归检查父分组
  return isDescendant(targetGroup.parentId, sourceGroupId, allGroups)
}

/**
 * 获取分组的所有子分组（包括嵌套子分组）
 * @param groupId - 分组 ID
 * @param allGroups - 所有分组列表
 * @returns 所有子分组列表
 */
export function getAllSubGroups(groupId: string, allGroups: SessionGroup[]): SessionGroup[] {
  const subGroups: SessionGroup[] = []
  
  // 查找直接子分组
  const directChildren = allGroups.filter(g => g.parentId === groupId)
  
  for (const child of directChildren) {
    subGroups.push(child)
    // 递归获取子分组的子分组
    const grandchildren = getAllSubGroups(child.id, allGroups)
    subGroups.push(...grandchildren)
  }
  
  return subGroups
}

/**
 * 获取分组下的所有会话数量（包括子分组）
 * @param groupId - 分组 ID
 * @param allGroups - 所有分组列表
 * @param allSessions - 所有会话列表
 * @returns 会话总数
 */
export function getGroupSessionCount(
  groupId: string,
  allGroups: SessionGroup[],
  allSessions: { groupId?: string }[]
): number {
  // 获取所有子分组 ID
  const subGroupIds = getAllSubGroups(groupId, allGroups).map(g => g.id)
  
  // 统计该分组及所有子分组下的会话数量
  const count = allSessions.filter(s => s.groupId && [groupId, ...subGroupIds].includes(s.groupId)).length
  
  return count
}

/**
 * 更新所有分组的层级深度
 * @param groups - 分组列表
 * @returns 更新后的分组列表
 */
export function updateAllGroupDepths(groups: SessionGroup[]): SessionGroup[] {
  const updatedGroups = groups.map(g => ({ ...g }))
  
  // 为每个分组计算深度
  for (const group of updatedGroups) {
    if (!group.depth) {
      group.depth = calculateGroupDepth(group.id, updatedGroups)
    }
  }
  
  return updatedGroups
}
