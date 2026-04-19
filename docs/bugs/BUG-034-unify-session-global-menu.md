# BUG-034: GroupHeader 和 SessionItem 右键菜单未使用全局统一组件

## 问题描述

全局右键菜单重构（BUG-032/033）完成后，`GroupHeader.vue` 和 `SessionItem.vue` 两个组件
仍然使用**内联渲染**的 `.context-menu` DOM 元素，而非统一的 `GlobalContextMenu.vue` 组件。

这违反了 PRD 中「整个项目全局使用一个右键菜单组件」的设计理念。

## 问题分析

### 重构前状态

| 组件 | 内联 `.context-menu` DOM | 自定义 CSS (~60行) | 自己的 handleClickOutside | 传入空 `menuItems: []` |
|------|--------------------------|--------------------|---------------------------|------------------------|
| GroupHeader | ✅ 有 | ✅ | ✅ | ✅ |
| SessionItem | ✅ 有 | ✅ | ✅ | ✅ |

两个组件虽然使用了 `contextMenuStore` 管理显示/隐藏/所有权，但：
1. **各自渲染独立的菜单 DOM**（不是 Teleport 到 body 的全局组件）
2. **各自维护一套完整的菜单样式代码**
3. **各自实现点击外部关闭逻辑**（document addEventListener）
4. **传入空的 menuItems 数组**，完全没利用 Store 的动态菜单项能力

### 重构后状态

| 组件 | 内联 DOM | 自定义 CSS | menuItems | actionCallback |
|------|---------|------------|-----------|----------------|
| GroupHeader | ❌ 已移除 | ❌ 已移除 | ✅ 5 项 | ✅ switch/case |
| SessionItem | ❌ 已移除 | ❌ 已移除 | ✅ 6 项 | ✅ switch/case |

## 重构方案

### 核心变更：handleContextMenu 函数

**重构前**（GroupHeader）:
```typescript
contextMenuStore.showContextMenu(menuOwnerId.value, { x, y }, [])
// + 6 个独立 handler 函数
// + handleClickOutside + document listener
```

**重构后**:
```typescript
const menuItems = [
  { action: 'add-session', title: '添加会话', description: '...' },
  { action: 'create-subgroup', title: '新建子分组', visible: props.canCreateSubGroup },
  { action: 'edit-group', title: '编辑分组', description: '...' },
  { action: 'delete-group', title: '删除分组', description: '...' },
  { action: 'inspect', title: '审查元素', description: '...' }
]

contextMenuStore.showContextMenu(menuOwnerId.value, { x, y }, menuItems, (action) => {
  switch (action) {
    case 'add-session': emit('add-session-to-group', props.group); break
    case 'create-subgroup': emit('create-subgroup', props.group); break
    // ...
  }
})
```

### 额外修复

- **SessionItem**: 添加 `@contextmenu.prevent.stop` 防止事件冒泡到外层元素

## 修改文件清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| [GroupHeader.vue](../../src/renderer/src/components/session/GroupHeader.vue) | 重构 | 移除内联菜单 DOM/CSS/handler，改用 Store menuItems |
| [SessionItem.vue](../../src/renderer/src/components/session/SessionItem.vue) | 重构 | 同上 + 添加 .stop 阻止冒泡 |

## 修复验证

### E2E 测试用例

| 场景 | 描述 | 结果 |
|------|------|------|
| 场景1 | 右键 GroupHeader → `.global-context-menu` 弹出（非旧 `.context-menu`） | ✅ |
| 场景2 | 右键 SessionItem → `.global-context-menu` 弹出（含连接/编辑/复制等） | ✅ |
| 场景3 | 点击菜单项 → 菜单自动关闭（通过 handleSelect） | ✅ |
| 场景4 | 全局互斥：不同组件切换时菜单内容正确更新 | ✅ |

测试文件: [bug-034-unified-global-menu.e2e.spec.ts](../../../e2e/session/bug-034-unified-global-menu.e2e.spec.ts)

### 回归验证

BUG-032 (4场景) + BUG-033 (3场景) = **7/7 全部通过**

## 关联信息

- **所属功能**: 会话管理 - 分组和会话项的右键菜单
- **关联 Bug**: BUG-032（file-item 菜单不弹出）、BUG-033（左键不关菜单）
- **PRD 参考**: [phase2/sftp/prd.md#L217-L225](../plan/phase2/sftp/prd.md#L217-L225) - 全局唯一菜单设计
