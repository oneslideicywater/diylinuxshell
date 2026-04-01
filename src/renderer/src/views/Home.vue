<template>
  <AppLayout @add-session="showSessionForm = true" @edit-session="handleEditSession" @open-settings="handleOpenSettings" />
  
  <!-- 会话表单对话框 -->
  <SessionForm
    v-if="showSessionForm"
    :session="editingSession"
    @close="handleCloseSessionForm"
    @save="handleSaveSession"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import AppLayout from '@/components/layout/AppLayout.vue'
import SessionForm from '@/components/session/SessionForm.vue'
import type { Session } from '@shared/types'

const router = useRouter()
const sessionStore = useSessionStore()

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
      const updated = await window.api.session.update(editingSession.value.id, data)
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
</script>

<style scoped>
/* 使用 AppLayout 的样式 */
</style>
