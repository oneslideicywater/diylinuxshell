# Tooltip 组件问题分析

> 文件路径: `src/renderer/src/components/common/Tooltip.vue`

## 1. 性能问题

### 1.1 每次鼠标移动都计算边界矩形

**严重程度**: 中

**问题描述**:
`handleMouseEnter` 中调用 `getBoundingClientRect()` 会触发重排，频繁调用可能影响性能。

**代码位置**:
```typescript
const handleMouseEnter = (event: MouseEvent) => {
  triggerRect.value = (event.target as HTMLElement).getBoundingClientRect()
  // ...
}
```

**建议修复**:
- 使用 `requestAnimationFrame` 延迟计算
- 或缓存边界矩形，在元素尺寸变化时更新

---

### 1.2 定时器未清理可能导致内存泄漏

**严重程度**: 中

**问题描述**:
如果组件在定时器触发前被卸载，定时器不会被清理。

**代码位置**:
```typescript
let showTimer: number | null = null

const handleMouseEnter = (event: MouseEvent) => {
  showTimer = window.setTimeout(() => {
    visible.value = true
    showTimer = null
  }, props.delay)
}
```

**建议修复**:
```typescript
onUnmounted(() => {
  if (showTimer !== null) {
    clearTimeout(showTimer)
  }
})
```

---

## 2. 功能缺失

### 2.1 缺少边界检测

**严重程度**: 高

**问题描述**:
Tooltip 可能超出视口边界，导致用户无法看到完整内容。

**代码位置**:
```typescript
const tooltipStyle = computed(() => {
  // 直接计算位置，未检测边界
  switch (props.position) {
    case 'top':
      styles.top = `${triggerRect.value.top - 8}px`
      // ...
  }
})
```

**建议修复**:
```typescript
const tooltipStyle = computed(() => {
  if (!triggerRect.value) return {}
  
  const styles: Record<string, string> = {
    maxWidth: `${props.maxWidth}px`
  }
  
  // 计算预估的 tooltip 尺寸
  const tooltipWidth = Math.min(props.maxWidth, triggerRect.value.width)
  const tooltipHeight = 40  // 预估高度
  
  // 根据位置计算并检测边界
  switch (props.position) {
    case 'top':
      let top = triggerRect.value.top - 8 - tooltipHeight
      if (top < 0) {
        // 超出顶部，切换到底部
        top = triggerRect.value.bottom + 8
      }
      styles.top = `${top}px`
      // ...
  }
  
  return styles
})
```

---

### 2.2 缺少手动触发模式

**严重程度**: 低

**问题描述**:
只能通过鼠标悬浮触发，不支持手动控制显示/隐藏。

**建议修复**:
```typescript
interface Props {
  // ...
  /** 触发方式 */
  trigger?: 'hover' | 'click' | 'manual'
  /** 手动控制可见性（trigger='manual' 时使用） */
  modelValue?: boolean
}
```

---

### 2.3 缺少富内容支持

**严重程度**: 低

**问题描述**:
只支持纯文本，不支持 HTML 或组件。

**建议修复**:
```vue
<template>
  <div class="tooltip-wrapper">
    <slot />
    <Teleport to="body">
      <transition name="tooltip-fade">
        <div v-if="visible" class="tooltip">
          <slot name="content">{{ content }}</slot>
        </div>
      </transition>
    </Teleport>
  </div>
</template>
```

---

## 3. 无障碍访问问题

### 3.1 缺少 ARIA 属性

**严重程度**: 中

**问题描述**:
Tooltip 没有关联到触发元素，屏幕阅读器无法识别。

**建议修复**:
```vue
<div 
  class="tooltip-wrapper"
  :aria-describedby="tooltipId"
  @mouseenter="handleMouseEnter"
  @mouseleave="handleMouseLeave"
>
  <slot />
  <Teleport to="body">
    <div 
      v-if="visible" 
      :id="tooltipId"
      role="tooltip"
      class="tooltip"
    >
      {{ content }}
    </div>
  </Teleport>
</div>

<script setup>
const tooltipId = `tooltip-${Math.random().toString(36).substr(2, 9)}`
</script>
```

---

### 3.2 缺少键盘焦点触发

**严重程度**: 中

**问题描述**:
键盘用户无法通过 Tab 键聚焦触发 Tooltip。

**建议修复**:
```vue
<div 
  class="tooltip-wrapper"
  tabindex="0"
  @mouseenter="handleMouseEnter"
  @mouseleave="handleMouseLeave"
  @focus="handleMouseEnter"
  @blur="handleMouseLeave"
>
```

---

## 4. 样式问题

### 4.1 箭头方向未根据实际位置调整

**严重程度**: 中

**问题描述**:
当 Tooltip 因边界检测切换位置时，箭头方向没有相应调整。

**建议修复**:
- 添加 `actualPosition` 状态
- 根据实际位置应用对应的箭头样式

---

### 4.2 缺少主题适配

**严重程度**: 低

**问题描述**:
Tooltip 使用固定颜色，未适配浅色主题。

**代码位置**:
```css
.tooltip {
  background: rgba(0, 0, 0, 0.85);
  color: #ffffff;
}
```

**建议修复**:
```css
[data-theme="light"] .tooltip {
  background: rgba(255, 255, 255, 0.95);
  color: #333333;
}
```

注：当前代码已包含浅色主题适配，这部分没问题。

---

## 5. 代码质量问题

### 5.1 使用 `window.setTimeout` 返回类型不一致

**严重程度**: 低

**问题描述**:
浏览器中 `setTimeout` 返回 `number`，Node.js 返回 `NodeJS.Timeout`，类型声明使用 `number` 可能在非浏览器环境报错。

**建议修复**:
```typescript
let showTimer: ReturnType<typeof setTimeout> | null = null
```

---

### 5.2 `triggerRect` 类型可能为 null

**严重程度**: 低

**问题描述**:
`tooltipStyle` 计算时检查了 `triggerRect.value`，但 TypeScript 可能无法推断。

**建议修复**:
- 当前代码已有检查，保持现状

---

## 总结

| 问题类型 | 数量 | 严重程度 |
|---------|------|---------|
| 性能问题 | 2 | 中 |
| 功能缺失 | 3 | 高/低 |
| 无障碍访问 | 2 | 中 |
| 样式问题 | 2 | 中/低 |
| 代码质量 | 2 | 低 |

**优先修复建议**:
1. 添加边界检测避免 Tooltip 超出视口
2. 添加组件卸载时清理定时器
3. 添加 ARIA 属性和键盘焦点支持
4. 优化 `getBoundingClientRect` 调用频率
