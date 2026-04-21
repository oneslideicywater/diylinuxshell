/**
 * 警告/提示对话框组件（单按钮模式）
 * 替代原生 alert()，提供统一的 UI 风格
 * @module components/common/AlertDialog
 */

<template>
  <Teleport to="body">
    <div v-if="visible" class="dialog-overlay" @click.self="handleClose">
      <div class="alert-dialog" :class="{ 'is-error': isError }">
        <div class="dialog-header">
          <h3 class="dialog-title">{{ title }}</h3>
        </div>

        <div class="dialog-content">
          <div class="content-text">{{ message }}</div>
        </div>

        <div class="dialog-footer">
          <button
            class="btn btn-confirm"
            :class="{ 'btn-danger': isError }"
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
  /** 是否为错误样式（红色按钮） */
  isError?: boolean
}

withDefaults(defineProps<Props>(), {
  isError: false
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()

const handleClose = () => {
  emit('close')
}

const handleConfirm = () => {
  emit('confirm')
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.alert-dialog {
  background: var(--card-bg, #2d2d2d);
  border-radius: 8px;
  min-width: 400px;
  max-width: 500px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
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

.alert-dialog.is-error {
  border-left: 4px solid #d93025;
}

.dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #3c3c3c);
}

.dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color, #cccccc);
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
  gap: 12px;
}

.btn {
  padding: 8px 20px;
  font-size: 14px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-confirm {
  background: var(--primary-color, #0e639c);
  color: #ffffff;
}

.btn-confirm:hover {
  background: var(--primary-hover, #1177bb);
}

.btn-danger {
  background: #d93025;
}

.btn-danger:hover {
  background: #b52b1f;
}

/* 浅色主题适配 */
[data-theme="light"] .alert-dialog {
  background: #ffffff;
}

[data-theme="light"] .dialog-header {
  border-bottom-color: #e0e0e0;
}

[data-theme="light"] .dialog-title {
  color: #333333;
}

[data-theme="light"] .dialog-content {
  color: #666666;
}

[data-theme="light"] .dialog-footer {
  border-top-color: #e0e0e0;
}
</style>
