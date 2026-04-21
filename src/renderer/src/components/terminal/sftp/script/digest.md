# SFTP Script 模块文档摘要

> 本文档记录 `src/renderer/src/components/terminal/sftp/script` 目录下所有模块的文件结构、函数清单及职责说明。

---

## 📁 目录概览

| 文件名 | 模块名称 | 主要职责 |
|--------|----------|----------|
| [delete.ts](./delete.ts) | SFTP 删除功能模块 | 单文件、文件夹、批量删除操作 |
| [download.ts](./download.ts) | SFTP 下载功能模块 | 单文件、文件夹、批量下载操作 |
| [local.ts](./local.ts) | 本地文件操作模块 | 本地文件加载、导航、刷新等操作 |
| [remote.ts](./remote.ts) | 远程文件操作模块 | 远程文件加载、导航、创建/删除等操作 |
| [statusText.ts](./statusText.ts) | 状态文本工具 | 根据任务类型和状态返回显示文案 |
| [upload.ts](./upload.ts) | SFTP 上传功能模块 | 单文件、文件夹、批量上传操作 |
| [utils.ts](./utils.ts) | 公共工具函数模块 | 统一管理公共工具函数（格式化、工厂方法等） |

---

## 1. delete.ts - SFTP 删除功能模块（安全架构 v4）

**模块说明**：支持单文件、文件夹、批量删除，使用统一的树形组件显示删除进度。

### 函数清单

| 函数名 | 类型 | 参数 | 返回值 | 说明 |
|--------|------|------|--------|------|
| `scanRemoteFolderForDelete` | 导出 | `remotePath: string, sftpConnectionId: string` | `Promise<{ rootNode: TransferNode; totalFiles: number; totalBytes: number }>` | 递归扫描远程文件夹并构建传输节点树（用于删除） |
| `deleteSingleItem` | 内部 | `node: TransferNode, sftpConnectionId: string, taskId: string` | `Promise<void>` | 删除单个文件/文件夹（原子操作） |
| `deleteFolderContent` | 导出 | `node: TransferNode, sftpConnectionId: string, taskId: string` | `Promise<void>` | 递归删除文件夹内容（安全架构 v4） |
| `deleteLocalBatch` | 导出 | `paths: string[], sftpConnectionId: string` | `Promise<{ success: number; failed: number }>` | 批量删除本地文件/文件夹（支持混合选择） |
| `deleteRemoteBatch` | 导出 | `paths: string[], sftpConnectionId: string, sessionId?: string` | `Promise<{ success: number; failed: number }>` | 批量删除远程文件/文件夹（支持混合选择） |

### 设计特点
- 不再依赖 session 对象，直接使用 sftpConnectionId
- 两阶段策略：先创建占位任务入 Store，再异步扫描子项
- 支持取消批量删除任务
- 显示已删除数量、总数量、剩余时间、经过时间

---

## 2. download.ts - SFTP 下载功能模块（安全架构 v4）

**模块说明**：支持单文件、文件夹、批量下载，使用统一的树形组件显示下载进度。

### 函数清单

| 函数名 | 类型 | 参数 | 返回值 | 说明 |
|--------|------|------|--------|------|
| `scanRemoteFolderRecursive` | 内部 | `remotePath: string, localBasePath: string, sftpConnectionId: string` | `Promise<{ rootNode: TransferNode; totalFiles: number; totalBytes: number }>` | 递归扫描远程文件夹并构建传输节点树 |
| `downloadSingleFile` | 内部 | `node: TransferNode, sftpConnectionId: string, taskId: string` | `Promise<void>` | 下载单个文件（核心函数），通过 Store API 更新状态，支持进度回调 |
| `downloadFolderContent` | 内部 | `node: TransferNode, sftpConnectionId: string, taskId: string` | `Promise<void>` | 递归下载文件夹内容（利用 Pinia reactive 特性） |
| `downloadFile` | 导出 | `remotePath: string, sftpConnectionId: string, sessionId?: string, localPath?: string \| { value: string }` | `Promise<void>` | 下载单个文件（导出函数，安全架构 v4） |
| `downloadFolder` | 导出 | `remotePath: string, sftpConnectionId: string, sessionId?: string, localPath?: string \| { value: string }` | `Promise<void>` | 下载文件夹主函数（安全架构 v4） |

