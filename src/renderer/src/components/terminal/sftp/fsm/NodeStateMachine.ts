import type { NodeStatus } from '@shared/types/sftp'

/**
 * SFTP 传输节点有限状态机 (Node FSM)
 *
 * 职责：定义单个传输节点（文件/文件夹）的合法状态转换规则。
 *       节点是任务树中的叶子或分支，每个节点有独立的生命周期。
 *
 * 与 Task FSM 的区别：
 * - Task FSM 管理**整个任务**的状态（含 scanning 阶段、partialError 聚合）
 * - Node FSM 管理**单个节点**的状态（无 scanning、无 partialError，粒度更细）
 * - 一个 Task 包含多个 Node，Task 状态由其所有子节点的状态聚合决定
 *
 * 节点状态流转：
 *   pending → transferring → completed / error
 *   任意非终态 → cancelled
 *
 * 使用方式：
 *   import { transferNodeFSM } from '../fsm/NodeStateMachine'
 *   if (!transferNodeFSM.canTransition('transferring', 'error')) return
 */
class NodeStateMachine {
  /** 终态集合 */
  private static readonly TERMINAL_STATUSES = new Set<NodeStatus>(['completed', 'error', 'cancelled'])

  /**
   * 合法转换 Allowlist 表（5×5）
   *
   * 合法转换矩阵：
   *   from \ to      pending  transferring  completed  error  cancelled
   *   pending          ❌        ✅           ❌        ❌      ✅
   *   transferring     ❌        ❌           ✅        ✅      ✅
   *   completed        ❌        ❌           ❌        ❌      ❌ (终态)
   *   error            ❌        ❌           ❌        ❌      ❌ (终态)
   *   cancelled        ❌        ❌           ❌        ❌      ❌ (终态)
   */
  private static readonly VALID_TRANSITIONS: Record<string, Set<string>> = {
    pending: new Set(['transferring', 'error', 'cancelled']),
    transferring: new Set(['completed', 'error', 'cancelled']),
    completed: new Set(),
    error: new Set(),
    cancelled: new Set()
  }

  /** 单例实例 */
  static readonly instance = new NodeStateMachine()

  private constructor() {}

  canTransition(currentStatus: string, targetStatus: string): boolean {
    const allowed = NodeStateMachine.VALID_TRANSITIONS[currentStatus]
    return !!allowed && allowed.has(targetStatus)
  }

  isTerminal(status: string): boolean {
    return NodeStateMachine.TERMINAL_STATUSES.has(status as NodeStatus)
  }
}

/** 导出单例 */
export const transferNodeFSM = NodeStateMachine.instance
