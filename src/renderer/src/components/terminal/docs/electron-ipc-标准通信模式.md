# Electron IPC 标准通信模式

本文档介绍 DIY-Linux-Shell 项目中 Electron 主进程与渲染进程之间的 IPC 通信机制。

## 通信架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           渲染进程 (Renderer)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Vue 组件                                                              │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │  window.api.session.disconnect(sessionId)                       │  │
│   └──────────────────────────┬──────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│   Preload 脚本 (preload/index.ts)                                       │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │  session: {                                                      │  │
│   │    disconnect: (id) => ipcRenderer.invoke(CHANNEL, id)          │  │
│   │  }                                                               │  │
│   └──────────────────────────┬──────────────────────────────────────┘  │
│                              │                                          │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
                               │  IPC 通道 (Channel: 'session:disconnect')
                               │
┌──────────────────────────────┼──────────────────────────────────────────┐
│                              │                                          │
│                              ▼                                          │
│   主进程 IPC 处理器 (main/ipc/session.ts)                               │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │  ipcMain.handle('session:disconnect', async (_event, id) => {   │  │
│   │    await SSHManager.disconnect(id)                              │  │
│   │    return true                                                  │  │
│   │  })                                                             │  │
│   └──────────────────────────┬──────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│   业务服务层                                                            │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │  SSHManager.disconnect(id)                                      │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│                           主进程 (Main)                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

## 核心概念

### 1. IPC 通道名称 (Channel)

IPC 通道名称是主进程和渲染进程之间的"约定暗号"，双方必须使用相同的字符串才能建立通信。

**定义位置**：`src/shared/constants/ipc-channels.ts`

```typescript
export const IPC_CHANNELS = {
  SESSION: {
    GET_ALL: 'session:get-all',
    GET_BY_ID: 'session:get-by-id',
    CREATE: 'session:create',
    UPDATE: 'session:update',
    DELETE: 'session:delete',
    CONNECT: 'session:connect',
    DISCONNECT: 'session:disconnect',  // 通道名称
    GET_STATUS: 'session:get-status'
  },
  TERMINAL: {
    WRITE: 'terminal:write',
    RESIZE: 'terminal:resize',
    DATA: 'terminal:data',
    CLOSE: 'terminal:close',
    ERROR: 'terminal:error'
  },
  // ...
}
```

**命名规范**：`模块:操作`，例如 `session:disconnect`

### 2. 通信方式

Electron 提供两种 IPC 通信方式：

| 方式 | 方法 | 特点 | 使用场景 |
|------|------|------|----------|
| **双向通信** | `ipcRenderer.invoke` + `ipcMain.handle` | 支持返回值，返回 Promise | 需要获取结果的请求 |
| **单向通信** | `ipcRenderer.send` + `ipcMain.on` | 无返回值，只发送消息 | 不需要结果的请求 |

### 3. 通信流程

#### 双向通信流程（invoke/handle）

```
渲染进程                                主进程
    │                                     │
    │  ipcRenderer.invoke('channel', args)│
    │ ─────────────────────────────────►  │
    │                                     │  ipcMain.handle('channel', handler)
    │                                     │      │
    │                                     │      ▼
    │                                     │  处理请求...
    │                                     │      │
    │                                     │      ▼
    │                                     │  return result
    │  ◄───────────────────────────────── │
    │  Promise resolve(result)            │
    │                                     │
```

#### 单向通信流程（send/on）

```
渲染进程                                主进程
    │                                     │
    │  ipcRenderer.send('channel', args)  │
    │ ─────────────────────────────────►  │
    │                                     │  ipcMain.on('channel', handler)
    │                                     │      │
    │                                     │      ▼
    │                                     │  处理请求...
    │                                     │
```

## 代码实现

### 1. 定义通道常量

**文件**：`src/shared/constants/ipc-channels.ts`

```typescript
export const IPC_CHANNELS = {
  SESSION: {
    DISCONNECT: 'session:disconnect',
    // ...
  }
} as const
```

### 2. 渲染进程 API 封装

**文件**：`src/preload/index.ts`

```typescript
import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/ipc-channels'

const api = {
  session: {
    // 双向通信：使用 invoke
    disconnect: (id: string) => 
      ipcRenderer.invoke(IPC_CHANNELS.SESSION.DISCONNECT, id),
    
    // 单向通信：使用 send
    // someAction: (id: string) => 
    //   ipcRenderer.send(IPC_CHANNELS.SESSION.SOME_ACTION, id),
  },
  terminal: {
    // 单向通信：写入数据不需要返回值
    write: (sessionId: string, data: string) => 
      ipcRenderer.send(IPC_CHANNELS.TERMINAL.WRITE, sessionId, data),
    
    // 事件监听：接收主进程推送的数据
    onData: (callback: (event: unknown, data: unknown) => void) => {
      ipcRenderer.on(IPC_CHANNELS.TERMINAL.DATA, callback)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL.DATA, callback)
    },
  }
}

// 暴露到 window 对象
contextBridge.exposeInMainWorld('api', api)
```

### 3. 主进程 IPC 处理器

**文件**：`src/main/ipc/session.ts`

