# BUG-048: SFTP 删除任务无法中途取消

## 基本信息
- **编号**: BUG-048
- **标题**: SFTP 删除循环中缺少取消检查，无法中途停止删除
- **发现日期**: 2026-04-25
- **状态**: 已修复
- **严重程度**: 高
- **影响模块**: SFTP 删除功能
- **来源文档**: [sftp-logic-correctness.md#问题6](../../src/main/services/__problem__/sftp-logic-correctness.md)

## 问题描述

用户点击"取消"按钮后，删除操作仍然继续执行，无法中途停止。这是因为 `deleteFolderContent` 的递归子节点遍历循环中没有检查 `isTaskCancelled()`。

### 错误现象

1. 用户选择包含多个文件/文件夹的目录进行删除
2. 删除过程中用户点击"取消"按钮
3. 系统显示"已取消"，但后台仍在继续删除剩余文件
4. 无法通过 UI 中断已发起的删除操作

### 根因分析

**问题代码** ([delete.ts deleteFolderContent](../../src/renderer/src/components/terminal/sftp/script/delete.ts)):
```typescript
for (const child of node.children) {
  await deleteFolderContent(child, sftpConnectionId, taskId)
  // ← 缺少 isTaskCancelled() 检查！
}
```

### 对比其他模块（正确实现）

**upload.ts** ([uploadFolderContent](../../src/renderer/src/components/terminal/sftp/script/upload.ts)):
```typescript
for (const child of node.children) {
  if (isTaskCancelled(taskId)) { break }  // ✓ 有取消检查
  await uploadFolderContent(child, sftpConnectionId, taskId)
}
```

**download.ts** ([downloadFolderContent](../../src/renderer/src/components/terminal/sftp/script/download.ts)):
```typescript
for (const child of node.children) {
  if (isTaskCancelled(taskId, `停止下载剩余子节点: ${node.name}`)) { break }  // ✓ 有取消检查
  await downloadFolderContent(child, sftpConnectionId, taskId)
}
```

## 修复方案

在删除循环的每次迭代前添加取消检查：

```typescript
for (const child of node.children) {
  // 检查任务是否已被取消（与 upload/download 保持一致的取消机制）
  if (isTaskCancelled(taskId, `停止删除剩余子项: ${node.name}`)) {
    break
  }
  
  await deleteFolderContent(child, sftpConnectionId, taskId)
}
```

## 修改文件

- [delete.ts](../../src/renderer/src/components/terminal/sftp/script/delete.ts) - `deleteFolderContent` 函数，在 for 循环中添加 `isTaskCancelled()` 检查

## 测试验证

1. 删除包含多个文件的文件夹 → 验证功能正常
2. 删除过程中点击取消 → 验证立即停止，不再删除剩余文件
3. 取消后检查远程服务器 → 验证未删除的文件仍然存在
