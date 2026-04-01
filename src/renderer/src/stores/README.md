# Pinia 状态管理

本目录包含应用的状态管理模块，使用 **Pinia** 框架实现。

## 框架介绍

### Pinia 是什么？

Pinia 是 Vue 3 的官方推荐状态管理库，是 Vuex 的继任者。

```typescript
import { defineStore } from 'pinia'
```

`defineStore` 是 Pinia 的核心 API，用于定义一个 Store：

- **第一个参数**：Store 的唯一 ID（字符串）
- **第二个参数**：Store 的定义（Setup 函数或 Options 对象）

### Pinia vs Vuex

| 特性 | Pinia | Vuex |
|------|-------|------|
| TypeScript 支持 | ✅ 完美支持 | ⚠️ 需要额外配置 |
| 模块化 | ✅ 天然模块化 | ⚠️ 需要 modules |
| Mutations | ❌ 不需要 | ✅ 必须通过 mutations |
| Composition API | ✅ 原生支持 | ⚠️ 需要额外 API |
| 代码提示 | ✅ 完整提示 | ⚠️ 部分提示 |
| 包体积 | 📦 ~1KB | 📦 ~3KB |

### Setup Store 写法

本项目使用 Setup Store 写法（推荐）：

```typescript
export const useSessionStore = defineStore('session', () => {
  // 状态（ref）
  const sessions = ref<Session[]>([])
  
  // 计算属性（computed）
  const activeSession = computed(() => {
    return sessions.value.find(s => s.id === activeSessionId.value)
  })
  
  // 方法（function）
  function addSession(session: Session): void {
    sessions.value.push(session)
  }
  
  // 返回需要暴露的内容
  return {
    sessions,
    activeSession,
    addSession
  }
})
```

---

## Store 模块说明

### session.ts - 会话状态管理

管理 SSH 会话的生命周期，包括会话的创建、更新、删除和状态管理。

**状态：**

| 状态 | 类型 | 说明 |
|------|------|------|
| `sessions` | `Session[]` | 所有会话列表 |
| `activeSessionId` | `string` | 当前激活的会话 ID |

**计算属性：**

| 属性 | 类型 | 说明 |
|------|------|------|
| `activeSession` | `Session \| undefined` | 当前激活的会话对象 |
| `connectedSessions` | `Session[]` | 已连接的会话列表 |

**方法：**

| 方法 | 参数 | 说明 |
|------|------|------|
| `addSession` | `session: Session` | 添加新会话 |
| `removeSession` | `id: string` | 移除会话 |
| `updateSession` | `id: string, updates: Partial<Session>` | 更新会话属性 |
| `setActiveSession` | `id: string` | 设置当前激活会话 |
| `getSessionById` | `id: string` | 根据 ID 获取会话 |
| `updateSessionStatus` | `id: string, status` | 更新会话连接状态 |
| `clearSessions` | - | 清空所有会话 |

**使用示例：**

```typescript
import { useSessionStore } from '@/stores/session'

const sessionStore = useSessionStore()

// 添加会话
sessionStore.addSession({
  id: 'session-1',
  name: 'Web Server',
  host: '192.168.1.100',
  port: 22,
  username: 'root',
  authType: 'password',
  status: 'disconnected'
})

// 设置激活会话
sessionStore.setActiveSession('session-1')

// 更新会话状态
sessionStore.updateSessionStatus('session-1', 'connected')
```

---

### terminal.ts - 终端状态管理

管理终端标签页的创建、切换、关闭等操作。

**状态：**

| 状态 | 类型 | 说明 |
|------|------|------|
| `tabs` | `Tab[]` | 所有标签页列表 |
| `activeTabId` | `string` | 当前激活的标签页 ID |
| `terminalSizes` | `Map<string, TerminalSize>` | 终端尺寸映射 |

**计算属性：**

| 属性 | 类型 | 说明 |
|------|------|------|
| `activeTab` | `Tab \| undefined` | 当前激活的标签页 |
| `tabCount` | `number` | 标签页数量 |

**方法：**

| 方法 | 参数 | 说明 |
|------|------|------|
| `createTab` | `title: string, sessionId: string` | 创建新标签页 |
| `closeTab` | `id: string` | 关闭标签页 |
| `setActiveTab` | `id: string` | 设置激活标签页 |
| `updateTabTitle` | `id: string, title: string` | 更新标签页标题 |
| `updateTabTerminalId` | `id: string, terminalId: string` | 更新终端 ID |
| `getTabById` | `id: string` | 根据 ID 获取标签页 |
| `updateTerminalSize` | `id: string, size: TerminalSize` | 更新终端尺寸 |
| `getTerminalSize` | `id: string` | 获取终端尺寸 |
| `clearTabs` | - | 清空所有标签页 |

**使用示例：**

```typescript
import { useTerminalStore } from '@/stores/terminal'

const terminalStore = useTerminalStore()

// 创建标签页
const tab = terminalStore.createTab('Web Server', 'session-1')

// 切换标签页
terminalStore.setActiveTab(tab.id)

// 关闭标签页
terminalStore.closeTab(tab.id)
```

---

## 在组件中使用

### 基本用法

```typescript
import { useSessionStore } from '@/stores/session'
import { useTerminalStore } from '@/stores/terminal'

// 在 setup 函数或 <script setup> 中
const sessionStore = useSessionStore()
const terminalStore = useTerminalStore()

// 访问状态
console.log(sessionStore.sessions)
console.log(terminalStore.activeTab)

// 调用方法
sessionStore.addSession(newSession)
terminalStore.createTab('New Tab', 'session-1')
```

### 解构使用（保持响应性）

```typescript
import { storeToRefs } from 'pinia'
import { useSessionStore } from '@/stores/session'

const sessionStore = useSessionStore()

// 使用 storeToRefs 解构状态，保持响应性
const { sessions, activeSession } = storeToRefs(sessionStore)

// 方法可以直接解构
const { addSession, removeSession } = sessionStore
```

### 监听状态变化

```typescript
import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useSessionStore } from '@/stores/session'

const sessionStore = useSessionStore()
const { activeSessionId } = storeToRefs(sessionStore)

// 监听激活会话变化
watch(activeSessionId, (newId, oldId) => {
  console.log(`Session changed from ${oldId} to ${newId}`)
})
```

---

## 目录结构

```
stores/
├── index.ts              # Store 入口，创建 Pinia 实例
├── session.ts            # 会话状态管理
├── terminal.ts           # 终端状态管理
└── __tests__/            # 单元测试
    ├── session.test.ts   # SessionStore 测试
    └── terminal.test.ts  # TerminalStore 测试
```
