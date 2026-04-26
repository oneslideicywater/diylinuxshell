# BUG-035: SessionSidebarContainer 右键菜单未统一 + 全局菜单样式优化

## 问题描述

1. **SessionSidebarContainer.vue** 的列表右键菜单（新建分组）仍使用内联 `.context-menu` DOM，
   未统一到 `GlobalContextMenu` 组件
2. 全局右键菜单显示 **title + description** 两行文字，用户希望**只显示 title**
3. 菜单项高度偏大，字体偏大，需要缩小

## 问题分析

### SessionSidebarContainer 重构前状态

| 项目 | 重构前 | 重构后 |
|------|--------|--------|
| 内联 `.context-menu` DOM | ✅ 有（含 SVG 图标） | ❌ 已移除 |
| `listContextMenuVisible` 状态 | ✅ ref | ❌ 已移除 |
| `listContextMenuStyle` 样式 | ✅ ref | ❌ 已移除 |
| `handleCreateGroup` 手动关闭 | ✅ `listContextMenuVisible = false` | ❌ 不需要 |
| contextMenuStore | ❌ 未使用 | ✅ showContextMenu |

### GlobalContextMenu 样式变更

| 属性 | 变更前 | 变更后 |
|------|--------|--------|
| description 显示 | `v-if="item.description"` 显示 | ❌ 完全移除 |
| 菜单项 padding | `8px 16px` | `5px 12px` |
| 菜单容器 padding | `4px 0` | `3px 0` |
| 最小宽度 | `200px` | `140px` |
| 标题字号 | `13px` (font-weight: 500) | `12px` |
| 布局方向 | `flex-direction: column` + `gap: 2px` | `align-items: center` 单行 |
| danger 颜色 | 无 | `#f56c6c` |

## 修改文件清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| [SessionSidebarContainer.vue](../../src/renderer/src/components/session/SessionSidebarContainer.vue) | 重构 | 移除内联菜单 DOM/CSS/状态，改用 Store menuItems |
| [GlobalContextMenu.vue](../../src/renderer/src/components/common/GlobalContextMenu.vue) | 样式优化 | 只显示 title，缩小尺寸，添加 danger 样式 |

## 修复验证

### E2E 测试用例

| 场景 | 描述 | 结果 |
|------|------|------|
| 场景1 | 右键列表空白区域 → `.global-context-menu` 弹出（含"新建分组"） | ✅ |
| 场景2 | 菜单无 `.menu-item-description` 元素 | ✅ |
| 场景3 | 点击"新建分组" → 菜单关闭 + 分组表单打开 | ✅ |
| 场景4 | padding ≤6px, 字号 ≤13px | ✅ |

测试文件: [bug-035-sidebar-unified-menu.e2e.spec.ts](../../../e2e/session/bug-035-sidebar-unified-menu.e2e.spec.ts)

### 回归验证

BUG-034 (4场景) = **4/4 全部通过**

## 关联信息

- **所属功能**: 会话管理 - 列表区域右键菜单
- **关联 Bug**: BUG-034（GroupHeader/SessionItem 统一菜单）
- **PRD 参考**: [phase2/sftp/prd.md#L217-L225](../plan/phase2/sftp/prd.md#L217-L225) - 全局唯一菜单设计
