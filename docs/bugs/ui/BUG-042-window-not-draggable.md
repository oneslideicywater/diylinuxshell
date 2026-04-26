# Bug 2: 全局窗口不可拖动

### 问题描述

应用窗口无法通过拖动标题栏来移动位置。

### 根本原因

AppLayout 组件中，`.header-center` 区域（包含标签页）设置了 `-webkit-app-region: no-drag`，导致大部分标题栏区域无法拖动。只有 `.header-left`（标题文字区域，宽度 240px）可以拖动，但区域太小不易操作。

### 解决方案

1. 将 `.header-center` 的 `-webkit-app-region` 改为 `drag`
2. 为 TerminalTab 组件添加 `-webkit-app-region: no-drag`，确保标签页的交互功能正常

**修改文件：**

- `src/renderer/src/components/layout/AppLayout.vue`
- `src/renderer/src/components/terminal/TerminalTab.vue`

**关键代码变更：**

```css
/* AppLayout.vue */
.header-center {
  flex: 1;
  display: flex;
  align-items: center;
  overflow: hidden;
  -webkit-app-region: drag; /* 改为 drag */
}

/* TerminalTab.vue */
.terminal-tab {
  /* ...其他样式... */
  -webkit-app-region: no-drag; /* 标签页本身不可拖动，确保可以点击 */
}
```

### 所属功能

布局 — 窗口拖动区域

### 修复日期

2026-04-03

### 状态

✅ 已修复
