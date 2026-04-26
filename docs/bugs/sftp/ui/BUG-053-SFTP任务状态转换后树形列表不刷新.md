# BUG-053: SFTP 任务状态转换后树形列表不刷新

## 基本信息
- **编号**: BUG-053
- **标题**: 任务状态转换（如 transferring→completed）后，树形任务列表不刷新，已完成任务仍显示在"传输中"列表中
- **发现日期**: 2026-04-26
- **状态**: ✅ 已修复 (2026-04-26)
- **严重程度**: 高
- **影响模块**: SFTP 任务列表展示（全局，影响上传/下载/删除）
- **复现步骤**: 批量下载多个文件/文件夹

## 问题描述

当任务状态发生转换时（如从 `transferring` 变为 `completed`），树形任务列表不会自动刷新：

1. 用户执行批量下载（如下载 3 个文件夹）
2. 所有任务完成后，节点显示"已删除/已完成 100%"
3. 但切换到"传输中"筛选器 → 显示 **2 个** 已完成的任务（应该为 0）
4. 切换到"已完成"筛选器 → 显示 **7/100** 个任务（数量可能不正确）

### 错误现象截图

| 筛选器 | 预期 | 实际 |
|--------|------|------|
| 已完成 | 显示所有已完成任务 | 显示部分（如 7/100）|
| 传输中 | 0 | **显示已完成任务**（如 2 个）|

## 根因分析

### 🔴 根本原因：`updateTaskStatus` 未递增 `version` 字段

[sftpTransfer.ts](../../renderer/src/stores/sftpTransfer.ts) 中有两个更新路径：

```
路径 A: mutateNode() ──→ version.value++ ✅ （节点属性变更时递增）
路径 B: updateTaskStatus() → updateTask() → Object.assign ❌ （未递增 version！）
```

**关键代码对比**：

```typescript
// 路径 A：mutateNode — 有 version 递增
function mutateNode(taskId, nodeId, updates) {
  version.value++                    // ← ✅ 触发所有依赖 version 的 computed 重算
  // ... 更新节点 ...
}

// 路径 B：updateTaskStatus → updateTask — 无 version 递增
function updateTaskStatus(taskId, status) {
  if (!shouldAllowTransition(taskId, status)) return
  updateTask(taskId, { status })     // ← 调用 updateTask
}

function updateTask(taskId, updates) {
  if ('status' in updates) { /* 拒绝 */ return }
  const task = transferTasks.value.find(t => t.id === taskId)
  Object.assign(task, updates)       // ← ❌ 没有版本号递增！
}
```

### 为什么会导致 UI 不刷新？

[SftpTransferTreeNode.vue](../../renderer/src/components/terminal/sftp/status/SftpTransferTreeNode.vue) 的 computed 属性**显式依赖 `store.version`**：

```typescript
// 组件中的多个 computed 都依赖 version
const progress = computed(() => {
  void sftpTransferStore.version      // ← 显式依赖，确保 mutateNode 后重算
  // ... 计算 progress ...
})

const speed = computed(() => {
  void sftpTransferStore.version      // ← 同上
  // ... 计算 speed ...
})
```

**数据流断裂**：

```
任务完成: updateTaskStatus('completed')
    ↓
  updateTask({ status: 'completed' })
    ↓
  Object.assign(task, { status: 'completed' })  ← task 对象确实更新了
    ↓
  ❌ version 没有变化！
    ↓
  SftpTransferTreeNode 的 computed 不重算
    ↓
  UI 仍显示旧状态（transferring）→ 任务卡在"传输中"列表
```

### 影响范围

此 bug 影响**所有涉及任务状态转换的场景**：

| 操作 | 状态转换 | 是否受影响 |
|------|---------|-----------|
| 下载完成 | transferring → completed | ✅ 是 |
| 上传完成 | transferring → completed | ✅ 是 |
| 删除完成 | transferring → completed | ✅ 是 |
| 取消任务 | transferring/scanning → cancelled | ✅ 可能是 |
| 任务出错 | any → error | ✅ 可能是 |

## 修复方案

**在 `updateTask()` 或 `updateTaskStatus()` 中添加 `version.value++`**：

```typescript
// 方案 A：在 updateTask 中递增（推荐，覆盖所有非状态字段更新）
function updateTask(taskId: string, updates: Partial<TransferTask>): void {
  if ('status' in updates) { /* 拒绝 */ return }
  
  const task = transferTasks.value.find(t => t.id === taskId)
  if (!task) return
  
  Object.assign(task, updates)
  
  // 递增版本号 → 触发依赖 version 的 computed 重算（与 mutateNode 保持一致）
  version.value++
}

// 方案 B：在 updateTaskStatus 中递增（仅覆盖状态变更）
function updateTaskStatus(taskId: string, status: TransferTask['status']): void {
  if (!shouldAllowTransition(taskId, status)) return
  updateTask(taskId, { status })
  version.value++  // ← 状态变更也触发版本递增
}
```

> **推荐方案 A**：因为 `updateTask` 是统一入口，无论更新的是 status 还是其他字段，都应该触发版本递增。但需要注意 `updateTaskStatus` 内部调用 `updateTask` 时会经过 FSM 守卫拒绝 status 字段，所以需要在 `updateTaskStatus` 中单独处理。

**最终建议**：在 `updateTaskStatus` 中递增 version，因为：
1. `updateTask` 已经禁止传入 status
2. `updateTaskStatus` 是唯一合法的状态修改入口
3. 与 `mutateNode` 的设计保持对称（节点状态变更是 mutateNode 递增，任务状态变更是 updateTaskStatus 递增）

## 修改文件

- [sftpTransfer.ts](../../renderer/src/stores/sftpTransfer.ts)
  - `updateTaskStatus()`: 添加 `version.value++`

## 测试验证

1. 批量下载 3+ 个文件夹 → 全部完成后验证"传输中"列表为空
2. 批量上传多个文件 → 验证同上
3. 删除单个文件 → 验证待开始→0、已完成→1
4. 取消正在进行的任务 → 验证任务从"传输中"移到"已取消"
5. 切换各筛选器（待开始/扫描中/传输中/已完成/错误/已取消）→ 数量正确
