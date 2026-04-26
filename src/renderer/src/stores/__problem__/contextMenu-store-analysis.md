# ContextMenu Store 问题分析

> 文件路径: `src/renderer/src/stores/contextMenu.ts`

## 1. 数据一致性问题

### 1.1 回调函数未清理可能导致内存泄漏

**严重程度**: 中

**问题描述**:
`onSelect` 回调函数在 `hideContextMenu` 时被置为 `null`，但如果组件在菜单显示期间被销毁，回调可能持有已销毁组件的引用。

**代码位置**:
```typescript
const onSelect = ref<((action: string) => void) | null>(null)

function hideContextMenu(): void {
  if (!visible.value) return
  visible.value = false
  ownerId.value = null
  items.value = []
  onSelect.value = null
}
```

**建议修复**:
- 在组件 `onUnmounted` 时主动调用 `hideContextMenu()`
- 或使用弱引用存储回调

---

### 1.2 缺少菜单防重复显示机制

**严重程度**: 低

**问题描述**:
如果快速多次右键点击，可能触发多次 `showContextMenu`，虽然会覆盖状态，但可能产生意外的视觉闪烁。

**建议修复**:
- 添加防抖：`if (visible.value) hideContextMenu()`
- 或使用 `requestAnimationFrame` 延迟显示

---

## 2. 类型安全问题

### 2.1 `ContextMenuItem` 接口定义不完整

**严重程度**: 低

**问题描述**:
`ContextMenuItem` 接口缺少一些常用属性，如：
- `disabled`: 禁用状态
- `divider`: 分隔线
- `shortcut`: 快捷键提示
- `children`: 子菜单

**建议修复**:
```typescript
export interface ContextMenuItem {
  action: string
  title: string
  icon?: string
  description?: string
  visible?: boolean
  danger?: boolean
  disabled?: boolean      // 新增
  divider?: boolean       // 新增
  shortcut?: string       // 新增
  children?: ContextMenuItem[]  // 新增
}
```

---

## 3. 功能缺失

### 3.1 缺少键盘导航支持

**严重程度**: 中

**问题描述**:
右键菜单不支持键盘导航（上下箭头选择、Enter 确认），不符合无障碍访问标准。

**建议修复**:
- 添加 `focusedIndex` 状态
- 监听键盘事件处理导航
- 在 `showContextMenu` 时自动聚焦第一个菜单项

---

### 3.2 缺少子菜单支持

**严重程度**: 低

**问题描述**:
当前设计不支持嵌套子菜单，限制了菜单的扩展性。

**建议修复**:
- 在 `ContextMenuItem` 中添加 `children` 字段
- 添加 `showSubMenu` 方法

---

### 3.3 缺少菜单位置边界检测

**严重程度**: 中

**问题描述**:
`updatePosition` 方法存在，但 `showContextMenu` 没有自动检测边界，可能导致菜单超出视口。

**代码位置**:
```typescript
function showContextMenu(
  ownerUniqueKey: string,
  pos: ContextMenuPosition,
  menuItems: ContextMenuItem[],
  actionCallback?: (action: string) => void
): void {
  visible.value = true
  ownerId.value = ownerUniqueKey
  position.value = { ...pos }  // 直接赋值，未检测边界
  items.value = menuItems
  onSelect.value = actionCallback || null
}
```

**建议修复**:
- 在 `showContextMenu` 中自动检测并调整位置
- 考虑菜单尺寸与视口大小的关系

---

## 4. 性能问题

### 4.1 每次显示菜单都创建新对象

**严重程度**: 低

**问题描述**:
`position.value = { ...pos }` 每次都创建新对象，虽然保证了响应式，但在频繁操作时可能产生不必要的开销。

**建议修复**:
- 如果 `pos` 已经是新对象，可以直接赋值
- 或使用 `Object.assign` 更新属性

---

## 5. 响应式问题

### 5.1 `items` 数组替换可能不触发深度响应式

**严重程度**: 低

**问题描述**:
`items.value = menuItems` 直接替换整个数组，如果调用方传入的是响应式数组的引用，可能导致意外行为。

**建议修复**:
```typescript
items.value = [...menuItems]  // 确保创建新数组
```

---

## 6. 架构问题

### 6.1 全局单例限制了多菜单场景

**严重程度**: 低

**问题描述**:
当前设计为全局单例，无法同时显示多个右键菜单（如主菜单和子菜单）。

**建议修复**:
- 如果不需要多菜单，保持现状
- 如果需要，可改为工厂模式创建多个实例

---

## 总结

| 问题类型 | 数量 | 严重程度 |
|---------|------|---------|
| 数据一致性 | 2 | 中/低 |
| 类型安全 | 1 | 低 |
| 功能缺失 | 3 | 中/低 |
| 性能问题 | 1 | 低 |
| 响应式问题 | 1 | 低 |
| 架构问题 | 1 | 低 |

**优先修复建议**:
1. 添加菜单位置边界检测
2. 添加键盘导航支持
3. 完善 `ContextMenuItem` 接口定义
4. 确保回调函数正确清理
