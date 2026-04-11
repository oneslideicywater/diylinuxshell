
```
src/renderer/src/components/session/sftp/
├── script/                   # 脚本和工具函数目录
│   ├── index.ts              # 统一导出所有组件和工具函数
│   ├── transfer-tree.ts      # 传输树节点操作工具（创建、更新、扫描节点）
│   ├── local.ts              # 本地文件操作工具函数（上传、删除、加载文件）
│   ├── remote.ts             # 远程文件操作工具函数（上传、下载、删除、加载文件）
│   ├── deleteManager.ts      # 删除任务管理器（管理批量删除任务的执行和取消）
│   ├── globalState.ts        # 全局状态管理（已废弃，由组件自行管理状态）
│   └── globalState.test.ts   # 全局状态测试（已废弃）
├── status/                   # 状态显示相关组件
│   ├── SftpStatusContainer.vue  # 状态容器组件（底部状态栏）
│   ├── SftpStatusHeader.vue     # 状态头组件（表头 + 树形列表）
│   ├── SftpTransferTreeNode.vue # 树节点组件（显示单个传输节点）
│   └── SftpTaskStatus.vue       # 任务状态组件（显示任务进度和详情）
├── SftpLocal.vue             # 本地文件浏览器组件（显示和操作本地文件）
├── SftpRemote.vue            # 远程文件浏览器组件（显示和操作远程文件）
└── SftpTransfer.vue          # 主组件（整合本地、远程和状态显示）
```

## 模块说明

### 核心组件

- **SftpTransfer.vue**: 主容器组件，整合本地文件浏览器、远程文件浏览器和状态显示区域
- **SftpLocal.vue**: 本地文件浏览器，支持文件选择、上传、删除等操作
- **SftpRemote.vue**: 远程文件浏览器，支持文件选择、下载、上传、删除等操作
- **SftpStatusContainer.vue**: 底部状态栏，显示传输任务列表和进度

### 工具模块

- **transfer-tree.ts**: 提供传输节点的创建、更新、扫描等树形结构操作
- **local.ts**: 提供本地文件上传、删除、加载等操作函数
- **remote.ts**: 提供远程文件上传、下载、删除、加载等操作函数
- **deleteManager.ts**: 删除任务管理器，处理批量删除任务的执行和取消

### 状态管理

- 组件状态由各组件自行管理（如 `SftpLocal`、`SftpRemote` 管理各自的文件列表）
- 传输任务状态通过 `uploadTasks`、`downloadTasks`、`deleteTasks` 数组在组件间传递
- 已废弃 `globalState.ts`，不再使用全局状态管理

### 数据传输

- 本地文件上传：`SftpLocal` → `uploadFile` (local.ts) → IPC → 主进程
- 远程文件下载：`SftpRemote` → `downloadFile` (remote.ts) → IPC → 主进程
- 删除任务：通过 `DeleteManager` 统一管理，支持批量删除和取消