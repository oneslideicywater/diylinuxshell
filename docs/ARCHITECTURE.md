# 自研终端管理工具 架构设计文档

## 1. 文档信息

| 项目 | 内容 |
|------|------|
| 产品名称 | DIY-Linux-Shell（自研终端管理工具） |
| 文档版本 | V1.0 |
| 创建日期 | 2026-03-29 |
| 文档状态 | 草稿 |

---

## 2. 技术选型

### 2.1 技术栈总览

| 层级 | 技术选型 | 选型理由 |
|------|----------|----------|
| 前端框架 | Electron + Vue 3 | 跨平台能力强，生态成熟，开发效率高 |
| UI组件库 | Element Plus | 组件丰富，文档完善，与Vue 3深度集成 |
| 状态管理 | Pinia | Vue 3官方推荐，轻量级，TypeScript友好 |
| 终端模拟 | xterm.js | 功能强大，VS Code同款，社区活跃 |
| SSH连接 | ssh2 (node-ssh) | Node.js最成熟的SSH库，功能完整 |
| 构建工具 | Vite | 极速热更新，现代化构建工具 |
| 编程语言 | TypeScript | 类型安全，提升代码质量和可维护性 |
| 数据存储 | electron-store | 轻量级JSON存储，无需编译，跨平台兼容 |

### 2.2 技术架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           用户界面层 (Renderer Process)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  会话管理   │  │  终端组件   │  │  设置面板   │  │  命令片段   │    │
│  │  Vue组件    │  │  xterm.js   │  │  Vue组件    │  │  Vue组件    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    状态管理层 (Pinia Store)                       │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │   │
│  │  │SessionStore│ │TerminalStore│ │ConfigStore │ │CommandStore│    │   │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼ IPC通信                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                           主进程层 (Main Process)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  IPC处理    │  │  SSH管理器  │  │  数据存储   │  │  窗口管理   │    │
│  │  Handler    │  │  SSHManager │  │  Database   │  │  WindowMgr  │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      底层服务层                                   │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │   │
│  │  │   ssh2    │  │  SQLite   │  │  加密服务  │  │  文件系统  │    │   │
│  │  │  (SSH库)  │  │ (数据库)  │  │ (crypto)  │  │   (fs)    │    │   │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 系统架构设计

### 3.1 整体架构

本项目采用 **Electron 多进程架构**，主要包含：

- **主进程 (Main Process)**：负责窗口管理、SSH连接管理、数据存储、系统级操作
- **渲染进程 (Renderer Process)**：负责用户界面渲染、用户交互处理
- **IPC通信**：主进程与渲染进程之间的通信桥梁

### 3.2 进程架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Electron 应用                             │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    主进程 (Main Process)                   │  │
│  │                                                            │  │
│  │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │  │
│  │   │  窗口管理   │    │  SSH管理器  │    │  数据库服务  │  │  │
│  │   │             │    │             │    │             │  │  │
│  │   │ • 创建窗口  │    │ • 连接管理  │    │ • 会话存储  │  │  │
│  │   │ • 窗口状态  │    │ • 连接池    │    │ • 配置存储  │  │  │
│  │   │ • 托盘图标  │    │ • 数据转发  │    │ • 日志存储  │  │  │
│  │   └─────────────┘    └─────────────┘    └─────────────┘  │  │
│  │          │                  │                  │         │  │
│  │          └──────────────────┼──────────────────┘         │  │
│  │                             │                            │  │
│  │                    ┌────────┴────────┐                   │  │
│  │                    │   IPC Handler   │                   │  │
│  │                    │   (消息路由)    │                   │  │
│  │                    └────────┬────────┘                   │  │
│  └─────────────────────────────┼─────────────────────────────┘  │
│                                │                                │
│                   ┌────────────┴────────────┐                   │
│                   │       IPC Bridge        │                   │
│                   │   (进程间通信桥梁)      │                   │
│                   └────────────┬────────────┘                   │
│                                │                                │
│  ┌─────────────────────────────┼─────────────────────────────┐  │
│  │                    渲染进程 (Renderer)                     │  │
│  │                             │                             │  │
│  │   ┌─────────────┐    ┌──────┴──────┐    ┌─────────────┐  │  │
│  │   │  Vue应用    │    │  Pinia Store │    │  xterm.js   │  │  │
│  │   │             │    │             │    │             │  │  │
│  │   │ • 组件渲染  │◄───┤ • 状态管理  │◄───┤ • 终端模拟  │  │  │
│  │   │ • 用户交互  │    │ • 数据缓存  │    │ • 输入输出  │  │  │
│  │   └─────────────┘    └─────────────┘    └─────────────┘  │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. 模块设计

