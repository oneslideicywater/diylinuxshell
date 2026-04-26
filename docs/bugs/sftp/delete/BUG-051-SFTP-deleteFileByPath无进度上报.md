# BUG-051: SFTP deleteFileByPath 回退路径无进度上报

## 基本信息
- **编号**: BUG-051
- **标题**: SFTP 删除回退路径（deleteFileByPath）没有调用 onProgress，前端收不到进度更新
- **发现日期**: 2026-04-25
- **状态**: 已修复
- **严重程度**: 中
- **影响模块**: SFTP 删除功能（回退路径）
- **来源文档**: [sftp-logic-correctness.md#问题8](../../src/main/services/__problem__/sftp-logic-correctness.md)

## 问题描述

当子节点不在 TransferNode 树中时，`deleteFile` 会回退到 `deleteFileByPath` 方法进行删除。但该方法**完全没有调用 `onProgress`**，导致：

1. 前端收不到任何进度更新
2. 父节点进度条卡住不动
3. 用户无法感知删除进度

### 触发场景

`deleteFileByPath` 在以下情况被调用：
- 扫描目录树后，其他进程新建了文件/文件夹
- 扫描时因权限不足跳过了某些隐藏文件
- 符号链接等特殊文件类型未被收录到树中

### 错误现象

1. 用户删除包含异常文件的远程目录
2. 正常子项的进度正常更新
3. 遇到不在树中的子项时，走 `deleteFileByPath` 回退路径
4. **该子项及后续父节点进度完全停止更新**
5. 最终完成后突然跳到 100%

### 根因分析

**问题代码** ([sftp.ts deleteFileByPath](../../src/main/services/sftp.ts))：

```typescript
// 修复前：没有任何 onProgress 调用
private async deleteFileByPath(taskId, remotePath, parentNode, onProgress?) {
  // stat → readdir/unlink → rmdir/resolve
  // ← 全程没有调用 onProgress！
}
```

**对比正常路径 `deleteFile`**：

| 进度点 | deleteFile ✅ | deleteFileByPath ❌ (修复前) |
|--------|--------------|------------------------------|
| 开始 | `onProgress(0, 0, ...)` | **缺失** |
| 文件完成 | `onProgress(0, size, ...)` | **缺失** |
| 目录完成 | `onProgress(0, size, ...)` | **缺失** |
| 中间进度 | 每个子项完成后 | **缺失** |

## 修复方案

在 `deleteFileByPath` 中添加完整的进度上报链路，与 `deleteFile` 保持一致：

```typescript
// 1. 开始时上报 0%
if (onProgress) {
  onProgress(0, 0, taskId, parentNode)
}

// 2. 目录循环中每完成一个子项，上报中间进度
for (let i = 0; i < validEntries.length; i++) {
  await this.deleteFileByPath(taskId, childPath, parentNode, onProgress)
  
  if (onProgress && totalChildren > 0 && parentNode.size) {
    const completedRatio = (i + 1) / totalChildren
    const intermediateBytes = Math.floor(parentNode.size * completedRatio)
    onProgress(0, intermediateBytes, taskId, parentNode)
  }
}

// 3. 完成时上报 100%（文件 unlink 或目录 rmdir）
if (onProgress) {
  onProgress(0, parentNode.size || 0, taskId, parentNode)
}
```

**注意**: 由于回退路径没有对应的 TransferNode 子对象，所有进度都关联到 `parentNode`（父节点）。

## 修改文件

- [sftp.ts](../../src/main/services/sftp.ts) - `deleteFileByPath` 方法，添加完整的进度上报链路（开始0%、中间进度、完成100%）

## 测试验证

1. 正常删除（不走回退路径）→ 验证功能不受影响
2. 模拟回退场景（手动触发 deleteFileByPath）→ 验证进度正常更新
3. 回退路径删除大目录 → 验证中间进度逐步推进
4. 回退路径删除单文件 → 验证 0%→100% 正常
