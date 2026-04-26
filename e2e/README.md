# E2E 测试文档

本目录包含 DIY Linux Shell 应用的所有 E2E 测试用例，使用 Playwright 测试框架。

## 目录结构

```
e2e/
├── all-tests.e2e.spec.ts          # 测试总入口（一键执行所有测试）
├── README.md                       # 本文档
├── app/                            # 应用基础功能测试
│   └── app.e2e.spec.ts
├── config/                         # 测试配置
│   └── test-config.ts
├── connection/                     # 连接功能测试
│   ├── connection.e2e.spec.ts
│   ├── connection-error.e2e.spec.ts
│   └── test-connection.e2e.spec.ts
├── context-menu/                   # 右键菜单测试
│   ├── add-session-menu-close.e2e.spec.ts
│   ├── check-all-context-menus.e2e.spec.ts
│   ├── check-spacer-div.e2e.spec.ts
│   ├── context-menu-icon-load.e2e.spec.ts
│   ├── test-session-below-context-menu.e2e.spec.ts
│   └── test-spacer-context-menu.e2e.spec.ts
├── debug/                          # 调试和测试工具
│   ├── browser-mode-error-test.e2e.spec.ts
│   ├── cleanup-test-data.e2e.spec.ts
│   ├── console-error-capture-test.e2e.spec.ts
│   ├── edit-session-password-debug.e2e.spec.ts
│   ├── reproduce-errorDialogSessionId.e2e.spec.ts
│   └── wrong-password-retry-test.e2e.spec.ts
├── empty-state/                    # 空状态测试
│   ├── test-empty-state-full.e2e.spec.ts
│   └── test-sessionlist-empty-state.e2e.spec.ts
├── helpers/                        # 测试辅助工具
│   ├── assertions.ts               # 自定义断言
│   ├── electron-app.ts             # Electron 应用启动/关闭辅助
│   └── mock-server.ts              # 模拟服务器
├── layout/                         # 应用布局测试
│   ├── app-sidebar-resize.e2e.spec.ts
│   ├── tab-persistence.e2e.spec.ts
│   └── tabs.e2e.spec.ts
├── session/                        # 会话管理测试
│   ├── bug-034-unified-global-menu.e2e.spec.ts           # BUG-034: GroupHeader/SessionItem 统一全局菜单
│   ├── bug-035-sidebar-unified-menu.e2e.spec.ts          # BUG-035: Sidebar 统一全局菜单
│   ├── debug-session-group-contextmenu.e2e.spec.ts
│   ├── five-level-nested-groups.e2e.spec.ts
│   ├── group-contextmenu-bugfix.e2e.spec.ts
│   ├── group-refactoring-validation.e2e.spec.ts
│   ├── last-level-group-display-fix.e2e.spec.ts
│   ├── session-group.e2e.spec.ts
│   ├── subgroup-indent.e2e.spec.ts
│   ├── subgroup-padding-validation.e2e.spec.ts
│   ├── third-level-diagnostic.e2e.spec.ts
│   ├── third-level-group-bugfix.e2e.spec.ts
│   └── third-level-group-session-bug.e2e.spec.ts
├── session-form/                   # 会话表单测试
│   ├── clear-all-data.e2e.spec.ts
│   ├── clear-and-create.e2e.spec.ts
│   ├── debug-group-depth.e2e.spec.ts
│   ├── debug-tree-select-display.e2e.spec.ts
│   ├── default-group.e2e.spec.ts
│   ├── group-form-overlay.e2e.spec.ts
│   ├── session-form-enhancement.e2e.spec.ts
│   ├── session-form-modal.e2e.spec.ts
│   ├── tree-group-expand.e2e.spec.ts
│   └── tree-group-select-console-error.e2e.spec.ts
├── session-group/                  # 会话分组测试
│   └── group-name-unique.e2e.spec.ts
├── session-list/                   # 会话列表测试
│   ├── capture-closeAllContextMenus-error-test.e2e.spec.ts
│   ├── capture-console-errors-test.e2e.spec.ts
│   ├── default-group-display.e2e.spec.ts
│   ├── dev-mode-capture-error-test.e2e.spec.ts
│   ├── dev-mode-groupheader-capture-test.e2e.spec.ts
│   ├── dev-mode-sftp-button-capture-test.e2e.spec.ts
│   ├── direct-trigger-error-test.e2e.spec.ts
│   ├── enhanced-capture-all-console-output-test.e2e.spec.ts
│   ├── force-capture-console-errors-test.e2e.spec.ts
│   ├── groupheader-l11-19-rightclick-capture-test.e2e.spec.ts
│   ├── groupheader-rightclick-error-test.e2e.spec.ts
│   ├── inject-error-handler-test.e2e.spec.ts
│   ├── sessionitem-context-menu-console-test.e2e.spec.ts
│   ├── verify-event-redundancy-cleanup.e2e.spec.ts
│   ├── verify-reference-error-capture-test.e2e.spec.ts
│   └── verify-sessioncontextmenu-fix.e2e.spec.ts
├── settings/                       # 设置功能测试
│   └── settings.e2e.spec.ts
├── sftp/                           # SFTP 文件传输测试
│   ├── batch-delete.e2e.spec.ts
│   ├── batch-download-complete.e2e.spec.ts
│   ├── batch-upload-complete.e2e.spec.ts
│   ├── batch-upload-deep-test.e2e.spec.ts
│   ├── batch-upload-multi-task.e2e.spec.ts
│   ├── batch-upload.e2e.spec.ts
│   ├── bug-032-fileitem-contextmenu-not-show.e2e.spec.ts  # BUG-032: file-item 右键菜单不弹出
│   ├── bug-033-click-not-close-menu.e2e.spec.ts         # BUG-033: 左键点击不关闭右键菜单
│   ├── cancel-upload-simple.e2e.spec.ts
│   ├── cancel-upload.e2e.spec.ts
│   ├── sftp-context-menu-global-unique.e2e.spec.ts
│   ├── sftp-local-create-folder.e2e.spec.ts             # 本地创建文件夹功能测试
│   ├── sftp-local-refresh.e2e.spec.ts                   # 本地文件浏览器刷新功能测试
│   ├── sftp-transfer.e2e.spec.ts                        # SFTP 窗口功能测试
│   ├── sftp-tree-expand-collapse.e2e.spec.ts            # SFTP 传输树展开/折叠功能测试
│   ├── sftp-tree-status.e2e.spec.ts                     # SFTP 树形状态测试
│   ├── sftp-tree-upload.e2e.spec.ts
│   ├── transfer-progress-verify.e2e.spec.ts
│   └── upload-progress-sync.e2e.spec.ts
└── terminal/                       # 终端功能测试
    ├── session-edit-button.e2e.spec.ts
    ├── sftp-disconnect-reconnect.e2e.spec.ts
    ├── ssh-sftp-mode-switch.e2e.spec.ts
    ├── terminal-context-menu.e2e.spec.ts
    └── vim.e2e.spec.ts
```

