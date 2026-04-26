# Layout 测试用例摘要

## 测试职责

测试应用布局、侧边栏拖拽、标签页功能和持久化。

## 测试文件清单

| 文件 | 描述 |
|------|------|
| [app-sidebar-resize.e2e.spec.ts](./app-sidebar-resize.e2e.spec.ts) | 侧边栏拖拽调整宽度功能 |
| [tab-persistence.e2e.spec.ts](./tab-persistence.e2e.spec.ts) | 标签页状态持久化（刷新/重启后保持） |
| [tabs.e2e.spec.ts](./tabs.e2e.spec.ts) | 多标签页创建、切换、关闭功能 |

## 测试覆盖范围

- 侧边栏拖拽调整大小
- 标签页创建和切换
- 标签页关闭
- 标签页状态持久化
- 应用重启后标签页恢复
