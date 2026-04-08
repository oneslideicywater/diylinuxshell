# SFTP 文件上传功能 - 实现计划

## 1. 概述

本文档详细描述 SFTP 文件上传功能的实现计划，包括单文件上传、文件夹上传、上传取消等功能。

**预计工期**：1-2 天

**前置依赖**：Phase 1 核心功能已完成，SFTP 基础服务已实现

---

## 2. 任务清单

### 2.1 服务层

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| UPLOAD-1 | 实现单文件上传 | sftp.ts/upload | SFTP 服务基础 | P0 | 待开始 |
| UPLOAD-2 | 实现文件上传进度监听 | sftp.ts/upload | UPLOAD-1 | P0 | 待开始 |
| UPLOAD-3 | 实现文件夹上传（递归） | sftp.ts/uploadFolder | UPLOAD-1 | P1 | 待开始 |
| UPLOAD-4 | 实现上传任务管理 | uploadManager.ts | UPLOAD-1 | P0 | 待开始 |
| UPLOAD-5 | 实现取消上传功能 | sftp.ts/cancelUpload | UPLOAD-4 | P1 | 待开始 |
| UPLOAD-6 | 实现断点续传（可选） | sftp.ts/resumeUpload | UPLOAD-1 | P2 | 待评估 |

### 2.2 状态管理层

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| UPLOAD-7 | 实现上传任务状态管理 | globalState.ts | UPLOAD-4 | P0 | 待开始 |
| UPLOAD-8 | 实现上传进度更新 | globalState.ts | UPLOAD-2 | P0 | 待开始 |

### 2.3 组件层

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| UPLOAD-9 | 实现状态头组件（表头） | SftpStatusHeader.vue | UPLOAD-7 | P0 | 已完成 |
| UPLOAD-10 | 实现树节点组件 | SftpTransferTreeNode.vue | UPLOAD-7 | P0 | 已完成 |
| UPLOAD-11 | 实现文件夹展开/收起功能 | SftpTransferTreeNode.vue | UPLOAD-10 | P1 | 已完成 |
| UPLOAD-21 | 实现状态容器组件 | SftpStatusContainer.vue | UPLOAD-9 | P0 | 已完成 |

### 2.4 类型定义

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| UPLOAD-12 | 定义 TransferNode 类型 | types/sftp.ts | - | P0 | 待开始 |
| UPLOAD-13 | 定义 TransferTask 类型 | types/sftp.ts | - | P0 | 待开始 |
| UPLOAD-14 | 定义 UploadOptions 类型 | types/upload.ts | - | P0 | 待开始 |

### 2.5 组件层增强

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| UPLOAD-22 | SftpLocal 增加上传任务数组 | SftpLocal.vue | UPLOAD-7 | P0 | 待开始 |
| UPLOAD-23 | SftpRemote 增加下载任务数组 | SftpRemote.vue | UPLOAD-7 | P0 | 待开始 |

### 2.6 测试

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| UPLOAD-16 | 编写单文件上传 E2E 测试 | upload.e2e.spec.ts | UPLOAD-1 | P1 | 待开始 |
| UPLOAD-17 | 编写文件夹上传 E2E 测试 | upload.e2e.spec.ts | UPLOAD-3 | P1 | 待开始 |
| UPLOAD-18 | 编写取消上传 E2E 测试 | upload.e2e.spec.ts | UPLOAD-5 | P1 | 待开始 |
| UPLOAD-19 | 编写树形进度 E2E 测试 | upload.e2e.spec.ts | UPLOAD-9 | P1 | 待开始 |
| UPLOAD-20 | 编写展开/收起 E2E 测试 | upload.e2e.spec.ts | UPLOAD-11 | P1 | 待开始 |

---

## 3. 实现顺序