### 4.1 目录结构

```
diy-linux-shell/
├── package.json                    # 项目配置文件
├── electron.vite.config.ts         # Electron构建配置
├── tsconfig.json                   # TypeScript配置
│
├── src/
│   ├── main/                       # 主进程代码
│   │   ├── index.ts               # 主进程入口
│   │   ├── ipc/                   # IPC通信处理
│   │   │   ├── index.ts           # IPC注册入口
│   │   │   ├── session.ts         # 会话相关IPC
│   │   │   ├── terminal.ts        # 终端相关IPC
│   │   │   └── config.ts          # 配置相关IPC
│   │   ├── services/              # 核心服务
│   │   │   ├── ssh-manager.ts     # SSH连接管理器
│   │   │   ├── database.ts        # 数据库服务
│   │   │   ├── crypto.ts          # 加密服务
│   │   │   └── logger.ts          # 日志服务
│   │   └── utils/                 # 工具函数
│   │       └── helpers.ts
│   │
│   ├── renderer/                   # 渲染进程代码
│   │   ├── index.html             # HTML入口
│   │   ├── src/
│   │   │   ├── main.ts            # Vue应用入口
│   │   │   ├── App.vue            # 根组件
│   │   │   ├── components/        # UI组件
│   │   │   │   ├── layout/        # 布局组件
│   │   │   │   │   ├── AppLayout.vue
│   │   │   │   │   ├── Sidebar.vue
│   │   │   │   │   └── Header.vue
│   │   │   │   ├── session/       # 会话管理组件
│   │   │   │   │   ├── SessionList.vue
│   │   │   │   │   ├── SessionForm.vue
│   │   │   │   │   └── SessionGroup.vue
│   │   │   │   ├── terminal/      # 终端组件
│   │   │   │   │   ├── TerminalTab.vue
│   │   │   │   │   ├── TerminalTabs.vue
│   │   │   │   │   └── XTerminal.vue
│   │   │   │   └── common/        # 通用组件
│   │   │   │       ├── Dialog.vue
│   │   │   │       └── Button.vue
│   │   │   ├── views/             # 页面视图
│   │   │   │   ├── Home.vue
│   │   │   │   └── Settings.vue
│   │   │   ├── stores/            # Pinia状态管理
│   │   │   │   ├── index.ts
│   │   │   │   ├── session.ts     # 会话状态
│   │   │   │   ├── terminal.ts    # 终端状态
│   │   │   │   └── config.ts      # 配置状态
│   │   │   ├── api/               # IPC API封装
│   │   │   │   ├── index.ts
│   │   │   │   ├── session.ts
│   │   │   │   ├── terminal.ts
│   │   │   │   └── config.ts
│   │   │   ├── styles/            # 样式文件
│   │   │   │   ├── variables.css  # CSS变量
│   │   │   │   ├── themes/        # 主题样式
│   │   │   │   │   ├── dark.css
│   │   │   │   │   └── light.css
│   │   │   │   └── global.css     # 全局样式
│   │   │   └── utils/             # 工具函数
│   │   │       ├── helpers.ts
│   │   │       └── constants.ts
│   │   └── assets/                # 静态资源
│   │       └── icons/
│   │
│   └── shared/                     # 共享代码
│       ├── types/                 # TypeScript类型定义
│       │   ├── session.ts
│       │   ├── terminal.ts
│       │   └── config.ts
│       └── constants/             # 共享常量
│           └── ipc-channels.ts
│
├── resources/                      # 应用资源
│   └── icons/                     # 应用图标
│
└── out/                           # 构建输出目录
```

### 4.2 核心模块设计