## 运行测试

### 运行所有测试

```bash
# 方式 1：运行所有测试
npm run test:e2e

# 方式 2：使用总入口文件
npx playwright test all-tests.e2e.spec.ts

# 方式 3：直接运行 Playwright
npx playwright test
```

### 运行特定目录的测试

```bash
# 运行会话管理测试
npx playwright test session/

# 运行连接功能测试
npx playwright test connection/

# 运行布局测试
npx playwright test layout/
```

### 运行单个测试文件

```bash
# 运行会话分组测试
npx playwright test session/session-group.e2e.spec.ts

# 运行侧边栏拖拽测试
npx playwright test layout/app-sidebar-resize.e2e.spec.ts
```

### 运行特定测试用例

```bash
# 运行匹配的测试
npx playwright test --grep "会话分组"

# 运行标记为 @smoke 的测试
npx playwright test --grep @smoke
```

### 调试模式

```bash
# 有头模式（显示浏览器）
npx playwright test --headed

# 调试模式（逐步执行）
npx playwright test --debug

# 生成测试报告
npx playwright test --reporter=html
npx playwright show-report
```

## 测试用例清单

### App - 应用基础功能

> 详细说明: [app/digest.md](./app/digest.md)

| 文件名 | 描述 |
|--------|------|
| [app.e2e.spec.ts](./app/app.e2e.spec.ts) | 应用启动、标题栏、侧边栏、窗口控制、设置导航、会话表单交互 |

