# SFTP 连接调用链路分析（安全架构 v4）

## 概述

本文档详细描述 **安全架构 v4** 下的 SFTP 连接与文件传输完整流程。核心设计原则：

- ✅ **渲染进程不持有 session 对象**（避免暴露密码等敏感信息）
- ✅ **SFTP 连接在 TerminalTab 初始化时建立**（提前准备好连接标识符）
- ✅ **上传/下载函数直接使用 sftpConnectionId**（无 session 依赖）
- ✅ **通过 SessionStore 获取非敏感信息**（按需查询，最小权限原则）

---

## 架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        渲染进程 (Renderer)                          │
│                                                                     │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────┐ │
│  │   TerminalTab    │───▶│  SftpTransfer    │───▶│ upload.ts /  │ │
│  │                  │    │                  │    │ download.ts  │ │
│  │ • 创建标签时      │    │ • 接收 props:     │    │              │ │
│  │   初始化          │    │   sessionId       │    │ 参数：        │ │
│  │   sftpConnectionId│    │   sftpConnectionId│    │ • filePath   │ │
│  │                  │    │                  │    │ • connectionId│ │
│  └────────┬─────────┘    └────────┬─────────┘    │ • sessionId  │ │
│           │                      │               └──────┬───────┘ │
│           ▼                      ▼                      │         │
│  ┌─────────────────────────────────────────────────────┐        │
│  │              SessionStore (Pinia)                    │        │
│  │  • 根据 sessionId 获取会话名称、主机地址（非敏感）     │◀───────┘
│  └─────────────────────────────────────────────────────┘
└────────────────────────────┬────────────────────────────────────────┘
                             │ window.api.sftp.xxx(sftpConnectionId, ...)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     主进程 (Main Process)                           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   SFTP Connection Pool                       │   │
│  │                                                              │   │
│  │  Map<sftpConnectionId, SFTPService>                          │   │
│  │  "sftp-1704000..." → SFTPService { client, sftpHandle }     │   │
│  │  "sftp-1704001..." → SFTPService { client, sftpHandle }     │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 第一阶段：SFTP 连接初始化

### 触发点：TerminalTab 创建标签

**文件位置**：`src/renderer/src/components/terminal/TerminalTab.vue`

**行号**：第 20-31 行

```typescript
/**
 * 组件挂载时，如果是 SFTP 标签页：
 * 1. 生成唯一的 sftpConnectionId（每个标签独立）
 * 2. 通过 SessionStore 获取会话配置（含密码）
 * 3. 向主进程发起 IPC 调用建立 SFTP 连接
 */
onMounted(async () => {
  if (props.tab.type === 'sftp') {
    // ✅ 步骤1：生成唯一连接标识符
    const connectionId = `sftp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // ✅ 步骤2：从 SessionStore 获取完整会话配置（包含密码）
    const session = sessionStore.getSession(props.tab.sessionId)
    
    if (session) {
      // ✅ 步骤3：向主进程请求建立 SFTP 连接（此时传递完整配置）
      await window.api.sftp.connect(connectionId, {
        host: session.host,
        port: session.port || 22,
        username: session.username,
        password: session.password  // ⚠️ 仅在此处传递，之后不再需要
      })
      
      // ✅ 步骤4：保存连接标识符到 tab 对象（后续操作只需此 ID）
      props.tab.sftpConnectionId = connectionId
    }
  }
})
```

### 关键设计点

| 设计决策 | 说明 |
|---------|------|
| **连接时机提前** | 在 TerminalTab 初始化时就建好连接，而非在 SftpTransfer 中 |
| **标识符唯一性** | 使用时间戳 + 随机字符串确保每个标签独立 |
| **一次性传参** | 密码仅在连接建立时传递一次，后续不缓存 |

---

## 第二阶段：SftpTransfer 接收参数

### Props 定义（无 session 对象）

**文件位置**：`src/renderer/src/components/session/sftp/SftpTransfer.vue`

**行号**：第 145-165 行

```typescript
/**
 * 安全架构 v4 的 Props 设计
 * 
 * 核心原则：
 * - ❌ 不再接收 session 对象（避免暴露密码）
 * - ✅ 只接收标识符和状态标志
 * - ✅ 按需从 SessionStore 获取非敏感信息
 */