| 阶段 | 序号 | 任务 | 产出物 | 依赖 | 说明 |
|------|------|------|--------|------|------|
| 1. 类型定义 | UPLOAD-12 | 定义 TransferNode 类型 | types/sftp.ts | - | 定义传输节点数据结构 |
| 1. 类型定义 | UPLOAD-13 | 定义 TransferTask 类型 | types/sftp.ts | - | 定义上传任务数据结构 |
| 1. 类型定义 | UPLOAD-14 | 定义 UploadOptions 类型 | types/upload.ts | - | 定义上传配置选项 |
| 2. 服务层 | UPLOAD-1 | 实现单文件上传 | sftp.ts/upload | 类型定义 | 基础上传功能 |
| 2. 服务层 | UPLOAD-2 | 实现文件上传进度监听 | sftp.ts/upload | UPLOAD-1 | 实时进度回调 |
| 2. 服务层 | UPLOAD-4 | 实现上传任务管理 | uploadManager.ts | UPLOAD-1 | 任务队列管理 |
| 2. 服务层 | UPLOAD-5 | 实现取消上传功能 | sftp.ts/cancelUpload | UPLOAD-4 | 支持取消任务 |
| 2. 服务层 | UPLOAD-3 | 实现文件夹上传（递归） | sftp.ts/uploadFolder | UPLOAD-1 | 递归上传 |
| 3. 状态管理层 | UPLOAD-7 | 实现上传任务状态管理 | globalState.ts | UPLOAD-4 | 全局状态管理 |
| 3. 状态管理层 | UPLOAD-8 | 实现上传进度更新 | globalState.ts | UPLOAD-2 | 进度状态同步 |
| 4. 组件层 | UPLOAD-9 | 实现状态头组件（表头） | SftpStatusHeader.vue | UPLOAD-7 | 显示固定的表头列 |
| 4. 组件层 | UPLOAD-10 | 实现树节点组件 | SftpTransferTreeNode.vue | UPLOAD-7 | 显示每个节点的实时进度 |
| 4. 组件层 | UPLOAD-11 | 实现文件夹展开/收起功能 | SftpTransferTreeNode.vue | UPLOAD-10 | 支持递归展开/折叠 |
| 4. 组件层 | UPLOAD-21 | 实现状态容器组件 | SftpStatusContainer.vue | UPLOAD-9 | 整合状态显示和树形列表 |
| 4. 组件层增强 | UPLOAD-22 | SftpLocal 增加上传任务数组 | SftpLocal.vue | UPLOAD-7 | 维护上传任务列表 |
| 4. 组件层增强 | UPLOAD-23 | SftpRemote 增加下载任务数组 | SftpRemote.vue | UPLOAD-7 | 维护下载任务列表 |
| 5. 测试 | UPLOAD-16 | 编写单文件上传 E2E 测试 | upload.e2e.spec.ts | UPLOAD-1 | 基础功能测试 |
| 5. 测试 | UPLOAD-17 | 编写文件夹上传 E2E 测试 | upload.e2e.spec.ts | UPLOAD-3 | 递归上传测试 |
| 5. 测试 | UPLOAD-18 | 编写取消上传 E2E 测试 | upload.e2e.spec.ts | UPLOAD-5 | 取消功能测试 |
| 5. 测试 | UPLOAD-19 | 编写树形进度 E2E 测试 | upload.e2e.spec.ts | UPLOAD-9 | 树形进度测试 |
| 5. 测试 | UPLOAD-20 | 编写展开/收起 E2E 测试 | upload.e2e.spec.ts | UPLOAD-11 | 交互功能测试 |

---

## 4. 技术要点

### 4.1 类型定义

#### 4.1.1 TransferNode（传输节点）

```typescript
export interface TransferNode {
  id: string              // 唯一标识
  name: string            // 文件/文件夹名称
  type: 'file' | 'folder' // 类型
  status: 'transferring' | 'completed' | 'failed' | 'cancelled' // 状态
  progress: number        // 进度 0-100
  localPath: string       // 本地路径
  remotePath: string      // 远程路径
  size: number            // 文件大小
  transferred: number     // 已传输大小
  children?: TransferNode[] // 子节点（文件夹）
  expanded?: boolean      // 是否展开
  taskId?: string         // 传输任务 ID
  error?: string          // 错误信息
}
```

#### 4.1.2 TransferTask（传输任务）

```typescript
export interface TransferTask {
  id: string              // 任务 ID
  type: 'upload' | 'download' // 传输类型
  status: 'pending' | 'active' | 'completed' | 'cancelled' // 任务状态
  nodes: TransferNode[]   // 传输节点列表
  
  // 传输进度统计
  totalBytes: number      // 待传输的总字节数
  transferredBytes: number // 已传输的字节数
  
  // 时间统计
  remainingTime: number // 还需多长时间完成传输（秒）
  elapsedTime: number   // 已消耗时间（秒）
  
  createdAt: number       // 创建时间
  completedAt?: number    // 完成时间
}
```

### 4.2 组件层增强

#### 4.2.1 SftpLocal 组件

**新增上传任务数组**：
```typescript
const uploadTasks = ref<TransferTask[]>([])
```

**职责**：
- 维护当前所有上传任务的列表
- 通过 `defineExpose` 暴露 `uploadTasks` 给父组件
- 父组件可以通过 `localPanelRef.value?.uploadTasks` 访问上传任务列表
- 用于在树形进度组件中显示所有上传任务的实时状态

**任务更新机制**：
- 调用 `uploadFile` 函数时，创建 `TransferTask` 和 `TransferNode`
- 通过 `emitUploadTasks` 回调发送任务更新事件
- 实时更新任务的 `transferredBytes`、`totalBytes`、`elapsedTime`、`remainingTime` 等字段
- 传输完成后更新 `status` 和 `completedAt`

