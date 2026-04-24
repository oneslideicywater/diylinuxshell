/**
 * SFTP 状态机单元测试（Task FSM + Node FSM）
 *
 * 测试场景：
 * 1. Task FSM（7 状态）— 任务级合法转换矩阵验证
 * 2. Task FSM 终态保护 — completed/error/cancelled 不可再变更
 * 3. Task FSM 核心规则 — pending→transferring 被禁止、partialError→completed 被禁止
 * 4. Node FSM（5 状态）— 节点级合法转换矩阵验证
 * 5. Node FSM 终态保护 — completed/error/cancelled 不可再变更
 * 6. isTerminal 方法正确性
 */

import { describe, it, expect } from 'vitest'
import { transferTaskFSM } from '../TaskStateMachine'
import { transferNodeFSM } from '../NodeStateMachine'

// ============================================================
// 一、Task FSM 测试（7 个状态）
// ============================================================

describe('TaskStateMachine (Task FSM)', () => {

  // --- 1. 正常生命周期路径 ---

  describe('正常生命周期：pending → scanning → transferring → completed', () => {
    it('pending → scanning ✅', () => {
      expect(transferTaskFSM.canTransition('pending', 'scanning')).toBe(true)
    })

    it('scanning → transferring ✅', () => {
      expect(transferTaskFSM.canTransition('scanning', 'transferring')).toBe(true)
    })

    it('transferring → completed ✅', () => {
      expect(transferTaskFSM.canTransition('transferring', 'completed')).toBe(true)
    })

    it('完整路径 pending→scanning→transferring→completed 全部合法', () => {
      expect(transferTaskFSM.canTransition('pending', 'scanning')).toBe(true)
      expect(transferTaskFSM.canTransition('scanning', 'transferring')).toBe(true)
      expect(transferTaskFSM.canTransition('transferring', 'completed')).toBe(true)
    })
  })

  // --- 2. 核心规则：禁止跳过扫描 ---

  describe('核心规则：pending → transferring 被禁止（必须经过 scanning）', () => {
    it('pending → transferring ❌', () => {
      expect(transferTaskFSM.canTransition('pending', 'transferring')).toBe(false)
    })
  })

  // --- 3. 错误路径 ---

  describe('错误路径', () => {
    it('scanning → error ✅（扫描失败）', () => {
      expect(transferTaskFSM.canTransition('scanning', 'error')).toBe(true)
    })

    it('transferring → error ✅（全部传输出错）', () => {
      expect(transferTaskFSM.canTransition('transferring', 'error')).toBe(true)
    })

    it('transferring → transferringPartialError ✅（部分出错）', () => {
      expect(transferTaskFSM.canTransition('transferring', 'transferringPartialError')).toBe(true)
    })

    it('transferringPartialError → error ✅（最终全部失败）', () => {
      expect(transferTaskFSM.canTransition('transferringPartialError', 'error')).toBe(true)
    })
  })

  // --- 4. partialError 核心规则 ---

  describe('transferringPartialError 规则：不可到达 completed', () => {
    it('transferringPartialError → completed ❌（已有失败记录，不算全部成功）', () => {
      expect(transferTaskFSM.canTransition('transferringPartialError', 'completed')).toBe(false)
    })

    it('transferringPartialError → transferringPartialError ✅（累积更多错误）', () => {
      expect(transferTaskFSM.canTransition('transferringPartialError', 'transferringPartialError')).toBe(true)
    })
  })

  // --- 5. 取消路径 ---

  describe('取消路径（任意非终态 → cancelled）', () => {
    it('pending → cancelled ✅', () => {
      expect(transferTaskFSM.canTransition('pending', 'cancelled')).toBe(true)
    })

    it('scanning → cancelled ✅', () => {
      expect(transferTaskFSM.canTransition('scanning', 'cancelled')).toBe(true)
    })

    it('transferring → cancelled ✅', () => {
      expect(transferTaskFSM.canTransition('transferring', 'cancelled')).toBe(true)
    })

    it('transferringPartialError → cancelled ✅', () => {
      expect(transferTaskFSM.canTransition('transferringPartialError', 'cancelled')).toBe(true)
    })
  })

  // --- 6. 终态保护 ---

  describe('终态保护：进入终态后不可再变更', () => {
    it('completed → transferring ❌', () => {
      expect(transferTaskFSM.canTransition('completed', 'transferring')).toBe(false)
    })

    it('completed → error ❌', () => {
      expect(transferTaskFSM.canTransition('completed', 'error')).toBe(false)
    })

    it('completed → cancelled ❌', () => {
      expect(transferTaskFSM.canTransition('completed', 'cancelled')).toBe(false)
    })

    it('error → transferring ❌', () => {
      expect(transferTaskFSM.canTransition('error', 'transferring')).toBe(false)
    })

    it('error → cancelled ❌（error 是真正终态，不可取消）', () => {
      expect(transferTaskFSM.canTransition('error', 'cancelled')).toBe(false)
    })

    it('cancelled → transferring ❌', () => {
      expect(transferTaskFSM.canTransition('cancelled', 'transferring')).toBe(false)
    })

    it('cancelled → completed ❌（取消后异步回调不可覆盖为完成）', () => {
      expect(transferTaskFSM.canTransition('cancelled', 'completed')).toBe(false)
    })
  })

  // --- 7. 非法自转换（非 partialError 中间态不允许自转） ---

  describe('非法自转换', () => {
    it('pending → pending ❌', () => {
      expect(transferTaskFSM.canTransition('pending', 'pending')).toBe(false)
    })

    it('scanning → scanning ❌', () => {
      expect(transferTaskFSM.canTransition('scanning', 'scanning')).toBe(false)
    })

    it('transferring → transferring ❌', () => {
      expect(transferTaskFSM.canTransition('transferring', 'transferring')).toBe(false)
    })
  })

  // --- 8. isTerminal ---

  describe('isTerminal 方法', () => {
    it('completed 是终态', () => {
      expect(transferTaskFSM.isTerminal('completed')).toBe(true)
    })

    it('error 是终态', () => {
      expect(transferTaskFSM.isTerminal('error')).toBe(true)
    })

    it('cancelled 是终态', () => {
      expect(transferTaskFSM.isTerminal('cancelled')).toBe(true)
    })

    it('pending 不是终态', () => {
      expect(transferTaskFSM.isTerminal('pending')).toBe(false)
    })

    it('scanning 不是终态', () => {
      expect(transferTaskFSM.isTerminal('scanning')).toBe(false)
    })

    it('transferring 不是终态', () => {
      expect(transferTaskFSM.isTerminal('transferring')).toBe(false)
    })

    it('transferringPartialError 不是终态', () => {
      expect(transferTaskFSM.isTerminal('transferringPartialError')).toBe(false)
    })
  })
})

