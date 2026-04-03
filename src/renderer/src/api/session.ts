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
 * 会话分组 API 接口
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
   * @param parentId - 父分组 ID（可选，用于创建子分组）
   * @returns 创建的分组对象
   */
  create: (data: { name: string; icon?: string }, parentId?: string): Promise<SessionGroup> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SESSION_GROUP.CREATE, {
      ...data,
      parentId,
      order: Date.now() // 使用时间戳作为默认排序
    })
  },

  /**
   * 更新会话分组
   * @param id - 分组 ID
   * @param updates - 更新内容
   * @returns 更新后的分组对象
   */
  update: (id: string, updates: Partial<SessionGroup>): Promise<SessionGroup | undefined> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SESSION_GROUP.UPDATE, id, updates)
  },

  /**
   * 删除会话分组
   * @param id - 分组 ID
   * @returns 是否成功
   */
  delete: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SESSION_GROUP.DELETE, id)
  },

  /**
   * 检查是否可以在目标分组下创建子分组
   * @param targetGroupId - 目标分组 ID，undefined 表示根级别
   * @returns 检查结果
   */
  checkCanCreateSubGroup: (
    targetGroupId: string | undefined
  ): Promise<{ canCreate: boolean; error?: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SESSION_GROUP.CHECK_CAN_CREATE_SUBGROUP, targetGroupId)
  },

  /**
   * 检查是否可以将分组移动到目标分组
   * @param sourceGroupId - 源分组 ID
   * @param targetGroupId - 目标分组 ID，undefined 表示根级别
   * @returns 检查结果
   */
  checkCanMoveGroup: (
    sourceGroupId: string,
    targetGroupId: string | undefined
  ): Promise<{ canMove: boolean; error?: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SESSION_GROUP.CHECK_CAN_MOVE, sourceGroupId, targetGroupId)
  }
}
