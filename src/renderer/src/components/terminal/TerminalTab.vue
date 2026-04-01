/**
 * 点击Session连接按钮,会创建一个标签页 
 * 单个标签页组件
 * 显示标签页标题和关闭按钮
 * @module components/terminal/TerminalTab
 */

<template>
  <div class="terminal-tab" :class="{ active }" @click="$emit('click')">
    <!-- 标签图标 -->
    <svg class="tab-icon" width="14" height="14" viewBox="0 0 14 14">
      <rect x="1" y="3" width="12" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none" />
      <path d="M4 6h6M4 8h4" stroke="currentColor" stroke-width="1" />
    </svg>

    <!-- 标签标题 -->
    <span class="tab-title">{{ tab.title }}</span>

    <!-- 关闭按钮 -->
    <button class="close-btn" title="关闭" @click.stop="$emit('close')">
      <svg width="10" height="10" viewBox="0 0 10 10">
        <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.5" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Tab } from '@shared/types'

// 定义属性
defineProps<{
  tab: Tab
  active: boolean
}>()

// 定义事件
defineEmits<{
  (e: 'click'): void
  (e: 'close'): void
}>()
</script>

<style scoped>
.terminal-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 8px 0 12px;
  background-color: var(--tab-bg, #2d2d2d);
  border-right: 1px solid var(--border-color, #3c3c3c);
  cursor: pointer;
  min-width: 100px;
  max-width: 200px;
  transition: background-color 0.15s;
}

.terminal-tab:hover {
  background-color: var(--tab-hover-bg, #3c3c3c);
}

.terminal-tab.active {
  background-color: var(--tab-active-bg, #1e1e1e);
}

.tab-icon {
  flex-shrink: 0;
  color: var(--text-secondary, #808080);
}

.terminal-tab.active .tab-icon {
  color: var(--text-color, #cccccc);
}

.tab-title {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary, #808080);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.terminal-tab.active .tab-title {
  color: var(--text-color, #cccccc);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: var(--text-tertiary, #606060);
  cursor: pointer;
  border-radius: 3px;
  opacity: 0;
  transition: all 0.15s;
}

.terminal-tab:hover .close-btn {
  opacity: 1;
}

.close-btn:hover {
  background-color: var(--hover-bg, #4c4c4c);
  color: var(--text-color, #cccccc);
}
</style>
