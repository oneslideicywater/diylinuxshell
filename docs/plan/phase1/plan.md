# Phase 1: V1.0 MVP 核心功能 - 实现计划

## 1. 概述

Phase 1 是 DIY-Linux-Shell 项目的 MVP（最小可行产品）阶段，目标是实现核心 SSH 连接功能，让用户能够通过密码认证连接远程服务器并进行终端操作。

**核心功能范围**：
- ✅ SSH 会话管理（创建、编辑、删除）
- ✅ 密码认证连接
- ✅ 终端操作（输入、输出、调整大小）
- ✅ 多标签页支持
- ✅ 会话状态管理

**不包含的功能**（将在后续 Phase 完成）：
- ❌ SFTP 文件传输（Phase 2）
- ❌ 命令片段管理（Phase 4）
- ❌ 密钥认证（Phase 2）
- ❌ 会话分组管理（Phase 2）

**预计工期**：1 周

**前置依赖**：Phase 0 项目初始化已完成

---

## 2. 任务清单

### 2.1 主进程服务层

| 序号 | 任务 | 产出物 | 依赖 | 优先级 |
|------|------|--------|------|--------|
| 1.1 | 实现数据存储服务 | src/main/services/store.ts | Phase 0 | P0 |
| 1.2 | 实现加密服务 | src/main/services/crypto.ts | Phase 0 | P0 |
| 1.3 | 实现 SSH 管理器 | src/main/services/ssh-manager.ts | Phase 0 | P0 |

### 2.2 IPC 通信层

| 序号 | 任务 | 产出物 | 依赖 | 优先级 |
|------|------|--------|------|--------|
| 1.4 | 实现会话 IPC 处理 | src/main/ipc/session.ts | 1.1, 1.2 | P0 |
| 1.5 | 实现终端 IPC 处理 | src/main/ipc/terminal.ts | 1.3 | P0 |

### 2.3 渲染进程 API 层

| 序号 | 任务 | 产出物 | 依赖 | 优先级 |
|------|------|--------|------|--------|
| 1.6 | 创建渲染进程 API 封装 | src/preload/index.ts 扩展 | 1.4, 1.5 | P0 |

### 2.4 状态管理层

| 序号 | 任务 | 产出物 | 依赖 | 优先级 |
|------|------|--------|------|--------|
| 1.7 | 实现 SessionStore | src/renderer/src/stores/session.ts | 1.6 | P0 |
| 1.8 | 实现 TerminalStore | src/renderer/src/stores/terminal.ts | 1.6 | P0 |

### 2.5 UI 组件层

| 序号 | 任务 | 产出物 | 依赖 | 优先级 |
|------|------|--------|------|--------|
| 1.9 | 实现布局组件 | AppLayout.vue, Sidebar.vue | 1.7 | P0 |
| 1.10 | 实现会话列表组件 | SessionList.vue, SessionItem.vue | 1.7, 1.9 | P0 |
| 1.11 | 实现会话表单组件 | SessionForm.vue | 1.7, 1.9 | P0 |
| 1.12 | 实现终端组件 | XTerminal.vue | 1.8 | P0 |
| 1.13 | 实现标签页组件 | TerminalTabs.vue, TerminalTab.vue | 1.12 | P0 |

### 2.6 测试

| 序号 | 任务 | 产出物 | 依赖 | 优先级 |
|------|------|--------|------|--------|
| 1.14 | 集成测试与调试 | - | 1.10-1.13 | P0 |
| 1.15 | 编写 CryptoService 单元测试 | crypto.test.ts | 1.2 | P1 |
| 1.16 | 编写 StoreService 单元测试 | store.test.ts | 1.1 | P1 |
| 1.17 | 编写 SSHManager 单元测试 | ssh-manager.test.ts | 1.3 | P1 |
| 1.18 | 编写 SessionStore 单元测试 | session.test.ts | 1.7 | P1 |
| 1.19 | 编写 TerminalStore 单元测试 | terminal.test.ts | 1.8 | P1 |
| 1.20 | 编写会话 IPC 集成测试 | session.integration.test.ts | 1.4 | P1 |
| 1.21 | 编写终端 IPC 集成测试 | terminal.integration.test.ts | 1.5 | P1 |
| 1.22 | 编写连接流程 E2E 测试 | connection.e2e.spec.ts | 1.14 | P1 |
| 1.23 | 编写 Vim 编辑器 E2E 测试 | vim.e2e.spec.ts | 1.14 | P1 |
| 1.24 | 编写多标签页 E2E 测试 | tabs.e2e.spec.ts | 1.13 | P1 |

