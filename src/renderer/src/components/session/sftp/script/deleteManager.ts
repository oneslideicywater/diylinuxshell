/**
 * 删除任务管理器
 * 管理批量删除任务的执行和取消
 * @module sftp/deleteManager
 */

import type { DeleteTask } from '@shared/types/sftp'
import { formatTime } from '@/utils/fs-utils'

/**
 * 生成任务 ID
 */
function generateTaskId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 删除任务管理器类
 */
export class DeleteManager {
  private tasks: Map<string, DeleteTask> = new Map()
  private cancelled: boolean = false
  private sessionId: string

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  /**
   * 添加删除任务
   */
  addTask(task: DeleteTask): void {
    this.tasks.set(task.id, task)
  }

  /**
   * 添加多个删除任务
   */
  addTasks(tasks: DeleteTask[]): void {
    tasks.forEach(task => this.tasks.set(task.id, task))
  }

  /**
   * 执行所有删除任务
   */
  async executeAll(): Promise<void> {
    this.cancelled = false
    
    for (const task of this.tasks.values()) {
      if (this.cancelled) {
        task.status = 'cancelled'
        continue
      }

      task.status = 'deleting'
      task.startTime = Date.now()

      try {
        if (task.source === 'local') {
          await this.executeLocalDelete(task)
        } else {
          await this.executeRemoteDelete(task)
        }
        task.status = 'completed'
        task.endTime = Date.now()
      } catch (error: any) {
        task.status = 'failed'
        task.error = error.message
        task.endTime = Date.now()
        console.error('删除任务失败:', { task, error: error.message })
      }
    }
  }

  /**
   * 执行本地删除
   */
  private async executeLocalDelete(task: DeleteTask): Promise<void> {
    // 递归删除文件夹
    if (task.type === 'folder') {
      await this.deleteLocalFolderRecursively(task)
    } else {
      // 删除单个文件
      const result = await window.api.sftp.deleteLocalFile(task.path)
      if (!result.success) {
        throw new Error(result.error || '删除失败')
      }
    }
  }

  /**
   * 执行远程删除
   */
  private async executeRemoteDelete(task: DeleteTask): Promise<void> {
    // 递归删除远程文件夹
    if (task.type === 'folder') {
      await this.deleteRemoteFolderRecursively(task)
    } else {
      // 删除单个文件
      const result = await window.api.sftp.delete(this.sessionId, task.path)
      if (!result.success) {
        throw new Error(result.error || '删除失败')
      }
    }
  }

  /**
   * 递归删除本地文件夹
   */
  private async deleteLocalFolderRecursively(task: DeleteTask): Promise<void> {
    // 删除文件夹本身（IPC 处理器会递归删除内容）
    const result = await window.api.sftp.deleteLocalFile(task.path)
    if (!result.success) {
      throw new Error(result.error || '删除失败')
    }
  }

  /**
   * 递归删除远程文件夹
   */
  private async deleteRemoteFolderRecursively(task: DeleteTask): Promise<void> {
    // 删除文件夹本身（IPC 处理器会递归删除内容）
    const result = await window.api.sftp.delete(this.sessionId, task.path)
    if (!result.success) {
      throw new Error(result.error || '删除失败')
    }
  }

  /**
   * 取消所有删除任务
   */
  cancel(): void {
    this.cancelled = true
    for (const task of this.tasks.values()) {
      if (task.status === 'pending') {
        task.status = 'cancelled'
      }
    }
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(taskId: string): DeleteTask | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): DeleteTask[] {
    return Array.from(this.tasks.values())
  }

  /**
   * 清空所有任务
   */
  clear(): void {
    this.tasks.clear()
    this.cancelled = false
  }

  /**
   * 获取任务数量
   */
  getTaskCount(): number {
    return this.tasks.size
  }

  /**
   * 获取已完成的任务数量
   */
  getCompletedCount(): number {
    let count = 0
    for (const task of this.tasks.values()) {
      if (task.status === 'completed') {
        count++
      }
    }
    return count
  }

  /**
   * 获取失败的任务数量
   */
  getFailedCount(): number {
    let count = 0
    for (const task of this.tasks.values()) {
      if (task.status === 'failed') {
        count++
      }
    }
    return count
  }
}

/**
 * 创建删除任务
 */
export function createDeleteTask(
  path: string,
  name: string,
  type: 'file' | 'folder',
  source: 'local' | 'remote',
  size: number = 0
): DeleteTask {
  return {
    id: generateTaskId('delete'),
    name,
    type,
    source,
    status: 'pending',
    path,
    size,
    startTime: 0
  }
}

/**
 * 将 DeleteTask 转换为 TransferNode
 */
export function deleteTaskToTransferNode(task: DeleteTask): any {
  // 映射删除状态到通用状态
  const statusMap: Record<string, string> = {
    pending: 'pending',
    deleting: 'transferring',
    completed: 'completed',
    failed: 'error',
    cancelled: 'cancelled'
  }

  // 计算经过时间
  const calculateElapsed = (task: DeleteTask): string => {
    if (!task.startTime) return '-'
    const elapsed = task.endTime ? task.endTime - task.startTime : Date.now() - task.startTime
    return formatTime(elapsed)
  }

  // 计算估计剩余时间（删除操作通常很快，简单估算）
  const calculateRemaining = (task: DeleteTask): string => {
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      return '-'
    }
    // 删除操作通常很快，不显示估计剩余
    return '-'
  }

  return {
    id: task.id,
    name: task.name,
    type: 'delete' as const,
    isDirectory: task.type === 'folder',
    status: statusMap[task.status] as any,
    progress: task.status === 'completed' ? 100 : 0,
    size: task.size,
    localPath: task.source === 'local' ? task.path : '-',
    remotePath: task.source === 'remote' ? task.path : '-',
    speed: 0,
    remaining: calculateRemaining(task),
    elapsed: calculateElapsed(task),
    error: task.error,
    children: task.children?.map(child => deleteTaskToTransferNode(child))
  }
}
