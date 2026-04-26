# API 层问题分析

## 1. `terminalAPI.onData/onClose/onError` 重复注册监听器无保护

**文件**: [terminal.ts](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/api/terminal.ts#L52-L91)

**严重程度**: 🟠 严重

**问题**: `onData`、`onClose`、`onError` 每次调用都会通过 `ipcRenderer.on` 注册新的监听器。如果调用方忘记调用返回的清理函数，或者多次调用 `onData`，监听器会累积，导致同一事件触发多次回调。

```ts
onData: (callback: TerminalDataCallback): (() => void) => {
  const handler = (_event: Electron.IpcRendererEvent, data: unknown) => {
    callback(data as { sessionId: string; data: string })
  }
  ipcRenderer.on(IPC_CHANNELS.TERMINAL.DATA, handler)  // 每次调用都新增监听器
  return () => {
    ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL.DATA, handler)
  }
}
```

**影响**: 
- 如果组件重新挂载但清理函数未正确调用，旧监听器仍然存活，造成内存泄漏
- 同一终端数据被多次写入 xterm.js，出现重复输出

**建议**: 
- 在 `onData` 内部维护一个监听器集合，同一 channel 只注册一次底层 `ipcRenderer.on`
- 或者在注册前先 `removeAllListeners(channel)` 清理旧监听器

---

## 2. `terminalAPI` 事件回调类型断言无运行时校验

**文件**: [terminal.ts](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/api/terminal.ts#L54-L56)

**严重程度**: 🟡 中等

**问题**: 回调中使用 `as` 类型断言直接将 `unknown` 转为目标类型，没有运行时校验：

```ts
const handler = (_event: Electron.IpcRendererEvent, data: unknown) => {
  callback(data as { sessionId: string; data: string })  // 无校验
}
```

**影响**: 如果主进程发送的数据格式不符合预期（如字段缺失、类型错误），渲染进程会在使用时抛出难以追踪的运行时错误。

**建议**: 加入运行时校验：
```ts
const handler = (_event: Electron.IpcRendererEvent, data: unknown) => {
  if (typeof data === 'object' && data !== null && 'sessionId' in data && 'data' in data) {
    callback(data as { sessionId: string; data: string })
  } else {
    console.warn('[terminalAPI] Invalid data format:', data)
  }
}
```

---

## 3. `sessionGroupAPI.create` 使用 `Date.now()` 作为 `order`

**文件**: [session.ts](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/api/session.ts#L116-L119)

**严重程度**: 🟡 中等

**问题**: 创建分组时 `order` 字段使用 `Date.now()`，如果两个分组在同一毫秒内创建，`order` 值相同，排序不稳定。

```ts
create: (data: { name: string; icon?: string }, parentId?: string): Promise<SessionGroup> => {
  return ipcRenderer.invoke(IPC_CHANNELS.SESSION_GROUP.CREATE, {
    ...data,
    parentId,
    order: Date.now() // 使用时间戳作为默认排序
  })
}
```

**影响**: 快速连续创建多个分组时，排序可能出现随机跳变。

**建议**: 将 `order` 的生成逻辑移至主进程，由主进程查询当前最大 `order` 值后 +1 赋值。

---

## 4. `sessionAPI.connect` 返回值语义不清晰

**文件**: [session.ts](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/api/session.ts#L66-L68)

**严重程度**: 🟢 轻微

**问题**: `connect` 方法参数 `id` 实际上是 tabId（标签页 ID），但返回类型中 `sessionId` 字段名容易与实际 session ID 混淆。

```ts
connect: (id: string): Promise<{ success: boolean; sessionId: string }> => {
  return ipcRenderer.invoke(IPC_CHANNELS.SESSION.CONNECT, id)
}
```

**影响**: 调用方可能误以为返回的 `sessionId` 是会话 ID，实际是 tabId。

**建议**: 将返回类型改为 `{ success: boolean; tabId: string }` 以明确语义。

---

## 5. `sessionAPI.testConnection` 接受 `Partial<Session>` 无必填校验

**文件**: [session.ts](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/api/session.ts#L93-L95)

**严重程度**: 🟡 中等

**问题**: `testConnection` 接受 `Partial<Session>` 类型，但测试连接需要 `host`、`port`、`username` 等必填字段。如果调用方传入空对象 `{}`，会发送到主进程执行无效连接。

```ts
testConnection: (sessionData: Partial<Session>): Promise<boolean> => {
  return ipcRenderer.invoke(IPC_CHANNELS.SESSION.TEST_CONNECTION, sessionData)
}
```

**影响**: 无效参数被发送到主进程，主进程可能抛出异常或返回不可预期的结果。

**建议**: 
- 将参数类型改为明确的必填类型：
  ```ts
  interface TestConnectionParams {
    host: string
    port: number
    username: string
    authType: 'password' | 'key'
    password?: string
    privateKey?: string
  }
  testConnection: (sessionData: TestConnectionParams): Promise<boolean>
  ```
- 或在函数内做前置校验

---

## 6. `terminalAPI.write/resize` 无错误处理

**文件**: [terminal.ts](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/api/terminal.ts#L33-L46)

**严重程度**: 🟢 轻微

**问题**: `write` 和 `resize` 使用 `ipcRenderer.send`（fire-and-forget），如果主进程处理失败，渲染进程无法感知。

```ts
write: (sessionId: string, data: string): void => {
  ipcRenderer.send(IPC_CHANNELS.TERMINAL.WRITE, sessionId, data)  // 无返回值，无错误处理
}
```

**影响**: 用户输入的命令可能丢失，但 UI 没有任何提示。

**建议**: 考虑改用 `ipcRenderer.invoke` 返回操作结果，或在主进程通过 `terminal:error` 事件推送失败通知。

---

## 7. `configAPI.set` 返回类型可能不准确

**文件**: [config.ts](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/api/config.ts#L28-L30)

**严重程度**: 🟢 轻微

**问题**: `set` 接收 `Partial<AppConfig>`，返回 `Promise<AppConfig>`。如果主进程没有正确合并 partial 配置，返回的可能不是完整的 `AppConfig`。

```ts
set: (config: Partial<AppConfig>): Promise<AppConfig> => {
  return ipcRenderer.invoke(IPC_CHANNELS.CONFIG.SET, config)
}
```

**影响**: 调用方期望得到完整配置，但可能只得到部分字段。

**建议**: 确保主进程 `CONFIG.SET` handler 正确合并后返回完整配置。

---

## 8. `sessionAPI.getById` 返回 `undefined` 而非抛错

**文件**: [session.ts](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/api/session.ts#L28-L30)

**严重程度**: 🟢 轻微

**问题**: 当会话不存在时返回 `undefined`，调用方可能忘记处理 `undefined` 情况，导致后续代码报错。

```ts
getById: (id: string): Promise<Session | undefined> => {
  return ipcRenderer.invoke(IPC_CHANNELS.SESSION.GET_BY_ID, id)
}
```

**建议**: 这是合理的设计（而非 bug），但调用方应始终检查返回值。

---

## 9. API 层缺少全局错误拦截

**文件**: [session.ts](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/api/session.ts)、[config.ts](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/api/config.ts)、[terminal.ts](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/api/terminal.ts)

**严重程度**: 🟡 中等

**问题**: 所有 `ipcRenderer.invoke` 调用都没有 `try/catch` 包裹。如果主进程抛出异常（如数据库连接失败、文件读写错误），错误会直接传播到调用方。

**影响**: 
- 调用方必须自行处理错误，否则未捕获的 Promise rejection 可能导致页面崩溃
- 每个调用方都需要重复写相同的错误处理逻辑

**建议**: 
- 在 API 层统一封装错误拦截，将原始错误转换为业务错误：
  ```ts
  const invokeWithErrorHandling = async <T>(channel: string, ...args: unknown[]): Promise<T> => {
    try {
      return await ipcRenderer.invoke(channel, ...args)
    } catch (error) {
      console.error(`[API] IPC invoke failed on ${channel}:`, error)
      throw new Error(`操作失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  ```

---

## 10. `sessionGroupAPI.checkCanMoveGroup` 未被使用

**文件**: [session.ts](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/api/session.ts#L155-L163)

**严重程度**: 🟢 轻微

**问题**: `checkCanMoveGroup` API 已定义，但在整个 renderer 进程中搜索不到调用方。

**影响**: 死代码，增加维护成本。

**建议**: 如果移动分组功能尚未实现，可以暂时保留但加 `@deprecated` 注释；如果已废弃，应删除。
