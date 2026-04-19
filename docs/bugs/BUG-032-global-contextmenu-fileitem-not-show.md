# BUG-032: 全局右键菜单重构后，右键点击 file-item 无法弹出菜单

## 问题描述

全局右键菜单重构（统一使用 `GlobalContextMenu.vue` + Pinia Store）完成后，
在 SftpLocal / SftpRemote 的 `.file-item` 子项上右键点击无法弹出菜单。

影响范围：所有使用 `contextMenuStore.showContextMenu()` 的组件（SftpLocal、SftpRemote 等）

## 复现步骤

1. 打开 SFTP 窗口
2. 在本地面板导航到有文件的目录
3. 在任意文件项（`.file-item`）上 **右键点击**
4. 预期：弹出 `.global-context-menu` 右键菜单
5. 实际：**没有任何反应**，菜单不显示

## 根因分析

### 事件冒泡冲突

```
┌─────────────────────────────────────────────────────┐
│ .app-layout                                         │
│   @click="handleGlobalClick"                        │
│   @contextmenu="handleGlobalClick"  ← 🔴 问题根源    │
│   @keydown.esc="handleEscKey"                       │
│                                                     │
│   ┌─ .sftp-overlay ────────────────────────────┐   │
│     ┌─ .file-panel.local ──────────────────┐   │   │
│       │ @contextmenu.prevent="handleCtx"   │   │   │
│       │                                   │   │   │
│       │  ┌─ .file-list ───────────────┐  │   │   │
│       │  │  .file-item (用户右键这里)  │  │   │   │
│       │  └────────────────────────────┘  │   │   │
│       └─────────────────────────────────┘   │   │
│   └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 事件时序

```
时间轴 →

1. 用户在 .file-item 上按下鼠标右键
        │
2. .file-list 触发 contextmenu 事件
   → handleContextMenu() 执行
   → contextMenuStore.showContextMenu() 设置 visible = true ✅
        │
3. 事件冒泡 ↑ 到 .app-layout
   → @contextmenu="handleGlobalClick" 触发
   → handleGlobalClick() 检测 target 不是菜单项
   → contextMenuStore.hideContextMenu() 设置 visible = false ❌
        │
4. 结果：菜单打开后立即被关闭（< 1ms），用户看不到任何效果
```

### 问题代码

```html
<!-- AppLayout.vue (修复前) -->
<div class="app-layout" 
     @click="handleGlobalClick" 
     @contextmenu="handleGlobalClick">  <!-- 🔴 这行导致 bug -->
```

PRD 要求是「左键点击关闭」，但 `@contextmenu` 会在子组件打开菜单的同一事件循环中立即关闭它。

## 修复方案

### 修复 1: 移除 AppLayout 的 `@contextmenu` 绑定

**文件**: [AppLayout.vue](../../src/renderer/src/components/layout/AppLayout.vue)

```diff
- <div class="app-layout" @click="handleGlobalClick" @contextmenu="handleGlobalClick" @keydown.esc="handleEscKey">
+ <div class="app-layout" @click="handleGlobalClick" @keydown.esc="handleEscKey">
```

**理由**: PRD 要求的是「左键点击关闭菜单」，不需要在右键事件中也关闭。

### 修复 2: GlobalContextMenu 自身处理 ESC 键

**文件**: [GlobalContextMenu.vue](../../src/renderer/src/components/common/GlobalContextMenu.vue)

AppLayout 的 `@keydown.esc` 需要 DOM 焦点在 `.app-layout` 上才能触发。
SFTP 窗口是 overlay 层，焦点可能不在 AppLayout 上，导致 ESC 无效。

**解决方案**: 在 GlobalContextMenu 组件中通过 `document.addEventListener('keydown')` 监听全局 ESC 键：

```typescript
function handleGlobalKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && contextMenuStore.visible) {
    event.preventDefault()
    contextMenuStore.hideContextMenu()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
})
```

## 修复验证

### E2E 测试用例

| 场景 | 描述 | 结果 |
|------|------|------|
| 场景1 | 右键 SftpLocal file-item → 菜单弹出 | ✅ |
| 场景2 | 右键 SftpRemote file-item → 菜单弹出 | ✅ |
| 场景3 | 左键点击空白区域 → 菜单关闭 | ✅ |
| 场景4 | 按 ESC 键 → 菜单关闭 | ✅ |

测试文件: [bug-032-fileitem-contextmenu-not-show.e2e.spec.ts](../../../e2e/sftp/bug-032-fileitem-contextmenu-not-show.e2e.spec.ts)

## 关联信息

- **所属功能**: SFTP 文件传输 - 全局右键菜单管理
- **关联 Bug**: BUG-029（菜单位置）、BUG-030（多菜单）、BUG-031（点击空白不关闭）
- **PRD 参考**: [phase2/sftp/prd.md#L218-L225](../plan/phase2/sftp/prd.md#L218-L225)
