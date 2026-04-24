# 全局右键菜单 — 代码分析

> 本文档记录 `src/renderer/src/components/common/GlobalContextMenu.vue` 及其配套 Store 的核心逻辑与设计决策。

---

## 架构概览

全局右键菜单采用 **「单一实例 + Pinia 状态管理 + Teleport 挂载」** 模式：

```
┌─────────────────────────────────────────────────────┐
│                   App.vue                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ XTerminal │  │ SFTP 文件 │  │ 其他组件...      │   │
│  │          │  │ 浏览器    │  │                  │   │
│  └────┬─────┘  └────┬─────┘  └───────┬──────────┘   │
│       │ contextmenu  │ contextmenu     │              │
│       ▼             ▼                ▼              │
│  ════════════════════════════════════════           │
│         useContextMenuStore (Pinia)                  │
│    showContextMenu(ownerId, pos, items, callback)     │
│  ════════════════════════════════════════           │
│                       │                              │
│                       ▼ visible=true                 │
│  ┌──────────────────────────────────────────┐        │
│  │ <Teleport to="body">                     │        │
│  │   <div v-if="visible" class="gcm">       │        │
│  │     菜单项（动态渲染）                      │        │
│  │   </div>                                 │        │
│  │ </Teleport>  ← 挂载到 document.body       │        │
│  └──────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────┘
```

**核心原则：全局唯一、谁调用谁提供内容、Store 统一生命周期。**

---

## Teleport 触发机制

### Teleport 本身

`<Teleport to="body">` 是 Vue 的内置组件，**编译时处理**，不是运行时触发。它的作用是：

- 将内部 DOM **移动到 `<body>` 下**，脱离原有组件树位置
- 内部组件的响应式数据绑定、事件监听保持不变

```vue
<!-- GlobalContextMenu.vue -->
<Teleport to="body">
  <div v-if="contextMenuStore.visible && visibleItems.length > 0"
       class="global-context-menu" :style="menuStyle">
    <!-- 菜单项 -->
  </div>
</Teleport>
```

### 显隐控制（真正的「触发时机」）

Teleport 始终存在，但内部 div 的显隐由 **v-if 条件**控制：

| 条件 | 效果 |
|------|------|
| `visible = false` | div 不存在于 DOM |
| `visible = true && items 为空` | div 不存在（防止空菜单容器显示） |
| `visible = true && items 非空` | div 插入 `<body>`，定位在 `(x, y)` |

**触发链路**（以终端右键为例）：

```
用户在 XTerminal 区域右键
  → @contextmenu.prevent 事件触发
    → handleContextMenu(event) 执行
      → const { x, y } = event.clientX/clientY
      → 构建 ContextMenuItem[]（复制/粘贴/全选/审查元素）
      → contextMenuStore.showContextMenu('terminal', { x, y }, items, callback)
        → Store: visible = true, ownerId = 'terminal', position = { x, y }, items = [...]
          → Vue 响应式更新 → v-if 条件满足 → DOM 插入 body
```

**关闭链路**（任一条件触发）：

```
用户点击菜单项
  → handleSelect(action) → callback(action) → hideContextMenu()
用户点击菜单外部区域
  → handleGlobalClick(event) → target 不在 .global-context-menu 内 → hideContextMenu()
用户按 ESC 键
  → handleGlobalKeydown('Escape') → hideContextMenu()
```

---

## Store 状态设计

[contextMenu.ts](./contextMenu.ts) 使用 Pinia Setup Store 风格，核心状态字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `visible` | `Ref<boolean>` | 菜单是否可见 |
| `ownerId` | `Ref<string \| null>` | 当前菜单拥有者标识（如 `'terminal'`、`'sftp-local'`） |
| `position` | `Ref<{ x, y }>` | viewport 坐标（用于 `position: fixed` 定位） |
| `items` | `Ref<ContextMenuItem[]>` | 动态菜单项列表 |
| `onSelect` | `Ref<((action:string)=>void) \| null>` | 点击回调 |

### showContextMenu — 全局唯一性保证

```ts
function showContextMenu(
  ownerUniqueKey: string,
  pos: ContextMenuPosition,
  menuItems: ContextMenuItem[],
  actionCallback?: (action: string) => void
): void {
  // 直接覆盖旧值，无需先 hide — 天然保证唯一性
  visible.value = true
  ownerId.value = ownerUniqueKey
  position.value = { ...pos }
  items.value = menuItems
  onSelect.value = actionCallback || null
}
```

**关键设计决策**：不检查当前是否有已打开的菜单，直接覆写。这意味着：
- A 组件打开菜单后，B 组件调用 `showContextMenu()` 会**立即替换**为 B 的菜单
- 无需手动先调 `hideContextMenu()`
- 避免了「先关后开」的闪烁问题

### hideContextMenu — 完整清理

```ts
function hideContextMenu(): void {
  if (!visible.value) return  // 幂等保护
  visible.value = false
  ownerId.value = null
  items.value = []            // 清空菜单项（v-if 二次判断依赖此）
  onSelect.value = null       // 释放回调引用
}
```

