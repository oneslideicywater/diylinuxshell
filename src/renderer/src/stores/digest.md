# Stores 模块文档摘要

> 本文档记录 `src/renderer/src/stores` 目录下所有 Pinia Store 模块的完整结构、状态定义、方法清单及职责说明。

---

## 📁 目录概览

| 文件名 | Store 名称 | 主要职责 |
|--------|-----------|----------|
| [contextMenu.ts](./contextMenu.ts) | `useContextMenuStore` | 全局右键菜单状态管理 |
| [errorDialog.ts](./errorDialog.ts) | `useErrorDialogStore` | 全局错误对话框状态管理 |
| [index.ts](./index.ts) | - | Store 模块统一导出 |
| [session.ts](./session.ts) | `useSessionStore` | 会话配置和分组管理 |
| [settings.ts](./settings.ts) | `useSettingsStore` | 应用设置管理（主题、字体、终端配置等） |
| [sftpBrowser.ts](./sftpBrowser.ts) | `useSftpBrowserStore` | SFTP 文件浏览器状态管理（Local + Remote 统一） |
| [sftpSelection.ts](./sftpSelection.ts) | `useSftpSelectionStore` | SFTP 文件选择状态管理 |
| [sftpTransfer.ts](./sftpTransfer.ts) | `useSftpTransferStore` | SFTP 传输任务状态管理（上传/下载/删除） |
| [terminal.ts](./terminal.ts) | `useTerminalStore` | 终端标签页和模式切换管理 |

---

## 1. contextMenu.ts - 右键菜单状态管理 Store

**Store ID**: `contextMenu`

### 接口定义

```typescript
interface ContextMenuItem {
  action: string        // 动作标识（如 'createFolder', 'deleteLocal'）
  title: string         // 菜单项标题
  icon?: string         // 菜单项图标名称
  description?: string  // 菜单项描述（副标题）
  visible?: boolean     // 是否显示（条件渲染）
  danger?: boolean      // 是否为危险操作（红色文字样式）
}

interface ContextMenuPosition {
  x: number             // X 坐标
  y: number             // Y 坐标
}
```

### 状态属性

| 属性名 | 类型 | 说明 |
|--------|------|------|
| `visible` | `Ref<boolean>` | 全局右键菜单可见性 |
| `ownerId` | `Ref<string \| null>` | 当前菜单拥有者唯一标识 |
| `position` | `Ref<ContextMenuPosition>` | 右键菜单位置（viewport 坐标） |
| `items` | `Ref<ContextMenuItem[]>` | 当前菜单项列表（动态内容由调用方传入） |
| `onSelect` | `Ref<((action: string) => void) \| null>` | 菜单项点击回调 |

### 方法清单

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `showContextMenu` | `ownerUniqueKey: string, pos: ContextMenuPosition, menuItems: ContextMenuItem[], actionCallback?: (action: string) => void` | `void` | 显示全局右键菜单（自动关闭其他已打开的菜单） |
| `hideContextMenu` | 无 | `void` | 隐藏全局右键菜单（清除所有状态） |
| `handleSelect` | `action: string` | `void` | 处理菜单项点击（调用回调后关闭菜单） |
| `isOwner` | `id: string` | `boolean` | 检查指定 ID 是否为当前菜单拥有者 |
| `updatePosition` | `pos: ContextMenuPosition` | `void` | 更新菜单位置（用于边界检测后调整） |

### 设计特点
- 整个项目全局使用一个右键菜单组件
- 全局统一控制显示和隐藏状态
- 统一处理：点击空白关闭、ESC 键关闭、左击关闭
- 不同组件传入不同的菜单内容（动态 items）

---

## 2. errorDialog.ts - 错误对话框状态管理 Store

**Store ID**: `errorDialog`

### 状态属性

| 属性名 | 类型 | 说明 |
|--------|------|------|
| `visible` | `Ref<boolean>` | 对话框显示状态 |
| `title` | `Ref<string>` | 错误标题（默认：'连接失败'） |
| `message` | `Ref<string>` | 错误信息 |
| `sessionId` | `Ref<string>` | 会话 ID |
| `showRetry` | `Ref<boolean>` | 是否显示重试按钮（默认：true） |
| `showEdit` | `Ref<boolean>` | 是否显示编辑按钮（默认：true） |

