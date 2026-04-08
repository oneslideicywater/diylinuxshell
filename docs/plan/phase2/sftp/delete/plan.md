# SFTP 文件删除功能 - 实现计划

## 1. 概述

本文档详细描述 SFTP 文件删除功能的实现计划，包括单文件删除、批量删除、文件夹递归删除等功能。

**预计工期**：1-2 天

**前置依赖**：Phase 1 核心功能已完成，SFTP 基础服务已实现

---

## 2. 任务清单

### 2.1 服务层

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| DELETE-1 | 实现单文件删除 | sftp.ts/deleteFile | SFTP 服务基础 | P0 | 待开始 |
| DELETE-2 | 实现文件夹删除（递归） | sftp.ts/deleteFolder | DELETE-1 | P1 | 待开始 |
| DELETE-3 | 实现批量删除管理 | deleteManager.ts | DELETE-1 | P0 | 待开始 |
| DELETE-4 | 实现取消删除功能 | sftp.ts/cancelDelete | DELETE-3 | P1 | 待开始 |
| DELETE-5 | 实现删除权限检查 | sftp.ts/checkDeletePermission | DELETE-1 | P1 | 待开始 |

### 2.2 状态管理层

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| DELETE-6 | 实现删除任务状态管理 | globalState.ts | DELETE-3 | P0 | 待开始 |
| DELETE-7 | 实现删除进度更新 | globalState.ts | DELETE-1 | P0 | 待开始 |
| DELETE-8 | 实现删除确认对话框状态 | globalState.ts | DELETE-6 | P0 | 待开始 |

### 2.3 组件层

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| DELETE-9 | 实现删除确认对话框 | DeleteConfirmDialog.vue | DELETE-8 | P0 | 待开始 |
| DELETE-10 | 实现删除进度显示 | 使用 SftpTransferTreeNode | DELETE-6 | P0 | 待开始 |
| DELETE-11 | 集成删除到右键菜单 | SftpRemote.vue | DELETE-1 | P0 | 待开始 |
| DELETE-12 | 实现工具栏删除按钮 | SftpRemote.vue | DELETE-1 | P1 | 待开始 |

### 2.4 类型定义

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| DELETE-13 | 定义 DeleteTask 类型 | types/delete.ts | - | P0 | 待开始 |
| DELETE-14 | 定义 DeleteProgress 类型 | types/delete.ts | - | P0 | 待开始 |
| DELETE-15 | 定义 DeleteOptions 类型 | types/delete.ts | - | P0 | 待开始 |

### 2.5 测试

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| DELETE-16 | 编写单文件删除 E2E 测试 | delete.e2e.spec.ts | DELETE-1 | P1 | 待开始 |
| DELETE-17 | 编写批量删除 E2E 测试 | delete.e2e.spec.ts | DELETE-3 | P1 | 待开始 |
| DELETE-18 | 编写文件夹删除 E2E 测试 | delete.e2e.spec.ts | DELETE-2 | P1 | 待开始 |
| DELETE-19 | 编写取消删除 E2E 测试 | delete.e2e.spec.ts | DELETE-4 | P1 | 待开始 |
| DELETE-20 | 编写删除确认 E2E 测试 | delete.e2e.spec.ts | DELETE-9 | P1 | 待开始 |

---

## 3. 实现顺序

