/**
 * SFTP 传输状态相关类型定义
 */

/**
 * 传输节点状态
 */
export type TransferStatus = 'pending' | 'scanning' | 'transferring' | 'completed' | 'error' | 'cancelled'

/**
 * 传输类型
 */
export type TransferType = 'upload' | 'download' | 'delete'

/**
 * 传输节点
 * 
 * 设计原则（v5 优化）：
 * - 使用 parentId 字符串代替 parent 对象引用
 * - 消除循环引用，使 TransferNode 可通过 IPC 序列化传输
 * - 父节点通过 Store 的 nodeIndexMap O(1) 查找（getNode(taskId, parentId)）
 */
export interface TransferNode {
  /** 节点唯一标识 */
  id: string
  /** 父节点 ID（用于祖先链传播，通过 Store.getNode() O(1) 查找父节点） */
  parentId?: string
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
  /** 已传输字节数 */
  transferredBytes: number
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
 * 
 * 设计原则（安全架构 v3）：
 * - 任务按 SFTP 连接隔离：每个连接有独立的任务列表
 * - 通过 sftpConnectionId 关联到具体的 SFTP 连接
 * - 通过 sessionId 可选关联会话信息（用于显示）
 * - 不存储任何敏感信息（密码等完全由主进程管理）
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
  
  // 连接标识（用于隔离不同 SFTP 连接的任务）
  /**
   * SFTP 连接标识符（每个标签页独立）
   * 对应 Tab.sftpConnectionId 和主进程 sftpPool 的 key
   * 用于将任务归属到正确的 SFTP 连接
   */
  sftpConnectionId: string
  
  /**
   * 会话 ID（可选，用于关联会话信息）
   * 可通过 SessionStore 获取会话名称、主机地址等非敏感信息
   * 主要用于 UI 显示和日志记录
   */
  sessionId?: string
  
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


