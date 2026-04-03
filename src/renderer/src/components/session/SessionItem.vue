/**
 * 会话项组件
 * 显示单个会话配置信息（名称、主机、端口、用户名）
 * 不显示连接状态，连接状态在标签页上显示
 * @module components/session/SessionItem
 */

<template>
  <div
    class="session-item"
    :class="{ active }"
    @click="$emit('click')"
    @dblclick="$emit('dblclick')"
    @contextmenu.prevent="handleContextMenu"
  >
    <!-- 会话图标 -->
    <div class="session-icon">
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="1" y="3" width="14" height="10" rx="1" stroke="currentColor" stroke-width="1.5" fill="none" />
        <path d="M4 7h8M4 10h5" stroke="currentColor" stroke-width="1" />
      </svg>
    </div>

    <!-- 会话信息 -->
    <div class="session-info">
      <div class="session-name">{{ session.name }}</div>
      <div class="session-host">{{ session.username }}@{{ session.host }}:{{ session.port }}</div>
    </div>

    <!-- 操作按钮 -->
    <div class="session-actions" @click.stop>
      <!-- 连接按钮 -->
      <button class="action-btn connect" title="连接" @click="$emit('connect')">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path
            d="M12 2L7 7M12 2l-1 5-2-2M12 2l-5 1 2 2M5 9l-3 3M4 10l-1 1"
            stroke="currentColor"
            stroke-width="1.2"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>

      <!-- 编辑按钮 -->
      <button class="action-btn edit" title="编辑" @click="$emit('edit')">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path
            d="M10.5 2l1.5 1.5-6 6H4V8l6-6zM3 12h8"
            stroke="currentColor"
            stroke-width="1.5"
            fill="none"
          />
        </svg>
      </button>

      <!-- 删除按钮 -->
      <button class="action-btn delete" title="删除" @click="$emit('delete')">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="2" />
        </svg>
      </button>
    </div>

    <!-- 右键菜单 -->
    <div
      v-show="contextMenuVisible"
      ref="contextMenu"
      class="context-menu"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
    >
      <div class="context-menu-item" @click.stop="handleConnect">
        <span>连接</span>
      </div>
      <div class="context-menu-item" @click.stop="handleEdit">
        <span>编辑</span>
      </div>
      <div class="context-menu-item" @click.stop="handleDuplicate">
        <span>复制会话</span>
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item" @click.stop="handleDelete">
        <span>删除</span>
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item" @click.stop="handleProperties">
        <span>属性</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useContextMenuStore } from '@/stores/contextMenu'
import type { Session } from '@shared/types'

// 定义属性
const props = defineProps<{
  session: Session
  active: boolean
}>()

// 定义事件
const emit = defineEmits<{
  (e: 'click'): void
  (e: 'dblclick'): void
  (e: 'connect'): void
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'duplicate'): void
  (e: 'properties'): void
}>()

// 状态管理
const contextMenuStore = useContextMenuStore()

// 右键菜单引用
const contextMenu = ref<HTMLDivElement | null>(null)

// 右键菜单状态
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })

/**
 * 处理右键菜单显示
 */
const handleContextMenu = (event: MouseEvent): void => {
  // 打开会话菜单（会自动关闭其他菜单）
  contextMenuStore.openMenu('session')
  
  // 使用全局坐标（相对于窗口）
  let x = event.clientX
  let y = event.clientY
  
  // 确保菜单不超出窗口右边界
  const menuWidth = 160
  const windowWidth = window.innerWidth
  if (x + menuWidth > windowWidth) {
    x = windowWidth - menuWidth - 10
  }
  
  // 确保菜单不超出窗口下边界
  const menuHeight = 200
  const windowHeight = window.innerHeight
  if (y + menuHeight > windowHeight) {
    y = windowHeight - menuHeight - 10
  }
  
  contextMenuPosition.value = { x, y }
  contextMenuVisible.value = true
}

/**
 * 处理连接操作
 */
const handleConnect = (): void => {
  emit('connect')
  contextMenuVisible.value = false
}

/**
 * 处理编辑操作
 */
const handleEdit = (): void => {
  emit('edit')
  contextMenuVisible.value = false
}

/**
 * 处理复制会话操作
 */
const handleDuplicate = (): void => {
  emit('duplicate')
  contextMenuVisible.value = false
}

/**
 * 处理删除操作
 */
const handleDelete = (): void => {
  emit('delete')
  contextMenuVisible.value = false
}

/**
 * 处理属性操作
 */
const handleProperties = (): void => {
  emit('properties')
  contextMenuVisible.value = false
}

/**
 * 点击菜单外部关闭菜单
 */
const handleClickOutside = (event: MouseEvent): void => {
  if (contextMenu.value && !contextMenu.value.contains(event.target as Node)) {
    contextMenuVisible.value = false
  }
}

// 监听菜单状态变化，确保菜单互斥
watch(
  () => contextMenuStore.currentMenu,
  (newMenu) => {
    // 如果当前菜单不是会话菜单，关闭会话菜单
    if (newMenu !== 'session') {
      contextMenuVisible.value = false
    }
  }
)

onMounted(() => {
  // 监听点击事件，用于关闭右键菜单
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.session-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.session-item:hover {
  background-color: var(--hover-bg, #2a2a2a);
}

.session-item.active {
  background-color: var(--active-bg, #094771);
}

/* 会话图标 */
.session-icon {
  display: flex;
  align-items: center;
  margin-right: 8px;
  color: var(--text-secondary, #808080);
}

.session-item.active .session-icon {
  color: var(--text-color, #cccccc);
}

/* 会话信息 */
.session-info {
  flex: 1;
  min-width: 0;
}

.session-name {
  font-size: 13px;
  color: var(--text-color, #cccccc);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-host {
  font-size: 11px;
  color: var(--text-secondary, #808080);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 操作按钮 */
.session-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.session-item:hover .session-actions {
  opacity: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #808080);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}

.action-btn:hover {
  background-color: var(--hover-bg, #3c3c3c);
  color: var(--text-color, #cccccc);
}

.action-btn.connect:hover {
  color: #0dbc79;
}

.action-btn.delete:hover {
  color: #f14c4c;
}

/* 右键菜单样式 */
.context-menu {
  position: fixed;
  background-color: var(--card-bg, #2d2d2d);
  border: 1px solid var(--border-color, #3d3d3d);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  min-width: 160px;
  padding: 6px 0;
  backdrop-filter: blur(10px);
}

.context-menu-item {
  display: flex;
  align-items: center;
  padding: 8px 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-color, #e0e0e0);
  font-size: 13px;
  user-select: none;
}

.context-menu-item:hover {
  background-color: var(--primary-color, #0e639c);
  color: #ffffff;
}

.context-menu-item:active {
  background-color: var(--primary-hover, #1177bb);
}

.context-menu-divider {
  height: 1px;
  background-color: var(--border-color, #3d3d3d);
  margin: 4px 0;
}
</style>