interface Props {
  /** SFTP 窗口是否可见 */
  sftpWindowVisible: boolean
  
  /** 会话 ID（用于从 SessionStore 获取会话信息） */
  sessionId: string
  
  /** 是否为嵌入式模式 */
  embedded?: boolean
  
  /**
   * SFTP 连接标识符（每个标签独立）
   * 对应主进程 sftpPool 的 key
   * 所有 SFTP API 调用都使用此 ID
   */
  sftpConnectionId?: string
}

const props = withDefaults(defineProps<Props>(), {
  sftpWindowVisible: false,
  sessionId: '',
  embedded: false,
  sftpConnectionId: ''
})
```

### 动态获取会话信息（非敏感）

**行号**：第 175-185 行

```typescript
/**
 * Session Store 实例
 * 用于根据 sessionId 获取会话的**非敏感部分**
 * （如名称、主机地址、端口等，不含密码）
 */
const sessionStore = useSessionStore()

/**
 * 计算属性：当前会话对象（从 Store 动态获取）
 * 仅用于 UI 显示（如标题栏显示主机地址）
 */
const currentSession = computed(() => {
  return sessionStore.getSession(props.sessionId)
})
```

### 为什么这样设计？

```
❌ 旧架构（v3）的问题：
   SftpTransfer 接收完整的 session 对象
   → 包含 password 字段 → 存储在组件实例中
   → 可被 Vue DevTools 查看 → 安全风险

✅ 新架构（v4）的优势：
   SftpTransfer 只接收 sessionId + sftpConnectionId
   → 密码始终留在 SessionStore（主进程侧）
   → 渲染进程仅持有 ID → 无法逆向获取密码
```

---

## 第三阶段：上传/下载函数调用

### 上传文件示例

**文件位置**：`src/renderer/src/components/session/sftp/SftpTransfer.vue`

**行号**：第 320-332 行

```typescript
/**
 * 处理上传文件
 * 
 * 安全架构 v4：不再传递 session 对象！
 */
async function handleUpload(): Promise<void> {
  console.log('[SftpTransfer] 处理文件上传')
  
  // 打开文件选择对话框
  const filePath = await window.api.dialog.showOpenDialog({
    title: '选择要上传的文件',
    properties: ['openFile', 'multiSelections']
  })
  
  if (!filePath) {
    console.log('[SftpTransfer] 用户取消文件选择')
    return
  }
  
  try {
    // ✅ 调用单文件上传函数（使用 sftpConnectionId，无需 session）
    await uploadSingleFileLocal(
      currentFilePath,                    // 本地文件路径
      props.sftpConnectionId,             // SFTP 连接标识符（必填）
      props.sessionId,                    // 会话 ID（可选，用于 UI 显示）
      remoteState.remotePath.value        // 远程目标路径
    )
    
    console.log('[SftpTransfer] 文件上传完成')
    
    // 刷新远程文件列表
    await remotePanelRef.value?.loadFiles()
    
  } catch (error: any) {
    console.error('[SftpTransfer] 文件上传失败:', error)
    alert(`上传文件失败：${error.message}`)
  }
}
```

### 下载文件示例

**行号**：第 386-406 行

```typescript
// 判断是否为文件夹
if (selectedItem && (selectedItem.type === 'd' || selectedItem.isDirectory)) {
  // ✅ 文件夹下载（安全架构 v4）
  console.log('[SftpTransfer] 检测到文件夹，使用文件夹下载模式')
  await downloadFolder(
    path,                        // 远程路径
    props.sftpConnectionId,      // SFTP 连接标识符
    props.sessionId,             // 会话 ID（可选）
    localPath                    // 本地目标路径
  )
} else {
  // ✅ 单文件下载（安全架构 v4）
  console.log('[SftpTransfer] 检测到文件，使用单文件下载模式')
  await downloadFile(
    path,
    props.sftpConnectionId,
    props.sessionId,
    localPath
  )
}
```

---

## 第四阶段：upload.ts 内部实现

### 函数签名（安全架构 v4）

**文件位置**：`src/renderer/src/components/session/sftp/script/upload.ts`

**行号**：第 365-390 行

```typescript
/**
 * 上传单个文件（导出函数，安全架构 v4）
 * 
 * 设计原则：
 * - 不再接收 session 对象（避免在渲染进程传递敏感信息）
 * - 直接使用 sftpConnectionId（SFTP 连接已在 TerminalTab 初始化时建立）
 * - 可选接收 sessionId（用于通过 SessionStore 获取会话名称等非敏感信息显示）
 * 
 * @param filePath - 本地文件路径
 * @param sftpConnectionId - SFTP 连接标识符（必填，对应已建立的连接）
 * @param sessionId - 会话 ID（可选，用于 UI 显示会话信息）
 * @param remotePath - 远程目标路径（可以是字符串或 Ref<string>）
 */
