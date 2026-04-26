import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * SFTP 文件浏览器状态管理 Store（统一管理 Local + Remote）
 * 
 * 核心设计：
 * 1. **按连接隔离**：每个 sftpConnectionId 拥有独立的本地+远程文件浏览状态
 * 2. **统一数据源**：解决 SftpLocal.vue 和 SftpRemote.vue 双重状态管理问题
 * 3. **响应式同步**：通过 Pinia Store 实现组件间状态自动同步
 * 
 * 数据结构：
 * - 一个 sftpConnectionId 对应一个 SFTP Transfer 窗口
 * - 每个 SFTP Transfer 包含：左侧 Local 面板 + 右侧 Remote 面板
 * - Store 同时管理两个面板的状态
 */
export const useSftpBrowserStore = defineStore('sftpBrowser', () => {
  /**
   * 按连接 ID 存储的文件浏览器状态映射表
   * key: sftpConnectionId (SFTP 连接标识符)
   * value: { local, remote } 本地+远程状态对象
   */
  const stateMap = ref<Map<string, {
    /** 本地文件浏览状态 */
    local: {
      localPath: string
      localFiles: any[]
      localFileCount: number
    }
    /** 远程文件浏览状态 */
    remote: {
      remotePath: string
      remoteFiles: any[]
      remoteFileCount: number
      connectionId: string
      /** 远程目录加载中标志（用于骨架屏显示） */
      isLoadingRemote: boolean
    }
  }>>(new Map())

  /**
   * 获取或创建指定连接的完整浏览器状态
   * @param connectionId SFTP 连接标识符
   * @returns 完整的浏览器状态对象（包含 local 和 remote）
   */
  function getState(connectionId: string) {
    if (!stateMap.value.has(connectionId)) {
      stateMap.value.set(connectionId, {
        local: {
          localPath: '',
          localFiles: [],
          localFileCount: 0
        },
        remote: {
          remotePath: '/',
          remoteFiles: [],
          remoteFileCount: 0,
          connectionId,
          isLoadingRemote: false
        }
      })
    }
    return stateMap.value.get(connectionId)!
  }

  // ==================== 本地文件相关方法 ====================

  /**
   * 获取指定连接的当前本地路径（computed）
   */
  function getLocalPath(connectionId: string) {
    return computed(() => getState(connectionId).local.localPath)
  }

  /**
   * 获取指定连接的本地文件列表（computed）
   */
  function getLocalFiles(connectionId: string) {
    return computed(() => getState(connectionId).local.localFiles)
  }

  /**
   * 获取指定连接的本地文件数量（computed）
   */
  function getLocalFileCount(connectionId: string) {
    return computed(() => getState(connectionId).local.localFileCount)
  }

  /**
   * 设置当前本地路径
   */
  function setLocalPath(connectionId: string, path: string): void {
    getState(connectionId).local.localPath = path
  }

  /**
   * 设置本地文件列表
   */
  function setLocalFiles(connectionId: string, files: any[]): void {
    const state = getState(connectionId)
    state.local.localFiles = files
    state.local.localFileCount = files.length
  }

  /**
   * 初始化本地默认目录（设置为用户 home 目录）
   */
  async function initLocalDefaultDir(connectionId: string): Promise<void> {
    try {
      const homeResult = await window.api.sftp.getHomeDir()
      if (homeResult.success && homeResult.data) {
        getState(connectionId).local.localPath = homeResult.data
        console.log(`[sftpBrowser] 本地默认目录设置为 (${connectionId}):`, homeResult.data)
      }
    } catch (error: any) {
      console.error('[sftpBrowser] 获取本地 home 目录失败:', error)
    }
  }

  /**
   * 加载本地文件列表
   * @param connectionId SFTP 连接标识符
   * @param drivesPath 盘符列表视图的特殊路径标识
   */
  async function loadLocalFiles(connectionId: string, drivesPath: string): Promise<void> {
    const state = getState(connectionId).local
    
    try {
      console.log(`[sftpBrowser] 加载本地文件列表 (${connectionId}):`, state.localPath)
      const pathToLoad = state.localPath || drivesPath
      
      if (pathToLoad === drivesPath) {
        const result = await window.api.sftp.getDrives()
        if (result.success && result.data) {
          state.localPath = drivesPath
          state.localFiles = result.data
          state.localFileCount = result.data.length
        }
      } else {
        state.localPath = pathToLoad
        const result = await window.api.sftp.getLocalFiles(pathToLoad)
        if (result.success && result.data) {
          state.localFiles = result.data
          state.localFileCount = result.data.length
        }
      }
    } catch (error: any) {
      console.error('[sftpBrowser] 加载本地文件失败:', error)
      // 失败时进入此电脑视图
      state.localPath = drivesPath
      const result = await window.api.sftp.getDrives()
      if (result.success && result.data) {
        state.localFiles = result.data
        state.localFileCount = result.data.length
      }
    }
  }

  /**
   * 处理本地文件双击导航到目录
   */
  async function handleLocalDblClick(connectionId: string, event: MouseEvent, drivesPath: string): Promise<void> {
    const target = (event.target as HTMLElement).closest('.file-item')
    if (!target) {
      console.log('[sftpBrowser] handleLocalDblClick: 未找到 file-item')
      return
    }
    
    const path = (target as HTMLElement).dataset.path
    console.log('[sftpBrowser] handleLocalDblClick: 双击路径 =', path)
    
    const state = getState(connectionId).local
    const item = state.localFiles.find(f => f.path === path)
    
    console.log('[sftpBrowser] handleLocalDblClick: 找到的 item =', item)
    console.log('[sftpBrowser] handleLocalDblClick: isDirectory =', item?.isDirectory, 'isSymbolicLink =', item?.isSymbolicLink)
    
    if (item?.isDirectory) {
      // 如果是符号链接文件夹，跳转到目标路径
      const targetPath = item.isSymbolicLink && item.linkTarget ? item.linkTarget : item.path
      console.log('[sftpBrowser] handleLocalDblClick: 进入目录', targetPath, item.isSymbolicLink ? `(符号链接目标：${item.linkTarget})` : '')
      state.localPath = targetPath
      await loadLocalFiles(connectionId, drivesPath)
      console.log('[sftpBrowser] handleLocalDblClick: 加载完成，文件数量 =', state.localFileCount)
    } else {
      console.log('[sftpBrowser] handleLocalDblClick: 不是目录，不处理')
    }
  }

  /**
   * 导航到本地上级目录
   * 
   * 使用 Node.js path.dirname() 计算父目录（跨平台兼容）
   * 特殊处理：Windows 盘符根目录 → "此电脑"视图
   */
  async function navigateLocalUp(connectionId: string, drivesPath: string): Promise<void> {
    const state = getState(connectionId).local
    const currentPath = state.localPath
    
    if (!currentPath || currentPath === drivesPath) {
      console.log('[sftpBrowser] 已在最顶层，无法继续返回上级')
      return
    }
    
    try {
      const result = await window.api.sftp.dirname(currentPath)
      if (!result.success || !result.data) {
        console.warn('[sftpBrowser] 获取父目录失败:', result.error)
        return
      }
      
      const parentPath = result.data as string
      
      if (parentPath === currentPath) {
        console.log('[sftpBrowser] 已在根目录，跳转到"此电脑"视图')
        state.localPath = drivesPath
        await loadLocalFiles(connectionId, drivesPath)
      } else {
        state.localPath = parentPath
        await loadLocalFiles(connectionId, drivesPath)
      }
    } catch (error: any) {
      console.error('[sftpBrowser] navigateLocalUp 异常:', error)
    }
  }

  /**
   * 导航到指定的本地路径
   */
  function navigateToLocalPath(connectionId: string, path: string, drivesPath: string): void {
    setLocalPath(connectionId, path)
    loadLocalFiles(connectionId, drivesPath)
  }

  /**
   * 创建本地文件夹
   */
  async function createLocalFolder(connectionId: string, folderName: string, drivesPath: string): Promise<void> {
    const state = getState(connectionId).local
    
    try {
      const result = await window.api.sftp.createLocalFolder(state.localPath, folderName)
      if (!result.success) {
        throw new Error(result.error || '创建失败')
      }
      await loadLocalFiles(connectionId, drivesPath)
    } catch (error: any) {
      console.error('创建本地文件夹失败:', { path: state.localPath, folderName, error: error.message })
      throw error
    }
  }

  // ==================== 远程文件相关方法 ====================

  /**
   * 获取指定连接的当前远程路径（computed）
   */
  function getRemotePath(connectionId: string) {
    return computed(() => getState(connectionId).remote.remotePath)
  }

  /**
   * 获取指定连接的远程文件列表（computed）
   */
  function getRemoteFiles(connectionId: string) {
    return computed(() => getState(connectionId).remote.remoteFiles)
  }

  /**
   * 获取指定连接的远程文件数量（computed）
   */
  function getRemoteFileCount(connectionId: string) {
    return computed(() => getState(connectionId).remote.remoteFileCount)
  }

  /**
   * 设置当前远程路径
   */
  function setRemotePath(connectionId: string, path: string): void {
    getState(connectionId).remote.remotePath = path
  }

  /**
   * 设置远程文件列表
   */
  function setRemoteFiles(connectionId: string, files: any[]): void {
    const state = getState(connectionId).remote
    state.remoteFiles = files
    state.remoteFileCount = files.length
  }

  /**
   * 初始化远程默认目录
   */
  function initRemoteDefaultDir(connectionId: string): void {
    getState(connectionId).remote.remotePath = '/'
    console.log('[sftpBrowser] 远程默认目录设置为: /')
  }

  /**
   * 加载远程文件列表
   * 
   * 加载流程：
   *   1. 设置 isLoadingRemote = true（触发骨架屏显示）
   *   2. 调用主进程 listDir API 读取远程目录
   *   3. 无论成功/失败，finally 中设置 isLoadingRemote = false（隐藏骨架屏）
   */
  async function loadRemoteFiles(connectionId: string): Promise<void> {
    const state = getState(connectionId).remote
    
    // 标记开始加载（UI 层显示骨架屏）
    state.isLoadingRemote = true
    
    try {
      if (!state.connectionId) {
        console.warn('[sftpBrowser] connectionId 不存在，无法加载远程文件')
        state.remoteFiles = []
        state.remoteFileCount = 0
        return
      }
      
      const result = await window.api.sftp.listDir(state.connectionId, state.remotePath)
      
      if (result.success && Array.isArray(result.data)) {
        state.remoteFiles = result.data
        state.remoteFileCount = result.data.length
        console.log(`[sftpBrowser] ✅ 成功加载 ${result.data.length} 个远程文件/文件夹`)
      } else {
        console.error('加载远程文件失败:', result.error)
        state.remoteFiles = []
        state.remoteFileCount = 0
      }
    } catch (error: any) {
      console.error('加载远程文件异常:', error)
      state.remoteFiles = []
      state.remoteFileCount = 0
    } finally {
      // 确保无论成功/失败都结束加载状态
      state.isLoadingRemote = false
    }
  }

  /**
   * 处理远程文件双击事件
   */
  function handleRemoteDblClick(connectionId: string, event: MouseEvent): void {
    const target = event.target as HTMLElement
    const fileItem = target.closest('.file-item') as HTMLElement
    
    if (!fileItem) return
    
    const path = fileItem.dataset.path
    if (!path) return
    
    const state = getState(connectionId).remote
    const file = state.remoteFiles.find(f => f.path === path)
    if (!file) return
    
    if (file.isDirectory) {
      state.remotePath = path
      loadRemoteFiles(connectionId)
    }
  }

  /**
   * 导航到远程上级目录
   */
  async function navigateRemoteUp(
    connectionId: string,
    dirname: (path: string) => string
  ): Promise<void> {
    const state = getState(connectionId).remote
    const parentDir = dirname(state.remotePath)
    if (parentDir !== state.remotePath) {
      state.remotePath = parentDir
      await loadRemoteFiles(connectionId)
    }
  }

  /**
   * 创建远程文件夹
   */
  async function createRemoteFolder(connectionId: string, folderName: string): Promise<void> {
    const state = getState(connectionId).remote
    
    if (!state.connectionId) {
      throw new Error('SFTP 连接不存在，无法创建文件夹')
    }

    const fullPath = state.remotePath === '/'
      ? `/${folderName}`
      : `${state.remotePath}/${folderName}`

    const result = await window.api.sftp.mkdir(state.connectionId, fullPath)

    if (result.success) {
      console.log('[sftpBrowser] ✅ 远程文件夹创建成功:', fullPath)
      await loadRemoteFiles(connectionId)
    } else {
      throw new Error(`创建远程文件夹失败：${result.error}`)
    }
  }

  // ==================== 清理方法 ====================

  /**
   * 移除指定连接的状态（关闭 SFTP 窗口时调用）
   */
  function removeConnection(connectionId: string): void {
    stateMap.value.delete(connectionId)
  }

  /**
   * 清除所有连接状态（应用退出时调用）
   */
  function clearAll(): void {
    stateMap.value.clear()
  }

  return {
    // 状态
    stateMap,
    
    // ========== 核心方法 ==========
    getState,

    // ========== 本地文件相关 ==========
    getLocalPath,
    getLocalFiles,
    getLocalFileCount,
    setLocalPath,
    setLocalFiles,
    initLocalDefaultDir,
    loadLocalFiles,
    handleLocalDblClick,
    navigateLocalUp,
    navigateToLocalPath,
    createLocalFolder,

    // ========== 远程文件相关 ==========
    getRemotePath,
    getRemoteFiles,
    getRemoteFileCount,
    setRemotePath,
    setRemoteFiles,
    initRemoteDefaultDir,
    loadRemoteFiles,
    handleRemoteDblClick,
    navigateRemoteUp,
    createRemoteFolder,

    // ========== 清理方法 ==========
    removeConnection,
    clearAll
  }
})
