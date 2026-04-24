# Bug 5: SSH 连接使用 vim 编辑器无语法高亮 + PTY 尺寸动态获取

## 问题 A: vim 无语法高亮

### 问题描述

通过 SSH 连接远程服务器后，使用 `vim` 编辑文件时没有语法高亮显示（代码全部为同一颜色）。

### 根本原因

[ssh-manager.ts](../../src/main/services/ssh-manager.ts) 中调用 `ssh2` 的 `client.shell()` 方法时存在两个问题：

1. **未传入 TERM 环境变量**：远程 PTY 默认使用 `TERM=xterm`（仅 16 色），vim 检测到不支持 256 色时自动关闭语法高亮
2. **cols/rows 硬编码为 80x24**：与 XTerminal 实际窗口大小不一致，可能导致终端渲染错位

虽然 [settings.ts](../../src/renderer/src/stores/settings.ts) 中已配置 `terminalType: 'xterm-256color'`，但该值**未被传递给 ssh2 的 shell() 调用**。

---

## 问题 B: PTY 尺寸硬编码

### 问题描述

`client.shell()` 使用固定值 `cols: 80, rows: 24` 创建远程 PTY，与前端 xterm.js 终端实际尺寸不一致。当用户调整窗口大小时，初始 PTY 尺寸错误会导致：
- 远程 shell 提示符换行位置异常
- vim/tmux 等全屏程序区域计算错误
- 首次连接时需要等待 resize 事件才能修正

### 解决方案（A + B 联合修复）

#### 第一步：XTerminal 记录尺寸到 Store

[XTerminal.vue](../../src/renderer/src/components/terminal/XTerminal.vue) 在 `onResize` 回调中将尺寸写入 Pinia Store：

```typescript
// XTerminal.vue — initTerminal() 中注册 onResize
terminal.onResize(({ cols, rows }) => {
  const size: TerminalSize = {
    cols,
    rows,
    width: terminalContainer.value?.clientWidth || 0,
    height: terminalContainer.value?.clientHeight || 0
  }
  window.api.terminal.resize(props.tab.id, size)  // IPC 通知主进程 resize
  terminalStore.updateTerminalSize(props.tab.id, size)  // ★ 写入 Store
})
```

Store 层 [terminal.ts](../../src/renderer/src/stores/terminal.ts) 提供 get/set API：

```typescript
// terminal.ts — 尺寸存储与查询
const terminalSizes = ref<Map<string, TerminalSize>>(new Map())

function updateTerminalSize(id: string, size: TerminalSize): void {
  terminalSizes.value.set(id, size)
}

function getTerminalSize(id: string): TerminalSize | undefined {
  return terminalSizes.value.get(id)
}
```

#### 第二步：TerminalTab 连接时读取尺寸并传递

[TerminalTab.vue](../../src/renderer/src/components/terminal/TerminalTab.vue) 在调用 `session.connect()` 前从 Store 读取尺寸：

```typescript
// TerminalTab.vue — handleDuplicateSession / handleReconnectSession
const initialSize = terminalStore.getTerminalSize(props.tab.id)
await window.api.session.connect(
  props.tab.id,
  props.tab.sessionId,
  initialSize ? { cols: initialSize.cols, rows: initialSize.rows } : undefined
)
```

#### 第三步：IPC 链路透传尺寸

**Preload 层** [preload/index.ts](../../src/preload/index.ts) 扩展 API 签名：

```typescript
// preload/index.ts
connect: (
  tabId: string,
  sessionId: string,
  initialSize?: { cols: number; rows: number }  // 新增可选参数
): Promise<{ success: boolean; tabId: string }> =>
  ipcRenderer.invoke(IPC_CHANNELS.SESSION.CONNECT, tabId, sessionId, initialSize),
```

**主进程 IPC Handler** [session.ts](../../src/main/ipc/session.ts) 接收并转发：

```typescript
// session.ts IPC handler
ipcMain.handle(IPC_CHANNELS.SESSION.CONNECT, async (
  event,
  tabId: string,
  sessionId: string,
  initialSize?: { cols: number; rows: number }  // 新增参数
) => {
  // ...
  await SSHManager.connect(tabId, session, false, initialSize)  // 透传
})
```

#### 第四步：SSHManager 使用动态尺寸创建 Shell

[ssh-manager.ts](../../src/main/services/ssh-manager.ts) `connect()` 方法接受 `initialSize` 参数：

```typescript
// ssh-manager.ts — connect() 方法签名扩展
static async connect(
  tabId: string,
  session: Session,
  isTestConnection: boolean = false,
  initialSize?: { cols: number; rows: number }  // 新增
): Promise<string> {
  // ...

  // client.on('ready') 回调中创建 Shell
  const terminalConfig = StoreService.getConfig().terminal
  const cols = initialSize?.cols || 80   // 动态值优先，兜底默认值
  const rows = initialSize?.rows || 24
  client.shell(
    {
      term: terminalConfig.terminalType,  // 'xterm-256color' → 解决 vim 高亮
      cols,                               // 从 XTerminal 动态获取 → 解决尺寸一致
      rows
    },
    (err, stream) => { /* ... */ }
  )
}
```

---

### 完整数据流图

```
用户打开标签页 → XTerminal.initTerminal()
  → fitAddon.fit() → 触发 onResize({ cols: 120, rows: 36 })
    → terminalStore.updateTerminalSize(tabId, { cols: 120, rows: 36, ... })
      ↓
用户点击连接 → TerminalTab.handleConnect()
  → terminalStore.getTerminalSize(tabId) → { cols: 120, rows: 36 }
    → window.api.session.connect(tabId, sessionId, { cols: 120, rows: 36 })
      ↓ (IPC)
      → SSHManager.connect(tabId, session, false, { cols: 120, rows: 36 })
        → client.shell({ term: 'xterm-256color', cols: 120, rows: 36 })
          → 远程 PTY 以 120x36 + 256色创建 ★
```

### 修改文件清单

| 文件 | 改动 |
|------|------|
| [ssh-manager.ts](../../src/main/services/ssh-manager.ts) | `connect()` 新增 `initialSize?` 参数；`client.shell()` 传入 `term + cols + rows` |
| [session.ts IPC](../../src/main/ipc/session.ts) | handler 接收并转发 `initialSize` |
| [preload/index.ts](../../src/preload/index.ts) | `session.connect()` API 扩展第 3 参数 |
| [TerminalTab.vue](../../src/renderer/src/components/terminal/TerminalTab.vue) | 连接前从 `terminalStore.getTerminalSize()` 读取尺寸 |

### 验证方式

1. SSH 连接到远程服务器
2. 执行 `vim <任意代码文件>` → 确认有颜色区分
3. 执行 `echo $TERM` → 应输出 `xterm-256color`
4. 执行 `tput colors` → 应输出 `256`
5. 调整终端窗口大小后新建连接 → 远程 PTY 尺寸应与终端一致

### 所属功能

终端 (Terminal) — SSH 连接 / PTY 创建 / 终端尺寸同步

### 修复日期

2026-04-24

### 状态

✅ 已修复
