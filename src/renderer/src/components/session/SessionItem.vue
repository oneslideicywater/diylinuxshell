/**
 * 会话项组件
 * 显示单个会话信息和操作按钮
 * @module components/session/SessionItem
 */

<template>
  <div
    class="session-item"
    :class="{ active, disconnected: session.status === 'disconnected' }"
    @click="$emit('click')"
  >
    <!-- 连接状态指示器 -->
    <div class="status-indicator" :class="session.status">
      <span class="status-dot"></span>
    </div>

    <!-- 会话信息 -->
    <div class="session-info">
      <div class="session-name">{{ session.name }}</div>
      <div class="session-host">{{ session.username }}@{{ session.host }}:{{ session.port }}</div>
    </div>

    <!-- 操作按钮 -->
    <div class="session-actions" @click.stop>
      <!-- 连接/断开按钮 -->
      <button
        v-if="session.status !== 'connected'"
        class="action-btn connect"
        title="连接"
        @click="$emit('connect')"
      >
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M2 7h10M9 4l3 3-3 3" stroke="currentColor" stroke-width="2" fill="none" />
        </svg>
      </button>
      <button v-else class="action-btn disconnect" title="断开" @click="$emit('disconnect')">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M2 7h10M5 4l-3 3 3 3" stroke="currentColor" stroke-width="2" fill="none" />
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
  </div>
</template>

<script setup lang="ts">
import type { Session } from '@shared/types'

// 定义属性
defineProps<{
  session: Session
  active: boolean
}>()

// 定义事件
defineEmits<{
  (e: 'click'): void
  (e: 'connect'): void
  (e: 'disconnect'): void
  (e: 'edit'): void
  (e: 'delete'): void
}>()
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

/* 连接状态指示器 */
.status-indicator {
  display: flex;
  align-items: center;
  margin-right: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--text-tertiary, #606060);
}

.status-indicator.connected .status-dot {
  background-color: #4ec9b0;
}

.status-indicator.connecting .status-dot {
  background-color: #dcdcaa;
  animation: pulse 1s infinite;
}

.status-indicator.disconnected .status-dot {
  background-color: var(--text-tertiary, #606060);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
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
  color: #4ec9b0;
}

.action-btn.disconnect:hover {
  color: #dcdcaa;
}

.action-btn.delete:hover {
  color: #f14c4c;
}
</style>
