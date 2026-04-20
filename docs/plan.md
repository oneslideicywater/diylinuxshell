# DIY-Linux-Shell 实现计划

## 1. 项目概述

本文档基于 [PRD.md](./PRD.md) 和 [ARCHITECTURE.md](./ARCHITECTURE.md) 制定详细的实现计划，按照功能优先级和依赖关系分阶段实施。

---

## 2. 实现阶段总览

| 阶段 | 名称 | 核心目标 | 预计工期 |
|------|------|----------|----------|
| Phase 0 | 项目初始化 | 搭建项目骨架、配置开发环境、配置打包、配置测试框架 | 1天 |
| Phase 1 | V1.0 MVP | 基础SSH连接、会话管理、多标签页、密码认证、核心测试 | 1周 |
| Phase 2 | V1.1 | 密钥认证、会话分组、SFTP 传输、主题配置、功能测试 | 1周 |
| Phase 3 | V1.3 AI 助理 | AI 对话交互、终端输出分析、智能文件操作、组合式任务、功能测试 | 2周 |
| Phase 4 | V1.2 高级功能 | 终端分屏、日志记录、历史记录、导入导出、功能测试 | 1周 |
| Phase 5 | V2.0 专业功能 | 跳板机、批量操作、脚本执行、功能测试 | 2周 |
| Phase 6 | 发布部署 | 多平台打包、CI/CD、代码签名、全量测试、发布 | 3天 |

---

## 3. 详细实现计划

### Phase 0: 项目初始化

#### 3.0.1 任务清单

