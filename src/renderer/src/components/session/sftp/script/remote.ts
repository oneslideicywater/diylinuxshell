/**
 * SFTP 远程文件操作模块
 */

import type { Ref } from 'vue'
import type { Session } from '@shared/types'
import type { TransferTask, DeleteTask, TransferNode } from '@shared/types/sftp'
import { formatTime } from '@/utils/fs-utils'

/**
 * 远程文件状态接口
 */
export interface RemoteFileState {
  remotePath: Ref<string>
  remoteFiles: Ref<any[]>
  remoteFileCount: Ref<number>
  session: Ref<Session | null>
}

/**
 * 加载远程文件列表
 */
export async function loadRemoteFiles(state: RemoteFileState): Promise<void> {
  if (!state.session.value) {
    console.error('Session is null')
    return
  }
  
  try {
    const sessionId = state.session.value.id || state.session.value.host
    console.log('Loading remote files:', sessionId, state.remotePath.value)
    
    const result = await window.api.sftp.listDir(sessionId, state.remotePath.value)
    
    if (result.success && result.data) {
      state.remoteFiles.value = result.data
      state.remoteFileCount.value = state.remoteFiles.value.length
      console.log('Remote files loaded:', state.remoteFileCount.value)
    } else {
      console.error('加载远程文件失败:', result.error)
      state.remoteFiles.value = []
      state.remoteFileCount.value = 0
    }
  } catch (error: any) {
    console.error('加载远程文件失败:', error)
    state.remoteFiles.value = []
    state.remoteFileCount.value = 0
  }
}

/**
 * 远程文件列表双击处理
 */
export function handleRemoteDblClick(event: MouseEvent, state: RemoteFileState): void {
  const target = (event.target as HTMLElement).closest('.file-item')
  if (!target) return
  
  const item = state.remoteFiles.value.find(f => f.path === (target as HTMLElement).dataset.path)
  if (item?.isDirectory) {
    state.remotePath.value = item.path
    loadRemoteFiles(state)
  }
}

/**
 * 导航到指定的远程路径
 */
export function navigateToRemotePath(state: RemoteFileState, path: string): void {
  state.remotePath.value = path
  loadRemoteFiles(state)
}

/**
 * 刷新远程文件列表
 */
export async function refreshRemoteFiles(state: RemoteFileState): Promise<void> {
  await loadRemoteFiles(state)
}

/**
 * 获取当前选中的远程文件
 */
export function getSelectedRemoteFile(
  state: RemoteFileState,
  selectedRemote: Ref<string>
): any | null {
  return state.remoteFiles.value.find(f => f.path === selectedRemote.value) || null
}

/**
 * 构建远程路径
 */
export function buildRemotePath(basePath: string, fileName: string): string {
  return basePath === '/' ? `/${fileName}` : `${basePath}/${fileName}`
}

/**
 * 删除远程文件
 */
export async function deleteRemoteFile(
  filePath: string,
  state: RemoteFileState,
  task: DeleteTask
): Promise<void> {
  if (!state.session.value) return
  
  if (confirm(`确定要删除远程文件 "${filePath}" 吗？`)) {
    try {
      const sessionId = state.session.value.id || state.session.value.host
      
      // 执行删除
      const result = await window.api.sftp.delete(sessionId, filePath)
      
      // 更新任务状态
      if (result.success) {
        task.status = 'completed'
        task.endTime = Date.now()
        
        // 显示删除完成提示
        alert('删除成功')
        await loadRemoteFiles(state)
      } else {
        task.status = 'failed'
        task.error = result.error
        alert(`删除失败：${result.error}`)
      }
    } catch (error: any) {
      task.status = 'failed'
      task.error = error.message
      alert(`删除失败：${error.message}`)
    }
  }
}

/**
 * 下载文件/文件夹到本地（带进度追踪）
 * @param remotePath - 远程文件/文件夹路径
 * @param session - 当前会话
 * @param localPath - 本地目标路径
 * @param downloadTasks - 下载任务列表
 */