### Connection - 连接功能

> 详细说明: [connection/digest.md](./connection/digest.md)

| 文件名 | 描述 |
|--------|------|
| [connection.e2e.spec.ts](./connection/connection.e2e.spec.ts) | 会话创建/编辑/删除、连接按钮、双击连接、标签页创建、连接状态显示、表单验证 |
| [connection-error.e2e.spec.ts](./connection/connection-error.e2e.spec.ts) | 连接失败错误对话框、重新输入密码、编辑会话、修改密码后重连、标签页右键重连失败 |
| [test-connection.e2e.spec.ts](./connection/test-connection.e2e.spec.ts) | 表单内测试连接按钮、空字段验证、连接成功/失败状态、加载状态显示 |

### Context Menu - 右键菜单

> 详细说明: [context-menu/digest.md](./context-menu/digest.md)

| 文件名 | 描述 |
|--------|------|
| [add-session-menu-close.e2e.spec.ts](./context-menu/add-session-menu-close.e2e.spec.ts) | 添加会话菜单关闭行为 |
| [check-all-context-menus.e2e.spec.ts](./context-menu/check-all-context-menus.e2e.spec.ts) | 检查所有 context-menu 元素的状态、可见性、样式 |
| [check-spacer-div.e2e.spec.ts](./context-menu/check-spacer-div.e2e.spec.ts) | 检查分隔线 div 的右键菜单 |
| [context-menu-icon-load.e2e.spec.ts](./context-menu/context-menu-icon-load.e2e.spec.ts) | 右键菜单图标加载 |
| [test-session-below-context-menu.e2e.spec.ts](./context-menu/test-session-below-context-menu.e2e.spec.ts) | 会话下方空白区域右键菜单 |
| [test-spacer-context-menu.e2e.spec.ts](./context-menu/test-spacer-context-menu.e2e.spec.ts) | 分隔线区域上下文菜单 |

### Debug - 调试工具

> 详细说明: [debug/digest.md](./debug/digest.md)

| 文件名 | 描述 |
|--------|------|
| [browser-mode-error-test.e2e.spec.ts](./debug/browser-mode-error-test.e2e.spec.ts) | 浏览器模式下的错误捕获测试 |
| [cleanup-test-data.e2e.spec.ts](./debug/cleanup-test-data.e2e.spec.ts) | 清理测试创建的会话数据 |
| [console-error-capture-test.e2e.spec.ts](./debug/console-error-capture-test.e2e.spec.ts) | 控制台错误捕获功能验证 |
| [edit-session-password-debug.e2e.spec.ts](./debug/edit-session-password-debug.e2e.spec.ts) | 编辑会话密码功能调试 |
| [reproduce-errorDialogSessionId.e2e.spec.ts](./debug/reproduce-errorDialogSessionId.e2e.spec.ts) | 重现 errorDialogSessionId 相关 bug |
| [wrong-password-retry-test.e2e.spec.ts](./debug/wrong-password-retry-test.e2e.spec.ts) | 错误密码重试流程测试 |

### Empty State - 空状态

> 详细说明: [empty-state/digest.md](./empty-state/digest.md)

| 文件名 | 描述 |
|--------|------|
| [test-empty-state-full.e2e.spec.ts](./empty-state/test-empty-state-full.e2e.spec.ts) | 完整空状态页面显示测试 |
| [test-sessionlist-empty-state.e2e.spec.ts](./empty-state/test-sessionlist-empty-state.e2e.spec.ts) | 会话列表区域空状态测试 |

