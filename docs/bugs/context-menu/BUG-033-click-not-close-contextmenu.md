# BUG-033: 右键菜单弹出后，左键点击 file-item 或空白区域菜单不消失

## 问题描述

BUG-032 修复后（右键点击 file-item 可以弹出菜单），发现新问题：
**右键弹出菜单后，再左键点击另一个 file-item 或空白区域，右键菜单不会消失。**

用户截图显示：在远程面板右键 "media" 弹出菜单 → 左键点击 "srv" → 菜单仍然显示。

影响范围：SFTP 窗口（embedded 模式）内所有组件

## 根因分析

### DOM 事件冒泡被阻断

```
┌─ .app-layout (@click="handleGlobalClick") ─────────────┐
│  └─ .app-main                                           │
│     └─ .terminal-area                                    │
│        └─ SftpTransfer (embedded mode)                  │
│           └─ .sftp-overlay (@click="handleOverlayClick") │
│              └─ .sftp-window (@click.stop) ← 🔴 阻止冒泡 │
│                 ├─ .file-panel.local                     │
│                 │   └─ .file-list                        │
│                 │      └─ .file-item (用户左键这里)       │
│                 └─ .file-panel.remote                    │
│                                                    [menu]│ ← Teleport to body
└──────────────────────────────────────────────────────────┘
```

### 事件流程（修复前）

```
时间轴 →

1. 用户右键 .file-item → contextmenu.prevent → showContextMenu() → visible = true ✅

2. 用户左键另一个 .file-item
   ↓ click 事件触发
   ↓ 冒泡到 .sftp-window
   ↓ 🔴 @click.stop 阻止继续冒泡！
   ↓ .app-layout 的 @click="handleGlobalClick" 永远收不到事件
   ↓ 菜单保持 visible = true ❌
```

### 为什么 AppLayout 的方案不够

| 方案 | 监听位置 | 能否捕获 @click.stop 内部的点击 |
|------|----------|-------------------------------|
| `.app-layout` @click | 冒泡阶段 | ❌ 被 stopPropagation 阻断 |
| **document addEventListener(click, true)** | **捕获阶段** | ✅ **stopPropagation 不影响捕获** |

> **关键知识**: DOM 事件的 `stopPropagation()` 和 `@click.stop` 只阻止**冒泡阶段**的事件传播，
> 不阻止**捕获阶段**。使用 `addEventListener('click', handler, true)` 可以在捕获阶段拦截所有点击。

## 修复方案

**文件**: [GlobalContextMenu.vue](../../src/renderer/src/components/common/GlobalContextMenu.vue)

在 GlobalContextMenu 组件中添加 **document 级别、捕获阶段**的 click 监听：

```typescript
/**
 * 全局点击关闭菜单（解决 @click.stop 阻止冒泡导致菜单无法关闭的问题）
 */
function handleGlobalClick(event: MouseEvent): void {
  if (!contextMenuStore.visible) return
  const target = event.target as HTMLElement
  const isInsideMenu = target.closest('.global-context-menu, .context-menu-item')
  if (!isInsideMenu) {
    contextMenuStore.hideContextMenu()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown)
  document.addEventListener('click', handleGlobalClick, true)  // ← capture: true
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
  document.removeEventListener('click', handleGlobalClick, true)
})
```

### 设计决策

将全局事件监听统一放在 `GlobalContextMenu.vue` 组件中（而非 AppLayout），原因：

1. **单一职责**: 菜单的生命周期管理集中在菜单组件自身
2. **DOM 层级无关**: document 级别监听不受任何组件的 `@click.stop` 影响
3. **与 ESC 键一致**: ESC 关闭也使用同样的 document 级别模式
4. **自动清理**: 组件卸载时自动移除监听器，避免内存泄漏

## 修复验证

### E2E 测试用例

| 场景 | 描述 | 结果 |
|------|------|------|
| 场景1 | 右键弹出菜单 → 左键点击另一个 file-item → 菜单关闭 | ✅ |
| 场景2 | 右键弹出菜单 → 左键点击空白区域 → 菜单关闭 | ✅ |
| 场景3 | 远程面板同样验证 | ✅ |

测试文件: [bug-033-click-not-close-menu.e2e.spec.ts](../../../e2e/sftp/bug-033-click-not-close-menu.e2e.spec.ts)

### 回归验证

BUG-032 的 4 个场景仍然全部通过，确认无回归问题。

## 关联信息

- **所属功能**: SFTP 文件传输 - 全局右键菜单管理
- **关联 Bug**: BUG-032（右键无法弹出菜单）、BUG-029~031（历史菜单问题）
- **PRD 参考**: [phase2/sftp/prd.md#L231-L234](../plan/phase2/sftp/prd.md#L231-L234) - PRD场景3: 左键关闭菜单
