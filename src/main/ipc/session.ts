/**
 * 会话相关IPC处理
 * 处理渲染进程的会话管理请求
 * @module ipc/session
 */

import { ipcMain, BrowserWindow } from 'electron'
import { StoreService } from '../services/store'
import { CryptoService } from '../services/crypto'
import { SSHManager } from '../services/ssh-manager'
import { IPC_CHANNELS } from '@shared/constants/ipc-channels'
import type { Session } from '@shared/types'

/**
 * 注册会话相关IPC处理器
 */
export function registerSessionHandlers(): void {
  /**
   * 获取所有会话
   */
  ipcMain.handle(IPC_CHANNELS.SESSION.GET_ALL, () => {
    return StoreService.getSessions()
  })

  /**
   * 根据ID获取会话
   */
  ipcMain.handle(IPC_CHANNELS.SESSION.GET_BY_ID, (_event, id: string) => {
    return StoreService.getSessionById(id)
  })

  /**
   * 创建会话
   */
  ipcMain.handle(IPC_CHANNELS.SESSION.CREATE, (_event, sessionData: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>) => {
    const session: Session = {
      ...sessionData,
      id: CryptoService.generateSessionId(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    // 加密密码
    if (session.password) {
      session.password = CryptoService.encrypt(session.password)
    }
    if (session.keyPassphrase) {
      session.keyPassphrase = CryptoService.encrypt(session.keyPassphrase)
    }

    StoreService.addSession(session)
    return session
  })

  /**
   * 更新会话
   */
  ipcMain.handle(IPC_CHANNELS.SESSION.UPDATE, (_event, id: string, updates: Partial<Session>) => {
    // 如果更新了密码，需要加密
    if (updates.password) {
      updates.password = CryptoService.encrypt(updates.password)
    }
    if (updates.keyPassphrase) {
      updates.keyPassphrase = CryptoService.encrypt(updates.keyPassphrase)
    }

    StoreService.updateSession(id, updates)
    return StoreService.getSessionById(id)
  })

  /**
   * 删除会话
   */
  ipcMain.handle(IPC_CHANNELS.SESSION.DELETE, async (_event, id: string) => {
    // 先断开连接
    if (SSHManager.hasConnection(id)) {
      await SSHManager.disconnect(id)
    }
    StoreService.deleteSession(id)
    return true
  })

  /**
   * 连接会话
   */
  ipcMain.handle(IPC_CHANNELS.SESSION.CONNECT, async (event, id: string) => {
    const session = StoreService.getSessionById(id)
    if (!session) {
      throw new Error('Session not found')
    }

    try {
      // 更新状态为连接中
      StoreService.updateSession(id, { status: 'connecting' })

      // 建立SSH连接
      await SSHManager.connect(session)

      // 更新状态为已连接
      StoreService.updateSession(id, { status: 'connected' })

      // 注册数据监听器
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) {
        SSHManager.onData(id, (data: string) => {
          win.webContents.send(IPC_CHANNELS.TERMINAL.DATA, { sessionId: id, data })
        })

        SSHManager.onClose(id, () => {
          StoreService.updateSession(id, { status: 'disconnected' })
          win.webContents.send(IPC_CHANNELS.TERMINAL.CLOSE, { sessionId: id })
        })

        SSHManager.onError(id, (error: Error) => {
          StoreService.updateSession(id, { status: 'disconnected' })
          win.webContents.send(IPC_CHANNELS.TERMINAL.ERROR, { sessionId: id, error: error.message })
        })
      }

      return { success: true, sessionId: id }
    } catch (error) {
      // 更新状态为断开
      StoreService.updateSession(id, { status: 'disconnected' })
      throw error
    }
  })

  /**
   * 断开会话连接
   */
  ipcMain.handle(IPC_CHANNELS.SESSION.DISCONNECT, async (_event, id: string) => {
    await SSHManager.disconnect(id)
    StoreService.updateSession(id, { status: 'disconnected' })
    return true
  })

  /**
   * 获取会话连接状态
   */
  ipcMain.handle(IPC_CHANNELS.SESSION.GET_STATUS, (_event, id: string) => {
    return SSHManager.getStatus(id)
  })
}

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
    (_event, groupData: { name: string; icon?: string }) => {
      const group = {
        id: CryptoService.generateGroupId(),
        name: groupData.name,
        icon: groupData.icon,
        order: StoreService.getSessionGroups().length,
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
  ipcMain.handle(IPC_CHANNELS.SESSION_GROUP.UPDATE, (_event, id: string, updates: { name?: string; icon?: string; order?: number }) => {
    StoreService.updateSessionGroup(id, updates)
    return StoreService.getSessionGroups().find(g => g.id === id)
  })

  /**
   * 删除会话分组
   */
  ipcMain.handle(IPC_CHANNELS.SESSION_GROUP.DELETE, (_event, id: string) => {
    StoreService.deleteSessionGroup(id)
    return true
  })
}