| 序号 | 任务 | 产出物 | 依赖 |
|------|------|--------|------|
| 0.1 | 初始化Electron+Vue3项目 | package.json, electron.vite.config.ts | 无 |
| 0.2 | 配置TypeScript | tsconfig.json | 0.1 |
| 0.3 | 配置ESLint + Prettier | .eslintrc, .prettierrc | 0.1 |
| 0.4 | 创建目录结构 | src/main, src/renderer, src/shared | 0.1 |
| 0.5 | 配置Element Plus | main.ts | 0.1 |
| 0.6 | 创建基础类型定义 | src/shared/types/*.ts | 0.2 |
| 0.7 | 创建IPC通道常量 | src/shared/constants/ipc-channels.ts | 0.4 |
| 0.8 | 配置electron-builder打包 | electron-builder配置, 打包脚本 | 0.1 |
| 0.9 | 配置GitHub Actions CI/CD | .github/workflows/build.yml | 0.8 |
| 0.10 | 配置Vitest测试框架 | vitest.config.ts | 0.1 |
| 0.11 | 配置Playwright测试框架 | playwright.config.ts, e2e/helpers/*.ts | 0.1 |

#### 3.0.2 具体实现步骤

```
Step 1: 创建项目
├── npm create electron-vite@latest diy-linux-shell -- --template vue-ts
├── cd diy-linux-shell
└── npm install

Step 2: 安装核心依赖
├── npm install vue-router pinia element-plus
├── npm install xterm xterm-addon-fit xterm-addon-web-links
├── npm install ssh2 electron-store
└── npm install -D @types/ssh2

Step 3: 创建目录结构
src/
├── main/           # 主进程
│   ├── index.ts
│   ├── ipc/
│   └── services/
├── renderer/       # 渲染进程
│   └── src/
│       ├── components/
│       ├── stores/
│       ├── api/
│       └── styles/
└── shared/         # 共享代码
    ├── types/
    └── constants/
```

---

### Phase 1: V1.0 MVP 核心功能

#### 3.1.1 任务清单

| 序号 | 任务 | 产出物 | 依赖 |
|------|------|--------|------|
| 1.1 | 实现数据存储服务 | src/main/services/store.ts | Phase 0 |
| 1.2 | 实现加密服务 | src/main/services/crypto.ts | Phase 0 |
| 1.3 | 实现SSH管理器 | src/main/services/ssh-manager.ts | Phase 0 |
| 1.4 | 实现会话IPC处理 | src/main/ipc/session.ts | 1.1, 1.2 |
| 1.5 | 实现终端IPC处理 | src/main/ipc/terminal.ts | 1.3 |
| 1.6 | 创建渲染进程API封装 | src/renderer/src/api/*.ts | 1.4, 1.5 |
| 1.7 | 实现SessionStore | src/renderer/src/stores/session.ts | 1.6 |
| 1.8 | 实现TerminalStore | src/renderer/src/stores/terminal.ts | 1.6 |
| 1.9 | 实现布局组件 | AppLayout.vue, Sidebar.vue, Header.vue | 1.7 |
| 1.10 | 实现会话列表组件 | SessionList.vue, SessionItem.vue | 1.7, 1.9 |
| 1.11 | 实现会话表单组件 | SessionForm.vue | 1.7, 1.9 |
| 1.12 | 实现终端组件 | XTerminal.vue | 1.8 |
| 1.13 | 实现标签页组件 | TerminalTabs.vue, TerminalTab.vue | 1.12 |
| 1.14 | 集成测试与调试 | - | 1.10-1.13 |
| 1.15 | 编写CryptoService单元测试 | crypto.test.ts | 1.2 |
| 1.16 | 编写StoreService单元测试 | store.test.ts | 1.1 |
| 1.17 | 编写SSHManager单元测试 | ssh-manager.test.ts | 1.3 |
| 1.18 | 编写SessionStore单元测试 | session.test.ts | 1.7 |
| 1.19 | 编写TerminalStore单元测试 | terminal.test.ts | 1.8 |
| 1.20 | 编写会话IPC集成测试 | session.integration.test.ts | 1.4 |
| 1.21 | 编写终端IPC集成测试 | terminal.integration.test.ts | 1.5 |
| 1.22 | 编写连接流程E2E测试 | connection.e2e.spec.ts | 1.14 |
| 1.23 | 编写Vim编辑器E2E测试 | vim.e2e.spec.ts | 1.14 |
| 1.24 | 编写多标签页E2E测试 | tabs.e2e.spec.ts | 1.13 |

#### 3.1.2 模块实现顺序

```
┌─────────────────────────────────────────────────────────────────┐
│                        Phase 1 实现顺序                          │
│                                                                  │
│  1. 主进程服务层                                                 │
│     ├── 1.1 StoreService (electron-store封装)                     │
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
│  6. 集成测试                                                     │
│     └── 1.14 功能测试与Bug修复                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.1.3 验收标准

- [ ] 能够创建、编辑、删除会话配置
- [ ] 能够通过密码认证连接SSH服务器
- [ ] 终端能够正确显示输出内容
- [ ] 多标签页功能正常工作
- [ ] 切换标签页时终端内容正确切换（每个标签页独立终端实例）
- [ ] vi/vim编辑器正常使用

---

### Phase 2: V1.1 增强功能

#### 3.2.1 任务清单

| 序号 | 任务 | 产出物 | 依赖 |
|------|------|--------|------|
| 2.1 | 实现密钥认证 | ssh-manager.ts 扩展 | Phase 1 |
| 2.2 | 实现密钥管理 | KeyManager.vue | 2.1 |
| 2.3 | 实现会话分组基础功能 | SessionList.vue 扩展、SessionGroupStore | Phase 1 |
| 2.4 | 实现会话分组右键菜单 | context-menu 组件扩展 | 2.3 |
| 2.5 | 实现会话移动到分组 | SessionItem.vue 扩展 | 2.3 |
| 2.6 | 实现分组展开/折叠 | SessionGroup.vue | 2.3 |
| 2.7 | 实现分组删除二次确认 | confirm-dialog 组件 | 2.3 |
| 2.8 | 实现拖拽会话入组 | drag-and-drop 功能 | 2.3 |
| 2.9 | 实现批量会话归组 | 多选功能、批量操作 | 2.3 |
| 2.10 | 实现分组图标选择 | IconPicker.vue | 2.3 |
| 2.11 | 实现分组会话计数 | SessionGroup.vue 扩展 | 2.3 |
| 2.12 | 实现命令片段存储 | store.ts 扩展 | Phase 1 |
| 2.13 | 实现命令片段管理 UI | CommandSnippet.vue | 2.12 |
| 2.14 | 实现主题配置 | themes/*.css | Phase 1 |
| 2.15 | 实现设置页面 | Settings.vue | 2.14 |
| 2.16 | 实现 ConfigStore | config.ts | 2.14 |
| 2.17 | 编写会话分组 E2E 测试 | session-group.e2e.spec.ts | 2.3-2.11 |
| 2.18 | 编写拖拽功能 E2E 测试 | drag-drop.e2e.spec.ts | 2.8 |
| 2.19 | 编写批量操作 E2E 测试 | batch-operations.e2e.spec.ts | 2.9 |
| 2.20 | 编写密钥认证集成测试 | key-auth.integration.test.ts | 2.1 |
| 2.21 | 编写命令片段单元测试 | command.test.ts | 2.12 |
| 2.22 | 编写 ConfigStore 单元测试 | config.test.ts | 2.16 |
| 2.23 | 编写命令片段 E2E 测试 | command.e2e.spec.ts | 2.13 |
| 2.24 | 编写主题切换 E2E 测试 | theme.e2e.spec.ts | 2.14 |

#### 3.2.2 模块实现顺序

```
Phase 2 实现顺序:

1. 认证增强
   └── 2.1-2.2 密钥认证功能

2. 会话分组功能（核心）
   ├── 2.3 基础功能（数据结构、Store）
   ├── 2.4 右键菜单（新建、编辑、删除分组）
   ├── 2.5 会话移动（右键菜单、子菜单）
   ├── 2.6 展开/折叠（UI 交互）
   ├── 2.7 删除确认（二次确认弹窗）
   ├── 2.8 拖拽归组（拖拽功能）
   ├── 2.9 批量操作（多选、批量移动）
   ├── 2.10 图标选择（个性化）
   └── 2.11 会话计数（UI 优化）

3. 命令片段功能
   └── 2.12-2.13 命令片段存储与管理

4. 主题与配置
   └── 2.14-2.16 主题切换与设置页面

5. 测试验证
   └── 2.17-2.24 功能测试与 E2E 验证
```

#### 3.2.3 验收标准

- [ ] 能够使用密钥文件进行 SSH 认证
- [ ] 能够创建和管理 SSH 密钥对
- [ ] 能够创建、编辑、删除会话分组
- [ ] 删除分组时，若分组包含会话，弹出二次确认
- [ ] 能够将会话移动到指定分组（右键菜单）
- [ ] 支持拖拽会话到分组内
- [ ] 支持批量选择会话并移动到分组
- [ ] 分组支持展开/折叠
- [ ] 分组头部显示会话数量
- [ ] 支持为分组选择不同图标
- [ ] 右键菜单层级正确（空白区域、分组、会话）
- [ ] 删除分组后，会话自动移至未分组
- [ ] 所有分组操作有 Tooltip 提示
- [ ] 会话能够按分组显示和管理
- [ ] 命令片段功能正常工作
- [ ] 主题切换功能正常

### Phase 3: V1.3 AI 助理模块

#### 3.3 任务清单

| 序号 | 任务 | 产出物 | 依赖 |
|------|------|--------|------|
| 3.1 | 实现 AI 服务基础架构 | src/main/services/ai-service.ts | Phase 2 |
| 3.2 | 实现 LLM API 客户端 | src/main/services/llm-client.ts | 3.1 |
| 3.3 | 实现对话上下文管理 | src/main/services/context-manager.ts | 3.1 |
| 3.4 | 实现敏感信息过滤器 | src/main/services/sensitive-filter.ts | 3.1 |
| 3.5 | 实现 AI IPC 处理器 | src/main/ipc/ai-assistant.ts | 3.2, 3.3, 3.4 |
| 3.6 | 实现终端输出捕获服务 | src/main/services/terminal-capture.ts | Phase 1 |
| 3.7 | 实现输出分析引擎 | src/main/services/output-analyzer.ts | 3.6 |
| 3.8 | 实现意图识别服务 | src/main/services/intent-recognizer.ts | 3.2 |
| 3.9 | 实现任务执行引擎 | src/main/services/task-engine.ts | 3.8 |
| 3.10 | 创建渲染进程 AI API 封装 | src/renderer/src/api/ai-assistant.ts | 3.5 |
| 3.11 | 实现 AI Store 状态管理 | src/renderer/src/stores/ai-assistant.ts | 3.10 |
| 3.12 | 实现 AI 对话组件 | components/ai/AIChatPanel.vue | 3.11 |
| 3.13 | 实现消息气泡组件 | components/ai/MessageBubble.vue | 3.12 |
| 3.14 | 实现输入框组件 | components/ai/AIInputBox.vue | 3.12 |
| 3.15 | 实现 Markdown 渲染组件 | components/ai/MarkdownRenderer.vue | 3.13 |
| 3.16 | 集成终端输出分析到 XTerminal | XTerminal.vue 扩展 | 3.6, 3.7 |
| 3.17 | 实现 AI 设置页面 | components/ai/AISettings.vue | 3.2 |
| 3.18 | 实现 API Key 配置管理 | AISettings.vue 扩展 | 3.17 |
| 3.19 | 编写 AI 服务单元测试 | ai-service.test.ts | 3.1 |
| 3.20 | 编写 LLM 客户端单元测试 | llm-client.test.ts | 3.2 |
| 3.21 | 编写意图识别单元测试 | intent-recognizer.test.ts | 3.8 |
| 3.22 | 编写敏感信息过滤测试 | sensitive-filter.test.ts | 3.4 |
| 3.23 | 编写任务执行引擎测试 | task-engine.test.ts | 3.9 |
| 3.24 | 编写 AI 对话 E2E 测试 | ai-chat.e2e.spec.ts | 3.12-3.15 |
| 3.25 | 编写终端分析 E2E 测试 | terminal-analysis.e2e.spec.ts | 3.16 |
| 3.26 | 编写智能文件操作 E2E 测试 | ai-file-operation.e2e.spec.ts | 3.9 |
| 3.27 | 编写组合式任务 E2E 测试 | ai-composite-task.e2e.spec.ts | 3.9 |

#### 3.4 模块实现顺序

```
Phase 3 实现顺序:

1. 基础架构层（AI 核心服务）
   ├── 3.1 AI 服务基础架构（接口定义、错误处理）
   ├── 3.2 LLM API 客户端（OpenAI/本地模型适配）
   ├── 3.3 对话上下文管理（历史记录、会话窗口）
   └── 3.4 敏感信息过滤器（密码、密钥脱敏）

2. 功能实现层（业务逻辑）
   ├── 3.5 AI IPC 处理器（主进程通信接口）
   ├── 3.6 终端输出捕获服务（实时数据采集）
   ├── 3.7 输出分析引擎（服务器状态解析）
   ├── 3.8 意图识别服务（自然语言理解）
   └── 3.9 任务执行引擎（多步骤任务编排）

3. 前端展示层（UI 组件）
   ├── 3.10-3.11 API 层和状态管理
   ├── 3.12-3.15 AI 对话界面组件
   ├── 3.16 终端集成（分析结果展示）
   └── 3.17-3.18 设置页面（API Key 管理）

4. 测试验证层
   └── 3.19-3.27 单元测试、集成测试、E2E 测试
```

#### 3.5 详细设计说明

**AI 服务架构**

```typescript
// AI 服务核心接口
interface IAIService {
  // 对话交互
  chat(message: string, sessionId: string): AsyncIterable<AIResponse>;
  
  // 终端输出分析
  analyzeTerminalOutput(output: string): Promise<AnalysisResult>;
  
  // 意图识别
  recognizeIntent(input: string): Promise<IntentResult>;
  
  // 任务执行
  executeTask(task: CompositeTask): AsyncIterable<TaskProgress>;
}

// LLM 客户端配置
interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'local';
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

// 对话上下文
interface ConversationContext {
  sessionId: string;
  messages: ChatMessage[];
  systemPrompt: string;
  currentSessionId?: string;  // 当前关联的 SSH 会话
  tokenCount: number;
}
```

**意图类型定义**

```typescript
enum IntentType {
  // 终端分析类
  ANALYZE_SERVER_STATUS = 'analyze_server_status',
  ANALYZE_OUTPUT = 'analyze_output',
  
  // 文件操作类
  FILE_DOWNLOAD = 'file_download',
  FILE_UPLOAD = 'file_upload',
  FILE_LIST = 'file_list',
  FILE_EDIT = 'file_edit',
  
  // 会话管理类
  CREATE_SESSION = 'create_session',
  LIST_SESSIONS = 'list_sessions',
  
  // 任务执行类
  EXECUTE_COMMAND = 'execute_command',
  RUN_COMPOSITE_TASK = 'run_composite_task',
  
  // 通用问答
  GENERAL_QUESTION = 'general_question'
}

// 组合式任务定义
interface CompositeTask {
  id: string;
  name: string;
  description: string;
  steps: TaskStep[];
  template?: boolean;  // 是否为模板任务
}

interface TaskStep {
  id: string;
  type: 'command' | 'file_operation' | 'analysis' | 'user_confirm';
  description: string;
  config: CommandStepConfig | FileOperationConfig | AnalysisConfig;
  dependsOn?: string[];  // 依赖的前置步骤
}
```

**终端输出分析流程**

```
┌─────────────────────────────────────────────────────────────┐
│                    终端输出分析流程                          │
│                                                              │
│  1. 数据捕获                                                  │
│     TerminalCapture 监听终端输出流                             │
│              │                                                │
│              ▼                                                │
│  2. 数据预处理                                                 │
│     ├─ 过滤 ANSI 转义序列                                     │
│     ├─ 提取关键命令输出                                       │
│     └─ 缓存最近的 N 行输出                                    │
│              │                                                │
│              ▼                                                │
│  3. 智能分析                                                   │
│     OutputAnalyzer 调用 LLM 分析                               │
│     ├─ 识别服务器资源信息 (CPU/内存/磁盘)                      │
│     ├─ 识别运行状态 (服务/进程)                                │
│     ├─ 识别错误和警告                                         │
│     └─ 生成结构化摘要                                         │
│              │                                                │
│              ▼                                                │
│  4. 结果展示                                                   │
│     通过 IPC 发送到渲染进程                                   │
│     AIChatPanel 展示分析结果                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**组合式任务执行流程**

```
┌─────────────────────────────────────────────────────────────┐
│                  组合式任务执行流程                           │
│                                                              │
│  用户输入："帮我做一次系统巡检"                               │
│              │                                                │
│              ▼                                                │
│  1. 意图识别                                                   │
│     IntentRecognizer 识别为 RUN_COMPOSITE_TASK                │
│              │                                                │
│              ▼                                                │
│  2. 任务匹配/生成                                              │
│     匹配预置模板：系统巡检模板                                │
│     或动态生成任务步骤                                        │
│              │                                                │
│              ▼                                                │
│  3. 任务拆解                                                   │
│     Step 1: 执行 uptime, free -h, df -h                      │
│     Step 2: 分析系统资源使用情况                              │
│     Step 3: 检查主要服务状态 (systemctl status)               │
│     Step 4: 生成巡检报告                                     │
│              │                                                │
│              ▼                                                │
│  4. 逐步执行                                                   │
│     TaskEngine 按依赖关系执行                                 │
│     ├─ 发送命令到终端                                        │
│     ├─ 捕获输出                                              │
│     ├─ 实时反馈进度                                          │
│     └─ 需确认时暂停等待用户                                  │
│              │                                                │
│              ▼                                                │
│  5. 结果汇总                                                   │
│     生成完整报告，展示给用户                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 3.6 技术要点

**LLM API 集成**

```typescript
// 流式响应处理
async function* streamChat(
  messages: ChatMessage[],
  config: LLMConfig
): AsyncIterable<string> {
  const response = await fetch(config.apiEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
      temperature: config.temperature
    })
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    // 解析 SSE 格式数据
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        yield data.choices[0].delta.content || '';
      }
    }
  }
}
```

**敏感信息过滤**

```typescript
class SensitiveFilter {
  private patterns = [
    /password[:\s]+['"]?[\w@#$%^&*]+['"]?/gi,
    /api[_-]?key[:\s]+['"][\w-]+['"]/gi,
    /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA )?PRIVATE KEY-----/gi
  ];
  
  filter(content: string): string {
    let filtered = content;
    for (const pattern of this.patterns) {
      filtered = filtered.replace(pattern, '[已隐藏敏感信息]');
    }
    return filtered;
  }
}
```

**上下文窗口管理**

```typescript
class ContextManager {
  private maxTokens: number = 8000;
  
  trimToFit(context: ConversationContext): ConversationContext {
    while (this.estimateTokens(context.messages) > this.maxTokens) {
      // 保留系统提示，移除最早的消息
      context.messages = [
        context.messages[0],
        ...context.messages.slice(2)
      ];
    }
    return context;
  }
  
  private estimateTokens(messages: ChatMessage[]): number {
    // 粗略估算 token 数（约 4 字符/token）
    return JSON.stringify(messages).length / 4;
  }
}
```

#### 3.7 验收标准

- [ ] AI 助理能够通过对话框与用户进行自然语言交互
- [ ] 支持流式输出，响应及时无明显延迟
- [ ] 能够正确识别用户意图（文件操作、会话管理、信息查询等）
- [ ] 能够实时捕获并分析终端输出内容
- [ ] 分析结果准确，能够正确提取服务器状态信息
- [ ] 敏感信息过滤机制正常工作，密码、API Key 等不会被发送到 LLM
- [ ] 能够根据自然语言指令执行 SFTP 文件操作（上传/下载/列表）
- [ ] 文件操作前需要用户确认，防止误操作
- [ ] 能够通过对话快速创建 SSH 会话配置
- [ ] 组合式任务能够正确拆解并按步骤执行
- [ ] 任务执行过程有进度反馈
- [ ] 支持多轮对话，能够记住上下文
- [ ] 上下文窗口管理正常，超长对话自动裁剪历史
- [ ] 支持 OpenAI API 及兼容接口配置
- [ ] API Key 安全存储，加密保存
- [ ] 网络异常时有合理的错误提示
- [ ] LLM 服务不可用时降级处理，不影响其他功能使用

---

### Phase 4: V1.2 高级功能

#### 4.1 任务清单

| 序号 | 任务 | 产出物 | 依赖 |
|------|------|--------|------|
| 4.1 | 实现终端分屏 | SplitPane.vue | Phase 2 |
| 4.2 | 实现日志记录服务 | logger.ts | Phase 1 |
| 4.3 | 实现终端日志记录 | XTerminal.vue 扩展 | 4.2 |
| 4.4 | 实现命令历史记录 | store.ts 扩展 | Phase 1 |
| 4.5 | 实现历史记录UI | HistoryPanel.vue | 4.4 |
| 4.6 | 实现会话导入导出 | SessionExport.vue | Phase 1 |
| 4.7 | 实现配置备份恢复 | Settings.vue 扩展 | Phase 2 |
| 4.8 | 编写日志服务单元测试 | logger.test.ts | 4.2 |
| 4.9 | 编写历史记录单元测试 | history.test.ts | 4.4 |
| 4.10 | 编写分屏E2E测试 | split-pane.e2e.spec.ts | 4.1 |
| 4.11 | 编写导入导出E2E测试 | import-export.e2e.spec.ts | 4.6 |

#### 4.2 验收标准

- [ ] 终端分屏功能正常
- [ ] 日志能够正确记录和查看
- [ ] 命令历史记录功能正常
- [ ] 会话配置能够导入导出

---

### Phase 5: V2.0 专业功能

#### 5.1 任务清单

| 序号 | 任务 | 产出物 | 依赖 |
|------|------|--------|------|
| 5.1 | 实现SFTP服务 | sftp-manager.ts | Phase 1 |
| 5.2 | 实现SFTP文件浏览器 | SftpBrowser.vue | 5.1 |
| 5.3 | 实现文件上传下载 | FileTransfer.vue | 5.1 |
| 5.4 | 实现跳板机连接 | ssh-manager.ts 扩展 | Phase 1 |
| 5.5 | 实现批量操作 | BatchOperation.vue | Phase 1 |
| 5.6 | 实现脚本执行 | ScriptRunner.vue | Phase 1 |
| 5.7 | 编写SFTP管理器单元测试 | sftp-manager.test.ts | 5.1 |
| 5.8 | 编写SFTP集成测试 | sftp.integration.test.ts | 5.1 |
| 5.9 | 编写跳板机连接集成测试 | jump-host.integration.test.ts | 5.4 |
| 5.10 | 编写文件传输E2E测试 | file-transfer.e2e.spec.ts | 5.3 |
| 5.11 | 编写批量操作E2E测试 | batch-operation.e2e.spec.ts | 5.5 |

#### 5.2 验收标准

- [ ] SFTP文件传输功能正常
- [ ] 跳板机连接功能正常
- [ ] 批量操作功能正常
- [ ] 脚本执行功能正常

---

## 4. 文件实现清单

### 4.1 主进程文件 (src/main/)

| 文件路径 | 功能描述 | Phase |
|----------|----------|-------|
| index.ts | 主进程入口，窗口创建 | 0 |
| ipc/index.ts | IPC处理器注册 | 1 |
| ipc/session.ts | 会话相关IPC处理 | 1 |
| ipc/terminal.ts | 终端相关IPC处理 | 1 |
| ipc/config.ts | 配置相关IPC处理 | 2 |
| ipc/command.ts | 命令片段IPC处理 | 2 |
| ipc/ai-assistant.ts | AI 助理IPC处理 | 3 |
| services/store.ts | electron-store数据存储服务 | 1 |
| services/ssh-manager.ts | SSH连接管理器 | 1 |
| services/crypto.ts | 加密服务 | 1 |
| services/logger.ts | 日志服务 | 3 |
| services/sftp-manager.ts | SFTP管理器 | 4 |
| services/ai-service.ts | AI 服务基础架构 | 3 |
| services/llm-client.ts | LLM API 客户端 | 3 |
| services/context-manager.ts | 对话上下文管理 | 3 |
| services/sensitive-filter.ts | 敏感信息过滤器 | 3 |
| services/terminal-capture.ts | 终端输出捕获服务 | 3 |
| services/output-analyzer.ts | 输出分析引擎 | 3 |
| services/intent-recognizer.ts | 意图识别服务 | 3 |
| services/task-engine.ts | 任务执行引擎 | 3 |

### 4.2 渲染进程文件 (src/renderer/src/)

| 文件路径 | 功能描述 | Phase |
|----------|----------|-------|
| main.ts | Vue应用入口 | 0 |
| App.vue | 根组件 | 1 |
| components/layout/AppLayout.vue | 应用布局 | 1 |
| components/layout/Sidebar.vue | 左侧边栏 | 1 |
| components/layout/Header.vue | 顶部栏 | 1 |
| components/session/SessionList.vue | 会话列表 | 1 |
| components/session/SessionItem.vue | 会话项 | 1 |
| components/session/SessionForm.vue | 会话表单 | 1 |
| components/session/SessionGroup.vue | 会话分组 | 2 |
| components/terminal/XTerminal.vue | 终端组件 | 1 |
| components/terminal/TerminalTabs.vue | 标签页栏 | 1 |
| components/terminal/TerminalTab.vue | 单个标签 | 1 |
| components/terminal/SplitPane.vue | 分屏组件 | 3 |
| components/command/CommandList.vue | 命令片段列表 | 2 |
| components/command/CommandForm.vue | 命令片段表单 | 2 |
| components/settings/SettingsDialog.vue | 设置对话框 | 2 |
| components/sftp/SftpBrowser.vue | SFTP浏览器 | 4 |
| components/sftp/FileTransfer.vue | 文件传输 | 4 |
| components/ai/AIChatPanel.vue | AI 对话面板 | 3 |
| components/ai/MessageBubble.vue | 消息气泡组件 | 3 |
| components/ai/AIInputBox.vue | AI 输入框组件 | 3 |
| components/ai/MarkdownRenderer.vue | Markdown 渲染组件 | 3 |
| components/ai/AISettings.vue | AI 设置页面 | 3 |
| stores/session.ts | 会话状态管理 | 1 |
| stores/terminal.ts | 终端状态管理 | 1 |
| stores/config.ts | 配置状态管理 | 2 |
| stores/command.ts | 命令片段状态 | 2 |
| stores/ai-assistant.ts | AI 助理状态管理 | 3 |
| api/session.ts | 会话API | 1 |
| api/terminal.ts | 终端API | 1 |
| api/config.ts | 配置API | 2 |
| api/command.ts | 命令片段API | 2 |
| api/ai-assistant.ts | AI 助理API | 3 |
| styles/variables.css | CSS变量 | 1 |
| styles/global.css | 全局样式 | 1 |
| styles/themes/dark.css | 暗色主题 | 2 |
| styles/themes/light.css | 亮色主题 | 2 |

### 4.3 共享文件 (src/shared/)

| 文件路径 | 功能描述 | Phase |
|----------|----------|-------|
| types/session.ts | 会话类型定义 | 0 |
| types/terminal.ts | 终端类型定义 | 0 |
| types/config.ts | 配置类型定义 | 0 |
| types/command.ts | 命令片段类型定义 | 2 |
| types/ai-assistant.ts | AI 助理类型定义 | 3 |
| constants/ipc-channels.ts | IPC通道常量 | 0 |

### 4.4 打包与CI/CD文件

| 文件路径 | 功能描述 | Phase |
|----------|----------|-------|
| .github/workflows/build.yml | GitHub Actions 多平台构建配置 | 0 |
| resources/icons/icon.ico | Windows应用图标 | 0 |
| resources/icons/icon.png | Linux应用图标 | 0 |
| resources/icons/icon.icns | macOS应用图标 | 0 |
| resources/icons/tray.png | 系统托盘图标 | 0 |

### 4.5 测试文件

| 文件路径 | 功能描述 | Phase |
|----------|----------|-------|
| vitest.config.ts | Vitest单元测试配置 | 0 |
| vitest.integration.config.ts | Vitest集成测试配置 | 0 |
| playwright.config.ts | Playwright E2E测试配置 | 0 |
| e2e/helpers/electron-app.ts | Electron应用启动/关闭辅助工具 | 0 |
| e2e/helpers/mock-server.ts | Mock SSH服务器 | 0 |
| e2e/helpers/assertions.ts | 自定义断言 | 0 |
| src/main/services/__tests__/crypto.test.ts | 加密服务单元测试 | 1 |
| src/main/services/__tests__/store.test.ts | 数据存储服务单元测试 | 1 |
| src/main/services/__tests__/ssh-manager.test.ts | SSH管理器单元测试 | 1 |
| src/main/ipc/__tests__/session.integration.test.ts | 会话IPC集成测试 | 1 |
| src/main/ipc/__tests__/terminal.integration.test.ts | 终端IPC集成测试 | 1 |
| src/renderer/src/stores/__tests__/session.test.ts | 会话Store单元测试 | 1 |
| src/renderer/src/stores/__tests__/terminal.test.ts | 终端Store单元测试 | 1 |
| e2e/connection.e2e.spec.ts | 连接流程E2E测试 | 1 |
| e2e/vim.e2e.spec.ts | Vim编辑器E2E测试 | 1 |
| e2e/tabs.e2e.spec.ts | 多标签页E2E测试 | 1 |
| src/main/ipc/__tests__/key-auth.integration.test.ts | 密钥认证集成测试 | 2 |
| src/renderer/src/stores/__tests__/config.test.ts | 配置Store单元测试 | 2 |
| e2e/command.e2e.spec.ts | 命令片段E2E测试 | 2 |
| e2e/theme.e2e.spec.ts | 主题切换E2E测试 | 2 |
| src/main/services/__tests__/logger.test.ts | 日志服务单元测试 | 3 |
| e2e/split-pane.e2e.spec.ts | 分屏E2E测试 | 3 |
| e2e/import-export.e2e.spec.ts | 导入导出E2E测试 | 3 |
| src/main/services/__tests__/sftp-manager.test.ts | SFTP管理器单元测试 | 4 |
| e2e/file-transfer.e2e.spec.ts | 文件传输E2E测试 | 4 |
| e2e/batch-operation.e2e.spec.ts | 批量操作E2E测试 | 4 |

---

## 5. 技术要点

### 5.1 SSH连接实现要点

```typescript
// SSH连接核心流程
async function connect(config: SSHConfig): Promise<SSHConnection> {
  // 1. 创建SSH客户端
  const client = new Client();
  
  // 2. 配置连接参数
  const connectionConfig = {
    host: config.host,
    port: config.port,
    username: config.username,
    // 密码或密钥认证
    ...(config.authType === 'password' 
      ? { password: decrypt(config.password) }
      : { privateKey: fs.readFileSync(config.privateKeyPath) }
    )
  };
  
  // 3. 建立连接
  await new Promise((resolve, reject) => {
    client.connect(connectionConfig);
    client.on('ready', resolve);
    client.on('error', reject);
  });
  
  // 4. 创建Shell通道
  const stream = await new Promise((resolve, reject) => {
    client.shell((err, stream) => {
      if (err) reject(err);
      else resolve(stream);
    });
  });
  
  return { client, stream };
}
```

### 5.2 终端数据流实现要点

```typescript
// 终端数据流处理
class TerminalDataHandler {
  // SSH数据 -> 终端显示
  stream.on('data', (data: Buffer) => {
    // 通过IPC发送到渲染进程
    mainWindow.webContents.send('terminal:data', {
      sessionId,
      data: data.toString()
    });
  });
  
  // 终端输入 -> SSH发送
  ipcMain.on('terminal:write', (event, { sessionId, data }) => {
    const connection = connections.get(sessionId);
    connection.stream.write(data);
  });
  
  // 终端大小调整
  ipcMain.on('terminal:resize', (event, { sessionId, cols, rows }) => {
    const connection = connections.get(sessionId);
    connection.stream.setWindow(rows, cols);
  });
}
```

### 5.3 xterm.js集成要点

```typescript
// xterm.js 配置
const terminal = new Terminal({
  fontSize: 14,
  fontFamily: 'Consolas, Monaco, monospace',
  theme: darkTheme,
  cursorBlink: true,
  cursorStyle: 'block',
  scrollback: 10000,
  allowProposedApi: true
});

// 添加插件
terminal.loadAddon(new FitAddon());
terminal.loadAddon(new WebLinksAddon());

// 处理输入
terminal.onData((data) => {
  // 发送到主进程
  window.electronAPI.terminalWrite(sessionId, data);
});

// 接收输出
window.electronAPI.onTerminalData((data) => {
  terminal.write(data);
});
```

---

## 6. 自动化测试计划

### 6.1 测试策略总览

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
│  测试覆盖率目标:                                                 │
│  • 单元测试: 80%+                                                │
│  • 集成测试: 核心流程100%覆盖                                    │
│  • E2E测试: 主要用户场景100%覆盖                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 单元测试

#### 6.2.1 测试范围

| 模块 | 测试内容 | 测试文件 | 工具 |
|------|----------|----------|------|
| CryptoService | 加密解密功能、密钥生成 | crypto.test.ts | Vitest |
| StoreService | CRUD操作、JSON存储 | store.test.ts | Vitest |
| SSHManager | 连接管理逻辑、状态管理 | ssh-manager.test.ts | Vitest + Mock |
| SessionStore | 状态管理逻辑、异步操作 | session.test.ts | Vitest |
| TerminalStore | 状态管理逻辑、标签页管理 | terminal.test.ts | Vitest |
| ConfigStore | 配置读写、主题切换 | config.test.ts | Vitest |
| 工具函数 | 通用工具方法 | helpers.test.ts | Vitest |

#### 6.2.2 单元测试配置

创建 `vitest.config.ts`：

```typescript
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: ['src/main/**/*', 'node_modules', 'out'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/main/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer/src')
    }
  }
})
```

#### 6.2.3 单元测试示例

```typescript
// src/main/services/__tests__/crypto.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { CryptoService } from '../crypto'