export async function uploadFile(
  filePath: string,
  sftpConnectionId: string,    // ✅ 必填：连接标识符
  sessionId?: string,          // ✅ 可选：仅用于 UI 显示
  remotePath?: string | { value: string }
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  console.log('[upload] 开始上传文件:', filePath, '连接ID:', sftpConnectionId)
  
  // ✅ 参数校验
  if (!sftpConnectionId) {
    throw new Error('SFTP 连接标识符不能为空（连接未建立）')
  }
  
  if (!filePath) {
    throw new Error('文件路径不能为空')
  }
  
  try {
    // ... 创建 TransferTask（使用 sftpConnectionId）
    const task: TransferTask = {
      id: `task-${Date.now()}`,
      type: 'upload',
      status: 'pending',
      root: fileNode,
      sftpConnectionId: sftpConnectionId,  // ✅ 直接使用传入的连接标识符
      sessionId: sessionId,                // ✅ 可选：用于显示会话信息
      totalBytes: 0,
      transferredBytes: 0,
      // ...
    }
    
    // ... 调用底层上传函数（同样传递 sftpConnectionId）
    await uploadSingleFile(fileNode, sftpConnectionId, task.id)
    
  } catch (error: any) {
    console.error('[upload] 文件上传失败:', error)
    throw error
  }
}
```

### 底层实现：uploadSingleFile

**行号**：第 155-180 行

```typescript
/**
 * 上传单个文件的内部实现
 * 
 * @param node - 文件传输节点
 * @param sftpConnectionId - SFTP 连接标识符（已在 TerminalTab 初始化时建立）
 * @param taskId - 任务 ID（用于 Store 更新）
 */
async function uploadSingleFile(
  node: TransferNode, 
  sftpConnectionId: string,  // ✅ 不再接收 session
  taskId: string
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  // ✅ 校验连接标识符
  if (!sftpConnectionId) {
    throw new Error('SFTP 连接标识符不能为空（连接未建立）')
  }
  
  // ... 进度监听、状态更新 ...
  
  try {
    // ✅ 执行实际上传（使用 sftpConnectionId 调用 Electron API）
    const result = await window.api.sftp.upload(
      sftpConnectionId,           // 连接标识符
      node.localPath,            // 本地文件路径
      node.remotePath            // 远程目标路径
    )
    
    if (!result.success) {
      throw new Error(result.error || '上传失败')
    }
    
    // ... 更新任务状态为 completed ...
    
  } catch (error: any) {
    // ... 错误处理 ...
  }
}
```

---

## 第五阶段：download.ts 内部实现

### 函数签名（对称设计）

**文件位置**：`src/renderer/src/components/session/sftp/script/download.ts`

**行号**：第 379-405 行

```typescript
/**
 * 下载单个文件（导出函数，安全架构 v4）
 * 
 * 与 uploadFile 保持一致的设计原则：
 * - 不再接收 session 对象
 * - 直接使用 sftpConnectionId
 * - 可选接收 sessionId 用于 UI 显示
 */
