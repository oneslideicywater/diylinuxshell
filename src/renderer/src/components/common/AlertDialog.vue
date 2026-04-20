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

const props = withDefaults(defineProps<Props>(), {
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
  background: #ffffff;
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
  border-bottom: 1px solid #e0e0e0;
}

.dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333333;
}

.dialog-content {
  padding: 24px 20px;
}

.content-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #666666;
  white-space: pre-wrap;
}

.dialog-footer {
  padding: 16px 20px;
  border-top: 1px solid #e0e0e0;
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
  background: #1a73e8;
  color: #ffffff;
}

.btn-confirm:hover {
  background: #1557b0;
}

.btn-danger {
  background: #d93025;
}

.btn-danger:hover {
  background: #b52b1f;
}

@media (prefers-color-scheme: dark) {
  .alert-dialog {
    background: #2d2d2d;
  }

  .dialog-header {
    border-bottom-color: #404040;
  }

  .dialog-title {
    color: #ffffff;
  }

  .dialog-content {
    color: #cccccc;
  }

  .dialog-footer {
    border-top-color: #404040;
  }
}
</style>
