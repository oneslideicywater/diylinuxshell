# SSH 连接服务

本模块负责 SSH 连接的创建、维护和销毁，以及与 UI 界面的数据交互。

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                        渲染进程 (UI)                              │
├─────────────────────────────────────────────────────────────────┤
│  XTerminal.vue          SessionList.vue      SessionForm.vue    │
│       │                       │                     │           │
│       ▼                       ▼                     ▼           │
│  terminal API            session API           session API      │
└───────┬───────────────────────┬─────────────────────┬───────────┘
        │                       │                     │
        │ IPC 通信              │ IPC 通信            │ IPC 通信
        ▼                       ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                        主进程 (Main)                             │
├─────────────────────────────────────────────────────────────────┤
│  terminal.ts IPC        session.ts IPC                           │
│       │                       │                                  │
│       ▼                       ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    SSHManager                            │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │    │
│  │  │  connect()  │  │ disconnect()│  │   write()   │     │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │    │
│  │  │  onData()   │  │  onClose()  │  │  onError()  │     │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    ssh2 库                               │    │
│  │                  (SSH 协议实现)                          │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## 核心文件

| 文件 | 说明 |
|------|------|
| `ssh-manager.ts` | SSH 连接管理器，管理所有 SSH 连接的生命周期 |
| `../ipc/session.ts` | 会话相关 IPC 处理，包括连接/断开会话 |
| `../ipc/terminal.ts` | 终端相关 IPC 处理，包括数据写入和大小调整 |
| `../../renderer/src/components/terminal/XTerminal.vue` | 终端 UI 组件，基于 xterm.js |

## SSH 连接流程

### 1. 用户发起连接

```
用户点击连接按钮
    │
    ▼
SessionList.vue: handleConnect()
    │
    ▼
创建终端标签页
    │
    ▼
调用 window.api.session.connect(sessionId)
    │
    ▼
IPC 通信: SESSION.CONNECT
```

### 2. 主进程处理连接

```typescript
// session.ts IPC 处理
ipcMain.handle(IPC_CHANNELS.SESSION.CONNECT, async (event, id) => {
  // 1. 获取会话配置
  const session = StoreService.getSessionById(id)
  
  // 2. 更新状态为连接中
  StoreService.updateSession(id, { status: 'connecting' })
  
  // 3. 建立 SSH 连接
  await SSHManager.connect(session)
  
  // 4. 注册数据监听器
  SSHManager.onData(id, (data) => {
    win.webContents.send(IPC_CHANNELS.TERMINAL.DATA, { sessionId: id, data })
  })
  
  // 5. 更新状态为已连接
  StoreService.updateSession(id, { status: 'connected' })
})
```

### 3. SSHManager.connect() 实现

```typescript
static async connect(session: Session): Promise<string> {
  const client = new Client()
  
  // 构建连接配置
  const connectOptions = {
    host: session.host,
    port: session.port,
    username: session.username,
    password: CryptoService.decrypt(session.password), // 解密密码
    timeout: 30000,
    keepaliveInterval: 30000
  }
  
  return new Promise((resolve, reject) => {
    // 连接就绪
    client.on('ready', () => {
      // 创建 Shell 通道
      client.shell((err, stream) => {
        if (err) reject(err)
        
        connection.stream = stream
        resolve(session.id)
      })
    })
    
    // 发起连接
    client.connect(connectOptions)
  })
}
```

## 数据流向

### 用户输入 → SSH 服务器

```
用户在终端输入
    │
    ▼
XTerminal.vue: terminal.onData(data)
    │
    ▼
window.api.terminal.write(sessionId, data)
    │
    ▼
IPC: TERMINAL.WRITE
    │
    ▼
terminal.ts: SSHManager.write(sessionId, data)
    │
    ▼
ssh-manager.ts: connection.stream.write(data)
    │
    ▼
SSH 服务器
```

### SSH 服务器 → 终端显示

```
SSH 服务器返回数据
    │
    ▼
ssh-manager.ts: stream.on('data', callback)
    │
    ▼
session.ts: win.webContents.send(TERMINAL.DATA, { sessionId, data })
    │
    ▼
IPC: TERMINAL.DATA
    │
    ▼
XTerminal.vue: window.api.terminal.onData()
    │
    ▼
terminal.write(data)
    │
    ▼
xterm.js 渲染到界面
```

## 认证方式

### 密码认证

```typescript
if (session.authType === 'password' && session.password) {
  connectOptions.password = CryptoService.decrypt(session.password)
}
```

### 密钥认证

```typescript
if (session.authType === 'key' && session.keyPath) {
  const fs = await import('fs')
  connectOptions.privateKey = fs.readFileSync(session.keyPath)
  if (session.keyPassphrase) {
    connectOptions.passphrase = CryptoService.decrypt(session.keyPassphrase)
  }
}
```

## 终端大小调整

当用户调整窗口大小时：

```
窗口大小变化
    │
    ▼
XTerminal.vue: fitAddon.fit()
    │
    ▼
terminal.onResize({ cols, rows })
    │
    ▼
window.api.terminal.resize(sessionId, { cols, rows, width, height })
    │
    ▼
IPC: TERMINAL.RESIZE
    │
    ▼
SSHManager.resize(sessionId, rows, cols)
    │
    ▼
stream.setWindow(rows, cols, height, width)
    │
    ▼
SSH 服务器调整 PTY 大小
```

## 连接状态管理

### 状态类型

```typescript
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'
```

### 状态流转

```
disconnected → connecting → connected → disconnected
                  │              │
                  ▼              ▼
                error         error (网络断开等)
                  │
                  ▼
              disconnected
```

## 错误处理

### 连接错误

```typescript
client.on('error', (err) => {
  connection.status = 'error'
  connection.error = err.message
  
  // 通知 UI
  win.webContents.send(IPC_CHANNELS.TERMINAL.ERROR, {
    sessionId: id,
    error: err.message
  })
})
```

### 连接关闭

```typescript
stream.on('close', () => {
  connection.status = 'disconnected'
  
  // 通知 UI
  win.webContents.send(IPC_CHANNELS.TERMINAL.CLOSE, {
    sessionId: id
  })
})
```

## 安全性

### 密码加密存储

```typescript
// 保存时加密
session.password = CryptoService.encrypt(password)

// 使用时解密
connectOptions.password = CryptoService.decrypt(session.password)
```

### 连接隔离

每个 SSH 连接独立管理，通过 `sessionId` 进行隔离：

```typescript
private static connections: Map<string, SSHConnection> = new Map()
```

## 相关文档

- [IPC 通信流程](../../wiki/ipc-workflow.md)
- [终端组件实现](../../renderer/src/components/terminal/README.md)
- [会话状态管理](../../renderer/src/stores/README.md)