### Layout - 应用布局

> 详细说明: [layout/digest.md](./layout/digest.md)

| 文件名 | 描述 |
|--------|------|
| [app-sidebar-resize.e2e.spec.ts](./layout/app-sidebar-resize.e2e.spec.ts) | 侧边栏拖拽调整宽度功能 |
| [tab-persistence.e2e.spec.ts](./layout/tab-persistence.e2e.spec.ts) | 标签页状态持久化（刷新/重启后保持） |
| [tabs.e2e.spec.ts](./layout/tabs.e2e.spec.ts) | 多标签页创建、切换、关闭功能 |

### Session - 会话管理

> 详细说明: [session/digest.md](./session/digest.md)

| 文件名 | 描述 |
|--------|------|
| [bug-034-unified-global-menu.e2e.spec.ts](./session/bug-034-unified-global-menu.e2e.spec.ts) | BUG-034: GroupHeader/SessionItem 统一全局右键菜单修复验证 |
| [bug-035-sidebar-unified-menu.e2e.spec.ts](./session/bug-035-sidebar-unified-menu.e2e.spec.ts) | BUG-035: Sidebar 统一全局菜单 + 样式优化验证 |
| [debug-session-group-contextmenu.e2e.spec.ts](./session/debug-session-group-contextmenu.e2e.spec.ts) | 会话分组右键菜单调试 |
| [five-level-nested-groups.e2e.spec.ts](./session/five-level-nested-groups.e2e.spec.ts) | 五层嵌套子分组创建和显示 |
| [group-contextmenu-bugfix.e2e.spec.ts](./session/group-contextmenu-bugfix.e2e.spec.ts) | 分组右键菜单 bug 修复验证 |
| [group-refactoring-validation.e2e.spec.ts](./session/group-refactoring-validation.e2e.spec.ts) | 分组重构后功能验证 |
| [last-level-group-display-fix.e2e.spec.ts](./session/last-level-group-display-fix.e2e.spec.ts) | 最后一层分组文字显示效果修复验证 |
| [session-group.e2e.spec.ts](./session/session-group.e2e.spec.ts) | 会话分组基础功能（创建/编辑/删除/子分组） |
| [subgroup-indent.e2e.spec.ts](./session/subgroup-indent.e2e.spec.ts) | 子分组缩进显示 |
| [subgroup-padding-validation.e2e.spec.ts](./session/subgroup-padding-validation.e2e.spec.ts) | 子分组缩进验证 |
| [third-level-diagnostic.e2e.spec.ts](./session/third-level-diagnostic.e2e.spec.ts) | 三级分组诊断测试 |
| [third-level-group-bugfix.e2e.spec.ts](./session/third-level-group-bugfix.e2e.spec.ts) | 三级分组 bug 修复验证 |
| [third-level-group-session-bug.e2e.spec.ts](./session/third-level-group-session-bug.e2e.spec.ts) | 三级分组会话 bug 验证 |

### Session Form - 会话表单

> 详细说明: [session-form/digest.md](./session-form/digest.md)

