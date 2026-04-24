# SFTP Status 模块 — 代码分析

> 本文档记录 `src/renderer/src/components/terminal/sftp/status/` 目录下的核心实现细节。
> 架构概览见 [arch.md](./arch.md)。

---

## 表头-内容同步滚动

### 问题

SFTP 传输状态表格有 **11 列**（复选框、名称、状态、进度、大小、本地路径、箭头、远程路径、速度、估计剩余、经过时间），当容器宽度不足时需要水平滚动。但表头和内容是两个独立 DOM 元素，必须保持水平位置同步。

用户期望水平滚动条出现在 **表头正下方**（类似 Excel / Google Sheets）。

### 当前方案：单层 overflow + 表头 transform 跟随

```
┌─ .sftp-task-status (overflow: hidden) ────────────────────────┐
│                                                                 │
│  ┌─ SftpStatusHeader (.tree-header, translateX) ───────────┐  │
│  │  ☑ │ 名称 │ 状态 │ 进度 │ 大小 │ 本地路径 │ ...          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ .tree-content (overflow: auto) ← ★ 滚动条持有者 ───────┐  │
│  │  ☑ AAA-test-upload (0/6) │ 已完成 │ 100% │ 233.8MB │ .. │  │
│  │    ├── file1.txt                                    │  │
│  │    └── file2.txt                                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                              ▲── 滚动条在底部   │
└─────────────────────────────────────────────────────────────────┘
```

> **关于滚动条位置**：CSS 原生**不支持**将水平滚动条定位到容器顶部。浏览器规范规定水平滚动条始终出现在 overflow 容器的底部，竖向滚动条始终在右侧。这是浏览器引擎的硬性行为。
>
> 曾尝试「外层水平 + 内层竖向」分层方案（Excel 式），可将水平滚动条移至表头下方，但引入了额外的 DOM 嵌套和滚动同步复杂度，已回退至当前单层方案。

---

## 同步滚动数据流

### 触发链路

```
用户在 .tree-content 区域滚动（水平或竖向）
  → @scroll.passive="handleContentScroll" 触发
    → event.target.scrollLeft 获取偏移量
      → headerScrollLeft.value = -scrollLeft  （Vue 响应式更新）
        → SftpStatusHeader 接收 prop :header-scroll-left="headerScrollLeft"
          → .tree-header 应用 style="{ transform: translateX(${headerScrollLeft}px) }"
            → 表头视觉上跟随内容区同步移动
```

### 关键代码

**[SftpTaskStatus.vue](./SftpTaskStatus.vue)** — 内容区滚动监听与状态传递：

```ts
/** 表头水平偏移量（同步内容区 scrollLeft） */
const headerScrollLeft = ref(0)

/**
 * 处理内容区域滚动事件
 * 内容区同时拥有水平和竖向滚动能力：
 * - 竖向：内容区自身处理（overflow-y: auto）
 * - 水平：内容区自身处理（overflow-x: auto），同时同步表头的 translateX
 */
function handleContentScroll(event: Event): void {
  const target = event.target as HTMLElement
  headerScrollLeft.value = -target.scrollLeft
}
```

```vue
<!-- 单层结构：表头在滚动容器外部 -->
<div class="sftp-task-status">
  <SftpStatusHeader :header-scroll-left="headerScrollLeft" />
  <div class="tree-content" @scroll.passive="handleContentScroll">
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
  border-bottom: 2px solid var(--border-color, #333);
  overflow: hidden; /* 裁剪溢出，不参与滚动 */
}
```

#### 内容区 `.tree-content`（滚动条持有者）

```css
.tree-content {
  flex: 1;
  overflow: auto;       /* 同时持有水平和竖向滚动 */
  background: var(--bg-color, #1e1e1e);
  min-width: 0;         /* 允许 flex 子项收缩到小于内容宽度 */
}
```

**`min-width: 0` 的作用**：在 flex 容器中，子元素默认 `min-width: auto`（即内容最小宽度），这会阻止子元素收缩到比其内容更窄。设置为 `0` 后，当容器宽度不足时 `.tree-content` 可以收缩，内部内容溢出触发滚动条。

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
| **实现简单** | 单层 DOM 结构 | 无额外嵌套，易于维护 |
| **单向数据流** | 内容 scroll → headerScrollLeft ref → header transform | 无循环触发风险 |
| **性能好** | `transform` 触发 GPU 合成层 | 不触发布局重排（reflow），仅触发合成（composite） |
| **列宽稳定** | `flex-shrink: 0` + `min-width` | 各列不被压缩，表格结构不变形 |
