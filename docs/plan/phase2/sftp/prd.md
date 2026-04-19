# SFTP 文件传输功能 - 产品需求文档

## 1. 文档信息

| 项目 | 内容 |
|------|------|
| 产品名称 | DIY-Linux-Shell |
| 版本 | V1.1 |
| 阶段 | Phase 2 |
| 文档状态 | 已完成 |
| 更新日期 | 2026-04-08 |
| 父文档 | [Phase 2 PRD](../prd.md) |

---

## 2. 产品概述

### 2.1 功能定位

SFTP 文件传输功能提供类似 Xftp 的双面板文件管理界面，支持本地和远程服务器之间的文件传输，满足用户在本地和远程服务器之间高效传输文件的需求。

### 2.2 核心价值

| 价值点 | 说明 |
|--------|------|
| 直观操作 | 双面板设计，本地和远程文件并列显示 |
| 高效传输 | 支持拖拽、右键菜单等多种传输方式 |
| 进度可视 | 树形传输状态显示，实时掌握传输进度 |
| 批量操作 | 支持多文件选择和批量传输 |

---

## 3. 功能需求

### 3.1 功能列表

| 功能模块 | 功能点 | 优先级 | 状态 |
|----------|--------|--------|------|
| 基础 UI | 双面板布局 | P0 | ✅ |
| 基础 UI | 本地文件列表 | P0 | ✅ |
| 基础 UI | 远程文件列表 | P0 | ✅ |
| 基础 UI | 工具栏 | P0 | ✅ |
| 文件操作 | 文件上传 | P0 | ✅ |
| 文件操作 | 文件下载 | P0 | ✅ |
| 文件操作 | 新建文件夹 | P0 | ✅ |
| 文件操作 | 删除文件 | P0 | ✅ |
| 文件操作 | 文件夹上传（递归） | P1 | ✅ |
| 文件操作 | 文件夹下载（递归） | P1 | ✅ |
| 右键菜单 | 本地右键菜单 | P1 | ✅ |
| 右键菜单 | 远程右键菜单 | P1 | ✅ |
| 右键菜单 | 分布式管理 | P1 | ✅ |
| 进度管理 | 进度状态栏 | P1 | ✅ |
| 进度管理 | 树形传输状态 | P1 | ✅ |
| 进度管理 | 取消传输 | P1 | ✅ |
| 用户体验 | 主题适配 | P2 | ✅ |
| 用户体验 | 右键菜单互斥显示 | P2 | ✅ |


**验收标准**：
- [x] 右键点击弹出对应菜单
- [x] 菜单项根据上下文显示
- [x] 同一时间只有一个菜单显示
- [x] 点击别处菜单关闭


---

## 4. 技术架构

### 4.1 组件结构

```
SftpTransfer.vue (主组件)
├── SftpLocal.vue (本地文件面板)
├── SftpRemote.vue (远程文件面板)
└── SftpStatusContainer.vue (状态容器)
    ├── SftpTaskStatus.vue (单个任务状态 - 新增)
    │   ├── SftpStatusHeader.vue (状态头 - 表头)
    │   └── SftpTransferTreeNode.vue (树节点)
    ├── SftpTaskStatus.vue (第二个任务)
    │   ├── SftpStatusHeader.vue
    │   └── SftpTransferTreeNode.vue
    └── ... (多个任务实例)
```

### 4.2 状态管理

**Pinia Store**：
- `useSftpStore()`: SFTP 状态管理 Store
- `transferTasks: TransferTask[]`: 传输任务数组（响应式）

**状态说明**：
- `transferTasks`: 传输任务数组，每个 `TransferTask` 包含一个根节点 `root: TransferNode`，用于管理传输任务
- `globalContextMenuOwner`: 用于管理右键菜单的分布式状态，确保同一时间只有一个菜单显示

**组件职责**：
- `SftpLocal`: 本地文件面板组件，触发上传事件
- `SftpRemote`: 远程文件面板组件，触发下载事件
- `SftpTransfer`: 主容器组件，协调各子组件，调用 Store 更新任务状态
- `SftpStatusContainer`: 状态容器组件，从 Store 读取 `transferTasks`，遍历渲染多个 `SftpTaskStatus` 组件
- `SftpTaskStatus`: **任务状态组件**，接收单个 `TransferTask`，管理单个任务的树形进度显示
  - 包含 `SftpStatusHeader` 显示表头
  - 包含 `SftpTransferTreeNode` 显示根节点及子节点的传输状态
  - 提供任务级别的操作（取消整个任务、展开/折叠所有节点）
- `SftpStatusHeader`: **仅显示表头列**（名称、状态、进度、大小、本地路径、远程路径、速度、剩余时间、经过时间）
- `SftpTransferTreeNode`: 显示单个节点的传输状态，支持展开/折叠，递归显示子节点

### 4.3 数据流

```
用户操作（上传/下载）
    ↓
SftpLocal / SftpRemote 触发事件
    ↓
SftpTransfer 处理事件
    ↓
创建 TransferTask（根节点 + 任务信息）
    ↓
调用 useSftpStore().addTask(task)
    ↓
Pinia Store 更新 transferTasks 数组（响应式）
    ↓
SftpStatusContainer 自动渲染（v-for="task in store.transferTasks"）
    ↓
SftpTaskStatus (:task="task")
    ↓ :node="task.root"
SftpTransferTreeNode
    ↓ 递归显示子节点（v-for="child in node.children"）
```