// ============================================================
// 二、Node FSM 测试（5 个状态）
// ============================================================

describe('NodeStateMachine (Node FSM)', () => {

  // --- 1. 正常生命周期路径 ---

  describe('正常生命周期：pending → transferring → completed', () => {
    it('pending → transferring ✅', () => {
      expect(transferNodeFSM.canTransition('pending', 'transferring')).toBe(true)
    })

    it('transferring → completed ✅', () => {
      expect(transferNodeFSM.canTransition('transferring', 'completed')).toBe(true)
    })

    it('完整路径 pending→transferring→completed 全部合法', () => {
      expect(transferNodeFSM.canTransition('pending', 'transferring')).toBe(true)
      expect(transferNodeFSM.canTransition('transferring', 'completed')).toBe(true)
    })
  })

  // --- 2. 错误路径 ---

  describe('错误路径', () => {
    it('pending → error ✅（传输前校验失败）', () => {
      expect(transferNodeFSM.canTransition('pending', 'error')).toBe(true)
    })

    it('transferring → error ✅（传输出错）', () => {
      expect(transferNodeFSM.canTransition('transferring', 'error')).toBe(true)
    })
  })

  // --- 3. 取消路径 ---

  describe('取消路径（任意非终态 → cancelled）', () => {
    it('pending → cancelled ✅', () => {
      expect(transferNodeFSM.canTransition('pending', 'cancelled')).toBe(true)
    })

    it('transferring → cancelled ✅', () => {
      expect(transferNodeFSM.canTransition('transferring', 'cancelled')).toBe(true)
    })
  })

  // --- 4. 终态保护 ---

  describe('终态保护：进入终态后不可再变更', () => {
    it('completed → transferring ❌', () => {
      expect(transferNodeFSM.canTransition('completed', 'transferring')).toBe(false)
    })

    it('completed → error ❌', () => {
      expect(transferNodeFSM.canTransition('completed', 'error')).toBe(false)
    })

    it('completed → cancelled ❌', () => {
      expect(transferNodeFSM.canTransition('completed', 'cancelled')).toBe(false)
    })

    it('error → transferring ❌', () => {
      expect(transferNodeFSM.canTransition('error', 'transferring')).toBe(false)
    })

    it('error → cancelled ❌', () => {
      expect(transferNodeFSM.canTransition('error', 'cancelled')).toBe(false)
    })

    it('cancelled → transferring ❌', () => {
      expect(transferNodeFSM.canTransition('cancelled', 'transferring')).toBe(false)
    })

    it('cancelled → completed ❌（取消后异步回调不可覆盖为完成 — BUG-021 防护）', () => {
      expect(transferNodeFSM.canTransition('cancelled', 'completed')).toBe(false)
    })
  })

  // --- 5. 非法转换 ---

  describe('非法转换', () => {
    it('pending → completed ❌（不能跳过 transferring 直接完成）', () => {
      expect(transferNodeFSM.canTransition('pending', 'completed')).toBe(false)
    })

    it('pending → pending ❌（自转非法）', () => {
      expect(transferNodeFSM.canTransition('pending', 'pending')).toBe(false)
    })

    it('transferring → transferring ❌（自转非法）', () => {
      expect(transferNodeFSM.canTransition('transferring', 'transferring')).toBe(false)
    })

    it('transferring → pending ❌（不能回退）', () => {
      expect(transferNodeFSM.canTransition('transferring', 'pending')).toBe(false)
    })
  })

  // --- 6. Node FSM 不包含 Task 独有状态 ---

  describe('Node FSM 不含 Task 独有状态（scanning / transferringPartialError）', () => {
    /**
     * 注意：canTransition 接受 string 参数，即使传入 scanning 也不会报类型错误，
     * 但应返回 false 因为 VALID_TRANSITIONS 表中无此 key 或无对应目标。
     *
     * 这里验证的是语义层面：节点不应进入 scanning / transferringPartialError。
     */
    it('pending → scanning 在 Node FSM 中不合法（scanning 是任务级状态）', () => {
      expect(transferNodeFSM.canTransition('pending', 'scanning')).toBe(false)
    })

    it('transferring → transferringPartialError 在 Node FSM 中不合法（partialError 是任务级聚合）', () => {
      expect(transferNodeFSM.canTransition('transferring', 'transferringPartialError')).toBe(false)
    })
  })

  // --- 7. isTerminal ---

  describe('isTerminal 方法', () => {
    it('completed 是终态', () => {
      expect(transferNodeFSM.isTerminal('completed')).toBe(true)
    })

    it('error 是终态', () => {
      expect(transferNodeFSM.isTerminal('error')).toBe(true)
    })

    it('cancelled 是终态', () => {
      expect(transferNodeFSM.isTerminal('cancelled')).toBe(true)
    })

    it('pending 不是终态', () => {
      expect(transferNodeFSM.isTerminal('pending')).toBe(false)
    })

    it('transferring 不是终态', () => {
      expect(transferNodeFSM.isTerminal('transferring')).toBe(false)
    })
  })
})
