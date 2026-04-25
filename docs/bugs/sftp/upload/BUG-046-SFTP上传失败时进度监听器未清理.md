# BUG-046: SFTP 上传失败时进度监听器未清理导致内存泄漏

## 基本信息
- **编号**: BUG-046
- **标题**: SFTP 上传失败时进度监听器未清理
- **发现日期**: 2026-04-25
- **状态**: 已修复
- **严重程度**: 中
- **影响模块**: SFTP 上传功能
- **来源文档**: [sftp-logic-correctness.md#问题4](../../src/main/services/__problem__/sftp-logic-correctness.md)

## 问题描述

上传文件时，如果 `window.api.sftp.upload()` 抛出异常（如网络断开、连接超时等），进度监听器 `cleanupProgress()` 不会被调用，导致 IPC 监听器残留，多次失败后可能造成内存泄漏。

### 错误现象
1. 用户上传文件，中途网络断开或连接异常中断
2. `upload()` API 抛出异常，代码跳转到 `catch` 块
3. `cleanupProgress()` 被跳过，IPC 监听器未移除
4. 重复此操作后，内存中累积大量无用监听器

### 根因分析

**修复前代码结构** ([upload.ts](../../src/renderer/src/components/terminal/sftp/script/upload.ts)):
```typescript
try {
  const cleanupProgress = window.api.sftp.onUploadProgress((data) => { ... })
  
  const result = await window.api.sftp.upload(connectionId, taskId, node)
  
  cleanupProgress()  // ← 只在 upload 成功返回后执行
  
  // 后续逻辑...
} catch (error: any) {
  // 错误处理...
  // ← 没有 finally 块！cleanupProgress 未被调用
}
```

**问题场景**:
| 场景 | `cleanupProgress()` 是否调用 | 是否泄漏 |
|------|-----------------------------|---------|
| `upload()` 正常完成 + success=true | ✓ 调用 | 无 |
| `upload()` 正常完成 + success=false | ✓ 调用后抛异常 | 无 |
| **`upload()` 抛出异常**（网络断开） | ✗ **未调用** | **泄漏** |

### 对比正确实现

**delete.ts 的正确写法** ([delete.ts](../../src/renderer/src/components/terminal/sftp/script/delete.ts)):
```typescript
try {
  const result = await window.api.sftp.delete(sftpConnectionId, taskId, node)
  // ...
} catch (error: any) {
  // 错误处理...
  throw error
} finally {
  cleanupProgress()  // ← 无论成功失败都清理
}
```

## 修复方案

将 `cleanupProgress` 移到 `try` 块外部声明，使用 `finally` 确保清理：

```typescript
// 监听上传进度（在 try 外部声明，确保 finally 可访问）
let lastSpeed = 0
const cleanupProgress = window.api.sftp.onUploadProgress((data) => { ... })

try {
  const result = await window.api.sftp.upload(connectionId, taskId, node)
  // 业务逻辑...
} catch (error: any) {
  // 错误处理...
  throw error
} finally {
  // 清理进度监听（无论成功或失败都要清理）
  cleanupProgress()
}
```

## 修改文件

- [upload.ts](../../src/renderer/src/components/terminal/sftp/script/upload.ts) - `uploadSingleFile` 函数

## 测试验证

1. 正常上传文件 → 验证进度显示正常，无内存泄漏
2. 上传时断开网络 → 验证错误提示正常，监听器已清理
3. 重复上传失败操作 → 验证内存稳定，无监听器累积
