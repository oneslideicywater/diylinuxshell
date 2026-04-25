<template>
  <AppLayout
    @add-session="handleAddSession"
    @edit-session="handleEditSession"
    @open-settings="handleOpenSettings"
  />
  
  <!-- 会话表单对话框 -->
  <SessionForm
    :visible="showSessionForm"
    :session="editingSession"
    :default-group-id="defaultGroupId"
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

// 默认分组 ID（新增会话时使用）
const defaultGroupId = ref<string | undefined>(undefined)

// 正在编辑的会话
const editingSession = ref<Session | undefined>(undefined)

/**
 * 添加新会话
 */
const handleAddSession = (groupId?: string) => {
  defaultGroupId.value = groupId
  showSessionForm.value = true
}

/**
 * 编辑会话
 */
const handleEditSession = async (session: Session | undefined) => {
  console.log('[Home] handleEditSession 被调用, session:', session?.name, 'id:', session?.id)
  
  if (!session) {
    console.error('[Home] handleEditSession 收到空 session!')
    return
  }
  
  // 重新从后端获取会话，确保密码是解密后的
  let freshSession: Session | undefined
  try {
    freshSession = await window.api.session.getById(session.id)
  } catch (e) {
    console.warn('[Home] getById 失败, 使用原始 session:', e)
  }
  
  if (freshSession) {
    editingSession.value = freshSession
  } else {
    editingSession.value = session
  }
  showSessionForm.value = true
  console.log('[Home] showSessionForm 设置为 true')
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
const handleRetryFromError = async (sessionId: string): Promise<void> => {
  // 重新从后端获取会话，确保密码是解密后的
  const freshSession = await window.api.session.getById(sessionId)
  if (freshSession) {
    handleEditSession(freshSession)
  }
}

/**
 * 从错误对话框中编辑会话
 */
const handleEditFromError = async (sessionId: string): Promise<void> => {
  // 重新从后端获取会话，确保密码是解密后的
  const freshSession = await window.api.session.getById(sessionId)
  if (freshSession) {
    handleEditSession(freshSession)
  }
}
</script>

<style scoped>
/* 使用 AppLayout 的样式 */
</style>
