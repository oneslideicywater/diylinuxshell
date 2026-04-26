# Debug 测试用例摘要

## 测试职责

测试调试工具、错误捕获、控制台错误监听、测试数据清理。

## 测试文件清单

| 文件 | 描述 |
|------|------|
| [browser-mode-error-test.e2e.spec.ts](./browser-mode-error-test.e2e.spec.ts) | 浏览器模式下的错误捕获测试 |
| [cleanup-test-data.e2e.spec.ts](./cleanup-test-data.e2e.spec.ts) | 清理测试创建的会话数据 |
| [console-error-capture-test.e2e.spec.ts](./console-error-capture-test.e2e.spec.ts) | 控制台错误捕获功能验证 |
| [edit-session-password-debug.e2e.spec.ts](./edit-session-password-debug.e2e.spec.ts) | 编辑会话密码功能调试 |
| [reproduce-errorDialogSessionId.e2e.spec.ts](./reproduce-errorDialogSessionId.e2e.spec.ts) | 重现 errorDialogSessionId 相关 bug |
| [wrong-password-retry-test.e2e.spec.ts](./wrong-password-retry-test.e2e.spec.ts) | 错误密码重试流程测试 |

## 测试覆盖范围

- 控制台错误捕获机制
- 页面错误监听
- 浏览器模式与 Electron 模式差异
- 密码错误重试流程
- 测试数据清理
- Bug 重现和验证
