# Helpers 测试辅助工具摘要

## 职责

提供测试用例共享的辅助函数和工具，不包含测试用例。

## 文件清单

| 文件 | 描述 |
|------|------|
| [assertions.ts](./assertions.ts) | 自定义断言工具函数 |
| [electron-app.ts](./electron-app.ts) | Electron 应用启动/关闭辅助（startApp/closeApp/waitForAppReady） |
| [mock-server.ts](./mock-server.ts) | 模拟服务器响应 |

## 核心函数

- `startApp(mode)`: 启动 Electron 应用，支持 test/dev 两种模式
- `closeApp(app)`: 关闭 Electron 应用
- `waitForAppReady(page)`: 等待应用加载完成
- `getMainWindow(app)`: 获取主窗口
