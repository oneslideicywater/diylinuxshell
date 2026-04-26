# GlobalContextMenu 组件问题分析

> 文件路径: `src/renderer/src/components/common/GlobalContextMenu.vue`

## 1. 性能问题

### 1.1 全局事件监听器未优化

**严重程度**: 中

**问题描述**:
在 `document` 上监听 `click` 和 `keydown` 事件，每次点击都会触发，即使菜单未显示。

**代码位置**:
```typescript
onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown)
  document.addEventListener('click', handleGlobalClick, true)  // 捕获阶段
})
```

**建议修复**:
```typescript
// 只在菜单可见时添加监听器
watch(() => contextMenuStore.visible, (visible) => {
  if (visible) {
    document.addEventListener('keydown', handleGlobalKeydown)
    document.addEventListener('click', handleGlobalClick, true)
  } else {
    document.removeEventListener('keydown', handleGlobalKeydown)
    document.removeEventListener('click', handleGlobalClick, true)
  }
})
```

---

### 1.2 图标预加载可能影响启动性能

**严重程度**: 低

**问题描述**:
使用 `import.meta.glob` 预加载所有 SVG 图标，如果图标数量增加，可能影响启动时间。

**代码位置**:
```typescript
const iconModules = import.meta.glob('./contextmenu/*.svg', { eager: true, as: 'raw' })
```

**建议修复**:
- 如果图标数量不多，保持现状
- 如果图标很多，考虑按需加载

---

## 2. 功能缺失

### 2.1 缺少菜单位置边界检测

**严重程度**: 高

**问题描述**:
菜单可能超出视口边界，用户无法看到完整菜单。

**代码位置**:
```typescript
const menuStyle = computed(() => {
  const pos = contextMenuStore.position
  return {
    left: `${pos.x}px`,
    top: `${pos.y}px`
  }
})
```

**建议修复**:
```typescript
const menuStyle = computed(() => {
  const pos = contextMenuStore.position
  const menuWidth = 200  // 预估宽度
  const menuHeight = contextMenuStore.items.length * 40  // 预估高度
  
  const adjustedX = Math.min(pos.x, window.innerWidth - menuWidth)
  const adjustedY = Math.min(pos.y, window.innerHeight - menuHeight)
  
  return {
    left: `${Math.max(0, adjustedX)}px`,
    top: `${Math.max(0, adjustedY)}px`
  }
})
```

---

### 2.2 缺少键盘导航支持

**严重程度**: 中

**问题描述**:
不支持上下箭头键导航菜单项。

**建议修复**:
- 添加 `focusedIndex` 状态
- 监听箭头键更新焦点
- 按 Enter 执行选中项

---

### 2.3 缺少分隔线支持

**严重程度**: 低

**问题描述**:
`ContextMenuItem` 接口没有 `divider` 字段，无法显示分隔线。

**建议修复**:
- 在 Store 的 `ContextMenuItem` 接口添加 `divider?: boolean`
- 在模板中渲染分隔线

---

## 3. 安全问题

### 3.1 `v-html` 渲染 SVG 可能存在 XSS 风险

**严重程度**: 中

**问题描述**:
使用 `v-html` 渲染 SVG 内容，如果 SVG 来源不可信，可能执行恶意脚本。

**代码位置**:
```vue
<span
  v-if="item.icon && getIconSvg(item.icon)"
  class="menu-item-icon"
  v-html="getIconSvg(item.icon)"
/>
```

**建议修复**:
- 当前使用 `import.meta.glob` 静态导入，来源可信，风险较低
- 如果未来支持动态图标，需要清理 SVG 内容

---

## 4. 样式问题

### 4.1 z-index 过高

**严重程度**: 低

**问题描述**:
`z-index: 99999` 过高，可能与其他组件冲突。

**建议修复**:
- 使用 CSS 变量管理 z-index
- 或定义统一的层级系统

---

### 4.2 缺少动画过渡

**严重程度**: 低

**问题描述**:
菜单显示/隐藏没有动画，体验不够流畅。

**建议修复**:
```vue
<transition name="context-menu-fade">
  <div v-if="..." class="global-context-menu">
    <!-- ... -->
  </div>
</transition>
```

---

## 5. 代码质量问题

### 5.1 图标映射构建在模块作用域

**严重程度**: 低

**问题描述**:
`iconMap` 在模块加载时构建，如果组件被多次实例化（虽然不太可能），会重复构建。

**代码位置**:
```typescript
const iconMap: Record<string, string> = {}
for (const [path, mod] of Object.entries(iconModules)) {
  const name = extractIconName(path)
  iconMap[name] = (mod as string)
}
```

**建议修复**:
- 保持现状（模块只加载一次）
- 或使用 `Object.fromEntries` 简化

```typescript
const iconMap: Record<string, string> = Object.fromEntries(
  Object.entries(iconModules).map(([path, mod]) => [
    extractIconName(path),
    mod as string
  ])
)
```

---

### 5.2 全局事件监听器清理依赖组件卸载

**严重程度**: 中

**问题描述**:
如果组件在菜单显示期间被卸载，事件监听器会被清理，但菜单可能仍然显示。

**建议修复**:
```typescript
onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
  document.removeEventListener('click', handleGlobalClick, true)
  // 关闭菜单
  contextMenuStore.hideContextMenu()
})
```

---

## 6. 架构问题

### 6.1 与 Store 强耦合

**严重程度**: 低

**问题描述**:
组件直接依赖 `useContextMenuStore`，无法用于其他菜单场景。

**建议修复**:
- 如果只需要一个全局菜单，保持现状
- 如果需要多菜单支持，改为通过 props 接收数据

---

## 总结

| 问题类型 | 数量 | 严重程度 |
|---------|------|---------|
| 性能问题 | 2 | 中/低 |
| 功能缺失 | 3 | 高/中 |
| 安全问题 | 1 | 中 |
| 样式问题 | 2 | 低 |
| 代码质量 | 2 | 中/低 |
| 架构问题 | 1 | 低 |

**优先修复建议**:
1. 添加菜单位置边界检测
2. 优化全局事件监听器（只在菜单可见时监听）
3. 添加键盘导航支持
4. 确保组件卸载时关闭菜单
