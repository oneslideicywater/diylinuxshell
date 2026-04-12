# SFTP 连接独立性修复分析

## 问题描述

**现象**：每次点击 SessionItem 的 SFTP 按钮时，创建的都是同一个 SFTP 连接，导致多个标签页相互干扰。

**错误日志**：
```
Connecting to: 192.168.10.24 with session: session-mnlqxezh-blxjzp8yl
Connecting to: 192.168.10.24 with session: session-mnlqxezh-blxjzp8yl
Connecting to: 192.168.10.24 with session: session-mnlqxezh-blxjzp8yl
Connect error: Instance unusable after fatal error
Connect error: Instance unusable after fatal error
Connect error: (SSH) Channel open failure: open failed
MaxListenersExceededWarning: Possible EventEmitter memory leak detected
```

## 根因分析

### 问题根源

所有 SFTP 标签页都使用相同的 `session.id` 作为连接标识符，导致 `sftpPool` 中只维护一个 SSH/SFTP 连接实例。当多个组件同时操作同一个连接时，产生以下问题：

1. **连接冲突**：多个标签同时调用 `connect()` 导致 "Channel open failure"
2. **状态污染**：一个标签的操作影响其他标签的状态（如当前目录、选中文件）
3. **事件监听泄漏**：重复添加事件监听器导致内存泄漏警告

### 旧代码逻辑

```typescript
// ❌ terminal.ts - createSftpTab()
function createSftpTab(title, session) {
  return {
    id: `sftp-${Date.now()}-${random}`,
    sessionId: session.id || session.host,  // 问题！每次相同
    status: 'connected',
    type: 'sftp',
    session
    // 缺少 sftpConnectionId 字段
  }
}

// ❌ SftpTransfer.vue - 使用 session.id 作为连接ID
const sessionId = props.session.id || props.session.host
await window.api.sftp.connect(sessionId, config)
```

**结果**：
- 第1次点击：`sessionId = "session-abc"` → 创建连接1
- 第2次点击：`sessionId = "session-abc"` → 复用连接1（冲突！）
- 第3次点击：`sessionId = "session-abc"` → 复用连接1（冲突！）

## 解决方案

### 核心思路

为每个 SFTP 标签页生成**唯一的连接标识符**，确保每个标签有完全独立的 SSH/SFTP 连接实例。

### 设计原则

**一个标签 = 一个连接 = 一个状态**

类似于浏览器标签页的设计模式：
- 打开新标签 → 新建新连接
- 关闭标签 → 断开连接、释放资源
- 切换标签 → 保持各自状态独立

## 实现细节

### 1. Tab 接口扩展

**文件**：`src/shared/types/index.ts`

```typescript
export interface Tab {
  // ... 原有字段
  
  /** SFTP 连接标识符（每个 SFTP 标签独立，避免连接冲突） */
  sftpConnectionId?: string  // 新增字段
}
```

**说明**：
- 可选字段（只有 SFTP 类型标签才有）
- 存储该标签专用的连接标识符
- 与 `id`（标签ID）和 `sessionId`（会话ID）分离

---

### 2. 创建标签时生成唯一连接ID

**文件**：`src/renderer/src/stores/terminal.ts`

```typescript
/**
 * 创建 SFTP 文件传输标签页
 * 每个标签页有独立的 SFTP 连接，避免多标签相互干扰
 */
function createSftpTab(title: string, session: any): Tab {
  const tabId = `sftp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  const tab: Tab = {
    id: tabId,
    title: `${title} - SFTP`,
    sessionId: session.id || session.host,
    status: 'disconnected',  // 初始未连接状态
    type: 'sftp',
    session,
    sftpConnectionId: tabId  // ✅ 关键！使用 tabId 作为连接标识符
  }
  
  tabs.value.push(tab)
  activeTabId.value = tab.id
  return tab
}
```

**关键改进**：

| 属性 | 值 | 用途 |
|-----|---|------|
| `id` | `sftp-1704...abc` | Vue 组件的 key、标签切换 |
| `sessionId` | `session-mnlq...` | 识别是哪个服务器的会话 |
| **`sftpConnectionId`** | **`sftp-1704...abc`** | **建立独立的 SSH/SFTP 连接** |

**唯一性保证**：
```typescript
const tabId = `sftp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// Date.now() → 时间戳（毫秒级）
// Math.random() → 随机数
// 组合后几乎不可能重复

// 示例输出：
// "sftp-1704012345678-a1b2c3d4e5f6"
// "sftp-1704012345890-g7h8i9j0k1l2"  ← 即使同一毫秒也不同
```

---

### 3. SftpTransfer 组件接收并使用独立连接ID

**文件**：`src/renderer/src/components/session/sftp/SftpTransfer.vue`

#### Props 定义