#### 4.2.1 SSH管理器 (SSHManager)

```typescript
/**
 * SSH连接管理器
 * 负责管理所有SSH连接的生命周期
 */
class SSHManager {
  private connections: Map<string, SSHConnection>;
  
  // 创建新的SSH连接
  async connect(sessionId: string, config: SSHConfig): Promise<void>;
  
  // 断开指定连接
  async disconnect(sessionId: string): Promise<void>;
  
  // 向终端发送数据
  write(sessionId: string, data: string): void;
  
  // 调整终端大小
  resize(sessionId: string, cols: number, rows: number): void;
  
  // 获取连接状态
  getStatus(sessionId: string): ConnectionStatus;
  
  // 执行命令
  async exec(sessionId: string, command: string): Promise<string>;
}
```

#### 4.2.2 数据存储服务 (StoreService)

```typescript
/**
 * 数据存储服务
 * 使用 electron-store 存储应用数据 (JSON格式)
 */
import Store from 'electron-store'

// 定义存储数据结构
interface StoreSchema {
  sessions: Session[]
  commands: Command[]
  config: AppConfig
  groups: SessionGroup[]
  commandGroups: CommandSnippetGroup[]
  history: HistoryRecord[]
}

class StoreService {
  private store: Store<StoreSchema>
  
  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'config',
      defaults: {
        sessions: [],
        commands: [],
        config: this.getDefaultConfig(),
        groups: [],
        commandGroups: [],
        history: []
      }
    })
  }
  
  // 会话CRUD操作
  createSession(session: Session): Session
  getSession(id: string): Session | undefined
  updateSession(id: string, data: Partial<Session>): Session
  deleteSession(id: string): void
  listSessions(): Session[]
  
  // 命令片段CRUD操作
  createCommand(command: Command): Command
  getCommand(id: string): Command | undefined
  updateCommand(id: string, data: Partial<Command>): Command
  deleteCommand(id: string): void
  listCommands(): Command[]
  
  // 配置管理
  getConfig(): AppConfig
  updateConfig(config: Partial<AppConfig>): AppConfig
  
  // 数据导入导出
  exportData(): string
  importData(json: string): void
}
```

**存储位置：**
- Windows: `%APPDATA%\diy-linux-shell\config.json`
- Linux: `~/.config/diy-linux-shell/config.json`
- macOS: `~/Library/Application Support/diy-linux-shell/config.json`
```

#### 4.2.3 加密服务 (CryptoService)

```typescript
/**
 * 加密服务
 * 负责敏感数据的加密和解密
 */
class CryptoService {
  // 加密数据
  encrypt(plaintext: string): string;
  
  // 解密数据
  decrypt(ciphertext: string): string;
  
  // 生成密钥对
  generateKeyPair(): KeyPair;
  
