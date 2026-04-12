# SFTP Connect 调用链路深度分析

## 概述

本文档详细分析 `window.api.sftp.connect()` 的完整调用链路，从渲染进程的 UI 触发到底层 SSH2 库的网络连接建立，涵盖 Electron IPC 通信、连接池管理、SSH 协议握手等各个环节。

## 完整调用链路图

```
┌─────────────────────────────────────────────────────────────────────┐
│  渲染进程 (Renderer Process)                                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ SftpTransfer.vue (第674行)                                   │    │
│  │                                                             │    │
│  │ const result = await window.api.sftp.connect(               │    │
│  │   connectionId,                                            │    │
│  │   { host, port, username, password }                       │    │
│  │ )                                                          │    │
│  └─────────────────────────┬───────────────────────────────────┘    │
└────────────────────────────┼────────────────────────────────────────┘
                             │ IPC 调用
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  预加载脚本 (Preload Script)                                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ preload/index.ts (第182-183行)                              │    │
│  │                                                             │    │
│  │ connect: (sessionId, config) =>                             │    │
│  │   ipcRenderer.invoke('sftp:connect', sessionId, config)     │    │
│  └─────────────────────────┬───────────────────────────────────┘    │
└────────────────────────────┼────────────────────────────────────────┘
                             │ Electron IPC Bridge
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  主进程 (Main Process)                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ ipc/sftp.ts (第14-24行)                                     │    │
│  │                                                             │    │
│  │ ipcMain.handle('sftp:connect', async (_event,              │    │
│  │   sessionId, config) => {                                   │    │
│  │                                                             │    │
│  │   // 从连接池获取或创建服务实例                               │    │
│  │   const service = sftpPool.getConnection(sessionId)         │    │
│  │                                                             │    │
│  │   // 建立实际连接                                            │    │
│  │   await service.connect(config)                              │    │
│  │                                                             │    │
│  │   return { success: true }                                  │    │
│  │ })                                                          │    │
│  └─────────────────────────┬───────────────────────────────────┘    │
└────────────────────────────┼────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  连接池管理器                                                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ services/sftp.ts (第699-705行)                              │    │
│  │                                                             │    │
│  │ getConnection(sessionId): SFTPService {                     │    │
│  │   if (!this.connections.has(sessionId)) {                   │    │
│  │     // 不存在则创建新的 SFTP 服务实例                        │    │
│  │     const service = new SFTPService()                      │    │
│  │     this.connections.set(sessionId, service)                │    │
│  │   }                                                         │    │
│  │   return this.connections.get(sessionId)!                   │    │
│  │ }                                                           │    │
│  └─────────────────────────┬───────────────────────────────────┘    │
└────────────────────────────┼────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SSH2 实际连接建立                                                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ services/sftp.ts (第43-72行)                                │    │
│  │                                                             │    │
│  │ async connect(config): Promise<void> {                      │    │
│  │   return new Promise((resolve, reject) => {                 │    │
│  │     this.client                                             │    │
│  │       .on('ready', () => {                                  │    │
│  │         this.connected = true                               │    │
│  │         this.client.sftp((err, sftp) => {                   │    │
│  │           if (err) reject(err)                              │    │
│  │           this.sftpHandle = sftp                            │    │
│  │           console.log('SFTP handle initialized')            │    │
│  │           resolve()                                         │    │
│  │         })                                                  │    │
│  │       })                                                     │    │
│  │       .on('error', (err) => reject(err))                    │    │
│  │       .connect({ host, port, username, password })          │    │
│  │   })                                                         │    │
│  │ }                                                           │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 第一层：渲染进程 - UI 触发

### 文件位置

**文件**：`src/renderer/src/components/session/sftp/SftpTransfer.vue`

**行号**：第 674-679 行

### 代码实现

```typescript
/**
 * ✅✅✅ 这里是实际发起 IPC 调用的地方！
 * 通过 window.api.sftp.connect 向主进程请求建立 SFTP 连接
 */
