/**
 * 数据存储服务
 * 使用 electron-store 实现持久化数据存储
 * @module services/store
 */

import Store from 'electron-store'
import type { Session, SessionGroup, CommandSnippet, CommandSnippetGroup, AppConfig } from '@shared/types'
import { MAX_GROUP_DEPTH } from '@shared/types'
import {
  calculateGroupDepth,
  canCreateSubGroup,
  canMoveGroup,
  getAllSubGroups,
  updateAllGroupDepths
} from '../utils/group-helpers'

/**
 * 存储数据结构定义
 */
interface StoreSchema {
  /** 会话列表 */
  sessions: Session[]
  /** 会话分组列表 */
  sessionGroups: SessionGroup[]
  /** 命令片段列表 */
  commandSnippets: CommandSnippet[]
  /** 命令片段分组列表 */
  commandSnippetGroups: CommandSnippetGroup[]
  /** 应用配置 */
  config: AppConfig
}

/**
 * 默认应用配置
 */
const defaultConfig: AppConfig = {
  theme: 'dark',
  language: 'zh-CN',
  terminal: {
    fontSize: 14,
    fontFamily: 'Consolas, Monaco, monospace',
    cursorStyle: 'block',
    cursorBlink: true,
    scrollback: 10000,
    terminalType: 'xterm-256color'
  },
  connectionTimeout: 30000,
  keepaliveInterval: 30000,
  autoReconnect: true,
  reconnectAttempts: 3
}

/**
 * 创建存储实例
 */
const store = new Store<StoreSchema>({
  defaults: {
    sessions: [],
    sessionGroups: [],
    commandSnippets: [],
    commandSnippetGroups: [],
    config: defaultConfig
  },
  name: 'diy-linux-shell-config',
  encryptionKey: 'diy-linux-shell-encryption-key'
})

/**
 * 数据存储服务类
 * 封装 electron-store 操作，提供类型安全的数据访问
 */
export class StoreService {
  /**
   * 获取所有会话
   * @returns 会话列表
   */
  static getSessions(): Session[] {
    return store.get('sessions', [])
  }

  /**
   * 保存所有会话
   * @param sessions - 会话列表
   */
  static setSessions(sessions: Session[]): void {
    store.set('sessions', sessions)
  }

  /**
   * 添加会话
   * @param session - 会话对象
   */
  static addSession(session: Session): void {
    const sessions = this.getSessions()
    sessions.push(session)
    this.setSessions(sessions)
  }

  /**
   * 更新会话
   * @param id - 会话ID
   * @param updates - 更新内容
   */
  static updateSession(id: string, updates: Partial<Session>): void {
    const sessions = this.getSessions()
    const index = sessions.findIndex(s => s.id === id)
    if (index !== -1) {
      sessions[index] = { ...sessions[index], ...updates, updatedAt: Date.now() }
      this.setSessions(sessions)
    }
  }

  /**
   * 删除会话
   * @param id - 会话ID
   */
  static deleteSession(id: string): void {
    const sessions = this.getSessions().filter(s => s.id !== id)
    this.setSessions(sessions)
  }

  /**
   * 根据ID获取会话
   * @param id - 会话ID
   * @returns 会话对象或undefined
   */
  static getSessionById(id: string): Session | undefined {
    return this.getSessions().find(s => s.id === id)
  }

  /**
   * 获取所有会话分组
   * @returns 会话分组列表（包含层级深度信息）
   */
  static getSessionGroups(): SessionGroup[] {
    const groups = store.get('sessionGroups', [])
    // 确保所有分组都有深度信息
    return updateAllGroupDepths(groups)
  }

  /**
   * 保存所有会话分组
   * @param groups - 会话分组列表
   */
  static setSessionGroups(groups: SessionGroup[]): void {
    // 保存前更新所有分组的深度信息
    const updatedGroups = updateAllGroupDepths(groups)
    store.set('sessionGroups', updatedGroups)
  }

  /**
   * 添加会话分组
   * @param group - 会话分组对象
   * @returns 添加结果，包含成功状态和错误信息
   */
  static addSessionGroup(group: SessionGroup): { success: boolean; error?: string } {
    const groups = this.getSessionGroups()
    
    // 检查层级限制
    if (group.parentId && !canCreateSubGroup(group.parentId, groups)) {
      return {
        success: false,
        error: `子分组嵌套层级已达上限（最多 ${MAX_GROUP_DEPTH} 级），无法继续创建下级分组。`
      }
    }
    
    // 计算新分组的深度
    if (group.parentId) {
      const parentDepth = calculateGroupDepth(group.parentId, groups)
      group.depth = parentDepth + 1
    } else {
      group.depth = 1
    }
    
    groups.push(group)
    this.setSessionGroups(groups)
    return { success: true }
  }

  /**
   * 更新会话分组
   * @param id - 分组 ID
   * @param updates - 更新内容
   * @returns 更新结果，包含成功状态和错误信息
   */
  static updateSessionGroup(id: string, updates: Partial<SessionGroup>): { success: boolean; error?: string } {
    const groups = this.getSessionGroups()
    const index = groups.findIndex(g => g.id === id)
    if (index !== -1) {
      // 如果更新 parentId，需要检查层级限制
      if (updates.parentId !== undefined && updates.parentId !== groups[index].parentId) {
        if (!canMoveGroup(id, updates.parentId, groups)) {
          return {
            success: false,
            error: updates.parentId 
              ? '目标位置嵌套层级超限，无法移入该子分组下。'
              : '无法将分组移动到根级别'
          }
        }
      }
      
      groups[index] = { ...groups[index], ...updates, updatedAt: Date.now() }
      this.setSessionGroups(groups)
      return { success: true }
    }
    return { success: false, error: '分组不存在' }
  }

