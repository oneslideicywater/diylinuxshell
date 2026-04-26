/**
 * 文件列表骨架屏加载组件
 * 
 * 用途：SFTP 远程/本地文件浏览器加载大目录时（如 /bin、/usr/lib）显示占位动画
 * 设计原则：
 *   - 与 file-item 布局完全对齐（icon 16px + name flex + size 右对齐）
 *   - 使用 CSS shimmer 动画模拟内容加载中的视觉效果
 *   - 通过 CSS 变量适配亮色/暗色主题
 * 
 * @module components/common/FileListSkeleton
 */

<template>
  <div class="file-list-skeleton">
    <div
      v-for="i in rows"
      :key="i"
      class="skeleton-row"
      :style="{ animationDelay: `${(i - 1) * 60}ms` }"
    >
      <!-- 图标占位（与 .file-icon-wrapper 对齐：16x16 + gap:8px） -->
      <div class="skeleton-icon" />
      <!-- 文件名占位（与 .file-name 对齐：flex:1，宽度随机变化增加真实感） -->
      <div
        class="skeleton-name"
        :style="{ width: nameWidths[(i - 1) % nameWidths.length] }"
      />
      <!-- 文件大小占位（与 .file-size 对齐：固定窄宽） -->
      <div class="skeleton-size" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Props 定义
 */
interface Props {
  /** 骨架屏行数（默认 10 行，覆盖大部分目录的初始视口高度） */
  rows?: number
}

withDefaults(defineProps<Props>(), {
  rows: 10
})

/**
 * 文件名骨架宽度变化数组
 * 
 * 不同行使用不同宽度，模拟真实文件名长度差异
 * 避免所有行看起来一模一样的机械感
 */
const nameWidths = ['65%', '45%', '78%', '52%', '70%', '38%', '82%', '55%', '62%', '48%']
</script>

<style scoped>
/* ── 容器 ──────────────────────────────────────────────── */
.file-list-skeleton {
  padding: 4px;
}

/* ── 单行骨架（与 .file-item 布局一致）────────────────── */
.skeleton-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 3px;
}

/* ── 图标占位（16x16 方形，对应 SVG icon 尺寸）────────── */
.skeleton-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  background: linear-gradient(
    110deg,
    var(--skeleton-base, rgba(128, 128, 128, 0.12)) 0%,
    var(--skeleton-base, rgba(128, 128, 128, 0.12)) 40%,
    var(--skeleton-shine, rgba(128, 128, 128, 0.2)) 50%,
    var(--skeleton-base, rgba(128, 128, 128, 0.12)) 60%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.6s ease-in-out infinite;
}

/* ── 文件名占位（flex:1，高度与文字行高匹配）──────────── */
.skeleton-name {
  height: 14px;
  border-radius: 3px;
  background: linear-gradient(
    110deg,
    var(--skeleton-base, rgba(128, 128, 128, 0.12)) 0%,
    var(--skeleton-base, rgba(128, 128, 128, 0.12)) 40%,
    var(--skeleton-shine, rgba(128, 128, 128, 0.2)) 50%,
    var(--skeleton-base, rgba(128, 128, 128, 0.12)) 60%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.6s ease-in-out infinite;
}

/* ── 文件大小占位（窄条，右对齐效果由 flex 布局保证）── */
.skeleton-size {
  flex-shrink: 0;
  width: 48px;
  height: 12px;
  border-radius: 3px;
  background: linear-gradient(
    110deg,
    var(--skeleton-base, rgba(128, 128, 128, 0.12)) 0%,
    var(--skeleton-base, rgba(128, 128, 128, 0.12)) 40%,
    var(--skeleton-shine, rgba(128, 128, 128, 0.2)) 50%,
    var(--skeleton-base, rgba(128, 128, 128, 0.12)) 60%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.6s ease-in-out infinite;
}

/* ── Shimmer 动画：从左到右扫光效果 ──────────────────── */
@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
