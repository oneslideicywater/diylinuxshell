/**
 * 会话列表组件
 * 显示所有会话，支持分组显示
 * @module components/session/SessionList
 */

<template>
  <div class="session-list">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <span>加载中...</span>
    </div>

    <!-- 空状态 -->
    <div v-else-if="sessions.length === 0" class="empty-state">
      <p>暂无会话</p>
      <p class="hint">点击上方 + 按钮创建新会话</p>
    </div>

    <!-- 会话列表 -->
    <div v-else class="session-groups">
      <!-- 未分组会话 -->
      <div v-if="ungroupedSessions.length > 0" class="session-group">
        <SessionItem
          v-for="session in ungroupedSessions"
          :key="session.id"
          :session="session"
          :active="session.id === activeSessionId"
          @click="handleSelect(session)"
          @connect="handleConnect(session)"
          @disconnect="handleDisconnect(session)"
          @edit="handleEdit(session)"
          @delete="handleDelete(session)"
        />
      </div>

      <!-- 分组会话 -->
      <div v-for="group in sessionGroups" :key="group.id" class="session-group">
        <div class="group-header" @click="toggleGroup(group.id)">
          <svg
            class="expand-icon"
            :class="{ expanded: expandedGroups.has(group.id) }"
            width="12"
            height="12"
            viewBox="0 0 12 12"
          >
            <path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="2" fill="none" />
          </svg>
          <span class="group-name">{{ group.name }}</span>
          <span class="group-count">{{ getGroupSessionCount(group.id) }}</span>
        </div>
        <div v-show="expandedGroups.has(group.id)" class="group-sessions">
          <SessionItem
            v-for="session in getGroupSessions(group.id)"
            :key="session.id"
            :session="session"
            :active="session.id === activeSessionId"
            @click="handleSelect(session)"
            @connect="handleConnect(session)"
            @disconnect="handleDisconnect(session)"
            @edit="handleEdit(session)"
            @delete="handleDelete(session)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useTerminalStore } from '@/stores/terminal'
import SessionItem from './SessionItem.vue'
import type { Session, SessionGroup } from '@shared/types'

// 状态管理
const sessionStore = useSessionStore()
const terminalStore = useTerminalStore()

// 加载状态
const loading = ref(false)

// 展开的分组
const expandedGroups = ref<Set<string>>(new Set())

// 会话列表
const sessions = computed(() => sessionStore.sessions)

// 当前激活的会话
const activeSessionId = computed(() => sessionStore.activeSessionId)

// 会话分组列表
const sessionGroups = computed(() => {
  const groups: SessionGroup[] = []
  // TODO: 从 store 获取分组
  return groups
})

// 未分组的会话
const ungroupedSessions = computed(() => {
  return sessions.value.filter(s => !s.groupId)
})

// 定义事件
const emit = defineEmits<{
  (e: 'select', session: Session): void
  (e: 'edit', session: Session): void
}>()

/**
 * 切换分组展开状态
 */
const toggleGroup = (groupId: string) => {
  if (expandedGroups.value.has(groupId)) {
    expandedGroups.value.delete(groupId)
  } else {
    expandedGroups.value.add(groupId)
  }
}

/**
 * 获取分组会话数量
 */
const getGroupSessionCount = (groupId: string): number => {
  return sessions.value.filter(s => s.groupId === groupId).length
}

/**
 * 获取分组会话列表
 */
const getGroupSessions = (groupId: string): Session[] => {
  return sessions.value.filter(s => s.groupId === groupId)
}

/**
 * 选择会话
 */
const handleSelect = (session: Session) => {
  sessionStore.setActiveSession(session.id)
  emit('select', session)
}

/**
 * 连接会话
 */
const handleConnect = async (session: Session) => {
  try {
    // 创建标签页
    terminalStore.createTab(session.name, session.id)
    
    // 连接会话
    await window.api.session.connect(session.id)
    
    // 更新会话状态
    sessionStore.updateSessionStatus(session.id, 'connected')
  } catch (error) {
    console.error('Failed to connect:', error)
    sessionStore.updateSessionStatus(session.id, 'disconnected')
  }
}

/**
 * 断开会话
 */
const handleDisconnect = async (session: Session) => {
  try {
    await window.api.session.disconnect(session.id)
    sessionStore.updateSessionStatus(session.id, 'disconnected')
  } catch (error) {
    console.error('Failed to disconnect:', error)
  }
}

/**
 * 编辑会话
 */
const handleEdit = (session: Session) => {
  emit('edit', session)
}

/**
 * 删除会话
 */
const handleDelete = async (session: Session) => {
  if (confirm(`确定要删除会话 "${session.name}" 吗？`)) {
    await window.api.session.delete(session.id)
    sessionStore.removeSession(session.id)
  }
}

// 初始化加载会话列表
onMounted(async () => {
  loading.value = true
  try {
    const sessionList = await window.api.session.getAll()
    sessionStore.sessions = sessionList
  } catch (error) {
    console.error('Failed to load sessions:', error)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.session-list {
  flex: 1;
  overflow-y: auto;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: var(--text-secondary, #808080);
  font-size: 13px;
}

.empty-state .hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-tertiary, #606060);
}

.session-groups {
  padding: 4px 0;
}

.session-group {
  margin-bottom: 4px;
}

.group-header {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  color: var(--text-secondary, #808080);
  font-size: 12px;
  transition: background-color 0.15s;
}

.group-header:hover {
  background-color: var(--hover-bg, #2a2a2a);
}

.expand-icon {
  margin-right: 6px;
  transition: transform 0.15s;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.group-name {
  flex: 1;
}

.group-count {
  font-size: 11px;
  color: var(--text-tertiary, #606060);
}

.group-sessions {
  padding-left: 12px;
}
</style>
