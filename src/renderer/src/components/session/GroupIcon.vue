/**
 * 分组图标组件
 * 根据图标类型渲染对应的 SVG 图标
 * @module components/session/GroupIcon
 */

<template>
  <svg
    v-if="iconType"
    class="group-icon"
    :width="size"
    :height="size"
    viewBox="0 0 20 20"
    fill="none"
  >
    <!-- 文件夹图标 -->
    <path
      v-if="iconType === 'folder'"
      d="M18 16C18 17.1046 17.1046 18 16 18H4C2.89543 18 2 17.1046 2 16V4C2 2.89543 2.89543 2 4 2H8L10 5H16C17.1046 5 18 5.89543 18 7V16Z"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- 服务器图标 -->
    <g v-else-if="iconType === 'server'">
      <rect
        x="2"
        y="3"
        width="16"
        height="5"
        rx="1"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <rect
        x="2"
        y="12"
        width="16"
        height="5"
        rx="1"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <circle
        cx="5.5"
        cy="5.5"
        r="0.75"
        fill="currentColor"
      />
      <circle
        cx="5.5"
        cy="14.5"
        r="0.75"
        fill="currentColor"
      />
    </g>

    <!-- 云图标 -->
    <path
      v-else-if="iconType === 'cloud'"
      d="M16 14H5C3.34315 14 2 12.6569 2 11C2 9.34315 3.34315 8 5 8C5.07862 8 5.15647 8.003 5.23347 8.00888C5.73184 6.25282 7.35189 5 9.25 5C11.5972 5 13.5 6.90279 13.5 9.25C13.5 9.33434 13.4984 9.41828 13.4952 9.50179C14.9582 9.78204 16 11.0823 16 12.625V14Z"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- 数据库图标 -->
    <g v-else-if="iconType === 'database'">
      <ellipse
        cx="10"
        cy="5"
        rx="7"
        ry="3"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <path
        d="M3 5V15C3 16.6569 6.13401 18 10 18C13.866 18 17 16.6569 17 15V5"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <path
        d="M3 10C3 11.6569 6.13401 13 10 13C13.866 13 17 11.6569 17 10"
        stroke="currentColor"
        stroke-width="1.5"
      />
    </g>

    <!-- 代码图标 -->
    <g v-else-if="iconType === 'code'">
      <path
        d="M7 14L3 10L7 6"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M13 6L17 10L13 14"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </g>

    <!-- 星标图标 -->
    <path
      v-else-if="iconType === 'star'"
      d="M10 2L12.39 6.88L17.78 7.54L13.89 11.28L14.78 16.64L10 14.1L5.22 16.64L6.11 11.28L2.22 7.54L7.61 6.88L10 2Z"
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
  /** 图标类型 */
  iconType?: string
  /** 图标大小，默认 16 */
  size?: number
}

withDefaults(defineProps<Props>(), {
  iconType: undefined,
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
