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
import { watch } from 'vue'

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

const props = withDefaults(defineProps<Props>(), {
  isWarning: false
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

/**
 * 关闭对话框
 */
const handleClose = () => {
  emit('close')
}

/**
 * 确认操作
 */
const handleConfirm = () => {
  emit('confirm')
  // 不触发 close 事件，由父组件控制 visible
}

/**
 * 取消操作
 */
const handleCancel = () => {
  emit('cancel')
  // 不触发 close 事件，由父组件控制 visible
}

// 监听 visible 变化，确保可以关闭
watch(() => props.visible, (newVal) => {
  if (!newVal) {
    // 对话框已关闭
  }
})
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
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.confirm-dialog {
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

/* 警告样式 */
.confirm-dialog.is-warning {
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

.btn-cancel {
  background: var(--hover-bg, #2a2a2a);
  color: var(--text-secondary, #808080);
}

.btn-cancel:hover {
  background: #4a4a4a;
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
[data-theme="light"] .confirm-dialog {
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

[data-theme="light"] .btn-cancel {
  background: #f5f5f5;
  color: #666666;
}

[data-theme="light"] .btn-cancel:hover {
  background: #e8e8e8;
}
</style>
