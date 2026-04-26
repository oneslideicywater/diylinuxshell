# ErrorDialog 组件问题分析

> 文件路径: `src/renderer/src/components/common/ErrorDialog.vue`

## 1. 数据流问题

### 1.1 直接依赖 Store 而非通过 Props

**严重程度**: 高

**问题描述**:
组件直接导入并使用 `useErrorDialogStore` 和 `useSessionStore`，而非通过 props 接收数据，导致组件与特定 Store 强耦合，难以复用和测试。

**代码位置**:
```typescript
import { useErrorDialogStore } from '@/stores/errorDialog'
import { useSessionStore } from '@/stores/session'

const errorDialogStore = useErrorDialogStore()
const sessionStore = useSessionStore()

const visible = computed(() => errorDialogStore.visible)
const title = computed(() => errorDialogStore.title)
// ...
```

**建议修复**:
```typescript
interface Props {
  visible: boolean
  title: string
  message: string
  sessionId: string
  showRetry: boolean
  showEdit: boolean
}

const props = defineProps<Props>()
```

---

### 1.2 `handleRetry` 同时触发两个事件

**严重程度**: 中

**问题描述**:
点击"重新输入密码"按钮同时触发 `retry` 和 `edit` 事件，语义不清晰。

**代码位置**:
```typescript
const handleRetry = (): void => {
  const sid = sessionId.value
  if (sid && sessionStore.sessions.some(s => s.id === sid)) {
    emit('retry', sid)
    emit('edit', sid)  // ❌ 同时触发两个事件
  }
  handleClose()
}
```

**建议修复**:
- 只触发 `retry` 事件
- 或重命名为更明确的事件

---

## 2. 功能缺失

### 2.1 缺少错误详情展开功能

**严重程度**: 中

**问题描述**:
错误信息可能很长（如堆栈跟踪），但没有展开/收起功能。

**建议修复**:
- 添加"查看详情"按钮
- 使用折叠面板显示完整错误信息

---

### 2.2 缺少错误复制功能

**严重程度**: 低

**问题描述**:
用户无法一键复制错误信息用于反馈。

**建议修复**:
- 添加复制按钮
- 使用 `navigator.clipboard.writeText()` 复制

---

### 2.3 缺少键盘支持

**严重程度**: 中

**问题描述**:
没有 ESC 键关闭、Enter 键确认等键盘支持。

**建议修复**:
```typescript
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    handleClose()
  }
}
```

---

## 3. 无障碍访问问题

### 3.1 缺少 ARIA 属性

**严重程度**: 高

**问题描述**:
缺少 `role="alertdialog"`、`aria-modal` 等属性。

**建议修复**:
```vue
<div
  class="error-dialog"
  role="alertdialog"
  aria-modal="true"
  aria-labelledby="error-title"
  aria-describedby="error-detail"
>
  <p id="error-title" class="error-title">{{ title }}</p>
  <p id="error-detail" class="error-detail">{{ message }}</p>
</div>
```

---

### 3.2 缺少焦点管理

**严重程度**: 中

**问题描述**:
对话框打开时没有自动聚焦，关闭后没有恢复焦点。

---

## 4. 样式问题

### 4.1 缺少 Teleport

**严重程度**: 中

**问题描述**:
没有使用 `Teleport`，对话框可能被父元素的 `overflow: hidden` 裁剪。

**代码位置**:
```vue
<template>
  <div v-if="visible" class="error-dialog-overlay">
    <!-- 没有 Teleport -->
  </div>
</template>
```

**建议修复**:
```vue
<template>
  <Teleport to="body">
    <div v-if="visible" class="error-dialog-overlay">
      <!-- ... -->
    </div>
  </Teleport>
</template>
```

---

### 4.2 缺少响应式适配

**严重程度**: 低

**问题描述**:
固定 `width: 450px` 在小屏幕可能溢出。

**建议修复**:
```css
.error-dialog {
  width: 90vw;
  max-width: 450px;
}
```

---

## 5. 代码质量问题

### 5.1 硬编码标题

**严重程度**: 低

**问题描述**:
对话框标题硬编码为"连接失败"，不适用于所有错误场景。

**代码位置**:
```vue
<div class="dialog-header">
  <h3>连接失败</h3>  <!-- 硬编码 -->
</div>
```

**建议修复**:
```vue
<h3>{{ title }}</h3>
```

---

### 5.2 缺少加载状态

**严重程度**: 低

**问题描述**:
点击"重新输入密码"后没有加载状态，用户不知道是否正在处理。

**建议修复**:
- 添加 `isProcessing` 状态
- 显示加载指示器

---

## 总结

| 问题类型 | 数量 | 严重程度 |
|---------|------|---------|
| 数据流 | 2 | 高/中 |
| 功能缺失 | 3 | 中/低 |
| 无障碍访问 | 2 | 高/中 |
| 样式问题 | 2 | 中/低 |
| 代码质量 | 2 | 低 |

**优先修复建议**:
1. 改为通过 Props 接收数据，解耦 Store 依赖
2. 添加 Teleport 避免被裁剪
3. 添加 ARIA 属性和键盘支持
4. 修复 `handleRetry` 同时触发两个事件的问题
