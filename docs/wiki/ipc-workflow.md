# IPC 通信实战案例

本文档以项目中「窗口最小化」功能为例，展示 Electron IPC 通信的完整实现流程。

## 1. IPC 通信流程图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           IPC 通信流程                                   │
│                                                                          │
│  ┌─────────────────┐                    ┌─────────────────┐            │
│  │   渲染进程       │                    │    主进程        │            │
│  │  (Renderer)     │                    │    (Main)       │            │
│  ├─────────────────┤                    ├─────────────────┤            │
│  │                 │                    │                 │            │
│  │  用户点击按钮    │                    │                 │            │
│  │       │         │                    │                 │            │
│  │       ▼         │                    │                 │            │
│  │  调用 API       │                    │                 │            │
│  │  window.api     │                    │                 │            │
│  │  .windowMinimize()                   │                 │            │
│  │       │         │                    │                 │            │
│  │       │         │  ipcRenderer.send()│                 │            │
│  │       │─────────────────────────────►│                 │            │
│  │       │         │  'window-minimize' │                 │            │
│  │       │         │                    │       │         │            │
│  │       │         │                    │       ▼         │            │
│  │       │         │                    │  ipcMain.on()   │            │
│  │       │         │                    │  接收消息        │            │
│  │       │         │                    │       │         │            │
│  │       │         │                    │       ▼         │            │
│  │       │         │                    │  win.minimize() │            │
│  │       │         │                    │  执行最小化      │            │
│  │       │         │                    │                 │            │
│  └─────────────────┘                    └─────────────────┘            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 代码实现

### 2.1 预加载脚本 (src/preload/index.ts)

预加载脚本负责封装 IPC 通信方法，通过 `contextBridge` 安全暴露给渲染进程：

```typescript
import { contextBridge, ipcRenderer } from 'electron'

const api = {
  /**
   * 最小化窗口
   * 使用 ipcRenderer.send() 发送单向消息
   * send() 不需要等待返回值，适用于"发后即忘"的场景
   */
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  
  // 其他窗口控制方法...
}

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('api', api)
```

### 2.2 主进程处理 (src/main/index.ts)

主进程负责接收 IPC 消息并执行实际的窗口操作：

```typescript
import { app, BrowserWindow, ipcMain } from 'electron'

/**
 * IPC处理：窗口最小化
 * 
 * 工作原理：
 * 1. ipcMain.on() 监听来自渲染进程的消息
 * 2. event.sender 获取发送消息的 webContents
 * 3. BrowserWindow.fromWebContents() 获取对应的窗口实例
 * 4. win.minimize() 执行最小化操作
 * 
 * @param event - IPC 事件对象，包含发送者信息
 */
ipcMain.on('window-minimize', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.minimize()
})
```

---

## 3. 关键概念对照表

| 概念 | 预加载脚本 (Preload) | 主进程 (Main) | 说明 |
|------|---------------------|---------------|------|
| **通信方式** | `ipcRenderer.send()` | `ipcMain.on()` | 单向通信，无需返回值 |
| **通道名称** | `'window-minimize'` | `'window-minimize'` | 必须一致，建议使用常量 |
| **事件对象** | - | `event` | 包含发送者信息 |
| **获取窗口** | - | `BrowserWindow.fromWebContents(event.sender)` | 从事件发送者获取窗口 |
| **执行操作** | - | `win?.minimize()` | 实际的窗口操作 |

---

## 4. IPC 通信方式对比

| 方式 | 渲染进程 | 主进程 | 是否需要返回值 | 适用场景 |
|------|----------|--------|----------------|----------|
| **单向通信** | `ipcRenderer.send()` | `ipcMain.on()` | 否 | 窗口控制、通知事件 |
| **双向通信** | `ipcRenderer.invoke()` | `ipcMain.handle()` | 是 | 获取数据、确认操作 |
| **主进程推送** | `ipcRenderer.on()` | `webContents.send()` | 否 | 状态更新、事件通知 |

---

## 5. 最佳实践

### 5.1 通道名称使用常量

避免拼写错误，便于维护：

```typescript
// src/shared/constants/ipc-channels.ts
export const IPC_CHANNELS = {
  WINDOW_MINIMIZE: 'window-minimize',
  WINDOW_MAXIMIZE: 'window-maximize',
  WINDOW_CLOSE: 'window-close',
  WINDOW_IS_MAXIMIZED: 'window-is-maximized',
} as const
```

### 5.2 类型安全

为 API 添加 TypeScript 类型定义：

```typescript
// src/shared/types/index.ts
export interface WindowAPI {
  windowMinimize: () => void
  windowMaximize: () => void
  windowClose: () => void
  windowIsMaximized: () => Promise<boolean>
  onWindowMaximize: (callback: () => void) => () => void
  onWindowUnmaximize: (callback: () => void) => () => void
}

// 扩展 Window 接口
declare global {
  interface Window {
    api: WindowAPI
  }
}
```

### 5.3 错误处理

在主进程中添加异常捕获：

```typescript
ipcMain.on('window-minimize', event => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  } catch (error) {
    console.error('Failed to minimize window:', error)
  }
})
```

### 5.4 清理监听器

在组件销毁时移除事件监听，避免内存泄漏：

```typescript
// 预加载脚本中返回清理函数
onWindowMaximize: (callback: () => void) => {
  ipcRenderer.on('window-maximized', callback)
  // 返回取消监听函数
  return () => ipcRenderer.removeListener('window-maximized', callback)
}
```

```typescript
// Vue 组件中使用
import { onUnmounted } from 'vue'

const cleanup = window.api.onWindowMaximize(() => {
  // 处理最大化事件
})

onUnmounted(() => {
  cleanup() // 组件销毁时清理监听器
})
```

---

## 6. 完整示例

### 6.1 渲染进程调用

```typescript
// Vue 组件中
import { ref, onMounted, onUnmounted } from 'vue'

const isMaximized = ref(false)

// 获取窗口状态
onMounted(async () => {
  isMaximized.value = await window.api.windowIsMaximized()
})

// 最小化窗口
const handleMinimize = () => {
  window.api.windowMinimize()
}

// 最大化/还原窗口
const handleMaximize = () => {
  window.api.windowMaximize()
}

// 关闭窗口
const handleClose = () => {
  window.api.windowClose()
}

// 监听窗口状态变化
const cleanupMaximize = window.api.onWindowMaximize(() => {
  isMaximized.value = true
})

const cleanupUnmaximize = window.api.onWindowUnmaximize(() => {
  isMaximized.value = false
})

onUnmounted(() => {
  cleanupMaximize()
  cleanupUnmaximize()
})
```

### 6.2 主进程完整实现

```typescript
// src/main/index.ts
import { app, BrowserWindow, ipcMain } from 'electron'

// 窗口最小化
ipcMain.on('window-minimize', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.minimize()
})

// 窗口最大化/还原
ipcMain.on('window-maximize', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win?.isMaximized()) {
    win.unmaximize()
    // 通知渲染进程状态变化
    event.sender.send('window-unmaximized')
  } else {
    win?.maximize()
    // 通知渲染进程状态变化
    event.sender.send('window-maximized')
  }
})

// 窗口关闭
ipcMain.on('window-close', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.close()
})

// 获取窗口最大化状态
ipcMain.handle('window-is-maximized', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  return win?.isMaximized() ?? false
})
```