const result = await window.api.sftp.connect(connectionId, {
  host: props.session.host,
  port: props.session.port || 22,
  username: props.session.username,
  password: props.session.password
})
```

### 参数说明

| 参数 | 类型 | 值示例 | 用途 |
|------|------|--------|------|
| `connectionId` | string | `"sftp-1704...abc"` | 连接池 key，标识独立连接（每个标签唯一） |
| `config.host` | string | `"192.168.10.24"` | 远程服务器地址 |
| `config.port` | number | `22` | SSH 端口 |
| `config.username` | string | `"root"` | 登录用户名 |
| `config.password` | string | `"One.00000"` | 登录密码 |

### 触发时机

此代码在以下场景执行：

1. **首次打开 SFTP 标签时**
   ```typescript
   watch(() => props.sftpWindowVisible, async (newVal) => {
     if (newVal) {
       if (sftpConnected.value) return  // 避免重复连接
       // ... 执行连接代码
     }
   }, { immediate: true })  // 立即触发
   ```

2. **组件挂载且 visible 为 true 时**（嵌入式模式）

3. **手动重新连接时**（如果之前断开）

### 返回值处理

```typescript
const result = await window.api.sftp.connect(connectionId, config)

if (!result.success) {
  console.error('SFTP 连接失败:', result.error)
  alert(`SFTP 连接失败：${result.error}`)
  close()
  return
}

console.log('SFTP connected successfully')
sftpConnected.value = true
// 继续加载文件列表...
```

**返回值结构**：
```typescript
{
  success: boolean      // 是否成功
  error?: string        // 错误信息（失败时）
}
```

---

## 第二层：预加载脚本 - IPC 桥接

### 文件位置

**文件**：`src/preload/index.ts`

**行号**：第 180-183 行

### 代码实现

```typescript
/**
 * SFTP 文件传输相关方法
 * 暴露给渲染进程的安全 API 接口
 */
