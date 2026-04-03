/**
 * 错误对话框状态管理 Store
 * 管理全局错误对话框的显示状态
 * @module stores/errorDialog
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 错误对话框状态管理 Store
 * 提供全局错误对话框的显示和管理功能
 */
export const useErrorDialogStore = defineStore('errorDialog', () => {
  // 对话框显示状态
  const visible = ref(false)
  
  // 错误标题
  const title = ref('连接失败')
  
  // 错误信息
  const message = ref('')
  
  // 会话ID
  const sessionId = ref('')
  
  // 是否显示重试按钮
  const showRetry = ref(true)
  
  // 是否显示编辑按钮
  const showEdit = ref(true)

  /**
   * 显示错误对话框
   * @param errorTitle - 错误标题
   * @param errorMessage - 错误信息
   * @param errorSessionId - 会话ID
   * @param options - 其他选项
   */
  function showError(
    errorTitle: string,
    errorMessage: string,
    errorSessionId: string,
    options?: { showRetry?: boolean; showEdit?: boolean }
  ): void {
    title.value = errorTitle
    message.value = errorMessage
    sessionId.value = errorSessionId
    showRetry.value = options?.showRetry ?? true
    showEdit.value = options?.showEdit ?? true
    visible.value = true
  }

  /**
   * 关闭错误对话框
   */
  function closeError(): void {
    visible.value = false
    title.value = '连接失败'
    message.value = ''
    sessionId.value = ''
    showRetry.value = true
    showEdit.value = true
  }

  return {
    visible,
    title,
    message,
    sessionId,
    showRetry,
    showEdit,
    showError,
    closeError
  }
})