---

## 3. 与其他 Phase 的关系

### Phase 2: SFTP 文件传输
- **SFTP 功能**：双面板文件传输（类似 Xftp）
- **会话分组**：按项目/环境组织会话
- **密钥认证**：支持 SSH 密钥认证
- **主题配置**：完善主题系统

### Phase 3: （待规划）

### Phase 4: 命令片段管理
- **命令片段**：快速插入常用命令
- **命令分组**：按场景组织命令片段
- **命令搜索**：快速查找命令
- **标签管理**：多维度标记命令

---

## 4. 模块实现顺序

```
┌─────────────────────────────────────────────────────────────────┐
│                        Phase 1 实现顺序                          │
│                                                                  │
│  1. 主进程服务层                                                 │
│     ├── 1.1 StoreService (electron-store封装)                   │
│     ├── 1.2 CryptoService (密码加密)                            │
│     └── 1.3 SSHManager (SSH连接管理)                            │
│              │                                                   │
│              ▼                                                   │
│  2. IPC通信层                                                    │
│     ├── 1.4 Session IPC (会话CRUD)                              │
│     └── 1.5 Terminal IPC (终端操作)                             │
│              │                                                   │
│              ▼                                                   │
│  3. 渲染进程API层                                                │
│     └── 1.6 API封装 (调用IPC)                                   │
│              │                                                   │
│              ▼                                                   │
│  4. 状态管理层                                                   │
│     ├── 1.7 SessionStore                                        │
│     └── 1.8 TerminalStore                                       │
│              │                                                   │
│              ▼                                                   │
│  5. UI组件层                                                     │
│     ├── 1.9 布局组件                                            │
│     ├── 1.10 会话列表                                           │
│     ├── 1.11 会话表单                                           │
│     ├── 1.12 终端组件                                           │
│     └── 1.13 标签页组件                                         │
│              │                                                   │
│              ▼                                                   │
│  6. 测试                                                         │
│     └── 1.14-1.24 单元测试/集成测试/E2E测试                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. 详细实现步骤

### 5.1 主进程服务层

#### 5.1.1 StoreService (数据存储服务)

**文件**：`src/main/services/store.ts`

**功能**：
- 封装 electron-store，提供数据持久化存储
- 管理会话配置、应用配置等数据

**核心方法**：
```typescript
class StoreService {
  // 会话管理
  getSessions(): Session[]
  getSessionById(id: string): Session | undefined
  addSession(session: Session): void
  updateSession(id: string, updates: Partial<Session>): void
  deleteSession(id: string): void
  
  // 会话分组管理
  getSessionGroups(): SessionGroup[]
  addSessionGroup(group: SessionGroup): void
  updateSessionGroup(id: string, updates: Partial<SessionGroup>): void
  deleteSessionGroup(id: string): void
  
  // 配置管理
  getConfig(): AppConfig
  setConfig(config: Partial<AppConfig>): void
}
```

#### 5.1.2 CryptoService (加密服务)

**文件**：`src/main/services/crypto.ts`

**功能**：
- 使用 electron 原生 crypto 模块进行加密
- 保护敏感数据（密码、密钥等）

**核心方法**：
```typescript
class CryptoService {
  // 加密数据
  encrypt(plainText: string): string
  
  // 解密数据
  decrypt(encryptedText: string): string
  
  // 生成唯一ID
  generateSessionId(): string
  generateGroupId(): string
  