sftp: {
  /**
   * 连接 SFTP 服务器
   * 将渲染进程的函数调用转换为 IPC 消息发送到主进程
   *
   * @param sessionId - 连接标识符（每个标签独立）
   * @param config - SSH 连接配置
   * @returns Promise<{ success: boolean; error?: string }>
   */
  connect: (
    sessionId: string,
    config: {
      host: string;
      port: number;
      username: string;
      password?: string;
    }
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('sftp:connect', sessionId, config),
  
  // ... 其他方法（listDir, download, upload, disconnect 等）
}
```

### 工作原理

#### 1. 参数接收与类型检查

```typescript
connect: (sessionId: string, config: SFTPConfig): Promise<ConnectResult>
```

预加载脚本接收渲染进程传入的参数，并进行 TypeScript 类型约束。

#### 2. IPC 消息转换

```typescript
ipcRenderer.invoke('sftp:connect', sessionId, config)
```

使用 Electron 的 `ipcRenderer.invoke()` 方法：
- 发送异步 IPC 消息到主进程
- 消息通道名称：`'sftp:connect'`
- 消息数据：`(sessionId, config)` 元组
- 返回 Promise，等待主进程响应

#### 3. 安全隔离机制

Electron 的 preload 脚本运行在**独立的上下文**中：

```
渲染进程（网页上下文）
    ↓ 调用 window.api.sftp.connect()
    ↓
preload 脚本（特权上下文）
    ↓ 使用 ipcRenderer.invoke()
    ↓
主进程（Node.js 环境）
```

**安全优势**：
- 渲染进程无法直接访问 Node.js API
- 所有跨进程通信必须通过预定义的 IPC 通道
- 参数经过序列化/反序列化，防止原型污染攻击

#### 4. 其他相关 API 定义

```typescript
sftp: {
  // 连接
  connect: (sessionId, config) => ipcRenderer.invoke('sftp:connect', sessionId, config),
  
  // 列出目录
  listDir: (sessionId, remotePath) => ipcRenderer.invoke('sftp:listDir', sessionId, remotePath),
  
  // 上传文件
  upload: (sessionId, localPath, remotePath) => ipcRenderer.invoke('sftp:upload', sessionId, localPath, remotePath),
  
  // 下载文件
  download: (sessionId, remotePath, localPath) => ipcRenderer.invoke('sftp:download', sessionId, remotePath, localPath),
  
  // 断开连接
  disconnect: (sessionId) => ipcRenderer.invoke('sftp:disconnect', sessionId),
  
  // ... 更多方法
}
```

---

## 第三层：主进程 - IPC 处理器

### 文件位置

**文件**：`src/main/ipc/sftp.ts`

**行号**：第 14-27 行

### 代码实现

```typescript
/**
 * 注册 SFTP 相关的 IPC 处理器
 * 在应用启动时调用 registerSFTPIpcHandlers() 注册所有处理器
 */
export function registerSFTPIpcHandlers(): void {
  /**
   * 处理 'sftp:connect' IPC 消息
   * 响应渲染进程的 SFTP 连接请求
   */
  ipcMain.handle('sftp:connect', async (_event, sessionId: string, config: SFTPConfig) => {
    try {
      console.log('Connecting to:', config.host, 'with session:', sessionId)
      
      // 步骤1：从连接池获取或创建 SFTP 服务实例
      const service = sftpPool.getConnection(sessionId)
      
      // 步骤2：调用服务的 connect 方法建立实际连接
      await service.connect(config)
      
      console.log('Connected successfully to:', config.host, 'session:', sessionId)
      
      return { success: true }
    } catch (error: any) {
      console.error('Connect error:', error.message)
      return { success: false, error: error.message }
    }
  })
}
```

### 执行流程详解

#### 1. 消息到达与参数解构

```
IPC 消息到达主进程
    ↓
解构参数：
  _event: IpcMainInvokeEvent  // Electron 事件对象（包含 sender 信息）
  sessionId: "sftp-1704001000-a1b2c3"  // 连接标识符
  config: {
    host: "192.168.10.24",
    port: 22,
    username: "root",
    password: "One.00000"
  }
```

#### 2. 获取服务实例

```typescript
const service = sftpPool.getConnection(sessionId)
```

调用连接池管理器的 `getConnection()` 方法：
- 如果 `sessionId` 已存在 → 返回已有的 `SFTPService` 实例
- 如果 `sessionId` 不存在 → 创建新的 `SFTPService` 实例并缓存

**关键点**：由于我们为每个标签生成了唯一的 `connectionId`，所以每次都会创建新实例！

#### 3. 建立连接

```typescript
await service.connect(config)
```

调用 `SFTPService` 实例的 `connect()` 方法，该方法内部会：
1. 创建 TCP socket 连接到远程服务器
2. 进行 SSH 协议握手
3. 用户认证
4. 启动 SFTP 子系统

这是一个**异步操作**，需要等待网络 I/O 完成。

#### 4. 结果返回

```typescript
return { success: true }  // 成功
// 或
return { success: false, error: error.message }  // 失败
```

返回结果会被自动序列化并通过 IPC 回传给渲染进程。

### 错误处理策略

```typescript
try {
  // 尝试连接...
} catch (error: any) {
  // 捕获所有异常并返回友好的错误信息
  console.error('Connect error:', error.message)  // 记录日志
  return { success: false, error: error.message }  // 返回错误给渲染进程
}
```

**可能捕获的错误类型**：

| 错误类型 | 示例消息 | 原因 |
|---------|---------|------|
| 网络错误 | `ECONNREFUSED` | 服务器未启动或防火墙阻止 |
| 认证失败 | `Authentication failed` | 用户名或密码错误 |
| 超时错误 | `Connection timed out` | 网络延迟过高 |
| 主机不可达 | `ENOTFOUND` | DNS 解析失败或 IP 不正确 |

---

## 第四层：连接池管理器

### 文件位置

**文件**：`src/main/services/sftp.ts`

**行号**：第 683-729 行

### 代码实现

```typescript
/**
 * SFTP 连接池（单例模式）
 * 全局统一管理所有 SFTP 连接实例
 * 使用 Map 数据结构存储 <sessionId, SFTPService> 键值对
 */
class SFTPConnectionPool {
  private static instance: SFTPConnectionPool
  
  /** 关键数据结构：Map<连接标识符, SFTP服务实例> */
  private connections: Map<string, SFTPService> = new Map()

  private constructor() {}

  /**
   * 单例模式：确保全局只有一个连接池实例
   */
  static getInstance(): SFTPConnectionPool {
    if (!SFTPConnectionPool.instance) {
      SFTPConnectionPool.instance = new SFTPConnectionPool()
    }
    return SFTPConnectionPool.instance
  }

  /**
   * 获取或创建 SFTP 连接
   * 这是核心方法！决定了是复用还是新建连接
   *
   * @param sessionId - 连接标识符（每个标签页唯一）
   * @returns SFTPService 实例
   */
  getConnection(sessionId: string): SFTPService {
    if (!this.connections.has(sessionId)) {
      // 不存在 → 创建新的 SFTPService 实例
      const service = new SFTPService()
      this.connections.set(sessionId, service)
      console.log(`[SFTPPool] 创建新连接: ${sessionId}`)
    }
    
    // 已存在 → 返回现有实例（复用）
    return this.connections.get(sessionId)!
  }

  /**
   * 移除连接（关闭标签时调用）
   * 断开连接并从池中移除
   */
  removeConnection(sessionId: string): void {
    const connection = this.connections.get(sessionId)
    if (connection) {
      connection.disconnect()  // 断开 SSH 连接
      this.connections.delete(sessionId)
      console.log(`[SFTPPool] 移除连接: ${sessionId}`)
    }
  }

  /**
   * 清理所有连接（应用退出时调用）
   * 防止资源泄漏
   */
  cleanup(): void {
    for (const connection of this.connections.values()) {
      connection.disconnect()
    }
    this.connections.clear()
  }
}

/** 导出单例实例供全局使用 */
export const sftpPool = SFTPConnectionPool.getInstance()
```

### 内存结构示意

```
sftpPool.connections (Map<string, SFTPService>)
┌─────────────────────────────────────────────────────────────┐
│ Key                         │ Value                          │
├─────────────────────────────┼───────────────────────────────┤
│ "sftp-1704001000-a1b2c3"   │ SFTPService {                  │
│                             │   client: ssh2.Client_1,      │
│                             │   sftpHandle: SFTPStream_1,   │
│                             │   connected: true             │
│                             │ }                              │
├─────────────────────────────┼───────────────────────────────┤
│ "sftp-1704002000-d4e5f6"   │ SFTPService {                  │
│                             │   client: ssh2.Client_2,      │
│                             │   sftpHandle: SFTPStream_2,   │
│                             │   connected: true             │
│                             │ }                              │
├─────────────────────────────┼───────────────────────────────┤
│ "sftp-1704003000-g7h8i9"   │ SFTPService {                  │
│                             │   client: ssh2.Client_3,      │
│                             │   sftpHandle: SFTPStream_3,   │
│                             │   connected: true             │
│                             │ }                              │
└─────────────────────────────────────────────────────────────┘

✅ 每个 key 都是唯一的 tabId（由 createSftpTab 生成）
✅ 每个 value 都是完全独立的 SFTPService 实例
✅ 每个 SFTPService 都有独立的 ssh2 Client 和 SFTP 句柄
```

### 为什么能保证独立性？

**关键在于 connectionId 的唯一性**：

```
场景：用户点击 ServerA 的 SFTP 按钮 3 次

第1次点击：
  connectionId = "sftp-1704001000-a1b2c3"
    ↓
  sftpPool.getConnection("sftp-1704001000-a1b2c3")
    ↓
  connections Map 中不存在该 key
    ↓
  创建 new SFTPService()  →  Instance #1
  connections.set("sftp-1704001000-a1b2c3", Instance #1)


第2次点击：
  connectionId = "sftp-1704002000-d4e5f6"  ← 不同！
    ↓
  sftpPool.getConnection("sftp-1704002000-d4e5f6")
    ↓
  connections Map 中不存在该 key
    ↓
  创建 new SFTPService()  →  Instance #2  ← 新实例！
  connections.set("sftp-1704002000-d4e5f6", Instance #2)


第3次点击：
  connectionId = "sftp-1704003000-g7h8i9"  ← 又不同！
    ↓
  同样的流程...
    ↓
  Instance #3 + TCP socket #3 + SFTP handle #3  ← 完全独立！
```

### 设计模式分析

#### 单例模式（Singleton Pattern）

```typescript
class SFTPConnectionPool {
  private static instance: SFTPConnectionPool
  
  static getInstance(): SFTPConnectionPool {
    if (!SFTPConnectionPool.instance) {
      SFTPConnectionPool.instance = new SFTPConnectionPool()
    }
    return SFTPConnectionPool.instance
  }
}

export const sftpPool = SFTPConnectionPool.getInstance()
```

**目的**：
- 确保全局只有一个连接池实例
- 提供统一的访问入口
- 避免重复创建导致资源浪费

#### 工厂模式（Factory Pattern）

```typescript
getConnection(sessionId: string): SFTPService {
  if (!this.connections.has(sessionId)) {
    const service = new SFTPService()  // 工厂创建新实例
    this.connections.set(sessionId, service)
  }
  return this.connections.get(sessionId)!
}
```

**目的**：
- 封装对象的创建逻辑
- 对外提供统一的获取接口
- 支持懒加载（按需创建）

---

## 第五层：SSH2 实际连接建立

### 文件位置

**文件**：`src/main/services/sftp.ts`

**行号**：第 30-77 行

### 代码实现

```typescript
import { Client } from 'ssh2'  // 使用 ssh2 库进行 SSH/SFTP 操作

/**
 * SFTP 服务类
 * 封装了单个 SSH/SFTP 连接的所有操作
 * 每个实例代表一个完全独立的连接
 */
export class SFTPService {
  /** SSH2 Client 实例（底层 TCP/SSH 连接） */
  private client: Client
  
  /** SFTP 子系统句柄（用于文件操作：上传、下载、列表等） */
  private sftpHandle: any = null
  
  /** 连接状态标志 */
  private connected: boolean = false

  constructor() {
    // 创建新的 ssh2 Client 实例
    this.client = new Client()
  }

  /**
   * ✅✅✅ 连接到 SFTP 服务器（真正的网络连接在这里建立！）
   * 
   * 执行流程：
   * 1. 建立 TCP socket 到远程服务器
   * 2. 进行 SSH 协议握手（版本交换、算法协商）
   * 3. 用户认证（密码或密钥）
   * 4. 启动 SFTP 子系统
   * 5. 获取 SFTP 句柄用于后续文件操作
   */
  async connect(config: SFTPConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client
        // 监听 'ready' 事件：SSH 握手完成、认证成功
        .on('ready', () => {
          this.connected = true
          
          // 在已建立的 SSH 会话上请求 SFTP 子系统
          this.client.sftp((err, sftp) => {
            if (err) {
              this.connected = false
              reject(err)
              return
            }
            
            // 保存 SFTP 句柄，后续所有文件操作都通过它执行
            this.sftpHandle = sftp
            
            console.log('SFTP handle initialized')
            resolve()  // 连接建立完成
          })
        })
        
        // 监听 'error' 事件：连接过程中发生错误
        .on('error', (err) => {
          this.connected = false
          reject(err)
        })
        
        // 发起实际的 TCP 连接和 SSH 握手
        .connect({
          host: config.host,           // "192.168.10.24"
          port: config.port,           // 22
          username: config.username,   // "root"
          password: config.password,   // "One.00000"
          privateKey: config.privateKey  // 可选：私钥认证
        })
    })
  }

  /**
   * 断开连接
   * 关闭 TCP socket 并清理资源
   */
  disconnect(): void {
    if (this.connected) {
      this.client.end()           // 关闭 TCP socket
      this.connected = false
      this.sftpHandle = null
    }
  }
}
```

### 详细执行过程

#### 第一步：创建 Promise 包装异步操作

```typescript
async connect(config: SFTPConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    // ... 事件驱动的连接逻辑
  })
}
```

**原因**：ssh2 库采用事件驱动模型，使用 Promise 可以将其转换为更易用的 async/await 模式。

#### 第二步：注册事件监听器

##### 1. 'ready' 事件 - SSH 握手完成

```typescript
.on('ready', () => {
  this.connected = true
  
  // 启动 SFTP 子系统
  this.client.sftp((err, sftp) => {
    if (err) {
      this.connected = false
      reject(err)
      return
    }
    
    this.sftpHandle = sftp
    resolve()
  })
})
```

**触发条件**：
- TCP 连接成功建立
- SSH 版本交换完成
- 加密算法协商完成
- 用户认证成功

**后续操作**：
1. 设置 `connected = true`
2. 请求 SFTP 子系统（在 SSH 通道上运行 SFTP 协议）
3. 获取 SFTP 句柄（用于文件操作）
4. 调用 `resolve()` 表示连接成功

##### 2. 'error' 事件 - 连接错误

```typescript
.on('error', (err) => {
  this.connected = false
  reject(err)
})
```

**触发条件**：
- 网络不可达
- 认证失败
- 服务器拒绝连接
- 超时

**处理方式**：
1. 设置 `connected = false`
2. 调用 `reject(err)` 将错误传递给调用者

#### 第三步：发起连接

```typescript
.connect({
  host: config.host,           // 远程服务器地址
  port: config.port,           // SSH 端口（默认 22）
  username: config.username,   // 登录用户名
  password: config.password,   // 登录密码
  privateKey: config.privateKey  // 可选：SSH 私钥
})
```

**底层发生的事情**：

```
1. DNS 解析（如果是域名）
   └→ 将主机名解析为 IP 地址

