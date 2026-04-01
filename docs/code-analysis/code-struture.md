# 项目目录结构

## 1. 整体目录结构

```
diy-linux-shell/
├── .github/                    # GitHub 配置
│   └── workflows/              # GitHub Actions 工作流
│       └── build.yml           # 构建和发布工作流
│
├── .trae/                      # Trae IDE 配置
│   ├── rules/                  # 规则配置
│   │   └── plan-spec.md        # 项目规范说明
│   └── skill-config.json       # 技能配置
│
├── coverage/                   # 测试覆盖率报告（自动生成）
│   └── diy-linux-shell/
│       ├── e2e/                # E2E 测试覆盖率
│       ├── out/                # 构建产物覆盖率
│       └── src/                # 源码覆盖率
│
├── dist/                       # 打包输出目录（自动生成）
│   ├── win-unpacked/           # Windows 未打包应用
│   │   ├── locales/            # 语言包
│   │   ├── resources/          # 应用资源
│   │   └── DIY-Linux-Shell.exe # 可执行文件
│   ├── DIY-Linux-Shell-{version}-x64-setup.exe  # Windows 安装包
│   └── latest.yml              # 更新配置
│
├── docs/                       # 项目文档
│   ├── code-analysis/          # 代码分析文档
│   │   └── code-struture.md    # 目录结构说明
│   ├── wiki/                   # Wiki 文档
│   │   └── electron.md         # Electron 相关文档
│   ├── ARCHITECTURE.md         # 架构设计文档
│   ├── PRD.md                  # 产品需求文档
│   └── plan.md                 # 实现计划
│
├── e2e/                        # E2E 测试
│   ├── helpers/                # 测试辅助工具
│   │   ├── assertions.ts       # 自定义断言
│   │   ├── electron-app.ts     # Electron 应用启动
│   │   └── mock-server.ts      # Mock SSH 服务器
│   └── app.e2e.spec.ts         # 应用 E2E 测试
│
├── out/                        # 构建输出目录（自动生成）
│   ├── main/                   # 主进程构建产物
│   │   └── index.js
│   ├── preload/                # 预加载脚本构建产物
│   │   └── index.js
│   └── renderer/               # 渲染进程构建产物
│       ├── assets/             # 静态资源（CSS、JS）
│       └── index.html
│
├── resources/                  # 应用资源
│   └── README.md
│
├── src/                        # 源代码
│   ├── main/                   # 主进程代码
│   │   └── index.ts            # 主进程入口
│   │
│   ├── preload/                # 预加载脚本
│   │   └── index.ts            # 暴露安全 API 给渲染进程
│   │
│   ├── renderer/               # 渲染进程代码（前端）
│   │   ├── src/
│   │   │   ├── router/         # 路由配置
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── stores/         # Pinia 状态管理
│   │   │   │   ├── __tests__/  # Store 单元测试
│   │   │   │   │   ├── session.test.ts
│   │   │   │   │   └── terminal.test.ts
│   │   │   │   ├── index.ts    # Store 入口
│   │   │   │   ├── session.ts  # 会话状态管理
│   │   │   │   └── terminal.ts # 终端状态管理
│   │   │   │
│   │   │   ├── styles/         # 样式文件
│   │   │   │   └── main.css    # 主样式
│   │   │   │
│   │   │   ├── test/           # 测试配置
│   │   │   │   └── setup.ts    # 测试环境设置
│   │   │   │
│   │   │   ├── views/          # 页面视图
│   │   │   │   ├── Home.vue    # 主页
│   │   │   │   └── Settings.vue # 设置页
│   │   │   │
│   │   │   ├── App.vue         # 根组件
│   │   │   └── main.ts         # Vue 应用入口
│   │   │
│   │   └── index.html          # HTML 入口
│   │
│   └── shared/                 # 共享代码（主进程和渲染进程共用）
│       ├── constants/          # 常量定义
│       │   └── ipc-channels.ts # IPC 通道名称
│       │
│       └── types/              # TypeScript 类型定义
│           ├── global.d.ts     # 全局类型声明
│           └── index.ts        # 共享类型定义
│
├── .eslintrc.cjs               # ESLint 配置
├── .gitignore                  # Git 忽略配置
├── .prettierrc                 # Prettier 配置
├── electron.vite.config.ts     # Electron Vite 构建配置
├── package.json                # 项目配置
├── package-lock.json           # 依赖锁定文件
├── playwright.config.ts        # Playwright E2E 测试配置
├── tsconfig.json               # TypeScript 配置
├── tsconfig.node.json          # Node.js TypeScript 配置
├── vitest.config.ts            # Vitest 单元测试配置
└── vitest.integration.config.ts # Vitest 集成测试配置
```

---

## 2. 核心目录说明

### 2.1 主进程 (src/main/)

主进程负责 Electron 应用的生命周期管理、窗口创建、SSH 连接管理等系统级操作。

| 文件 | 功能描述 |
|------|----------|
| index.ts | 主进程入口，创建窗口、注册 IPC 处理器 |

**规划中的文件：**

