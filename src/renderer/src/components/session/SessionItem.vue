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
    @click="handleClick"
    @dblclick="$emit('dblclick')"
    @contextmenu.prevent.stop="handleContextMenu"
  >
    <!-- 会话图标 - 云命令行 -->
    <div class="session-icon">
      <svg width="16" height="16" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
        <path d="M917.333333 835.413333H106.666667V188.586667h810.666666zM186.666667 755.413333h650.666666V268.586667H186.666667z" fill="currentColor" />
        <path d="M343.04 648.746667l-56.533333-56.533334 88.32-88.32-88.32-88.32 56.533333-56.746666 144.853333 145.066666-144.853333 144.853334zM507.093333 585.173333h230.4v80h-230.4z" fill="currentColor" />
      </svg>
    </div>

    <!-- 会话信息 -->
    <div class="session-info">
      <div class="session-name">{{ session.name }}</div>
      <div class="session-host">{{ session.username }}@{{ session.host }}:{{ session.port }}</div>
    </div>

    <!-- 操作按钮 -->
    <div class="session-actions" @click.stop>
      <!-- SFTP 传输按钮 -->
      <button class="action-btn sftp" title="SFTP 传输" @click.stop="$emit('sftp')">
        <svg width="14" height="14" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
          <path d="M933.8 348.4h-64v-96.7c0-29.4-23.9-53.3-53.3-53.3H373.9v-64h442.6c64.7 0 117.3 52.6 117.3 117.3v96.7z" fill="currentColor" />
          <path d="M330.6 162.7l63.9 159.7c6.4 15.9 17.2 29.4 31.4 39C440 371 456.5 376 473.7 376h406.6c11.8 0 21.3 9.6 21.3 21.3V840c0 11.8-9.6 21.3-21.3 21.3H142.6c-11.8 0-21.3-9.6-21.3-21.3V184c0-11.8 9.6-21.3 21.3-21.3h188m28.9-64H142.6c-47.1 0-85.3 38.2-85.3 85.3v656c0 47.1 38.2 85.3 85.3 85.3h737.7c47.1 0 85.3-38.2 85.3-85.3V397.4c0-47.1-38.2-85.3-85.3-85.3H473.7c-8.7 0-16.6-5.3-19.8-13.4l-74.6-186.5c-3.3-8.2-11.1-13.5-19.8-13.5z" fill="currentColor" />
          <path d="M630.9 649.5H346.5c-17.7 0-32-14.3-32-32s14.3-32 32-32h284.4c17.7 0 32 14.3 32 32s-14.3-32 32-32z" fill="currentColor" />
          <path d="M548 751.6c-8.2 0-16.4-3.1-22.6-9.4-12.5-12.5-12.5-32.8 0-45.3l82.4-82.4-82.4-82.4c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l105 105c12.5 12.5 12.5 32.8 0 45.3l-105 105c-6.3 6.4-14.5 9.5-22.7 9.5z" fill="currentColor" />
        </svg>
      </button>

      <!-- 连接按钮 -->
      <button class="action-btn connect" title="连接" @click.stop="$emit('connect')">
        <svg width="14" height="14" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M883.3434 126.191914c-28.430589-28.430589-65.83926-43.89284-106.240623-43.89284-39.902582 0-77.810034 15.46225-106.240623 43.89284l-171.082319 171.082319c-5.985387 5.985387-5.985387 15.46225 0 20.948855 5.985387 5.985387 15.46225 5.985387 20.948855 0l171.082319-171.082319c22.445202-22.445202 52.870921-34.914759 84.792986-34.914759 31.922065 0 62.347784 12.469557 84.792986 34.914759 46.885533 46.885533 46.885533 122.700438 0 169.585972l-226.945933 226.945933c-46.885533 46.885533-122.700438 46.885533-169.585972 0-5.985387-5.985387-15.46225-5.985387-20.948855 0-5.985387 5.985387-5.985387 15.46225 0 20.948855 29.428154 29.428154 67.834389 43.89284 106.240623 43.89284s76.81247-14.464686 106.240623-43.89284l226.945933-226.945933C941.700925 279.816853 941.700925 184.54944 883.3434 126.191914z"
            fill="currentColor"
            stroke="currentColor"
            stroke-width="60"
          />
          <path
            d="M502.772528 676.84754l-171.082319 171.082319c-46.885533 46.885533-122.700438 46.885533-169.585972 0-46.885533-46.885533-46.885533-122.700438 0-169.585972L389.05017 450.899172c22.445202-22.445202 52.870921-34.914759 84.792986-34.914759s62.347784 12.469557 84.792986 34.914759c5.985387 5.985387 15.46225 5.985387 20.948855 0 5.985387-5.985387 5.985387-15.46225 0-20.948855-28.430589-28.430589-65.83926-43.89284-106.240623-43.89284s-77.810034 15.46225-106.240623 43.89284l-226.945933 226.945933c-58.357526 58.357526-58.357526 153.624939 0 211.982465 28.430589 28.430589 65.83926 43.89284 106.240623 43.89284 39.902582 0 77.810034-15.46225 106.240623-43.89284l171.082319-171.082319c5.985387-5.985387 5.985387-15.46225 0-20.948855C517.735996 670.862153 508.259133 670.862153 502.772528 676.84754z"
            fill="currentColor"
            stroke="currentColor"
            stroke-width="60"
          />
        </svg>
      </button>

      <!-- 编辑按钮 -->
      <button ref="editBtnRef" class="action-btn edit" title="编辑" @click.stop>
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
      <button class="action-btn delete" title="删除" @click.stop="$emit('delete')">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="2" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import type { Session } from '@shared/types'