describe('CryptoService', () => {
  let cryptoService: CryptoService

  beforeEach(() => {
    cryptoService = new CryptoService()
  })

  it('should encrypt and decrypt data correctly', () => {
    const plaintext = 'my-secret-password'
    const encrypted = cryptoService.encrypt(plaintext)
    
    expect(encrypted).not.toBe(plaintext)
    expect(cryptoService.decrypt(encrypted)).toBe(plaintext)
  })

  it('should generate different ciphertext for same input', () => {
    const plaintext = 'my-secret-password'
    const encrypted1 = cryptoService.encrypt(plaintext)
    const encrypted2 = cryptoService.encrypt(plaintext)
    
    expect(encrypted1).not.toBe(encrypted2)
  })

  it('should generate valid key pair', () => {
    const keyPair = cryptoService.generateKeyPair()
    
    expect(keyPair.publicKey).toBeDefined()
    expect(keyPair.privateKey).toBeDefined()
    expect(keyPair.publicKey).not.toBe(keyPair.privateKey)
  })
})
```

### 6.3 集成测试

#### 6.3.1 测试范围

| 场景 | 测试内容 | 测试文件 |
|------|----------|----------|
| 会话管理 | 创建、编辑、删除、列表、分组 | session.integration.test.ts |
| SSH连接 | 连接、断开、重连、心跳 | ssh.integration.test.ts |
| 终端交互 | 输入、输出、调整大小、数据流 | terminal.integration.test.ts |
| IPC通信 | 主进程与渲染进程通信 | ipc.integration.test.ts |
| 数据持久化 | 数据读写、配置保存 | store.integration.test.ts |

#### 6.3.2 集成测试配置

```typescript
// vitest.integration.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{integration}.test.{js,ts}'],
    testTimeout: 30000,
    hookTimeout: 30000
  }
})
```

#### 6.3.3 集成测试示例

```typescript
// src/main/ipc/__tests__/session.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { ipcMain, ipcRenderer } from 'electron'
import { registerSessionHandlers } from '../session'
import { StoreService } from '../../services/store'

