# 终端组件

本目录包含终端相关的三个核心组件，负责终端标签页的管理和显示。

## 组件结构

```
terminal/
├── TerminalTabs.vue    # 标签页栏容器
├── TerminalTab.vue     # 单个标签页
└── XTerminal.vue       # 终端显示组件
```

## 组件关系图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           AppLayout.vue                             │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      header (顶部标题栏)                      │   │
│  │  ┌──────────┐  ┌─────────────────────────┐  ┌────────────┐  │   │
│  │  │ 标题     │  │     TerminalTabs        │  │ 窗口控制   │  │   │
│  │  │          │  │  ┌─────┬─────┬─────┐   │  │            │  │   │
│  │  │          │  │  │Tab 1│Tab 2│  +  │   │  │ ─ □ ✕     │  │   │
│  │  │          │  │  └─────┴─────┴─────┘   │  │            │  │   │
│  │  │          │  │       TerminalTab       │  │            │  │   │
│  │  └──────────┘  └─────────────────────────┘  └────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      app-body (主体区域)                     │   │
│  │  ┌────────────┐  ┌──────────────────────────────────────┐  │   │
│  │  │            │  │                                      │  │   │
│  │  │  Sidebar   │  │            XTerminal                 │  │   │
│  │  │            │  │         (终端显示区域)                │  │   │
│  │  │            │  │                                      │  │   │
│  │  │            │  │                                      │  │   │
│  │  └────────────┘  └──────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## 父子组件关系

```
AppLayout.vue (父组件)
    │
    ├── TerminalTabs.vue (子组件)
    │       │
    │       └── TerminalTab.vue (子组件，通过 v-for 循环渲染)
    │
    └── XTerminal.vue (子组件)
```

## 组件说明

### 1. TerminalTabs.vue - 标签页栏容器

**位置**：顶部标题栏中央区域

**职责**：
- 管理和显示所有终端标签页
- 提供新建标签页按钮（+号）
- 处理标签页的选择和关闭

**Props**：无

**Events**：无（内部处理所有事件）

**核心逻辑**：
```typescript
// 标签页列表（从 Pinia store 获取）
const tabs = computed(() => terminalStore.tabs)

// 当前激活的标签页
const activeTabId = computed(() => terminalStore.activeTabId)

// 选择标签页
const handleSelectTab = (tabId: string) => {
  terminalStore.setActiveTab(tabId)
}

// 关闭标签页
const handleCloseTab = async (tabId: string) => {
  // 1. 断开 SSH 连接
  await window.api.session.disconnect(tab.sessionId)
  // 2. 更新会话状态
  sessionStore.updateSessionStatus(tab.sessionId, 'disconnected')
  // 3. 关闭标签页
  terminalStore.closeTab(tabId)
}
```

---

### 2. TerminalTab.vue - 单个标签页

**位置**：TerminalTabs 内部，通过 `v-for` 循环渲染

**职责**：
- 显示标签页标题和图标
- 提供关闭按钮
- 显示激活状态

**Props**：
```typescript
{
  tab: Tab,      // 标签页数据
  active: boolean // 是否激活
}
```

**Events**：
```typescript
{
  (e: 'click'): void  // 点击标签页
  (e: 'close'): void  // 点击关闭按钮
}
```

**UI 结构**：
```
┌─────────────────────────┐
│ [图标] 标题      [✕]   │
└─────────────────────────┘
```

---

### 3. XTerminal.vue - 终端显示组件

**位置**：主内容区域，根据激活的标签页显示

**职责**：
- 创建和管理 xterm.js 终端实例
- 处理用户输入并发送到 SSH 服务器
- 接收 SSH 服务器返回的数据并显示
- 处理终端大小变化

**Props**：
```typescript
{
  tab: Tab  // 当前标签页数据
}
```

**Events**：无

**核心逻辑**：
```typescript
// 初始化终端
const initTerminal = () => {
  terminal = new Terminal({ ... })
  terminal.onData((data) => {
    // 用户输入 → 发送到 SSH 服务器
    window.api.terminal.write(props.tab.sessionId, data)
  })
}

// 监听 SSH 返回数据
const setupDataListeners = () => {
  window.api.terminal.onData((_event, data) => {
    // SSH 返回 → 显示到终端
    terminal.write(data)
  })
}
```

## 交互行为

### 1. 创建新标签页

```
用户点击会话连接按钮（Sidebar）
    │
    ▼
sessionStore.updateSessionStatus(sessionId, 'connecting')
    │
    ▼
terminalStore.addTab(session)
    │
    ▼
window.api.session.connect(sessionId)
    │
    ▼
SSH 连接成功
    │
    ▼
TerminalTabs 显示新标签页
    │
    ▼
XTerminal 显示终端内容
```

### 2. 切换标签页

```
用户点击标签页
    │
    ▼
TerminalTab emit('click')
    │
    ▼
TerminalTabs handleSelectTab(tabId)
    │
    ▼
terminalStore.setActiveTab(tabId)
    │
    ▼
AppLayout activeTab 更新
    │
    ▼
XTerminal 切换到对应会话的终端
```

### 3. 关闭标签页

```
用户点击关闭按钮
    │
    ▼
TerminalTab emit('close')
    │
    ▼
TerminalTabs handleCloseTab(tabId)
    │
    ▼
window.api.session.disconnect(sessionId)
    │
    ▼
sessionStore.updateSessionStatus(sessionId, 'disconnected')
    │
    ▼
terminalStore.closeTab(tabId)
    │
    ▼
标签页从列表中移除
```

### 4. 新建标签页

```
用户点击 + 按钮
    │
    ▼
TerminalTabs handleNewTab()
    │
    ▼
打开会话选择对话框（TODO）
```

## 数据流

### 用户输入流向

```
用户键盘输入
    │
    ▼
XTerminal: terminal.onData(data)
    │
    ▼
window.api.terminal.write(sessionId, data)
    │
    ▼
IPC: TERMINAL.WRITE
    │
    ▼
主进程: SSHManager.write(sessionId, data)
    │
    ▼
SSH 服务器
```

### 服务器输出流向

```
SSH 服务器返回数据
    │
    ▼
主进程: stream.on('data')
    │
    ▼
win.webContents.send(TERMINAL.DATA, { sessionId, data })
    │
    ▼
IPC: TERMINAL.DATA
    │
    ▼
XTerminal: window.api.terminal.onData()
    │
    ▼
terminal.write(data)
    │
    ▼
xterm.js 渲染到界面
```

## 状态管理

三个组件共享 Pinia store 状态：

```typescript
// terminal.ts store
{
  tabs: Tab[],           // 所有标签页
  activeTabId: string,   // 当前激活的标签页 ID
}

// session.ts store
{
  sessions: Session[],   // 所有会话
  // 每个会话有 status: 'disconnected' | 'connecting' | 'connected'
}
```

## 相关文档

- [SSH 连接服务](../../../../main/services/README.md)
- [终端状态管理](../../../stores/README.md)
- [IPC 通信流程](../../../../docs/wiki/ipc-workflow.md)