export async function downloadFile(
  remotePath: string,
  sftpConnectionId: string,    // ✅ 必填
  sessionId?: string,          // ✅ 可选
  localPath?: string | { value: string }
): Promise<void> {
  const sftpTransferStore = useSftpTransferStore()
  
  console.log('[download] 开始下载文件:', remotePath, '连接ID:', sftpConnectionId)
  
  // ✅ 参数校验
  if (!sftpConnectionId) {
    throw new Error('SFTP 连接标识符不能为空（连接未建立）')
  }
  
  // ... 创建 TransferTask（同 upload.ts 模式）
  const task: TransferTask = {
    id: `task-${Date.now()}`,
    type: 'download',
    status: 'pending',
    root: fileNode,
    sftpConnectionId: sftpConnectionId,  // ✅ 直接使用
    sessionId: sessionId,                // ✅ 可选
    // ...
  }
  
  // ... 调用 downloadSingleFile（传递 sftpConnectionId）
  await downloadSingleFile(fileNode, sftpConnectionId, task.id)
}
```

---

## 第六阶段：IPC 通信层

### Preload 脚本定义

**文件位置**：`src/preload/index.ts`

**行号**：第 180-195 行

```typescript
/**
 * SFTP API 定义（安全架构 v4）
 * 
 * 所有方法统一使用 sftpConnectionId 作为第一个参数
 * 不再需要传递 session 配置对象
 */
sftp: {
  /**
   * 建立 SFTP 连接（仅在 TerminalTab 初始化时调用一次）
   * @param connectionId - 唯一连接标识符
   * @param config - SSH 配置（含密码，仅此处使用）
   */
  connect: (connectionId: string, config: SFTPConfig) =>
    ipcRenderer.invoke('sftp:connect', connectionId, config),
  
  /**
   * 列出远程目录（使用已建立的连接）
   * @param connectionId - 连接标识符
   * @param remotePath - 远程路径
   */
  listDir: (connectionId: string, remotePath: string) =>
    ipcRenderer.invoke('sftp:listDir', connectionId, remotePath),
  
  /**
   * 上传文件（使用已建立的连接）
   * @param connectionId - 连接标识符
   * @param localPath - 本地路径
   * @param remotePath - 远程路径
   */
  upload: (connectionId: string, localPath: string, remotePath: string) =>
    ipcRenderer.invoke('sftp:upload', connectionId, localPath, remotePath),
  
  /**
   * 下载文件（使用已建立的连接）
   * @param connectionId - 连接标识符
   * @param remotePath - 远程路径
   * @param localPath - 本地路径
   */
  download: (connectionId: string, remotePath: string, localPath: string) =>
    ipcRenderer.invoke('sftp:download', connectionId, remotePath, localPath),
  
  /**
   * 断开连接
   * @param connectionId - 连接标识符
   */
  disconnect: (connectionId: string) =>
    ipcRenderer.invoke('sftp:disconnect', connectionId),
}
```

### 主进程 IPC 处理器

**文件位置**：`src/main/ipc/sftp.ts`

**行号**：第 14-30 行

```typescript
/**
 * 注册 SFTP 相关的 IPC 处理器
 * 
 * 安全架构 v4：
 * - connect 时创建连接并存储到连接池
 * - 后续所有操作（listDir/upload/download）通过 connectionId 查找连接
 * - 密码仅在 connect 时使用一次，之后丢弃
 */
