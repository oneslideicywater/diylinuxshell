import { ElectronAPI } from '@electron-toolkit/preload'
import type { Session, SessionGroup, AppConfig, TerminalSize, TransferNode } from './index'

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
    create: (data: { name: string }, parentId?: string) => Promise<SessionGroup>
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
    /**
     * 连接 SFTP 服务器（安全改进版）
     * 只传两个 ID，配置从主进程 Store 获取
     */
    connect: (sftpConnectionId: string, sessionId: string) => Promise<{ success: boolean; error?: string }>
    listDir: (sessionId: string, remotePath: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
    download: (sessionId: string, taskId: string, node: TransferNode) => Promise<{ success: boolean; error?: string }>
    downloadFolder: (sessionId: string, taskId: string, node: TransferNode) => Promise<{ success: boolean; error?: string }>
    upload: (sessionId: string, taskId: string, node: TransferNode) => Promise<{ success: boolean; error?: string }>
    uploadFolder: (sessionId: string, taskId: string, node: TransferNode) => Promise<{ success: boolean; error?: string }>
    mkdir: (sessionId: string, remotePath: string) => Promise<{ success: boolean; error?: string }>
    delete: (sessionId: string, remotePath: string) => Promise<{ success: boolean; error?: string }>
    cancelUpload: (sessionId: string) => Promise<{ success: boolean; error?: string }>
    onDeleteProgress: (callback: (data: { sessionId: string; currentPath: string }) => void) => () => void
    onUploadProgress: (callback: (data: { taskId: string; nodeId: string; speed: number; transferredBytes: number }) => void) => () => void
    onDownloadProgress: (callback: (data: { taskId: string; nodeId: string; speed: number; transferredBytes: number }) => void) => () => void
    disconnect: (sessionId: string) => Promise<{ success: boolean; error?: string }>
    selectLocalFile: (options: { selectFolder?: boolean }) => Promise<{ success: boolean; path?: string; error?: string }>
    getLocalFiles: (localPath: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
    getDrives: () => Promise<{ success: boolean; data?: any[]; error?: string }>
    getPlatform: () => Promise<{ success: boolean; data?: string; error?: string }>
    dirname: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>
    pathJoin: (...segments: string[]) => Promise<{ success: boolean; data?: string; error?: string }>
    getHomeDir: () => Promise<{ success: boolean; data?: string; error?: string }>
    deleteLocalFile: (localPath: string) => Promise<{ success: boolean; error?: string }>
    statLocal: (localPath: string) => Promise<{ success: boolean; data?: { isDirectory: boolean; size: number }; error?: string }>
    onDeleteLocalProgress: (callback: (data: { currentPath: string }) => void) => () => void
    createLocalFolder: (parentPath: string, folderName: string) => Promise<{ success: boolean; error?: string }>
    ensureDir: (dirPath: string) => Promise<{ success: boolean; error?: string }>

    /**
     * 扫描本地文件树（v5 优化）
     * 
     * 直接返回 TransferNode 对象（无循环引用，可安全通过 IPC 序列化）
     * 渲染进程接收后可直接使用，无需类型转换
     */
    scanLocalTree: (folderPath: string, remoteBasePath: string) => Promise<{
      success: boolean
      root?: import('./sftp').TransferNode
      totalFiles?: number
      totalBytes?: number
      error?: string
    }>

    /**
     * 扫描远程文件树（v5 优化）
     * 
     * 直接返回 TransferNode 对象（无循环引用，可安全通过 IPC 序列化）
     * 渲染进程接收后可直接使用，无需类型转换
     */
    scanRemoteTree: (sessionId: string, remotePath: string, localBasePath?: string) => Promise<{
      success: boolean
      root?: import('./sftp').TransferNode
      totalFiles?: number
      totalBytes?: number
      error?: string
    }>
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
