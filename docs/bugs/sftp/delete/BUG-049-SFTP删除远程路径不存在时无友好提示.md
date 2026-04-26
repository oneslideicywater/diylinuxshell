# BUG-049: SFTP 删除远程路径不存在时无友好提示

## 基本信息
- **编号**: BUG-049
- **标题**: SFTP 删除远程文件/文件夹时，目标路径不存在仅输出日志无用户提示
- **发现日期**: 2026-04-25
- **状态**: 已修复
- **严重程度**: 中
- **影响模块**: SFTP 删除功能
- **错误日志**: `listDir error: No such file` / `[SFTP] 开始扫描远程文件夹: /.gradle`

## 问题描述

当用户尝试删除一个**已不存在**的远程路径（可能已被删除、移动或从未创建）时：

1. 控制台输出 `listDir error: No such file` 错误日志
2. 但代码继续执行，尝试 `scanRemoteTree` 扫描不存在的路径
3. **用户看不到任何错误提示**，操作静默失败或进入异常状态

### 错误现象

1. 用户右键选择删除远程文件夹（如 `/.gradle`）
2. 该路径实际上已不存在（可能之前已被删除）
3. 终端显示 `listDir error: No such file`
4. 系统继续尝试扫描和删除，最终失败但无明确提示

### 根因分析

**Bug 1: parentPath 计算错误（根目录下文件删除必崩）**

当目标路径在根目录 `/` 下时（如 `/test_folder`），`parentPath` 被计算为**空字符串**：

```typescript
// 修复前（有缺陷）
const parentPath = remotePath.includes('/') 
  ? remotePath.substring(0, remotePath.lastIndexOf('/'))  // "/file" → substring(0,0) → ""
  : '/'
// 结果: listDir(sftpConnectionId, "") → "No such file"
```

| remotePath | lastIndexOf('/') | substring(0, n) | 结果 |
|------------|-------------------|-----------------|------|
| `/tmp/file` | 4 | `/tmp` | ✅ 正确 |
| **`/file`** | **0** | **`""`** | ❌ **空字符串！** |

**Bug 2: listDir 失败时静默跳过**

```typescript
const selectedItem = listResult.success && listResult.data ? listResult.data.find(...) : null
// ↑ listResult.success=false 时 selectedItem=null
//   但代码没有 throw，继续往下执行...
```

**缺陷点**:
| 检查项 | 修复前 | 问题 |
|--------|--------|------|
| `parentPath` 计算 | `lastIndexOf('/')=0` 时返回空串 | 根目录文件必报错 |
| `listResult.success` | 未检查 | 失败时静默跳过 |
| `selectedItem === null` | 未检查 | 目标不存在时走错误分支 |
| 用户提示 | 无 | 仅 console.error |

## 修复方案

**修复1: parentPath 边界处理**
```typescript
// 修复后：lastSlashIndex > 0 才截取，否则回退到根目录 /
const lastSlashIndex = remotePath.lastIndexOf('/')
const parentPath = (lastSlashIndex > 0) ? remotePath.substring(0, lastSlashIndex) : '/'
```

**修复2: 两层校验提前抛错**

```typescript
const parentPath = remotePath.includes('/') ? remotePath.substring(0, remotePath.lastIndexOf('/')) : '/'

const listResult = await window.api.sftp.listDir(sftpConnectionId, parentPath)

// 校验1：父目录访问失败
if (!listResult.success) {
  throw new Error(`无法访问目录 "${parentPath}"：${listResult.error || '路径不存在'}`)
}

const selectedItem = listResult.data?.find(...) || null

// 校验2：目标路径不存在
if (!selectedItem) {
  throw new Error(`删除失败：路径 "${remotePath}" 不存在`)
}
```

**错误传递链路**:
```
deleteRemoteBatch throw Error
    ↓
SftpTransfer.vue catch (L719)
    ↓
showAlert(`批量删除失败：${error.message}`, '错误', true)
    ↓
AlertDialog 统一弹窗显示给用户
```

## 修改文件

- [delete.ts](../../src/renderer/src/components/terminal/sftp/script/delete.ts) - `deleteRemoteBatch` 函数，添加 listDir 结果校验和目标路径存在性检查

## 测试验证

1. 删除已存在的远程文件 → 验证功能正常
2. 删除不存在的远程路径 → 验证弹出 AlertDialog 提示"路径不存在"
3. 删除父目录不可访问的路径 → 验证弹出"无法访问目录"提示
4. 批量删除中部分路径不存在 → 验证跳过该项并提示，其他正常执行