export function registerSFTPIpcHandlers(): void {
  ipcMain.handle('sftp:connect', async (_event, connectionId, config) => {
    // 从连接池获取或创建服务实例
    const service = sftpPool.getConnection(connectionId)
    
    // 建立实际 SSH 连接（使用 config 中的密码）
    await service.connect(config)
    
    return { success: true }
  })
  
  ipcMain.handle('sftp:listDir', async (_event, connectionId, remotePath) => {
    // ✅ 通过 connectionId 从连接池查找已建立的连接
    const service = sftpPool.getConnection(connectionId)
    
    if (!service.connected) {
      return { success: false, error: 'SFTP not connected' }
    }
    
    // 执行目录列表操作（无需再次认证）
    const result = await service.listDirectory(remotePath)
    return result
  })
  
  // upload/download/disconnect 同理...
}
```

---

## 第七阶段：连接池管理

### SFTPService 类

**文件位置**：`src/main/services/sftp.ts`

**行号**：第 43-90 行

```typescript
class SFTPService {
  private client: Client
  private sftpHandle: SFTP | null = null
  public connected: boolean = false
  
  /**
   * 建立 SSH+SFTP 连接
   * 此方法仅在 TerminalTab 初始化时调用一次
   * 之后的所有操作复用已建立的连接
   */
  async connect(config: {
    host: string
    port: number
    username: string
    password: string
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client
        .on('ready', () => {
          this.connected = true
          
          // 初始化 SFTP 子系统
          this.client.sftp((err, sftp) => {
            if (err) reject(err)
            
            this.sftpHandle = sftp
            console.log(`[SFTP] 连接建立成功`)
            resolve()
          })
        })
        .on('error', (err) => {
          this.connected = false
          reject(err)
        })
        
        // 发起 SSH 握手（使用密码认证）
        .connect({
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password
        })
    })
  }
  
  /**
   * 列出远程目录内容
   * 依赖已建立的 sftpHandle，无需重新认证
   */
  async listDirectory(remotePath: string): Promise<ListResult> {
    if (!this.sftpHandle || !this.connected) {
      throw new Error('SFTP not connected')
    }
    
    return new Promise((resolve, reject) => {
      this.sftpHandle.readdir(remotePath, (err, list) => {
        if (err) reject(err)
        
        // 格式化返回结果
        const entries = list.map(item => ({
          name: item.filename,
          type: item.longname.startsWith('d') ? 'd' : '-',
          size: item.attrs.size,
          // ...
        }))
        
        resolve({ success: true, data: entries })
      })
    })
  }
  
  // upload/download 方法同理...
}
```

### ConnectionPool 管理

**行号**：第 699-720 行

```typescript
class SFTPConnectionPool {
  private connections: Map<string, SFTPService> = new Map()
  
  /**
   * 获取或创建 SFTP 服务实例
   * @param connectionId - 唯一连接标识符（来自 TerminalTab）
   */
  getConnection(connectionId: string): SFTPService {
    let service = this.connections.get(connectionId)
    
    if (!service) {
      // 不存在则创建新实例（但尚未连接）
      service = new SFTPService()
      this.connections.set(connectionId, service)
      
      console.log(`[SFTP Pool] 创建新连接实例: ${connectionId}`)
    }
    
    return service
  }
  
  /**
   * 断开并移除连接
   */
  disconnect(connectionId: string): void {
    const service = this.connections.get(connectionId)
    
    if (service) {
      service.disconnect()
      this.connections.delete(connectionId)
      
      console.log(`[SFTP Pool] 移除连接: ${connectionId}`)
    }
  }
  
  /**
   * 获取当前连接数（用于调试）
   */
  getConnectionCount(): number {
    return this.connections.size
  }
}
```

---

## 数据流对比：v3 vs v4

### v3 架构（旧）

```
用户点击"上传"
    ↓
SftpTransfer.handleUpload()
    ↓
uploadFile(filePath, session, remotePath)  ← ❌ 传入完整 session（含密码）
    ↓
window.api.sftp.upload(session.id, ...)     ← ❌ 使用 session.id 作为连接标识
    ↓
主进程查找连接池：pool[session.id]
    ↓
执行上传操作
```

**问题**：
- session 对象在整个调用链中传递
- 密码存储在多个组件实例中
- session.id 可能重复（同一会话打开多个 SFTP 标签）

---

### v4 架构（新）

```
用户点击"上传"
    ↓