---

## 全局事件处理

GlobalContextMenu 在 `onMounted` 时注册两个**捕获阶段**的全局监听器：

### 1. ESC 关闭（keydown）

```ts
document.addEventListener('keydown', handleGlobalKeydown)

function handleGlobalKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && contextMenuStore.visible) {
    event.preventDefault()
    contextMenuStore.hideContextMenu()
  }
}
```

使用**冒泡阶段**即可，因为 ESC 是键盘事件，不受 `@click.stop` 影响。

### 2. 点击外部关闭（click）

```ts
document.addEventListener('click', handleGlobalClick, true)  // ← 捕获阶段

function handleGlobalClick(event: MouseEvent): void {
  if (!contextMenuStore.visible) return
  const target = event.target as HTMLElement
  const isInsideMenu = target.closest('.global-context-menu, .context-menu-item')
  if (!isInsideMenu) {
    contextMenuStore.hideContextMenu()
  }
}
```

**为什么用捕获阶段 (`true`)？**

根因：SFTP 文件浏览器的 `.sftp-window` 使用了 `@click.stop` 阻止冒泡。如果用冒泡阶段监听，点击 `.sftp-window` 内部区域时事件无法到达 AppLayout 的全局处理器。捕获阶段在**目标到根**路径上先执行，不受 `stopPropagation` 影响。

### 菜单自身的事件隔离

```vue
<div class="global-context-menu"
     @click.stop        <!-- 阻止点击菜单本身时触发关闭 -->
     @contextmenu.stop  <!-- 阻止菜单内右键冒泡 -->
     tabindex="-1">     <!-- 允许获取焦点（可选交互增强） -->
```

---

## 图标系统

菜单项支持 SVG 图标，通过 Vite `import.meta.glob` 静态导入：

```ts
// 编译时收集 ./contextmenu/*.svg 所有文件
const iconModules = import.meta.glob('./contextmenu/*.svg', { eager: true, as: 'raw' })

// 文件名 → SVG 内容 映射表
const iconMap: Record<string, string> = {}
for (const [path, mod] of Object.entries(iconModules)) {
  const name = path.replace(/^\.\/contextmenu\/(.+)\.svg$/, '$1')
  iconMap[name] = mod as string
}
```

**使用方式**：调用方传入 `icon: 'add'`，组件自动查找 `./contextmenu/add.svg` 并渲染。

**设计原因**：使用 `eager: true, as: 'raw'` 在构建时内联 SVG 字符串，避免运行时 `fetch()` 路径解析问题（尤其在 Electron 打包后）。

---

## 各组件接入方式

所有需要右键菜单的组件遵循统一模式：

```typescript
// 1. 引入 Store
import { useContextMenuStore } from '@/stores/contextMenu'
const contextMenuStore = useContextMenuStore()

// 2. 右键事件处理函数
function handleContextMenu(event: MouseEvent): void {
  event.preventDefault()
  const menuItems: ContextMenuItem[] = [
    { action: 'copy', title: '复制', icon: 'copy' },
    { action: 'paste', title: '粘贴', icon: 'paste' },
    // ...根据业务场景定义不同菜单项
  ]
  contextMenuStore.showContextMenu(
    'unique-owner-id',     // 拥有者唯一标识
    { x: event.clientX, y: event.clientY },
    menuItems,
    async (action: string) => {  // 回调：用户点击菜单项后执行
      switch (action) {
        case 'copy': await doCopy(); break
        case 'paste': await doPaste(); break
      }
    }
  )
}

// 3. 模板中绑定
<template>
  <div @contextmenu.prevent="handleContextMenu">
    <!-- 内容区域 -->
  </div>
</template>
```

### 已接入的组件

| 组件 | ownerId | 菜单项 |
|------|---------|--------|
| [XTerminal](../terminal/XTerminal.vue) | `'terminal'` | 复制 / 粘贴 / 全选 / 审查元素 |
| [SFTP 文件浏览器](../terminal/sftp/SftpFileBrowser.vue) | `'sftp-local'` / `'sftp-remote'` | 新建文件夹 / 删除 / 重命名 / 刷新 等 |

---

## 设计优势总结

| 特性 | 实现方式 | 价值 |
|------|---------|------|
| **全局唯一** | 单一 Store + 单一 Teleport 实例 | 不会出现多个右键菜单同时存在的问题 |
| **自动互斥** | `showContextMenu` 直接覆写 | 新菜单替换旧菜单，无闪烁 |
| **内容解耦** | 调用方提供 `items[]` + `callback` | 菜单组件不知道业务逻辑，各组件自定义菜单内容 |
| **样式隔离** | `position: fixed` + Teleport 到 body | 不受父级 `overflow: hidden` / `z-index` 影响 |
| **图标可扩展** | `import.meta.glob` 扫描 SVG 目录 | 新增图标只需放入文件，无需改代码 |