| 阶段 | 序号 | 任务 | 产出物 | 依赖 | 说明 |
|------|------|------|--------|------|------|
| 1. 类型定义 | DELETE-13 | 定义 DeleteTask 类型 | types/delete.ts | - | 定义删除任务数据结构 |
| 1. 类型定义 | DELETE-14 | 定义 DeleteProgress 类型 | types/delete.ts | - | 定义删除进度数据结构 |
| 1. 类型定义 | DELETE-15 | 定义 DeleteOptions 类型 | types/delete.ts | - | 定义删除配置选项 |
| 2. 服务层 | DELETE-1 | 实现单文件删除 | sftp.ts/deleteFile | 类型定义 | 基础删除功能 |
| 2. 服务层 | DELETE-5 | 实现删除权限检查 | sftp.ts/checkDeletePermission | DELETE-1 | 删除前权限验证 |
| 2. 服务层 | DELETE-2 | 实现文件夹删除（递归） | sftp.ts/deleteFolder | DELETE-1 | 递归删除文件夹 |
| 2. 服务层 | DELETE-3 | 实现批量删除管理 | deleteManager.ts | DELETE-1 | 批量任务管理 |
| 2. 服务层 | DELETE-4 | 实现取消删除功能 | sftp.ts/cancelDelete | DELETE-3 | 支持取消任务 |
| 3. 状态管理层 | DELETE-6 | 实现删除任务状态管理 | globalState.ts | DELETE-3 | 全局状态管理 |
| 3. 状态管理层 | DELETE-7 | 实现删除进度更新 | globalState.ts | DELETE-1 | 进度状态同步 |
| 3. 状态管理层 | DELETE-8 | 实现删除确认对话框状态 | globalState.ts | DELETE-6 | 对话框状态管理 |
| 4. 组件层 | DELETE-9 | 实现删除确认对话框 | DeleteConfirmDialog.vue | DELETE-8 | 删除前确认 UI |
| 4. 组件层 | DELETE-10 | 实现删除进度显示 | 使用 SftpTransferTreeNode | DELETE-6 | 复用树形节点组件 |
| 4. 组件层 | DELETE-11 | 集成删除到右键菜单 | SftpRemote.vue | DELETE-1 | 右键菜单集成 |
| 4. 组件层 | DELETE-12 | 实现工具栏删除按钮 | SftpRemote.vue | DELETE-1 | 工具栏按钮集成 |
| 5. 测试 | DELETE-16 | 编写单文件删除 E2E 测试 | delete.e2e.spec.ts | DELETE-1 | 基础功能测试 |
| 5. 测试 | DELETE-17 | 编写批量删除 E2E 测试 | delete.e2e.spec.ts | DELETE-3 | 批量删除测试 |
| 5. 测试 | DELETE-18 | 编写文件夹删除 E2E 测试 | delete.e2e.spec.ts | DELETE-2 | 递归删除测试 |
| 5. 测试 | DELETE-19 | 编写取消删除 E2E 测试 | delete.e2e.spec.ts | DELETE-4 | 取消功能测试 |
| 5. 测试 | DELETE-20 | 编写删除确认 E2E 测试 | delete.e2e.spec.ts | DELETE-9 | 确认对话框测试 |

---

## 4. 技术要点

### 4.1 单文件删除流程

1. 用户选择要删除的文件
2. 显示删除确认对话框
3. 用户确认删除
4. 检查删除权限
5. 调用 SFTP 删除接口
6. 监听删除进度
7. 更新任务状态
8. 刷新远程文件列表

### 4.2 文件夹删除流程

1. 递归遍历文件夹结构
2. 显示待删除文件列表
3. 用户确认删除
4. 从最深层开始删除（自底向上）
5. 删除所有子文件和子文件夹
6. 最后删除文件夹本身
7. 更新任务状态
8. 刷新远程文件列表

### 4.3 批量删除流程

1. 用户选择多个文件/文件夹
2. 收集所有待删除项
3. 显示删除确认对话框（包含所有项）
4. 用户确认删除
5. 创建批量删除任务
6. 并行或串行执行删除
7. 使用树形组件显示进度
8. 全部完成后刷新文件列表

### 4.4 取消删除

1. 维护删除任务列表
2. 支持取消单个删除任务
3. 支持取消整个批量删除
4. 清理已删除的文件（不可恢复）
5. 更新任务状态为 cancelled

### 4.5 错误处理

```typescript
// 删除错误类型
enum DeleteErrorType {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  FILE_IN_USE = 'FILE_IN_USE',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// 错误处理策略
function handleDeleteError(error: DeleteError): void {
  switch (error.type) {
    case DeleteErrorType.PERMISSION_DENIED:
      showMessage('权限不足，无法删除文件')
      break
    case DeleteErrorType.FILE_IN_USE:
      showMessage('文件正在使用中，无法删除')
      break
    case DeleteErrorType.FILE_NOT_FOUND:
      showMessage('文件不存在，可能已被删除')
      break
    case DeleteErrorType.NETWORK_ERROR:
      showMessage('网络错误，请检查连接')
      break
    default:
      showMessage(`删除失败：${error.message}`)
  }
}
```