SftpTransfer.handleUpload()
    ↓
uploadFile(
  filePath,
  props.sftpConnectionId,    ← ✅ 使用唯一连接标识符
  props.sessionId,           ← ✅ 仅用于 UI 显示
  remotePath
)                            ← ❌ 不传递 session 对象
    ↓
window.api.sftp.upload(sftpConnectionId, ...)
    ↓
主进程查找连接池：pool[sftpConnectionId]
    ↓
执行上传操作（复用已建立的连接）
```

**优势**：
- 无 session 依赖，函数签名更清晰
- 密码仅在 TerminalTab 初始化时使用一次
- sftpConnectionId 确保每个标签独立
- 符合最小权限原则和安全最佳实践

---

## 完整调用链路图（v4）

```
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 1: TerminalTab 初始化                                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ TerminalTab.vue (onMounted)                                 │    │
│  │                                                             │    │
│  │ 1. 生成 sftpConnectionId = `sftp-${timestamp}-${random}`    │    │
│  │ 2. 从 SessionStore 获取 session（含密码）                    │    │
│  │ 3. 调用 window.api.sftp.connect(sftpConnectionId, config)   │    │
│  │ 4. 保存 sftpConnectionId 到 tab 对象                         │    │
│  └─────────────────────────┬───────────────────────────────────┘    │
└────────────────────────────┼────────────────────────────────────────┘
                             │ IPC: sftp:connect
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 2: 主进程建立连接                                            │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ ipc/sftp.ts                                                │    │
│  │                                                             │    │
│  │ 1. 从 sftpPool 获取/创建 SFTPService                        │    │
│  │ 2. 调用 service.connect(config)                             │    │
│  │ 3. 建立 SSH 握手 + SFTP 子系统初始化                         │    │
│  │ 4. 返回 { success: true }                                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                             
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 3-N: 用户触发上传/下载                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ SftpTransfer.vue                                            │    │
│  │                                                             │    │
│  │ handleUpload():                                             │    │
│  │   uploadFile(                                               │    │
│  │     filePath,                                              │    │
│  │     props.sftpConnectionId,  ← ✅ 使用已建立的连接标识符     │    │
│  │     props.sessionId,          ← ✅ 可选，仅用于 UI 显示      │    │
│  │     remotePath                                             │    │
│  │   )                                                         │    │
│  └─────────────────────────┬───────────────────────────────────┘    │
└────────────────────────────┼────────────────────────────────────────┘
                             │ IPC: sftp:upload (带 sftpConnectionId)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Phase N+1: 主进程执行操作                                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ services/sftp.ts                                           │    │
│  │                                                             │    │
│  │ 1. pool.getConnection(sftpConnectionId)  ← 查找已建立连接    │    │
│  │ 2. service.upload(localPath, remotePath)  ← 复用连接         │    │
│  │ 3. 返回结果                                                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 关键设计原则总结

### 1. 最小权限原则

```
✅ 渲染进程需要的：
   - sftpConnectionId（连接标识符）
   - sessionId（会话引用，可选）
   
❌ 渲染进程不需要的：
   - session.password（密码）
   - session.privateKey（私钥）
   - 其他敏感凭据
```

### 2. 单一职责原则

```
TerminalTab.vue:
  - 负责建立 SFTP 连接（生命周期管理）
  - 生成和管理 sftpConnectionId
  
SftpTransfer.vue:
  - 负责展示 UI 和响应用户操作
  - 调用 upload/download 函数（不关心连接细节）
  
upload.ts / download.ts:
  - 负责具体的文件传输逻辑
  - 接收 sftpConnectionId，调用底层 API
```

### 3. 关注点分离

