# 终端 (Terminal) — 代码分析

> 本文档记录 `src/renderer/src/components/terminal/` 及相关模块的核心实现细节。
> 架构概览见 [code-struture.md](../code-struture.md)。

---

## SSH 连接时终端尺寸动态获取

### 问题背景

SSH 连接远程服务器时，`ssh2` 的 `client.shell()` 需要指定 PTY 的 `cols`（列数）和 `rows`（行数）。如果使用硬编码值（如 `80x24`），与前端 xterm.js 实际窗口大小不一致，会导致：

- 远程 shell 提示符换行位置异常
- vim / tmux 等全屏程序区域计算错误
- 首次连接后需等待 resize 事件才能修正

### 数据流

```
用户打开标签页 → XTerminal.initTerminal()
  → fitAddon.fit() → 触发 onResize({ cols: 120, rows: 36 })
    → terminalStore.updateTerminalSize(tabId, { cols: 120, rows: 36, width, height })
      ↓
用户点击连接 → TerminalTab.handleConnect()
  → terminalStore.getTerminalSize(tabId) → { cols: 120, rows: 36 }
    → window.api.session.connect(tabId, sessionId, { cols: 120, rows: 36 })
      ↓ (IPC)
      → SSHManager.connect(tabId, session, false, { cols: 120, rows: 36 })
        → client.shell({ term: 'xterm-256color', cols: 120, rows: 36 })
          → 远程 PTY 以正确尺寸 + 256色创建 ★
```

### 各层职责与关键代码

#### 第 1 层：XTerminal — 尺寸采集

[XTerminal.vue](../../../src/renderer/src/components/terminal/XTerminal.vue) 在终端初始化时注册 `onResize` 回调，将 xterm.js 报告的尺寸写入 Store 并通过 IPC 通知主进程：

```typescript
// XTerminal.vue — initTerminal() 中
terminal.onResize(({ cols, rows }) => {
  const size: TerminalSize = {
    cols,
    rows,
    width: terminalContainer.value?.clientWidth || 0,
    height: terminalContainer.value?.clientHeight || 0
  }
  window.api.terminal.resize(props.tab.id, size)     // IPC 通知主进程 resize
  terminalStore.updateTerminalSize(props.tab.id, size) // ★ 写入 Pinia Store
})
```

**时机**：`fitAddon.fit()` 在 `open()` 之后立即调用，触发一次 `onResize`。后续窗口调整也会触发。

#### 第 2 层：terminalStore — 尺寸存储与查询

[terminal.ts](../../../src/renderer/src/stores/terminal.ts) 使用 `Map<string, TerminalSize>` 按 tabId 存储每个终端的尺寸：

```typescript
// terminal.ts
const terminalSizes = ref<Map<string, TerminalSize>>(new Map())

/** 更新终端尺寸 */
function updateTerminalSize(id: string, size: TerminalSize): void {
  terminalSizes.value.set(id, size)
}

/** 获取终端尺寸 */
function getTerminalSize(id: string): TerminalSize | undefined {
  return terminalSizes.value.get(id)
}
```

#### 第 3 层：TerminalTab — 尺寸读取与传递

[TerminalTab.vue](../../../src/renderer/src/components/terminal/TerminalTab.vue) 在发起 SSH 连接前从 Store 读取当前终端尺寸：

```typescript
// TerminalTab.vue — handleConnect / handleDuplicateSession / handleReconnectSession
const initialSize = terminalStore.getTerminalSize(newTab.id)
await window.api.session.connect(
  newTab.id,
  session.id,
  initialSize ? { cols: initialSize.cols, rows: initialSize.rows } : undefined
)
```

**容错**：如果 Store 中尚无该 tabId 的尺寸数据（极端情况），传入 `undefined`，主进程侧会回退到默认值 `80x24`。

#### 第 4 层：Preload — API 类型定义

[preload/index.ts](../../../src/preload/index.ts) 扩展 `session.connect()` 签名，新增可选的第 3 参数：

```typescript
// preload/index.ts
connect: (
  tabId: string,
  sessionId: string,
  initialSize?: { cols: number; rows: number }  // 可选参数，向后兼容
): Promise<{ success: boolean; tabId: string }> =>
  ipcRenderer.invoke(IPC_CHANNELS.SESSION.CONNECT, tabId, sessionId, initialSize),
```

