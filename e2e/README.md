# E2E 测试文档

本目录包含 DIY Linux Shell 应用的所有 E2E 测试用例，使用 Playwright 测试框架。

## 目录结构

```
e2e/
├── all-tests.e2e.spec.ts          # 测试总入口（一键执行所有测试）
├── README.md                       # 本文档
├── app/                            # 应用基础功能测试
│   └── app.e2e.spec.ts
├── connection/                     # 连接功能测试
│   ├── connection.e2e.spec.ts
│   ├── connection-error.e2e.spec.ts
│   └── test-connection.e2e.spec.ts
├── context-menu/                   # 右键菜单测试
│   ├── check-all-context-menus.e2e.spec.ts
│   ├── check-spacer-div.e2e.spec.ts
│   ├── test-session-below-context-menu.e2e.spec.ts
│   └── test-spacer-context-menu.e2e.spec.ts
├── debug/                          # 调试和测试工具
│   ├── browser-mode-error-test.e2e.spec.ts
│   ├── cleanup-test-data.e2e.spec.ts
│   ├── console-error-capture-test.e2e.spec.ts
│   └── reproduce-errorDialogSessionId.e2e.spec.ts
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
├── sftp/                           # SFTP 文件传输测试
│   ├── bug-032-fileitem-contextmenu-not-show.e2e.spec.ts  # BUG-032: file-item 右键菜单不弹出
│   ├── bug-033-click-not-close-menu.e2e.spec.ts           # BUG-033: 左键点击不关闭右键菜单
│   ├── cancel-upload-simple.e2e.spec.ts
│   ├── cancel-upload.e2e.spec.ts
│   ├── sftp-local-create-folder.e2e.spec.ts              # 本地创建文件夹功能测试
│   ├── sftp-local-refresh.e2e.spec.ts                    # 本地文件浏览器刷新功能测试
│   ├── sftp-tree-expand-collapse.e2e.spec.ts             # SFTP 传输树展开/折叠功能测试
│   ├── sftp-tree-status.e2e.spec.ts                     # SFTP 树形状态测试
│   ├── sftp-tree-upload.e2e.spec.ts
│   └── sftp-transfer.e2e.spec.ts                        # SFTP 窗口功能测试
├── session/                        # 会话管理测试
│   ├── bug-034-unified-global-menu.e2e.spec.ts           # BUG-034: GroupHeader/SessionItem 统一全局菜单
│   ├── debug-session-group-contextmenu.e2e.spec.ts
│   ├── five-level-nested-groups.e2e.spec.ts
│   ├── last-level-group-display-fix.e2e.spec.ts
│   ├── session-group.e2e.spec.ts
│   ├── subgroup-indent.e2e.spec.ts
│   └── subgroup-padding-validation.e2e.spec.ts
├── session-form/                   # 会话表单测试
│   ├── session-form-enhancement.e2e.spec.ts
│   └── session-form-modal.e2e.spec.ts
├── settings/                       # 设置功能测试
│   └── settings.e2e.spec.ts
├── terminal/                       # 终端功能测试
│   ├── terminal-context-menu.e2e.spec.ts
│   └── vim.e2e.spec.ts
└── config/                         # 测试配置
    └── test-config.ts
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

### App - 应用基础功能 (1 个文件)

| 文件名 | 描述 |
|--------|------|
| [app.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\app\app.e2e.spec.ts) | 应用启动和基础功能测试 |

### Connection - 连接功能 (3 个文件)

| 文件名 | 描述 |
|--------|------|
| [connection.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\connection\connection.e2e.spec.ts) | SSH 连接建立测试 |
| [connection-error.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\connection\connection-error.e2e.spec.ts) | 连接错误处理测试 |
| [test-connection.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\connection\test-connection.e2e.spec.ts) | 测试连接功能测试 |

### Context Menu - 右键菜单 (4 个文件)

| 文件名 | 描述 |
|--------|------|
| [check-all-context-menus.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\context-menu\check-all-context-menus.e2e.spec.ts) | 检查所有上下文菜单 |
| [check-spacer-div.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\context-menu\check-spacer-div.e2e.spec.ts) | 检查分隔线 |
| [test-session-below-context-menu.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\context-menu\test-session-below-context-menu.e2e.spec.ts) | 测试会话下方上下文菜单 |
| [test-spacer-context-menu.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\context-menu\test-spacer-context-menu.e2e.spec.ts) | 测试分隔线上下文菜单 |

### Debug - 调试工具 (4 个文件)

| 文件名 | 描述 |
|--------|------|
| [browser-mode-error-test.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\debug\browser-mode-error-test.e2e.spec.ts) | 浏览器模式错误测试 |
| [cleanup-test-data.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\debug\cleanup-test-data.e2e.spec.ts) | 清理测试数据 |
| [console-error-capture-test.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\debug\console-error-capture-test.e2e.spec.ts) | 控制台错误捕获测试 |
| [reproduce-errorDialogSessionId.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\debug\reproduce-errorDialogSessionId.e2e.spec.ts) | 重现 errorDialogSessionId 错误 |

### Empty State - 空状态 (2 个文件)

| 文件名 | 描述 |
|--------|------|
| [test-empty-state-full.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\empty-state\test-empty-state-full.e2e.spec.ts) | 完整空状态测试 |
| [test-sessionlist-empty-state.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\empty-state\test-sessionlist-empty-state.e2e.spec.ts) | 会话列表空状态测试 |

### Layout - 应用布局 (3 个文件)

| 文件名 | 描述 |
|--------|------|
| [app-sidebar-resize.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\layout\app-sidebar-resize.e2e.spec.ts) | 侧边栏拖拽调整大小测试 |
| [tab-persistence.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\layout\tab-persistence.e2e.spec.ts) | 标签页持久化测试 |
| [tabs.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\layout\tabs.e2e.spec.ts) | 多标签页功能测试 |

### Session - 会话管理 (7 个文件)

| 文件名 | 描述 |
|--------|------|
| [bug-034-unified-global-menu.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\session\bug-034-unified-global-menu.e2e.spec.ts) | BUG-034: GroupHeader/SessionItem 统一全局右键菜单 |
| [session-group.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\session\session-group.e2e.spec.ts) | 会话分组功能测试 |
| [subgroup-indent.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\session\subgroup-indent.e2e.spec.ts) | 子分组缩进测试 |
| [debug-session-group-contextmenu.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\session\debug-session-group-contextmenu.e2e.spec.ts) | 会话分组右键菜单调试 |
| [five-level-nested-groups.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\session\five-level-nested-groups.e2e.spec.ts) | 五层嵌套子分组测试 |
| [subgroup-padding-validation.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\session\subgroup-padding-validation.e2e.spec.ts) | 子分组缩进验证测试 |
| [last-level-group-display-fix.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\session\last-level-group-display-fix.e2e.spec.ts) | 最后一层分组文字显示效果修复验证测试 |

### Session Form - 会话表单 (2 个文件)

| 文件名 | 描述 |
|--------|------|
| [session-form-enhancement.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\session-form\session-form-enhancement.e2e.spec.ts) | 会话表单美化和密码可见性测试 |
| [session-form-modal.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\session-form\session-form-modal.e2e.spec.ts) | 会话表单模态行为测试 |

### Settings - 设置功能 (1 个文件)

| 文件名 | 描述 |
|--------|------|
| [settings.e2e.spec.ts](file://f:/tech-docs/diy-linux-shell/e2e/settings/settings.e2e.spec.ts) | 设置页面功能测试 |

### SFTP - 文件传输 (10 个文件)

| 文件名 | 描述 |
|--------|------|
| [bug-032-fileitem-contextmenu-not-show.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\sftp\bug-032-fileitem-contextmenu-not-show.e2e.spec.ts) | BUG-032: file-item 右键菜单不弹出 |
| [bug-033-click-not-close-menu.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\sftp\bug-033-click-not-close-menu.e2e.spec.ts) | BUG-033: 左键点击不关闭右键菜单 |
| [cancel-upload-simple.e2e.spec.ts](file://f:/tech-docs/diy-linux-shell/e2e/sftp/cancel-upload-simple.e2e.spec.ts) | 简单取消上传测试 |
| [cancel-upload.e2e.spec.ts](file://f:/tech-docs/diy-linux-shell/e2e/sftp/cancel-upload.e2e.spec.ts) | 取消上传功能测试 |
| [sftp-local-create-folder.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\sftp\sftp-local-create-folder.e2e.spec.ts) | 本地创建文件夹功能测试 |
| [sftp-local-refresh.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\sftp\sftp-local-refresh.e2e.spec.ts) | 本地文件浏览器刷新功能测试 |
| [sftp-tree-expand-collapse.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\sftp\sftp-tree-expand-collapse.e2e.spec.ts) | SFTP 传输树展开/折叠功能测试 |
| [sftp-tree-status.e2e.spec.ts](file://f:/tech-docs/diy-linux-shell/e2e/sftp/sftp-tree-status.e2e.spec.ts) | SFTP 树形状态测试 |
| [sftp-tree-upload.e2e.spec.ts](file://f:/tech-docs/diy-linux-shell/e2e/sftp/sftp-tree-upload.e2e.spec.ts) | SFTP 树形上传功能测试 |
| [sftp-transfer.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\sftp\sftp-transfer.e2e.spec.ts) | SFTP 窗口功能测试 |

### Terminal - 终端功能 (2 个文件)

| 文件名 | 描述 |
|--------|------|
| [terminal-context-menu.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\terminal\terminal-context-menu.e2e.spec.ts) | 终端右键菜单测试 |
| [vim.e2e.spec.ts](file://f:\tech-docs\diy-linux-shell\e2e\terminal\vim.e2e.spec.ts) | Vim 编辑器支持测试 |

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
    const result = await startApp()
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

- **electron-app.ts**: 启动/关闭 Electron 应用
- **assertions.ts**: 自定义断言工具
- **mock-server.ts**: 模拟服务器响应
- **test-config.ts**: 测试配置（SSH 连接信息等）

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