### 设计特点
- 直接使用 sftpConnectionId，不再接收 session 对象
- 两阶段策略：先创建占位根节点入 Store，再异步扫描子项
- 支持任务取消机制（真正的取消机制）
- 自动确保本地目录存在（递归创建）

---

## 3. local.ts - 本地文件操作模块

**模块说明**：提供本地文件的加载、导航、刷新等操作函数。

### 接口定义

```typescript
interface LocalFileState {
  localPath: Ref<string>        // 当前本地路径
  localFiles: Ref<any[]>         // 本地文件列表
  localFileCount: Ref<number>    // 本地文件数量
}
```

### 常量

| 常量名 | 值 | 说明 |
|--------|-----|------|
| `DEFAULT_LOCAL_PATH` | `'D:\\develop\\goworkbunch\\memcached-operator'` | 默认本地路径（避免 C 盘权限问题） |
| `DRIVES_PATH` | `'此电脑'` | 盘符列表视图的特殊路径标识 |

### 函数清单

| 函数名 | 类型 | 参数 | 返回值 | 说明 |
|--------|------|------|--------|------|
| `createLocalFileState` | 导出 | 无 | `LocalFileState` | 创建并初始化本地文件状态对象 |
| `initLocalDefaultDir` | 导出 | `state: LocalFileState` | `Promise<void>` | 初始化本地默认目录（设置为用户 home 目录） |
| `loadLocalFiles` | 导出 | `state: LocalFileState` | `Promise<void>` | 加载本地文件列表 |
| `handleLocalDblClick` | 导出 | `event: MouseEvent, state: LocalFileState` | `void` | 本地文件列表双击处理（进入目录） |
| `navigateToLocalPath` | 导出 | `state: LocalFileState, path: string` | `void` | 导航到指定的本地路径 |
| `refreshLocalFiles` | 导出 | `state: LocalFileState` | `Promise<void>` | 刷新本地文件列表 |
| `getSelectedLocalFile` | 导出 | `state: LocalFileState, selectedLocal: Ref<string>` | `any \| null` | 获取当前选中的本地文件 |
| `localUp` | 导出 | `state: LocalFileState, pathUtils: any` | `void` | 本地目录向上级导航 |
| `createLocalFolder` | 导出 | `state: LocalFileState, folderName: string` | `Promise<void>` | 创建本地文件夹 |

---

## 4. remote.ts - 远程文件操作模块

**模块说明**：提供远程文件的加载、导航、创建/删除等操作函数。

### 接口定义

```typescript
interface RemoteFileState {
  remotePath: Ref<string>       // 当前远程路径
  remoteFiles: Ref<any[]>       // 远程文件列表
  remoteFileCount: Ref<number>  // 远程文件数量
  connectionId: string          // SFTP 连接标识符（每个 tab 独立）
}
```

### 函数清单

| 函数名 | 类型 | 参数 | 返回值 | 说明 |
|--------|------|------|--------|------|
| `createRemoteFileState` | 导出 | `connectionId: string = ''` | `RemoteFileState` | 创建并初始化远程文件状态对象 |
| `initRemoteDefaultDir` | 导出 | `state: RemoteFileState` | `void` | 初始化远程默认目录（设置为 '/'） |
| `loadRemoteFiles` | 导出 | `state: RemoteFileState` | `Promise<void>` | 加载远程文件列表（使用 connectionId 调用 API） |
| `remoteUpRemote` | 导出 | `state: RemoteFileState, pathUtils: { posix: { dirname: (path: string) => string } }` | `Promise<void>` | 导航到上级目录 |
| `remoteMkdir` | 导出 | `state: RemoteFileState, folderName: string` | `Promise<void>` | 创建远程文件夹 |
| `remoteDeleteFile` | 导出 | `state: RemoteFileState, path: string` | `Promise<void>` | 删除远程文件或文件夹 |
| `handleRemoteDblClick` | 导出 | `event: MouseEvent, state: RemoteFileState` | `void` | 处理远程文件双击事件（进入目录） |
| `getSelectedRemoteFile` | 导出 | `state: RemoteFileState, selectedRemote: Ref<string>` | `any \| null` | 获取当前选中的远程文件 |

