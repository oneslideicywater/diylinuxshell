# SFTP 传输状态树形列表增强功能 PRD

## 1. 概述

### 1.1 文档目的
本文档描述 SFTP 文件传输状态树形列表的增强功能需求，包括展开/折叠控制功能。

### 1.2 背景
当前 SFTP 传输状态树形列表在传输大量文件时，所有节点默认展开，导致列表过长，用户难以快速定位和查看关键信息。需要增加展开/折叠控制功能，提升用户体验。

## 2. 功能需求

### 2.1 功能列表

#### 2.1.1 每个传输任务新增展开/折叠按钮
- **需求描述**：在每个传输任务（树节点）的文件夹图标旁边新增展开/折叠按钮
- **功能细节**：
  - 文件夹节点：显示展开/折叠按钮（三角形图标）
  - 文件节点：不显示展开/折叠按钮
  - 默认状态：所有节点默认折叠
  - 点击行为：点击按钮切换展开/折叠状态

#### 2.1.2 展开/折叠行为规则
- **单击文件夹展开按钮**：
  - 只展开/折叠该文件夹的直接子节点（孩子）
  - 不递归展开/折叠孙子节点
  - 保持其他分支的展开/折叠状态不变

- **示例**：
  ```
  初始状态（默认折叠）：
  ▼ memcached-operator/
    ▼ api/
    ▼ bin/
    ▼ config/
  
  点击 api 的展开按钮后：
  ▼ memcached-operator/
    ▼ api/
      ▼ v1alpha1/        ← 只展开直接孩子，孙子 v1alpha1 的内容不展开
        groupversion_info.go
        memcached_types.go
    ▼ bin/
    ▼ config/
  ```

#### 2.1.3 全部展开/全部折叠按钮
- **需求描述**：在每个传输任务根节点上方提供"全部展开"和"全部折叠"按钮
- **按钮位置**：传输树容器顶部，取消上传按钮旁边
- **按钮样式**：
  - 全部展开：使用向右的双箭头图标（»）或文字"全部展开"
  - 全部折叠：使用向左的双箭头图标（«）或文字"全部折叠"
- **功能行为**：
  - 点击"全部展开"：递归展开当前传输任务下的所有节点
  - 点击"全部折叠"：递归折叠当前传输任务下的所有节点（只保留根节点）
  - 按钮显示/隐藏：当没有传输任务时隐藏按钮

## 3. UI/UX 设计

### 3.1 界面布局

```
┌─────────────────────────────────────────────────────────────┐
│  [全部展开] [全部折叠]                           [取消上传]  │
├─────────────────────────────────────────────────────────────┤
│ ▼ memcached-operator/        已完成  100%                   │
│   ▼ api/                     已完成  100%                   │
│     ▼ v1alpha1/              已完成  100%                   │
│       📄 groupversion...     已完成  100%                   │
│       📄 memcached_types...  已完成  100%                   │
│   ▼ bin/                     已完成  100%                   │
│     📄 controller-gen        已完成  100%                   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 图标设计
- **展开按钮**：▶ (右向三角形，Unicode: U+25B6)
- **折叠按钮**：▼ (下向三角形，Unicode: U+25BC)
- **全部展开**：» (右双箭头，Unicode: U+00BB) 或 📂
- **全部折叠**：« (左双箭头，Unicode: U+00AB) 或 📁

### 3.3 交互细节
- **悬停效果**：按钮悬停时显示背景色高亮
- **点击反馈**：点击时有轻微的视觉反馈（颜色变化或背景变化）
- **展开/折叠动画**：可选的平滑展开/折叠动画（CSS transition）

## 4. 技术实现要点

### 4.1 数据结构

```typescript
// 传输节点
interface TransferNode {
  id: string
  name: string
  type: 'file' | 'folder'
  isDirectory: boolean
  status: 'pending' | 'transferring' | 'completed' | 'error' | 'cancelled'
  progress: number
  size: number
  transferred: number
  localPath: string
  remotePath: string
  speed: number
  remaining: string
  elapsed: string
  children?: TransferNode[]
  expanded?: boolean  // 新增：展开状态
  taskId?: string     // 所属任务 ID
  error?: string
}

