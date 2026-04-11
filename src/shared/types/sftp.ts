/**
 * SFTP 传输状态相关类型定义
 */

/**
 * 传输节点状态
 */
export type TransferStatus = 'pending' | 'transferring' | 'completed' | 'error' | 'cancelled'

/**
 * 传输类型
 */
export type TransferType = 'upload' | 'download' | 'delete'

/**
 * 传输节点
 */
export interface TransferNode {
  /** 节点唯一标识 */
  id: string
  /** 节点名称（文件或文件夹名） */
  name: string
  /** 是否为文件夹 */
  isDirectory: boolean
  /** 传输类型 */
  type: TransferType
  /** 传输状态 */
  status: TransferStatus
  /** 传输进度 (0-100) */
  progress: number
  /** 文件大小（字节） */
  size: number
  /** 本地路径 */
  localPath?: string
  /** 远程路径 */
  remotePath?: string
  /** 传输速度（字节/秒） */
  speed: number
  /** 估计剩余时间 */
  remaining: string
  /** 已经过的时间 */
  elapsed: string
  /** 子节点（文件夹） */
  children?: TransferNode[]
  /** 错误信息 */
  error?: string
  /** 开始时间戳 */
  startTime?: number
  /** 展开状态（用于树形列表） */
  expanded?: boolean
  /** 总文件数（文件夹节点） */
  totalFiles?: number
  /** 已完成文件数（文件夹节点） */
  completedFiles?: number
}

/**
 * 传输任务
 */
export interface TransferTask {
  /** 任务 ID */
  id: string
  /** 任务类型 */
  type: TransferType
  /** 任务状态（符合 TransferStatus 标准） */
  status: TransferStatus
  /** 传输根节点 */
  root: TransferNode
  
  // 传输进度统计
  /** 待传输的总字节数 */
  totalBytes: number
  /** 已传输的字节数 */
  transferredBytes: number
  
  // 时间统计
  /** 还需多长时间完成传输（秒） */
  remainingTime: number
  /** 已消耗时间（秒） */
  elapsedTime: number
  
  /** 创建时间 */
  createdAt: number
  /** 完成时间 */
  completedAt?: number
}


