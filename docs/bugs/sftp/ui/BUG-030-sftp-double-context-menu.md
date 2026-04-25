# BUG-030: SFTP 同时出现两个右键菜单

## 问题描述

**发现时间**: 2026-04-19  
**严重程度**: P1  
**影响范围**: SFTP 文件面板（Local + Remote）  
**关联 Bug**: BUG-011（右键菜单冲突，历史问题）

### 现象
SftpLocal 和 SftpRemote 的右键菜单可以同时显示，界面上出现两个菜单。

### 预期行为
全局同时只能有一个右键菜单显示。打开新菜单时，旧菜单应自动关闭。

---

## 根因分析

```
修复前（❌）:
┌─────────────────┐  ┌─────────────────┐
│  SftpLocal      │  │  SftpRemote     │
│  v-if="context   │  │  v-if="context   │
│  MenuVisible"    │  │  MenuVisible"    │
│  (本地 ref)      │  │  (本地 ref)      │
│       ↓ 独立控制  │  │       ↓ 独立控制  │
│  [菜单可见 ✅]   │  │  [菜单可见 ✅]   │
└─────────────────┘  └─────────────────┘
        ↑ 同时出现两个！

修复后（✅）:
┌──────────────────────┐
│   contextMenuStore   │
│   ownerId = ?        │
│   visible = true/false│
└──────────┬───────────┘
           │ isOwner('sftp-local')
           │ isOwner('sftp-remote')
     ┌─────┴─────┐
     ▼           ▼
┌────────┐  ┌────────┐
│ Local  │  │ Remote │
│v-if=   │  │v-if=   │
│isOwner │  │isOwner │
│[✅可见]│  │[❌隐藏] │
└────────┘  └────────┘
全局只有 1 个！
```

**根因**: `SftpLocal.vue` 和 `SftpRemote.vue` 各自使用本地 `ref<boolean>(contextMenuVisible)` 控制 `v-if`，互不知晓对方状态。

**修复**: `v-if` 改为 `isContextMenuOwner`（从 Pinia Store 读取），Store 通过 `ownerId` 保证唯一性。

## 修复方案

### 改动文件

| 文件 | 改动点 |
|------|--------|
| `src/renderer/src/components/terminal/sftp/SftpRemote.vue` | `v-if="contextMenuVisible"` → `v-if="isContextMenuOwner"` |
| `src/renderer/src/components/terminal/sftp/SftpLocal.vue` | 同上 |

### 关键代码变更

```typescript
// === 模板层 ===
// 修复前
<div v-if="contextMenuVisible" class="context-menu file-context-menu">

// 修复后：从 Store 读取，保证全局唯一
<div v-if="isContextMenuOwner" class="context-menu file-context-menu">

// === 脚本层 ===
const contextMenuStore = useContextMenuStore()
const menuOwnerId = 'sftp-remote'  // 或 'sftp-local'

const isContextMenuOwner = computed(() => contextMenuStore.isOwner(menuOwnerId))
```

## 验证测试

| 测试场景 | 测试文件 | 结果 |
|----------|----------|------|
| PRD场景1: 全局互斥 | `e2e/sftp/sftp-context-menu-global-unique.e2e.spec.ts` | ✅ passed |

## 关联文档

- PRD: [docs/plan/phase2/sftp/prd.md#L217-L229](../plan/phase2/sftp/prd.md#L217-L229)
- 功能-测试对应: [docs/relation/sftp-context-menu.md](../relation/sftp-context-menu.md)
- Store 实现: `src/renderer/src/stores/contextMenu.ts`
- 关联 Bug: [BUG-029](BUG-029-sftp-context-menu-position.md)
