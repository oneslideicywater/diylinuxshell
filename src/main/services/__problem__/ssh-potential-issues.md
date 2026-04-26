# SSH 潜在代码问题分析

> 分析文件:
> - 主进程: [ssh-manager.ts](../sftp.ts)、[ipc/session.ts](../ipc/session.ts)、[ipc/terminal.ts](../ipc/terminal.ts)
> - 渲染进程: [XTerminal.vue](../../renderer/src/components/terminal/XTerminal.vue)、[TerminalTab.vue](../../renderer/src/components/terminal/TerminalTab.vue)、[TerminalTabs.vue](../../renderer/src/components/terminal/TerminalTabs.vue)
> - Store: [terminal.ts](../../renderer/src/stores/terminal.ts)
> - Preload: [preload/index.ts](../../preload/index.ts)
> 分析日期: 2026-04-25

---

## 一、主进程 SSHManager

### 问题1：连接泄漏风险 —— `connect()` 方法中旧连接断开失败时新连接仍会建立

**位置**: [ssh-manager.ts:L78-L93](../services/ssh-manager.ts#L78-L93)

```typescript
static async connect(tabId, session, isTestConnection, initialSize): Promise<string> {
  // 如果已存在连接，先断开
  if (this.connections.has(tabId)) {
    await this.disconnect(tabId)  // ← 如果这里抛异常，后续代码不会执行
  }

  const client = new Client()
  const connection: SSHConnection = { ... }
  this.connections.set(tabId, connection)  // ← 新连接已注册
  // ... 后续 client.connect() 如果失败，新连接会残留
}
```

**问题**: 
1. `disconnect(tabId)` 如果失败（如 `client.destroy()` 抛异常），新连接不会建立，但旧连接可能处于半断开状态
2. `client.connect()` 失败后，`connection` 对象仍然留在 `connections` Map 中，状态为 `'connecting'` 或 `'error'`，但不会被清理

**影响**: 多次连接失败后，`connections` Map 中会残留无效连接记录

**建议**: 在 `catch` 或 `error` 回调中清理 `connections` Map

---

### 问题2：`disconnect()` 方法没有错误处理

**位置**: [ssh-manager.ts:L183-L203](../services/ssh-manager.ts#L183-L203)

```typescript
static async disconnect(tabId: string): Promise<void> {
  const connection = this.connections.get(tabId)
  if (!connection) {
    return
  }

  if (connection.stream) {
    connection.stream.end()  // ← 可能抛异常
    connection.stream = null
  }

  connection.client.destroy()  // ← 可能抛异常
  connection.status = 'disconnected'
  this.connections.delete(tabId)
}
```

**问题**: `stream.end()` 和 `client.destroy()` 都可能抛出异常，但没有 try-catch 包裹。如果抛异常，`connections.delete(tabId)` 不会执行，导致连接残留。

**建议**: 使用 try-finally 确保清理：
```typescript
try {
  if (connection.stream) { connection.stream.end() }
  connection.client.destroy()
} finally {
  this.connections.delete(tabId)
}
```

---

### 问题3：`onData/onClose/onError` 监听器没有去重机制

**位置**: [ssh-manager.ts:L230-L276](../services/ssh-manager.ts#L230-L276)

```typescript
static onData(tabId: string, callback: (data: string) => void): () => void {
  const connection = this.connections.get(tabId)
  if (!connection?.stream) {
    return () => {}
  }

  const handler = (data: Buffer) => {
    callback(data.toString('utf-8'))
  }

  connection.stream.on('data', handler)  // ← 多次调用会注册多个监听器
  return () => { connection.stream?.removeListener('data', handler) }
}
```

**问题**: 如果 `SESSION.CONNECT` IPC 被多次调用（如用户快速点击连接），会为同一个 `stream` 注册多个 `data` 监听器，导致同一份数据被多次发送到渲染进程。

**场景**: 
1. 用户点击连接 → 注册第1个监听器
2. 用户再次点击连接（旧连接未断开）→ 注册第2个监听器
3. SSH 服务器返回数据 → 渲染进程收到2份相同数据

**建议**: 在注册新监听器前，先移除旧监听器；或者在 `connect()` 中确保旧连接完全断开后再建立新连接。

---

### 问题4：`resize()` 方法硬编码了终端像素尺寸

**位置**: [ssh-manager.ts:L243-L250](../services/ssh-manager.ts#L243-L250)

```typescript
static resize(tabId: string, rows: number, cols: number): void {
  const connection = this.connections.get(tabId)
  if (connection?.stream) {
    // setWindow 需要 4 个参数: rows, cols, height, width
    // height 和 width 是像素值，暂时使用默认值
    connection.stream.setWindow(rows, cols, 480, 640)  // ← 硬编码
  }
}
```

**问题**: `setWindow` 的 `height` 和 `width` 参数硬编码为 `480x640`，不随实际终端尺寸变化。这可能导致某些依赖 PTY 像素尺寸的应用（如 vim、ncurses）显示异常。

**影响**: 低优先级，大多数终端应用只关心 rows/cols，不关心像素尺寸。

---

## 二、IPC 层

### 问题5：`SESSION.CONNECT` 中监听器注册失败无回滚

**位置**: [ipc/session.ts:L140-L165](../ipc/session.ts#L140-L165)

```typescript
ipcMain.handle(IPC_CHANNELS.SESSION.CONNECT, async (event, tabId, sessionId, initialSize) => {
  const session = StoreService.getSessionById(sessionId)
  if (!session) {
    throw new Error('Session not found')
  }

  try {
    await SSHManager.connect(tabId, session, false, initialSize)

    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      SSHManager.onData(tabId, (data: string) => {
        win.webContents.send(IPC_CHANNELS.TERMINAL.DATA, { tabId, data })
      })
      // ... onClose, onError
    }

    return { success: true, tabId }
  } catch (error) {
    throw error  // ← 连接失败时，已注册的监听器没有清理
  }
})
```

**问题**: 
1. 如果 `SSHManager.connect()` 成功，但 `win.webContents.send()` 后续失败（如窗口已关闭），监听器不会被清理
2. 如果 `BrowserWindow.fromWebContents(event.sender)` 返回 `undefined`（窗口已销毁），监听器不会注册，但 SSH 连接已经建立，导致连接"静默"存在但无法接收数据

**建议**: 
- 在 `catch` 中调用 `SSHManager.disconnect(tabId)` 回滚
- 检查 `win` 是否存在，不存在时直接断开连接

---

### 问题6：`TERMINAL.WRITE` 和 `TERMINAL.RESIZE` 没有连接状态检查

**位置**: [ipc/terminal.ts:L18-L28](../ipc/terminal.ts#L18-L28)

```typescript
ipcMain.on(IPC_CHANNELS.TERMINAL.WRITE, (_event, tabId: string, data: string) => {
  SSHManager.write(tabId, data)  // ← 不检查连接是否存在
})

ipcMain.on(IPC_CHANNELS.TERMINAL.RESIZE, (_event, tabId: string, size: TerminalSize) => {
  SSHManager.resize(tabId, size.rows, size.cols)  // ← 不检查连接是否存在
})
```

**问题**: 
1. 如果连接已断开，`write()` 和 `resize()` 静默失败（内部有 `if (connection?.stream)` 检查），但没有任何日志或错误反馈
2. 用户输入的数据会丢失，没有任何提示

**建议**: 在 IPC 层检查连接状态，如果未连接则返回错误提示

---

### 问题7：`SESSION.DELETE` 中断开连接是异步的但没有 await

**位置**: [ipc/session.ts:L125-L130](../ipc/session.ts#L125-L130)

```typescript
ipcMain.handle(IPC_CHANNELS.SESSION.DELETE, async (_event, id: string) => {
  await SSHManager.disconnectBySessionId(id)
  StoreService.deleteSession(id)
  return true
})
```

**核实结果**: 此问题不存在，代码正确使用了 `await`。

---

## 三、渲染进程

### 问题8：`XTerminal.vue` 中主题变化监听被注册了两次

**位置**: [XTerminal.vue:L316-L326](../../renderer/src/components/terminal/XTerminal.vue#L316-L326)

```typescript
// 监听主题变化
watch(
  () => settingsStore.theme,
  () => {
    applyTerminalSettings()
  }
)

// 监听主题变化（重复！）
watch(
  () => settingsStore.theme,
  () => {
    applyTerminalSettings()
  }
)
```

**问题**: 同一个 `theme` 监听器被注册了两次，主题变化时 `applyTerminalSettings()` 会被调用两次，造成不必要的性能开销。

**建议**: 删除重复的 watch

---

### 问题9：`TerminalTabs.vue` 关闭标签页时可能关闭已断开的连接

**位置**: [TerminalTabs.vue:L78-L85](../../renderer/src/components/terminal/TerminalTabs.vue#L78-L85)

```typescript
const handleCloseTab = async (tabId: string) => {
  const tab = terminalStore.getTabById(tabId)
  if (tab) {
    await window.api.session.disconnect(tabId)  // ← 无论连接状态如何都调用 disconnect
  }
  terminalStore.closeTab(tabId)
}
```

**问题**: 即使标签页状态为 `disconnected` 或 `error`，仍然会调用 `disconnect`。虽然 SSHManager 内部有检查，但会产生不必要的 IPC 调用。

**建议**: 只在连接状态为 `connected` 或 `connecting` 时调用 disconnect

---

### 问题10：`TerminalTab.vue` 中重连逻辑没有检查标签页类型

**位置**: [TerminalTab.vue:L219-L238](../../renderer/src/components/terminal/TerminalTab.vue#L219-L238)

```typescript
const handleReconnectSession = async (): Promise<void> => {
  if (!canReconnect.value) return

  try {
    terminalStore.updateTabStatus(props.tab.id, 'connecting')
    if (props.tab.type === 'sftp' && props.tab.sftpConnectionId) {
      const result = await window.api.sftp.connect(props.tab.sftpConnectionId, props.tab.sessionId)
      if (!result.success) {
        throw new Error(result.error || 'SFTP 重连失败')
      }
    } else {
      const initialSize = terminalStore.getTerminalSize(props.tab.id)
      await window.api.session.connect(props.tab.id, props.tab.sessionId, initialSize ? { cols: initialSize.cols, rows: initialSize.rows } : undefined)
    }
    terminalStore.updateTabStatus(props.tab.id, 'connected')
  } catch (error: unknown) {
    // ...
  }
}
```

**核实结果**: 此问题不存在，代码正确区分了 SFTP 和 SSH 类型。

---

### 问题11：`XTerminal.vue` 的 `onUnmounted` 没有断开 SSH 连接

**位置**: [XTerminal.vue:L365-L386](../../renderer/src/components/terminal/XTerminal.vue#L365-L386)

```typescript
onUnmounted(() => {
  cleanupDataListener?.()
  cleanupCloseListener?.()
  cleanupErrorListener?.()
  window.removeEventListener('resize', handleResize)
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  terminal?.dispose()
  terminal = null
})
```

**问题**: 组件卸载时只清理了前端监听器和终端实例，但没有断开 SSH 连接。如果用户通过其他方式（如路由切换）导致组件卸载，SSH 连接会一直存在。

**影响**: 依赖调用方（如 `TerminalTabs.vue` 的 `handleCloseTab`）来断开连接。如果调用方遗漏，连接会泄漏。

**建议**: 在 `onUnmounted` 中调用 `window.api.session.disconnect(props.tab.id)`

---

## 四、Preload 层

### 问题12：`terminal.onData/onClose/onError` 返回的清理函数没有防止重复调用

**位置**: [preload/index.ts:L135-L150](../../preload/index.ts#L135-L150)

```typescript
onData: (callback) => {
  ipcRenderer.on(IPC_CHANNELS.TERMINAL.DATA, callback)
  return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL.DATA, callback)
}
```

**问题**: 如果清理函数被调用多次，第二次调用时 `callback` 已经被移除，`removeListener` 会静默失败（不会抛异常，但也没有提示）。

**影响**: 低优先级，不会导致功能问题。

---

## 五、问题汇总

| 编号 | 模块 | 问题 | 严重程度 | 影响 |
|------|------|------|---------|------|
| 问题1 | SSHManager | connect() 失败后连接残留 | 中 | 内存泄漏 |
| 问题2 | SSHManager | disconnect() 无错误处理 | 中 | 连接泄漏 |
| 问题3 | SSHManager | 监听器没有去重机制 | 高 | 数据重复 |
| 问题4 | SSHManager | resize() 硬编码像素尺寸 | 低 | 部分应用显示异常 |
| 问题5 | IPC/session | CONNECT 失败无回滚 | 高 | 连接泄漏 |
| 问题6 | IPC/terminal | WRITE/RESIZE 无状态检查 | 低 | 静默失败 |
| 问题8 | XTerminal | 主题监听重复注册 | 低 | 性能开销 |
| 问题9 | TerminalTabs | 关闭标签页时多余 disconnect | 低 | 多余 IPC 调用 |
| 问题11 | XTerminal | onUnmounted 不断开 SSH | 中 | 依赖调用方清理 |

---

## 六、修复优先级

| 优先级 | 问题 | 修复难度 |
|--------|------|---------|
| P0 | 问题3：监听器去重 | 低（注册前移除旧监听器） |
| P0 | 问题5：CONNECT 失败回滚 | 低（catch 中 disconnect） |
| P1 | 问题1：connect 失败清理 | 低（error 回调中清理 Map） |
| P1 | 问题2：disconnect 错误处理 | 低（加 try-finally） |
| P1 | 问题11：onUnmounted 断开连接 | 低（加 disconnect 调用） |
| P2 | 问题6：WRITE/RESIZE 状态检查 | 低（加状态检查+日志） |
| P3 | 问题8：重复 watch | 低（删除重复代码） |
| P3 | 问题9：多余 disconnect | 低（加状态判断） |
| P3 | 问题4：resize 硬编码 | 中（传递像素尺寸） |