```typescript
import { ipcMain } from 'electron'
import { SSHManager } from '../services/ssh-manager'
import { IPC_CHANNELS } from '@shared/constants/ipc-channels'

export function registerSessionHandlers(): void {
  // 双向通信：使用 handle
  ipcMain.handle(
    IPC_CHANNELS.SESSION.DISCONNECT, 
    async (_event, id: string) => {
      await SSHManager.disconnect(id)
      StoreService.updateSession(id, { status: 'disconnected' })
      return true  // 返回结果给渲染进程
    }
  )
}
```

**文件**：`src/main/ipc/terminal.ts`

```typescript
import { ipcMain } from 'electron'
import { SSHManager } from '../services/ssh-manager'
import { IPC_CHANNELS } from '@shared/constants/ipc-channels'

export function registerTerminalHandlers(): void {
  // 单向通信：使用 on
  ipcMain.on(
    IPC_CHANNELS.TERMINAL.WRITE, 
    (_event, sessionId: string, data: string) => {
      SSHManager.write(sessionId, data)
      // 无返回值
    }
  )
}
```

### 4. 在组件中使用

**文件**：`src/renderer/src/components/terminal/TerminalTabs.vue`

```typescript
// 调用 IPC 方法
const handleCloseTab = async (tabId: string) => {
  const tab = terminalStore.getTabById(tabId)
  if (tab) {
    // 调用 disconnect，等待返回
    await window.api.session.disconnect(tab.sessionId)
    sessionStore.updateSessionStatus(tab.sessionId, 'disconnected')
  }
  terminalStore.closeTab(tabId)
}
```

## 完整示例：断开会话连接

### 步骤 1：定义通道名称

```typescript
// src/shared/constants/ipc-channels.ts
export const IPC_CHANNELS = {
  SESSION: {
    DISCONNECT: 'session:disconnect',
  }
}
```

### 步骤 2：渲染进程发送请求

```typescript
// src/preload/index.ts
const api = {
  session: {
    disconnect: (id: string) => 
      ipcRenderer.invoke(IPC_CHANNELS.SESSION.DISCONNECT, id),
  }
}
```

### 步骤 3：主进程处理请求

```typescript
// src/main/ipc/session.ts
ipcMain.handle(IPC_CHANNELS.SESSION.DISCONNECT, async (_event, id) => {
  await SSHManager.disconnect(id)
  StoreService.updateSession(id, { status: 'disconnected' })
  return true
})
```

### 步骤 4：组件调用

```typescript
// src/renderer/src/components/terminal/TerminalTabs.vue
await window.api.session.disconnect(tab.sessionId)
```

## 数据流向图

```
┌─────────────────────────────────────────────────────────────────────┐
│ 用户点击关闭标签页                                                   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ TerminalTabs.vue                                                    │
│ handleCloseTab(tabId)                                               │
│   └─► window.api.session.disconnect(sessionId)                      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ preload/index.ts                                                    │
│ session.disconnect(id)                                              │
│   └─► ipcRenderer.invoke('session:disconnect', id)                  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           │  IPC 通信
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ main/ipc/session.ts                                                 │
│ ipcMain.handle('session:disconnect', handler)                       │
│   └─► SSHManager.disconnect(id)                                     │
│   └─► StoreService.updateSession(id, { status: 'disconnected' })    │
│   └─► return true                                                   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           │  返回结果
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ TerminalTabs.vue                                                    │
│ await 返回 true                                                      │
│   └─► sessionStore.updateSessionStatus(sessionId, 'disconnected')  │
│   └─► terminalStore.closeTab(tabId)                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## 安全性考虑

### Context Isolation

Electron 默认启用上下文隔离，渲染进程无法直接访问 Node.js API。

```typescript
// preload/index.ts
if (process.contextIsolated) {
  // 安全方式：通过 contextBridge 暴露 API
  contextBridge.exposeInMainWorld('api', api)
}
```

### 参数验证

主进程应该验证接收到的参数：

```typescript
ipcMain.handle(IPC_CHANNELS.SESSION.DISCONNECT, async (_event, id) => {
  // 参数验证
  if (typeof id !== 'string') {
    throw new Error('Invalid session ID')
  }
  
  // 业务逻辑
  await SSHManager.disconnect(id)
  return true
})
```

## 常见问题

### Q: 为什么需要 preload 脚本？

A: 出于安全考虑，Electron 启用了上下文隔离，渲染进程无法直接访问 `ipcRenderer`。preload 脚本运行在有权限的环境中，可以安全地暴露有限的 API 给渲染进程。

### Q: invoke 和 send 如何选择？

A: 
- 需要返回值 → 使用 `invoke/handle`
- 不需要返回值 → 使用 `send/on`

### Q: 主进程如何主动推送消息给渲染进程？

A: 使用 `webContents.send()`：

```typescript
// 主进程
win.webContents.send(IPC_CHANNELS.TERMINAL.DATA, { sessionId, data })

// 渲染进程监听
window.api.terminal.onData((event, data) => {
  // 处理数据
})
```

## 相关文档

- [Electron IPC 官方文档](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [IPC 通道常量定义](../../../../shared/constants/ipc-channels.ts)
- [Preload 脚本实现](../../../../preload/index.ts)
- [主进程 IPC 处理器](../../../../main/ipc/)