| 文件名 | 描述 |
|--------|------|
| [clear-all-data.e2e.spec.ts](./session-form/clear-all-data.e2e.spec.ts) | 清除所有会话数据功能 |
| [clear-and-create.e2e.spec.ts](./session-form/clear-and-create.e2e.spec.ts) | 清除后重新创建会话 |
| [debug-group-depth.e2e.spec.ts](./session-form/debug-group-depth.e2e.spec.ts) | 分组深度选择调试 |
| [debug-tree-select-display.e2e.spec.ts](./session-form/debug-tree-select-display.e2e.spec.ts) | 树形选择器显示调试 |
| [default-group.e2e.spec.ts](./session-form/default-group.e2e.spec.ts) | 默认分组功能 |
| [group-form-overlay.e2e.spec.ts](./session-form/group-form-overlay.e2e.spec.ts) | 分组表单覆盖层交互 |
| [session-form-enhancement.e2e.spec.ts](./session-form/session-form-enhancement.e2e.spec.ts) | 会话表单美化和密码可见性 |
| [session-form-modal.e2e.spec.ts](./session-form/session-form-modal.e2e.spec.ts) | 会话表单模态行为 |
| [tree-group-expand.e2e.spec.ts](./session-form/tree-group-expand.e2e.spec.ts) | 树形分组展开功能 |
| [tree-group-select-console-error.e2e.spec.ts](./session-form/tree-group-select-console-error.e2e.spec.ts) | 树形分组选择控制台错误捕获 |

### Session Group - 会话分组

> 详细说明: [session-group/digest.md](./session-group/digest.md)

| 文件名 | 描述 |
|--------|------|
| [group-name-unique.e2e.spec.ts](./session-group/group-name-unique.e2e.spec.ts) | 分组名称唯一性验证（不允许重名） |

### Session List - 会话列表

> 详细说明: [session-list/digest.md](./session-list/digest.md)

| 文件名 | 描述 |
|--------|------|
| [capture-closeAllContextMenus-error-test.e2e.spec.ts](./session-list/capture-closeAllContextMenus-error-test.e2e.spec.ts) | 捕获关闭所有上下文菜单时的错误 |
| [capture-console-errors-test.e2e.spec.ts](./session-list/capture-console-errors-test.e2e.spec.ts) | 捕获会话列表控制台错误 |
| [default-group-display.e2e.spec.ts](./session-list/default-group-display.e2e.spec.ts) | 默认分组在会话列表中的显示 |
| [dev-mode-capture-error-test.e2e.spec.ts](./session-list/dev-mode-capture-error-test.e2e.spec.ts) | 开发模式下错误捕获 |
| [dev-mode-groupheader-capture-test.e2e.spec.ts](./session-list/dev-mode-groupheader-capture-test.e2e.spec.ts) | 开发模式下分组头部错误捕获 |
| [dev-mode-sftp-button-capture-test.e2e.spec.ts](./session-list/dev-mode-sftp-button-capture-test.e2e.spec.ts) | 开发模式下 SFTP 按钮错误捕获 |
| [direct-trigger-error-test.e2e.spec.ts](./session-list/direct-trigger-error-test.e2e.spec.ts) | 直接触发错误并捕获 |
| [enhanced-capture-all-console-output-test.e2e.spec.ts](./session-list/enhanced-capture-all-console-output-test.e2e.spec.ts) | 增强版控制台输出捕获 |
| [force-capture-console-errors-test.e2e.spec.ts](./session-list/force-capture-console-errors-test.e2e.spec.ts) | 强制触发控制台错误 |
| [groupheader-l11-19-rightclick-capture-test.e2e.spec.ts](./session-list/groupheader-l11-19-rightclick-capture-test.e2e.spec.ts) | 分组头部 L1-L19 层级右键菜单错误捕获 |
| [groupheader-rightclick-error-test.e2e.spec.ts](./session-list/groupheader-rightclick-error-test.e2e.spec.ts) | 分组头部右键点击错误 |
| [inject-error-handler-test.e2e.spec.ts](./session-list/inject-error-handler-test.e2e.spec.ts) | 注入错误处理器测试 |
| [sessionitem-context-menu-console-test.e2e.spec.ts](./session-list/sessionitem-context-menu-console-test.e2e.spec.ts) | 会话项右键菜单控制台错误 |
| [verify-event-redundancy-cleanup.e2e.spec.ts](./session-list/verify-event-redundancy-cleanup.e2e.spec.ts) | 验证事件冗余清理 |
| [verify-reference-error-capture-test.e2e.spec.ts](./session-list/verify-reference-error-capture-test.e2e.spec.ts) | 验证引用错误捕获 |
| [verify-sessioncontextmenu-fix.e2e.spec.ts](./session-list/verify-sessioncontextmenu-fix.e2e.spec.ts) | 验证会话上下文菜单修复 |

