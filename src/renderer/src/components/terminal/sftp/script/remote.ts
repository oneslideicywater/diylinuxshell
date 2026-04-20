/**
 * SFTP 远程文件操作相关函数
 * @module sftp/remote
 */

import { ref } from 'vue'
import type { Ref } from 'vue'

/**
 * 远程文件状态接口
 * 
 * 安全改进（v2）：
 * - 移除 session 字段，改用 connectionId
 * - connectionId 是 SFTP 连接池中的唯一标识符（每个 tab 独立）
 * - 避免在渲染进程传递会话对象，增强安全性
 */
export interface RemoteFileState {
  /** 当前远程路径 */
  remotePath: Ref<string>
  /** 远程文件列表 */
  remoteFiles: Ref<any[]>
  /** 远程文件数量 */
  remoteFileCount: Ref<number>
  /**
   * SFTP 连接标识符（每个 SFTP 标签独立）
   * 用于在连接池中查找对应的 SFTP 连接
   * 对应主进程中 sftpPool.getConnection(connectionId) 的 key
   */
  connectionId: string
}

/**
 * 创建并初始化远程文件状态对象
 * @param connectionId - SFTP 连接标识符（来自 tab.sftpConnectionId）
 * @returns 远程文件状态对象（包含初始化的响应式变量）
 */
export function createRemoteFileState(connectionId: string = ''): RemoteFileState {
  return {
    remotePath: ref('/'),
    remoteFiles: ref<any[]>([]),
    remoteFileCount: ref(0),
    connectionId
  }
}

/**
 * 初始化远程默认目录（SSH 登录用户的默认工作目录）
 * 注意：SFTP 连接后默认就在用户的主目录，所以这里保持 '/'
 * @param state - 远程文件状态对象
 */
export function initRemoteDefaultDir(state: RemoteFileState): void {
  // SFTP 连接成功后，默认工作目录就是用户的主目录（如 /root 或 /home/username）
  // 使用 '/' 作为起始点允许用户浏览整个文件系统（如果有权限）
  state.remotePath.value = '/'
  console.log('[remote] 远程默认目录设置为:', state.remotePath.value)
}

/**
 * 加载远程文件列表
 * @param state - 远程文件状态对象（包含 connectionId）
 */
export async function loadRemoteFiles(state: RemoteFileState): Promise<void> {
  try {
    // 安全检查 connectionId
    if (!state.connectionId) {
      console.warn('[remote] connectionId 不存在，无法加载远程文件')
      state.remoteFiles.value = []
      state.remoteFileCount.value = 0
      return
    }
    
    // 使用 connectionId 调用 SFTP API（对应主进程连接池的 key）
    const result = await window.api.sftp.listDir(state.connectionId, state.remotePath.value)
    
    // 确保 result.data 是数组，否则使用空数组
    if (result.success && Array.isArray(result.data)) {
      state.remoteFiles.value = result.data
      state.remoteFileCount.value = result.data.length
      console.log(`[remote] ✅ 成功加载 ${result.data.length} 个文件/文件夹`)
    } else {
      console.error('加载远程文件失败:', result.error)
      state.remoteFiles.value = []
      state.remoteFileCount.value = 0
    }
  } catch (error: any) {
    console.error('加载远程文件异常:', error)
    state.remoteFiles.value = []
    state.remoteFileCount.value = 0
  }
}

/**
 * 导航到上级目录
 * @param state - 远程文件状态对象
 * @param pathUtils - 路径工具函数
 */
export async function remoteUpRemote(
  state: RemoteFileState,
  pathUtils: {
    posix: {
      dirname: (path: string) => string
    }
  }
): Promise<void> {
  try {
    const parentDir = pathUtils.posix.dirname(state.remotePath.value)
    if (parentDir !== state.remotePath.value) {
      state.remotePath.value = parentDir
      await loadRemoteFiles(state)
    }
  } catch (error: any) {
    console.error('导航到上级目录失败:', error)
  }
}

/**
 * 创建远程文件夹
 * @param state - 远程文件状态对象（包含 connectionId）
 * @param folderName - 文件夹名称
 */
export async function remoteMkdir(state: RemoteFileState, folderName: string): Promise<void> {
  // 安全检查 connectionId
  if (!state.connectionId) {
    throw new Error('SFTP 连接不存在，无法创建文件夹')
  }

  const fullPath = state.remotePath.value === '/'
    ? `/${folderName}`
    : `${state.remotePath.value}/${folderName}`

  // 使用 connectionId 调用 SFTP API
  const result = await window.api.sftp.mkdir(state.connectionId, fullPath)

  if (result.success) {
    console.log('[remote] ✅ 文件夹创建成功:', fullPath)
    await loadRemoteFiles(state)
  } else {
    throw new Error(`创建文件夹失败：${result.error}`)
  }
}

/**
 * 删除远程文件或文件夹
 * @param state - 远程文件状态对象（包含 connectionId）
 * @param path - 要删除的路径
 */
export async function remoteDeleteFile(state: RemoteFileState, path: string): Promise<void> {
  // 安全检查 connectionId
  if (!state.connectionId) {
    throw new Error('SFTP 连接不存在，无法删除文件')
  }

  // 使用 connectionId 调用 SFTP API
  const result = await window.api.sftp.delete(state.connectionId, path)

  if (result.success) {
    await loadRemoteFiles(state)
  } else {
    throw new Error(`删除失败：${result.error}`)
  }
}

/**
 * 处理远程文件双击事件
 * 双击目录时进入该目录，双击文件时不做处理
 * @param event - 鼠标事件对象
 * @param state - 远程文件状态对象
 */
export function handleRemoteDblClick(event: MouseEvent, state: RemoteFileState): void {
  // 获取点击的文件元素
  const target = event.target as HTMLElement
  const fileItem = target.closest('.file-item') as HTMLElement
  
  // 未点击到文件项则直接返回
  if (!fileItem) return
  
  // 从 dataset 中获取文件路径
  const path = fileItem.dataset.path
  if (!path) return
  
  // 在文件列表中查找对应的文件信息
  const file = state.remoteFiles.value.find(f => f.path === path)
  if (!file) return
  
  // 目录类型：进入该目录
  if (file.isDirectory) {
    state.remotePath.value = path
    loadRemoteFiles(state)
  }
  // 文件类型：双击不做额外操作（可通过右键菜单下载等）
}

/**
 * 获取当前选中的远程文件
 * @param state - 远程文件状态对象
 * @param selectedRemote - 选中的远程文件路径
 * @returns 选中的远程文件对象，未选中返回 null
 */
export function getSelectedRemoteFile(
  state: RemoteFileState,
  selectedRemote: Ref<string>
): any | null {
  return state.remoteFiles.value.find(f => f.path === selectedRemote.value) || null
}
