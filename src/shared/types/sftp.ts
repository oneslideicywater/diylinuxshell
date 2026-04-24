/**
 * SFTP 传输状态相关类型定义
 */

/**
 * 传输任务状态（Task FSM，7 个状态）
 *
 * 用于整个传输任务（上传/下载/删除批次）的状态管理。
 * 包含 scanning（扫描阶段）和 transferringPartialError（部分出错）等任务级状态。
 */
export type TransferStatus = 'pending' | 'scanning' | 'transferring' | 'transferringPartialError' | 'completed' | 'error' | 'cancelled'

/**
 * 传输节点状态（Node FSM，5 个状态）
 *
 * 用于单个传输节点（文件/文件夹）的状态管理。
 * 节点无 scanning 和 transferringPartialError 状态：
 * - scanning 是任务级操作，节点由扫描结果直接创建为 pending
 * - transferringPartialError 是任务级聚合结果，单个节点只有 error（全部失败）
 */
export type NodeStatus = 'pending' | 'transferring' | 'completed' | 'error' | 'cancelled'

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
  /** 传输状态（节点级，使用 NodeStatus） */
  status: NodeStatus
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
  /** 结束时间戳（完成/失败/取消时设置，用于计算实际经过时间） */
  endTime?: number
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
  /** 传输根节点（扫描完成后设置，扫描中为 undefined） */
  root?: TransferNode
  /**
   * 扫描占位节点（仅用于 UI 展示，创建任务时设置一次）
   * 当 root 为空且任务处于 scanning 状态时，用此字段显示基础信息（name/type/localPath/remotePath）
   * 扫描完成后 root 设置后此字段不再使用
   * 含 status 字段：支持取消操作将占位节点标记为 cancelled
   */
  scanningNode?: Pick<TransferNode, 'name' | 'type' | 'localPath' | 'remotePath' | 'status'>
  /** 当前正在传输的节点 ID（对应 Pinia Store 中 TransferNode.id），用于高亮/定位活跃节点 */
  activeNodeId?: string
  
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