类型声明同步更新于 [global.d.ts](../../../src/shared/types/global.d.ts#L26)：
```typescript
connect: (tabId: string, sessionId: string, initialSize?: { cols: number; rows: number }) => Promise<{ ... }>
```

#### 第 5 层：IPC Handler — 参数透传

[session.ts](../../../src/main/ipc/session.ts) 接收 `initialSize` 并转发给 `SSHManager.connect()`：

```typescript
// session.ts IPC handler
ipcMain.handle(IPC_CHANNELS.SESSION.CONNECT, async (
  event,
  tabId: string,
  sessionId: string,
  initialSize?: { cols: number; rows: number }  // 新增参数
) => {
  await SSHManager.connect(tabId, session, false, initialSize)  // 透传
})
```

#### 第 6 层：SSHManager — 使用动态尺寸创建 Shell

[ssh-manager.ts](../../../src/main/services/ssh-manager.ts) `connect()` 方法接受 `initialSize?` 可选参数：

```typescript
// ssh-manager.ts — connect() 方法签名
static async connect(
  tabId: string,
  session: Session,
  isTestConnection: boolean = false,
  initialSize?: { cols: number; rows: number }  // 新增
): Promise<string> {
  // ...

  const terminalConfig = StoreService.getConfig().terminal
  const cols = initialSize?.cols || 80   // 动态值优先，兜底默认值
  const rows = initialSize?.rows || 24
  client.shell(
    {
      term: terminalConfig.terminalType,  // 'xterm-256color' → 解决 vim 高亮
      cols,                               // 从 XTerminal 动态获取
      rows
    },
    (err, stream) => { /* ... */ }
  )
}
```

**双重修复**：此改动同时解决了两个问题：
1. **vim 无语法高亮**：传入 `term: 'xterm-256color'`
2. **PTY 尺寸不一致**：传入动态的 `cols/rows`

### 设计决策

| 决策 | 原因 |
|------|------|
| `initialSize` 为可选参数 | 向后兼容——不传则回退到 `80x24` 默认值 |
| 用 `Map<tabId, size>` 存储 | 多标签页各自独立尺寸，O(1) 查询 |
| `onResize` 同时写 Store 和 IPC | Store 用于「新建连接时读取」，IPC 用于「已连接时的实时 resize」 |
| `cols \|\| 80` 兜底 | 防止 undefined 导致 ssh2 报错 |

### 修改文件清单

| 文件 | 改动说明 |
|------|----------|
| [ssh-manager.ts](../../../src/main/services/ssh-manager.ts) | `connect()` 新增 `initialSize?`；`client.shell()` 传入 `term + cols + rows` |
| [session.ts IPC](../../../src/main/ipc/session.ts) | handler 接收并转发 `initialSize` |
| [preload/index.ts](../../../src/preload/index.ts) | `session.connect()` API 扩展第 3 参数 |
| [global.d.ts](../../../src/shared/types/global.d.ts) | 类型声明同步更新 |
| [TerminalTab.vue](../../../src/renderer/src/components/terminal/TerminalTab.vue) | 连接前从 `terminalStore.getTerminalSize()` 读取尺寸 |
| [XTerminal.vue](../../../src/renderer/src/components/terminal/XTerminal.vue) | 已有 `onResize` 写入 Store（无需修改） |
| [terminal.ts Store](../../../src/renderer/src/stores/terminal.ts) | 已有 `getTerminalSize()` / `updateTerminalSize()`（无需修改） |

### 验证方式

1. SSH 连接到远程服务器
2. 执行 `vim <任意代码文件>` → 确认有颜色区分（256 色）
3. 执行 `echo $TERM` → 应输出 `xterm-256color`
4. 调整终端窗口大小后新建连接 → 远程 PTY 尺寸应与终端一致
5. 执行 `stty size` → 输出应匹配前端终端的 `rows cols`

---

## 相关 Bug 记录

- [BUG-045: SSH vim 无语法高亮 + PTY 尺寸动态获取](../../bugs/BUG-045-ssh-vim-no-highlight-dynamic-pty-size.md)
