# 会话管理 - 右键菜单

## 功能概述

会话管理模块包含三个使用右键菜单的组件：
- **GroupHeader**: 分组头部，右键弹出分组管理菜单
- **SessionItem**: 会话项，右键弹出会话操作菜单
- **SessionSidebarContainer**: 会话列表容器，右键空白区域弹出新建分组菜单

重构后统一使用 `GlobalContextMenu.vue` + `contextMenuStore`。

## 功能与测试用例对应关系

| 功能点 | 测试文件 | 测试场景 | 状态 |
|--------|----------|----------|------|
| GroupHeader 右键使用全局菜单 | [bug-034-unified-global-menu.e2e.spec.ts](../../../e2e/session/bug-034-unified-global-menu.e2e.spec.ts) | 场景1 | ✅ |
| SessionItem 右键使用全局菜单 | 同上 | 场景2 | ✅ |
| 菜单项点击后自动关闭 | 同上 | 场景3 | ✅ |
| 全局互斥（不同组件切换） | 同上 | 场景4 | ✅ |
| Sidebar 列表右键使用全局菜单 | [bug-035-sidebar-unified-menu.e2e.spec.ts](../../../e2e/session/bug-035-sidebar-unified-menu.e2e.spec.ts) | 场景1 | ✅ |
| 菜单只显示 title（无 description） | 同上 | 场景2 | ✅ |
| 点击菜单项触发对应操作 | 同上 | 场景3 | ✅ |
| 菜单项高度/字体大小符合要求 | 同上 | 场景4 | ✅ |

## Bug 与测试用例对应关系

| Bug 编号 | Bug 描述 | 测试文件 | 修复状态 |
|----------|----------|----------|----------|
| BUG-034 | GroupHeader/SessionItem 未使用全局右键菜单 | [bug-034-unified-global-menu.e2e.spec.ts](../../../e2e/session/bug-034-unified-global-menu.e2e.spec.ts) | ✅ 已修复 |
| BUG-035 | SessionSidebarContainer 未使用全局菜单 + 样式优化 | [bug-035-sidebar-unified-menu.e2e.spec.ts](../../../e2e/session/bug-035-sidebar-unified-menu.e2e.spec.ts) | ✅ 已修复 |

## Bug 与所属功能对应关系

| Bug 编号 | 所属功能 | 关联说明 |
|----------|----------|----------|
| BUG-034 | 会话管理 - 右键菜单 (GroupHeader/SessionItem) | 统一为 GlobalContextMenu 组件 |
| BUG-035 | 会话管理 - 右键菜单 (Sidebar) + 全局菜单样式 | 统一为 GlobalContextMenu + 优化样式 |
