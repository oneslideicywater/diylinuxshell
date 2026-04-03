/**
 * Tooltip 提示组件
 * 用于显示鼠标悬浮提示
 * @module components/common/Tooltip
 */

<template>
  <div 
    class="tooltip-wrapper"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <slot></slot>
    <Teleport to="body">
      <transition name="tooltip-fade">
        <div 
          v-if="visible" 
          class="tooltip"
          :class="[`tooltip-${position}`]"
          :style="tooltipStyle"
        >
          {{ content }}
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  /** Tooltip 显示内容 */
  content: string
  /** Tooltip 显示位置 */
  position?: 'top' | 'bottom' | 'left' | 'right'
  /** 延迟显示时间（毫秒） */
  delay?: number
  /** 最大宽度 */
  maxWidth?: number
}

const props = withDefaults(defineProps<Props>(), {
  position: 'top',
  delay: 200,
  maxWidth: 300
})

const visible = ref(false)
const triggerRect = ref<DOMRect | null>(null)

/**
 * 计算 Tooltip 样式
 */
const tooltipStyle = computed(() => {
  if (!triggerRect.value) return {}
  
  const styles: Record<string, string> = {
    maxWidth: `${props.maxWidth}px`
  }
  
  switch (props.position) {
    case 'top':
      styles.top = `${triggerRect.value.top - 8}px`
      styles.left = `${triggerRect.value.left + (triggerRect.value.width / 2)}px`
      styles.transform = 'translateX(-50%)'
      break
    case 'bottom':
      styles.top = `${triggerRect.value.bottom + 8}px`
      styles.left = `${triggerRect.value.left + (triggerRect.value.width / 2)}px`
      styles.transform = 'translateX(-50%)'
      break
    case 'left':
      styles.top = `${triggerRect.value.top + (triggerRect.value.height / 2)}px`
      styles.left = `${triggerRect.value.left - 8}px`
      styles.transform = 'translateY(-50%) translateX(-100%)'
      break
    case 'right':
      styles.top = `${triggerRect.value.top + (triggerRect.value.height / 2)}px`
      styles.left = `${triggerRect.value.right + 8}px`
      styles.transform = 'translateY(-50%)'
      break
  }
  
  return styles
})

let showTimer: number | null = null
let hideTimer: number | null = null

/**
 * 鼠标进入
 */
const handleMouseEnter = (event: MouseEvent) => {
  // 清除隐藏定时器
  if (hideTimer !== null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  
  // 记录触发元素位置
  triggerRect.value = (event.target as HTMLElement).getBoundingClientRect()
  
  // 延迟显示
  showTimer = window.setTimeout(() => {
    visible.value = true
    showTimer = null
  }, props.delay)
}

/**
 * 鼠标离开
 */
const handleMouseLeave = () => {
  // 清除显示定时器
  if (showTimer !== null) {
    clearTimeout(showTimer)
    showTimer = null
  }
  
  // 立即隐藏
  visible.value = false
}
</script>

<style scoped>
.tooltip-wrapper {
  display: inline-block;
}

.tooltip {
  position: fixed;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.85);
  color: #ffffff;
  font-size: 12px;
  line-height: 1.5;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  z-index: 10000;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* 位置修饰 */
.tooltip-top::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.85);
}

.tooltip-bottom::after {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-bottom-color: rgba(0, 0, 0, 0.85);
}

.tooltip-left::after {
  content: '';
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  border: 5px solid transparent;
  border-left-color: rgba(0, 0, 0, 0.85);
}

.tooltip-right::after {
  content: '';
  position: absolute;
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  border: 5px solid transparent;
  border-right-color: rgba(0, 0, 0, 0.85);
}

/* 过渡动画 */
.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.2s ease;
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
}

/* 深色主题适配 */
@media (prefers-color-scheme: dark) {
  .tooltip {
    background: rgba(255, 255, 255, 0.95);
    color: #333333;
  }
  
  .tooltip-top::after {
    border-top-color: rgba(255, 255, 255, 0.95);
  }
  
  .tooltip-bottom::after {
    border-bottom-color: rgba(255, 255, 255, 0.95);
  }
  
  .tooltip-left::after {
    border-left-color: rgba(255, 255, 255, 0.95);
  }
  
  .tooltip-right::after {
    border-right-color: rgba(255, 255, 255, 0.95);
  }
}
</style>
