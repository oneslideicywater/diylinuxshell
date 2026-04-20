/**
 * 预加载脚本
 * 在渲染进程加载前执行，使用 contextBridge 安全地暴露 API 给渲染进程
 * @module preload
 */

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS } from '@shared/constants/ipc-channels'
import type { CustomAPI } from '@shared/types/global'
import type { Session, SessionGroup, AppConfig, TerminalSize } from '@shared/types'

/**
 * 自定义 API 对象
 * 封装 IPC 通信方法，提供给渲染进程调用
 * 显式声明类型确保实现与接口定义一致
 */
const api: CustomAPI = {
  /**
   * 窗口控制相关方法
   */
  // 最小化窗口
  windowMinimize: () => ipcRenderer.send('window-minimize'),

  // 最大化/还原窗口
  windowMaximize: () => ipcRenderer.send('window-maximize'),

  // 关闭窗口
  windowClose: () => ipcRenderer.send('window-close'),

  // 获取窗口最大化状态（异步）
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // 打开开发者工具（可选传入坐标来定位元素）
  openDevTools: (data?: { x: number; y: number }) => ipcRenderer.send('open-devtools', data),

  /**
   * 窗口事件监听方法
   * 用于在渲染进程中监听窗口状态变化
   */
  // 监听窗口最大化事件
  onWindowMaximize: (callback: () => void) => {
    ipcRenderer.on('window-maximized', callback)
    // 返回取消监听函数
    return () => ipcRenderer.removeListener('window-maximized', callback)
  },

  // 监听窗口取消最大化事件
  onWindowUnmaximize: (callback: () => void) => {
    ipcRenderer.on('window-unmaximized', callback)
    // 返回取消监听函数
    return () => ipcRenderer.removeListener('window-unmaximized', callback)
  },

  /**
   * 会话相关方法
   */
  session: {
    // 获取所有会话
    getAll: (): Promise<Session[]> => 
      ipcRenderer.invoke(IPC_CHANNELS.SESSION.GET_ALL),
    
    // 获取单个会话
    getById: (id: string): Promise<Session | undefined> => 
      ipcRenderer.invoke(IPC_CHANNELS.SESSION.GET_BY_ID, id),
    
    // 创建会话
    create: (data: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Promise<Session> => 
      ipcRenderer.invoke(IPC_CHANNELS.SESSION.CREATE, data),
    
    // 更新会话
    update: (id: string, updates: Partial<Session>): Promise<Session | undefined> => 
      ipcRenderer.invoke(IPC_CHANNELS.SESSION.UPDATE, id, updates),
    
    // 删除会话
    delete: (id: string): Promise<boolean> => 
      ipcRenderer.invoke(IPC_CHANNELS.SESSION.DELETE, id),
    
    // 连接会话（为指定标签页创建独立连接）
    connect: (tabId: string, sessionId: string): Promise<{ success: boolean; tabId: string }> => 
      ipcRenderer.invoke(IPC_CHANNELS.SESSION.CONNECT, tabId, sessionId),
    
    // 断开标签页连接
    disconnect: (tabId: string): Promise<boolean> => 
      ipcRenderer.invoke(IPC_CHANNELS.SESSION.DISCONNECT, tabId),
    
    // 获取标签页连接状态
    getStatus: (tabId: string): Promise<string | null> => 
      ipcRenderer.invoke(IPC_CHANNELS.SESSION.GET_STATUS, tabId),
    
    // 测试连接
    testConnection: (sessionData: Partial<Session>): Promise<boolean> => 
      ipcRenderer.invoke(IPC_CHANNELS.SESSION.TEST_CONNECTION, sessionData)
  },

  /**
   * 会话分组相关方法
   */
  sessionGroup: {
    // 获取所有分组
    getAll: (): Promise<SessionGroup[]> => 
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_GROUP.GET_ALL),
    
    // 创建分组
    create: (data: { name: string }, parentId?: string): Promise<SessionGroup> => 
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_GROUP.CREATE, {
        ...data,
        parentId,
        order: Date.now()
      }),
    
    // 更新分组
    update: (id: string, updates: Partial<SessionGroup>): Promise<SessionGroup | undefined> => 
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_GROUP.UPDATE, id, updates),
    
    // 删除分组
    delete: (id: string): Promise<boolean> => 
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_GROUP.DELETE, id),
    
    // 检查是否可以创建子分组
    checkCanCreateSubGroup: (targetGroupId: string | undefined): Promise<{ canCreate: boolean; error?: string }> => 
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_GROUP.CHECK_CAN_CREATE_SUBGROUP, targetGroupId),
    
    // 检查是否可以移动分组
    checkCanMoveGroup: (sourceGroupId: string, targetGroupId: string | undefined): Promise<{ canMove: boolean; error?: string }> => 
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_GROUP.CHECK_CAN_MOVE, sourceGroupId, targetGroupId)
  },

  /**
   * 终端相关方法
   */
  terminal: {
    // 写入数据
    write: (tabId: string, data: string): void => 
      ipcRenderer.send(IPC_CHANNELS.TERMINAL.WRITE, tabId, data),
    
    // 调整大小
    resize: (tabId: string, size: TerminalSize): void => 
      ipcRenderer.send(IPC_CHANNELS.TERMINAL.RESIZE, tabId, size),
    
    // 监听数据事件
    onData: (callback: (event: unknown, data: { tabId: string; data: string }) => void): (() => void) => {
      ipcRenderer.on(IPC_CHANNELS.TERMINAL.DATA, callback)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL.DATA, callback)
    },
    
    // 监听关闭事件
    onClose: (callback: (event: unknown, data: { tabId: string }) => void): (() => void) => {
      ipcRenderer.on(IPC_CHANNELS.TERMINAL.CLOSE, callback)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL.CLOSE, callback)
    },
    
    // 监听错误事件
    onError: (callback: (event: unknown, data: { tabId: string; error: string }) => void): (() => void) => {
      ipcRenderer.on(IPC_CHANNELS.TERMINAL.ERROR, callback)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL.ERROR, callback)
    }
  },

  /**
   * 配置相关方法
   */
  config: {
    // 获取配置
    get: (): Promise<AppConfig> => 
      ipcRenderer.invoke(IPC_CHANNELS.CONFIG.GET),
    
    // 保存配置
    set: (config: Partial<AppConfig>): Promise<AppConfig> => 
      ipcRenderer.invoke(IPC_CHANNELS.CONFIG.SET, config),
    
    // 重置配置
    reset: (): Promise<AppConfig> => 
      ipcRenderer.invoke(IPC_CHANNELS.CONFIG.RESET)
  },

  /**
   * SFTP 文件传输相关方法
   */
  sftp: {
    /**
     * 连接 SFTP 服务器（安全改进版）
     * 
     * 改进说明：
     * - 旧接口：connect(sessionId, config) ← 需要传入完整配置（含密码）
     * - 新接口：connect(sftpConnectionId, sessionId) ← 只传两个 ID，配置从主进程 Store 获取
     * 
     * @param sftpConnectionId - SFTP 连接标识符（每个标签独立，用于建立独立的 SSH/SFTP 连接）
     * @param sessionId - 会话标识符（用于从主进程 Store 查找连接配置）
     */
    connect: (sftpConnectionId: string, sessionId: string): Promise<{ success: boolean; error?: string }> => 
      ipcRenderer.invoke('sftp:connect', sftpConnectionId, sessionId),
    
    // 列出远程目录内容
    listDir: (sessionId: string, remotePath: string): Promise<{ success: boolean; data?: any[]; error?: string }> => 
      ipcRenderer.invoke('sftp:listDir', sessionId, remotePath),
    
    // 下载文件
    download: (sessionId: string, remotePath: string, localPath: string): Promise<{ success: boolean; error?: string }> => 
      ipcRenderer.invoke('sftp:download', sessionId, remotePath, localPath),
    
    // 下载文件夹（递归）
    downloadFolder: (sessionId: string, remotePath: string, localPath: string): Promise<{ success: boolean; error?: string }> => 
      ipcRenderer.invoke('sftp:downloadFolder', sessionId, remotePath, localPath),
    
    // 上传文件
    upload: (sessionId: string, localPath: string, remotePath: string): Promise<{ success: boolean; error?: string }> => 
      ipcRenderer.invoke('sftp:upload', sessionId, localPath, remotePath),
    
    // 上传文件夹（递归）
    uploadFolder: (sessionId: string, localPath: string, remotePath: string): Promise<{ success: boolean; error?: string }> => 
      ipcRenderer.invoke('sftp:uploadFolder', sessionId, localPath, remotePath),
    
    // 监听上传进度
    onUploadProgress: (callback: (data: { sessionId: string; localPath: string; remotePath: string; progress: number; size: number; transferredSize: number; speed: number }) => void) => {
      const channel = 'sftp:uploadProgress'
      const listener = (_event: Electron.IpcRendererEvent, data: { sessionId: string; localPath: string; remotePath: string; progress: number; size: number; transferredSize: number; speed: number }) => {
        callback(data)
      }
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    
    // 监听下载进度
    onDownloadProgress: (callback: (data: { sessionId: string; localPath: string; remotePath: string; progress: number; size: number; transferredSize: number; speed: number }) => void) => {
      const channel = 'sftp:downloadProgress'
      const listener = (_event: Electron.IpcRendererEvent, data: { sessionId: string; localPath: string; remotePath: string; progress: number; size: number; transferredSize: number; speed: number }) => {
        callback(data)
      }
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    
    // 创建远程目录
    mkdir: (sessionId: string, remotePath: string): Promise<{ success: boolean; error?: string }> => 
      ipcRenderer.invoke('sftp:mkdir', sessionId, remotePath),
    
    // 删除远程文件
    delete: (sessionId: string, remotePath: string): Promise<{ success: boolean; error?: string }> => 
      ipcRenderer.invoke('sftp:delete', sessionId, remotePath),
    
    // 取消上传
    cancelUpload: (sessionId: string): Promise<{ success: boolean; error?: string }> => 
      ipcRenderer.invoke('sftp:cancelUpload', sessionId),
    
    // 监听删除进度
    onDeleteProgress: (callback: (data: { sessionId: string; currentPath: string }) => void) => {
      const channel = 'sftp:deleteProgress'
      const listener = (_event: Electron.IpcRendererEvent, data: { sessionId: string; currentPath: string }) => {
        callback(data)
      }
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    
    // 断开连接
    disconnect: (sessionId: string): Promise<{ success: boolean; error?: string }> => 
      ipcRenderer.invoke('sftp:disconnect', sessionId),
    
    // 选择本地文件
    selectLocalFile: (options: { selectFolder?: boolean }): Promise<{ success: boolean; path?: string; error?: string }> => 
      ipcRenderer.invoke('sftp:selectLocalFile', options),
    
    // 获取本地文件列表
    getLocalFiles: (localPath: string): Promise<{ success: boolean; data?: any[]; error?: string }> => 
      ipcRenderer.invoke('sftp:getLocalFiles', localPath),
    
    // 获取用户主目录
    getHomeDir: (): Promise<{ success: boolean; data?: string; error?: string }> => 
      ipcRenderer.invoke('sftp:getHomeDir'),

    // 删除本地文件
    deleteLocalFile: (localPath: string): Promise<{ success: boolean; error?: string }> => 
      ipcRenderer.invoke('sftp:delete-local', localPath),

    // 获取本地文件/文件夹状态
    statLocal: (localPath: string): Promise<{ success: boolean; data?: { isDirectory: boolean; size: number }; error?: string }> =>
      ipcRenderer.invoke('sftp:stat-local', localPath),

    // 创建本地文件夹
    createLocalFolder: (parentPath: string, folderName: string): Promise<{ success: boolean; error?: string }> => 
      ipcRenderer.invoke('sftp:create-local-folder', parentPath, folderName),

    // 确保本地目录存在（递归创建）
    ensureDir: (dirPath: string): Promise<{ success: boolean; error?: string }> => 
      ipcRenderer.invoke('sftp:ensure-dir', dirPath),

    // 监听删除本地文件进度
    onDeleteLocalProgress: (callback: (data: { currentPath: string }) => void) => {
      const channel = 'sftp:delete-local-progress'
      const listener = (_event: Electron.IpcRendererEvent, data: { currentPath: string }) => {
        callback(data)
      }
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    }
  }
}

/**
 * 通过 contextBridge 暴露 API 到渲染进程
 * contextIsolated 为 true 时使用安全的方式暴露
 * 否则直接挂载到 window 对象（不推荐，仅用于兼容）
 */
if (process.contextIsolated) {
  try {
    // 暴露 electron-toolkit 提供的标准 API
    contextBridge.exposeInMainWorld('electron', electronAPI)
    // 暴露自定义 API
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Failed to expose API:', error)
  }
} else {
  // 非隔离模式下的兼容处理（不推荐使用）
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
