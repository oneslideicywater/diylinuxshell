# FileListSkeleton 文件列表骨架屏组件

> 组件路径: [FileListSkeleton.vue](../FileListSkeleton.vue)
> 创建日期: 2026-04-26
> 关联问题: [sftp-performance.md P2-listDir](../../terminal/sftp/__problem__/sftp-performance.md)

---

## 设计背景

### 问题
SFTP 远程/本地文件浏览器在加载大目录（如 `/bin`、`/usr/lib`）时，`readdir` 一次性读取所有条目到内存。由于 ssh2 库限制无法实现分页读取（见 [P2 分析](../../terminal/sftp/__problem__/sftp-performance.md)），用户在等待期间看到的是空白列表或旧数据。

### 方案
使用 **CSS Shimmer 骨架屏** 替代空白等待，提供视觉反馈，暗示内容正在加载中。

---

## 技术实现

### 1. 布局对齐策略

骨架屏的行结构与真实 `.file-item` **像素级对齐**：

```
真实文件行 (.file-item):          骨架行 (.skeleton-row):
┌────────┬──────────────┬────────┐  ┌────────┬──────────────┬────────┐
│ icon   │ name         │ size   │  │ ████   │ ████████     │ █████  │
│ 16x16  │ flex:1       │ 48px   │  │ 16x16  │ flex:1        │ 48px   │
└────────┴──────────────┴────────┘  └────────┴──────────────┴────────┘
  gap:8px    gap:8px                  gap:8px    gap:8px
```

| 元素 | 真实组件 CSS | 骨架组件 CSS |
|------|-------------|-------------|
| 图标 | `.file-icon` 16×16px | `.skeleton-icon` 16×16px |
| 文件名 | `.file-name` `flex:1` | `.skeleton-name` `height:14px` |
| 大小 | `.file-size` 固定宽 | `.skeleton-size` `width:48px` |
| 行间距 | `padding: 6px 8px; gap: 8px` | 完全一致 |

### 2. Shimmer 动画原理

```css
background: linear-gradient(
  110deg,
  var(--skeleton-base, rgba(128,128,128,0.12)) 0%,
  var(--skeleton-base, ...) 40%,       /* 基础色 */
  var(--skeleton-shine, rgba(128,128,128,0.2)) 50%, /* 高亮色 */
  var(--skeleton-base, ...) 60%,
  var(--skeleton-base, ...) 100%
);
background-size: 200% 100%;           /* 渐变宽度是容器的 2 倍 */
animation: skeleton-shimmer 1.6s ease-in-out infinite;

@keyframes skeleton-shimmer {
  0%   { background-position: 200% 0; }   /* 高亮在最右侧（不可见） */
  100% { background-position: -200% 0; }   /* 高亮滑过到最左侧（不可见） */
}
```

**核心机制**：
- 渐变背景的宽度设为容器 **200%**
- 通过 `background-position` 从 `200%` 动画到 `-200%`
- 视觉效果：一条高光带从右向左扫过整个元素

### 3. 波浪式依次亮起

每行动画延迟递增 60ms，产生"波浪"效果：

```html
<div class="skeleton-row" :style="{ animationDelay: `${(i - 1) * 60}ms` }">
```

时间线：
```
Row 1:  0ms    ▓▓▓▓▓▓▓▓░░░░
Row 2:  60ms   ░░▓▓▓▓▓▓▓▓░░
Row 3:  120ms  ░░░░▓▓▓▓▓▓▓▓
...
Row 10: 540ms  ░░░░░░░░░▓▓▓▓
```

### 4. 文件名宽度随机化

避免机械感的等宽排列，使用预设宽度数组循环：

```typescript
const nameWidths = ['65%', '45%', '78%', '52%', '70%', '38%', '82%', '55%', '62%', '48%']
// 使用方式：nameWidths[(i - 1) % nameWidths.length]
```

---

## 集成架构

### 数据流

```
用户操作（双击目录 / 刷新 / 路径回车）
        │
        ▼
┌─ sftpBrowserStore (Pinia) ──────────────────────┐
│                                                  │
│  loadRemoteFiles() / loadLocalFiles()            │
│    ├── state.isLoadingRemote = true              │◄─── SftpRemote.vue 读取
│    │       │                                    │      (computed → v-if)
│    │       ▼                                    │
│    │   window.api.sftp.listDir()                │
│    │       │                                    │
│    │       ▼                                    │
│    │   state.remoteFiles = result               │
│    │       │                                    │
│    └── finally: isLoadingRemote = false ────────┘
│                                                  │
│  loadLocalFiles()                                │
│    ├── state.isLoadingLocal = true               │◄─── SftpLocal.vue 读取
│    └── finally: isLoadingLocal = false ──────────┘      (computed → v-if)
└──────────────────────────────────────────────────┘
        │
        ▼
FileListSkeleton 组件渲染 / 消失
```

### Store 状态定义

```typescript
// sftpBrowser.ts — State 接口
local: {
  localPath: string
  localFiles: any[]
  localFileCount: number
  isLoadingLocal: boolean    // ← 新增
}
remote: {
  remotePath: string
  remoteFiles: any[]
  remoteFileCount: number
  connectionId: string
  isLoadingRemote: boolean   // ← 新增
}
```

### 组件使用位置

| 组件 | 条件判断 | 行数 |
|------|---------|------|
| [SftpRemote.vue](../terminal/sftp/SftpRemote.vue) | `v-else-if="isLoadingRemote"` | 10 |
| [SftpLocal.vue](../terminal/sftp/SftpLocal.vue) | `v-if="isLoadingLocal"` | 10 |

---

## 主题适配

通过 CSS 变量自动适配亮色/暗色主题：

| 变量 | 默认值（亮色） | 暗色主题覆盖 |
|------|--------------|------------|
| `--skeleton-base` | `rgba(128,128,128,0.12)` | 更亮的灰 |
| `--skeleton-shine` | `rgba(128,128,128,0.2)` | 对应高亮 |

无需在组件内做额外主题判断，CSS 变量的 fallback 机制已处理。

---

## 性能考量

| 维度 | 说明 |
|------|------|
| **DOM 节点** | 仅 10 个 `<div>`（默认 rows=10），极轻量 |
| **动画性能** | 纯 CSS `transform` + `opacity`（GPU 加速），无 JS 重绘 |
| **内存占用** | 无图片/字体资源，纯 CSS 渐变 |
| **显示时长** | 取决于网络/IO 速度，通常 100ms~2s |
