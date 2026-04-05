/**
 * 分组图标组件
 * 统一使用文件夹图标
 * @module components/session/GroupIcon
 */

<template>
  <svg
    class="group-icon"
    :width="size"
    :height="size"
    viewBox="0 0 20 20"
    fill="none"
  >
    <!-- 统一使用文件夹图标 -->
    <path
      d="M18 16C18 17.1046 17.1046 18 16 18H4C2.89543 18 2 17.1046 2 16V4C2 2.89543 2.89543 2 4 2H8L10 5H16C17.1046 5 18 5.89543 18 7V16Z"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script setup lang="ts">
/**
 * Props 定义
 */
interface Props {
  /** 图标大小，默认 16 */
  size?: number
}

withDefaults(defineProps<Props>(), {
  size: 16
})
</script>

<style scoped>
.group-icon {
  flex-shrink: 0;
  color: var(--text-secondary, #999999);
  transition: color 0.15s;
}

.group-header:hover .group-icon {
  color: var(--text-color, #cccccc);
}
</style>
