<template>
  <Teleport to="body">
    <div
      v-if="contextMenuStore.visible && visibleItems.length > 0"
      ref="menuRef"
      class="global-context-menu"
      :style="menuStyle"
      tabindex="-1"
      @click.stop
      @contextmenu.stop
    >
      <div
        v-for="item in visibleItems"
        :key="item.action"
        class="context-menu-item"
        :class="{ 'is-danger': item.danger }"
        @click="contextMenuStore.handleSelect(item.action)"
      >
        <span
          v-if="item.icon && getIconSvg(item.icon)"
          class="menu-item-icon"
          v-html="getIconSvg(item.icon)"
        />
        <span class="menu-item-title">{{ item.title }}</span>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useContextMenuStore } from '@/stores/contextMenu'

/**
 * 使用 Vite import.meta.glob 静态导入 contextmenu 目录下所有 SVG 图标
 * Vite 会在构建时将 SVG 处理为 URL，避免 loadFile() 模式下路径解析问题
 */
const iconModules = import.meta.glob('./contextmenu/*.svg', { eager: true, as: 'raw' })

/** 从文件名提取 icon key（如 './contextmenu/add.svg' → 'add'） */
function extractIconName(path: string): string {
  return path.replace(/^\.\/contextmenu\/(.+)\.svg$/, '$1')
}

/** 构建 icon name → SVG 内容的映射表 */
const iconMap: Record<string, string> = {}
for (const [path, mod] of Object.entries(iconModules)) {
  const name = extractIconName(path)
  iconMap[name] = (mod as string)
}

/**
 * 根据 icon 名称获取对应的 SVG 字符串
 * @param icon 图标名称
 * @returns SVG 字符串，不存在则返回空字符串
 */
function getIconSvg(icon: string): string {
  return iconMap[icon] || ''
}

const contextMenuStore = useContextMenuStore()
const menuRef = ref<HTMLElement | null>(null)

const menuStyle = computed(() => {
  const pos = contextMenuStore.position
  return {
    left: `${pos.x}px`,
    top: `${pos.y}px`
  }
})

const visibleItems = computed(() => {
  return contextMenuStore.items.filter(item => 
    item.visible === undefined || item.visible === true
  )
})

/**
 * 全局 ESC 键关闭菜单（无论焦点在哪里都能响应）
 */
function handleGlobalKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && contextMenuStore.visible) {
    event.preventDefault()
    contextMenuStore.hideContextMenu()
  }
}

/**
 * 全局点击关闭菜单（解决 @click.stop 阻止冒泡导致菜单无法关闭的问题）
 * 根因：SftpTransfer 的 .sftp-window 有 @click.stop，
 *       导致内部点击无法到达 .app-layout 的 handleGlobalClick
 */
function handleGlobalClick(event: MouseEvent): void {
  if (!contextMenuStore.visible) return
  const target = event.target as HTMLElement
  const isInsideMenu = target.closest('.global-context-menu, .context-menu-item')
  if (!isInsideMenu) {
    contextMenuStore.hideContextMenu()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown)
  document.addEventListener('click', handleGlobalClick, true)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
  document.removeEventListener('click', handleGlobalClick, true)
})
</script>

<style scoped>
.global-context-menu {
  position: fixed;
  background: var(--card-bg, #2d2d2d);
  border: 1px solid var(--border-color, #3c3c3c);
  border-radius: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  padding: 4px 8px;
  min-width: 140px;
  z-index: 99999;
}

.context-menu-item {
  padding: 8px 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.12s;
}

.context-menu-item:hover {
  background: var(--hover-bg, #2a2a2a);
}

.context-menu-item:hover .menu-item-title {
  color: var(--text-color, #e0e0e0);
}

.menu-item-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.context-menu-item.is-danger .menu-item-title {
  color: #f56c6c;
}

.menu-item-title {
  font-size: 13px;
  color: var(--text-color, #e0e0e0);
  white-space: nowrap;
}
</style>
