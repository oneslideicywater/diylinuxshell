# Session List 测试用例摘要

## 测试职责

测试会话列表渲染、控制台错误捕获、右键菜单事件处理、开发模式下的错误监听。

## 测试文件清单

| 文件 | 描述 |
|------|------|
| [capture-closeAllContextMenus-error-test.e2e.spec.ts](./capture-closeAllContextMenus-error-test.e2e.spec.ts) | 捕获关闭所有上下文菜单时的错误 |
| [capture-console-errors-test.e2e.spec.ts](./capture-console-errors-test.e2e.spec.ts) | 捕获会话列表控制台错误 |
| [default-group-display.e2e.spec.ts](./default-group-display.e2e.spec.ts) | 默认分组在会话列表中的显示 |
| [dev-mode-capture-error-test.e2e.spec.ts](./dev-mode-capture-error-test.e2e.spec.ts) | 开发模式下错误捕获 |
| [dev-mode-groupheader-capture-test.e2e.spec.ts](./dev-mode-groupheader-capture-test.e2e.spec.ts) | 开发模式下分组头部错误捕获 |
| [dev-mode-sftp-button-capture-test.e2e.spec.ts](./dev-mode-sftp-button-capture-test.e2e.spec.ts) | 开发模式下 SFTP 按钮错误捕获 |
| [direct-trigger-error-test.e2e.spec.ts](./direct-trigger-error-test.e2e.spec.ts) | 直接触发错误并捕获 |
| [enhanced-capture-all-console-output-test.e2e.spec.ts](./enhanced-capture-all-console-output-test.e2e.spec.ts) | 增强版控制台输出捕获 |
| [force-capture-console-errors-test.e2e.spec.ts](./force-capture-console-errors-test.e2e.spec.ts) | 强制触发控制台错误 |
| [groupheader-l11-19-rightclick-capture-test.e2e.spec.ts](./groupheader-l11-19-rightclick-capture-test.e2e.spec.ts) | 分组头部 L1-L19 层级右键菜单错误捕获 |
| [groupheader-rightclick-error-test.e2e.spec.ts](./groupheader-rightclick-error-test.e2e.spec.ts) | 分组头部右键点击错误 |
| [inject-error-handler-test.e2e.spec.ts](./inject-error-handler-test.e2e.spec.ts) | 注入错误处理器测试 |
| [sessionitem-context-menu-console-test.e2e.spec.ts](./sessionitem-context-menu-console-test.e2e.spec.ts) | 会话项右键菜单控制台错误 |
| [verify-event-redundancy-cleanup.e2e.spec.ts](./verify-event-redundancy-cleanup.e2e.spec.ts) | 验证事件冗余清理 |
| [verify-reference-error-capture-test.e2e.spec.ts](./verify-reference-error-capture-test.e2e.spec.ts) | 验证引用错误捕获 |
| [verify-sessioncontextmenu-fix.e2e.spec.ts](./verify-sessioncontextmenu-fix.e2e.spec.ts) | 验证会话上下文菜单修复 |

## 测试覆盖范围

- 控制台错误捕获机制
- 分组头部右键菜单事件
- 会话项右键菜单事件
- 开发模式下的完整错误日志
- 事件去重和冗余清理
- 引用错误和未定义错误捕获