---

## 5. 数据结构

### 5.1 DeleteTask

```typescript
interface DeleteTask {
  id: string              // 任务唯一标识
  name: string            // 文件/文件夹名称
  type: 'file' | 'folder' // 删除类型
  status: 'pending' | 'deleting' | 'completed' | 'failed' | 'cancelled'
  path: string            // 远程文件路径
  size: number            // 文件大小（字节）
  children?: DeleteTask[] // 子任务（文件夹删除时使用）
  error?: string          // 错误信息
  startTime: number       // 开始时间戳
  endTime?: number        // 结束时间戳
}
```

### 5.2 DeleteProgress

```typescript
interface DeleteProgress {
  total: number           // 总文件数
  deleted: number         // 已删除数
  failed: number          // 失败数
  currentFile: string     // 当前删除的文件
  speed: number           // 删除速度（文件数/秒）
  remaining: string       // 估计剩余时间
  elapsed: string         // 已用时间
}
```

### 5.3 DeleteOptions

```typescript
interface DeleteOptions {
  recursive?: boolean     // 是否递归删除文件夹
  skipConfirm?: boolean   // 是否跳过确认对话框
  showProgress?: boolean  // 是否显示进度
  onError?: 'stop' | 'continue' | 'skip' // 错误处理策略
}
```

---

## 6. 组件复用

### 6.1 树形进度组件

删除功能**复用上传/下载的树形组件**：

- **SftpStatusHeader.vue**：显示表头（名称、状态、进度等）
- **SftpTransferTreeNode.vue**：显示每个节点的删除状态

**状态映射**：
```typescript
// 删除状态映射到通用状态
const statusMap: Record<string, string> = {
  pending: '等待中',
  deleting: '删除中',
  completed: '已完成',
  failed: '错误',
  cancelled: '已取消'
}
```

### 6.2 右键菜单集成

在 `SftpRemote.vue` 的右键菜单中添加"删除"选项：

```vue
<template>
  <div class="context-menu-item" @click="handleDelete">
    <svg>...</svg>
    <span>删除</span>
    <span class="shortcut">Delete</span>
  </div>
</template>
```

---

## 7. 风险点

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 误删除重要文件 | 高 | 强制确认对话框，提供"不再提示"选项 |
| 删除权限不足 | 中 | 删除前检查权限，提前提示用户 |
| 文件被占用 | 中 | 检测文件占用状态，提示用户关闭 |
| 网络中断 | 高 | 支持断点续删，网络恢复后继续 |
| 大量文件删除卡顿 | 中 | 分批删除，避免阻塞 UI |

---

## 8. 测试用例

### 8.1 功能测试

1. **单文件删除**
   - 删除普通文件
   - 删除空文件夹
   - 删除非空文件夹

2. **批量删除**
   - 删除多个文件
   - 删除多个文件夹
   - 混合删除文件和文件夹

3. **删除确认**
   - 确认删除单个文件
   - 确认删除批量文件
   - 取消删除操作
   - 勾选"不再提示"

4. **错误处理**
   - 权限不足
   - 文件被占用
   - 文件不存在
   - 网络错误

### 8.2 性能测试

- 删除 100+ 个文件
- 删除深层级文件夹（10 层+）
- 删除大文件（1GB+）

### 8.3 兼容性测试

- Windows 10/11
- 中文文件名
- 特殊字符文件名

---

## 9. 交付物清单

- [ ] `sftp.ts/deleteFile` - 单文件删除函数
- [ ] `sftp.ts/deleteFolder` - 文件夹删除函数
- [ ] `deleteManager.ts` - 批量删除管理器
- [ ] `sftp.ts/cancelDelete` - 取消删除函数
- [ ] `types/delete.ts` - 类型定义
- [ ] `DeleteConfirmDialog.vue` - 删除确认对话框
- [ ] `SftpRemote.vue` - 集成删除到右键菜单
- [ ] `delete.e2e.spec.ts` - E2E 测试用例

---

## 10. 参考资料

- [文件删除 PRD](./prd.md)
- [SFTP Phase 2 PRD](../prd.md)
- [文件上传 Plan](../upload/plan.md)
- [文件下载 Plan](../download/plan.md)