2. TCP 三次握手
   └→ SYN → SYN-ACK → ACK
   └→ 建立 TCP socket 连接到 server:22

3. SSH 协议版本交换
   └→ 客户端发送：SSH-2.0-xxx
   └→ 服务器响应：SSH-2.0-yyy

4. 算法协商
   └→ 密钥交换算法（ecdh-sha2-nistp256）
   └→ 加密算法（aes256-ctr）
   └→ MAC 算法（hmac-sha2-256）
   └→ 压缩算法（none）

5. 密钥交换
   └→ 生成共享密钥
   └→ 验证服务器身份（host key）

6. 用户认证
   └→ 发送用户名
   └→ 密码认证或公钥认证
   └→ 服务器验证凭据

7. 触发 'ready' 事件
   └→ SSH 通道就绪

8. 请求 SFTP 子系统
   └→ 在 SSH 通道上执行：sftp subsystem
   └→ SFTP 协议初始化（版本协商）
   └→ 返回 SFTP 句柄

9. 连接建立完成！
```

### SSH2 Client 内部状态机

```
初始状态
  ↓
client.connect(config)
  ↓
【连接中】
  ├─ TCP socket 创建
  ├─ DNS 解析
  └─ TCP 连接尝试
  ↓
【版本交换】
  ├─ 发送 SSH 版本字符串
  └→ 接收服务器版本
  ↓
