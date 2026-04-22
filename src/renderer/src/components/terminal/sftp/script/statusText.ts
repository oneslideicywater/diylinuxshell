/**
 * SFTP 传输状态文本工具
 * 根据任务类型和状态返回对应的显示文案
 * 删除任务显示"已删除/删除中"，其他任务显示"已完成/传输中"
 * @module sftp/script/statusText
 */

import type { TransferType, TransferStatus } from '@shared/types/sftp'

/** 状态文本映射表（通用） */
const STATUS_TEXT_MAP: Record<TransferStatus, string> = {
  pending: '等待中',
  scanning: '扫描中',
  transferring: '传输中',
  completed: '已完成',
  error: '错误',
  cancelled: '已取消'
}

/** 删除任务专用状态文本映射表 */
const DELETE_STATUS_TEXT_MAP: Record<TransferStatus, string> = {
  pending: '等待中',
  scanning: '扫描中',
  transferring: '删除中',
  completed: '已删除',
  error: '错误',
  cancelled: '已取消'
}

/**
 * 获取状态显示文本
 * @param taskType 任务类型（upload / download / delete）
 * @param status 当前状态
 * @returns 对应的中文状态文本
 */
export function getStatusText(taskType: TransferType, status: TransferStatus): string {
  if (taskType === 'delete') {
    return DELETE_STATUS_TEXT_MAP[status] || status
  }
  return STATUS_TEXT_MAP[status] || status
}