export async function downloadToLocal(
  remotePath: string,
  session: any,
  localPath: Ref<string>,
  downloadTasks: Ref<TransferTask[]>
): Promise<void> {
  if (!remotePath || !session) return
  
  try {
    // 创建传输任务
    const taskId = `download-${Date.now()}`
    const startTime = Date.now()
    
    const fileName = remotePath.split(/[\\/]/).pop() || ''
    const localTargetPath = `${localPath.value}/${fileName}`
    
    // 创建传输任务对象
    const task: TransferTask = {
      id: taskId,
      type: 'download',
      status: 'pending',
      nodes: [],
      totalBytes: 0,
      transferredBytes: 0,
      remainingTime: 0,
      elapsedTime: 0,
      createdAt: startTime
    }
    
    // 创建根节点（先创建，后续会根据文件信息更新）
    const rootNode: TransferNode = {
      id: `node-${Date.now()}`,
      name: fileName,
      isDirectory: false,
      type: 'download',
      status: 'pending',
      progress: 0,
      size: 0,
      localPath: localTargetPath,
      remotePath: remotePath,
      speed: 0,
      remaining: '-',
      elapsed: '0s',
      children: [],
      startTime: Date.now(),
      error: undefined
    }
    
    // 添加到任务节点列表
    task.nodes.push(rootNode)
    
    // 添加到下载任务列表
    downloadTasks.value = [...downloadTasks.value, task]
    
    const sessionId = session.id || session.host
    
    // 监听下载进度
    const cleanup = window.api.sftp.onDownloadProgress((data) => {
      if (data.sessionId === sessionId) {
        rootNode.speed = data.speed
        rootNode.elapsed = formatTime((Date.now() - (rootNode.startTime || Date.now())) / 1000)
        rootNode.progress = data.progress
        rootNode.size = data.size
        
        // 更新任务统计
        task.transferredBytes = data.transferredSize
        task.totalBytes = data.size
        task.elapsedTime = Math.floor((Date.now() - startTime) / 1000)
        task.remainingTime = data.speed > 0 ? Math.floor((data.size - data.transferredSize) / data.speed) : 0
        
        if (data.progress >= 100) {
          rootNode.status = 'completed'
          rootNode.progress = 100
          task.status = 'completed'
          task.completedAt = Date.now()
        } else {
          rootNode.status = 'transferring'
          task.status = 'active'
        }
      }
    })
    
    let result
    // 先尝试作为文件夹下载
    result = await window.api.sftp.downloadFolder(sessionId, remotePath, localTargetPath)
    
    // 如果不是文件夹，则作为文件下载
    if (!result.success && result.error?.includes('不是文件夹')) {
      result = await window.api.sftp.download(sessionId, remotePath, localTargetPath)
    }
    
    // 清理监听器
    cleanup()
    
    if (result.success) {
      rootNode.status = 'completed'
      rootNode.progress = 100
      task.status = 'completed'
      task.completedAt = Date.now()
      
      // 刷新本地文件列表（由调用方自行处理）
      
      // 延迟清理下载任务
      setTimeout(() => {
        downloadTasks.value = downloadTasks.value.filter(t => t.id !== taskId)
      }, 3000)
    } else {
      rootNode.status = 'error'
      rootNode.error = result.error
      task.status = 'completed'
      alert(`下载失败：${result.error}`)
    }
  } catch (error: any) {
    console.error('下载失败:', error)
    alert(`下载失败：${error.message}`)
  }
}

/**
 * 创建远程文件夹
 */
export async function createRemoteFolder(
  state: RemoteFileState,
  newFolderName: Ref<string>,
  showNewFolderDialog: Ref<boolean>,
  fileContextMenuPath: Ref<string>
): Promise<void> {
  if (!newFolderName.value.trim()) {
    alert('请输入文件夹名称')
    return
  }
  
  if (!state.session.value) return
  const sessionId = state.session.value.id || state.session.value.host
  
  // 使用保存的路径，如果没有保存则使用当前 remotePath
  const basePath = fileContextMenuPath.value || state.remotePath.value
  const folderPath = basePath === '/' ? `/${newFolderName.value}` : `${basePath}/${newFolderName.value}`
  
  try {
    const result = await window.api.sftp.mkdir(sessionId, folderPath)
    if (result.success) {
      await loadRemoteFiles(state)
      showNewFolderDialog.value = false
      newFolderName.value = ''
      fileContextMenuPath.value = ''
    } else {
      alert(`创建文件夹失败：${result.error}`)
    }
  } catch (error: any) {
    alert(`创建文件夹失败：${error.message}`)
  }
}

/**
 * 远程目录向上级
 */
export function remoteUp(
  state: RemoteFileState,
  pathUtils: any
): void {
  const parentPath = pathUtils.posix.dirname(state.remotePath.value)
  if (parentPath !== state.remotePath.value) {
    state.remotePath.value = parentPath
    loadRemoteFiles(state)
  }
}
