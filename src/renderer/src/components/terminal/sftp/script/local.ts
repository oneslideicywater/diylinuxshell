/**
 * SFTP 本地文件操作模块
 * 提供本地文件的加载、导航、刷新等操作函数
 * @module sftp/local
 */

import type { Ref } from 'vue'
import type { TransferTask, TransferNode } from '@shared/types/sftp'
import { ref } from 'vue'
import { useSftpTransferStore } from '@/stores/sftpTransfer'


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
  /** 选中的本地文件/文件夹路径 */
  selectedLocal: Ref<string>
}

/**
 * 创建并初始化本地文件状态对象
 * @returns 本地文件状态对象（包含初始化的响应式变量）
 */
export function createLocalFileState(): LocalFileState {
  return {
    localPath: ref(''),
    localFiles: ref<any[]>([]),
    localFileCount: ref(0),
    selectedLocal: ref('')
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
    // 始终使用 D 盘开发目录作为默认路径（避免 C 盘权限问题）
    let pathToLoad = state.localPath.value || DEFAULT_LOCAL_PATH
    
    state.localPath.value = pathToLoad
    
    const result = await window.api.sftp.getLocalFiles(pathToLoad)
    if (result.success && result.data) {
      state.localFiles.value = result.data
      state.localFileCount.value = state.localFiles.value.length
    }
  } catch (error) {
    console.error('加载本地文件失败:', error)
    // 出错时加载 D 盘开发目录（避免 C 盘权限问题）
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
 * 上传单个文件（带进度追踪）
 * @param selectedLocal - 选中的本地文件路径
 * @param remotePath - 远程目标路径
 * @param session - 当前会话
 * @param uploadTasks - 上传任务列表
 */
export async function uploadFile(
  selectedLocal: Ref<string>,
  remotePath: Ref<string>,
  session: any,
  uploadTasks: Ref<TransferTask[]>,
  connectionId: string
): Promise<void> {
  console.log('[uploadFile] called, selectedLocal.value:', selectedLocal.value)
  // 根据 PRD 要求，严禁弹出文件选择框，必须基于已选中的文件
  if (!selectedLocal.value) {
    console.error('[uploadFile] No file selected')
    alert('请先选择要上传的文件')
    return
  }
  
  if (!session) {
    console.error('[uploadFile] No session')
    return
  }
  
  const sessionId = session.id || session.host
  const fileName = selectedLocal.value.split(/[\\/]/).pop() || ''
  const remoteFilePath = remotePath.value === '/' ? `/${fileName}` : `${remotePath.value}/${fileName}`
  
  console.log('[uploadFile] Uploading file:', selectedLocal.value, 'to:', remoteFilePath, 'sessionId:', sessionId)
  
  // 创建传输任务
  const taskId = `upload-${Date.now()}`
  const startTime = Date.now()
  
  // 手动创建 TransferNode（替代不存在的 createTransferNode 函数）
  const node: TransferNode = {
    id: `node-${taskId}`,
    name: fileName,
    isDirectory: false,
    type: 'upload',
    status: 'pending',
    progress: 0,
    size: 0, // 稍后通过进度回调更新
    localPath: selectedLocal.value,
    remotePath: remoteFilePath,
    speed: 0,
    remaining: '',
    elapsed: '',
    startTime
  }
  
  // 创建 TransferTask（安全架构 v3：使用 sftpConnectionId）
  const task: TransferTask = {
    id: taskId,
    type: 'upload',
    status: 'pending',
    root: node,
    sftpConnectionId: connectionId,  // SFTP 连接标识符
    totalBytes: 0,
    transferredBytes: 0,
    remainingTime: 0,
    elapsedTime: 0,
    createdAt: startTime
  }
  
  // 添加到上传任务列表
  uploadTasks.value = [...uploadTasks.value, task]
  
  // 监听进度事件
  const progressHandler = (data: { sessionId: string; localPath: string; remotePath: string; progress: number; size: number; transferredSize: number; speed: number }) => {
    if (data.sessionId !== sessionId || data.localPath !== selectedLocal.value) {
      return
    }
    
    console.log('[uploadFile] Progress event:', data)
    
    // 手动更新节点进度（替代不存在的 updateNodeProgress 函数）
    node.progress = data.progress
    node.speed = data.speed
    node.size = data.size
    
    // 计算已用时间
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
    node.elapsed = `${elapsedSeconds}s`
    
    // 计算剩余时间
    if (data.speed > 0) {
      const remainingBytes = data.size - data.transferredSize
      const remainingSeconds = Math.floor(remainingBytes / data.speed)
      node.remaining = `${remainingSeconds}s`
    }
    
    // 更新任务统计
    task.transferredBytes = data.transferredSize
    task.totalBytes = data.size
    task.elapsedTime = elapsedSeconds
    task.remainingTime = data.speed > 0 ? Math.floor((data.size - data.transferredSize) / data.speed) : 0
    
    // 更新状态为 transferring（符合 TransferStatus 标准）
    if (node.status === 'pending') {
      task.status = 'transferring'
    }
  }
  
  // 注册进度监听
  const cleanup = window.api.sftp.onUploadProgress(progressHandler)
  
  try {
    const result = await window.api.sftp.upload(sessionId, selectedLocal.value, remoteFilePath)
    console.log('[uploadFile] Upload result:', result)
    
    // 移除进度监听
    cleanup()
    
    if (result.success) {
      // 更新节点状态为完成
      node.status = 'completed'
      node.progress = 100
      task.status = 'completed'
      task.completedAt = Date.now()
      
      // 延迟清理传输任务
      setTimeout(() => {
        uploadTasks.value = uploadTasks.value.filter(t => t.id !== taskId)
      }, 3000)
    } else {
      // 更新节点状态为错误
      node.status = 'error'
      node.error = result.error
      task.status = 'completed'
      alert(`上传失败：${result.error}`)
    }
  } catch (error: any) {
    console.error('[uploadFile] Upload error:', error)
    
    // 移除进度监听
    cleanup()
    
    // 更新节点状态为错误
    node.status = 'error'
    node.error = error.message
    task.status = 'completed'
    
    alert(`上传失败：${error.message}`)
  }
}

/**
 * 删除本地文件（使用 TransferTask 统一管理）
 * 
 * 安全架构 v3：
 * - 使用 TransferTask 接口统一管理所有任务类型（上传、下载、删除）
 * - 通过 sftpTransferStore 集中管理任务状态
 * - 支持进度追踪和 UI 响应式更新
 * 
 * @param filePath - 要删除的文件路径
 * @param fileName - 文件名称
 * @param isDirectory - 是否为文件夹
 * @param connectionId - SFTP 连接标识符（用于任务隔离）
 * @param loadLocalFiles - 加载本地文件列表的函数
 */
export async function deleteLocalFile(
  filePath: string,
  fileName: string,
  isDirectory: boolean,
  connectionId: string,
  loadLocalFiles: () => Promise<void>
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  const taskId = `delete-local-${Date.now()}`
  const startTime = Date.now()
  
  // 创建文件节点（TransferNode）
  const node: TransferNode = {
    id: `node-${taskId}`,
    name: fileName,
    isDirectory: isDirectory,
    type: 'delete',
    status: 'pending',
    progress: 0,
    size: 0,
    localPath: filePath,
    remotePath: '', // 本地删除不需要远程路径
    speed: 0,
    remaining: '',
    elapsed: '',
    startTime
  }
  
  // 创建 TransferTask（安全架构 v3：统一接口）
  const task: TransferTask = {
    id: taskId,
    type: 'delete', // 任务类型：删除
    status: 'pending',
    root: node,
    sftpConnectionId: connectionId, // SFTP 连接标识符（用于任务隔离）
    totalBytes: 0,
    transferredBytes: 0,
    remainingTime: 0,
    elapsedTime: 0,
    createdAt: startTime
  }
  
  // 添加到 Store（自动触发 UI 更新）
  sftpTransferStore.addTask(task)
  console.log(`[local] ✅ 删除任务已创建: ${taskId}`)
  
  try {
    // 更新任务状态为传输中
    sftpTransferStore.updateTaskStatus(taskId, 'transferring')
    sftpTransferStore.updateNodeStatus(taskId, node.id, {
      status: 'transferring',
      startTime: Date.now()
    })
    
    // 如果是文件夹，需要先扫描文件夹结构（可选，用于显示子项进度）
    if (isDirectory) {
      console.log('[local] 正在扫描文件夹结构...')
      // 可以在这里添加扫描逻辑，如果需要显示每个文件的删除进度
    }
    
    // 调用 Electron API 删除本地文件
    const result = await window.api.sftp.deleteLocalFile(filePath)
    
    if (!result.success) {
      throw new Error(result.error || '删除失败')
    }
    
    // 更新任务状态为完成
    sftpTransferStore.updateNodeStatus(taskId, node.id, {
      status: 'completed',
      progress: 100
    })
    
    sftpTransferStore.updateTaskStatus(taskId, 'completed')
    
    console.log(`[local] ✅ 文件删除完成: ${fileName}`)
    
    // 刷新本地文件列表
    await loadLocalFiles()
    
    // 延迟清理已完成任务（3秒后自动移除）
    setTimeout(() => {
      sftpTransferStore.removeTask(taskId)
      console.log(`[local] 🗑️ 删除任务已清理: ${taskId}`)
    }, 3000)
    
  } catch (error: any) {
    console.error('[local] 删除本地文件失败:', { filePath, error: error.message })
    
    // 更新任务状态为错误（符合 TransferStatus 标准）
    sftpTransferStore.updateNodeStatus(taskId, node.id, {
      status: 'error'
    })
    
    sftpTransferStore.updateTaskStatus(taskId, 'error')
    
    throw error
  }
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
