# SFTP 文件传输功能 - 实现计划

## 1. 概述

本文档详细描述 SFTP 文件传输功能的实现计划，包括组件拆分、状态管理、服务层实现等。

**预计工期**：2-3 天

**前置依赖**：Phase 1 核心功能已完成

---

## 2. 任务清单

### 2.1 组件层

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| SFTP-1 | 创建 SftpLocal 组件 | SftpLocal.vue | - | P0 | ✅ |
| SFTP-2 | 创建 SftpRemote 组件 | SftpRemote.vue | - | P0 | ✅ |
| SFTP-3 | 重构 SftpTransfer 组件 | SftpTransfer.vue | SFTP-1, SFTP-2 | P0 | ✅ |
| SFTP-4 | 创建 SftpStatusBar 组件 | SftpStatusBar.vue | - | P1 | ✅ |
| SFTP-5 | 创建 SftpTransferTree 组件 | SftpTransferTree.vue | - | P1 | ✅ |
| SFTP-6 | 创建 TreeNode 组件 | TreeNode.vue | SFTP-5 | P1 | ✅ |

### 2.2 状态管理层

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| SFTP-7 | 创建全局状态管理 | globalState.ts | - | P0 | ✅ |
| SFTP-8 | 实现右键菜单协调 | requestContextMenu | SFTP-7 | P0 | ✅ |
| SFTP-9 | 编写状态管理测试 | globalState.test.ts | SFTP-7 | P1 | ✅ |

### 2.3 服务层

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| SFTP-10 | 实现 SFTP 服务 | sftp.ts | - | P0 | ✅ |
| SFTP-11 | 实现文件上传 | upload | SFTP-10 | P0 | ✅ |
| SFTP-12 | 实现文件下载 | download | SFTP-10 | P0 | ✅ |
| SFTP-13 | 实现文件夹上传 | uploadFolder | SFTP-11 | P1 | ✅ |
| SFTP-14 | 实现文件夹下载 | downloadFolder | SFTP-12 | P1 | ✅ |
| SFTP-15 | 实现取消上传 | cancelUpload | SFTP-11 | P1 | ✅ |

### 2.4 类型定义

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| SFTP-16 | 定义 TransferNode | types/index.ts | - | P0 | ✅ |
| SFTP-17 | 定义 TransferTask | types/index.ts | - | P0 | ✅ |

### 2.5 测试

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| SFTP-18 | 编写上传功能 E2E 测试 | sftp.e2e.spec.ts | SFTP-11 | P1 | ✅ |
| SFTP-19 | 编写下载功能 E2E 测试 | sftp.e2e.spec.ts | SFTP-12 | P1 | ✅ |
| SFTP-20 | 编写文件夹上传 E2E 测试 | sftp.e2e.spec.ts | SFTP-13 | P1 | ✅ |
| SFTP-21 | 编写文件夹下载 E2E 测试 | sftp.e2e.spec.ts | SFTP-14 | P1 | ✅ |
| SFTP-22 | 编写取消上传 E2E 测试 | sftp.e2e.spec.ts | SFTP-15 | P1 | ✅ |
| SFTP-23 | 编写右键菜单 E2E 测试 | sftp.e2e.spec.ts | SFTP-8 | P1 | ✅ |

---

## 3. 实现顺序

| 阶段 | 序号 | 任务 | 任务 ID | 依赖 |
|------|------|------|---------|------|
| **1. 类型定义** | 1 | TransferNode 类型 | SFTP-16 | - |
| | 2 | TransferTask 类型 | SFTP-17 | - |
| **2. 服务层** | 3 | SFTP 服务基础 | SFTP-10 | SFTP-16, SFTP-17 |
| | 4 | 文件上传 | SFTP-11 | SFTP-10 |
| | 5 | 文件下载 | SFTP-12 | SFTP-10 |
| | 6 | 文件夹上传 | SFTP-13 | SFTP-11 |
| | 7 | 文件夹下载 | SFTP-14 | SFTP-12 |
| | 8 | 取消上传 | SFTP-15 | SFTP-11 |
| **3. 状态管理层** | 9 | 全局状态管理 | SFTP-7 | SFTP-16 |
| | 10 | 右键菜单协调 | SFTP-8 | SFTP-7 |
| **4. 组件层** | 11 | SftpLocal 组件 | SFTP-1 | SFTP-7, SFTP-8 |
| | 12 | SftpRemote 组件 | SFTP-2 | SFTP-7, SFTP-8 |
| | 13 | SftpTransfer 重构 | SFTP-3 | SFTP-1, SFTP-2 |
| | 14 | SftpStatusBar 组件 | SFTP-4 | SFTP-7 |
| | 15 | SftpTransferTree 组件 | SFTP-5 | SFTP-7 |
| | 16 | TreeNode 组件 | SFTP-6 | SFTP-5 |
| **5. 测试** | 17 | 上传功能 E2E 测试 | SFTP-18 | SFTP-11 |
| | 18 | 下载功能 E2E 测试 | SFTP-19 | SFTP-12 |
| | 19 | 文件夹上传 E2E 测试 | SFTP-20 | SFTP-13 |
| | 20 | 文件夹下载 E2E 测试 | SFTP-21 | SFTP-14 |
| | 21 | 取消上传 E2E 测试 | SFTP-22 | SFTP-15 |
| | 22 | 右键菜单 E2E 测试 | SFTP-23 | SFTP-8 |

