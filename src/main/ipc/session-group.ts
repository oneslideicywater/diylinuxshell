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
    (_event, groupData: Omit<SessionGroup, 'id' | 'createdAt' | 'updatedAt'>) => {
      const group: SessionGroup = {
        ...groupData,
        id: CryptoService.generateGroupId(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      StoreService.addSessionGroup(group)
      return group
    }
  )

  /**
   * 更新会话分组
   */
  ipcMain.handle(
    IPC_CHANNELS.SESSION_GROUP.UPDATE,
    (_event, id: string, updates: Partial<SessionGroup>) => {
      StoreService.updateSessionGroup(id, updates)
      return StoreService.getSessionGroups().find((g) => g.id === id)
    }
  )

  /**
   * 删除会话分组
   */
  ipcMain.handle(IPC_CHANNELS.SESSION_GROUP.DELETE, (_event, id: string) => {
    StoreService.deleteSessionGroup(id)
    return true
  })
}
