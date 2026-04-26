# AlertDialog 组件问题分析

> 文件路径: `src/renderer/src/components/common/AlertDialog.vue`

## 1. 无障碍访问问题

### 1.1 缺少键盘焦点管理

**严重程度**: 高

**问题描述**:
对话框打开时没有自动聚焦到按钮，关闭后也没有恢复焦点到触发元素，键盘用户难以操作。

**建议修复**:
```typescript
import { onMounted, nextTick } from 'vue'

const triggerElement = ref<HTMLElement | null>(null)

onMounted(async () => {
  await nextTick()
  // 自动聚焦到确认按钮
  const confirmBtn = document.querySelector('.btn-confirm') as HTMLElement
  confirmBtn?.focus()
})
```

---

### 1.2 缺少 ARIA 属性

**严重程度**: 高

**问题描述**:
对话框缺少必要的 ARIA 属性，屏幕阅读器无法正确识别。

**建议修复**:
```vue
<div
  class="alert-dialog"
  role="alertdialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-content"
>
  <h3 id="dialog-title" class="dialog-title">{{ title }}</h3>
  <div id="dialog-content" class="content-text">{{ message }}</div>
</div>
```

---

### 1.3 缺少 ESC 键关闭支持

**严重程度**: 中

**问题描述**:
没有监听 ESC 键关闭对话框，不符合用户习惯。

**建议修复**:
```typescript
import { onMounted, onUnmounted } from 'vue'

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    handleClose()
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
```

---

## 2. 功能缺失

### 2.1 缺少自定义按钮文本

**严重程度**: 低

**问题描述**:
按钮文本硬编码为"确定"，无法自定义。

**建议修复**:
```typescript
interface Props {
  // ... 其他 props
  /** 确认按钮文本 */
  confirmText?: string
}

withDefaults(defineProps<Props>(), {
  confirmText: '确定'
})
```

---

### 2.2 缺少关闭前回调

**严重程度**: 低

**问题描述**:
无法在关闭前执行验证或阻止关闭。

**建议修复**:
```typescript
const emit = defineEmits<{
  (e: 'before-close', done: () => void): void
}>()

const handleClose = () => {
  emit('before-close', () => {
    emit('close')
  })
}
```

---

## 3. 样式问题

### 3.1 缺少响应式适配

**严重程度**: 中

**问题描述**:
对话框使用固定 `min-width: 400px`，在小屏幕设备上可能溢出。

**建议修复**:
```css
.alert-dialog {
  min-width: 300px;
  max-width: 500px;
  width: 90vw; /* 响应式宽度 */
}
```

---

### 3.2 动画可能影响性能

**严重程度**: 低

**问题描述**:
使用 CSS 动画，在低端设备上可能造成卡顿。

**建议修复**:
- 添加 `prefers-reduced-motion` 媒体查询
- 为偏好减少动画的用户禁用动画

```css
@media (prefers-reduced-motion: reduce) {
  .alert-dialog,
  .dialog-overlay {
    animation: none;
  }
}
```

---

## 4. 代码质量问题

### 4.1 缺少 Teleport fallback 处理

**严重程度**: 低

**问题描述**:
如果 `body` 元素不存在或被修改，Teleport 可能失败。

**建议修复**:
```vue
<Teleport to="body" :disabled="!canTeleport">
  <!-- 内容 -->
</Teleport>

<script setup>
const canTeleport = ref(true)
onMounted(() => {
  canTeleport.value = !!document.body
})
</script>
```

---

## 总结

| 问题类型 | 数量 | 严重程度 |
|---------|------|---------|
| 无障碍访问 | 3 | 高/中 |
| 功能缺失 | 2 | 低 |
| 样式问题 | 2 | 中/低 |
| 代码质量 | 1 | 低 |

**优先修复建议**:
1. 添加 ARIA 属性和键盘焦点管理
2. 添加 ESC 键关闭支持
3. 改进响应式适配
