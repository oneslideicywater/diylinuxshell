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
    remaining: '',
    elapsed: ''
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