```typescript
interface Props {
  sftpWindowVisible: boolean
  session: Session | null
  embedded?: boolean
  /** SFTP 连接标识符（每个标签独立） */
  sftpConnectionId?: string  // 新增
}
```

#### 计算属性获取当前连接ID

```typescript
/**
 * 当前 SFTP 连接标识符
 * 优先使用 props.sftpConnectionId（每个标签独立），否则回退到 session.id
 */
const currentSftpConnectionId = computed(() => {
  return props.sftpConnectionId || (props.session?.id || props.session?.host || '')
})
```

#### 连接时使用独立ID

```typescript
// 监听 visible 变化，加载文件列表
watch(() => props.sftpWindowVisible, async (newVal) => {
  if (newVal) {
    if (sftpConnected.value) return  // 已连接则跳过
    
    if (!props.session) {
      console.error('Session is null')
      alert('会话信息无效')
      close()
      return
    }
    
    console.log('SFTP window opened, connecting to:', props.session.host, 
                'with connectionId:', currentSftpConnectionId.value)
    
    try {
      const connectionId = currentSftpConnectionId.value
      
      if (!window.api?.sftp) {
        console.error('SFTP API not available')
        alert('SFTP 功能不可用')
        close()
        return
      }
      
      // ✅✅✅ 使用独立连接ID建立连接
      const result = await window.api.sftp.connect(connectionId, {
        host: props.session.host,
        port: props.session.port || 22,
        username: props.session.username,
        password: props.session.password
      })
      
      if (!result.success) {
        console.error('SFTP 连接失败:', result.error)
        alert(`SFTP 连接失败：${result.error}`)
        close()
        return
      }
      
      console.log('SFTP connected successfully')
      sftpConnected.value = true
      
      // 连接成功后加载文件列表...
    } catch (error: any) {
      console.error('SFTP 连接失败:', error)
      alert(`SFTP 连接失败：${error.message}`)
      close()
      return
    }
  }
}, { immediate: true })  // 立即执行
```

#### 断开连接时使用独立ID

```typescript
async function close(): Promise<void> {
  /* 非嵌入式模式：断开后端 SFTP 连接 */
  if (!props.embedded) {
    const connectionId = currentSftpConnectionId.value
    if (connectionId && sftpConnected.value) {
      try {
        await window.api.sftp.disconnect(connectionId)
      } catch (e) {
        console.warn('[SFTP] disconnect error (non-critical):', e)
      }
    }
    sftpConnected.value = false
  }
  
  /* 嵌入式模式：只触发关闭事件 */
  emit('close')
}
```

#### 监听进度时过滤当前连接

```typescript
// 监听删除进度
if (props.session) {
  const connectionId = currentSftpConnectionId.value
  deleteProgressCleanup.value = window.api.sftp.onDeleteProgress((data) => {
    if (data.sessionId === connectionId) {  // 只监听当前标签
      deletingCurrentPath.value = data.currentPath
    }
  })
}
```

---

### 4. AppLayout 传递连接ID给组件

**文件**：`src/renderer/src/components/layout/AppLayout.vue`

```vue
<!-- SFTP 模式：显示 SFTP 文件传输标签页 -->
<template v-else>
  <template v-for="tab in sftpTabs" :key="tab.id">
    <SftpTransfer
      v-show="tab.id === activeTabId"
      :sftp-window-visible="true"
      :session="tab.session"
      :embedded="true"
      :sftp-connection-id="tab.sftpConnectionId"   <!-- 传递独立连接ID -->
      @close="handleCloseSftp(tab)"
    />
  </template>
</template>
```

---

### 5. 关闭标签时清理独立连接

**文件**：`src/renderer/src/components/layout/AppLayout.vue`

```typescript
/**
 * 关闭 SFTP 标签页
 * 断开独立的 SFTP 连接并移除标签
 */
const handleCloseSftp = async (tab: any) => {
  if (tab?.id) {
    // 断开该标签的独立 SFTP 连接
    if (tab.sftpConnectionId) {
      try {
        await window.api.sftp.disconnect(tab.sftpConnectionId)
        console.log(`[AppLayout] 断开 SFTP 连接: ${tab.sftpConnectionId}`)
      } catch (e: any) {
        console.warn(`[AppLayout] 断开 SFTP 连接失败（非关键错误）:`, e.message)
      }
    }
    
    // 关闭标签页
    terminalStore.closeTab(tab.id)
    console.log(`[AppLayout] 关闭 SFTP 标签页: ${tab.title}`)
  }
}
```

---

## 修改文件清单