describe('Session IPC Integration', () => {
  let db: DatabaseService

  beforeAll(async () => {
    db = new DatabaseService(':memory:')
    db.init()
    registerSessionHandlers(db)
  })

  afterAll(() => {
    db.close()
  })

  it('should create session via IPC', async () => {
    const sessionData = {
      name: 'test-server',
      host: '192.168.1.100',
      port: 22,
      username: 'root',
      authType: 'password',
      password: 'test123'
    }

    const result = await ipcRenderer.invoke('session:create', sessionData)
    
    expect(result.id).toBeDefined()
    expect(result.name).toBe(sessionData.name)
    expect(result.host).toBe(sessionData.host)
  })

  it('should list sessions via IPC', async () => {
    const sessions = await ipcRenderer.invoke('session:list')
    
    expect(Array.isArray(sessions)).toBe(true)
    expect(sessions.length).toBeGreaterThan(0)
  })
})
```

### 6.4 E2E测试

#### 6.4.1 测试范围

| 场景 | 测试步骤 | 测试文件 |
|------|----------|----------|
| 完整连接流程 | 创建会话 → 连接 → 执行命令 → 断开 | connection.e2e.spec.ts |
| vi编辑器测试 | 打开vi → 编辑文件 → 保存退出 | vim.e2e.spec.ts |
| 多标签页测试 | 打开多个标签 → 切换 → 关闭 | tabs.e2e.spec.ts |
| 会话管理 | 创建 → 编辑 → 删除 → 搜索 | session.e2e.spec.ts |
| 命令片段 | 创建片段 → 插入命令 → 执行 | command.e2e.spec.ts |
| 主题切换 | 切换暗色主题 → 验证样式 → 切换亮色主题 | theme.e2e.spec.ts |

#### 6.4.2 Playwright配置

创建 `playwright.config.ts`：

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 60000,
  
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry'
  },

  projects: [
    {
      name: 'electron',
      use: { 
        ...devices['Desktop Chrome']
      }
    }
  ]
})
```

