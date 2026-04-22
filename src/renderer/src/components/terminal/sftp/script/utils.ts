/**
 * SFTP 公共工具函数模块
 * 
 * 设计原则：
 * - 统一管理所有 SFTP 操作的公共工具函数
 * - 消除代码重复，提高可维护性
 * - 提供工厂方法简化 TransferNode/TransferTask 创建
 * 
 * @module sftp/utils
 */

import type { TransferTask, TransferNode, TransferStatus, TransferType } from '@shared/types/sftp'
import { useSftpTransferStore } from '@/stores/sftpTransfer'

/**
 * 格式化时间（秒 -> HH:MM:SS）
 * 
 * ✅ 统一版本：消除 delete.ts/upload.ts/download.ts 三处重复定义
 * 
 * @param seconds 秒数（可为负数）
 * @returns 格式化的时间字符串，如 '01:23:45'
 */
export function formatTime(seconds: number): string {
  if (seconds < 0) return '00:00:00'
  
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':')
}

/**
 * 创建传输节点工厂函数
 * 
 * ✅ 统一版本：消除各模块中手动创建 TransferNode 的重复代码
 * - 自动生成唯一 ID（时间戳 + 随机字符串）
 * - 统一默认值设置
 * - 支持上传、下载、删除三种操作类型
 * - 支持普通节点、错误节点、根节点等多种场景
 * 
 * @param config 节点配置项
 * @returns 初始化完成的 TransferNode 对象
 */
export function createTransferNode(config: {
  /** 文件/文件夹名称 */
  name: string
  /** 是否为目录 */
  isDirectory: boolean
  /** 操作类型 */
  type: TransferType
  /** 本地路径（可选） */
  localPath?: string
  /** 远程路径（可选） */
  remotePath?: string
  /** 文件大小（字节，可选） */
  size?: number
  /** 节点状态（可选，默认 'pending'） */
  status?: TransferStatus
  /** 错误信息（可选，用于 error 状态） */
  error?: string
  /** 子节点列表（可选，用于文件夹根节点） */
  children?: TransferNode[]
  /** 总文件数（可选，用于文件夹统计） */
  totalFiles?: number
  /** 已完成文件数（可选，用于文件夹统计） */
  completedFiles?: number
  /** 是否展开（可选，用于 UI 显示） */
  expanded?: boolean
  /** 父节点 ID（可选，用于祖先链传播） */
  parentId?: string
}): TransferNode {
  const node: TransferNode = {
    id: config.status === 'error' 
      ? `node-error-${Date.now()}` 
      : `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: config.name,
    isDirectory: config.isDirectory,
    type: config.type,
    status: config.status || 'pending',
    progress: 0,
    size: config.size || 0,
    localPath: config.localPath || '',
    remotePath: config.remotePath || '',
    speed: 0,
    transferredBytes: 0
  }

  if (config.error) {
    node.error = config.error
  }

  if (config.children) {
    node.children = config.children
    node.totalFiles = config.totalFiles || 0
    node.completedFiles = config.completedFiles || 0
    node.expanded = config.expanded || false
  }

  if (config.parentId) {
    node.parentId = config.parentId
  }

  return node
}

/**
 * 格式化文件大小（字节 -> 人类可读格式）
 * 
 * ✅ 统一版本：消除 upload.ts/download.ts 两处重复定义
 * 
 * @param bytes 字节数
 * @returns 格式化的字符串，如 '1.5 MB'、'256 KB'
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const size = bytes / Math.pow(k, i)
  
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

/**
 * 创建传输任务工厂函数
 * 
 * ✅ 统一版本：消除各模块中手动创建 TransferTask 的重复代码
 * - 自动生成唯一 ID（包含操作类型前缀）
 * - 统一初始状态和统计字段
 * - 关联 Pinia Store 进行状态管理
 * 
 * @param config 任务配置项
 * @returns 初始化完成的 TransferTask 对象
 */
export function createTransferTask(config: {
  /** 任务类型 */
  type: TransferType
  /** 根节点（文件或文件夹） */
  root: TransferNode
  /** SFTP 连接标识符 */
  sftpConnectionId: string
  /** 会话 ID（可选，用于 UI 显示） */
  sessionId?: string
  /** 总字节数（可选，稍后可通过进度更新） */
  totalBytes?: number
}): TransferTask {
  return {
    id: `task-${config.type}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    type: config.type,
    status: 'pending',
    root: config.root,
    sftpConnectionId: config.sftpConnectionId,
    sessionId: config.sessionId,
    totalBytes: config.totalBytes || 0,
    transferredBytes: 0,
    remainingTime: 0,
    elapsedTime: 0,
    createdAt: Date.now()
  }
}