### 方法清单

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `showError` | `errorTitle: string, errorMessage: string, errorSessionId: string, options?: { showRetry?: boolean; showEdit?: boolean }` | `void` | 显示错误对话框 |
| `closeError` | 无 | `void` | 关闭错误对话框（重置所有状态） |

---

## 3. index.ts - Store 模块导出

**说明**: 统一导出所有核心 Store 模块。

### 导出内容

```typescript
export { useSessionStore } from './session'
export { useTerminalStore } from './terminal'
```

---

## 4. session.ts - 会话状态管理 Store

**Store ID**: `session`

### 状态属性

| 属性名 | 类型 | 说明 |
|--------|------|------|
| `sessions` | `Ref<Session[]>` | 会话列表 |
| `sessionGroups` | `Ref<SessionGroup[]>` | 会话分组列表 |
| `activeSessionId` | `Ref<string>` | 当前激活的会话 ID |

### 计算属性

| 属性名 | 返回类型 | 说明 |
|--------|---------|------|
| `activeSession` | `Session \| undefined` | 当前激活的会话对象 |
| `ungroupedSessions` | `Session[]` | 未分组的会话列表 |

### 方法清单

#### 会话操作方法

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `addSession` | `session: Session` | `void` | 添加会话 |
| `removeSession` | `id: string` | `void` | 移除会话（同时清除激活状态） |
| `updateSession` | `id: string, updates: Partial<Session>` | `void` | 更新会话（自动更新 updatedAt 时间戳） |
| `setActiveSession` | `id: string` | `void` | 设置当前激活的会话 |
| `getSessionById` | `id: string` | `Session \| undefined` | 根据 ID 获取会话 |
| `clearSessions` | 无 | `void` | 清空所有会话 |
| `getGroupSessions` | `groupId: string` | `Session[]` | 获取分组中的会话 |

#### 分组操作方法

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `addSessionGroup` | `group: SessionGroup` | `void` | 添加会话分组 |
| `removeSessionGroup` | `id: string` | `void` | 移除会话分组（将该分组下的会话移至未分组） |
| `updateSessionGroup` | `id: string, updates: Partial<SessionGroup>` | `void` | 更新会话分组 |
| `getSessionGroupById` | `id: string` | `SessionGroup \| undefined` | 根据 ID 获取会话分组 |
| `clearSessionGroups` | 无 | `void` | 清空所有会话分组（将所有会话移至未分组） |

---

## 5. settings.ts - 设置状态管理 Store

**Store ID**: `settings`

### 常量定义

| 常量名 | 值 | 说明 |
|--------|-----|------|
| `STORAGE_KEY` | `'app-settings'` | 本地存储键名 |
| `defaultConfig` | `AppConfig` | 默认应用配置对象 |
| `darkTheme` | `object` | 深色主题配色方案（16 色 + 扩展色） |
| `lightTheme` | `object` | 浅色主题配色方案（16 色 + 扩展色） |

### 状态属性

| 属性名 | 类型 | 说明 |
|--------|------|------|
| `theme` | `Ref<'dark' \| 'light'>` | 主题设置（默认：dark） |
| `language` | `Ref<string>` | 语言设置（默认：zh-CN） |
| `terminal` | `Ref<TerminalConfig>` | 终端配置（字号、字体、光标等） |
| `connectionTimeout` | `Ref<number>` | 连接超时时间（ms）（默认：30000） |
| `keepaliveInterval` | `Ref<number>` | 心跳间隔（ms）（默认：30000） |
| `autoReconnect` | `Ref<boolean>` | 是否自动重连（默认：true） |
| `reconnectAttempts` | `Ref<number>` | 重连次数（默认：3） |
| `config` | `Ref<AppConfig>` | 完整配置对象（用于保存） |

### 方法清单

#### 获取方法

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `getThemeColors` | 无 | `object` | 获取当前主题配色方案 |
| `getTerminalConfig` | 无 | `TerminalConfig` | 获取终端配置副本 |

