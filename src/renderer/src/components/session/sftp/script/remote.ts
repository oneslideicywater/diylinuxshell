/**
 * SFTP 远程文件操作相关函数
 * @module sftp/remote
 */

import { ref } from 'vue'
import type { Ref } from 'vue'

/**
 * 远程文件状态接口
 */
export interface RemoteFileState {
  /** 当前远程路径 */
  remotePath: Ref<string>
  /** 远程文件列表 */
  remoteFiles: Ref<any[]>
  /** 选中的远程文件路径 */
  selectedRemote: Ref<string>
  /** 远程文件数量 */
  remoteFileCount: Ref<number>
  /** 会话信息 */
  session: any
}

/**
 * 创建并初始化远程文件状态对象
 * @param session - SSH 会话对象（可为 null）
 * @returns 远程文件状态对象（包含初始化的响应式变量）
 */
export function createRemoteFileState(session: any = null): RemoteFileState {
  return {
    remotePath: ref('/'),
    remoteFiles: ref<any[]>([]),
    selectedRemote: ref<string>(''),
    remoteFileCount: ref(0),
    session
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
 * @param state - 远程文件状态对象
 */
export async function loadRemoteFiles(state: RemoteFileState): Promise<void> {
  try {
    // 安全获取 session ID
    if (!state.session) {
      console.warn('[remote] 会话不存在，无法加载远程文件')
      state.remoteFiles.value = []
      state.remoteFileCount.value = 0
      return
    }
    
    const sessionId = state.session.id || (state.session as any).host
    
    if (!sessionId) {
      console.error('[remote] 无法获取会话 ID，请检查连接状态')
      state.remoteFiles.value = []
      state.remoteFileCount.value = 0
      return
    }
    
    const result = await window.api.sftp.listDir(sessionId, state.remotePath.value)
    
    // 确保 result.data 是数组，否则使用空数组
    if (result.success && Array.isArray(result.data)) {
      state.remoteFiles.value = result.data
      state.remoteFileCount.value = result.data.length
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
 * @param state - 远程文件状态对象
 * @param folderName - 文件夹名称
 */
export async function remoteMkdir(state: RemoteFileState, folderName: string): Promise<void> {
  try {
    // 安全检查 session
    if (!state.session) {
      alert('会话不存在，无法创建文件夹')
      return
    }
    
    const sessionId = state.session.id || (state.session as any).host
    
    if (!sessionId) {
      alert('无法获取会话 ID，请检查连接状态')
      return
    }
    
    const fullPath = state.remotePath.value === '/' 
      ? `/${folderName}` 
      : `${state.remotePath.value}/${folderName}`
    
    const result = await window.api.sftp.mkdir(sessionId, fullPath)
    
    if (result.success) {
      // 创建成功后重新加载文件列表
      await loadRemoteFiles(state)
    } else {
      alert(`创建文件夹失败：${result.error}`)
    }
  } catch (error: any) {
    alert(`创建文件夹失败：${error.message}`)
  }
}

/**
 * 删除远程文件或文件夹
 * @param state - 远程文件状态对象
 * @param path - 要删除的路径
 */
export async function remoteDeleteFile(state: RemoteFileState, path: string): Promise<void> {
  try {
    // 安全检查 session
    if (!state.session) {
      alert('会话不存在，无法删除文件')
      return
    }
    
    const sessionId = state.session.id || (state.session as any).host
    
    if (!sessionId) {
      alert('无法获取会话 ID，请检查连接状态')
      return
    }
    
    const result = await window.api.sftp.delete(sessionId, path)
    
    if (result.success) {
      // 删除成功后重新加载文件列表
      await loadRemoteFiles(state)
    } else {
      alert(`删除失败：${result.error}`)
    }
  } catch (error: any) {
    alert(`删除失败：${error.message}`)
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
