/**
 * SFTP 本地文件操作相关函数
 * @module sftp/local
 */

import { ref } from 'vue'
import type { Ref } from 'vue'

/**
 * 本地文件状态接口
 */
export interface LocalFileState {
  /** 当前本地路径 */
  localPath: Ref<string>
  /** 本地文件列表 */
  localFiles: Ref<any[]>
  /** 选中的本地文件路径 */
  selectedLocal: Ref<string>
  /** 本地文件数量 */
  localFileCount: Ref<number>
}

/**
 * 创建并初始化本地文件状态对象
 * @returns 本地文件状态对象（包含初始化的响应式变量）
 */
export function createLocalFileState(): LocalFileState {
  return {
    localPath: ref(''),
    localFiles: ref<any[]>([]),
    selectedLocal: ref<string>(''),
    localFileCount: ref(0)
  }
}

/**
 * 初始化本地默认目录（设置为用户 home 目录）
 * @param state - 本地文件状态对象
 */
export async function initLocalDefaultDir(state: LocalFileState): Promise<void> {
  try {
    const homeResult = await window.api.sftp.getHomeDir()
    if (homeResult.success && homeResult.data) {
      state.localPath.value = homeResult.data
      console.log('[local] 本地默认目录设置为:', state.localPath.value)
    }
  } catch (error: any) {
    console.error('[local] 获取本地 home 目录失败:', error)
  }
}

/**
 * 加载本地文件列表
 * @param state - 本地文件状态对象
 */
export async function loadLocalFiles(state: LocalFileState): Promise<void> {
  try {
    // 验证路径是否存在且不为空
    if (!state.localPath.value) {
      console.warn('本地路径为空，跳过加载')
      state.localFiles.value = []
      state.localFileCount.value = 0
      return
    }
    
    const result = await window.api.sftp.getLocalFiles(state.localPath.value)
    
    if (result.success && result.data) {
      state.localFiles.value = result.data
      state.localFileCount.value = result.data.length
    } else {
      console.error('加载本地文件失败:', result.error)
      state.localFiles.value = []
      state.localFileCount.value = 0
    }
  } catch (error: any) {
    // 处理 ENOENT 错误（路径不存在）
    if (error.code === 'ENOENT') {
      console.error('本地路径不存在:', state.localPath.value)
    } else {
      console.error('加载本地文件异常:', error)
    }
    state.localFiles.value = []
    state.localFileCount.value = 0
  }
}

/**
 * 删除本地文件或文件夹
 * @param state - 本地文件状态对象
 * @param path - 要删除的路径
 */
export async function deleteLocalFile(state: LocalFileState, path: string): Promise<void> {
  const result = await window.api.sftp.deleteLocalFile(path)
  
  if (result.success) {
    // 删除成功后重新加载文件列表
    await loadLocalFiles(state)
  } else {
    alert(`删除失败：${result.error}`)
  }
}

/**
 * 创建本地文件夹
 * @param state - 本地文件状态对象
 * @param folderName - 文件夹名称
 */
export async function createLocalFolder(
  state: LocalFileState,
  folderName: string
): Promise<void> {
  const result = await window.api.sftp.createLocalFolder(state.localPath.value, folderName)
  
  if (result.success) {
    // 创建成功后重新加载文件列表
    await loadLocalFiles(state)
  } else {
    alert(`创建文件夹失败：${result.error}`)
  }
}

/**
 * 处理本地文件双击事件
 * @param event - 鼠标事件对象
 * @param state - 本地文件状态对象
 */
export function handleLocalDblClick(event: MouseEvent, state: LocalFileState): void {
  const target = event.target as HTMLElement
  const fileItem = target.closest('.file-item') as HTMLElement
  
  if (!fileItem) return
  
  const path = fileItem.dataset.path
  
  // 安全检查：确保路径存在
  if (!path) return
  
  const file = state.localFiles.value.find(f => f.path === path)
  
  if (!file) return
  
  // 如果是文件夹，进入该目录
  if (file.isDirectory) {
    state.localPath.value = path
    loadLocalFiles(state)
  }
  // 如果是文件，保持选中状态（可扩展为打开文件等操作）
}
