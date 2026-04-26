# BUG-029: SFTP 右键菜单位置固定不跟随鼠标

## 问题描述

**发现时间**: 2026-04-19  
**严重程度**: P1  
**影响范围**: SFTP 文件面板（Local + Remote）

### 现象
无论鼠标点击文件的哪个位置，右键菜单总是在固定位置出现（文件底部）。

### 预期行为
菜单左上角 = 鼠标右击的精确位置。

---

## 根因分析

### DOM 结构与定位关系

```
┌──────────────────────────────────────────────────┐
│ .file-panel (position: relative) ← 菜单定位基准！ │  ← panelRef
│  ┌────────────────────────────────────────────┐  │
│  │ .panel-header (高度 ~40px)                 │  │
│  │  [路径输入框]                    [↑ 按钮]  │  │
│  ├────────────────────────────────────────────┤  │
│  │ .file-list (@contextmenu 绑定在这里)        │  │  ← event.currentTarget（旧代码用这个！）
│  │                                            │  │
│  │  📁 boot          ← 鼠标右击这里            │  │
│  │  📁 dev                                    │  │
│  │  📁 etc         ← event.clientY = 180      │  │
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│              ┌──────────────┐                    │
│              │ 右键菜单      │ ← position:absolute │
│              │ left: ?px    │   相对于 .file-panel │
│              │ top:  ?px    │                    │
│              └──────────────┘                    │
└──────────────────────────────────────────────────┘
```

### 坐标计算对比

```
                    屏幕坐标 (clientX/Y)
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ .file-panel.left = 100                          │
│                                                 │
│   ┌─ .panel-header (40px)                       │
│   │                                             │
│   ├─ .file-list.left = 100  (.file-panel + 0)   │
│   │                                             │
│   │   📁 etc  ← 鼠标点击                        │
│   │          clientX=250, clientY=180           │
│   │                                             │
│   └─────────────────────────────────────────────┘
│                      .file-panel.top = 50       │
│                                                 │
│   正确计算:                                      │
│   x = clientX - .file-panel.left = 250 - 100 = 150px │
│   y = clientY - .file-panel.top  = 180 - 50  = 130px │
│                                                 │
│   ❌ 旧代码错误:                                  │
│   用 event.currentTarget = .file-list             │
│   但 .file-list 和 .file-panel 的 left 相同,     │
│   top 不同! (.file-list.top = .file-panel.top + 40)
│   导致 y 值多了 header 高度 → 菜单偏下！          │
│                                                 │
│   ❌ 更早的版本:                                  │
│   用 rect.bottom (文件元素底部)                   │
│   x = rect.left  + 10  → 固定值！                │
│   y = rect.bottom + 4  → 固定在文件底部！         │
└─────────────────────────────────────────────────┘
```

### 三版代码演进

| 版本 | X 坐标 | Y 坐标 | 效果 |
|------|--------|--------|------|
| **V1（原始）** | `rect.left - panelRect.left + 10` | `rect.bottom - panelRect.top + 4` | ❌ 固定在文件底部 |
| **V2（第一次修复）** | `event.clientX - currentTarget.left` | `event.clientY - currentTarget.top` | ❌ currentTarget 是 `.file-list`，少了 header 偏移 |
| **V3（最终修复）** | `event.clientX - panelRef.left` | `event.clientY - panelRef.top` | ✅ 精确对齐鼠标位置 |

## 修复方案

### 改动文件

| 文件 | 改动点 |
|------|--------|
| `src/renderer/src/components/terminal/sftp/SftpRemote.vue` | 添加 `panelRef`；`handleContextMenu` 用 `panelRef` 计算坐标 |
| `src/renderer/src/components/terminal/sftp/SftpLocal.vue` | 同上 |

### 关键代码变更

```typescript
// === 模板层 ===
<div class="file-panel remote" ref="panelRef">

// === 脚本层 ===
const panelRef = ref<HTMLElement | null>(null)

function handleContextMenu(event: MouseEvent): void {
  // 坐标相对于 .file-panel（position: relative 的定位基准）
  const panelRect = panelRef.value?.getBoundingClientRect()
  if (!panelRect) return

  // 菜单左上角 = 鼠标点击位置
  x = event.clientX - panelRect.left
  y = event.clientY - panelRect.top

  contextMenuStore.showContextMenu(menuOwnerId, { x, y }, 'session')
}
```

## 验证测试

| 测试场景 | 测试文件 | 结果 |
|----------|----------|------|
| PRD场景2: 位置跟随鼠标 | `e2e/sftp/sftp-context-menu-global-unique.e2e.spec.ts` | ✅ passed |

## 关联文档

- PRD: [docs/plan/phase2/sftp/prd.md#L325-L335](../plan/phase2/sftp/prd.md#L325-L335)
- 功能-测试对应: [docs/relation/sftp-context-menu.md](../relation/sftp-context-menu.md)
- 关联 Bug: [BUG-030](BUG-030-sftp-double-context-menu.md)