【算法协商】
  ├─ 协商加密算法
  ├─ 协商 MAC 算法
  └→ 协商压缩算法
  ↓
【密钥交换】
  ├─ Diffie-Hellman 密钥交换
  ├─ 生成会话密钥
  └→ 验证 host key
  ↓
【认证阶段】
  ├─ 发送认证请求
  ├─ 密码 / 公钥认证
  └→ 服务器验证
  ↓
【就绪】✅
  ├→ 触发 'ready' 事件
  ├─ this.connected = true
  └→ 请求 SFTP 子系统
  ↓
【SFTP 就绪】✅✅
  ├→ 获取 sftpHandle
  ├→ resolve()
  └→ 连接可用！
```

### SFTP 句柄的作用

```typescript
this.sftpHandle = sftp  // ssh2.SFTPWrapper 实例
```

**SFTP 句柄提供的核心方法**：

| 方法 | 用途 | 示例 |
|------|------|------|
| `readdir(path)` | 列出目录内容 | 浏览远程文件 |
| `stat(path)` | 获取文件属性 | 文件大小、权限、修改时间 |
| `readFile(path)` | 读取文件内容 | 下载小文件 |
| `writeFile(path, data)` | 写入文件内容 | 上传小文件 |
| `fastGet(remote, local)` | 快速下载（流式） | 大文件下载 |
| `fastPut(local, remote)` | 快速上传（流式） | 大文件上传 |
| `unlink(path)` | 删除文件 | 删除远程文件 |
| `rmdir(path)` | 删除目录 | 删除空目录 |
| `mkdir(path)` | 创建目录 | 新建文件夹 |
| `rename(oldPath, newPath)` | 重命名/移动 | 文件整理 |

**所有后续的文件操作都通过这个句柄执行**！

---

## 完整数据流图

### 请求流程（渲染进程 → 主进程）

```
┌──────────────┐     1. 调用 connect()      ┌──────────────┐
│ SftpTransfer │ ──────────────────────────▶ │   Preload    │
│   (Vue)      │                            │  (index.ts)  │
└──────────────┘                            └──────┬───────┘
                                                  │
                                    2. invoke('sftp:connect')
                                                  │
                                                  ▼
                                           ┌──────────────┐
                                           │   Main Process│
                                           │ (ipc/sftp.ts)│
                                           └──────┬───────┘
                                                  │
                                    3. handle('sftp:connect')
                                                  │
                                                  ▼
                                           ┌──────────────┐
                                           │  Connection   │
                                           │    Pool       │
                                           │(services/sftp)│
                                           └──────┬───────┘
                                                  │
                                     4. getConnection(id)
                                                  │
                                          ┌───────┴───────┐
                                          │               │
                                    存在？              不存在？
                                    ┌┴┐              ┌┴┐
                                    │ │              │ │
                                    ▼ ▼              ▼ ▼
                                返回实例         创建新实例
                                 (复用)          (新建)
                                                  │
                                                  ▼
                                           ┌──────────────┐
                                           │ SFTPService  │
                                           │  .connect()  │
                                           └──────┬───────┘
                                                  │
                                    5. SSH2 连接建立
                                                  │
                                    ┌─────────────┴────────────┐
                                    │                          │
                              TCP 连接                  SSH 握手
                              Socket 创建                认证
                                    │                          │
                                    └──────────┬───────────────┘
                                               ▼
                                        SFTP 子系统启动
                                               │
                                               ▼
                                        返回 sftpHandle
                                               │
                                               ▼
                                        resolve({success: true})
                                               │
                                               ▼
                                  6. 返回结果到渲染进程
