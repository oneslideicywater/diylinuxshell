/**
 * 侧边栏组件
 * 显示会话列表和快捷操作
 * @module components/layout/Sidebar
 */

<template>
  <div class="sidebar">
    <!-- 会话列表区域 -->
    <div class="sidebar-section">
      <div class="section-header">
        <span class="section-title">会话列表</span>
        <button class="add-btn" @click="handleAddSession" title="新建会话">
          <!-- + 图标 -->
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
      </div>
      <SessionList @select="handleSelectSession" @edit="handleEditSession" @add-session="handleAddSession" />
    </div>

    <!-- 快捷命令区域 -->
    <div class="sidebar-section">
      <div class="section-header">
        <span class="section-title">快捷命令</span>
        <button class="add-btn" @click="handleAddCommand" title="新建命令">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
      </div>
      <div class="command-list">
        <div class="empty-hint">暂无快捷命令</div>
      </div>
    </div>

    <!-- 底部设置按钮 -->
    <div class="sidebar-footer">
      <button class="settings-btn" @click="handleOpenSettings" title="设置">

        <!-- 齿轮图标 -->
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path
            d="M8 10a2 2 0 100-4 2 2 0 000 4z"
            stroke="currentColor"
            stroke-width="1.5"
            fill="none"
          />
          <path
            d="M14.5 8.5v-1l-1.5-.5-.3-.7.8-1.4-.7-.7-1.4.8-.7-.3-.5-1.5h-1l-.5 1.5-.7.3-1.4-.8-.7.7.8 1.4-.3.7-1.5.5v1l1.5.5.3.7-.8 1.4.7.7 1.4-.8.7.3.5 1.5h1l.5-1.5.7-.3 1.4.8.7-.7-.8-1.4.3-.7 1.5-.5z"
            stroke="currentColor"
            stroke-width="1"
            fill="none"
          />
        </svg>
        <span>设置</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import SessionList from '@/components/session/SessionList.vue'
import type { Session } from '@shared/types'

const router = useRouter()

// 定义事件
const emit = defineEmits<{
  (e: 'add-session'): void
  (e: 'edit-session', session: Session): void
  (e: 'open-settings'): void
}>()

/**
 * 添加新会话
 */
const handleAddSession = () => {
  emit('add-session')
}

/**
 * 选择会话
 */
const handleSelectSession = (_session: Session) => {
  // 由父组件处理
}

/**
 * 编辑会话
 */
const handleEditSession = (session: Session) => {
  emit('edit-session', session)
}

/**
 * 添加快捷命令
 */
const handleAddCommand = () => {
  // TODO: 实现添加命令功能
  console.log('Add command')
}

/**
 * 打开设置
 */
const handleOpenSettings = () => {
  emit('open-settings')
  router.push('/settings')
}
</script>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sidebar-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #3c3c3c);
}

.section-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #808080);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #808080);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}

.add-btn:hover {
  background-color: var(--hover-bg, #3c3c3c);
  color: var(--text-color, #cccccc);
}

.command-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.empty-hint {
  padding: 12px;
  font-size: 12px;
  color: var(--text-secondary, #808080);
  text-align: center;
}

.sidebar-footer {
  padding: 8px;
  border-top: 1px solid var(--border-color, #3c3c3c);
}

.settings-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #808080);
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  transition: all 0.15s;
}

.settings-btn:hover {
  background-color: var(--hover-bg, #3c3c3c);
  color: var(--text-color, #cccccc);
}
</style>