  /**
   * 删除会话分组
   * @param id - 分组 ID
   * @param cascadeDeleteSessions - 是否级联删除分组内所有会话（默认 true）
   */
  static deleteSessionGroup(id: string, cascadeDeleteSessions: boolean = true): void {
    const groups = this.getSessionGroups()
    // 获取所有子分组 ID
    const subGroupIds = getAllSubGroups(id, groups).map(g => g.id)
    
    // 删除分组及其所有子分组
    const filteredGroups = groups.filter(g => g.id !== id && !subGroupIds.includes(g.id))
    this.setSessionGroups(filteredGroups)
    
    // 处理会话：如果启用级联删除，删除该分组及其所有子分组下的会话
    if (cascadeDeleteSessions) {
      const sessions = this.getSessions()
      const filteredSessions = sessions.filter(
        session => !session.groupId || (session.groupId !== id && !subGroupIds.includes(session.groupId))
      )
      this.setSessions(filteredSessions)
    }
  }

  /**
   * 检查是否可以在目标分组下创建子分组
   * @param targetGroupId - 目标分组 ID，undefined 表示根级别
   * @returns 检查结果
   */
  static checkCanCreateSubGroup(targetGroupId: string | undefined): { canCreate: boolean; error?: string } {
    const groups = this.getSessionGroups()
    const canCreate = canCreateSubGroup(targetGroupId, groups)
    
    if (!canCreate) {
      return {
        canCreate: false,
        error: `子分组嵌套层级已达上限（最多 ${MAX_GROUP_DEPTH} 级），无法继续创建下级分组。`
      }
    }
    
    return { canCreate: true }
  }

  /**
   * 检查是否可以将分组移动到目标分组
   * @param sourceGroupId - 源分组 ID
   * @param targetGroupId - 目标分组 ID，undefined 表示根级别
   * @returns 检查结果
   */
  static checkCanMoveGroup(sourceGroupId: string, targetGroupId: string | undefined): { canMove: boolean; error?: string } {
    const groups = this.getSessionGroups()
    const canMove = canMoveGroup(sourceGroupId, targetGroupId, groups)
    
    if (!canMove) {
      return {
        canMove: false,
        error: targetGroupId 
          ? '目标位置嵌套层级超限，无法移入该子分组下。'
          : '无法移动分组到该位置'
      }
    }
    
    return { canMove: true }
  }

  /**
   * 获取所有命令片段
   * @returns 命令片段列表
   */
  static getCommandSnippets(): CommandSnippet[] {
    return store.get('commandSnippets', [])
  }

  /**
   * 保存所有命令片段
   * @param snippets - 命令片段列表
   */
  static setCommandSnippets(snippets: CommandSnippet[]): void {
    store.set('commandSnippets', snippets)
  }

  /**
   * 添加命令片段
   * @param snippet - 命令片段对象
   */
  static addCommandSnippet(snippet: CommandSnippet): void {
    const snippets = this.getCommandSnippets()
    snippets.push(snippet)
    this.setCommandSnippets(snippets)
  }

  /**
   * 更新命令片段
   * @param id - 片段ID
   * @param updates - 更新内容
   */
  static updateCommandSnippet(id: string, updates: Partial<CommandSnippet>): void {
    const snippets = this.getCommandSnippets()
    const index = snippets.findIndex(s => s.id === id)
    if (index !== -1) {
      snippets[index] = { ...snippets[index], ...updates, updatedAt: Date.now() }
      this.setCommandSnippets(snippets)
    }
  }

  /**
   * 删除命令片段
   * @param id - 片段ID
   */
  static deleteCommandSnippet(id: string): void {
    const snippets = this.getCommandSnippets().filter(s => s.id !== id)
    this.setCommandSnippets(snippets)
  }

  /**
   * 获取应用配置
   * @returns 应用配置
   */
  static getConfig(): AppConfig {
    return store.get('config', defaultConfig)
  }

  /**
   * 保存应用配置
   * @param config - 应用配置
   */
  static setConfig(config: Partial<AppConfig>): void {
    const currentConfig = this.getConfig()
    store.set('config', { ...currentConfig, ...config })
  }

  /**
   * 重置应用配置为默认值
   */
  static resetConfig(): void {
    store.set('config', defaultConfig)
  }

  /**
   * 清空所有数据
   */
  static clearAll(): void {
    store.clear()
  }

  /**
   * 导出所有数据
   * @returns 所有存储数据
   */
  static exportAll(): StoreSchema {
    return {
      sessions: this.getSessions(),
      sessionGroups: this.getSessionGroups(),
      commandSnippets: this.getCommandSnippets(),
      commandSnippetGroups: store.get('commandSnippetGroups', []),
      config: this.getConfig()
    }
  }

  /**
   * 导入数据
   * @param data - 要导入的数据
   */
  static importData(data: Partial<StoreSchema>): void {
    if (data.sessions) {
      this.setSessions(data.sessions)
    }
    if (data.sessionGroups) {
      this.setSessionGroups(data.sessionGroups)
    }
    if (data.commandSnippets) {
      this.setCommandSnippets(data.commandSnippets)
    }
    if (data.commandSnippetGroups) {
      store.set('commandSnippetGroups', data.commandSnippetGroups)
    }
    if (data.config) {
      this.setConfig(data.config)
    }
  }
}

export default store
