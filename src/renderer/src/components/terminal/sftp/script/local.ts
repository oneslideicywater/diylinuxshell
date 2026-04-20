/**
 * SFTP 本地文件操作模块
 * 提供本地文件的加载、导航、刷新等操作函数
 * @module sftp/local
 */

import type { Ref } from 'vue'
import { ref } from 'vue'


/**
 * 本地文件状态接口
 */
export interface LocalFileState {
  /** 当前本地路径 */
  localPath: Ref<string>
  /** 本地文件列表 */
  localFiles: Ref<any[]>
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
 * 默认本地路径（避免 C 盘权限问题）
 */
const DEFAULT_LOCAL_PATH = 'D:\\develop\\goworkbunch\\memcached-operator'

/**
 * 加载本地文件列表
 * @param state - 本地文件状态对象
 */
export async function loadLocalFiles(state: LocalFileState): Promise<void> {
  try {
    const pathToLoad = state.localPath.value || DEFAULT_LOCAL_PATH
    
    state.localPath.value = pathToLoad
    
    const result = await window.api.sftp.getLocalFiles(pathToLoad)
    if (result.success && result.data) {
      state.localFiles.value = result.data
      state.localFileCount.value = state.localFiles.value.length
    }
  } catch (error) {
    console.error('加载本地文件失败:', error)
    state.localPath.value = DEFAULT_LOCAL_PATH
    const result = await window.api.sftp.getLocalFiles(state.localPath.value)
    if (result.success && result.data) {
      state.localFiles.value = result.data
      state.localFileCount.value = state.localFiles.value.length
    }
  }
}

/**
 * 本地文件列表双击处理
 * @param event - 鼠标事件
 * @param state - 本地文件状态对象
 */
export function handleLocalDblClick(event: MouseEvent, state: LocalFileState): void {
  const target = (event.target as HTMLElement).closest('.file-item')
  if (!target) return
  
  const item = state.localFiles.value.find(f => f.path === (target as HTMLElement).dataset.path)
  if (item?.isDirectory) {
    state.localPath.value = item.path
    loadLocalFiles(state)
  }
}

/**
 * 导航到指定的本地路径
 * @param state - 本地文件状态对象
 * @param path - 目标路径
 */
export function navigateToLocalPath(state: LocalFileState, path: string): void {
  state.localPath.value = path
  loadLocalFiles(state)
}

/**
 * 刷新本地文件列表
 * @param state - 本地文件状态对象
 */
export async function refreshLocalFiles(state: LocalFileState): Promise<void> {
  await loadLocalFiles(state)
}

/**
 * 获取当前选中的本地文件
 * @param state - 本地文件状态对象
 * @param selectedLocal - 选中的本地文件路径
 * @returns 选中的本地文件对象，未选中返回 null
 */
export function getSelectedLocalFile(
  state: LocalFileState,
  selectedLocal: Ref<string>
): any | null {
  return state.localFiles.value.find(f => f.path === selectedLocal.value) || null
}

/**
 * 本地目录向上级
 * @param state - 本地文件状态对象
 * @param pathUtils - 路径工具对象
 */
export function localUp(
  state: LocalFileState,
  pathUtils: any
): void {
  const parentPath = pathUtils.dirname(state.localPath.value)
  if (parentPath !== state.localPath.value) {
    state.localPath.value = parentPath
    loadLocalFiles(state)
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
  try {
    const result = await window.api.sftp.createLocalFolder(state.localPath.value, folderName)
    if (!result.success) {
      throw new Error(result.error || '创建失败')
    }
    // 刷新文件列表
    await loadLocalFiles(state)
  } catch (error: any) {
    console.error('创建本地文件夹失败:', { path: state.localPath.value, folderName, error: error.message })
    throw error
  }
}