---

## 4. 详细实现步骤

### 4.1 类型定义

#### 4.1.1 TransferNode

**文件**：`src/shared/types/index.ts`

```typescript
/**
 * 传输节点接口
 * 用于表示单个文件或文件夹的传输状态
 */
export interface TransferNode {
  /** 节点唯一标识符 */
  id: string
  /** 文件或文件夹名称 */
  name: string
  /** 节点类型：file-文件，folder-文件夹 */
  type: 'file' | 'folder'
  /** 传输状态：transferring-传输中，completed-已完成，failed-失败，cancelled-已取消 */
  status: 'transferring' | 'completed' | 'failed' | 'cancelled'
  /** 传输进度百分比 (0-100) */
  progress: number
  /** 本地文件路径 */
  localPath: string
  /** 远程文件路径 */
  remotePath: string
  /** 文件总大小（字节） */
  size: number
  /** 已传输的字节数 */
  transferred: number
  /** 子节点数组（仅文件夹类型有） */
  children?: TransferNode[]
  /** 是否展开（仅文件夹类型有效） */
  expanded?: boolean
  /** 关联的传输任务 ID */
  taskId?: string
  /** 错误信息（传输失败时填写） */
  error?: string
}
```

#### 4.1.2 TransferTask

```typescript
export interface TransferTask {
  id: string
  type: 'upload' | 'download'
  status: 'pending' | 'active' | 'completed' | 'cancelled'
  nodes: TransferNode[]
  createdAt: number
  completedAt?: number
}
```

### 4.2 服务层

#### 4.2.1 SFTP 服务基础

**文件**：`src/renderer/src/services/sftp.ts`

```typescript
import { sshConnection } from './ssh'

export class SftpService {
  private sftpClient: any = null
  
  async connect() {
    // 建立 SFTP 连接
  }
  
  async disconnect() {
    // 断开 SFTP 连接
  }
  
  async listFiles(remotePath: string) {
    // 列出远程目录文件
  }
  
  async deleteFile(remotePath: string) {
    // 删除远程文件
  }
  
  async mkdir(remotePath: string) {
    // 创建远程目录
  }
}
```

#### 4.2.2 文件上传

```typescript
async upload(
  localPath: string,
  remotePath: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  // 实现文件上传逻辑
  // 支持进度回调
}
```

#### 4.2.3 文件下载

```typescript
async download(
  remotePath: string,
  localPath: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  // 实现文件下载逻辑
  // 支持进度回调
}
```

#### 4.2.4 文件夹上传

```typescript
async uploadFolder(
  localPath: string,
  remotePath: string,
  onProgress?: (node: TransferNode) => void
): Promise<void> {
  // 递归上传文件夹
  // 深度优先遍历
  // 实时更新进度
}
```

#### 4.2.5 取消上传

```typescript
async cancelUpload(taskId: string): Promise<void> {
  // 取消正在进行的上传任务
  // 清理资源
}
```

### 4.3 状态管理层

#### 4.3.1 全局状态管理

**文件**：`src/renderer/src/components/session/sftp/globalState.ts`

```typescript
let globalContextMenuOwner: 'local' | 'remote' | null = null
const closeMenuCallbacks: Map<'local' | 'remote', () => void> = new Map()

export function requestContextMenu(
  owner: 'local' | 'remote',
  closeCallback: () => void
): boolean {
  // 如果当前所有者就是自己，直接返回 true
  if (globalContextMenuOwner === owner) {
    return true
  }
  
  // 如果当前有其他组件在显示菜单，通知它关闭
  if (globalContextMenuOwner && globalContextMenuOwner !== owner) {
    const otherCloseCallback = closeMenuCallbacks.get(globalContextMenuOwner)
    if (otherCloseCallback) {
      otherCloseCallback()
    }
  }
  
  // 设置自己为当前所有者
  setContextMenuOwner(owner, closeCallback)
  return true
}

export function closeContextMenu(owner: 'local' | 'remote'): void {
  // 关闭指定组件的右键菜单
  if (globalContextMenuOwner === owner) {
    globalContextMenuOwner = null
  }
}
```

### 4.4 组件层

#### 4.4.1 SftpLocal 组件

**文件**：`src/renderer/src/components/session/sftp/SftpLocal.vue`

**功能**：
- 显示本地文件列表
- 支持右键菜单
- 支持拖拽上传
- 触发上传事件