  // 生成随机密钥
  generateRandomKey(length: number): string
}
```

#### 5.1.3 SSHManager (SSH 连接管理器)

**文件**：`src/main/services/ssh-manager.ts`

**功能**：
- 管理 SSH 连接的创建、维护和销毁
- 处理终端数据流

**核心方法**：
```typescript
class SSHManager {
  // 连接管理
  connect(session: Session): Promise<string>
  disconnect(sessionId: string): Promise<void>
  disconnectAll(): Promise<void>
  
  // 状态查询
  getStatus(sessionId: string): ConnectionStatus | null
  hasConnection(sessionId: string): boolean
  getConnectionCount(): number
  
  // 数据传输
  write(sessionId: string, data: string): void
  resize(sessionId: string, rows: number, cols: number): void
  
  // 事件监听
  onData(sessionId: string, callback: (data: string) => void): () => void
  onClose(sessionId: string, callback: () => void): () => void
  onError(sessionId: string, callback: (error: Error) => void): () => void
}
```

### 5.2 IPC 通信层

#### 5.2.1 Session IPC (会话相关)

**文件**：`src/main/ipc/session.ts`

**通道列表**：
| 通道 | 方法 | 说明 |
|------|------|------|
| `session:get-all` | handle | 获取所有会话 |
| `session:get-by-id` | handle | 获取单个会话 |
| `session:create` | handle | 创建会话 |
| `session:update` | handle | 更新会话 |
| `session:delete` | handle | 删除会话 |
| `session:connect` | handle | 连接会话 |
| `session:disconnect` | handle | 断开会话 |
| `session:get-status` | handle | 获取连接状态 |

#### 5.2.2 Terminal IPC (终端相关)

**文件**：`src/main/ipc/terminal.ts`

**通道列表**：
| 通道 | 方法 | 说明 |
|------|------|------|
| `terminal:write` | on | 写入数据 |
| `terminal:resize` | on | 调整大小 |
| `terminal:data` | send | 数据输出（主进程推送） |
| `terminal:close` | send | 连接关闭（主进程推送） |
| `terminal:error` | send | 连接错误（主进程推送） |

### 5.3 状态管理层

#### 5.3.1 SessionStore

**文件**：`src/renderer/src/stores/session.ts`

**状态**：
```typescript
{
  sessions: Session[]           // 所有会话
  activeSessionId: string       // 当前激活的会话
}
```

**方法**：
- `addSession(session)` - 添加会话
- `removeSession(id)` - 移除会话
- `updateSession(id, updates)` - 更新会话
- `updateSessionStatus(id, status)` - 更新会话状态
- `setActiveSession(id)` - 设置激活会话

#### 5.3.2 TerminalStore

**文件**：`src/renderer/src/stores/terminal.ts`

**状态**：
```typescript
{
  tabs: Tab[]                   // 所有标签页
  activeTabId: string           // 当前激活的标签页
}
```

**方法**：
- `addTab(session)` - 添加标签页
- `closeTab(id)` - 关闭标签页
- `setActiveTab(id)` - 设置激活标签页
- `updateTabTitle(id, title)` - 更新标签页标题

### 5.4 UI 组件层

#### 5.4.1 布局组件

| 组件 | 功能 |
|------|------|
| `AppLayout.vue` | 应用主布局，包含标题栏、侧边栏、主内容区 |
| `Sidebar.vue` | 左侧边栏，包含会话列表、操作按钮 |

#### 5.4.2 会话组件

| 组件 | 功能 |
|------|------|
| `SessionList.vue` | 会话列表，显示所有会话 |
| `SessionItem.vue` | 单个会话项，显示会话信息和操作按钮 |
| `SessionForm.vue` | 会话表单，创建/编辑会话 |

#### 5.4.3 终端组件

| 组件 | 功能 |
|------|------|
| `XTerminal.vue` | 终端组件，基于 xterm.js |
| `TerminalTabs.vue` | 标签页栏，管理所有标签页 |
| `TerminalTab.vue` | 单个标签页，显示标题和关闭按钮 |

---

## 6. 文件产出清单

### 6.1 主进程文件

| 文件路径 | 功能描述 |
|----------|----------|
| `src/main/services/store.ts` | 数据存储服务 |
| `src/main/services/crypto.ts` | 加密服务 |
| `src/main/services/ssh-manager.ts` | SSH 连接管理器 |
| `src/main/ipc/session.ts` | 会话 IPC 处理 |
| `src/main/ipc/terminal.ts` | 终端 IPC 处理 |

### 6.2 渲染进程文件

| 文件路径 | 功能描述 |
|----------|----------|
| `src/renderer/src/stores/session.ts` | 会话状态管理 |
| `src/renderer/src/stores/terminal.ts` | 终端状态管理 |
| `src/renderer/src/components/layout/AppLayout.vue` | 应用布局 |
| `src/renderer/src/components/layout/Sidebar.vue` | 左侧边栏 |
| `src/renderer/src/components/session/SessionList.vue` | 会话列表 |
| `src/renderer/src/components/session/SessionItem.vue` | 会话项 |
| `src/renderer/src/components/session/SessionForm.vue` | 会话表单 |
| `src/renderer/src/components/terminal/XTerminal.vue` | 终端组件 |
| `src/renderer/src/components/terminal/TerminalTabs.vue` | 标签页栏 |
| `src/renderer/src/components/terminal/TerminalTab.vue` | 单个标签页 |

### 6.3 测试文件

| 文件路径 | 功能描述 |
|----------|----------|
| `src/main/services/__tests__/crypto.test.ts` | 加密服务单元测试 |
| `src/main/services/__tests__/store.test.ts` | 存储服务单元测试 |
| `src/main/services/__tests__/ssh-manager.test.ts` | SSH 管理器单元测试 |
| `src/renderer/src/stores/__tests__/session.test.ts` | 会话 Store 单元测试 |
| `src/renderer/src/stores/__tests__/terminal.test.ts` | 终端 Store 单元测试 |
| `src/main/ipc/__tests__/session.integration.test.ts` | 会话 IPC 集成测试 |
| `src/main/ipc/__tests__/terminal.integration.test.ts` | 终端 IPC 集成测试 |
| `e2e/connection.e2e.spec.ts` | 连接流程 E2E 测试 |
| `e2e/vim.e2e.spec.ts` | Vim 编辑器 E2E 测试 |
| `e2e/tabs.e2e.spec.ts` | 多标签页 E2E 测试 |

---

## 6. 验收标准

### 6.1 功能验收

- [ ] 能够创建、编辑、删除会话配置
- [ ] 能够通过密码认证连接 SSH 服务器
- [ ] 终端能够正确显示输出内容
- [ ] 用户输入能够正确发送到服务器
- [ ] 多标签页功能正常工作
- [ ] 切换标签页时终端内容正确切换（每个标签页有独立的终端实例）
- [ ] 每个标签页拥有独立的SSH连接，关闭一个标签页不影响其他标签页
- [ ] 会话列表每个会话项有连接按钮，点击创建新标签页并连接
- [ ] vi/vim 编辑器正常使用

### 6.2 技术验收

- [ ] 所有单元测试通过
- [ ] 所有集成测试通过
- [ ] 所有 E2E 测试通过
- [ ] TypeScript 类型检查无错误
- [ ] ESLint 检查无错误

### 6.3 安全验收

- [ ] 密码加密存储
- [ ] IPC 通信安全
- [ ] 无敏感信息泄露

---

## 7. 风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| SSH 连接不稳定 | 用户体验差 | 实现自动重连机制 |
| 终端渲染性能问题 | 卡顿 | 使用虚拟滚动、限制缓冲区大小 |
| 密码加密强度不够 | 安全风险 | 使用 AES-256 加密 |

---

## 8. 相关文档

- [Phase 1 PRD](./prd.md)
- [项目总计划](../../plan.md)
- [项目 PRD](../../PRD.md)
- [架构设计](../../ARCHITECTURE.md)