```

### 响应流程（主进程 → 渲染进程）

```
┌──────────────┐
│ SFTPService  │
│  .connect()  │
└──────┬───────┘
       │
  resolve() 或 reject()
       │
       ▼
┌──────────────┐
│   IPC Handler│ ← 返回 { success: true/false }
│ (ipc/sftp.ts)│
└──────┬───────┘
       │
  IPC Response 序列化
       │
       ▼
┌──────────────┐
│   Preload    │ ← ipcRenderer.invoke() Promise resolved
│  (index.ts)  │
└──────┬───────┘
       │
  返回 Promise 结果
       │
       ▼
┌──────────────┐
│ SftpTransfer │ ← const result = await ...
│   (Vue)      │ ← 处理结果（成功/失败）
└──────────────┘
```

---

## 资源生命周期管理

### 创建阶段

```
用户点击 SFTP 按钮
  → createSftpTab() 生成唯一 ID
  → watch({ immediate: true }) 触发
  → window.api.sftp.connect(id, config)
  → sftpPool.getConnection(id)  创建新 SFTPService
  → SFTPService.connect()  建立 TCP/SSH/SFTP 连接
  → 返回 { success: true }
  → sftpConnected.value = true
  → 加载文件列表
```

### 使用阶段

```
用户浏览目录
  → window.api.sftp.listDir(id, path)
  → sftpPool.getConnection(id)  获取已有实例
  → SFTPService.listDir(path)  通过 sftpHandle 读取目录
  → 返回文件列表
  → UI 更新显示

