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
      <!-- SFTP 传输按钮 -->
      <button class="action-btn sftp" title="SFTP 传输" @click.stop="$emit('sftp')">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M10 1H4a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V5l-2-2zM10 1v4h4"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
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
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
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
  (e: 'sftp'): void
}>()

/* 编辑按钮 ref（用于原生事件绑定） */
const editBtnRef = ref<HTMLButtonElement | null>(null)

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

/* 组件挂载时确认 session 值 */
onMounted(() => {
  console.log('[SessionItem] onMounted, session:', currentSession.value?.name, 'id:', currentSession.value?.id)
  
  /* 使用原生 addEventListener 绑定编辑按钮点击事件 */
  /* 解决 Vue 模板编译 @click 在特定条件下不触发的问题 */
  if (editBtnRef.value) {
    console.log('[SessionItem] editBtnRef 已绑定, 按钮存在:', !!editBtnRef.value)
    editBtnRef.value.addEventListener('click', handleEditClick)
  } else {
    console.warn('[SessionItem] editBtnRef 为空!')
  }
})

onBeforeUnmount(() => {
  /* 组件卸载时清理事件监听器 */
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
