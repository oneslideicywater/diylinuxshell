# BUG-011: 右键菜单冲突问题

## 问题描述

**发现时间**: 2026-04-02  
**严重程度**: P1  
**影响范围**: 用户体验

### 现象
当用户右键点击标签页打开菜单后，再右键点击终端主内容区域，终端的右键菜单也会出现，而标签页的右键菜单仍然保持打开状态。此时界面上同时显示两个右键菜单，造成界面混乱。

### 预期行为
同一时间应该只有一个右键菜单显示。当打开一个菜单时，其他已打开的菜单应该自动关闭。

## 问题原因

### 根本原因
各个组件（XTerminal、TerminalTab、SessionItem）各自独立管理自己的右键菜单状态，缺乏统一的菜单状态协调机制。

### 技术分析
1. **XTerminal.vue**: 使用 `contextMenuVisible` ref 管理终端右键菜单的显示状态
2. **TerminalTab.vue**: 使用独立的 `contextMenuVisible` ref 管理标签页右键菜单的显示状态
3. **SessionItem.vue**: 使用独立的 `contextMenuVisible` ref 管理会话右键菜单的显示状态
4. **缺乏协调**: 组件之间没有通信机制，无法感知对方的菜单状态

### 代码位置
- `src/renderer/src/components/terminal/XTerminal.vue`
- `src/renderer/src/components/terminal/TerminalTab.vue`
- `src/renderer/src/components/session/SessionItem.vue`

## 解决方案

### 方案选择
采用 **全局状态管理方案**，使用 Pinia Store 统一管理所有右键菜单的状态。

### 方案优势
1. ✅ 状态集中管理，易于维护和调试
2. ✅ 可以使用 Vue 的响应式系统
3. ✅ 易于扩展（可以添加更多菜单类型）
4. ✅ 符合 Vue 的最佳实践

### 实现步骤

#### 1. 创建全局状态管理 Store

**文件**: `src/renderer/src/stores/contextMenu.ts`

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 右键菜单类型
 */
export type ContextMenuType = 'terminal' | 'tab' | 'session' | 'none'

/**
 * 右键菜单状态管理 Store
 * 确保同一时间只有一个右键菜单显示
 */
export const useContextMenuStore = defineStore('contextMenu', () => {
  // 当前打开的菜单类型
  const currentMenu = ref<ContextMenuType>('none')

  /**
   * 打开指定类型的菜单
   * 如果已有其他菜单打开，会自动关闭
   * @param type 菜单类型
   */
  function openMenu(type: ContextMenuType): void {
    currentMenu.value = type
  }

  /**
   * 关闭当前菜单
   */
  function closeMenu(): void {
    currentMenu.value = 'none'
  }

  /**
   * 检查指定类型的菜单是否打开
   * @param type 菜单类型
   * @returns 是否打开
   */
  function isMenuOpen(type: ContextMenuType): boolean {
    return currentMenu.value === type
  }

  return {
    currentMenu,
    openMenu,
    closeMenu,
    isMenuOpen
  }
})
```

#### 2. 修改 XTerminal.vue

**修改点**:
1. 导入 `useContextMenuStore`
2. 在 `handleContextMenu` 中调用 `openMenu('terminal')`
3. 添加 `watch` 监听 `currentMenu` 变化，当不是 `'terminal'` 时关闭菜单

```typescript
// 导入
import { useContextMenuStore } from '@/stores/contextMenu'

// 使用 store
const contextMenuStore = useContextMenuStore()

// 处理右键菜单显示
const handleContextMenu = (event: MouseEvent): void => {
  event.preventDefault()
  
  // 打开终端菜单（会自动关闭其他菜单）
  contextMenuStore.openMenu('terminal')
  
  // ... 其他代码
}

// 监听菜单状态变化，确保菜单互斥
watch(
  () => contextMenuStore.currentMenu,
  (newMenu) => {
    // 如果当前菜单不是终端菜单，关闭终端菜单
    if (newMenu !== 'terminal') {
      contextMenuVisible.value = false
    }
  }
)
```

#### 3. 修改 TerminalTab.vue

**修改点**:
1. 导入 `useContextMenuStore`
2. 在 `handleContextMenu` 中调用 `openMenu('tab')`
3. 添加 `watch` 监听 `currentMenu` 变化，当不是 `'tab'` 时关闭菜单

```typescript
// 导入
import { useContextMenuStore } from '@/stores/contextMenu'

