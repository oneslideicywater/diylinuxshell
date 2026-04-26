# ConfirmDialog 组件问题分析

> 文件路径: `src/renderer/src/components/common/ConfirmDialog.vue`

## 1. 无障碍访问问题

### 1.1 缺少键盘焦点管理

**严重程度**: 高

**问题描述**:
对话框打开时没有自动聚焦，键盘用户无法快速操作。

**建议修复**:
```typescript
import { onMounted, nextTick } from 'vue'

onMounted(async () => {
  await nextTick()
  // 聚焦到取消按钮（更安全的选择）
  const cancelBtn = document.querySelector('.btn-cancel') as HTMLElement
  cancelBtn?.focus()
})
```

---

### 1.2 缺少 ARIA 属性

**严重程度**: 高

**问题描述**:
缺少 `role="alertdialog"`、`aria-modal` 等属性。

**建议修复**:
```vue
<div
  class="confirm-dialog"
  role="alertdialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-content"
>
```

---

### 1.3 缺少 ESC 键关闭支持

**严重程度**: 中

**问题描述**:
没有监听 ESC 键，应该按 ESC 触发取消操作。

**建议修复**:
```typescript
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    handleCancel() // ESC 应该触发取消，而非关闭
  }
}
```

---

## 2. 功能缺失

### 2.1 缺少自定义按钮文本

**严重程度**: 中

**问题描述**:
按钮文本硬编码为"取消"和"确定"，无法自定义（如"删除"/"保留"）。

**建议修复**:
```typescript
interface Props {
  // ...
  cancelText?: string
  confirmText?: string
}

withDefaults(defineProps<Props>(), {
  cancelText: '取消',
  confirmText: '确定'
})
```

---

### 2.2 缺少关闭前回调

**严重程度**: 低

**问题描述**:
无法在关闭前执行验证或异步操作。

**建议修复**:
- 添加 `before-close` 事件

---

### 2.3 缺少防重复点击

**严重程度**: 中

**问题描述**:
用户可以快速多次点击确认按钮，导致重复执行操作。

**建议修复**:
```typescript
const isProcessing = ref(false)

const handleConfirm = async () => {
  if (isProcessing.value) return
  isProcessing.value = true
  try {
    emit('confirm')
  } finally {
    isProcessing.value = false
  }
}
```

---

## 3. 样式问题

### 3.1 缺少响应式适配

**严重程度**: 中

**问题描述**:
固定 `min-width: 400px` 在小屏幕可能溢出。

**建议修复**:
```css
.confirm-dialog {
  min-width: 300px;
  max-width: 500px;
  width: 90vw;
}
```

---

### 3.2 按钮顺序不符合某些平台规范

**严重程度**: 低

**问题描述**:
当前顺序是"取消 | 确定"，某些平台（如 macOS）习惯"确定 | 取消"。

**建议修复**:
- 添加 `buttonOrder: 'cancel-first' | 'confirm-first'` 配置

---

## 4. 代码质量问题

### 4.1 `close` 和 `cancel` 事件语义重复

**严重程度**: 低

**问题描述**:
点击关闭按钮和点击取消按钮都触发不同事件，但行为相似，容易混淆。

**代码位置**:
```typescript
const handleClose = () => {
  emit('close')
}

const handleCancel = () => {
  emit('cancel')
}
```

**建议修复**:
- 统一为 `cancel` 事件，或明确区分语义

---

### 4.2 缺少 Teleport fallback 处理

**严重程度**: 低

**问题描述**:
与 AlertDialog 相同。

---

## 总结

| 问题类型 | 数量 | 严重程度 |
|---------|------|---------|
| 无障碍访问 | 3 | 高/中 |
| 功能缺失 | 3 | 中/低 |
| 样式问题 | 2 | 中/低 |
| 代码质量 | 2 | 低 |

**优先修复建议**:
1. 添加 ARIA 属性和键盘焦点管理
2. 添加自定义按钮文本
3. 添加防重复点击机制
4. 添加 ESC 键关闭支持
