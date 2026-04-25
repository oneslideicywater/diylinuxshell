# SFTP 组件架构设计

> 本文档记录 `src/renderer/src/components/terminal/sftp/` 目录的组件架构、模块划分和数据流。

---

## 目录结构

```
src/renderer/src/components/terminal/sftp/
├── fsm/                      # 状态机模块（核心状态管理）
│   ├── TaskStateMachine.ts   # 传输任务状态机（7 状态，含 scanning 阶段）
│   ├── NodeStateMachine.ts   # 传输节点状态机（5 状态，叶子/分支节点）
│   └── __tests__/
│       └── stateMachine.test.ts  # 状态机单元测试（57 个用例）
├── script/                   # 业务脚本和工具函数
│   ├── digest.md            # 模块函数摘要文档
│   ├── delete.ts            # 删除操作（单文件/文件夹/批量）
│   ├── download.ts          # 下载操作（单文件/文件夹/批量）
│   ├── upload.ts            # 上传操作（单文件/文件夹/批量）
│   ├── local.ts             # 本地文件操作（加载、导航、刷新）
│   ├── remote.ts            # 远程文件操作（加载、导航、创建/删除）
│   ├── statusText.ts        # 状态文本工具（根据任务类型返回显示文案）
│   └── utils.ts             # 公共工具函数（格式化、工厂方法）
├── status/                   # 状态显示组件
│   ├── arch.md              # Status 子模块架构文档
│   ├── code.md              # Status 子模块实现文档
│   ├── README.MD            # Status 子模块说明
│   ├── SftpStatusContainer.vue  # 多任务列表容器
│   ├── SftpTaskStatus.vue       # 单任务状态容器
│   ├── SftpStatusHeader.vue     # 固定表头组件
│   ├── ScanningPlaceholderRow.vue # 扫描中占位行
│   └── SftpTransferTreeNode.vue   # 树形节点组件（递归渲染）
├── SftpLocal.vue            # 本地文件浏览器组件
├── SftpRemote.vue           # 远程文件浏览器组件
└── SftpTransfer.vue         # 主容器组件（整合本地、远程、状态显示）
```

---

## 模块说明

### 核心组件层

| 组件 | 职责 | 依赖 |
|------|------|------|
| **SftpTransfer.vue** | 主容器组件，整合本地文件浏览器、远程文件浏览器和底部状态栏 | Pinia Store |
| **SftpLocal.vue** | 本地文件浏览器，支持文件选择、上传、删除、导航等操作 | script/local.ts, script/upload.ts, script/delete.ts |
| **SftpRemote.vue** | 远程文件浏览器，支持文件选择、下载、上传、删除、导航等操作 | script/remote.ts, script/download.ts, script/delete.ts |

### 状态机组（FSM）

**位置**：`fsm/` 目录

| 状态机 | 状态数 | 职责 | 状态流转 |
|--------|--------|------|----------|
| **TaskStateMachine** | 7 状态 | 管理整个传输任务的生命周期 | `pending` → `scanning` → `transferring` → `transferringPartialError` / `completed` / `error` / `cancelled` |
| **NodeStateMachine** | 5 状态 | 管理单个传输节点（文件/文件夹）的生命周期 | `pending` → `transferring` → `completed` / `error` / `cancelled` |

**设计特点**：
- 单例模式，全局导出 `transferTaskFSM` 和 `transferNodeFSM`
- 防止异步竞态导致的非法状态覆盖（如 cancelled 后不可再转为 completed）
- 57 个单元测试覆盖全部状态转换矩阵

### 业务脚本层

**位置**：`script/` 目录

| 模块 | 主要函数 | 职责 |
|------|----------|------|
| **upload.ts** | `uploadFile`, `uploadFolder`, `uploadBatch` | 上传操作（单文件/文件夹/批量），支持递归上传 |
| **download.ts** | `downloadFile`, `downloadFolder`, `downloadBatch` | 下载操作（单文件/文件夹/批量），支持递归下载 |
| **delete.ts** | `deleteSingleItem`, `deleteFolderContent`, `deleteLocalBatch`, `deleteRemoteBatch` | 删除操作（单文件/文件夹/批量），统一树形进度显示 |
| **local.ts** | `loadLocalFiles`, `navigateLocalPath`, `refreshLocalFiles` | 本地文件加载、路径导航、刷新 |
| **remote.ts** | `loadRemoteFiles`, `navigateRemotePath`, `createRemoteFolder` | 远程文件加载、路径导航、创建文件夹 |
| **statusText.ts** | `getStatusText` | 根据任务类型和状态返回显示文案 |
| **utils.ts** | 格式化工具、节点工厂方法 | 公共工具函数 |

**安全架构 v4 特点**：
1. 直接使用 `sftpConnectionId`，不再依赖 session 对象
2. 两阶段策略：先创建占位任务入 Store，再异步扫描子项
3. 支持任务取消机制（真正的取消）
4. 统一的树形进度显示（类似 Xshell）