// 使用 store
const contextMenuStore = useContextMenuStore()

// 处理右键菜单显示
const handleContextMenu = (event: MouseEvent): void => {
  // 打开标签页菜单（会自动关闭其他菜单）
  contextMenuStore.openMenu('tab')
  
  // ... 其他代码
}

// 监听菜单状态变化，确保菜单互斥
watch(
  () => contextMenuStore.currentMenu,
  (newMenu) => {
    // 如果当前菜单不是标签页菜单，关闭标签页菜单
    if (newMenu !== 'tab') {
      contextMenuVisible.value = false
    }
  }
)
```

#### 4. 修改 SessionItem.vue

**修改点**:
1. 导入 `useContextMenuStore`
2. 在 `handleContextMenu` 中调用 `openMenu('session')`
3. 添加 `watch` 监听 `currentMenu` 变化，当不是 `'session'` 时关闭菜单
4. 添加右键菜单功能，包含：连接、编辑、复制会话、删除、属性等选项

```typescript
// 导入
import { useContextMenuStore } from '@/stores/contextMenu'

// 使用 store
const contextMenuStore = useContextMenuStore()

// 处理右键菜单显示
const handleContextMenu = (event: MouseEvent): void => {
  // 打开会话菜单（会自动关闭其他菜单）
  contextMenuStore.openMenu('session')
  
  // ... 其他代码
}

// 监听菜单状态变化，确保菜单互斥
watch(
  () => contextMenuStore.currentMenu,
  (newMenu) => {
    // 如果当前菜单不是会话菜单，关闭会话菜单
    if (newMenu !== 'session') {
      contextMenuVisible.value = false
    }
  }
)
```

## 工作原理

1. **状态集中**: 所有菜单状态集中在 `contextMenuStore` 中管理
2. **互斥机制**: 当调用 `openMenu('terminal')` 时，`currentMenu` 变为 `'terminal'`
3. **自动关闭**: 其他组件通过 `watch` 监听到 `currentMenu` 变化，发现不是自己的类型，自动关闭菜单
4. **响应式更新**: 利用 Vue 的响应式系统，状态变化自动触发视图更新

## 测试计划

### 测试用例
1. 右键点击标签页，验证标签页菜单显示
2. 右键点击终端区域，验证标签页菜单自动关闭，终端菜单显示
3. 右键点击会话项，验证会话菜单显示
4. 验证会话菜单与标签页菜单、终端菜单的互斥行为
5. 点击菜单外部，验证菜单关闭

### 测试文件
- `e2e/tabs.e2e.spec.ts` - 标签页菜单互斥测试用例
- `e2e/terminal-context-menu.e2e.spec.ts` - 会话菜单测试用例

## 修复验证

### 验证步骤
1. 启动应用
2. 创建 SSH 连接，打开标签页
3. 右键点击标签页，观察菜单显示
4. 右键点击终端区域，观察标签页菜单是否关闭，终端菜单是否显示
5. 右键点击会话项，观察其他菜单是否关闭，会话菜单是否显示
6. 验证同一时间只有一个菜单显示

### 预期结果
✅ 同一时间只有一个右键菜单显示  
✅ 打开新菜单时，旧菜单自动关闭  
✅ 菜单切换流畅，无闪烁或延迟  
✅ 会话菜单功能完整（连接、编辑、复制、删除、属性）

## 相关文档

- [PRD - 标签页右键菜单](../PRD.md#标签页管理)
- [Phase1 PRD - 标签页右键菜单](../plan/phase1/prd.md#功能列表)

## 备注

### 其他解决方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **全局状态管理** | 状态集中、易维护、可扩展 | 需要创建新的 store | ⭐⭐⭐⭐⭐ |
| **自定义事件** | 组件解耦、实现简单 | 需要手动管理事件 | ⭐⭐⭐⭐ |
| **DOM 查询** | 实现最简单 | 性能差、不够优雅 | ⭐⭐ |

最终选择全局状态管理方案，因为它最符合 Vue 的最佳实践，且易于维护和扩展。

### 新增功能

在修复此 bug 的过程中，同时为会话列表项添加了右键菜单功能，包含以下选项：
- **连接**: 连接到会话
- **编辑**: 编辑会话配置
- **复制会话**: 创建会话副本
- **删除**: 删除会话
- **属性**: 查看会话属性

所有菜单都使用统一的全局状态管理，确保互斥行为一致。