### 安全改进（v2）
- 移除 session 字段，改用 connectionId
- connectionId 是 SFTP 连接池中的唯一标识符（每个 tab 独立）
- 避免在渲染进程传递会话对象，增强安全性

---

## 5. statusText.ts - 状态文本工具

**模块说明**：根据任务类型和状态返回对应的显示文案。

### 映射表

#### 通用状态文本映射表 (`STATUS_TEXT_MAP`)
| 状态 | 显示文案 |
|------|----------|
| pending | 等待中 |
| transferring | 传输中 |
| completed | 已完成 |
| error | 错误 |
| cancelled | 已取消 |

#### 删除任务专用状态文本映射表 (`DELETE_STATUS_TEXT_MAP`)
| 状态 | 显示文案 |
|------|----------|
| pending | 等待中 |
| transferring | 删除中 |
| completed | 已删除 |
| error | 错误 |
| cancelled | 已取消 |

### 函数清单

| 函数名 | 类型 | 参数 | 返回值 | 说明 |
|--------|------|------|--------|------|
| `getStatusText` | 导出 | `taskType: TransferType, status: TransferStatus` | `string` | 获取状态显示文本（删除任务返回"已删除/删除中"，其他返回"已完成/传输中"） |

---

## 6. upload.ts - SFTP 上传功能模块（安全架构 v4）

**模块说明**：支持单文件、文件夹、批量上传，使用统一的树形组件显示上传进度。

### 函数清单

| 函数名 | 类型 | 参数 | 返回值 | 说明 |
|--------|------|------|--------|------|
| `scanFolderRecursive` | 内部 | `folderPath: string, remoteBasePath: string` | `Promise<{ rootNode: TransferNode; totalFiles: number; totalBytes: number }>` | 递归扫描文件夹并构建传输节点树 |
| `uploadSingleFile` | 内部 | `node: TransferNode, sftpConnectionId: string, taskId: string` | `Promise<void>` | 上传单个文件（利用 Pinia reactive 特性） |
| `uploadFolderContent` | 内部 | `node: TransferNode, sftpConnectionId: string, taskId: string` | `Promise<void>` | 递归上传文件夹内容（利用 Pinia reactive 特性） |
| `uploadFile` | 导出 | `filePath: string, sftpConnectionId: string, sessionId?: string, remotePath?: string \| { value: string }` | `Promise<void>` | 上传单个文件（导出函数，安全架构 v4） |
| `uploadFolder` | 导出 | `folderPath: string, sftpConnectionId: string, sessionId?: string, remotePath?: string \| { value: string }` | `Promise<void>` | 上传文件夹主函数（安全架构 v4） |
| `uploadBatch` | 导出 | `paths: string[], sftpConnectionId: string, sessionId?: string, remotePath?: string \| { value: string }` | `Promise<void>` | 批量上传主函数（支持混合选择文件和文件夹） |

### 设计特点
- 新架构：每个选中的文件/文件夹创建独立的 TransferTask
- 选择 N 个项目 → 创建 N 个 TransferTask
- 每个任务独立管理进度、状态、取消操作
- 符合用户期望的"多任务"模式
- 跳过 Windows 系统受保护目录（System Volume Information 等）

---

## 7. utils.ts - 公共工具函数模块

**模块说明**：统一管理所有 SFTP 操作的公共工具函数，消除代码重复，提高可维护性。

### 函数清单

