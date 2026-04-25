# BUG-031: SFTP 右键菜单点击任意位置不关闭

## 问题描述

SFTP 窗口中右键显示菜单后，鼠标左键/右键点击应用内**任意位置**（包括其他组件、header、状态栏、空白区域等），右键菜单不会消失。

## 复现步骤

1. 打开 SFTP 窗口
2. 在本地/远程文件面板中，右键点击某个文件 → 显示右键菜单
3. 鼠标**左键或右键**点击任意非菜单项位置
4. **预期**: 右键菜单关闭
5. **实际**: 右键菜单仍然显示

## 根因分析

### 原始实现（分散在各处，不可靠）

```typescript
// SftpLocal.vue / SftpRemote.vue onMounted 中
onMounted(() => {
  document.addEventListener('click', closeContextMenu)
})
```

仅依赖 `document` 级别的 `click` 事件监听器，且分散在子组件中：
- 事件冒泡可能被中间层拦截
- Electron + Vue 组件树中 `document` 级别事件不稳定
- 只处理了 click，未处理 contextmenu（右键点击其他位置）

### 最终方案：全局统一配置

在 **AppLayout**（根布局组件）上统一处理所有 click 和 contextmenu 事件：

```
AppLayout (根)
├── @click="handleGlobalClick"        ← 左键点击任意位置
├── @contextmenu="handleGlobalClick"  ← 右键点击任意位置
│
├── Sidebar / Header / TerminalTabs   ← 所有组件都被覆盖
└── SftpTransfer (SFTP 窗口)
    ├── SftpLocal (本地文件列表)
    └── SftpRemote (远程文件列表)
```

## 修改文件

### 新增：全局处理器

| 文件 | 修改内容 |
|------|----------|
| [AppLayout.vue](../../src/renderer/src/components/layout/AppLayout.vue) | 根元素添加 `@click` + `@contextmenu` = `handleGlobalClick` |

### 删除：冗余代码

| 文件 | 删除内容 |
|------|----------|
| [SftpLocal.vue](../../src/renderer/src/components/terminal/sftp/SftpLocal.vue) | `handleFileListClick` 函数、`@click="handleFileListClick"`、`document.addEventListener('click')`、`onMounted/onUnmounted` |
| [SftpRemote.vue](../../src/renderer/src/components/terminal/sftp/SftpRemote.vue) | 同上 |
| [SftpTransfer.vue](../../src/renderer/src/components/terminal/sftp/SftpTransfer.vue) | `handleWindowClick` 函数、`@click.stop="handleWindowClick"`、`contextMenuStore` 引用 |

### 核心代码

```typescript
// AppLayout.vue — 唯一的全局入口
import { useContextMenuStore } from '@/stores/contextMenu'
const contextMenuStore = useContextMenuStore()

function handleGlobalClick(event: MouseEvent): void {
  if (!contextMenuStore.visible) return
  const target = event.target as HTMLElement
  const isMenuItem = target.closest('.context-menu-item')
  if (!isMenuItem) {
    contextMenuStore.hideContextMenu()
  }
}
```

## 测试验证

- E2E 测试: [sftp-context-menu-global-unique.e2e.spec.ts](../../../e2e/sftp/sftp-context-menu-global-unique.e2e.spec.ts) - PRD场景3
- 结果: ✅ 3/3 passed, vue-tsc 无类型错误

## 对应 PRD

[prd.md#L231-233](../plan/phase2/sftp/prd.md#L231-L233)

> 场景3: 任意位置点击鼠标左键, 右键菜单应该关闭。