  // 验证密码
  verifyPassword(password: string, hash: string): boolean;
}
```

### 4.3 IPC通信设计

#### 4.3.1 IPC通道定义

```typescript
// 共享常量 - IPC通道名称
export const IPC_CHANNELS = {
  // 会话管理
  SESSION_CREATE: 'session:create',
  SESSION_UPDATE: 'session:update',
  SESSION_DELETE: 'session:delete',
  SESSION_LIST: 'session:list',
  SESSION_GET: 'session:get',
  
  // 终端操作
  TERMINAL_CONNECT: 'terminal:connect',
  TERMINAL_DISCONNECT: 'terminal:disconnect',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_DATA: 'terminal:data',      // 主进程向渲染进程发送数据
  
  // 配置管理
  CONFIG_GET: 'config:get',
  CONFIG_UPDATE: 'config:update',
  
  // 命令片段
  COMMAND_CREATE: 'command:create',
  COMMAND_UPDATE: 'command:update',
  COMMAND_DELETE: 'command:delete',
  COMMAND_LIST: 'command:list',
} as const;
```

#### 4.3.2 IPC通信流程

```
┌──────────────────┐                              ┌──────────────────┐
│   渲染进程        │                              │    主进程        │
│  (Renderer)      │                              │    (Main)        │
├──────────────────┤                              ├──────────────────┤
│                  │                              │                  │
│  用户点击连接    │                              │                  │
│       │          │                              │                  │
│       ▼          │                              │                  │
│  调用API方法     │                              │                  │
│       │          │                              │                  │
│       │          │  ipcRenderer.invoke()       │                  │
│       │─────────────────────────────────────────►                  │
│                  │                              │                  │
│                  │                              │  处理请求        │
│                  │                              │       │          │
│                  │                              │       ▼          │
│                  │                              │  SSH连接         │
│                  │                              │       │          │
│                  │                              │       ▼          │
│                  │                              │  建立连接成功    │
│                  │                              │       │          │
│                  │  ipcMain.handle() 返回       │       │          │
│       ◄─────────────────────────────────────────┤                  │
│                  │                              │                  │
│  更新UI状态      │                              │                  │
│                  │                              │                  │
│                  │                              │                  │
│                  │     ════════ 数据流 ════════ │                  │
│                  │                              │                  │
│                  │  webContents.send()          │                  │
│       ◄─────────────────────────────────────────┤  SSH数据到达    │
│                  │                              │                  │
│  更新终端显示    │                              │                  │
│                  │                              │                  │
└──────────────────┘                              └──────────────────┘
```

---

## 5. 数据流设计

### 5.1 会话连接数据流

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ 用户操作 │───►│ Vue组件 │───►│  Store  │───►│ IPC API │───►│ 主进程  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └────┬────┘
                                                                  │
                                                                  ▼
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ 终端显示 │◄───│ xterm.js│◄───│ 数据回调 │◄───│ SSH连接 │◄───│SSHManager│
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
```

### 5.2 状态管理数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Pinia Store                                 │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      SessionStore                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │   state     │  │  getters    │  │     actions         │  │   │
│  │  │             │  │             │  │                     │  │   │
│  │  │ sessions    │  │ getSession  │  │ fetchSessions()     │  │   │
│  │  │ groups      │  │ getGroups   │  │ createSession()     │  │   │
│  │  │ activeId    │  │ activeSession│  │ updateSession()    │  │   │
│  │  │             │  │             │  │ deleteSession()     │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      TerminalStore                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │   state     │  │  getters    │  │     actions         │  │   │
│  │  │             │  │             │  │                     │  │   │
│  │  │ tabs        │  │ activeTab   │  │ connect()           │  │   │
│  │  │ activeTab   │  │ getTabById  │  │ disconnect()        │  │   │
│  │  │             │  │             │  │ sendData()          │  │   │
│  │  │             │  │             │  │ resize()            │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. 组件设计

### 6.1 组件层次结构

```
App.vue
├── AppLayout.vue                    # 应用布局容器
│   ├── Sidebar.vue                  # 左侧边栏
│   │   ├── SessionList.vue          # 会话列表
│   │   │   └── SessionGroup.vue     # 会话分组
│   │   │       └── SessionItem.vue  # 会话项
│   │   └── QuickConnect.vue         # 快速连接
│   │
│   └── MainContent.vue              # 主内容区
│       ├── Header.vue               # 顶部栏
│       │   └── Toolbar.vue          # 工具栏
│       │
│       └── TerminalArea.vue         # 终端区域
│           ├── TerminalTabs.vue     # 标签页栏
│           │   └── TerminalTab.vue  # 单个标签
│           │
│           └── TerminalPane.vue     # 终端面板
│               └── XTerminal.vue    # xterm.js封装
│
├── dialogs/                         # 对话框组件
│   ├── SessionForm.vue              # 会话表单
│   ├── SettingsDialog.vue           # 设置对话框
│   └── CommandDialog.vue            # 命令片段对话框
│
└── common/                          # 通用组件
    ├── Button.vue
    ├── Input.vue
    ├── Select.vue
    └── Dialog.vue
```

### 6.2 核心组件接口设计

#### 6.2.1 XTerminal 组件

