import { ElectronAPI } from '@electron-toolkit/preload'
import type { Session, SessionGroup, AppConfig, TerminalSize } from './index'

/**
 * 自定义API接口
 */
export interface CustomAPI {
  // 窗口控制
  windowMinimize: () => void
  windowMaximize: () => void
  windowClose: () => void
  windowIsMaximized: () => Promise<boolean>

  // 窗口事件监听
  onWindowMaximize: (callback: () => void) => () => void
  onWindowUnmaximize: (callback: () => void) => () => void

  // 会话管理
  session: {
    getAll: () => Promise<Session[]>
    getById: (id: string) => Promise<Session | undefined>
    create: (data: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Session>
    update: (id: string, updates: Partial<Session>) => Promise<Session | undefined>
    delete: (id: string) => Promise<boolean>
    connect: (id: string) => Promise<{ success: boolean; sessionId: string }>
    disconnect: (id: string) => Promise<boolean>
    getStatus: (id: string) => Promise<string | null>
  }

  // 会话分组管理
  sessionGroup: {
    getAll: () => Promise<SessionGroup[]>
    create: (data: { name: string; icon?: string }) => Promise<SessionGroup>
    update: (id: string, updates: Partial<SessionGroup>) => Promise<SessionGroup | undefined>
    delete: (id: string) => Promise<boolean>
  }

  // 终端操作
  terminal: {
    write: (sessionId: string, data: string) => void
    resize: (sessionId: string, size: TerminalSize) => void
    onData: (callback: (event: unknown, data: { sessionId: string; data: string }) => void) => () => void
    onClose: (callback: (event: unknown, data: { sessionId: string }) => void) => () => void
    onError: (callback: (event: unknown, data: { sessionId: string; error: string }) => void) => () => void
  }

  // 配置管理
  config: {
    get: () => Promise<AppConfig>
    set: (config: Partial<AppConfig>) => Promise<AppConfig>
    reset: () => Promise<AppConfig>
  }
}

/**
 * 扩展Window接口
 */
declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}

export {}
