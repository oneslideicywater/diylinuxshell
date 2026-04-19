<template>
  <Teleport to="body">
    <div
      v-if="contextMenuStore.visible"
      class="global-context-menu"
      :style="menuStyle"
      @click.stop
      @contextmenu.stop
      tabindex="-1"
      ref="menuRef"
    >
      <div
        v-for="item in visibleItems"
        :key="item.action"
        class="context-menu-item"
        @click="contextMenuStore.handleSelect(item.action)"
      >
        <span class="menu-item-title">{{ item.title }}</span>
        <span v-if="item.description" class="menu-item-description">{{ item.description }}</span>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useContextMenuStore } from '@/stores/contextMenu'

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
  return contextMenuStore.items.filter(item => item.visible !== false)
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
  background: var(--card-bg, var(--bg-color, #ffffff));
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 200px;
  z-index: 99999;
}

.context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: background-color 0.15s;
}

.context-menu-item:hover {
  background: var(--hover-bg, #f0f0f0);
}

.menu-item-title {
  font-size: 13px;
  color: var(--text-color, #333333);
  font-weight: 500;
}

.menu-item-description {
  font-size: 11px;
  color: var(--text-color-secondary, #999999);
}
</style>
