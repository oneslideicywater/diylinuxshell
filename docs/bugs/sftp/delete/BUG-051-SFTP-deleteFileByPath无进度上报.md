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
- 扫描目录树后，其他进程新建了文件/文件夹（readdir 返回了但树中没有）
- 扫描时因权限不足跳过了某些隐藏文件
- 符号链接等特殊文件类型未被 scanRemoteTree 收录到树中

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

采用**有限度的进度上报策略**——只上报开始，不上报完成：

```typescript
// ✅ 开始时上报 0%（告知前端"正在处理回退路径"）
if (onProgress) {
  onProgress(0, 0, taskId, parentNode)
}

// ... 删除逻辑（递归/unlink/rmdir）...

// ❌ 完成时不上报！原因：
//   - 特殊文件的 size 未被计入 parentNode.size（扫描时未收录）
//   - 如果传 parentNode.size → 前端计算 progress=100% → 父节点提前跳满
//   - 所以只在开始时通知前端"有活动"，完成后静默返回
```

### 为什么不能传 `parentNode.size`？

**数据流分析**：
```
扫描阶段 (scanRemoteTree):
  正常子项A: 100KB ─┐
  正常子项B: 200KB ─┤→ parentNode.size = 300KB
  正常子项C: 300KB ─┘
  
  特殊文件X: 50KB  ← 未被收录！（触发回退路径）

删除阶段:
  删完 A: transferredBytes=100KB → progress=33% ✅
  删完 B: transferredBytes=200KB → progress=67% ✅
  删完 C: transferredBytes=300KB → progress=100% ✅
  删完 X (回退): 若传 parentNode.size=300KB → progress=100% ❌ 提前跳满！
```

**结论**: 回退路径处理的文件大小不在 `parentNode.size` 统计范围内，传此值会导致百分比计算错误。

## 修改文件

- [sftp.ts](../../src/main/services/sftp.ts) - `deleteFileByPath` 方法，添加开始时的进度上报（0%），完成后不上报

## 测试验证

1. 正常删除（不走回退路径）→ 验证功能不受影响
2. 模拟回退场景 → 验证开始时有进度通知
3. 回退路径删除完成后 → 验证父节点不会提前跳到 100%
4. 混合场景（正常+回退）→ 验证正常子项的进度正确推进
