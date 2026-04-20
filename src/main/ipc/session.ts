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
import type { Session, SessionGroup } from '@shared/types'

/**
 * 注册会话相关IPC处理器
 */
export function registerSessionHandlers(): void {
  /**
   * 获取所有会话
   */
  ipcMain.handle(IPC_CHANNELS.SESSION.GET_ALL, () => {
    const sessions = StoreService.getSessions()
    // 解密所有会话的密码
    return sessions.map(session => {
      const decryptedSession = { ...session }
      if (decryptedSession.password) {
        decryptedSession.password = CryptoService.decrypt(decryptedSession.password)
      }
      if (decryptedSession.keyPassphrase) {
        decryptedSession.keyPassphrase = CryptoService.decrypt(decryptedSession.keyPassphrase)
      }
      return decryptedSession
    })
  })

  /**
   * 根据ID获取会话
   */
  ipcMain.handle(IPC_CHANNELS.SESSION.GET_BY_ID, (_event, id: string) => {
    const session = StoreService.getSessionById(id)
    if (!session) return undefined
    // 解密密码
    const decryptedSession = { ...session }
    if (decryptedSession.password) {
      decryptedSession.password = CryptoService.decrypt(decryptedSession.password)
    }
    if (decryptedSession.keyPassphrase) {
      decryptedSession.keyPassphrase = CryptoService.decrypt(decryptedSession.keyPassphrase)
    }
    return decryptedSession
  })

  /**
   * 创建会话
   */
  ipcMain.handle(IPC_CHANNELS.SESSION.CREATE, (_event, sessionData: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>) => {
    // 如果未指定分组（null 或 undefined），则获取默认分组 ID
    let groupId = sessionData.groupId
    if (groupId === null || groupId === undefined) {
      const groups = StoreService.getSessionGroups()
      const defaultGroup = groups.find(g => g.name === '默认分组')
      if (defaultGroup) {
        groupId = defaultGroup.id
      }
    }
    
    const session: Session = {
      ...sessionData,
      groupId,
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
    
    // 返回解密后的会话
    const decryptedSession = { ...session }
    if (decryptedSession.password) {
      decryptedSession.password = CryptoService.decrypt(decryptedSession.password)
    }
    if (decryptedSession.keyPassphrase) {
      decryptedSession.keyPassphrase = CryptoService.decrypt(decryptedSession.keyPassphrase)
    }
    return decryptedSession
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
    
    // 返回解密后的会话
    const session = StoreService.getSessionById(id)
    if (!session) return undefined
    
    const decryptedSession = { ...session }
    if (decryptedSession.password) {
      decryptedSession.password = CryptoService.decrypt(decryptedSession.password)
    }
    if (decryptedSession.keyPassphrase) {
      decryptedSession.keyPassphrase = CryptoService.decrypt(decryptedSession.keyPassphrase)
    }
    return decryptedSession
  })

  /**
   * 删除会话
   */
  ipcMain.handle(IPC_CHANNELS.SESSION.DELETE, async (_event, id: string) => {
    // 断开所有使用该会话ID的连接
    await SSHManager.disconnectBySessionId(id)
    StoreService.deleteSession(id)
    return true
  })

  /**
   * 连接会话（为指定标签页创建独立连接）
   */
  ipcMain.handle(IPC_CHANNELS.SESSION.CONNECT, async (event, tabId: string, sessionId: string) => {
    const session = StoreService.getSessionById(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    try {
      // 建立SSH连接（使用tabId作为连接标识）
      await SSHManager.connect(tabId, session)

      // 注册数据监听器
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) {
        SSHManager.onData(tabId, (data: string) => {
          win.webContents.send(IPC_CHANNELS.TERMINAL.DATA, { tabId, data })
        })

        SSHManager.onClose(tabId, () => {
          win.webContents.send(IPC_CHANNELS.TERMINAL.CLOSE, { tabId })
        })

        SSHManager.onError(tabId, (error: Error) => {
          win.webContents.send(IPC_CHANNELS.TERMINAL.ERROR, { tabId, error: error.message })
        })
      }

      return { success: true, tabId }
    } catch (error) {
      throw error
    }
  })

  /**
   * 断开标签页连接
   */
  ipcMain.handle(IPC_CHANNELS.SESSION.DISCONNECT, async (_event, tabId: string) => {
    await SSHManager.disconnect(tabId)
    return true
  })

  /**
   * 获取标签页连接状态
   */
  ipcMain.handle(IPC_CHANNELS.SESSION.GET_STATUS, (_event, tabId: string) => {
    return SSHManager.getStatus(tabId)
  })

  /**
   * 测试连接
   */
  ipcMain.handle(IPC_CHANNELS.SESSION.TEST_CONNECTION, async (_event, sessionData: Partial<Session>) => {
    try {
      // 验证必填字段
      if (!sessionData.host || !sessionData.username) {
        throw new Error('缺少必填字段：主机地址和用户名')
      }

      // 创建一个临时会话用于测试
      const testSession: Session = {
        id: 'test-' + Date.now(),
        name: sessionData.name || 'Test Connection',
        host: sessionData.host,
        port: sessionData.port || 22,
        username: sessionData.username,
        authType: sessionData.authType || 'password',
        // 注意：测试连接时传入的是明文密码，不需要解密
        password: sessionData.password,
        keyPath: sessionData.keyPath,
        keyPassphrase: sessionData.keyPassphrase,
        groupId: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      // 尝试连接
      const testTabId = 'test-' + Date.now()
      await SSHManager.connect(testTabId, testSession, true) // 传入 true 表示这是测试连接，使用明文密码

      // 连接成功后立即断开
      await SSHManager.disconnect(testTabId)

      return true
    } catch (error) {
      console.error('Test connection failed:', error)
      throw error
    }
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
      const group: SessionGroup = {
        id: CryptoService.generateGroupId(),
        name: groupData.name,
        icon: groupData.icon,
        order: StoreService.getSessionGroups().length,
        depth: 1,
        parentId: undefined,
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