### 4.4 组件设计详解

#### 4.4.1 SftpTaskStatus 组件（新增）

**Props**:
```typescript
interface Props {
  task: TransferTask  // 单个传输任务
}
```

**职责**：
- 显示单个传输任务的完整树形进度
- 管理该任务的展开/折叠状态
- 提供任务级别的操作按钮（取消任务、全部展开、全部折叠）
- 显示任务的总体进度统计（总大小、已传输、速度、剩余时间等）
- **维护 `SftpTransferTreeNode` 数组**，管理节点级别的显示和交互

**内部结构**：
```
SftpTaskStatus
├── 任务工具栏
│   ├── 任务标题（文件名/文件夹名）
│   ├── 总体进度条
│   ├── 速度/剩余时间统计
│   ├── [全部展开] [全部折叠] [取消] 按钮
├── SftpStatusHeader
│   └── 表头列（名称、状态、进度、大小、本地路径、远程路径、速度、剩余时间、经过时间）
└── SftpTransferTreeNode (v-for="node in task.nodes")
    └── 递归显示子节点
```

#### 4.4.2 SftpStatusContainer 组件

**Props**:
```typescript
interface Props {
  localFileCount: number
  remoteFileCount: number
  status: 'ready' | 'transferring' | 'uploading' | 'downloading' | 'deleting'
  currentPath?: string
  transferTasks: TransferTask[]  // 传输任务数组
}
```

**职责**：
- 接收并管理所有传输任务
- 遍历 `transferTasks` 数组，为每个任务渲染一个 `SftpTaskStatus` 组件
- 管理全局的展开/折叠状态
- 显示简化的状态栏（文件数量、当前状态）

**模板结构**：
```vue
<template>
  <div class="sftp-status-container">
    <!-- 简化状态栏 -->
    <div class="sftp-footer">
      <div class="footer-item">本地：{{ localFileCount }} 个项目</div>
      <div class="footer-item">远程：{{ remoteFileCount }} 个项目</div>
      <div class="footer-status">状态：{{ status }}</div>
    </div>
    
    <!-- 多个任务状态 -->
    <div class="task-list">
      <SftpTaskStatus
        v-for="task in transferTasks"
        :key="task.id"
        :task="task"
      />
    </div>
  </div>
</template>
```

### 4.5 服务层

**SFTP 服务**：
- `src/renderer/src/services/sftp.ts`
- 提供文件上传、下载、删除等方法
- 支持进度回调
- 支持取消操作

---

### 4.6 右键菜单管理


1. 整个项目全局使用一个右键菜单组件, 所有页面和子组件共用一个. 不重复创建.
2. 全局统一控制右键菜单的显示和隐藏状态, 确保同一时间只有一个菜单显示. 
3. 统一处理, 点击页面空白关闭,按ESC键关闭,鼠标左击关闭.
4. 不同组件可以触发不同的右键菜单栏,菜单内容动态传入.
5. 右键菜单定位跟随鼠标位置.
6. 使用pinia store 管理右键菜单的状态.


右键菜单应该全局唯一，

场景1：

比如我点击了SftpLocal组件的文件，右键菜单显示在该文件上；
我点击了SftpRemote组件的文件夹，右键菜单只显示在该文件夹上;
当前组件点击右键菜单时，应该关闭其他组件的右键菜单。

场景2：

我点击了SftpLocal组件的文件1，右键菜单应该在右键鼠标点击位置显示。我再点击文件2，右键菜单应该在文件2右键鼠标点击位置显示。

场景3:

任意位置点击鼠标左键, 右键菜单应该关闭。




```


---

## 7. 性能优化

### 7.1 大文件传输

- 使用流式传输
- 分块处理
- 避免内存溢出

### 7.2 大量文件传输

- 批量传输优化
- 并发控制
- 进度合并显示

### 7.3 文件夹递归

- 深度优先遍历
- 并发传输子文件
- 树形结构实时更新

---

## 8. 测试用例

### 8.1 功能测试

- [x] 上传单个文件
- [x] 上传文件夹
- [x] 下载单个文件
- [x] 下载文件夹
- [x] 新建文件夹
- [x] 删除文件
- [x] 取消上传
- [x] 右键菜单显示

### 8.2 边界测试

- [x] 超大文件传输
- [x] 大量小文件传输
- [x] 深层嵌套文件夹
- [x] 网络中断处理

### 8.3 UI 测试

- [x] 主题切换
- [x] 右键菜单互斥
- [x] 进度条动画
- [x] 树形展开/折叠

---

## 9. 相关文档

- [Phase 2 PRD](../prd.md)
- [Phase 2 Plan](../plan.md)
- [SFTP 组件共享状态](../../components/sftp/share.md)
- [SFTP 实现计划](./plan.md)

---

## 10. 更新日志

| 日期 | 版本 | 更新内容 | 作者 |
|------|------|----------|------|
| 2026-04-08 | V1.0 | 初始版本 | - |
