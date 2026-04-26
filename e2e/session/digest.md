# Session 测试用例摘要

## 测试职责

测试会话分组功能，包括分组创建、编辑、删除、子分组、嵌套层级、右键菜单和已知 bug 修复验证。

## 测试文件清单

| 文件 | 描述 |
|------|------|
| [bug-034-unified-global-menu.e2e.spec.ts](./bug-034-unified-global-menu.e2e.spec.ts) | BUG-034: GroupHeader/SessionItem 统一全局右键菜单修复验证 |
| [bug-035-sidebar-unified-menu.e2e.spec.ts](./bug-035-sidebar-unified-menu.e2e.spec.ts) | BUG-035: Sidebar 统一全局菜单 + 样式优化验证 |
| [debug-session-group-contextmenu.e2e.spec.ts](./debug-session-group-contextmenu.e2e.spec.ts) | 会话分组右键菜单调试 |
| [five-level-nested-groups.e2e.spec.ts](./five-level-nested-groups.e2e.spec.ts) | 五层嵌套子分组创建和显示 |
| [group-contextmenu-bugfix.e2e.spec.ts](./group-contextmenu-bugfix.e2e.spec.ts) | 分组右键菜单 bug 修复验证 |
| [group-refactoring-validation.e2e.spec.ts](./group-refactoring-validation.e2e.spec.ts) | 分组重构后功能验证 |
| [last-level-group-display-fix.e2e.spec.ts](./last-level-group-display-fix.e2e.spec.ts) | 最后一层分组文字显示效果修复验证 |
| [session-group.e2e.spec.ts](./session-group.e2e.spec.ts) | 会话分组基础功能（创建/编辑/删除/子分组） |
| [subgroup-indent.e2e.spec.ts](./subgroup-indent.e2e.spec.ts) | 子分组缩进显示 |
| [subgroup-padding-validation.e2e.spec.ts](./subgroup-padding-validation.e2e.spec.ts) | 子分组缩进验证 |
| [third-level-diagnostic.e2e.spec.ts](./third-level-diagnostic.e2e.spec.ts) | 三级分组诊断测试 |
| [third-level-group-bugfix.e2e.spec.ts](./third-level-group-bugfix.e2e.spec.ts) | 三级分组 bug 修复验证 |
| [third-level-group-session-bug.e2e.spec.ts](./third-level-group-session-bug.e2e.spec.ts) | 三级分组会话 bug 验证 |

## 测试覆盖范围

- 分组创建（右键菜单/按钮）
- 分组编辑（名称/图标）
- 分组删除
- 子分组创建
- 多层嵌套分组（最多 5 层）
- 分组缩进和样式
- 分组右键菜单
- 分组层级提示
- 深色/浅色主题适配
- 已知 bug 修复回归测试
