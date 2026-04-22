/**
 * 确认对话框组件
 * 用于显示二次确认对话框
 * @module components/common/ConfirmDialog
 */

<template>
  <Teleport to="body">
    <div v-if="visible" class="dialog-overlay" @click.self="handleClose">
      <div class="confirm-dialog" :class="{ 'is-warning': isWarning }">
        <div class="dialog-header">
          <h3 class="dialog-title">{{ title }}</h3>
          <button class="close-btn" @click="handleCancel">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="dialog-content">
          <div class="content-text">{{ message }}</div>
        </div>

        <div class="dialog-footer">
          <button class="btn btn-cancel" @click="handleCancel">
            取消
          </button>
          <button
            class="btn btn-confirm"
            :class="{ 'btn-danger': isWarning }"
            @click="handleConfirm"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
interface Props {
  /** 对话框是否可见 */
  visible: boolean
  /** 对话框标题 */
  title: string
  /** 对话框消息内容 */
  message: string
  /** 是否为警告样式（红色按钮） */
  isWarning?: boolean
}

withDefaults(defineProps<Props>(), {
  isWarning: false
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const handleClose = () => {
  emit('close')
}

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped>
.dialog-overlay {
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
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.confirm-dialog {
  background-color: var(--card-bg, #2d2d2d);
  border: 1px solid var(--border-color, #3c3c3c);
  border-radius: 8px;
  min-width: 400px;
  max-width: 500px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  animation: slideIn 0.2s ease;
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.confirm-dialog.is-warning {
  border-left: 4px solid #f14c4c;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #3c3c3c);
}

.dialog-title {
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

.dialog-content {
  padding: 24px 20px;
}

.content-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary, #808080);
  white-space: pre-wrap;
}

.dialog-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color, #3c3c3c);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  font-size: 13px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel {
  background-color: transparent;
  color: var(--text-secondary, #808080);
}

.btn-cancel:hover {
  background-color: var(--hover-bg, #3c3c3c);
  color: var(--text-color, #e0e0e0);
}

.btn-confirm {
  background-color: var(--primary-color, #0e639c);
  color: #ffffff;
}

.btn-confirm:hover {
  background-color: var(--primary-hover, #1177bb);
}

.btn-danger {
  background-color: #d93025;
}

.btn-danger:hover {
  background-color: #b52b1f;
}

/* 浅色主题适配 */
[data-theme="light"] .confirm-dialog {
  background-color: #ffffff;
  border-color: #e0e0e0;
}

[data-theme="light"] .dialog-header {
  border-bottom-color: #e0e0e0;
}

[data-theme="light"] .dialog-title {
  color: #333333;
}

[data-theme="light"] .close-btn:hover {
  background-color: #f0f0f0;
}

[data-theme="light"] .content-text {
  color: #666666;
}

[data-theme="light"] .dialog-footer {
  border-top-color: #e0e0e0;
}

[data-theme="light"] .btn-cancel:hover {
  background-color: #f0f0f0;
}
</style>