| 文件 | 修改内容 | 关键行号 |
|------|---------|---------|
| `src/shared/types/index.ts` | Tab 接口添加 `sftpConnectionId` 字段 | L81-L82 |
| `src/renderer/src/stores/terminal.ts` | createSftpTab 生成唯一连接ID | L51-L64 |
| `src/renderer/src/components/session/sftp/SftpTransfer.vue` | Props 添加 sftpConnectionId | L146-L153 |
| `src/renderer/src/components/session/sftp/SftpTransfer.vue` | computed 获取当前连接ID | L207-L213 |
| `src/renderer/src/components/session/sftp/SftpTransfer.vue` | connect/disconnect 使用独立ID | L674, L240 |
| `src/renderer/src/components/layout/AppLayout.vue` | 传递 sftpConnectionId 给组件 | L116 |
| `src/renderer/src/components/layout/AppLayout.vue` | 关闭时断开独立连接 | L315-L330 |

## 修复前后对比

### ❌ 修复前：共享连接导致冲突

```
用户操作：点击 ServerA 的 SFTP 按钮 3 次

创建的标签：
┌─────────────────────────────────────────────┐
│ Tab1: {                                     │
│   id: "sftp-001",                          │
│   sessionId: "session-abc",                │  ← 相同！
│   sftpConnectionId: undefined              │  ← 未定义！
│ }                                            │
│                                              │
│ Tab2: {                                     │
│   id: "sftp-002",                          │
│   sessionId: "session-abc",                │  ← 相同！
│   sftpConnectionId: undefined              │  ← 未定义！
│ }                                            │
│                                              │
│ Tab3: {                                     │
│   id: "sftp-003",                          │
│   sessionId: "session-abc",                │  ← 相同！
│   sftpConnectionId: undefined              │  ← 未定义！
│ }                                            │
└─────────────────────────────────────────────┘

sftpPool 中的连接：
{
  "session-abc": { ssh2_connection }  ← 只有1个连接！
}

结果：
❌ 3个标签争抢1个连接
❌ 操作相互干扰
❌ Channel open failure 错误
❌ Instance unusable 错误
❌ 内存泄漏警告
```

### ✅ 修复后：每个标签独立连接

```
用户操作：点击 ServerA 的 SFTP 按钮 3 次

创建的标签：
┌─────────────────────────────────────────────┐
│ Tab1: {                                     │
│   id: "sftp-1704001000-a1b2c3",            │
│   sessionId: "session-abc",                │  ← 会话ID（识别服务器）
│   sftpConnectionId: "sftp-1704001000-a1b2c3"│ ← 独立连接ID ✅
│ }                                            │
│                                              │
│ Tab2: {                                     │
│   id: "sftp-1704002000-d4e5f6",            │
│   sessionId: "session-abc",                │  ← 会话ID（同一服务器）
│   sftpConnectionId: "sftp-1704002000-d4e5f6"│ ← 独立连接ID ✅
│ }                                            │
│                                              │
│ Tab3: {                                     │
│   id: "sftp-1704003000-g7h8i9",            │
│   sessionId: "session-abc",                │  ← 会话ID（同一服务器）
│   sftpConnectionId: "sftp-1704003000-g7h8i9"│ ← 独立连接ID ✅
│ }                                            │
└─────────────────────────────────────────────┘

sftpPool 中的连接：
{
  "sftp-1704001000-a1b2c3": { ssh2_connection_1 },  ← 独立连接1 ✅
  "sftp-1704002000-d4e5f6": { ssh2_connection_2 },  ← 独立连接2 ✅
  "sftp-1704003000-g7h8i9": { ssh2_connection_3 },  ← 独立连接3 ✅
}

结果：
✅ 每个标签有独立的 SSH/SFTP 连接
✅ 操作互不干扰
✅ 可以同时浏览不同目录
✅ 可以并行上传/下载不同文件
✅ 无错误无内存泄漏
```

## 技术架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     用户界面层                                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                    │
│  │ SFTP Tab1│  │ SFTP Tab2│  │ SFTP Tab3│                   │
│  │ (id:001) │  │ (id:002) │  │ (id:003) │                   │
│  └────┬────┘  └────┬────┘  └────┬────┘                    │
└───────┼──────────┼──────────┼──────────────────────────────┘
        │          │          │
        ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────┐
│                   SftfTransfer 组件                         │
│                                                             │
│  Tab1: currentSftpConnectionId = "sftp-001"               │
│  Tab2: currentSftpConnectionId = "sftp-002"               │
│  Tab3: currentSftpConnectionId = "sftp-003"               │
│                                                             │
│  connect("sftp-001", config)  →  建立 SSH 连接 1           │
│  connect("sftp-002", config)  →  建立 SSH 连接 2           │
│  connect("sftp-003", config)  →  建立 SSH 连接 3           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Electron IPC (主进程)                        │
│                                                             │
│  sftpPool: Map<string, SftpService>                        │
│  ┌─────────────────────────────────────────────────┐       │
│  │ "sftp-001" → SftpService { ssh2_client_1 }     │       │
│  │ "sftp-002" → SftpService { ssh2_client_2 }     │       │
│  │ "sftp-003" → SftpService { ssh2_client_3 }     │       │
│  └─────────────────────────────────────────────────┘       │
│                                                             │
│  每个连接：                                                  │
│  - 独立的 TCP socket                                        │
│  - 独立的 SSH 通道                                          │
│  - 独立的 SFTP 子系统                                       │
│  - 独立的事件监听器                                         │
└─────────────────────────────────────────────────────────────┘
```

## 实际使用场景

### 场景 1：同一服务器多个 SFTP 标签

```
用户需求：同时在两个目录工作

