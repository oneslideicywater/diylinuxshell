# BUG-054: SFTP 本地删除子节点状态卡在 pending

## 基本信息
- **编号**: BUG-054
- **标题**: 执行本地删除操作时，父节点文件夹已显示"已完成"，但子节点仍停留在"等待中"(pending) 状态，且任务整体错误地显示在"待开始"列表中
- **发现日期**: 2026-04-26
- **状态**: 待修复（与 BUG-053 关联，修复 version 递增后可能部分解决）
- **严重程度**: 高
- **影响模块**: SFTP 删除功能 + 任务列表展示
- **复现步骤**: 本地删除一个包含多个子文件/子文件夹的目录

## 问题描述

执行**本地删除**一个包含子项的文件夹后：

1. 父节点（如 `logs/`）显示 **"已完成 100%"** ✅
2. 但子节点（如 `tasks/`、`Download metadata.log`）仍显示 **"等待中"** ❌
3. 整个任务出现在 **"待开始"** 筛选器中（而非"已完成"）❌

### 错误现象截图

| 节点 | 预期状态 | 实际状态 |
|------|---------|---------|
| `logs/` (父文件夹) | 已完成 100% | 已完成 100% ✅ |
| `tasks/` (子文件夹) | 已完成 | **等待中** ❌ |
| `Download metadata.log` (子文件) | 已完成 | **等待中** ❌ |
| 任务在筛选器中的位置 | 已完成 | **待开始** ❌ |

## 根因分析

### 🔴 原因一：与 BUG-053 关联 — version 未递增导致 UI 不刷新

当 `deleteSingleItem` 完成子节点删除时：

```typescript
// deleteSingleItem 中（正确地更新了节点状态）
sftpTransferStore.mutateNode(taskId, node.id, {
  status: 'completed',     // ← 节点状态确实变为 completed
  progress: 100,
  // ...
})
```

但此时 `updateTaskStatus(taskId, 'completed')` 被调用时：
- **之前**（BUG-053）：未递增 `version.value++` → UI 组件的 computed 不重算 → 显示旧数据
- **修复后**（BUG-053 fix）：已添加 `version.value++` → 应能正常刷新

> ⚠️ 此原因已在 [BUG-053](./BUG-053-SFTP任务状态转换后树形列表不刷新.md) 中修复。

### 🟡 原因二（需进一步确认）：子节点的 mutateNode 是否被正确调用？

从截图来看，子节点显示"等待中"意味着它们的 `status` 字段仍然是初始值 `pending`。

需要检查的调用链：

```
deleteFolderContent(父节点)
  ├── mutateNode(父节点, { status: 'transferring' })   ← ✅ 父节点更新了
  ├── for child of children:
  │     └── deleteFolderContent(child)                  ← 递归子节点
  │           └── deleteSingleItem(child)               ← 子节点走这里？
  │                 ├── mutateNode(child, { status: 'transferring' })
  │                 └── mutateNode(child, { status: 'completed' })
  └── deleteSingleItem(父节点)                          ← 最后删父节点本身
        └── mutateNode(父节点, { status: 'completed' }) ← ✅ 父节点完成了
```

**关键问题**：如果子节点走了 `else if (node.isDirectory)` 或 `else if (!node.isDirectory)` 分支（非递归分支），它们会直接进入 `deleteSingleItem`，应该也会更新状态。但需要确认是否所有路径都覆盖到了。

### 可能的场景

| 场景 | 子节点路径 | 是否经过 deleteSingleItem | 状态是否更新 |
|------|-----------|------------------------|------------|
| 文件夹有子节点 | `if (children.length > 0)` | 递归后再调 | ✅ 应该更新 |
| 空目录 | `else if (isDirectory)` | 直接调 | ✅ 应该更新 |
| 单文件 | `else if (!isDirectory)` | 直接调 | ✅ 应该更新 |

**如果所有场景都经过 `deleteSingleItem` 且 `mutateNode` 正常工作，则问题纯粹是 BUG-053 的 UI 刷新延迟。**

## 修复方案

### 方案 A（首选）：BUG-053 修复后验证

先应用 BUG-053 的修复（`updateTaskStatus` 添加 `version.value++`），然后重新测试本地删除：

1. 如果子节点状态正确刷新 → BUG-054 可关闭（根因就是 BUG-053）
2. 如果仍有问题 → 进入方案 B

### 方案 B（备选）：确认子节点 mutateNode 调用链

在 `deleteSingleItem` 入口和出口加日志，确认每个子节点都经过了完整的 mutating→completed 流程：

```typescript
async function deleteSingleItem(node, sftpConnectionId, taskId) {
  console.log(`[delete] 🔵 deleteSingleItem 入口: ${node.name} (当前status=${node.status})`)
  
  // ... existing code ...
  
  // 成功路径
  console.log(`[delete] 🟢 deleteSingleItem 完成: ${node.name} → status=completed`)
  
  // 失败路径
  console.error(`[delete] 🔴 deleteSingleItem 失败: ${node.name} → status=error`)
}
```

## 修改文件

- [sftpTransfer.ts](../../renderer/src/stores/sftpTransfer.ts) — BUG-053 修复（已实施）
- [delete.ts](../../renderer/src/components/terminal/sftp/script/delete.ts) — 如方案 B 需要调试日志

## 测试验证

1. 本地删除含多个子文件的文件夹 → 所有子节点应显示"已完成"
2. 本地删除嵌套文件夹（如 `logs/tasks/Download metadata.log`）→ 三层节点全部完成
3. 任务不应出现在"待开始"列表中（应在"已完成"）
4. 切换各筛选器 → 数量一致

## 关联 Bug

- [BUG-053](./BUG-053-SFTP任务状态转换后树形列表不刷新.md)：version 未递增导致 UI 不刷新（根因之一）
