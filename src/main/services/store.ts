/**
 * 数据存储服务
 * 使用 electron-store 实现持久化数据存储
 * @module services/store
 */

import Store from 'electron-store'
import type { Session, SessionGroup, CommandSnippet, CommandSnippetGroup, AppConfig } from '@shared/types'

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
   * @returns 会话分组列表
   */
  static getSessionGroups(): SessionGroup[] {
    return store.get('sessionGroups', [])
  }

  /**
   * 保存所有会话分组
   * @param groups - 会话分组列表
   */
  static setSessionGroups(groups: SessionGroup[]): void {
    store.set('sessionGroups', groups)
  }

  /**
   * 添加会话分组
   * @param group - 会话分组对象
   */
  static addSessionGroup(group: SessionGroup): void {
    const groups = this.getSessionGroups()
    groups.push(group)
    this.setSessionGroups(groups)
  }

  /**
   * 更新会话分组
   * @param id - 分组ID
   * @param updates - 更新内容
   */
  static updateSessionGroup(id: string, updates: Partial<SessionGroup>): void {
    const groups = this.getSessionGroups()
    const index = groups.findIndex(g => g.id === id)
    if (index !== -1) {
      groups[index] = { ...groups[index], ...updates, updatedAt: Date.now() }
      this.setSessionGroups(groups)
    }
  }

  /**
   * 删除会话分组
   * @param id - 分组ID
   */
  static deleteSessionGroup(id: string): void {
    const groups = this.getSessionGroups().filter(g => g.id !== id)
    this.setSessionGroups(groups)
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
