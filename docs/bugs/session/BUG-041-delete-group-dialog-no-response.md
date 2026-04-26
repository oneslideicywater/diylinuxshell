# Bug 1: 删除分组对话框点击确定后无响应

### 问题描述

点击删除分组，弹出确认对话框后点击确定按钮，对话框不消失且没有任何响应。

### 根本原因

ConfirmDialog 组件在点击确定或取消按钮时，同时触发了 `confirm`/`cancel` 和 `close` 两个事件。这导致：

1. `handleConfirmDialogConfirm` 被调用，resolve Promise 并将 `confirmDialogResolve` 设为 null
2. `handleConfirmDialogClose` 随后也被调用，但此时 `confirmDialogResolve` 已为 null，无法正确关闭对话框

### 解决方案

修改 ConfirmDialog 组件，点击确定或取消按钮时只触发对应的事件（`confirm` 或 `cancel`），不再触发 `close` 事件。由父组件手动控制 `confirmDialogVisible` 的关闭。

**修改文件：**

- `src/renderer/src/components/common/ConfirmDialog.vue`
- `src/renderer/src/components/session/SessionList.vue`

**关键代码变更：**

```vue
// ConfirmDialog.vue
const handleConfirm = () => {
  emit('confirm')
  // 不触发 close 事件，由父组件控制 visible
}

const handleCancel = () => {
  emit('cancel')
  // 不触发 close 事件，由父组件控制 visible
}
```

```typescript
// SessionList.vue
const handleConfirmDialogConfirm = () => {
  if (confirmDialogResolve) {
    confirmDialogResolve(true)
    confirmDialogResolve = null
  }
  // 关闭对话框
  confirmDialogVisible.value = false
}
```

### 所属功能

会话管理 — 分组操作 / 确认对话框

### 修复日期

2026-04-03

### 状态

✅ 已修复