### 状态显示组件层

**位置**：`status/` 目录

详见 [status/arch.md](./status/arch.md)

**组件层级**：
```
SftpStatusContainer.vue          ← 多任务列表容器（外层）
└── SftpTaskStatus.vue           ← 单个任务状态容器
    ├── SftpStatusHeader.vue     ← 固定表头（列名行）
    ├── ScanningPlaceholderRow.vue ← 扫描中占位行（root 为空时）
    └── SftpTransferTreeNode.vue  ← 树形节点（递归渲染文件/文件夹）
```

**核心特性**：
- 表头 - 内容同步滚动机制（内容区持有滚动条，表头 transform 跟随）
- 11 列显示：复选框、名称、状态、进度、大小、本地路径、远程路径、速度、剩余时间、经过时间、操作
- 树形结构展示（支持展开/折叠）
- 实时进度更新（通过 Pinia Store reactive 特性）

---

## 数据流架构

### 状态管理

- **Pinia Store**：`useSftpTransferStore` 统一管理所有传输任务状态
- **FSM 保护**：状态转换必须通过 `transferTaskFSM.canTransition()` 和 `transferNodeFSM.canTransition()` 验证
- **组件状态**：`SftpLocal`、`SftpRemote` 各自管理文件列表、当前路径等 UI 状态

### 数据传输流程

#### 上传流程
```
用户选择文件 → SftpLocal.vue
  → uploadFile/uploadFolder/uploadBatch (script/upload.ts)
    → 创建 TransferNode（pending 状态）
    → 调用 IPC API（主进程 SFTP 服务）
    → 实时进度回调 → Store 更新节点状态
    → FSM 验证状态转换 → 渲染树形进度
```

#### 下载流程
```
用户选择远程文件 → SftpRemote.vue
  → downloadFile/downloadFolder/downloadBatch (script/download.ts)
    → 创建 TransferNode（pending 状态）
    → 两阶段：先 scanning 扫描远程文件夹 → transferring 传输
    → 调用 IPC API（主进程 SFTP 服务）
    → 实时进度回调 → Store 更新节点状态
    → FSM 验证状态转换 → 渲染树形进度
```

#### 删除流程
```
用户选择文件 → SftpLocal.vue / SftpRemote.vue
  → deleteLocalBatch / deleteRemoteBatch (script/delete.ts)
    → 创建 TransferNode（pending 状态）
    → scanIntoNodeForDelete 扫描待删除内容
    → 递归删除（显示删除进度）
    → Store 更新节点状态
```

### IPC 通信

```
渲染进程（Vue 组件）
  ↔ script/*.ts（业务逻辑）
    ↔ IPC API（@renderer/api/sftp.ts）
      ↔ 主进程（@main/ipc/sftp.ts）
        ↔ SSH2 SFTP Client
```

---

## 设计决策

### 1. FSM 状态机引入

**问题**：异步竞态导致非法状态覆盖（用户取消后，后台异步回调仍将 cancelled 改为 completed）

**解决**：
- 引入 TaskStateMachine（7 状态）和 NodeStateMachine（5 状态）
- 所有状态转换必须通过 `canTransition()` 验证
- 终态保护：`completed`、`error`、`cancelled` 不可再转换

### 2. 两阶段策略

**问题**：递归上传/下载时，无法提前知道总文件数和总大小

**解决**：
- 第一阶段（scanning）：创建占位根节点，异步扫描子项
- 第二阶段（transferring）：逐个传输已扫描的子项
- 支持取消：用户可在 scanning 阶段取消任务

### 3. 统一树形进度显示

**问题**：删除操作也需要显示进度（类似上传/下载）

**解决**：
- 删除操作也使用 TransferNode 树形结构
- scanIntoNodeForDelete 递归扫描待删除内容
- 统一在 SftpStatusContainer 中显示

### 4. 直接使用 sftpConnectionId

**问题**：依赖 session 对象导致耦合严重

**解决**：
- 所有函数直接接收 `sftpConnectionId: string`
- 主进程通过 ID 查找对应的 SFTP 连接
- 降低耦合，提高可测试性

---

## 测试覆盖

| 测试类型 | 文件 | 用例数 | 覆盖内容 |
|----------|------|--------|----------|
| **单元测试** | fsm/__tests__/stateMachine.test.ts | 57 | Task FSM（7 状态）、Node FSM（5 状态）全部转换矩阵 |
| **E2E 测试** | e2e/specs/sftp/*.e2e.spec.ts | 19+ | 上传、下载、删除、取消、树形展开/折叠、右键菜单互斥等 |

---

## 相关文档

- [script/digest.md](./script/digest.md) - 业务脚本函数摘要
- [status/arch.md](./status/arch.md) - Status 子模块架构
- [status/code.md](./status/code.md) - Status 子模块实现细节
