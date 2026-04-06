/**
 * 会话分组相关IPC处理
 * 处理渲染进程的会话分组管理请求
 * @module ipc/session-group
 */

import { ipcMain } from 'electron'
import { StoreService } from '../services/store'
import { CryptoService } from '../services/crypto'
import { IPC_CHANNELS } from '@shared/constants/ipc-channels'
import type { SessionGroup } from '@shared/types'

/**
 * 注册会话分组相关IPC处理器
 */
export function registerSessionGroupHandlers(): void {
  /**
   * 获取所有会话分组
   */
  ipcMain.handle(IPC_CHANNELS.SESSION_GROUP.GET_ALL, () => {
    return StoreService.getSessionGroups()
  })

  /**
   * 创建会话分组
   */
  ipcMain.handle(
    IPC_CHANNELS.SESSION_GROUP.CREATE,
    (_event, groupData: Omit<SessionGroup, 'id' | 'createdAt' | 'updatedAt' | 'depth'>) => {
      // 验证分组名称
      if (!groupData.name || groupData.name.trim() === '') {
        throw new Error('分组名称不能为空')
      }

      const group: SessionGroup = {
        ...groupData,
        id: CryptoService.generateGroupId(),
        depth: 1, // 初始值，会在 StoreService 中计算
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      const result = StoreService.addSessionGroup(group)
      
      // 如果创建失败，返回错误信息
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return group
    }
  )

  /**
   * 更新会话分组
   */
  ipcMain.handle(
    IPC_CHANNELS.SESSION_GROUP.UPDATE,
    (_event, id: string, updates: Partial<SessionGroup>) => {
      const result = StoreService.updateSessionGroup(id, updates)
      
      // 如果更新失败，返回错误信息
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return StoreService.getSessionGroups().find((g) => g.id === id)
    }
  )

  /**
   * 删除会话分组
   */
  ipcMain.handle(IPC_CHANNELS.SESSION_GROUP.DELETE, (_event, id: string) => {
    // 检查是否是默认分组
    const groups = StoreService.getSessionGroups()
    const group = groups.find(g => g.id === id)
    
    if (!group) {
      throw new Error('分组不存在')
    }
    
    if (group.name === '默认分组') {
      throw new Error('默认分组不可删除')
    }
    
    StoreService.deleteSessionGroup(id)
    return true
  })

  /**
   * 检查是否可以在目标分组下创建子分组
   */
  ipcMain.handle(
    IPC_CHANNELS.SESSION_GROUP.CHECK_CAN_CREATE_SUBGROUP,
    (_event, targetGroupId: string | undefined) => {
      return StoreService.checkCanCreateSubGroup(targetGroupId)
    }
  )

  /**
   * 检查是否可以将分组移动到目标分组
   */
  ipcMain.handle(
    IPC_CHANNELS.SESSION_GROUP.CHECK_CAN_MOVE,
    (_event, sourceGroupId: string, targetGroupId: string | undefined) => {
      return StoreService.checkCanMoveGroup(sourceGroupId, targetGroupId)
    }
  )
}
