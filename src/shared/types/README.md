# 共享类型定义

本目录包含主进程和渲染进程共用的 TypeScript 类型定义。

## 类型定义列表

### Session - 会话类型

管理 SSH 会话的完整信息。

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | ✅ | 会话 ID |
| `name` | `string` | ✅ | 会话名称 |
| `host` | `string` | ✅ | 主机地址 |
| `port` | `number` | ✅ | 端口号 |
| `username` | `string` | ✅ | 用户名 |
| `authType` | `'password' \| 'key'` | ✅ | 认证类型 |
| `password` | `string` | ❌ | 密码（加密存储） |
| `keyPath` | `string` | ❌ | 密钥路径 |
| `keyPassphrase` | `string` | ❌ | 密钥密码 |
| `status` | `'connected' \| 'connecting' \| 'disconnected'` | ✅ | 会话状态 |
| `groupId` | `string` | ❌ | 所属分组 ID |
| `createdAt` | `number` | ✅ | 创建时间 |
| `updatedAt` | `number` | ✅ | 更新时间 |

---

### SessionGroup - 会话分组类型

用于组织和分类会话。

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | ✅ | 分组 ID |
| `name` | `string` | ✅ | 分组名称 |
| `icon` | `string` | ❌ | 分组图标 |
| `order` | `number` | ✅ | 排序顺序 |
| `createdAt` | `number` | ✅ | 创建时间 |
| `updatedAt` | `number` | ✅ | 更新时间 |

---

### Tab - 标签页类型

管理终端标签页信息。

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | ✅ | 标签页 ID |
| `title` | `string` | ✅ | 标签页标题 |
| `sessionId` | `string` | ✅ | 关联的会话 ID |
| `terminalId` | `string` | ❌ | 终端进程 ID |

---

### CommandSnippet - 命令片段类型

保存常用命令片段。

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | ✅ | 片段 ID |
| `name` | `string` | ✅ | 片段名称 |
| `command` | `string` | ✅ | 命令内容 |
| `description` | `string` | ❌ | 描述 |
| `groupId` | `string` | ❌ | 所属分组 ID |
| `createdAt` | `number` | ✅ | 创建时间 |
| `updatedAt` | `number` | ✅ | 更新时间 |

---

### CommandSnippetGroup - 命令片段分组类型

组织命令片段的分组。

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | ✅ | 分组 ID |
| `name` | `string` | ✅ | 分组名称 |
| `order` | `number` | ✅ | 排序顺序 |
| `createdAt` | `number` | ✅ | 创建时间 |
| `updatedAt` | `number` | ✅ | 更新时间 |

---

### TerminalConfig - 终端配置类型

终端显示和行为配置。

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `fontSize` | `number` | ✅ | 字体大小 |
| `fontFamily` | `string` | ✅ | 字体类型 |
| `cursorStyle` | `'block' \| 'underline' \| 'bar'` | ✅ | 光标样式 |
| `cursorBlink` | `boolean` | ✅ | 光标闪烁 |
| `scrollback` | `number` | ✅ | 滚动缓冲区大小 |
| `terminalType` | `string` | ✅ | 终端类型 |

---

### AppConfig - 应用配置类型

应用全局配置。

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `theme` | `'dark' \| 'light'` | ✅ | 主题 |
| `language` | `string` | ✅ | 语言 |
| `terminal` | `TerminalConfig` | ✅ | 终端配置 |
| `connectionTimeout` | `number` | ✅ | 连接超时时间 |
| `keepaliveInterval` | `number` | ✅ | 心跳间隔 |
| `autoReconnect` | `boolean` | ✅ | 自动重连 |
| `reconnectAttempts` | `number` | ✅ | 重连次数 |

---

### ConnectionStatus - 连接状态类型

连接状态枚举。

```typescript
type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error'
```

| 值 | 说明 |
|------|------|
| `connected` | 已连接 |
| `connecting` | 连接中 |
| `disconnected` | 已断开 |
| `error` | 连接错误 |

---

### TerminalData - 终端数据类型

终端输入输出数据。

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `terminalId` | `string` | ✅ | 终端 ID |
| `data` | `string` | ✅ | 数据内容 |

---

### TerminalSize - 终端尺寸类型

终端窗口尺寸信息。

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `cols` | `number` | ✅ | 列数 |
| `rows` | `number` | ✅ | 行数 |
| `width` | `number` | ✅ | 宽度（像素） |
| `height` | `number` | ✅ | 高度（像素） |

---

### FileTransferItem - 文件传输项类型

SFTP 文件传输任务信息。

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | ✅ | 传输 ID |
| `localPath` | `string` | ✅ | 本地路径 |
| `remotePath` | `string` | ✅ | 远程路径 |
| `direction` | `'upload' \| 'download'` | ✅ | 传输方向 |
| `size` | `number` | ✅ | 文件大小 |
| `transferred` | `number` | ✅ | 已传输大小 |
| `status` | `'pending' \| 'transferring' \| 'completed' \| 'failed' \| 'cancelled'` | ✅ | 传输状态 |
| `speed` | `number` | ❌ | 传输速度 |
| `error` | `string` | ❌ | 错误信息 |

---

### HistoryRecord - 历史记录类型

命令执行历史记录。

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | ✅ | 记录 ID |
| `sessionId` | `string` | ✅ | 会话 ID |
| `command` | `string` | ✅ | 命令内容 |
| `executedAt` | `number` | ✅ | 执行时间 |

---

### LogRecord - 日志记录类型

终端日志记录。

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | ✅ | 日志 ID |
| `sessionId` | `string` | ✅ | 会话 ID |
| `content` | `string` | ✅ | 日志内容 |
| `type` | `'input' \| 'output' \| 'error' \| 'system'` | ✅ | 日志类型 |
| `timestamp` | `number` | ✅ | 时间戳 |

---

## 使用示例

```typescript
import type { Session, Tab, AppConfig } from '@shared/types'

// 创建会话
const session: Session = {
  id: 'session-1',
  name: 'Web Server',
  host: '192.168.1.100',
  port: 22,
  username: 'root',
  authType: 'password',
  password: 'encrypted-password',
  status: 'disconnected',
  createdAt: Date.now(),
  updatedAt: Date.now()
}

// 创建标签页
const tab: Tab = {
  id: 'tab-1',
  title: 'Web Server',
  sessionId: 'session-1'
}

// 应用配置
const config: AppConfig = {
  theme: 'dark',
  language: 'zh-CN',
  terminal: {
    fontSize: 14,
    fontFamily: 'Consolas',
    cursorStyle: 'block',
    cursorBlink: true,
    scrollback: 10000,
    terminalType: 'xterm-256color'
  },
  connectionTimeout: 30000,
  keepaliveInterval: 30000,
  autoReconnect: true,
  reconnectAttempts: 3
}
```

---

## 目录结构

```
types/
├── index.ts       # 类型定义入口
└── global.d.ts    # 全局类型声明
```