#### 6.4.3 E2E测试辅助工具

创建 `e2e/helpers/electron-app.ts`：

```typescript
import { _electron as electron, ElectronApplication, Page } from '@playwright/test'
import path from 'path'

let electronApp: ElectronApplication | null = null
let page: Page | null = null

export async function startApp(): Promise<{ app: ElectronApplication; page: Page }> {
  if (electronApp && page) {
    return { app: electronApp, page }
  }

  electronApp = await electron.launch({
    args: [path.join(__dirname, '../../out/main/index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  })

  page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  return { app: electronApp, page }
}

export async function closeApp(): Promise<void> {
  if (electronApp) {
    await electronApp.close()
    electronApp = null
    page = null
  }
}

export async function waitForElement(selector: string, timeout = 10000): Promise<void> {
  if (!page) throw new Error('App not started')
  await page.waitForSelector(selector, { timeout })
}

export async function clickElement(selector: string): Promise<void> {
  if (!page) throw new Error('App not started')
  await page.click(selector)
}

export async function fillInput(selector: string, value: string): Promise<void> {
  if (!page) throw new Error('App not started')
  await page.fill(selector, value)
}
```

#### 6.4.4 E2E测试示例

```typescript
// e2e/connection.e2e.spec.ts
import { test, expect, beforeAll, afterAll } from '@playwright/test'
import { startApp, closeApp, waitForElement, clickElement, fillInput } from './helpers/electron-app'
import type { ElectronApplication, Page } from '@playwright/test'

let app: ElectronApplication
let page: Page

test.describe('SSH Connection Flow', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
  })

  afterAll(async () => {
    await closeApp()
  })

  test('should create new session', async () => {
    // 点击新建会话按钮
    await clickElement('[data-testid="new-session-btn"]')
    
    // 等待表单出现
    await waitForElement('[data-testid="session-form"]')
    
    // 填写会话信息
    await fillInput('[data-testid="session-name"]', 'test-server')
    await fillInput('[data-testid="session-host"]', '192.168.1.100')
    await fillInput('[data-testid="session-port"]', '22')
    await fillInput('[data-testid="session-username"]', 'root')
    await fillInput('[data-testid="session-password"]', 'test123')
    
    // 点击保存
    await clickElement('[data-testid="session-save-btn"]')
    
    // 验证会话出现在列表中
    await waitForElement('[data-testid="session-item-test-server"]')
  })

  test('should connect to SSH server', async () => {
    // 双击会话项连接
    await page.dblclick('[data-testid="session-item-test-server"]')
    
    // 等待终端出现
    await waitForElement('[data-testid="terminal-container"]')
    
    // 验证连接状态
    const statusText = await page.textContent('[data-testid="connection-status"]')
    expect(statusText).toContain('已连接')
  })

  test('should execute command in terminal', async () => {
    // 在终端中输入命令
    const terminal = await page.locator('[data-testid="terminal-container"]')
    await terminal.click()
    
    // 模拟键盘输入
    await page.keyboard.type('ls -la')
    await page.keyboard.press('Enter')
    
    // 等待输出
    await page.waitForTimeout(1000)
    
    // 验证终端有输出
    const terminalContent = await terminal.textContent()
    expect(terminalContent).toBeTruthy()
  })

  test('should disconnect from server', async () => {
    // 点击断开按钮
    await clickElement('[data-testid="disconnect-btn"]')
    
    // 验证连接状态
    const statusText = await page.textContent('[data-testid="connection-status"]')
    expect(statusText).toContain('已断开')
  })
})
```