| 函数名 | 类型 | 参数 | 返回值 | 说明 |
|--------|------|------|--------|------|
| `formatTime` | 导出 | `seconds: number` | `string` | 格式化时间（秒 → HH:MM:SS），负数返回 '00:00:00' |
| `createTransferNode` | 导出 | `config: { name, isDirectory, type, ... }` | `TransferNode` | 创建传输节点工厂函数（自动生成唯一 ID，统一默认值设置） |
| `formatSize` | 导出 | `bytes: number` | `string` | 格式化文件大小（字节 → 人类可读格式，如 '1.5 MB'） |
| `createTransferTask` | 导出 | `config: { type, root, sftpConnectionId, ... }` | `TransferTask` | 创建传输任务工厂函数（自动生成唯一 ID，包含操作类型前缀） |
| `isTaskCancelled` | 导出 | `taskId: string, context?: string` | `boolean` | 检查传输任务是否已被取消（用于在关键节点检测取消状态） |

### 使用场景说明

#### formatTime
- 用于显示已用时间、剩余时间等

#### createTransferNode
- 支持上传、下载、删除三种操作类型
- 支持普通节点、错误节点、根节点等多种场景
- 消除各模块中手动创建 TransferNode 的重复代码

#### formatSize
- 用于显示文件大小、总大小等

#### createTransferTask
- 关联 Pinia Store 进行状态管理
- 消除各模块中手动创建 TransferTask 的重复代码

#### isTaskCancelled
- 文件上传/下载开始前检查
- 文件夹递归处理前检查
- for 循环每个子节点处理前检查
- 进度回调中检查（停止 UI 更新）
- 操作完成后检查（防止状态覆盖）

---

## 🔗 模块依赖关系

```
┌─────────────────────────────────────────────────────────────┐
│                        utils.ts                              │
│  (formatTime, formatSize, createTransferNode,               │
│   createTransferTask, isTaskCancelled)                      │
└───────────┬──────────────┬──────────────┬───────────────────┘
            │              │              │
    ┌───────▼───────┐ ┌────▼─────┐ ┌─────▼──────┐
    │   upload.ts   │ │download.ts│ │  delete.ts │
    │ (上传功能)     │ │(下载功能) │ │ (删除功能)  │
    └───────┬───────┘ └────┬─────┘ └─────┬──────┘
            │              │              │
            └──────────────┼──────────────┘
                           │
                  ┌────────▼────────┐
                  │   statusText.ts  │
                  │  (状态文本工具)   │
                  └─────────────────┘

    ┌─────────────────────────────────┐
    │           local.ts              │
    │      (本地文件操作)              │
    └─────────────────────────────────┘

    ┌─────────────────────────────────┐
    │          remote.ts              │
    │      (远程文件操作)              │
    └─────────────────────────────────┘
```

---

## 📊 统计信息

| 模块 | 导出函数数 | 内部函数数 | 总函数数 |
|------|-----------|-----------|---------|
| delete.ts | 3 | 2 | 5 |
| download.ts | 2 | 3 | 5 |
| local.ts | 9 | 0 | 9 |
| remote.ts | 8 | 0 | 8 |
| statusText.ts | 1 | 0 | 1 |
| upload.ts | 3 | 3 | 6 |
| utils.ts | 5 | 0 | 5 |
| **总计** | **31** | **8** | **39** |

---

## 🏗️ 架构设计原则

### 安全架构 v4
1. **不再依赖 session 对象**：避免在渲染进程传递敏感信息
2. **直接使用 sftpConnectionId**：SFTP 连接已在 TerminalTab 初始化时建立
3. **可选接收 sessionId**：仅用于通过 SessionStore 获取会话名称等非敏感信息显示

### 两阶段策略（适用于文件夹操作）
1. **阶段 1**：先创建占位根节点，立即入 Store（UI 可即时显示）
2. **阶段 2**：异步递归扫描子项，完成后更新 Store 中的 root 节点

### 取消机制
- 使用 `isTaskCancelled()` 在关键节点检查任务状态
- 支持在以下时机检测取消：
  - 文件传输开始前
  - 文件夹递归处理前
  - 循环每个子节点处理前
  - 进度回调中
  - 操作完成后（防止状态覆盖）

### 响应式状态管理
- 利用 Pinia reactive 特性
- 通过 Store API 更新状态，自动触发视图响应式更新
- 实时显示传输进度、速度、剩余时间等信息

---

*文档生成时间：2026-04-20*
*模块路径：src/renderer/src/components/terminal/sftp/script/*