#### 设置更新方法

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `setTheme` | `newTheme: 'dark' \| 'light'` | `void` | 更新主题（立即应用到 DOM 并保存） |
| `setFontSize` | `size: number` | `void` | 更新终端字体大小 |
| `setFontFamily` | `font: string` | `void` | 更新终端字体类型 |
| `setCursorStyle` | `style: 'block' \| 'underline' \| 'bar'` | `void` | 更新光标样式 |
| `setCursorBlink` | `blink: boolean` | `void` | 更新光标闪烁 |
| `setScrollback` | `size: number` | `void` | 更新滚动缓冲区大小 |
| `setTerminalType` | `type: string` | `void` | 更新终端类型 |
| `setConnectionTimeout` | `timeout: number` | `void` | 更新连接超时时间 |
| `setKeepaliveInterval` | `interval: number` | `void` | 更新心跳间隔 |
| `setAutoReconnect` | `enabled: boolean` | `void` | 更新自动重连设置 |
| `setReconnectAttempts` | `attempts: number` | `void` | 更新重连次数 |
| `resetSettings` | 无 | `void` | 重置所有设置为默认值 |

### 内部辅助函数

| 函数名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `loadSettings` | 无 | `AppConfig` | 从本地存储加载设置（合并默认配置确保完整性） |
| `saveSettings` | `config: AppConfig` | `void` | 保存设置到本地存储 |
| `applyTheme` | `theme: 'dark' \| 'light'` | `void` | 应用主题到文档（设置 CSS 变量） |

### 设计特点
- 使用 `watch` 监听设置变化，自动保存到 localStorage
- 主题强制使用深色作为默认值（除非用户主动切换）
- 支持完整的 CSS 变量体系（包括输入框、按钮等组件样式）

---

## 6. sftpBrowser.ts - SFTP 文件浏览器状态管理 Store（统一版）

**Store ID**: `sftpBrowser`

### 核心设计
1. **按连接隔离**：每个 sftpConnectionId 拥有独立的本地+远程文件浏览状态
2. **统一数据源**：解决 SftpLocal.vue 和 SftpRemote.vue 双重状态管理问题
3. **响应式同步**：通过 Pinia Store 实现组件间状态自动同步

### 数据结构

```
stateMap (Map<string, BrowserState>)
└── key: sftpConnectionId
    └── value:
        ├── local: { localPath, localFiles, localFileCount }
        └── remote: { remotePath, remoteFiles, remoteFileCount, connectionId }
```

### 状态属性

| 属性名 | 类型 | 说明 |
|--------|------|------|
| `stateMap` | `Ref<Map<string, BrowserState>>` | 按连接 ID 存储的浏览器状态映射表 |

### 核心方法

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `getState` | `connectionId: string` | `BrowserState` | 获取或创建指定连接的完整浏览器状态 |

#### 本地文件相关方法

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `getLocalPath` | `connectionId: string` | `ComputedRef<string>` | 获取指定连接的当前本地路径 |
| `getLocalFiles` | `connectionId: string` | `ComputedRef<any[]>` | 获取指定连接的本地文件列表 |
| `getLocalFileCount` | `connectionId: string` | `ComputedRef<number>` | 获取指定连接的本地文件数量 |
| `setLocalPath` | `connectionId: string, path: string` | `void` | 设置当前本地路径 |
| `setLocalFiles` | `connectionId: string, files: any[]` | `void` | 设置本地文件列表 |
| `initLocalDefaultDir` | `connectionId: string` | `Promise<void>` | 初始化本地默认目录（用户 home 目录） |
| `loadLocalFiles` | `connectionId: string, drivesPath: string` | `Promise<void>` | 加载本地文件列表（支持盘符视图） |
| `handleLocalDblClick` | `connectionId: string, event: MouseEvent, drivesPath: string` | `void` | 处理本地文件双击导航到目录 |
| `navigateLocalUp` | `connectionId: string, drivesPath: string` | `Promise<void>` | 导航到本地上级目录（使用 path.dirname 跨平台） |
| `navigateToLocalPath` | `connectionId: string, path: string, drivesPath: string` | `void` | 导航到指定的本地路径 |
| `createLocalFolder` | `connectionId: string, folderName: string, drivesPath: string` | `Promise<void>` | 创建本地文件夹 |

