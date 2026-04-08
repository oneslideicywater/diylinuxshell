/**
 * SFTP 本地文件操作模块
 * 提供本地文件的加载、导航、刷新等操作函数
 * @module sftp/local
 */

import type { Ref } from 'vue'
import type { TransferTask, DeleteTask, TransferNode } from '@shared/types/sftp'
import {
  createTransferNode,
  updateNodeProgress,
  scanFolderStructure
} from './transfer-tree'

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
  uploadTasks: Ref<TransferTask[]>
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
  
  // 使用 transfer-tree.ts 的 createTransferNode 创建节点
  const node = createTransferNode(
    fileName,
    false,
    'upload',
    selectedLocal.value,
    remoteFilePath,
    0
  )
  node.status = 'pending'
  node.startTime = startTime
  
  // 创建 TransferTask
  const task: TransferTask = {
    id: taskId,
    type: 'upload',
    status: 'pending',
    nodes: [node],
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
    
    // 使用 transfer-tree.ts 的 updateNodeProgress 更新节点进度
    updateNodeProgress(node, data.progress, data.speed, [node])
    
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
    
    // 更新状态为 active
    if (node.status === 'pending') {
      task.status = 'active'
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
 * 删除本地文件（带进度追踪）
 * 可用于 SftpLocal 组件或其他需要删除本地文件的场景
 * @param filePath - 要删除的文件路径
 * @param fileName - 文件名称
 * @param isDirectory - 是否为文件夹
 * @param deleteTasks - 删除任务列表
 * @param state - 本地文件状态对象（用于刷新文件列表）
 */
export async function deleteLocalFile(
  filePath: string,
  fileName: string,
  isDirectory: boolean,
  deleteTasks: Ref<DeleteTask[]>,
  state: LocalFileState
): Promise<void> {
  const taskId = `delete-local-${Date.now()}`
  const startTime = Date.now()
  
  // 创建 DeleteTask
  const task: DeleteTask = {
    id: taskId,
    name: fileName,
    type: isDirectory ? 'folder' : 'file',
    source: 'local',
    status: 'pending',
    path: filePath,
    size: 0,
    startTime
  }
  
  // 添加到删除任务列表
  deleteTasks.value = [...deleteTasks.value, task]
  
  try {
    // 如果是文件夹，需要先扫描文件夹结构
    if (isDirectory) {
      task.status = 'deleting'
      // 递归扫描文件夹结构，创建子任务
      const children = await scanFolderStructure(filePath, '')
      task.children = children.map(child => ({
        id: child.id,
        name: child.name,
        type: child.isDirectory ? 'folder' : 'file',
        source: 'local' as const,
        status: 'pending',
        path: child.localPath || '',
        size: child.size,
        startTime: Date.now()
      }))
    } else {
      task.status = 'deleting'
    }
    
    const result = await window.api.sftp.deleteLocalFile(filePath)
    if (!result.success) {
      throw new Error(result.error || '删除失败')
    }
    
    // 更新任务状态为完成
    task.status = 'completed'
    task.endTime = Date.now()
    
    // 刷新本地文件列表
    await loadLocalFiles(state)
    
    // 延迟清理删除任务
    setTimeout(() => {
      deleteTasks.value = deleteTasks.value.filter(t => t.id !== taskId)
    }, 3000)
  } catch (error: any) {
    console.error('删除本地文件失败:', { filePath, error: error.message })
    task.status = 'failed'
    task.error = error.message
    task.endTime = Date.now()
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
 * 上传文件夹（带进度追踪）
 * @param session - 当前会话
 * @param remotePath - 远程目标路径
 * @param task - 传输任务
 * @param localFolderPath - 本地文件夹路径
 */
export async function uploadFolder(
  session: any,
  remotePath: Ref<string>,
  task: TransferTask,
  localFolderPath: string
): Promise<void> {
  try {
    if (!session) return
    const sessionId = session.id || session.host
    
    const transferNodes = task.nodes
    
    const folderName = localFolderPath.split(/[\\/]/).pop() || ''
    const remoteFolderPath = remotePath.value === '/' ? `/${folderName}` : `${remotePath.value}/${folderName}`
    
    // 扫描文件夹结构，创建完整的节点树
    const childNodes = await scanFolderStructure(localFolderPath, remoteFolderPath)
    
    // 计算总文件数（用于显示总体进度）
    const totalFiles = childNodes.length
    let completedFiles = 0
    
    // 创建根节点
    const rootNode: TransferNode = {
      id: `node-${Date.now()}`,
      name: folderName,
      isDirectory: true,
      type: 'upload',
      status: 'pending',
      progress: 0,
      size: 0,
      localPath: localFolderPath,
      remotePath: remoteFolderPath,
      speed: 0,
      remaining: '-',
      elapsed: '0s',
      children: childNodes,
      startTime: Date.now(),
      error: undefined,
      totalFiles,
      completedFiles
    }
    
    // 添加到任务节点列表
    transferNodes.push(rootNode)
    
    try {
      // 执行上传
      const uploadResult = await window.api.sftp.uploadFolder(sessionId, localFolderPath, remoteFolderPath)
      
      if (uploadResult.success) {
        // 上传成功，更新节点状态
        rootNode.status = 'completed'
        rootNode.progress = 100
      } else {
        // 上传失败，更新节点状态
        rootNode.status = 'error'
        rootNode.error = uploadResult.error
        alert(`上传失败：${uploadResult.error}`)
      }
    } catch (error: any) {
      // 上传异常，更新节点状态
      rootNode.status = 'error'
      rootNode.error = error.message
      alert(`上传失败：${error.message}`)
    }
  } catch (error: any) {
    alert(`上传失败：${error.message}`)
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
