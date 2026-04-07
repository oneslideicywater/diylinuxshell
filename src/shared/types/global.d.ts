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
  openDevTools: (data?: { x: number; y: number }) => void

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
    connect: (tabId: string, sessionId: string) => Promise<{ success: boolean; tabId: string }>
    disconnect: (tabId: string) => Promise<boolean>
    getStatus: (tabId: string) => Promise<string | null>
    testConnection: (sessionData: Partial<Session>) => Promise<boolean>
  }

  // 会话分组管理
  sessionGroup: {
    getAll: () => Promise<SessionGroup[]>
    create: (data: { name: string; icon?: string; parentId?: string }) => Promise<SessionGroup>
    update: (id: string, updates: Partial<SessionGroup>) => Promise<SessionGroup | undefined>
    delete: (id: string) => Promise<boolean>
    checkCanCreateSubGroup: (targetGroupId: string | undefined) => Promise<{ canCreate: boolean; error?: string }>
    checkCanMoveGroup: (sourceGroupId: string, targetGroupId: string | undefined) => Promise<{ canMove: boolean; error?: string }>
  }

  // 终端操作
  terminal: {
    write: (tabId: string, data: string) => void
    resize: (tabId: string, size: TerminalSize) => void
    onData: (callback: (event: unknown, data: { tabId: string; data: string }) => void) => () => void
    onClose: (callback: (event: unknown, data: { tabId: string }) => void) => () => void
    onError: (callback: (event: unknown, data: { tabId: string; error: string }) => void) => () => void
  }

  // 配置管理
  config: {
    get: () => Promise<AppConfig>
    set: (config: Partial<AppConfig>) => Promise<AppConfig>
    reset: () => Promise<AppConfig>
  },

  // SFTP 文件传输
  sftp: {
    connect: (sessionId: string, config: { host: string; port: number; username: string; password?: string }) => Promise<{ success: boolean; error?: string }>
    listDir: (sessionId: string, remotePath: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
    download: (sessionId: string, remotePath: string, localPath: string) => Promise<{ success: boolean; error?: string }>
    downloadFolder: (sessionId: string, remotePath: string, localPath: string) => Promise<{ success: boolean; error?: string }>
    upload: (sessionId: string, localPath: string, remotePath: string) => Promise<{ success: boolean; error?: string }>
    uploadFolder: (sessionId: string, localPath: string, remotePath: string) => Promise<{ success: boolean; error?: string }>
    mkdir: (sessionId: string, remotePath: string) => Promise<{ success: boolean; error?: string }>
    delete: (sessionId: string, remotePath: string) => Promise<{ success: boolean; error?: string }>
    disconnect: (sessionId: string) => Promise<{ success: boolean; error?: string }>
    selectLocalFile: (options: { selectFolder?: boolean }) => Promise<{ success: boolean; path?: string; error?: string }>
    getLocalFiles: (localPath: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
    getHomeDir: () => Promise<{ success: boolean; data?: string; error?: string }>
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