#### 远程文件相关方法

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `getRemotePath` | `connectionId: string` | `ComputedRef<string>` | 获取指定连接的当前远程路径 |
| `getRemoteFiles` | `connectionId: string` | `ComputedRef<any[]>` | 获取指定连接的远程文件列表 |
| `getRemoteFileCount` | `connectionId: string` | `ComputedRef<number>` | 获取指定连接的远程文件数量 |
| `setRemotePath` | `connectionId: string, path: string` | `void` | 设置当前远程路径 |
| `setRemoteFiles` | `connectionId: string, files: any[]` | `void` | 设置远程文件列表 |
| `initRemoteDefaultDir` | `connectionId: string` | `void` | 初始化远程默认目录（'/'） |
| `loadRemoteFiles` | `connectionId: string` | `Promise<void>` | 加载远程文件列表 |
| `handleRemoteDblClick` | `connectionId: string, event: MouseEvent` | `void` | 处理远程文件双击事件 |
| `navigateRemoteUp` | `connectionId: string, dirname: (path: string) => string` | `Promise<void>` | 导航到远程上级目录 |
| `createRemoteFolder` | `connectionId: string, folderName: string` | `Promise<void>` | 创建远程文件夹 |

#### 清理方法

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `removeConnection` | `connectionId: string` | `void` | 移除指定连接的状态（关闭 SFTP 窗口时调用） |
| `clearAll` | 无 | `void` | 清除所有连接状态（应用退出时调用） |

---

## 7. sftpSelection.ts - SFTP 文件选择状态管理 Store

**Store ID**: `sftpSelection`

### 核心设计原则
1. **统一数据结构**：只使用 selectedLocals 数组（单文件时长度为1，多文件时长度>1）
2. **按连接隔离**：每个 SFTP 连接拥有独立的选中状态
3. **响应式同步**：通过 Pinia Store 实现组件间状态同步

### 使用场景
- 单文件操作：selectedLocals = ['file1.txt'] （数组长度=1）
- 多文件操作：selectedLocals = ['file1.txt', 'file2.txt', 'folder1'] （数组长度>1）

### 数据结构

```
selectionMap (Map<string, string[]>)
└── key: sftpConnectionId
    └── value: string[] (选中的文件路径数组)
```

### 状态属性

| 属性名 | 类型 | 说明 |
|--------|------|------|
| `selectionMap` | `Ref<Map<string, string[]>>` | 按连接 ID 存储的选中文件路径映射表 |

### 查询方法

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `getSelectedFiles` | `connectionId: string` | `string[]` | 获取指定连接的选中文件列表 |
| `getFirstSelectedFile` | `connectionId: string` | `string` | 获取第一个选中的文件路径（用于单文件操作场景） |
| `hasSelection` | `connectionId: string` | `boolean` | 判断是否已选中文件 |
| `isMultiSelect` | `connectionId: string` | `boolean` | 判断是否为多选模式（选中多个文件） |

### 操作方法

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `setSelectedFiles` | `connectionId: string, paths: string[]` | `void` | 设置选中文件列表（替换原有选择） |
| `clearSelection` | `connectionId: string` | `void` | 清空指定连接的选中状态 |
| `toggleFileSelection` | `connectionId: string, path: string` | `void` | 切换单个文件选中状态（Ctrl/Cmd 点击） |
| `rangeSelect` | `connectionId: string, currentPath: string, allFiles: any[], pathExtractor: (item: any) => string` | `void` | 范围选择（Shift 点击） |
| `removeConnection` | `connectionId: string` | `void` | 移除指定连接的所有选中状态（关闭 SFTP 窗口时调用） |

---

## 9. sftpTransfer.ts - SFTP 传输任务状态管理 Store

**Store ID**: `sftpTransfer`

### 核心特性
- 使用 reactive() 确保深层响应式
- 提供节点级别的状态更新方法
- 支持树形结构的实时更新
- 最大保留 100 个已完成任务（超出自动清理）

### 状态属性

| 属性名 | 类型 | 说明 |
|--------|------|------|
| `transferTasks` | `Ref<TransferTask[]>` | 传输任务列表 |
| `selectedTaskIds` | `Ref<Set<string>>` | 选中的任务 ID 集合（用于批量取消操作） |

### 计算属性（按状态分类的任务列表）

| 属性名 | 返回类型 | 说明 |
|--------|---------|------|
| `pendingTasks` | `TransferTask[]` | 待开始的任务列表（pending 状态） |
| `transferringTasks` | `TransferTask[]` | 传输中的任务列表（transferring 状态） |
| `completedTasks` | `TransferTask[]` | 已完成的任务列表（completed 状态） |
| `errorTasks` | `TransferTask[]` | 错误状态的任务列表（error 状态） |
| `cancelledTasks` | `TransferTask[]` | 已取消的任务列表（cancelled 状态） |