#### 4.2.2 SftpRemote 组件

**新增下载任务数组**：
```typescript
const downloadTasks = ref<TransferTask[]>([])
```

**职责**：
- 维护当前所有下载任务的列表
- 通过 `defineExpose` 暴露 `downloadTasks` 给父组件
- 父组件可以通过 `remotePanelRef.value?.downloadTasks` 访问下载任务列表
- 用于在树形进度组件中显示所有下载任务的实时状态

**任务更新机制**：
- 调用 `downloadFile` 函数时，创建 `TransferTask` 和 `TransferNode`
- 通过 `emitDownloadTasks` 回调发送任务更新事件
- 实时更新任务的进度统计字段
- 传输完成后更新状态

### 4.3 父组件协调机制

**SftpTransfer 组件职责**：
- 通过 `localPanelRef` 和 `remotePanelRef` 访问子组件的任务数组
- 监听 `upload-tasks-update` 和 `download-tasks-update` 事件
- 传递给 `SftpStatusContainer` 组件显示

**任务合并逻辑**：
```typescript
// 处理上传任务更新
function handleUploadTasksUpdate(tasks: TransferTask[]): void {
  const uploadNodes = tasks.flatMap(task => task.nodes)
  const downloadNodes = remotePanelRef.value?.downloadTasks?.flatMap(task => task.nodes) || []
  transferNodes.value = [...uploadNodes, ...downloadNodes]
}

// 处理下载任务更新
function handleDownloadTasksUpdate(tasks: TransferTask[]): void {
  const uploadNodes = localPanelRef.value?.uploadTasks?.flatMap(task => task.nodes) || []
  const downloadNodes = tasks.flatMap(task => task.nodes)
  transferNodes.value = [...uploadNodes, ...downloadNodes]
}
```

### 4.4 组件架构说明

**重要设计原则**：

1. **TransferTask 与 TransferNode 的关系**：
   - 每个 `TransferTask` 代表一个独立的传输任务（单文件上传、文件夹上传等）
   - 每个 `TransferTask` 包含一个 `TransferNode[]` 数组
   - 单文件任务：1 个节点
   - 文件夹任务：多个节点（根节点 + 子节点）

2. **SftpStatusHeader 组件设计**：
   - `SftpStatusHeader` 组件接收 `TransferNode[]` 数组
   - 显示所有任务的节点列表
   - **不区分任务边界**，所有节点平铺显示
   - 通过 `taskId` 字段可以追溯到所属任务

3. **为什么需要合并节点**：
   - 所有传输任务（上传 + 下载）共享一个树形列表显示
   - 用户可以看到所有正在进行的传输任务
   - 避免多个状态头组件互相干扰
   - 统一的进度管理和显示

4. **任务隔离性**：
   - 虽然节点合并显示，但每个任务的状态是独立的
   - 取消单个任务不影响其他任务
   - 每个任务的进度统计独立计算
   - 任务完成后状态独立更新

**架构图**：
```
SftpLocal (uploadTasks: TransferTask[])
    ↓
    ├─ task1.nodes[0] ──┐
    ├─ task2.nodes[...] ──┼──> transferNodes[] ──> SftpStatusHeader
    └─ ...               │
                         │
SftpRemote (downloadTasks: TransferTask[])
    ↓
    ├─ task3.nodes[0] ──┐
    ├─ task4.nodes[...] ──┘
```

### 4.5 文件上传流程

1. 选择要上传的文件
2. 创建上传任务
3. 建立 SFTP 连接
4. 读取本地文件内容
5. 写入远程服务器
6. 监听上传进度
7. 更新任务状态
8. 关闭连接

### 4.6 文件夹上传流程

1. 递归遍历文件夹结构
2. 在远程服务器创建对应目录
3. 逐个上传文件
4. 维护文件夹上传进度

### 4.7 取消上传

1. 维护上传任务列表
2. 支持取消单个任务
3. 支持取消所有任务
4. 清理已上传的部分文件

---

## 5. 风险点

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 大文件上传中断 | 需要重新上传 | 考虑实现断点续传 |
| 文件夹层级过深 | 递归性能问题 | 限制最大递归深度 |
| 网络不稳定 | 上传失败 | 增加重试机制 |
| 权限不足 | 无法写入 | 提前检查权限并提示 |

---

## 6. 验收标准

- [ ] 单文件上传功能正常
- [ ] 文件夹递归上传功能正常
- [ ] 上传进度实时显示
- [ ] 支持取消上传
- [ ] 错误处理完善
- [ ] E2E 测试全部通过