```typescript
// e2e/vim.e2e.spec.ts
import { test, expect, beforeAll, afterAll } from '@playwright/test'
import { startApp, closeApp } from './helpers/electron-app'
import type { ElectronApplication, Page } from '@playwright/test'

let app: ElectronApplication
let page: Page

test.describe('Vim Editor Test', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
  })

  afterAll(async () => {
    await closeApp()
  })

  test('should use vim to edit file', async () => {
    // 假设已经连接到服务器
    const terminal = await page.locator('[data-testid="terminal-container"]')
    await terminal.click()
    
    // 打开vim
    await page.keyboard.type('vim test.txt')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
    
    // 进入插入模式
    await page.keyboard.press('i')
    await page.waitForTimeout(100)
    
    // 输入内容
    await page.keyboard.type('Hello, this is a test file.')
    await page.waitForTimeout(100)
    
    // 退出插入模式
    await page.keyboard.press('Escape')
    await page.waitForTimeout(100)
    
    // 保存并退出
    await page.keyboard.type(':wq')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
    
    // 验证文件已创建
    await page.keyboard.type('cat test.txt')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
    
    const terminalContent = await terminal.textContent()
    expect(terminalContent).toContain('Hello, this is a test file.')
  })
})
```

### 6.5 测试任务清单（按Phase分配）

#### 6.5.1 Phase 0 测试任务

