import type { TransferStatus } from '@shared/types/sftp'

/**
 * SFTP 传输任务有限状态机 (Task FSM)
 *
 * 职责：定义传输任务（Task）的合法状态转换规则，防止异步竞态导致非法状态覆盖。
 *       典型场景：用户取消任务后，后台异步回调不应将 cancelled 覆盖为 completed。
 *
 * 状态流转生命周期（强制三阶段 + 错误分级）：
 *   所有任务都必须经过 scanning → transferring，不允许 pending → transferring。
 *   一旦进入 transferringPartialError（部分出错），最终只能到 error 或 cancelled，
 *   不可到达 completed（因为已有文件失败，不算"全部成功"）。
 *
 * 使用方式：
 *   import { transferTaskFSM } from '../fsm/TaskStateMachine'
 *   if (!transferTaskFSM.canTransition('cancelled', 'completed')) return // 拒绝非法转换
 */
class TaskStateMachine {
  /** 终态集合：进入后不可再变更 */
  private static readonly TERMINAL_STATUSES = new Set<TransferStatus>(['completed', 'error', 'cancelled'])

  /**
   * 合法转换 Allowlist 表（7×7）
   *
   * 核心规则：
   * 1. 所有任务必须经过 scanning 才能到达 transferring，不允许 pending → transferring
   * 2. error 为终态（代表全部失败），不可再转为其他状态
   * 3. transferringPartialError 为中间态，一旦进入则不可到达 completed
   */
  private static readonly VALID_TRANSITIONS: Record<string, Set<string>> = {
    pending: new Set(['scanning', 'error', 'cancelled']),
    scanning: new Set(['transferring', 'error', 'cancelled']),
    transferring: new Set(['transferringPartialError', 'completed', 'error', 'cancelled']),
    transferringPartialError: new Set(['transferringPartialError', 'error', 'cancelled']),
    completed: new Set(),
    error: new Set(),
    cancelled: new Set()
  }

  /** 单例实例 */
  static readonly instance = new TaskStateMachine()

  private constructor() {}

  canTransition(currentStatus: string, targetStatus: string): boolean {
    const allowed = TaskStateMachine.VALID_TRANSITIONS[currentStatus]
    return !!allowed && allowed.has(targetStatus)
  }

  isTerminal(status: string): boolean {
    return TaskStateMachine.TERMINAL_STATUSES.has(status as TransferStatus)
  }
}

/** 导出单例，外部直接使用 */
export const transferTaskFSM = TaskStateMachine.instance