用户上传文件
  → window.api.sftp.upload(id, localPath, remotePath)
  → sftpPool.getConnection(id)
  → SFTPService.uploadFile(localPath, remotePath, onProgress)
  → 通过 sftpHandle.fastPut() 上传
  → 实时报告进度
```

### 销毁阶段

```
用户关闭 SFTP 标签
  → handleCloseSftp(tab)
  → window.api.sftp.disconnect(tab.sftpConnectionId)
  → ipcMain.handle('sftp:disconnect')
  → sftpPool.removeConnection(id)
  → SFTPService.disconnect()
    → this.client.end()  关闭 TCP socket
    → this.connected = false
    → this.sftpHandle = null
  → connections.delete(id)  从 Map 中移除
  → terminalStore.closeTab(tab.id)  从 UI 移除
```

---

## 设计优势总结

| 特性 | 说明 |
|------|------|
| **分层架构** | UI → IPC → Pool → Service → SSH2，职责清晰 |
| **完全隔离** | 每个标签有独立的 TCP socket、SSH 会话、SFTP 句柄 |
| **无冲突** | 不同标签的操作不会相互干扰 |
| **并行能力** | 支持同时上传/下载不同文件 |
| **状态独立** | 每个标签维护自己的当前目录、选中文件等状态 |
| **自动清理** | 关闭标签时自动断开连接释放资源 |
| **单例连接池** | 全局统一管理所有连接，避免重复创建 |
| **安全通信** | 通过 Electron IPC 机制隔离渲染进程和主进程 |
| **错误处理** | 多层错误捕获，友好提示用户 |

---

## 性能考虑

### 连接开销

每次新建 SFTP 连接的资源消耗：

| 资源 | 消耗量 | 说明 |
|------|--------|------|
| TCP Socket | ~几 KB | 网络缓冲区 |
| SSH Session | ~几十 KB | 加密状态、密钥材料 |
| SFTP Handle | ~几 KB | 协议状态 |
| 内存总计 | ~100 KB | 每个连接 |

### 连接时间

典型连接耗时（局域网环境）：

| 阶段 | 耗时 | 说明 |
|------|------|------|
| TCP 连接 | 1-5 ms | 三次握手 |
| SSH 握手 | 10-50 ms | 密钥交换、加密协商 |
| 用户认证 | 5-20 ms | 密码验证 |
| SFTP 初始化 | 5-10 ms | 子系统启动 |
| **总计** | **20-85 ms** | 通常 < 100ms |

### 优化建议

1. **连接复用**：同一服务器的多个标签可以考虑复用 SSH 连接（多通道）
2. **懒加载**：只在需要时才建立连接（当前实现已是如此）
3. **连接池限制**：设置最大连接数防止资源耗尽
4. **心跳检测**：定期 ping 保持连接活跃
5. **自动重连**：断线后自动重连（可增强用户体验）

---

## 总结

`window.api.sftp.connect()` 的完整调用链路涉及 **5 个关键层级**：

1. **渲染进程层**：UI 触发，调用 `window.api.sftp.connect()`
2. **预加载脚本层**：IPC 桥接，转换为 `ipcRenderer.invoke()` 调用
3. **主进程 IPC 层**：消息处理，分发到连接池
4. **连接池管理层**：实例管理，创建或复用 `SFTPService`
5. **SSH2 服务层**：实际连接，建立 TCP/SSH/SFTP 网络通道

每一层都有明确的职责分工，共同实现了**安全、高效、隔离**的 SFTP 连接管理。特别是通过为每个标签页分配唯一的连接标识符（`sftpConnectionId`），彻底解决了多标签间的连接冲突问题，保证了系统的稳定性和可靠性。
