<template>
  <AppLayout @add-session="showSessionForm = true" @edit-session="handleEditSession" @open-settings="handleOpenSettings" />
  
  <!-- 会话表单对话框 -->
  <SessionForm
    v-if="showSessionForm"
    :session="editingSession"
    @close="handleCloseSessionForm"
    @save="handleSaveSession"
  />
  
  <!-- 全局错误对话框 -->
  <ErrorDialog
    @close="handleCloseErrorDialog"
    @retry="handleRetryFromError"
    @edit="handleEditFromError"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useErrorDialogStore } from '@/stores/errorDialog'
import AppLayout from '@/components/layout/AppLayout.vue'
import SessionForm from '@/components/session/SessionForm.vue'
import ErrorDialog from '@/components/common/ErrorDialog.vue'
import type { Session } from '@shared/types'

const router = useRouter()
const sessionStore = useSessionStore()
const errorDialogStore = useErrorDialogStore()

// 会话表单显示状态
const showSessionForm = ref(false)

// 正在编辑的会话
const editingSession = ref<Session | undefined>(undefined)

/**
 * 编辑会话
 */
const handleEditSession = (session: Session) => {
  editingSession.value = session
  showSessionForm.value = true
}

/**
 * 打开设置页面
 */
const handleOpenSettings = () => {
  router.push('/settings')
}

/**
 * 关闭会话表单
 */
const handleCloseSessionForm = () => {
  showSessionForm.value = false
  editingSession.value = undefined
}

/**
 * 保存会话
 */
const handleSaveSession = async (data: Partial<Session>) => {
  try {
    if (editingSession.value) {
      // 更新会话
      // 如果是编辑模式且密码为空，则不更新密码字段（保持原密码）
      const updateData = { ...data }
      if (!data.password && editingSession.value.authType === 'password') {
        delete updateData.password
      }
      const updated = await window.api.session.update(editingSession.value.id, updateData)
      if (updated) {
        sessionStore.updateSession(updated.id, updated)
      }
    } else {
      // 创建会话
      const session = await window.api.session.create(data as Omit<Session, 'id' | 'createdAt' | 'updatedAt'>)
      sessionStore.addSession(session)
    }
    handleCloseSessionForm()
  } catch (error) {
    console.error('Failed to save session:', error)
  }
}

/**
 * 关闭错误对话框
 */
const handleCloseErrorDialog = (): void => {
  errorDialogStore.closeError()
}

/**
 * 从错误对话框中重试连接
 */
const handleRetryFromError = (sessionId: string): void => {
  // 找到对应的会话并打开编辑表单
  const session = sessionStore.sessions.find(s => s.id === sessionId)
  if (session) {
    handleEditSession(session)
  }
}

/**
 * 从错误对话框中编辑会话
 */
const handleEditFromError = (sessionId: string): void => {
  // 找到对应的会话并打开编辑表单
  const session = sessionStore.sessions.find(s => s.id === sessionId)
  if (session) {
    handleEditSession(session)
  }
}
</script>

<style scoped>
/* 使用 AppLayout 的样式 */
</style>