```vue
<script setup lang="ts">
/**
 * XTerminal 组件
 * 封装 xterm.js，提供终端显示和交互功能
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'

interface Props {
  sessionId: string
  fontSize?: number
  fontFamily?: string
  theme?: TerminalTheme
}

interface Emits {
  (e: 'ready'): void
  (e: 'resize', size: { cols: number; rows: number }): void
}

const props = withDefaults(defineProps<Props>(), {
  fontSize: 14,
  fontFamily: 'Consolas, Monaco, monospace'
})

const emit = defineEmits<Emits>()

// 终端实例
const terminalRef = ref<HTMLElement>()
let terminal: Terminal
let fitAddon: FitAddon

// 初始化终端
const initTerminal = () => { /* ... */ }

// 处理输入
const handleInput = (data: string) => { /* ... */ }

// 处理调整大小
const handleResize = () => { /* ... */ }

// 写入数据
const write = (data: string) => { /* ... */ }

// 暴露方法给父组件
defineExpose({ write, resize: handleResize })
</script>
```

#### 6.2.2 SessionList 组件

```vue
<script setup lang="ts">
/**
 * SessionList 组件
 * 显示会话列表，支持分组、搜索、右键菜单
 */
import { ref, computed } from 'vue'
import { useSessionStore } from '@/stores/session'

interface Props {
  searchKeyword?: string
}

const props = defineProps<Props>()
const sessionStore = useSessionStore()

// 过滤后的会话列表
const filteredSessions = computed(() => {
  if (!props.searchKeyword) {
    return sessionStore.sessions
  }
  return sessionStore.sessions.filter(s => 
    s.name.includes(props.searchKeyword) ||
    s.host.includes(props.searchKeyword)
  )
})

// 连接会话
const handleConnect = (session: Session) => { /* ... */ }

// 编辑会话
const handleEdit = (session: Session) => { /* ... */ }

// 删除会话
const handleDelete = (session: Session) => { /* ... */ }
</script>
```

---

## 7. 安全设计

### 7.1 密码存储安全

```
┌─────────────────────────────────────────────────────────────────┐
│                      密码存储流程                                │
│                                                                  │
│  用户输入密码                                                    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────┐                                                │
│  │ 获取系统密钥 │  ← 使用 Electron safeStorage API              │
│  └─────────────┘                                                │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────┐                                                │
│  │ AES加密     │  ← 使用系统密钥加密密码                        │
│  └─────────────┘                                                │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────┐                                                │
│  │ 存储到数据库 │  ← 存储加密后的密文                           │
│  └─────────────┘                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 密钥文件安全

```typescript
/**
 * 密钥文件安全策略
 */
const keyFileSecurity = {
  // 1. 文件权限检查
  checkPermissions: (filePath: string): boolean => {
    // 确保私钥文件权限为 600 (仅所有者可读写)
  },
  
  // 2. 密钥文件存储位置
  // Windows: %APPDATA%/diy-linux-shell/keys/
  // macOS: ~/Library/Application Support/diy-linux-shell/keys/
  // Linux: ~/.config/diy-linux-shell/keys/
  
  // 3. 密钥文件加密（可选）
  encryptKeyFile: (content: string, passphrase: string): string => {
    // 使用 passphrase 加密私钥内容
  }
}
```

### 7.3 IPC通信安全

```typescript
/**
 * IPC通信安全策略
 */
const ipcSecurity = {
  // 1. 验证消息来源
  validateSender: (event: IpcMainInvokeEvent): boolean => {
    // 确保消息来自有效的渲染进程
    return event.senderFrame.url.startsWith('app://')
  },
  
  // 2. 敏感数据传输
  // 使用 contextBridge 暴露安全的 API
  // 不直接暴露 Node.js API 给渲染进程
  
  // 3. 输入验证
  validateInput: (channel: string, data: unknown): boolean => {
    // 验证所有输入数据的类型和格式
  }
}
```

---

## 8. 性能优化设计

### 8.1 终端渲染优化

```typescript
/**
 * 终端性能优化策略
 */
const terminalOptimization = {
  // 1. 使用 Canvas 渲染
  // xterm.js 配置: rendererType: 'canvas'
  
  // 2. 启用 GPU 加速
  // xterm.js 配置: gpuAcceleration: true
  
  // 3. 合理设置滚动缓冲区
  // xterm.js 配置: scrollback: 10000
  
  // 4. 数据节流
  throttleData: (data: string, delay: number = 16) => {
    // 限制数据写入频率，避免大量数据导致卡顿
  }
}
```

### 8.2 数据库优化

```sql
-- 会话表索引
CREATE INDEX idx_sessions_group ON sessions(group_id);
CREATE INDEX idx_sessions_name ON sessions(name);

