# Terminal 测试用例摘要

## 测试职责

测试终端功能，包括终端右键菜单、Vim 编辑器支持、SFTP 断开重连、SSH/SFTP 模式切换、会话编辑按钮。

## 测试文件清单

| 文件 | 描述 |
|------|------|
| [session-edit-button.e2e.spec.ts](./session-edit-button.e2e.spec.ts) | 会话编辑按钮功能 |
| [sftp-disconnect-reconnect.e2e.spec.ts](./sftp-disconnect-reconnect.e2e.spec.ts) | SFTP 断开后重新连接 |
| [ssh-sftp-mode-switch.e2e.spec.ts](./ssh-sftp-mode-switch.e2e.spec.ts) | SSH 和 SFTP 模式切换 |
| [terminal-context-menu.e2e.spec.ts](./terminal-context-menu.e2e.spec.ts) | 终端右键菜单（复制/粘贴等） |
| [vim.e2e.spec.ts](./vim.e2e.spec.ts) | Vim 编辑器支持 |

## 测试覆盖范围

- 终端右键菜单（复制/粘贴/全选）
- Vim 模式进入和退出
- SFTP 断开和重连
- SSH/SFTP 模式切换
- 会话编辑按钮交互