### 常量

| 常量名 | 值 | 说明 |
|--------|-----|------|
| `MAX_COMPLETED_TASKS` | `100` | 已完成任务最大保留数量 |

### 任务管理方法

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `addTask` | `task: TransferTask` | `void` | 添加传输任务（**不建节点索引**，等扫描完成后调用 rebuildNodeIndex 统一重建） |
| `cleanupCompletedTasks` | 无 | `void` | 清理超出限制的已完成任务 |
| `updateTask` | `taskId: string, updates: Partial<TransferTask>` | `void` | 更新传输任务的顶层属性（**当 root 被替换时自动重建 nodeIndexMap**） |
| `updateTaskStatus` | `taskId: string, status: TransferTask['status']` | `void` | 更新任务状态 |
| `updateTaskRoot` | `taskId: string, rootUpdates: Partial<TransferNode>` | `void` | 更新根节点的属性（利用 reactive 特性） |
| `mutateNode` | `taskId: string, nodeId: string, updates: Partial<TransferNode>` | `void` | **O(1) 直接变异节点**：从 nodeIndexMap 查找 → 保护 startTime/endTime 不被重复覆盖 → Object.assign 变异 reactive Proxy（自动触发 Proxy.set 驱动响应式更新）→ 沿祖先链反向传播 transferredBytes 增量 |
| `initNodeIndex` | `taskId: string` | `void` | **扫描完成后必须调用**：清除旧索引 + 对 task.root 整棵树递归 buildNodeIndex（所有节点均为 reactive Proxy） |
| `getAncestorChain` | `taskId: string, nodeId: string` | `string[]` | 获取从指定节点到根节点的祖先链 ID 列表（含自身），用于 mutateNode 的属性传播 |
| `printTree` | `taskId?: string, maxDepth?: number` | `void` | 打印树形结构到控制台（调试用），显示节点名称/类型/状态/进度/大小等 |
| `getNode` | `taskId: string, nodeId: string` | `TransferNode | undefined` | **O(1) 获取节点**：从 nodeIndexMap 查找，配合 UI 定时器实现实时数据读取 |
| `updateNodeStatus` | `taskId: string, nodeId: string, updates: Partial<TransferNode>` | `void` | 兼容旧接口：递归遍历树查找节点并更新（O(N)，已被 mutateNode 取代） |
| `removeTask` | `taskId: string` | `void` | 移除传输任务 |
| `clearCompletedTasks` | 无 | `void` | 清除已完成的任务（保留最近 5 个） |
| `clearAllTasks` | 无 | `void` | 清除所有任务 |
| `getTask` | `taskId: string` | `TransferTask \| undefined` | 获取指定任务（返回 reactive 对象） |
| `setAllNodesExpanded` | `expanded: boolean` | `void` | 设置所有节点的展开状态 |

### 内部辅助函数

| 函数名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `updateNodeInTree` | `node: TransferNode, nodeId: string, updates: Partial<TransferNode>` | `boolean` | 在树形结构中递归查找并更新节点（被 updateNodeStatus 调用） |
| `buildNodeIndex` | `taskId: string, node: TransferNode` | `void` | 递归构建节点 ID → 节点引用的 Map 索引（O(1) 查找基础） |
| `setNodeExpandedRecursive` | `node: TransferNode, expanded: boolean` | `void` | 递归设置节点展开状态 |
| `markAllNodesCancelled` | `node: TransferNode, taskId: string` | `void` | 递归标记树中所有节点为已取消状态 |

### 任务选中相关方法

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `toggleTaskSelection` | `taskId: string` | `void` | 切换任务选中状态 |
| `cancelSelectedTasks` | 无 | `void` | 取消所有选中的任务（仅限 pending 和 transferring 状态） |
| `clearSelectedTasks` | 无 | `void` | 清空所有任务的选中状态 |

---

## 10. terminal.ts - 终端状态管理 Store

**Store ID**: `terminal`

### 状态属性

| 属性名 | 类型 | 说明 |
|--------|------|------|
| `tabs` | `Ref<Tab[]>` | 标签页列表 |
| `activeTabId` | `Ref<string>` | 当前激活的标签页 ID |
| `terminalSizes` | `Ref<Map<string, TerminalSize>>` | 终端尺寸映射（按标签页 ID） |
| `currentMode` | `Ref<'ssh' \| 'sftp'>` | 当前模式：SSH 终端 或 SFTP 文件传输（默认：ssh） |
| `lastActiveTabIdPerMode` | `Ref<Record<'ssh' \| 'sftp', string>>` | 每个模式的最后活跃标签页 ID（用户体验优化） |