| 文件 | 功能描述 |
|------|----------|
| ipc/index.ts | IPC 处理器注册入口 |
| ipc/session.ts | 会话相关 IPC 处理 |
| ipc/terminal.ts | 终端相关 IPC 处理 |
| ipc/config.ts | 配置相关 IPC 处理 |
| services/store.ts | electron-store 数据存储服务 |
| services/crypto.ts | 加密服务 |
| services/ssh-manager.ts | SSH 连接管理器 |
| services/logger.ts | 日志服务 |

### 2.2 预加载脚本

预加载脚本在渲染进程加载前执行，用于安全地暴露 Node.js API 给渲染进程。

| 文件 | 功能描述 |
|------|----------|
| index.ts | 使用 contextBridge 暴露安全的 IPC API |

### 2.3 渲染进程

渲染进程负责用户界面渲染和用户交互，使用 Vue 3 + Element Plus 构建。

| 目录/文件 | 功能描述 |
|-----------|----------|
| main.ts | Vue 应用入口 |
| App.vue | 根组件 |
| router/ | Vue Router 路由配置 |
| stores/ | Pinia 状态管理 |
| views/ | 页面视图组件 |
| styles/ | 全局样式 |

**规划中的目录：**

| 目录 | 功能描述 |
|------|----------|
| components/layout/ | 布局组件 |
| components/session/ | 会话管理组件 |
| components/terminal/ | 终端组件 |
| components/common/ | 通用组件 |
| api/ | IPC API 封装 |

### 2.4 共享代码

主进程和渲染进程共用的代码，包括类型定义和常量。

| 目录/文件 | 功能描述 |
|-----------|----------|
| types/index.ts | 共享类型定义（Session, Terminal, Config 等） |
| types/global.d.ts | 全局类型声明 |
| constants/ipc-channels.ts | IPC 通道名称常量 |

---

## 3. 配置文件说明

| 文件 | 用途 |
|------|------|
| package.json | 项目依赖、脚本命令配置 |
| electron.vite.config.ts | Electron Vite 构建配置 |
| tsconfig.json | TypeScript 编译配置 |
| tsconfig.node.json | Node.js 环境 TypeScript 配置 |
| .eslintrc.cjs | ESLint 代码检查配置 |
| .prettierrc | Prettier 代码格式化配置 |
| vitest.config.ts | Vitest 单元测试配置 |
| vitest.integration.config.ts | Vitest 集成测试配置 |
| playwright.config.ts | Playwright E2E 测试配置 |

---

## 4. 测试目录说明

### 4.1 单元测试

单元测试与源码放在一起，使用 `__tests__` 目录或 `.test.ts` 后缀。

```
src/
├── renderer/src/stores/__tests__/
│   ├── session.test.ts         # SessionStore 单元测试
│   └── terminal.test.ts        # TerminalStore 单元测试
└── main/services/__tests__/    # 规划中
    ├── store.test.ts           # StoreService 单元测试
    ├── crypto.test.ts          # CryptoService 单元测试
    └── ssh-manager.test.ts     # SSHManager 单元测试
```

### 4.2 集成测试

集成测试放在 `src/main/ipc/__tests__/` 目录。

```
src/main/ipc/__tests__/         # 规划中
├── session.integration.test.ts # 会话 IPC 集成测试
└── terminal.integration.test.ts # 终端 IPC 集成测试
```

### 4.3 E2E 测试

E2E 测试放在项目根目录的 `e2e/` 目录。

```
e2e/
├── helpers/
│   ├── assertions.ts           # 自定义断言
│   ├── electron-app.ts         # Electron 应用启动辅助
│   └── mock-server.ts          # Mock SSH 服务器
└── app.e2e.spec.ts             # 应用 E2E 测试
```

---

## 5. 构建产物说明

### 5.1 开发构建

运行 `npm run dev` 后，构建产物输出到 `out/` 目录：

```
out/
├── main/           # 主进程编译产物
├── preload/        # 预加载脚本编译产物
└── renderer/       # 渲染进程编译产物
```

### 5.2 生产打包

运行 `npm run package:win` 后，打包产物输出到 `dist/` 目录：

```
dist/
├── win-unpacked/                           # Windows 未打包应用（可直接运行）
│   └── DIY-Linux-Shell.exe
├── DIY-Linux-Shell-1.0.0-x64-setup.exe     # Windows 安装包
└── DIY-Linux-Shell-1.0.0-x64-setup.exe.blockmap  # 增量更新文件
```

---

## 6. 数据存储位置

应用使用 `electron-store` 存储数据，数据文件位置：

| 操作系统 | 存储路径 |
|----------|----------|
| Windows | `%APPDATA%\diy-linux-shell\config.json` |
| Linux | `~/.config/diy-linux-shell/config.json` |
| macOS | `~/Library/Application Support/diy-linux-shell/config.json` |

---

## 7. 忽略目录

以下目录不应提交到 Git：

- `out/` - 构建产物
- `dist/` - 打包产物
- `node_modules/` - 依赖包
- `coverage/` - 测试覆盖率报告
- `.vitest/` - Vitest 缓存
- `test-results/` - Playwright 测试结果
