/**
 * 连接错误对话框组件
 * 显示连接失败信息，提供重新输入密码的选项
 * @module components/common/ErrorDialog
 */

<template>
  <div v-if="visible" class="error-dialog-overlay" @click.self="handleClose">
    <div class="error-dialog">
      <div class="dialog-header">
        <h3>连接失败</h3>
        <button class="close-btn" @click="handleClose">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="dialog-body">
        <div class="error-icon">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="3" fill="none" />
            <path d="M24 14v16M24 34v2" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </svg>
        </div>
        <div class="error-message">
          <p class="error-title">{{ title }}</p>
          <p class="error-detail">{{ message }}</p>
        </div>
      </div>

      <div class="dialog-footer">
        <button class="btn cancel" @click="handleClose">关闭</button>
        <button v-if="showRetry" class="btn retry" @click="handleRetry">重新输入密码</button>
        <button v-if="showEdit" class="btn edit" @click="handleEdit">编辑会话</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useErrorDialogStore } from '@/stores/errorDialog'
import { useSessionStore } from '@/stores/session'

const errorDialogStore = useErrorDialogStore()
const sessionStore = useSessionStore()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'retry', sessionId: string): void
  (e: 'edit', sessionId: string): void
}>()

const visible = computed(() => errorDialogStore.visible)
const title = computed(() => errorDialogStore.title)
const message = computed(() => errorDialogStore.message)
const sessionId = computed(() => errorDialogStore.sessionId)
const showRetry = computed(() => errorDialogStore.showRetry)
const showEdit = computed(() => errorDialogStore.showEdit)

const handleClose = (): void => {
  errorDialogStore.closeError()
  emit('close')
}

const handleRetry = (): void => {
  const sid = sessionId.value
  if (sid && sessionStore.sessions.some(s => s.id === sid)) {
    emit('retry', sid)
    emit('edit', sid)
  }
  handleClose()
}

const handleEdit = (): void => {
  const sid = sessionId.value
  if (sid) {
    emit('edit', sid)
  }
  handleClose()
}
</script>

<style scoped>
.error-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.error-dialog {
  width: 450px;
  background-color: var(--card-bg, #2d2d2d);
  border: 1px solid var(--border-color, #3c3c3c);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #3c3c3c);
}

.dialog-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color, #e0e0e0);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #808080);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}

.close-btn:hover {
  background-color: var(--hover-bg, #3c3c3c);
  color: var(--text-color, #e0e0e0);
}

.dialog-body {
  padding: 24px 20px;
  display: flex;
  gap: 16px;
}

.error-icon {
  flex-shrink: 0;
  color: #f14c4c;
}

.error-message {
  flex: 1;
}

.error-title {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color, #e0e0e0);
}

.error-detail {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary, #808080);
  line-height: 1.5;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color, #3c3c3c);
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn.cancel {
  background-color: transparent;
  color: var(--text-secondary, #808080);
}

.btn.cancel:hover {
  background-color: var(--hover-bg, #3c3c3c);
  color: var(--text-color, #e0e0e0);
}

.btn.retry {
  background-color: var(--primary-color, #0e639c);
  color: #ffffff;
}

.btn.retry:hover {
  background-color: var(--primary-hover, #1177bb);
}

.btn.edit {
  background-color: transparent;
  color: var(--primary-color, #0e639c);
  border: 1px solid var(--primary-color, #0e639c);
}

.btn.edit:hover {
  background-color: var(--primary-color, #0e639c);
  color: #ffffff;
}

/* 浅色主题适配 */
[data-theme="light"] .error-dialog {
  background-color: #ffffff;
  border-color: #e0e0e0;
}

[data-theme="light"] .dialog-header {
  border-bottom-color: #e0e0e0;
}

[data-theme="light"] .dialog-header h3 {
  color: #333333;
}

[data-theme="light"] .close-btn:hover {
  background-color: #f0f0f0;
}

[data-theme="light"] .error-title {
  color: #333333;
}

[data-theme="light"] .error-detail {
  color: #666666;
}

[data-theme="light"] .dialog-footer {
  border-top-color: #e0e0e0;
}

[data-theme="light"] .btn.cancel:hover {
  background-color: #f0f0f0;
}
</style>