### 计算属性

| 属性名 | 返回类型 | 说明 |
|--------|---------|------|
| `activeTab` | `Tab \| undefined` | 当前激活的标签页对象 |
| `tabCount` | `number` | 标签页数量 |

### 标签页管理方法

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `createTab` | `title: string, sessionId: string` | `Tab` | 创建新 SSH 标签页 |
| `createSftpTab` | `title: string, session: any` | `Tab` | 创建 SFTP 文件传输标签页（安全设计 v2：不存储 session 对象） |
| `closeTab` | `id: string` | `void` | 关闭标签页（自动切换到相邻标签页） |
| `setActiveTab` | `id: string` | `void` | 设置激活标签页 |
| `switchMode` | `mode: 'ssh' \| 'sftp'` | `void` | **智能模式切换**：记住每个模式的最后活跃标签页 |
| `updateTabTitle` | `id: string, title: string` | `void` | 更新标签页标题 |
| `updateTabTerminalId` | `id: string, terminalId: string` | `void` | 更新标签页终端 ID |
| `updateTabStatus` | `id: string, status: ConnectionStatus` | `void` | 更新标签页连接状态 |
| `getTabById` | `id: string` | `Tab \| undefined` | 根据 ID 获取标签页 |
| `clearTabs` | 无 | `void` | 清空所有标签页 |

### 终端尺寸管理方法

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `updateTerminalSize` | `id: string, size: TerminalSize` | `void` | 更新终端尺寸 |
| `getTerminalSize` | `id: string` | `TerminalSize \| undefined` | 获取终端尺寸 |

### 安全设计（v2）- createSftpTab
- 完全移除 session 对象存储，只保留 sessionId 标识符
- 组件通过 SessionStore 自行获取会话信息（非敏感部分）
- 密码等敏感信息完全由主进程管理，不进入渲染进程状态树

### 模式切换优化 - switchMode
- 切换离开当前模式时，保存当前活跃标签页 ID
- 切换到目标模式时，优先恢复之前在该模式下活跃的标签页
- 如果之前的标签页已不存在，则自动选择第一个可用标签页

---

## 🔗 Store 依赖关系图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        index.ts (统一导出)                           │
│              useSessionStore / useTerminalStore                     │
└─────────────┬──────────────────────────────┬────────────────────────┘
              │                              │
    ┌─────────▼──────────┐       ┌──────────▼──────────┐
    │   session.ts        │       │    terminal.ts       │
    │  (会话和分组管理)    │       │ (标签页和模式管理)    │
    └────────────────────┘       └─────────┬────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
          ┌─────────▼──────────┐
          │  sftpBrowser.ts     │
          │ (Local+Remote 统一) │
          └─────────┬──────────┘
                    │
          ┌─────────▼──────────┐
          │ sftpSelection.ts    │
          │ (文件选择状态)       │
          └─────────┬──────────┘
          ┌─────────▼──────────┐
          │  sftpTransfer.ts    │
          │ (传输任务状态管理)  │
          └────────────────────┘

    ┌─────────────────────────────────────────────────────────────┐
                    全局工具 Store（独立使用）
    ├─────────────────────────────────────────────────────────────┤
    │  contextMenu.ts  │  errorDialog.ts  │  settings.ts           │
    │  (右键菜单)       │  (错误对话框)     │  (应用设置)            │
    └─────────────────────────────────────────────────────────────┘