### Settings - 设置功能

> 详细说明: [settings/digest.md](./settings/digest.md)

| 文件名 | 描述 |
|--------|------|
| [settings.e2e.spec.ts](./settings/settings.e2e.spec.ts) | 设置页面打开、各项设置修改、保存功能 |

### SFTP - 文件传输

> 详细说明: [sftp/digest.md](./sftp/digest.md)

| 文件名 | 描述 |
|--------|------|
| [batch-delete.e2e.spec.ts](./sftp/batch-delete.e2e.spec.ts) | 批量删除远程文件 |
| [batch-download-complete.e2e.spec.ts](./sftp/batch-download-complete.e2e.spec.ts) | 批量下载完整流程 |
| [batch-upload-complete.e2e.spec.ts](./sftp/batch-upload-complete.e2e.spec.ts) | 批量上传完整流程 |
| [batch-upload-deep-test.e2e.spec.ts](./sftp/batch-upload-deep-test.e2e.spec.ts) | 深层目录批量上传 |
| [batch-upload-multi-task.e2e.spec.ts](./sftp/batch-upload-multi-task.e2e.spec.ts) | 多任务批量上传 |
| [batch-upload.e2e.spec.ts](./sftp/batch-upload.e2e.spec.ts) | 批量上传基础功能 |
| [bug-032-fileitem-contextmenu-not-show.e2e.spec.ts](./sftp/bug-032-fileitem-contextmenu-not-show.e2e.spec.ts) | BUG-032: file-item 右键菜单不弹出修复验证 |
| [bug-033-click-not-close-menu.e2e.spec.ts](./sftp/bug-033-click-not-close-menu.e2e.spec.ts) | BUG-033: 左键点击不关闭右键菜单修复验证 |
| [cancel-upload-simple.e2e.spec.ts](./sftp/cancel-upload-simple.e2e.spec.ts) | 简单取消上传 |
| [cancel-upload.e2e.spec.ts](./sftp/cancel-upload.e2e.spec.ts) | 取消上传完整流程 |
| [sftp-context-menu-global-unique.e2e.spec.ts](./sftp/sftp-context-menu-global-unique.e2e.spec.ts) | SFTP 右键菜单全局唯一性 |
| [sftp-local-create-folder.e2e.spec.ts](./sftp/sftp-local-create-folder.e2e.spec.ts) | 本地创建文件夹 |
| [sftp-local-refresh.e2e.spec.ts](./sftp/sftp-local-refresh.e2e.spec.ts) | 本地文件浏览器刷新 |
| [sftp-transfer.e2e.spec.ts](./sftp/sftp-transfer.e2e.spec.ts) | SFTP 窗口打开/关闭、文件上传/下载/删除、新建文件夹、最大化/还原 |
| [sftp-tree-expand-collapse.e2e.spec.ts](./sftp/sftp-tree-expand-collapse.e2e.spec.ts) | SFTP 传输树展开/折叠 |
| [sftp-tree-status.e2e.spec.ts](./sftp/sftp-tree-status.e2e.spec.ts) | SFTP 树形状态显示 |
| [sftp-tree-upload.e2e.spec.ts](./sftp/sftp-tree-upload.e2e.spec.ts) | SFTP 树形上传（文件夹递归上传） |
| [transfer-progress-verify.e2e.spec.ts](./sftp/transfer-progress-verify.e2e.spec.ts) | 传输进度验证 |
| [upload-progress-sync.e2e.spec.ts](./sftp/upload-progress-sync.e2e.spec.ts) | 上传进度同步 |

### Terminal - 终端功能

> 详细说明: [terminal/digest.md](./terminal/digest.md)