**Props**：
```typescript
{
  currentPath: string,
  files: Array<any>,
  contextMenuVisible: boolean,
  contextMenuPosition: {x: number, y: number},
  selectedFile: any
}
```

**Events**：
- `upload` - 上传文件
- `mkdir` - 新建文件夹
- `delete` - 删除文件
- `contextmenu` - 右键菜单

#### 4.4.2 SftpRemote 组件

**文件**：`src/renderer/src/components/session/sftp/SftpRemote.vue`

**功能**：
- 显示远程文件列表
- 支持右键菜单
- 支持拖拽下载
- 触发下载事件

**Props**：
```typescript
{
  currentPath: string,
  files: Array<any>,
  contextMenuVisible: boolean,
  contextMenuPosition: {x: number, y: number},
  selectedFile: any
}
```

**Events**：
- `download` - 下载文件
- `mkdir` - 新建文件夹
- `delete` - 删除文件
- `contextmenu` - 右键菜单

#### 4.4.3 SftpTransfer 组件

**文件**：`src/renderer/src/components/session/sftp/SftpTransfer.vue`

**功能**：
- 主容器组件
- 协调 SftpLocal 和 SftpRemote
- 管理传输任务
- 处理上传/下载事件

**State**：
```typescript
{
  transferNodes: TransferNode[],
  globalContextMenuOwner: 'local' | 'remote' | null
}
```

#### 4.4.4 SftpStatusBar 组件

**文件**：`src/renderer/src/components/session/sftp/SftpStatusBar.vue`

**功能**：
- 显示传输状态栏
- 集成 SftpTransferTree 组件
- 支持展开/折叠

#### 4.4.5 SftpTransferTree 组件

**文件**：`src/renderer/src/components/session/sftp/SftpTransferTree.vue`

**功能**：
- 树形显示传输任务
- 支持展开/折叠
- 递归显示子节点

#### 4.4.6 TreeNode 组件

**文件**：`src/renderer/src/components/session/sftp/TreeNode.vue`

**功能**：
- 显示单个传输节点
- 显示进度条
- 显示状态图标
- 支持取消按钮

---

## 5. 文件清单

### 5.1 组件文件

| 文件路径 | 功能描述 | 状态 |
|----------|----------|------|
| `src/renderer/src/components/session/sftp/SftpLocal.vue` | 本地文件面板 | ✅ |
| `src/renderer/src/components/session/sftp/SftpRemote.vue` | 远程文件面板 | ✅ |
| `src/renderer/src/components/session/sftp/SftpTransfer.vue` | 主容器组件 | ✅ |
| `src/renderer/src/components/session/sftp/SftpStatusBar.vue` | 状态栏组件 | ✅ |
| `src/renderer/src/components/session/sftp/SftpTransferTree.vue` | 传输树组件 | ✅ |
| `src/renderer/src/components/session/sftp/TreeNode.vue` | 树节点组件 | ✅ |

### 5.2 状态管理文件

| 文件路径 | 功能描述 | 状态 |
|----------|----------|------|
| `src/renderer/src/components/session/sftp/globalState.ts` | 全局状态管理 | ✅ |
| `src/renderer/src/components/session/sftp/globalState.test.ts` | 状态管理测试 | ✅ |

### 5.3 服务层文件

| 文件路径 | 功能描述 | 状态 |
|----------|----------|------|
| `src/renderer/src/services/sftp.ts` | SFTP 服务 | ✅ |

### 5.4 类型定义文件

| 文件路径 | 功能描述 | 状态 |
|----------|----------|------|
| `src/shared/types/index.ts` | TransferNode, TransferTask | ✅ |

### 5.5 测试文件

| 文件路径 | 功能描述 | 状态 |
|----------|----------|------|
| `e2e/sftp.e2e.spec.ts` | SFTP 功能 E2E 测试 | ✅ |

---

## 6. 验收标准

### 6.1 功能验收

- [x] 能够上传单个文件
- [x] 能够上传文件夹（递归）
- [x] 能够下载单个文件
- [x] 能够下载文件夹（递归）
- [x] 能够新建文件夹
- [x] 能够删除文件
- [x] 能够取消传输
- [x] 右键菜单正常工作

### 6.2 技术验收

- [x] 所有 E2E 测试通过
- [x] TypeScript 类型检查无错误
- [x] ESLint 检查无错误
- [x] 组件通信正常
- [x] 状态管理正确

### 6.3 性能验收

- [x] 大文件传输稳定
- [x] 大量小文件传输正常
- [x] 深层嵌套文件夹处理正确
- [x] 进度显示流畅

---

## 7. 相关文档

- [Phase 2 Plan](../plan.md)
- [SFTP PRD](./prd.md)
- [SFTP 组件共享状态](../../../components/sftp/share.md)

---

## 8. 更新日志

| 日期 | 版本 | 更新内容 | 作者 |
|------|------|----------|------|
| 2026-04-08 | V1.0 | 初始版本 | - |