| 序号 | 任务 | 产出物 | 依赖 |
|------|------|--------|------|
| T0.1 | 配置Vitest | vitest.config.ts | 0.1 |
| T0.2 | 配置Playwright | playwright.config.ts | 0.1 |
| T0.3 | 创建测试辅助工具 | e2e/helpers/*.ts | T0.2 |
| T0.4 | 创建测试脚本 | package.json scripts | T0.1, T0.2 |

#### 6.5.2 Phase 1 测试任务

| 序号 | 任务 | 产出物 | 依赖 |
|------|------|--------|------|
| T1.1 | CryptoService单元测试 | crypto.test.ts | 1.2 |
| T1.2 | StoreService单元测试 | store.test.ts | 1.1 |
| T1.3 | SSHManager单元测试 | ssh-manager.test.ts | 1.3 |
| T1.4 | SessionStore单元测试 | session.test.ts | 1.7 |
| T1.5 | TerminalStore单元测试 | terminal.test.ts | 1.8 |
| T1.6 | 会话管理集成测试 | session.integration.test.ts | 1.4 |
| T1.7 | SSH连接集成测试 | ssh.integration.test.ts | 1.5 |
| T1.8 | 连接流程E2E测试 | connection.e2e.spec.ts | 1.14 |
| T1.9 | Vim编辑器E2E测试 | vim.e2e.spec.ts | 1.14 |

#### 6.5.3 Phase 2 测试任务

| 序号 | 任务 | 产出物 | 依赖 |
|------|------|--------|------|
| T2.1 | 密钥认证集成测试 | key-auth.integration.test.ts | 2.1 |
| T2.2 | 会话分组单元测试 | session-group.test.ts | 2.3 |
| T2.3 | 命令片段单元测试 | command.test.ts | 2.4 |
| T2.4 | ConfigStore单元测试 | config.test.ts | 2.8 |
| T2.5 | 命令片段E2E测试 | command.e2e.spec.ts | 2.5 |
| T2.6 | 主题切换E2E测试 | theme.e2e.spec.ts | 2.6 |

#### 6.5.4 Phase 3 测试任务

| 序号 | 任务 | 产出物 | 依赖 |
|------|------|--------|------|
| T3.1 | 终端分屏E2E测试 | split-pane.e2e.spec.ts | 3.1 |
| T3.2 | 日志记录集成测试 | logger.integration.test.ts | 3.2 |
| T3.3 | 历史记录单元测试 | history.test.ts | 3.4 |
| T3.4 | 导入导出E2E测试 | import-export.e2e.spec.ts | 3.6 |

#### 6.5.5 Phase 4 测试任务

| 序号 | 任务 | 产出物 | 依赖 |
|------|------|--------|------|
| T4.1 | SFTP集成测试 | sftp.integration.test.ts | 4.1 |
| T4.2 | 文件传输E2E测试 | file-transfer.e2e.spec.ts | 4.3 |
| T4.3 | 跳板机连接集成测试 | jump-host.integration.test.ts | 4.4 |
| T4.4 | 批量操作E2E测试 | batch-operation.e2e.spec.ts | 4.5 |

### 6.6 测试脚本配置

在 `package.json` 的 `scripts` 中添加：

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --coverage",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e",
    "test:ci": "npm run test:unit && npm run test:integration"
  }
}
```

### 6.7 CI/CD中的测试集成

更新 `.github/workflows/build.yml` 添加测试步骤：

```yaml
- name: Run unit tests
  run: npm run test:unit
  
- name: Run integration tests
  run: npm run test:integration
  
- name: Upload coverage report
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
    fail_ci_if_error: true
```

### 6.8 测试覆盖率要求

| 模块 | 最低覆盖率 | 目标覆盖率 |
|------|-----------|-----------|
| CryptoService | 90% | 95% |
| DatabaseService | 80% | 90% |
| SSHManager | 70% | 85% |
| Stores | 80% | 90% |
| 工具函数 | 80% | 90% |
| **总体** | **75%** | **85%** |

### 6.9 测试文件目录结构

```
diy-linux-shell/
├── e2e/                              # E2E测试目录
│   ├── helpers/                      # 测试辅助工具
│   │   ├── electron-app.ts          # Electron应用启动/关闭
│   │   ├── mock-server.ts           # Mock SSH服务器
│   │   └── assertions.ts            # 自定义断言
│   ├── connection.e2e.spec.ts       # 连接流程测试
│   ├── vim.e2e.spec.ts              # Vim编辑器测试
│   ├── tabs.e2e.spec.ts             # 多标签页测试
│   ├── session.e2e.spec.ts          # 会话管理测试
│   ├── command.e2e.spec.ts          # 命令片段测试
│   ├── theme.e2e.spec.ts            # 主题切换测试
│   ├── split-pane.e2e.spec.ts       # 分屏测试
│   ├── import-export.e2e.spec.ts    # 导入导出测试
│   ├── file-transfer.e2e.spec.ts    # 文件传输测试
│   └── batch-operation.e2e.spec.ts  # 批量操作测试
│
├── src/
│   ├── main/
│   │   ├── services/
│   │   │   └── __tests__/
│   │   │       ├── crypto.test.ts
│   │   │       ├── store.test.ts
│   │   │       └── ssh-manager.test.ts
│   │   └── ipc/
│   │       └── __tests__/
│   │           ├── session.integration.test.ts
│   │           └── terminal.integration.test.ts
│   │
│   └── renderer/
│       └── src/
│           └── stores/
│               └── __tests__/
│                   ├── session.test.ts
│                   ├── terminal.test.ts
│                   └── config.test.ts
│
├── vitest.config.ts                  # Vitest配置
├── vitest.integration.config.ts      # 集成测试配置
└── playwright.config.ts              # Playwright配置
```

---

## 7. 风险与应对

| 风险 | 应对措施 |
|------|----------|
| SSH连接不稳定 | 实现自动重连机制，添加心跳检测 |
| 终端渲染性能问题 | 使用Canvas渲染，限制数据刷新频率 |
| 跨平台兼容问题 | 使用成熟的跨平台库，多平台测试 |
| 密码安全风险 | 使用系统级加密，不存储明文密码 |

---

## 8. 下一步行动

**立即开始 Phase 0: 项目初始化**

1. 创建Electron + Vue3项目
2. 安装核心依赖
3. 创建目录结构
4. 配置开发环境
5. 创建基础类型定义

准备好后，执行以下命令开始：

```bash
npm create electron-vite@latest . -- --template vue-ts
```

---

## 9. 跨平台打包配置

### 9.1 打包目标平台

| 平台 | 打包格式 | 架构 | 说明 |
|------|----------|------|------|
| Windows | `.exe` (NSIS) | x64 | 安装程序，支持自动更新 |
| Windows | `.exe` (Portable) | x64 | 便携版，免安装运行 |
| Linux | `.AppImage` | x64 | 通用格式，适用于大多数发行版 |
| Linux | `.deb` | x64 | Debian/Ubuntu 系列 |
| Linux | `.rpm` | x64 | RedHat/CentOS/Fedora 系列 |
| macOS | `.dmg` | x64, arm64 | 支持 Intel 和 Apple Silicon |

### 9.2 electron-builder 配置

在 `package.json` 中添加以下配置：

```json
{
  "build": {
    "appId": "com.diy-linux-shell",
    "productName": "DIY-Linux-Shell",
    "copyright": "Copyright © 2026",
    "directories": {
      "output": "out",
      "buildResources": "resources"
    },
    "files": [
      "dist/**/*",
      "dist-electron/**/*",
      "package.json"
    ],
    "extraResources": [
      {
        "from": "resources",
        "to": "resources",
        "filter": ["**/*"]
      }
    ],
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        },
        {
          "target": "portable",
          "arch": ["x64"]
        }
      ],
      "icon": "resources/icons/icon.ico",
      "artifactName": "${productName}-${version}-${arch}-setup.${ext}"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "DIY-Linux-Shell"
    },
    "linux": {
      "target": [
        {
          "target": "AppImage",
          "arch": ["x64"]
        },
        {
          "target": "deb",
          "arch": ["x64"]
        },
        {
          "target": "rpm",
          "arch": ["x64"]
        }
      ],
      "icon": "resources/icons",
      "category": "Development",
      "maintainer": "your-email@example.com",
      "artifactName": "${productName}-${version}-${arch}.${ext}"
    },
    "mac": {
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]
        }
      ],
      "icon": "resources/icons/icon.icns",
      "category": "public.app-category.developer-tools",
      "artifactName": "${productName}-${version}-${arch}.${ext}"
    },
    "dmg": {
      "contents": [
        {
          "x": 130,
          "y": 220
        },
        {
          "x": 410,
          "y": 220,
          "type": "link",
          "path": "/Applications"
        }
      ]
    },
    "publish": {
      "provider": "github",
      "owner": "your-github-username",
      "repo": "diy-linux-shell"
    }
  }
}
```

### 9.3 打包脚本配置

在 `package.json` 的 `scripts` 中添加：

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "postinstall": "electron-builder install-app-deps",
    "package": "npm run build && electron-builder --dir",
    "package:win": "npm run build && electron-builder --win",
    "package:linux": "npm run build && electron-builder --linux",
    "package:mac": "npm run build && electron-builder --mac",
    "package:all": "npm run build && electron-builder -mwl",
    "release": "npm run build && electron-builder --publish always"
  }
}
```