| 文件名 | 描述 |
|--------|------|
| [session-edit-button.e2e.spec.ts](./terminal/session-edit-button.e2e.spec.ts) | 会话编辑按钮功能 |
| [sftp-disconnect-reconnect.e2e.spec.ts](./terminal/sftp-disconnect-reconnect.e2e.spec.ts) | SFTP 断开后重新连接 |
| [ssh-sftp-mode-switch.e2e.spec.ts](./terminal/ssh-sftp-mode-switch.e2e.spec.ts) | SSH 和 SFTP 模式切换 |
| [terminal-context-menu.e2e.spec.ts](./terminal/terminal-context-menu.e2e.spec.ts) | 终端右键菜单（复制/粘贴等） |
| [vim.e2e.spec.ts](./terminal/vim.e2e.spec.ts) | Vim 编辑器支持 |

## 测试配置

### 测试环境

SSH 连接测试使用以下配置（在 `config/test-config.ts` 中定义）：

- **IP**: 192.168.10.24
- **用户**: root
- **密码**: One.00000

### 自动关闭

测试配置已设置自动关闭，防止卡死：

```bash
npm run test:e2e
```

### 超时设置

- **测试超时**: 60 秒
- **期望超时**: 10 秒

## 编写测试

### 基本结构

```typescript
import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: Page

test.describe('测试套件名称', () => {
  test.beforeAll(async () => {
    // 生产模式（功能测试，默认）
    const result = await startApp()
    // 或开发模式（Bug调试，需先启动 npm run dev）
    // const result = await startApp('dev')

    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('应该做某事', async () => {
    // 测试代码
    await expect(page.locator('.some-element')).toBeVisible()
  })
})
```

### 辅助工具

- **electron-app.ts**: 启动/关闭 Electron 应用，支持 `test`(生产模式) 和 `dev`(开发模式) 两种启动模式
  - `startApp(mode?)`: 启动应用，`mode` 默认 `'test'`，传入 `'dev'` 连接 Vite dev server
  - `closeApp(app)`: 关闭应用
  - `waitForAppReady(page)`: 等待应用就绪
  - `getMainWindow(app)`: 获取主窗口
- **assertions.ts**: 自定义断言工具
- **mock-server.ts**: 模拟服务器响应
- **test-config.ts**: 测试配置（SSH 连接信息等）

#### startApp 启动模式说明

| 模式 | NODE_ENV | 特点 | 适用场景 |
|------|----------|------|---------|
| `'test'` (默认) | `test` | 使用编译后的代码 | 功能测试、回归测试 |
| `'dev'` | `development` + `ELECTRON_RENDERER_URL: 'http://localhost:5173'` | 连接 Vite dev server，可捕获完整 Vue 控制台报错 | Bug 调试、捕获运行时错误 |

```typescript
// 生产模式（功能测试，默认）
const { app, page } = await startApp()
// 或显式指定
const { app, page } = await startApp('test')

// 开发模式（Bug调试，需先启动 npm run dev）
const { app, page } = await startApp('dev')
```

## 最佳实践

1. **测试隔离**: 每个测试应该独立，不依赖其他测试的状态
2. **清理数据**: 测试结束后清理创建的测试数据
3. **有意义的命名**: 测试文件和使用描述性命名
4. **注释**: 为复杂的测试逻辑添加注释
5. **类型安全**: 使用 TypeScript，显式声明变量类型

## 故障排查

### 测试失败

1. 查看测试输出日志
2. 使用 `--headed` 模式观察浏览器行为
3. 使用 `--debug` 模式逐步执行
4. 检查测试报告：`npx playwright show-report`

### 常见问题

- **找不到模块**: 检查导入路径是否正确（使用 `../helpers/` 而不是`./helpers/`）
- **超时**: 增加 `waitForTimeout` 或使用更可靠的等待条件
- **元素找不到**: 使用 DevTools 检查选择器是否正确

## 相关文档

- [Playwright 官方文档](https://playwright.dev/)
- [项目测试规范](../.trae/rules/plan-spec.md)