操作步骤：
1. 点击 ServerA 的 SFTP 按钮 → Tab1 (浏览 /var/www/html)
2. 再次点击 ServerA 的 SFTP 按钮 → Tab2 (浏览 /home/user/logs)
3. 在 Tab1 上传文件到 /var/www/html
4. 同时在 Tab2 下载文件从 /home/user/logs

✅ 修复后：
- Tab1 和 Tab2 有独立的 SSH 连接
- 上传和下载可以并行执行
- 不会出现 "Channel open failure" 错误
- 各自维护独立的文件列表状态
```

### 场景 2：多服务器管理

```
标签栏：
[+] [SSH-ServerA] [📂ServerA-SFTP1] [📂ServerA-SFTP2] [📂ServerB-SFTP]

连接池状态：
- SSH-ServerA: 1 个终端连接
- ServerA-SFTP1: 1 个独立 SFTP 连接
- ServerA-SFTP2: 1 个独立 SFTP 连接（与 SFTP1 完全独立）
- ServerB-SFTP: 1 个独立 SFTP 连接

优势：
✅ 总共 4 个连接，各自独立
✅ 可以同时操作不互相阻塞
✅ 关闭某个标签只释放对应的连接
```

## 资源管理注意事项

### 内存占用

每个 SFTP 标签会消耗：
- 1 个 TCP 连接 (~几 KB)
- 1 个 SSH 会话 (~几十 KB)
- 1 个 SFTP 子系统 (~几 KB)
- 相关事件监听器

**建议**：不要同时打开过多 SFTP 标签（建议 < 10 个）

### 自动清理机制

关闭 SFTP 标签时会自动执行：
1. 调用 `disconnect(sftpConnectionId)` 断开连接
2. 从 sftpPool 中移除连接实例
3. 释放相关资源（TCP socket、SSH 通道等）

**无需手动管理**！

## 测试验证步骤

1. **启动应用**
2. **找到已配置的服务器**（如 192.168.10.24）
3. **多次点击 SFTP 按钮**（3-5 次）
4. **观察预期行为**：
   - ✅ 每次点击都创建新的 SFTP 标签
   - ✅ 控制台显示不同的 connectionId：
     ```
     Connecting to: 192.168.10.24 with connectionId: sftp-1704001000-xxx
     Connecting to: 192.168.10.24 with connectionId: sftp-1704002000-yyy  ← 不同！
     Connecting to: 192.168.10.24 with connectionId: sftp-1704003000-zzz  ← 不同！
     ```
   - ✅ 不再出现错误信息
   - ✅ 每个标签可以独立浏览不同目录
   - ✅ 切换标签不会影响其他标签的状态
5. **测试关闭功能**：
   - 关闭某个 SFTP 标签
   - ✅ 其他标签正常工作不受影响
   - ✅ 控制台显示：`断开 SFTP 连接: sftp-xxx`

## 设计优势总结

| 特性 | 说明 |
|------|------|
| **完全隔离** | 每个标签有独立的 TCP socket、SSH 会话、SFTP 句柄 |
| **无冲突** | 不同标签的操作不会相互干扰 |
| **并行能力** | 支持同时上传/下载不同文件 |
| **状态独立** | 每个标签维护自己的当前目录、选中文件等状态 |
| **自动清理** | 关闭标签时自动断开连接释放资源 |
| **单例连接池** | 全局统一管理所有连接，避免重复创建 |

## 总结

通过为每个 SFTP 标签页生成唯一的连接标识符（`sftpConnectionId`），实现了多标签间的完全隔离。核心改动包括：

1. **数据模型扩展**：Tab 接口新增 `sftpConnectionId` 字段
2. **唯一 ID 生成**：`createSftpTab()` 使用时间戳+随机数生成唯一标识
3. **组件适配**：SftpTransfer 组件通过 props 接收并使用独立连接ID
4. **资源管理**：关闭标签时自动断开对应连接，防止资源泄漏

此方案遵循了 **"一个标签 = 一个连接 = 一个状态"** 的设计原则，彻底解决了多标签共享连接导致的冲突和干扰问题。
