/**
 * 会话相关API
 * 封装会话管理的 IPC 调用
 * @module renderer/api/session
 */

import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/ipc-channels'
import type { Session, SessionGroup } from '@shared/types'

/**
 * 会话API接口
 */
export const sessionAPI = {
  /**
   * 获取所有会话
   * @returns 会话列表
   */
  getAll: (): Promise<Session[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SESSION.GET_ALL)
  },

  /**
   * 根据ID获取会话
   * @param id - 会话ID
   * @returns 会话对象
   */
  getById: (id: string): Promise<Session | undefined> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SESSION.GET_BY_ID, id)
  },

  /**
   * 创建会话
   * @param sessionData - 会话数据
   * @returns 创建的会话对象
   */
  create: (sessionData: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Promise<Session> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SESSION.CREATE, sessionData)
  },

  /**
   * 更新会话
   * @param id - 会话ID
   * @param updates - 更新内容
   * @returns 更新后的会话对象
   */
  update: (id: string, updates: Partial<Session>): Promise<Session | undefined> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SESSION.UPDATE, id, updates)
  },

  /**
   * 删除会话
   * @param id - 会话ID
   * @returns 是否成功
   */
  delete: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SESSION.DELETE, id)
  },

  /**
   * 连接会话
   * @param id - 会话ID
   * @returns 连接结果
   */
  connect: (id: string): Promise<{ success: boolean; sessionId: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SESSION.CONNECT, id)
  },

  /**
   * 断开会话连接
   * @param id - 会话ID
   * @returns 是否成功
   */
  disconnect: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SESSION.DISCONNECT, id)
  },

  /**
   * 获取会话连接状态
   * @param id - 会话 ID
   * @returns 连接状态
   */
  getStatus: (id: string): Promise<string | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SESSION.GET_STATUS, id)
  },

  /**
   * 测试连接
   * @param sessionData - 会话数据
   * @returns 是否连接成功
   */
  testConnection: (sessionData: Partial<Session>): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SESSION.TEST_CONNECTION, sessionData)
  }
}

/**
 * 会话分组API接口
 */
export const sessionGroupAPI = {
  /**
   * 获取所有会话分组
   * @returns 会话分组列表
   */
  getAll: (): Promise<SessionGroup[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SESSION_GROUP.GET_ALL)
  },

  /**
   * 创建会话分组
   * @param data - 分组数据
   * @returns 创建的分组对象
   */
  create: (data: { name: string; icon?: string }): Promise<SessionGroup> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SESSION_GROUP.CREATE, data)
  },

  /**
   * 更新会话分组
   * @param id - 分组ID
   * @param updates - 更新内容
   * @returns 更新后的分组对象
   */
  update: (id: string, updates: Partial<SessionGroup>): Promise<SessionGroup | undefined> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SESSION_GROUP.UPDATE, id, updates)
  },

  /**
   * 删除会话分组
   * @param id - 分组ID
   * @returns 是否成功
   */
  delete: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SESSION_GROUP.DELETE, id)
  }
}