// 传输任务
interface TransferTask {
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

### 4.2 组件设计

#### 4.2.1 SftpStatusContainer 组件

**Props**:
```typescript
interface Props {
  localFileCount: number      // 本地文件数量
  remoteFileCount: number     // 远程文件数量
  status: 'ready' | 'transferring' | 'uploading' | 'downloading' | 'deleting'
  currentPath?: string        // 当前操作的文件路径
  transferTasks: TransferTask[] // 传输任务数组（核心改动）
}
```

**职责**：
- 接收 `transferTasks: TransferTask[]` 数组
- 管理所有传输任务的显示状态
- 提供任务级别的交互功能（如取消整个任务）
- 合并所有任务的节点到内部 `transferNodes` 数组
- 传递给 `SftpStatusHeader` 和 `SftpTransferTreeNode` 显示

**内部状态**：
```typescript
const internalTransferTasks = ref<TransferTask[]>([])
const internalTransferNodes = computed(() => {
  // 合并所有任务的节点
  return internalTransferTasks.value.flatMap(task => task.nodes)
})
```

#### 4.2.2 SftpStatusHeader 组件

**Props**:
```typescript
interface Props {
  nodes: TransferNode[]  // 传输节点列表（平铺）
}
```

**职责**：
- 显示表头列（名称、状态、进度、大小、本地路径、远程路径、速度、剩余时间、经过时间）
- 渲染节点树列表
- 调用 `SftpTransferTreeNode` 显示每个节点

#### 4.2.3 数据流

```
SftpLocal (uploadTasks: TransferTask[])
    ↓ emit('upload-tasks-update', tasks)
SftpTransfer
    ↓ merge
SftpRemote (downloadTasks: TransferTask[])
    ↓ emit('download-tasks-update', tasks)
SftpTransfer
    ↓ :transferTasks="mergedTasks"
SftpStatusContainer
    ↓ computed: transferNodes = tasks.flatMap(t => t.nodes)
SftpStatusHeader (:nodes="transferNodes")
    ↓ v-for="node in nodes"
SftpTransferTreeNode
```

### 4.3 状态管理

**组件间状态同步**：
- 每个节点的 `expanded` 状态独立管理
- 根节点默认 `expanded: false`
- 子节点继承父节点的展开状态（但不自动展开）
- 任务级别的 `status` 由所有子节点状态聚合计算

### 4.4 关键函数

```typescript
// 切换单个节点的展开状态
function toggleExpand(nodeId: string): void

// 递归展开所有节点
function expandAll(taskId: string): void

// 递归折叠所有节点
function collapseAll(taskId: string): void

// 只展开直接子节点（不递归）
function expandDirectChildren(nodeId: string): void

// 取消整个传输任务
function cancelTask(taskId: string): void

// 合并所有任务的节点
function mergeNodes(tasks: TransferTask[]): TransferNode[] {
  return tasks.flatMap(task => task.nodes)
}
```

## 5. 验收标准

### 5.1 功能验收
- [ ] 所有传输任务节点默认折叠
- [ ] 点击文件夹展开按钮只展开直接子节点
- [ ] 点击"全部展开"按钮展开所有层级节点
- [ ] 点击"全部折叠"按钮折叠所有节点（只保留根节点）
- [ ] 文件节点不显示展开/折叠按钮
- [ ] 展开/折叠状态在传输过程中保持

### 5.2 UI 验收
- [ ] 展开/折叠按钮样式与整体设计一致
- [ ] 按钮悬停、点击有视觉反馈
- [ ] 展开/折叠动画流畅（如果实现）
- [ ] 在浅色和深色主题下都能正常显示

### 5.3 性能验收
- [ ] 大量文件（1000+）传输时展开/折叠操作无明显延迟
- [ ] 展开/折叠操作不引起界面卡顿

## 6. 兼容性要求

### 6.1 主题兼容
- 支持深色主题
- 支持浅色主题

### 6.2 浏览器兼容
- Electron 内置 Chromium 浏览器

## 7. 后续优化建议

### 7.1 可选功能
- 记住用户的展开/折叠偏好
- 支持键盘快捷键（如 Ctrl+E 全部展开，Ctrl+C 全部折叠）
- 支持双击文件夹切换展开/折叠
- 支持右键菜单展开/折叠选项

### 7.2 性能优化
- 虚拟滚动：当节点数量非常多时，考虑实现虚拟滚动
- 懒加载：对于深层嵌套的文件夹，可以按需加载子节点

## 8. 相关文件

- 组件路径：`src/renderer/src/components/session/sftp/status/SftpTransferTreeNode.vue`
- 容器组件：`src/renderer/src/components/session/sftp/status/SftpStatusContainer.vue`
- 主组件：`src/renderer/src/components/session/sftp/SftpTransfer.vue`

## 9. 变更历史

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-04-08 | 1.0 | 初始版本 | AI Assistant |
