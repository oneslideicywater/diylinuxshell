# BUG-055: SFTP 本地删除子节点状态永远 pending（根节点已完成）

## 基本信息
- **编号**: BUG-055
- **标题**: 本地删除文件夹后，父节点显示"已完成 100%"，但所有子节点仍停留在"等待中"(pending) 状态
- **发现日期**: 2026-04-26
- **状态**: ✅ 已修复 (2026-04-26)
- **严重程度**: 高
- **影响模块**: SFTP 本地删除功能 + 树形任务列表展示
- **复现步骤**: 本地删除一个包含多个子文件/子文件夹的目录（如 `ai_completion`）

## 问题描述

执行**本地删除**一个包含子项的文件夹后：

| 节点 | 预期状态 | 实际状态 |
|------|---------|---------|
| `ai_completion/` (父文件夹) | 已完成 100% | 已完成 100% ✅ |
| `.code_contribution/` (子文件夹) | 已完成 | **等待中** ❌ |
| `.ripgrep/` (子文件夹) | 已完成 | **等待中** ❌ |
| `config.json` (子文件) | 已完成 | **等待中** ❌ |

## 控制台日志铁证

```
[delete-local] 扫描本地路径: C:\Users\onesl\.jenkins\ai_completion
🕐 mutateNode | 节点: ai_completion status: pending → transferring     ← 根节点更新了 ✅
🚫 mutateNode 节点状态机拒绝: ai_completion "transferring" → "transferring" ← 重复设置被拒
🕐 mutateNode | 节点: ai_completion status: transferring → completed   ← 根节点完成了 ✅
[delete-local] ✅ 任务 1 完成: ai_completion                              ← 任务完成了 ✅
// ⚠️ 但子节点 .code_contribution, .ripgrep, config.json 从未被更新！永远 pending ❌
```

## 根因分析

### 🔴 根本原因：`fs.rm({ recursive: true })` 一次性删除，不遍历子节点

**位置**: [sftp.ts#L435-L440](../../../main/ipc/sftp.ts#L435-L440)（主进程 IPC handler）

```typescript
// sftp:delete-local IPC handler — 整个文件夹一次性删除
if (stat.isDirectory()) {
  await fs.promises.rm(localPath, { recursive: true, force: true })  // ← 一次性删完！
}
// 进度回调只上报根节点的 nodeId
window.webContents.send('sftp:delete-local-progress', { taskId, nodeId: node.id, ... })
```

**对比远程删除**：

| 删除方式 | 实现方式 | 子节点处理 |
|---------|---------|-----------|
| 远程删除 | `deleteFolderContent()` 递归遍历每个子项 | ✅ 每个子节点都调用 `mutateNode` 更新状态 |
| **本地删除** | `fs.rm({ recursive: true })` 一次性操作 | ❌ 只上报根节点进度，子节点从未访问 |

**影响链**：
```
扫描阶段：创建完整 TransferNode 树（根 + 所有子孙节点）→ 全部 status='pending'
    ↓
执行阶段：fs.rm({recursive:true}) 一次性删除整个文件夹
    ↓
进度回调：只发 root node.id → 只有根节点被 mutateNode 更新
    ↓
完成阶段：根节点 status='completed' ✅
         子节点 status='pending'（从未改变！）❌
```

### 🟡 次要问题：重复 mutateNode 导致 Node FSM 拒绝日志

扫描阶段（L247-250）已将根节点设为 `transferring`，执行循环（原 L278）再次尝试设置 → FSM 拒绝 `transferring→transferring`。

此问题不影响功能（根节点状态正确），但产生误导性错误日志。

## 修复方案

### ✅ 已实施：Store 层 `mutateAllTaskNodes()` 批量更新（用户优化）

**修改文件**:

1. **[sftpTransfer.ts](../../../renderer/src/stores/sftpTransfer.ts)** — 新增 `mutateAllTaskNodes()` 方法
   - 通过 `nodeIndexMap` 直接遍历该任务下所有节点，批量设置状态
   - 内置 Node FSM 校验，跳过非法转换
   - 自动递增 `version.value++` 触发 UI 刷新
   - 比递归遍历树结构更高效（无函数调用栈开销）

2. **[delete.ts](../../../renderer/src/components/terminal/sftp/script/delete.ts)** — 两处调用

| 时机 | 调用 | 作用 |
|------|------|------|
| 删除前 | `mutateAllTaskNodes(task.id, 'transferring', { startTime })` | 所有节点 → transferring |
| 删除成功后 | `mutateAllTaskNodes(task.id, 'completed', { progress:100, speed:0, endTime })` | 所有节点 → completed |

**同时修复**：移除重复的根节点 `mutateNode({status:'transferring'})`（扫描阶段已设置）

## 修改文件清单

- [sftpTransfer.ts](../../../renderer/src/stores/sftpTransfer.ts)
  - 新增 `mutateAllTaskNodes()` 批量节点状态更新方法
- [delete.ts](../../../renderer/src/components/terminal/sftp/script/delete.ts)
  - 删除前调用 `mutateAllTaskNodes(root, 'transferring')`
  - 删除成功后调用 `mutateAllTaskNodes(root, 'completed')`
  - 移除重复的根节点 `mutateNode({status:'transferring'})`

## 测试验证

1. 本地删除包含多个子文件/子文件夹的目录 → 所有节点应同步变为 transferring → completed
2. 本地删除单个文件 → 正常完成（mutateAllTaskNodes 遍历该任务下所有节点）
3. 筛选器切换（待开始/传输中/已完成）→ 数量正确，无残留 pending 节点
4. 控制台不应出现 `🚫 mutateNode 节点状态机拒绝: "transferring" → "transferring"` 日志（已移除重复设置）

## 关联问题

- [BUG-054](./BUG-054-SFTP本地删除子节点pending状态不更新.md) — 同一现象的不同根因（FSM scanning 缺失 vs 子节点未遍历）
- [BUG-053](../ui/BUG-053-SFTP任务状态转换后树形列表不刷新.md) — version 未递增导致 UI 不刷新
