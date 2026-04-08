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
      <button class="action-btn edit" title="编辑" @click.stop="$emit('edit')">
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

/**
 * 处理点击事件
 * 如果点击来自操作按钮区域，则不触发 click 事件
 */
const handleClick = (event: MouseEvent): void => {
  // 检查点击目标是否在操作按钮区域内
  const target = event.target as HTMLElement
  if (target.closest('.session-actions')) {
    // 点击的是操作按钮，不触发 click 事件
    return
  }
  // 触发 click 事件
  emit('click')
}
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