-- 命令片段表索引
CREATE INDEX idx_commands_group ON commands(group_id);

-- 使用事务批量操作
BEGIN TRANSACTION;
-- 多条 INSERT/UPDATE 语句
COMMIT;
```

### 8.3 内存管理

```typescript
/**
 * 内存优化策略
 */
const memoryOptimization = {
  // 1. 连接池管理
  // 限制最大连接数，及时释放不活跃连接
  
  // 2. 终端实例管理
  // 关闭标签页时销毁 xterm.js 实例
  
  // 3. 事件监听器清理
  // 组件销毁时移除所有事件监听器
  
  // 4. 缓存策略
  // 使用 LRU 缓存常用数据
}
```

---

## 9. 错误处理设计

### 9.1 错误类型定义

```typescript
/**
 * 应用错误类型
 */
enum ErrorCode {
  // 连接错误 1000-1999
  CONNECTION_FAILED = 1001,
  CONNECTION_TIMEOUT = 1002,
  AUTH_FAILED = 1003,
  CONNECTION_LOST = 1004,
  
  // 数据错误 2000-2999
  DATA_NOT_FOUND = 2001,
  DATA_INVALID = 2002,
  
  // 系统错误 3000-3999
  FILE_NOT_FOUND = 3001,
  PERMISSION_DENIED = 3002,
  UNKNOWN_ERROR = 9999
}

/**
 * 应用错误类
 */
class AppError extends Error {
  code: ErrorCode
  details?: Record<string, unknown>
  
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.code = code
    this.details = details
  }
}
```

### 9.2 错误处理流程

```
┌─────────────────────────────────────────────────────────────────┐
│                       错误处理流程                               │
│                                                                  │
│  错误发生                                                        │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────┐                                                │
│  │ 捕获错误     │                                                │
│  └─────────────┘                                                │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────┐      ┌─────────────┐                          │
│  │ 判断错误类型 │─────►│ 业务错误    │                          │
│  └─────────────┘      └─────────────┘                          │
│       │                      │                                   │
│       │                      ▼                                   │
│       │              ┌─────────────┐                            │
│       │              │ 显示用户提示 │                            │
│       │              └─────────────┘                            │
│       │                      │                                   │
│       ▼                      ▼                                   │
│  ┌─────────────┐      ┌─────────────┐                          │
│  │ 系统错误    │      │ 记录日志    │                          │
│  └─────────────┘      └─────────────┘                          │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────┐                                                │
│  │ 尝试恢复    │                                                │
│  └─────────────┘                                                │
│       │                                                          │
│       ├── 成功 ──► 继续运行                                      │
│       │                                                          │
│       └── 失败 ──► 显示错误报告，引导用户反馈                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. 测试策略

### 10.1 测试分层

```
┌─────────────────────────────────────────────────────────────────┐
│                        测试金字塔                                │
│                                                                  │
│                         ╱╲                                       │
│                        ╱  ╲                                      │
│                       ╱ E2E╲        端到端测试                   │
│                      ╱──────╲       (Playwright)                │
│                     ╱ 集成测试 ╲                                  │
│                    ╱────────────╲   API集成测试                  │
│                   ╱   单元测试    ╲  组件测试                    │
│                  ╱────────────────╱  (Vitest)                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 测试覆盖范围

| 测试类型 | 覆盖内容 | 工具 |
|----------|----------|------|
| 单元测试 | 工具函数、Store逻辑、加密服务 | Vitest |
| 组件测试 | Vue组件渲染、交互 | Vitest + @vue/test-utils |
| 集成测试 | IPC通信、数据库操作 | Vitest |
| E2E测试 | 完整用户流程 | Playwright |

---

## 11. 部署架构

### 11.1 构建产物

```
out/
├── diy-linux-shell-{version}-win-x64.exe      # Windows安装包
├── diy-linux-shell-{version}-win-x64.zip      # Windows便携版
├── diy-linux-shell-{version}-mac-x64.dmg      # macOS Intel版
├── diy-linux-shell-{version}-mac-arm64.dmg    # macOS Apple Silicon版
├── diy-linux-shell-{version}-linux-x64.AppImage  # Linux AppImage
└── diy-linux-shell-{version}-linux-x64.deb    # Linux Debian包
```

### 11.2 自动更新

```typescript
/**
 * 自动更新流程
 */
