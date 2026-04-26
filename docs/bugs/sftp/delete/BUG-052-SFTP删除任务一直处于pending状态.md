# BUG-052: SFTP 删除任务一直处于 pending 状态

## 基本信息
- **编号**: BUG-052
- **标题**: SFTP 删除任务状态永远停在 `pending`，被 FSM 状态机拒绝转换
- **发现日期**: 2026-04-25
- **状态**: 已修复
- **严重程度**: 高
- **影响模块**: SFTP 删除功能（任务状态管理）
- **来源文档**: [sftp-logic-correctness.md#问题9](../../src/main/services/__problem__/sftp-logic-correctness.md)

## 问题描述

删除远程**任何内容**（单文件/空目录/文件夹）时，任务状态始终停留在 `pending`（待开始），UI 显示"待开始: 1"，但已完成列表里却显示已完成的任务。

### 错误现象

1. 用户右键删除远程单个文件
2. 文件被成功删除，节点显示"已删除 100%"
3. 但任务面板统计：**待开始: 1，已完成: 0**
4. 已完成列表中能看到该任务（数据不一致）

### 受影响场景

| 删除对象 | 修复前 | 修复后 |
|---------|--------|--------|
| 单文件 | `pending` ❌ 卡住 | `pending → scanning → transferring → completed` ✅ |
| 空目录 | `pending` ❌ 卡住 | 同上 ✅ |
| 文件夹（有子节点）| `pending` ❌ 卡住 | 同上 ✅ |

## 根因分析

### 🔴 根本原因：FSM 状态机拒绝非法转换

[TaskStateMachine.ts](../../renderer/src/components/terminal/sftp/fsm/TaskStateMachine.ts) 定义了合法的状态转换表：

```typescript
// FSM 合法转换表（7×7）
private static readonly VALID_TRANSITIONS = {
  pending: new Set(['scanning', 'error', 'cancelled']),     // ← 没有 transferring！
  scanning: new Set(['transferring', 'error', 'cancelled']), // scanning 才能 → transferring
  transferring: new Set([..., 'completed', ...]),
  // ...
}
```

**核心规则：所有任务必须经过 `scanning` 才能到达 `transferring`**

### 删除逻辑的错误流程 vs 正确流程

```
❌ 删除逻辑（错误）:
  createTransferTask → status='pending'
  addTask
  scanRemoteTree()        ← 扫描阶段没有设置 scanning 状态！
  ┌─────────────────────────────────────────┐
  │ updateTaskStatus('transferring')         │
  │ shouldAllowTransition('pending','transferring') │
  │ → FSM 拒绝！返回 false                  │
  │ → 状态保持 pending 不变                 │
  └─────────────────────────────────────────┘
  deleteFolderContent()
  updateTask({ status: 'completed' })  // 同样被 FSM 拒绝！

✅ 下载逻辑（正确）:
  createTransferTask → status='pending'
  addTask
  updateTaskStatus('scanning')    ← 先转 scanning ✅
  scanRemoteTree()
  updateTaskStatus('transferring')  ← scanning → transferring ✅
  downloadFiles()
  updateTask({ status: 'completed' })  → transferring → completed ✅
```

### 次要原因（之前误判的表面问题）

虽然添加了 `updateTaskStatus(task.id, 'transferring')` 调用，但由于 FSM 拒绝，这些调用实际无效。真正缺少的是**扫描前的 `scanning` 状态**。

## 修复方案

在扫描开始前添加 `scanning` 状态，遵循 FSM 的三阶段流转：

```typescript
// 修复后：完整的合法状态流转
// 1. 创建任务（默认 pending）
const task = createTransferTask({ type: 'delete', ... })
sftpTransferStore.addTask(task)

// 2. pending → scanning（新增！扫描开始前）
sftpTransferStore.updateTaskStatus(task.id, 'scanning')

// 3. 执行扫描
const scanResult = await window.api.sftp.scanRemoteTree(...)

// 4. scanning → transferring（已有，现在能正常工作）
sftpTransferStore.updateTaskStatus(task.id, 'transferring')

// 5. 执行删除...
await deleteFolderContent(...)

// 6. transferring → completed（已有，现在能正常工作）
sftpTransferStore.updateTask(task.id, { status: 'completed' })
```

## 修改文件

- [delete.ts](../../renderer/src/components/terminal/sftp/script/delete.ts)
  - **L407** (文件夹分支): 扫描前添加 `updateTaskStatus(task.id, 'scanning')`
  - **L468** (单文件分支): 扫描前添加 `updateTaskStatus(task.id, 'scanning')`
  - L426 (文件夹分支): 扫描后 `updateTaskStatus(task.id, 'transferring')` — 原有
  - L477 (单文件分支): 扫描后 `updateTaskStatus(task.id, 'transferring')` — 原有
  - L167-L179 (`deleteFolderContent`): 空目录/单文件分支安全检查 — 原有

## 测试验证

1. 删除单个远程文件 → 验证：待开始→0，已完成→1，状态流转正确
2. 删除空目录 → 验证同上
3. 删除有内容的文件夹 → 验证同上
4. 批量删除混合内容 → 验证所有任务状态正确
5. 取消正在扫描的任务 → 验证 `scanning → cancelled` 正常
