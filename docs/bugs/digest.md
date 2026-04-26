# Bugs 文档摘要

## 文档目录

| 模块 | 文档数 | 说明 |
|------|--------|------|
| [session/](./session/) | 14 | 会话管理相关（分组、会话表单等） |
| [sftp/](./sftp/) | 14 | SFTP 功能相关（含 delete、ui、upload 子模块） |
| [context-menu/](./context-menu/) | 9 | 右键菜单相关 |
| [tab/](./tab/) | 4 | 标签页管理相关 |
| [theme/](./theme/) | 5 | 主题相关（浅色/深色主题） |
| [ui/](./ui/) | 4 | 其他 UI 问题（窗口拖动、对话框等） |
| [terminal/](./terminal/) | 3 | 终端核心功能（光标、PTY、vim 等） |
| [connection/](./connection/) | 1 | 连接相关 |
| 根目录 | 4 | 跨模块类型错误修复 |

## 详细文档清单

### connection/

| 编号 | 文档 | 状态 |
|------|------|------|
| BUG-012 | [connection/BUG-012-connection-error-no-retry.md](./connection/BUG-012-connection-error-no-retry.md) | ✅ 已修复 |

### context-menu/

| 编号 | 文档 | 状态 |
|------|------|------|
| BUG-010 | [context-menu/BUG-010-inspect-element-positioning.md](./context-menu/BUG-010-inspect-element-positioning.md) | ✅ 已修复 |
| BUG-010 | [context-menu/BUG-010-右击会话弹出两个菜单.md](./context-menu/BUG-010-右击会话弹出两个菜单.md) | ✅ 已修复 |
| BUG-011 | [context-menu/BUG-011-context-menu-conflict.md](./context-menu/BUG-011-context-menu-conflict.md) | ✅ 已修复 |
| BUG-029 | [context-menu/BUG-029-sftp-context-menu-position.md](./context-menu/BUG-029-sftp-context-menu-position.md) | ✅ 已修复 |
| BUG-032 | [context-menu/BUG-032-global-contextmenu-fileitem-not-show.md](./context-menu/BUG-032-global-contextmenu-fileitem-not-show.md) | ✅ 已修复 |
| BUG-033 | [context-menu/BUG-033-click-not-close-contextmenu.md](./context-menu/BUG-033-click-not-close-contextmenu.md) | ✅ 已修复 |
| BUG-034 | [context-menu/BUG-034-unify-session-global-menu.md](./context-menu/BUG-034-unify-session-global-menu.md) | ✅ 已修复 |
| BUG-036 | [context-menu/BUG-036-right-click-overwrites-multiselection.md](./context-menu/BUG-036-right-click-overwrites-multiselection.md) | ✅ 已修复 |
| - | [context-menu/session-list-context-menu.md](./context-menu/session-list-context-menu.md) | ✅ 已修复 |

### session/

| 编号 | 文档 | 状态 |
|------|------|------|
| BUG-001 | [session/BUG-001-默认分组不显示.md](./session/BUG-001-默认分组不显示.md) | ✅ 已修复 |
| BUG-002 | [session/BUG-002-右键菜单添加会话后不消失.md](./session/BUG-002-右键菜单添加会话后不消失.md) | ✅ 已修复 |
| BUG-003 | [session/BUG-003-新建分组弹出框背景太透明.md](./session/BUG-003-新建分组弹出框背景太透明.md) | ✅ 已修复 |
| BUG-007 | [session/BUG-007-编辑会话时密码处理问题.md](./session/BUG-007-编辑会话时密码处理问题.md) | ✅ 已修复 |
| BUG-013 | [session/BUG-013-session-form-click-outside.md](./session/BUG-013-session-form-click-outside.md) | ✅ 已修复 |
| BUG-014 | [session/BUG-014-session-form-password-icon-issues.md](./session/BUG-014-session-form-password-icon-issues.md) | ✅ 已修复 |
| BUG-015 | [session/BUG-015-子分组缩进过大导致超出侧边栏.md](./session/BUG-015-子分组缩进过大导致超出侧边栏.md) | ✅ 已修复 |
| BUG-016 | [session/BUG-016-侧边栏无法拖拽拉伸.md](./session/BUG-016-侧边栏无法拖拽拉伸.md) | ✅ 已修复 |
| BUG-017 | [session/BUG-017-group-inspect-element-clone-error.md](./session/BUG-017-group-inspect-element-clone-error.md) | ✅ 已修复 |
| BUG-018 | [session/BUG-018-默认分组未始终显示在最上方.md](./session/BUG-018-默认分组未始终显示在最上方.md) | ✅ 已修复 |
| BUG-035 | [session/BUG-035-sidebar-unified-menu.md](./session/BUG-035-sidebar-unified-menu.md) | ✅ 已修复 |
| BUG-041 | [session/BUG-041-delete-group-dialog-no-response.md](./session/BUG-041-delete-group-dialog-no-response.md) | ✅ 已修复 |
| BUG-043 | [session/BUG-043-edit-session-group-empty.md](./session/BUG-043-edit-session-group-empty.md) | ✅ 已修复 |
| BUG-044 | [session/BUG-044-edit-session-password-overwrite.md](./session/BUG-044-edit-session-password-overwrite.md) | ✅ 已修复 |