const autoUpdate = {
  // 1. 检查更新
  checkForUpdates: async () => {
    // 调用更新服务器API检查新版本
  },
  
  // 2. 下载更新
  downloadUpdate: async () => {
    // 后台下载更新包
  },
  
  // 3. 安装更新
  quitAndInstall: () => {
    // 重启应用并安装更新
  }
}
```

---

## 12. 扩展性设计

### 12.1 插件系统（未来规划）

```typescript
/**
 * 插件接口定义
 */
interface Plugin {
  name: string
  version: string
  description: string
  
  // 生命周期钩子
  onLoad?: () => void
  onUnload?: () => void
  
  // 扩展点
  commands?: Command[]
  themes?: Theme[]
  protocols?: Protocol[]
}

/**
 * 插件管理器
 */
class PluginManager {
  // 加载插件
  load(pluginPath: string): void
  
  // 卸载插件
  unload(pluginName: string): void
  
  // 获取插件列表
  list(): Plugin[]
}
```

### 12.2 协议扩展（未来规划）

```typescript
/**
 * 协议接口定义
 */
interface Protocol {
  name: string
  defaultPort: number
  
  // 连接方法
  connect(config: ConnectionConfig): Promise<Connection>
  
  // 支持的功能
  features: {
    shell: boolean
    sftp: boolean
    portForwarding: boolean
  }
}

// 内置协议: SSH
// 可扩展协议: Telnet, Serial, RDP 等
```

---

## 13. 开发规范

### 13.1 代码规范

- 使用 ESLint + Prettier 进行代码格式化
- 使用 TypeScript 严格模式
- 遵循 Vue 3 Composition API 最佳实践
- 所有函数和复杂类型必须添加类型注释

### 13.2 Git提交规范

```
<type>(<scope>): <subject>

type:
  - feat: 新功能
  - fix: 修复bug
  - docs: 文档更新
  - style: 代码格式调整
  - refactor: 重构
  - test: 测试相关
  - chore: 构建/工具相关

示例:
  feat(session): 添加会话分组功能
  fix(terminal): 修复终端中文显示问题
```

### 13.3 分支策略

```
main (生产分支)
  │
  ├── develop (开发分支)
  │     │
  │     ├── feature/session-group (功能分支)
  │     ├── feature/sftp (功能分支)
  │     └── bugfix/terminal-crash (修复分支)
  │
  └── release/v1.0.0 (发布分支)
```

---

## 14. 风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| Electron版本更新导致兼容问题 | 高 | 锁定版本，充分测试后再升级 |
| SSH库安全漏洞 | 高 | 及时关注安全公告，快速更新依赖 |
| 跨平台UI差异 | 中 | 使用成熟的UI组件库，多平台测试 |
| 性能问题 | 中 | 持续性能监控，优化关键路径 |
| 用户数据丢失 | 高 | 实现自动备份，提供数据恢复功能 |

---

## 15. 附录

### 15.1 技术依赖清单

```json
{
  "dependencies": {
    "vue": "^3.4.0",
    "pinia": "^2.1.0",
    "vue-router": "^4.2.0",
    "element-plus": "^2.5.0",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0",
    "xterm-addon-web-links": "^0.9.0",
    "ssh2": "^1.15.0",
    "better-sqlite3": "^9.4.0"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vitest": "^1.2.0",
    "playwright": "^1.41.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.0"
  }
}
```

### 15.2 参考资源

- [Electron 官方文档](https://www.electronjs.org/docs)
- [Vue 3 官方文档](https://vuejs.org/)
- [xterm.js 文档](https://xtermjs.org/)
- [ssh2 文档](https://github.com/mscdex/ssh2)
- [SSH Protocol RFC](https://www.rfc-editor.org/rfc/rfc4250)
