/**
 * 会话类型定义
 */
export interface Session {
  /** 会话ID */
  id: string
  /** 会话名称 */
  name: string
  /** 主机地址 */
  host: string
  /** 端口号 */
  port: number
  /** 用户名 */
  username: string
  /** 认证类型 */
  authType: 'password' | 'key'
  /** 密码（加密存储） */
  password?: string
  /** 密钥路径 */
  keyPath?: string
  /** 密钥密码 */
  keyPassphrase?: string
  /** 会话状态 */
  status: 'connected' | 'connecting' | 'disconnected'
  /** 所属分组ID */
  groupId?: string
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

/**
 * 会话分组类型定义
 */
export interface SessionGroup {
  /** 分组ID */
  id: string
  /** 分组名称 */
  name: string
  /** 分组图标 */
  icon?: string
  /** 排序顺序 */
  order: number
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

/**
 * 标签页类型定义
 */
export interface Tab {
  /** 标签页ID */
  id: string
  /** 标签页标题 */
  title: string
  /** 关联的会话ID */
  sessionId: string
  /** 终端进程ID */
  terminalId?: string
}

/**
 * 命令片段类型定义
 */
export interface CommandSnippet {
  /** 片段ID */
  id: string
  /** 片段名称 */
  name: string
  /** 命令内容 */
  command: string
  /** 描述 */
  description?: string
  /** 所属分组ID */
  groupId?: string
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

/**
 * 命令片段分组类型定义
 */
export interface CommandSnippetGroup {
  /** 分组ID */
  id: string
  /** 分组名称 */
  name: string
  /** 排序顺序 */
  order: number
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

/**
 * 终端配置类型定义
 */
export interface TerminalConfig {
  /** 字体大小 */
  fontSize: number
  /** 字体类型 */
  fontFamily: string
  /** 光标样式 */
  cursorStyle: 'block' | 'underline' | 'bar'
  /** 光标闪烁 */
  cursorBlink: boolean
  /** 滚动缓冲区大小 */
  scrollback: number
  /** 终端类型 */
  terminalType: string
}

/**
 * 应用配置类型定义
 */
export interface AppConfig {
  /** 主题 */
  theme: 'dark' | 'light'
  /** 语言 */
  language: string
  /** 终端配置 */
  terminal: TerminalConfig
  /** 连接超时时间 */
  connectionTimeout: number
  /** 心跳间隔 */
  keepaliveInterval: number
  /** 自动重连 */
  autoReconnect: boolean
  /** 重连次数 */
  reconnectAttempts: number
}

/**
 * 连接状态类型定义
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error'

/**
 * 终端数据类型定义
 */
export interface TerminalData {
  /** 终端ID */
  terminalId: string
  /** 数据内容 */
  data: string
}

/**
 * 终端尺寸类型定义
 */
export interface TerminalSize {
  /** 列数 */
  cols: number
  /** 行数 */
  rows: number
  /** 宽度 */
  width: number
  /** 高度 */
  height: number
}

/**
 * 文件传输项类型定义
 */
export interface FileTransferItem {
  /** 传输ID */
  id: string
  /** 本地路径 */
  localPath: string
  /** 远程路径 */
  remotePath: string
  /** 传输方向 */
  direction: 'upload' | 'download'
  /** 文件大小 */
  size: number
  /** 已传输大小 */
  transferred: number
  /** 传输状态 */
  status: 'pending' | 'transferring' | 'completed' | 'failed' | 'cancelled'
  /** 传输速度 */
  speed?: number
  /** 错误信息 */
  error?: string
}

/**
 * 历史记录类型定义
 */
export interface HistoryRecord {
  /** 记录ID */
  id: string
  /** 会话ID */
  sessionId: string
  /** 命令内容 */
  command: string
  /** 执行时间 */
  executedAt: number
}

/**
 * 日志记录类型定义
 */
export interface LogRecord {
  /** 日志ID */
  id: string
  /** 会话ID */
  sessionId: string
  /** 日志内容 */
  content: string
  /** 日志类型 */
  type: 'input' | 'output' | 'error' | 'system'
  /** 时间戳 */
  timestamp: number
}