### sftp/

| 编号 | 文档 | 状态 |
|------|------|------|
| BUG-037 | [sftp/BUG-037-sftp-local-text-selection.md](./sftp/BUG-037-sftp-local-text-selection.md) | ✅ 已修复 |

**子模块详见**: [sftp/digest.md](./sftp/digest.md)

### tab/

| 编号 | 文档 | 状态 |
|------|------|------|
| BUG-001 | [tab/BUG-001-tab-switch-terminal-not-switch.md](./tab/BUG-001-tab-switch-terminal-not-switch.md) | ✅ 已修复 |
| BUG-002 | [tab/BUG-002-close-tab-disconnects-all.md](./tab/BUG-002-close-tab-disconnects-all.md) | ✅ 已修复 |
| BUG-008 | [tab/BUG-008-tab-disappears-after-settings.md](./tab/BUG-008-tab-disappears-after-settings.md) | ✅ 已修复 |
| BUG-009 | [tab/BUG-009-tab-add-button.md](./tab/BUG-009-tab-add-button.md) | ✅ 已修复 |

### terminal/

| 编号 | 文档 | 状态 |
|------|------|------|
| BUG-004 | [terminal/BUG-004-bar-cursor-no-blink.md](./terminal/BUG-004-bar-cursor-no-blink.md) | ✅ 已修复 |
| BUG-025 | [terminal/BUG-025-switch-mode-terminal-not-resize.md](./terminal/BUG-025-switch-mode-terminal-not-resize.md) | ✅ 已修复 |
| BUG-045 | [terminal/BUG-045-ssh-vim-no-highlight-dynamic-pty-size.md](./terminal/BUG-045-ssh-vim-no-highlight-dynamic-pty-size.md) | ✅ 已修复 |

### theme/

| 编号 | 文档 | 状态 |
|------|------|------|
| BUG-003 | [theme/BUG-003-light-theme-not-applied.md](./theme/BUG-003-light-theme-not-applied.md) | ✅ 已修复 |
| BUG-005 | [theme/BUG-005-light-theme-selection-contrast.md](./theme/BUG-005-light-theme-selection-contrast.md) | ✅ 已修复 |
| BUG-006 | [theme/BUG-006-theme-inconsistent.md](./theme/BUG-006-theme-inconsistent.md) | ✅ 已修复 |
| BUG-007 | [theme/BUG-007-light-theme-session-form-input.md](./theme/BUG-007-light-theme-session-form-input.md) | ✅ 已修复 |
| - | [theme/light-theme-menu-text.md](./theme/light-theme-menu-text.md) | ✅ 已修复 |

### ui/

| 编号 | 文档 | 状态 |
|------|------|------|
| BUG-024 | [ui/BUG-024-AppLayout-currentMode 未定义.md](./ui/BUG-024-AppLayout-currentMode 未定义.md) | ✅ 已修复 |
| BUG-026 | [ui/BUG-026-sftp-resize-handle-only-first-works.md](./ui/BUG-026-sftp-resize-handle-only-first-works.md) | ✅ 已修复 |
| BUG-027 | [ui/BUG-027-sftp-window-not-full-width.md](./ui/BUG-027-sftp-window-not-full-width.md) | ✅ 已修复 |
| BUG-042 | [ui/BUG-042-window-not-draggable.md](./ui/BUG-042-window-not-draggable.md) | ✅ 已修复 |

### 根目录（类型错误相关）

| 编号 | 文档 | 状态 |
|------|------|------|
| BUG-008 | [BUG-008-TerminalTab-错误对话框属性未定义.md](./BUG-008-TerminalTab-错误对话框属性未定义.md) | ✅ 已修复 |
| BUG-009 | [BUG-009-SessionList-currentWidth 未定义.md](./BUG-009-SessionList-currentWidth 未定义.md) | ✅ 已修复 |
| BUG-024 | [BUG-024-AppLayout-currentMode 未定义.md](./BUG-024-AppLayout-currentMode 未定义.md) | ✅ 已修复 |
| BUG-028 | [BUG-028-vue-tsc-type-errors.md](./BUG-028-vue-tsc-type-errors.md) | ✅ 已修复 |

## 统计汇总

- **总计**: 58 个 Bug 文档
- **已修复**: 58 个 (100%)

### 按模块分布

```
session/        ████████████████████  14 个 (24%)
sftp/           ████████████████████  14 个 (24%)
context-menu/   ██████████████         9 个 (16%)
tab/            ███████                4 个 (7%)
theme/          ████████               5 个 (9%)
ui/             ███████                4 个 (7%)
terminal/       █████                  3 个 (5%)
connection/     ██                     1 个 (2%)
根目录          ███████                4 个 (7%)
```