### 9.4 数据存储方案

项目使用 `electron-store` 进行数据持久化存储，无需原生模块编译：

**优势：**
- 无需编译原生模块，安装更简单
- 跨平台兼容性更好
- 数据以JSON格式存储，便于调试和迁移
- 自动处理数据文件路径

**存储位置：**
- Windows: `%APPDATA%\diy-linux-shell\config.json`
- Linux: `~/.config/diy-linux-shell/config.json`
- macOS: `~/Library/Application Support/diy-linux-shell/config.json`

### 9.5 GitHub Actions CI/CD 配置

创建文件 `.github/workflows/build.yml`：

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to build'
        required: false

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: windows-latest
            platform: win
          - os: ubuntu-latest
            platform: linux
          - os: macos-latest
            platform: mac
    
    runs-on: ${{ matrix.os }}
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Install dependencies (Windows)
        if: matrix.os == 'windows-latest'
        run: |
          npm ci
          npm run rebuild
          
      - name: Install dependencies (Unix)
        if: matrix.os != 'windows-latest'
        run: |
          npm ci
          npm run rebuild
          
      - name: Build application
        run: npm run build
        
      - name: Package (Windows)
        if: matrix.os == 'windows-latest'
        run: npm run package:win
        
      - name: Package (Linux)
        if: matrix.os == 'ubuntu-latest'
        run: npm run package:linux
        
      - name: Package (macOS)
        if: matrix.os == 'macos-latest'
        run: npm run package:mac
        
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.platform }}-build
          path: |
            out/*.exe
            out/*.AppImage
            out/*.deb
            out/*.rpm
            out/*.dmg
          retention-days: 30

  release:
    needs: build
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/')
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: artifacts
          
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: artifacts/**/*
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 9.6 应用图标资源

需要准备的图标文件：

| 文件 | 尺寸 | 用途 |
|------|------|------|
| `resources/icons/icon.ico` | 256x256 | Windows 应用图标 |
| `resources/icons/icon.png` | 512x512 | Linux 应用图标 |
| `resources/icons/icon.icns` | 512x512 | macOS 应用图标 |
| `resources/icons/tray.png` | 16x16, 32x32 | 系统托盘图标 |

### 9.7 打包命令说明

| 命令 | 说明 |
|------|------|
| `npm run package` | 打包当前平台（开发测试用） |
| `npm run package:win` | 打包Windows版本 |
| `npm run package:linux` | 打包Linux版本 |
| `npm run package:mac` | 打包macOS版本 |
| `npm run package:all` | 打包所有平台（需要在对应平台执行） |
| `npm run release` | 打包并发布到GitHub Releases |

### 9.8 打包注意事项

1. **数据迁移**：electron-store 使用JSON格式存储，支持数据导入导出
2. **代码签名**：Windows和macOS建议进行代码签名，避免安全警告
3. **自动更新**：配置 `publish` 字段后支持自动更新功能
4. **文件体积**：Electron应用体积较大，可通过以下方式优化：
   - 使用 `electron-builder` 的压缩选项
   - 排除不必要的文件
   - 使用 `asar` 打包

---

## 10. Phase 5: 发布部署

### 10.1 任务清单

| 序号 | 任务 | 产出物 | 依赖 |
|------|------|--------|------|
| 5.1 | 准备应用图标资源 | resources/icons/* | Phase 4 |
| 5.2 | 配置代码签名（Windows） | 代码签名证书配置 | 5.1 |
| 5.3 | 配置代码签名（macOS） | Apple Developer证书配置 | 5.1 |
| 5.4 | 测试多平台打包 | out/* 安装包 | 5.1 |
| 5.5 | 运行全量单元测试 | 测试报告 | Phase 4 |
| 5.6 | 运行全量集成测试 | 测试报告 | Phase 4 |
| 5.7 | 运行全量E2E测试 | 测试报告 | Phase 4 |
| 5.8 | 验证测试覆盖率 | 覆盖率报告 >= 75% | 5.5, 5.6 |
| 5.9 | 配置GitHub Releases | 自动发布流程 | 5.4, 5.8 |
| 5.10 | 编写用户文档 | README.md, 使用说明 | 5.4 |
| 5.11 | 发布第一个正式版本 | v1.0.0 | 5.9, 5.10 |

### 10.2 发布流程

```
┌─────────────────────────────────────────────────────────────────┐
│                       发布流程                                   │
│                                                                  │
│  1. 代码准备                                                    │
│     ├── 完成所有功能开发                                        │
│     ├── 更新版本号                                              │
│     └── 更新 CHANGELOG.md                                       │
│              │                                                   │
│              ▼                                                   │
│  2. 自动化测试                                                  │
│     ├── 运行单元测试 (覆盖率 >= 75%)                            │
│     ├── 运行集成测试                                            │
│     ├── 运行E2E测试                                             │
│     └── 生成测试报告                                            │
│              │                                                   │
│              ▼                                                   │
│  3. 创建标签                                                    │
│     └── git tag v1.0.0 && git push --tags                       │
│              │                                                   │
│              ▼                                                   │
│  4. CI/CD自动构建                                               │
│     ├── 运行测试流水线                                          │
│     ├── Windows: .exe (NSIS + Portable)                         │
│     ├── Linux: .AppImage + .deb + .rpm                          │
│     └── macOS: .dmg (x64 + arm64)                               │
│              │                                                   │
│              ▼                                                   │
│  5. 自动发布                                                    │
│     └── GitHub Releases 创建发布页面                            │
│              │                                                   │
│              ▼                                                   │
│  6. 用户通知                                                    │
│     ├── 应用内更新提示                                          │
│     └── 社交媒体/社区公告                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 10.3 版本号规范

遵循语义化版本规范 (SemVer)：

```
主版本号.次版本号.修订号

例如: 1.2.3
- 主版本号(1): 不兼容的API变更
- 次版本号(2): 向下兼容的功能新增
- 修订号(3): 向下兼容的问题修复
```

### 10.4 验收标准

- [ ] Windows安装包正常安装和运行
- [ ] Windows便携版正常运行
- [ ] Linux AppImage正常运行
- [ ] Linux deb包正常安装和运行
- [ ] macOS dmg正常安装和运行
- [ ] 应用内自动更新功能正常
- [ ] GitHub Releases页面正确显示
- [ ] 单元测试覆盖率 >= 75%
- [ ] 集成测试全部通过
- [ ] E2E测试全部通过
- [ ] CI/CD流水线正常运行