```

---

## 📊 统计信息汇总

### 各 Store 方法数量统计

| Store 名称 | Store ID | 状态数 | 计算属性数 | 方法数 | 总计 |
|-----------|----------|-------|-----------|--------|------|
| useContextMenuStore | contextMenu | 5 | 0 | 5 | 10 |
| useErrorDialogStore | errorDialog | 6 | 0 | 2 | 8 |
| useSessionStore | session | 3 | 2 | 14 | 19 |
| useSettingsStore | settings | 8 | 0 | 13 | 21 |
| useSftpBrowserStore | sftpBrowser | 1 | 0 | 27 | 28 |
| useSftpSelectionStore | sftpSelection | 1 | 0 | 10 | 11 |
| useSftpTransferStore | sftpTransfer | 2 | 5 | 17 | 24 |
| useTerminalStore | terminal | 5 | 2 | 14 | 21 |
| **总计** | - | **32** | **9** | **116** | **157** |

### 功能分类统计

| 功能类别 | 涉及 Store | 主要功能 |
|---------|-----------|----------|
| **全局 UI 管理** | contextMenu, errorDialog, settings | 右键菜单、错误提示、应用设置 |
| **会话管理** | session | 会话 CRUD、分组管理 |
| **终端管理** | terminal | 标签页管理、模式切换（SSH/SFTP） |
| **SFTP 浏览器** | sftpBrowser | 本地/远程文件浏览、导航、创建文件夹（统一管理） |
| **SFTP 选择** | sftpSelection | 单选/多选、范围选择、Ctrl+Shift 操作 |
| **SFTP 传输** | sftpTransfer | 上传/下载/删除任务管理、进度跟踪、批量取消 |

---

## 🏗️ 架构设计原则

### 1. 按连接隔离原则
- **适用 Store**: sftpBrowser, sftpSelection, sftpTransfer
- **实现方式**: 使用 `Map<connectionId, State>` 结构
- **优势**: 每个 SFTP 连接窗口拥有独立状态，互不干扰

### 2. 安全架构 v2/v4
- **不再依赖 session 对象**: 避免在渲染进程传递敏感信息
- **直接使用 connectionId/sftpConnectionId**: 通过标识符在主进程连接池中查找对应连接
- **密码等敏感信息完全由主进程管理**: 不进入渲染进程状态树

### 3. 响应式状态管理
- **Pinia Composition API**: 使用 `defineStore(id, () => {})` 语法
- **ref/computed**: 所有状态都是响应式的
- **深层响应式**: 对于嵌套对象（如 TransferNode），使用 Object.assign 触发更新

### 4. 自动持久化
- **settings Store**: 监听变化自动保存到 localStorage
- **加载时合并默认配置**: 确保新增字段有默认值

### 5. 用户体验优化
- **模式切换记忆**: terminal Store 的 switchMode 记住每个模式的最后活跃标签页
- **任务清理机制**: sftpTransfer Store 自动清理超限的已完成任务（最多保留 100 个）
- **边界检测支持**: contextMenu Store 提供 updatePosition 方法

---

## 📝 使用示例

### 基本用法

```typescript
// 在 Vue 组件中使用
import { useContextMenuStore } from '@/stores/contextMenu'

const contextMenuStore = useContextMenuStore()

// 显示右键菜单
contextMenuStore.showContextMenu(
  'unique-owner-id',
  { x: 100, y: 200 },
  [
    { action: 'upload', title: '上传', icon: 'upload' },
    { action: 'download', title: '下载', icon: 'download' }
  ],
  (action) => console.log('选择了:', action)
)
```

### SFTP 浏览器使用（按连接隔离）

```typescript
import { useSftpBrowserStore } from '@/stores/sftpBrowser'

const browserStore = useSftpBrowserStore()
const connectionId = 'sftp-xxx-yyy'

// 加载本地文件
await browserStore.loadLocalFiles(connectionId, '此电脑')

// 加载远程文件
await browserStore.loadRemoteFiles(connectionId)

// 获取当前路径（computed）
const localPath = browserStore.getLocalPath(connectionId)
```

### 传输任务管理

```typescript
import { useSftpTransferStore } from '@/stores/sftpTransfer'
import { createTransferNode, createTransferTask } from '@/components/terminal/sftp/script/utils'

const transferStore = useSftpTransferStore()

// 创建节点和任务
const node = createTransferNode({
  name: 'test.txt',
  isDirectory: false,
  type: 'upload',
  localPath: '/local/test.txt',
  remotePath: '/remote/test.txt'
})

const task = createTransferTask({
  type: 'upload',
  root: node,
  sftpConnectionId: connectionId
})

// 添加到 Store
transferStore.addTask(task)

// 更新节点进度
transferStore.updateNodeStatus(task.id, node.id, {
  progress: 50,
  speed: 1024 * 1024,
  elapsed: '00:05:30'
})
```

---

*文档生成时间：2026-04-20*
*模块路径：src/renderer/src/stores/*