import { useContextMenuStore, type ContextMenuItem } from '@/stores/contextMenu'

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
  (e: 'sftp'): void
  (e: 'add-session', groupId?: string): void
}>()

/* 编辑按钮 ref（用于原生事件绑定） */
const editBtnRef = ref<HTMLButtonElement | null>(null)

/* 右键菜单 Store（全局唯一管理） */
const contextMenuStore = useContextMenuStore()

/* 当前组件的唯一标识（用于 Store 区分拥有者） */
const menuOwnerId = computed(() => `session-${props.session.id}`)

/**
 * 处理点击事件
 * 如果点击来自操作按钮区域，则不触发 click 事件
 */
const handleClick = (event: MouseEvent): void => {
  const target = event.target as HTMLElement
  if (target.closest('.session-actions')) {
    return
  }
  emit('click')
}

/* 使用 ref 存储当前 session 的快照，避免闭包问题 */
const currentSession = ref<Session>(props.session)

/* 同步 props.session 到本地 ref */
watch(() => props.session, (newSession) => {
  console.log('[SessionItem] props.session 变化:', newSession?.name, 'id:', newSession?.id)
  currentSession.value = newSession
}, { immediate: true })

/**
 * 编辑按钮点击处理函数
 * 使用原生事件绑定确保可靠触发
 */
const handleEditClick = (): void => {
  console.log('[SessionItem] 编辑按钮被点击, session:', currentSession.value?.name, 'id:', currentSession.value?.id)
  emit('edit')
}

/* ==================== 右键菜单相关逻辑 ==================== */

/**
 * 处理会话右键菜单
 * 通过全局 Store 管理菜单状态，传入动态 menuItems 和 actionCallback
 */
const handleContextMenu = (event: MouseEvent): void => {
  event.preventDefault()
  event.stopPropagation()

  let x = event.clientX
  let y = event.clientY

  /* 边界检测：防止菜单超出窗口 */
  const menuWidth = 180
  const menuHeight = 220
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10
  }

  /* 构建菜单项列表 */
  const menuItems: ContextMenuItem[] = [
    { action: 'add-session', title: '添加会话', description: '添加会话到当前分组' },
    { action: 'connect', title: '连接', description: '连接到当前会话' },
    { action: 'edit', title: '编辑', description: '编辑当前会话配置' },
    { action: 'duplicate', title: '复制会话', description: '复制当前会话' },
    { action: 'delete', title: '删除', description: '删除当前会话' },
    { action: 'inspect', title: '审查元素', description: '打开开发者工具并审查当前元素' }
  ]

  /* 通过 Store 显示右键菜单（注册所有权 + 菜单项 + 回调） */
  contextMenuStore.showContextMenu(menuOwnerId.value, { x, y }, menuItems, (action: string) => {
    switch (action) {
      case 'add-session':
        emit('add-session', props.session.groupId)
        break
      case 'connect':
        emit('connect')
        break
      case 'edit':
        emit('edit')
        break
      case 'duplicate':
        emit('duplicate')
        break
      case 'delete':
        emit('delete')
        break
      case 'inspect':
        if (window.api?.openDevTools) {
          const pos = contextMenuStore.position
          window.api.openDevTools({ ...pos })
        } else {
          console.error('[SessionItem] window.api.openDevTools is not available')
        }
        break
    }
  })
}

/* 组件挂载时确认 session 值并绑定编辑按钮事件 */
onMounted(() => {
  console.log('[SessionItem] onMounted, session:', currentSession.value?.name, 'id:', currentSession.value?.id)

  if (editBtnRef.value) {
    console.log('[SessionItem] editBtnRef 已绑定, 按钮存在:', !!editBtnRef.value)
    editBtnRef.value.addEventListener('click', handleEditClick)
  } else {
    console.warn('[SessionItem] editBtnRef 为空!')
  }
})

onBeforeUnmount(() => {
  if (editBtnRef.value) {
    editBtnRef.value.removeEventListener('click', handleEditClick)
  }
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
  background-color: transparent;
  color: var(--text-color, #cccccc);
}

.action-btn.sftp:hover {
  color: var(--primary-color, #409eff);
}

.action-btn.connect:hover {
  color: #67c23a;
}

.action-btn.edit:hover {
  color: #e6a23c;
}

.action-btn.delete:hover {
  color: #f56c6c;
}
</style>
