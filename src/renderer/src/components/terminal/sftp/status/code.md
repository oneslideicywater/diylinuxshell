# SFTP Status 模块 — 代码分析

> 本文档记录 `src/renderer/src/components/terminal/sftp/status/` 目录下的核心实现细节。
> 架构概览见 [arch.md](./arch.md)。

---

## Excel 式表头-内容同步滚动

### 问题

SFTP 传输状态表格有 **11 列**（复选框、名称、状态、进度、大小、本地路径、箭头、远程路径、速度、估计剩余、经过时间），当容器宽度不足时需要水平滚动。但表头和内容是两个独立 DOM 元素，必须保持水平位置同步。

同时用户期望水平滚动条出现在 **表头正下方**（类似 Excel / Google Sheets），而非整个表格的最底部。

### 方案：外层水平 + 内层竖向 分层滚动

```
┌─ .sftp-task-status (overflow-x: auto) ───────────────────────┐ ★ 水平滚动条在这里
│                                                                 │
│  ┌─ .sftp-transfer-tree ────────────────────────────────┐     │
│  │  ┌─ .tree-header (transform: translateX(-Npx)) ───┐  │     │
│  │  │ ☑ │ 名称 │ 状态 │ 进度 │ 大小 │ 本地路径 │ ...  │  │     │
│  │  └─────────────────────────────────────────────────┘  │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌─ .tree-content (overflow-y: auto; overflow-x: hidden) ──┐  │
│  │  ☑ AAA-test-upload (0/6) │ 已完成 │ 100% │ 233.8MB │ ..│  │ ← 仅竖向滚动条
│  │    ├── file1.txt                                    │  │
│  │    └── file2.txt                                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**核心设计决策：将水平和竖向滚动分离到不同层**

| 层级 | 元素 | overflow | 职责 |
|------|------|----------|------|
| 外层 | `.sftp-task-status` | `overflow-x: auto; overflow-y: hidden` | 水平滚动 + 滚动条显示 |
| 内层 | `.tree-content` | `overflow-y: auto; overflow-x: hidden` | 仅竖向滚动 |

### 为什么这样设计

**方案 A（已废弃）：单层 overflow: auto**
```
.sftp-task-status (overflow: hidden)
├── Header (transform)
└── .tree-content (overflow: auto)  ← 滚动条在底部 ✗
```
问题：水平和竖向滚动条都在 `.tree-content` 底部，水平滚动条远离表头，用户体验差。

**方案 B（当前实现）：分层滚动** ★
```
.sftp-task-status (overflow-x: auto)  ← 滚动条紧贴表头下方 ✓
├── Header (transform)
└── .tree-content (overflow-y: auto; overflow-x: hidden)  ← 仅竖向
```
优势：
1. 水平滚动条在表头和内容之间，符合直觉（Excel 式）
2. 表头始终可见（不会被竖向滚动遮挡）
3. 表头水平跟随自然流畅

---

## 同步滚动数据流

### 触发链路

```
用户拖动外层水平滚动条
  → .sftp-task-status @scroll.passive="handleHorizontalScroll" 触发
    → event.target.scrollLeft 获取偏移量
      → headerScrollLeft.value = -scrollLeft  （Vue 响应式更新）
        → SftpStatusHeader 接收 prop :header-scroll-left="headerScrollLeft"
          → .tree-header 应用 style="{ transform: translateX(${headerScrollLeft}px) }"
            → 表头视觉上跟随内容区同步移动
```

### 关键代码

**[SftpTaskStatus.vue](./SftpTaskStatus.vue)** — 外层滚动监听与状态传递：

```ts
/** 表头水平偏移量（同步外层容器 scrollLeft） */
const headerScrollLeft = ref(0)

/**
 * 处理外层容器水平滚动事件
 * 外层容器持有水平滚动条，滚动时同步表头 translateX
 */
function handleHorizontalScroll(event: Event): void {
  const target = event.target as HTMLElement
  headerScrollLeft.value = -target.scrollLeft
}
```

```vue
<!-- 外层容器：持有水平滚动条 -->
<div class="sftp-task-status" @scroll.passive="handleHorizontalScroll">
  <SftpStatusHeader :header-scroll-left="headerScrollLeft" />
  <div class="tree-content">
    <!-- 内容节点 -->
  </div>
</div>
```

**[SftpStatusHeader.vue](./SftpStatusHeader.vue)** — 表头接收位移并应用：

```vue
<div class="tree-header" :style="{ transform: `translateX(${headerScrollLeft}px)` }">
  <!-- 11 列表头 -->
</div>
```

### CSS 关键点

#### 外层容器 `.sftp-task-status`

```css
.sftp-task-status {
  display: flex;
  flex-direction: column;
  overflow-x: auto;   /* ★ 水平滚动：触发溢出时显示滚动条 */
  overflow-y: hidden;   /* 竖向隐藏：由内层处理 */
}
```

`overflow-x: auto` 让外层成为水平滚动的「视口」，当内部内容宽度超出容器宽度时出现水平滚动条。由于表头是外层的第一个子元素，滚动条自然出现在表头正下方。

#### 内容区 `.tree-content`

```css
.tree-content {
  flex: 1;
  overflow-y: auto;   /* 仅竖向滚动 */
  overflow-x: hidden;  /* 水平已由外层处理 */
  min-width: max-content; /* 防止子节点被压缩换行 */
}
```

**`min-width: max-content` 的作用**：让 `.tree-content` 的宽度撑到其内容所需的宽度（所有列的 min-width 之和）。这样当内容总宽度 > 外层容器宽度时，外层的 `overflow-x: auto` 就会触发水平滚动条。

如果去掉 `min-width: max-content` 或使用 `min-width: 0`，flex 子项会被压缩到容器宽度内，永远不会溢出，水平滚动条就不会出现。

#### 表头 `.tree-header`

```css
.tree-header {
  display: flex;
  /* 无 overflow 设置 — 不产生滚动条 */
}

/* 各列固定宽度 */
.name-column { width: 400px; min-width: 400px; flex-shrink: 0; }
.status-column { width: 100px; min-width: 100px; flex-shrink: 0; }
/* ... 其他列同理 ... */
.local-path-column { flex: 1; min-width: 200px; }  /* 弹性列 */
```

每列使用 `min-width + flex-shrink: 0` 固定最小宽度，确保不会因容器变窄而压缩。`transform: translateX()` 只做视觉位移，不影响布局计算。

---

## 设计优势

| 特性 | 实现方式 | 价值 |
|------|---------|------|
| **滚动条位置正确** | 外层 `overflow-x: auto` | 水平滚动条紧贴表头下方（Excel 式），符合用户预期 |
| **单向数据流** | 外层 scroll → headerScrollLeft ref → header transform | 无循环触发风险，不需要 `syncingScroll` 防护标志 |
| **性能好** | `transform` 触发 GPU 合成层 | 不触发布局重排（reflow），仅触发合成（composite） |
| **表头始终可见** | 表头在外层、不在竖向滚动区内 | 竖向滚动时表头固定不动 |
| **列宽稳定** | `flex-shrink: 0` + `min-width` | 各列不被压缩，表格结构不变形 |