```
连接管理层（TerminalTab + 主进程 sftpPool）：
  - 何时建立连接？
  - 如何维护连接？
  - 何时断开连接？

业务逻辑层（upload.ts / download.ts）：
  - 如何扫描文件树？
  - 如何计算进度？
  - 如何更新状态？

UI 展示层（SftpTransfer.vue）：
  - 如何展示文件列表？
  - 如何响应按钮点击？
  - 如何显示进度条？
```

---

## 类型定义参考

### TransferTask（核心接口）

**文件位置**：`src/shared/types/sftp.ts`

```typescript
export interface TransferTask {
  /** 任务 ID */
  id: string
  /** 任务类型：upload / download / delete */
  type: TransferType
  /** 任务状态：pending / transferring / completed / error */
  status: TransferStatus
  /** 传输根节点（树形结构） */
  root: TransferNode
  
  /**
   * ✅ SFTP 连接标识符（每个标签独立）
   * 对应 Tab.sftpConnectionId 和主进程 sftpPool 的 key
   * 用于将任务归属到正确的 SFTP 连接
   */
  sftpConnectionId: string
  
  /**
   * ✅ 会话 ID（可选）
   * 可通过 SessionStore 获取会话名称、主机地址等非敏感信息
   * 主要用于 UI 显示和日志记录
   */
  sessionId?: string
  
  // 传输统计字段...
  totalBytes: number
  transferredBytes: number
  remainingTime: number
  elapsedTime: number
  createdAt: number
  completedAt?: number
}
```

---

## 测试验证要点

### 功能测试

1. **连接独立性测试**
   - 打开同一会话的两个 SFTP 标签
   - 验证两个标签有不同的 sftpConnectionId
   - 在一个标签上传文件，不影响另一个标签

2. **安全性测试**
   - 使用 Vue DevTools 检查 SftpTransfer 组件实例
   - 确认不存在 session.password 字段
   - 确认只有 sftpConnectionId 和 sessionId

3. **功能完整性测试**
   - 上传单个文件
   - 上传文件夹（递归）
   - 下载单个文件
   - 下载文件夹（递归）
   - 删除本地文件

### 性能测试

1. **连接复用效率**
   - 多次上传/下载是否复用同一连接（不应重新握手）
   - 连接池大小是否合理（不应无限增长）

2. **内存泄漏检测**
   - 关闭 SFTP 标签后，连接是否正确释放
   - TransferTask 是否及时清理

---

## 常见问题排查

### Q1: 报错 "SFTP 连接标识符不能为空"

**原因**：TerminalTab 未成功初始化 SFTP 连接

**排查步骤**：
1. 检查 TerminalTab.vue 的 onMounted 是否执行
2. 检查 SessionStore 是否有该 sessionId 的会话数据
3. 查看主进程日志确认 sftp:connect 是否成功

### Q2: 上传/下载后报错 "SFTP not connected"

**原因**：连接已断开或未正确建立

**排查步骤**：
1. 检查 sftpConnectionId 是否正确传递
2. 在主进程检查 sftpPool 是否存在该连接
3. 检查网络连接和服务器状态

### Q3: 多个标签共享同一个连接

**原因**：sftpConnectionId 生成逻辑错误（可能使用了相同值）

**解决方案**：
确保 TerminalTab.vue 中使用时间戳 + 随机字符串生成唯一 ID：
```typescript
const connectionId = `sftp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
```

---

## 版本历史

| 版本 | 日期 | 主要变更 |
|------|------|---------|
| v1 | 2025-01-XX | 初始版本，基于 session.id 管理连接 |
| v2 | 2025-02-XX | 引入 sftpConnectionId 支持多标签独立连接 |
| v3 | 2025-03-XX | 移除 Tab.session 字段，改用 SessionStore |
| **v4** | **2026-04-13** | **移除 session 依赖，全面使用 sftpConnectionId** |

---

## 相关文档

- [SFTP 连接独立性改造方案](./sftp-independence-fix.md)
- [TransferTask 接口定义](../../../shared/types/sftp.ts)
- [SessionStore 实现](../../stores/session.md)
- [Electron IPC 安全实践](../security/electron-ipc-security.md)