/**
 * 检查传输任务是否已被取消
 * 
 * ✅ 统一版本：消除 upload.ts/download.ts 中重复的取消检查代码
 * - 用于在传输操作的关键节点检测任务是否被用户取消
 * - 支持日志记录，便于调试和追踪取消时机
 * 
 * 使用场景：
 * - 文件上传/下载开始前检查
 * - 文件夹递归处理前检查
 * - for 循环每个子节点处理前检查
 * - 进度回调中检查（停止 UI 更新）
 * - 操作完成后检查（防止状态覆盖）
 * 
 * @param taskId 任务 ID
 * @param context 日志上下文信息（如文件名、操作类型等）
 * @returns 如果任务已取消返回 true，否则返回 false
 */
export function isTaskCancelled(taskId: string, context: string = ''): boolean {
  const sftpTransferStore = useSftpTransferStore()
  
  const task = sftpTransferStore.getTask(taskId)
  const cancelled = !!task && task.status === 'cancelled'
  
  if (cancelled) {
    console.log(`[sftp] ⚠️ 任务已取消${context ? `: ${context}` : ''}`)
  }
  
  return cancelled
}

/**
 * 从子节点聚合计算文件夹节点的进度信息（统一版本）
 * 基于字节数加权计算总进度、速度、剩余时间等
 * 
 * @param node 文件夹节点
 * @returns 聚合后的进度信息
 */
export function aggregateChildProgress(node: TransferNode): {
  progress: number; completedFiles: number; speed: number;
  transferredBytes: number; totalBytes: number
} {
  if (!node.children || node.children.length === 0) {
    return {
      progress: node.status === 'completed' ? 100 : (node.progress || 0),
      completedFiles: node.status === 'completed' ? 1 : 0,
      speed: node.speed || 0,
      transferredBytes: node.status === 'completed' ? (node.size || 0) : Math.round((node.size || 0) * (node.progress || 0) / 100),
      totalBytes: node.size || 0
    }
  }

  let totalSize = 0
  let transferredSize = 0
  let activeSpeed = 0
  let completedCount = 0

  for (const child of node.children) {
    const childSize = child.size || 0
    totalSize += childSize

    if (child.isDirectory && child.children) {
      const childAgg = aggregateChildProgress(child)
      transferredSize += childAgg.transferredBytes
      if (childAgg.progress >= 100) completedCount++
      if (child.status === 'transferring') activeSpeed = childAgg.speed
    } else {
      if (child.status === 'completed') { transferredSize += childSize; completedCount++ }
      else { transferredSize += Math.round(childSize * (child.progress || 0) / 100) }
      if (child.status === 'transferring') activeSpeed = child.speed || 0
    }
  }

  return {
    progress: totalSize > 0 ? Math.round((transferredSize / totalSize) * 100) : 0,
    completedFiles: completedCount,
    speed: activeSpeed,
    transferredBytes: transferredSize,
    totalBytes: totalSize
  }
}

/**
 * 通过 parent ID 链向上传播进度到所有祖先节点（v5 优化版）
 * 
 * 利用 TransferNode.parentId 字段 + Store.getNode() 实现 O(1) 祖先链遍历，
 * 无需从根节点遍历整棵树，复杂度 O(树深度)
 * 
 * @param taskId 任务 ID
 * @param startNode 起始文件夹节点（通常是当前传输文件的直接父节点）
 * @param store Store 实例
 */
export function propagateViaParentChain(
  taskId: string,
  startNode: TransferNode,
  store: ReturnType<typeof useSftpTransferStore>
): void {
  let current: TransferNode | undefined = startNode

  while (current && current.isDirectory) {
    const agg = aggregateChildProgress(current)

    store.mutateNode(taskId, current.id, {
      progress: agg.progress,
      completedFiles: agg.completedFiles,
      speed: agg.speed,
      transferredBytes: agg.transferredBytes
    })

    // 通过 Store.getNode() O(1) 查找父节点（替代之前的 current.parent 引用）
    if (current.parentId) {
      current = store.getNode(taskId, current.parentId)
    } else {
      current = undefined
    }
  }
}
