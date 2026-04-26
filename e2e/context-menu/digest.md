# Context Menu 测试用例摘要

## 测试职责

测试应用中所有右键菜单的显示、内容、交互行为。

## 测试文件清单

| 文件 | 描述 |
|------|------|
| [add-session-menu-close.e2e.spec.ts](./add-session-menu-close.e2e.spec.ts) | 添加会话菜单关闭行为 |
| [check-all-context-menus.e2e.spec.ts](./check-all-context-menus.e2e.spec.ts) | 检查所有 context-menu 元素的状态、可见性、样式 |
| [check-spacer-div.e2e.spec.ts](./check-spacer-div.e2e.spec.ts) | 检查分隔线 div 的右键菜单 |
| [context-menu-icon-load.e2e.spec.ts](./context-menu-icon-load.e2e.spec.ts) | 右键菜单图标加载 |
| [test-session-below-context-menu.e2e.spec.ts](./test-session-below-context-menu.e2e.spec.ts) | 会话下方空白区域右键菜单 |
| [test-spacer-context-menu.e2e.spec.ts](./test-spacer-context-menu.e2e.spec.ts) | 分隔线区域上下文菜单 |

## 测试覆盖范围

- 会话列表空白区域右键菜单（新建分组）
- 会话项右键菜单（连接/编辑/删除）
- 分隔线右键菜单
- 菜单项可见性和样式
- 菜单图标加载
- 菜单关闭行为
