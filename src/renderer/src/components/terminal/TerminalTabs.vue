/**
 * 标签页栏组件
 * 显示所有打开的终端标签页
 * @module components/terminal/TerminalTabs
 */

<template>
  <div class="terminal-tabs">
    <!-- 标签页列表 -->
    <div class="tabs-container">
      <TerminalTab
        v-for="tab in tabs"
        :key="tab.id"
        :tab="tab"
        :active="tab.id === activeTabId"
        @click="handleSelectTab(tab.id)"
        @close="handleCloseTab(tab.id)"
      />
    </div>

    <!-- 新建标签按钮（+号按钮） -->
    <!-- 点击后打开会话列表，用户可以选择一个会话创建新的终端标签页 -->
    <button class="new-tab-btn" title="新建标签" @click="handleNewTab">
      <!-- SVG 图标：一个加号（+），由一条横线和一条竖线组成 -->
      <svg width="14" height="14" viewBox="0 0 14 14">
        <!-- 横线：M7 1v12 表示从中心点(7,1)画一条到(7,13)的竖线 -->
        <!-- 竖线：M1 7h12 表示从点(1,7)画一条到(13,7)的横线 -->
        <!-- 两条线交叉形成 + 号 -->
        <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTerminalStore } from '@/stores/terminal'
import { useSessionStore } from '@/stores/session'
import TerminalTab from './TerminalTab.vue'

// 状态管理
const terminalStore = useTerminalStore()
const sessionStore = useSessionStore()

// 定义事件
const emit = defineEmits<{
  (e: 'new-tab'): void
}>()

// 标签页列表
const tabs = computed(() => terminalStore.tabs)

// 当前激活的标签页
const activeTabId = computed(() => terminalStore.activeTabId)

/**
 * 选择标签页
 */
const handleSelectTab = (tabId: string) => {
  terminalStore.setActiveTab(tabId)
}

/**
 * 关闭标签页
 */
const handleCloseTab = async (tabId: string) => {
  const tab = terminalStore.getTabById(tabId)
  if (tab) {
    // 断开该标签页的连接
    await window.api.session.disconnect(tabId)
  }
  terminalStore.closeTab(tabId)
}

/**
 * 新建标签页
 * 修复 BUG-009: 点击+按钮触发新建会话流程
 */
const handleNewTab = () => {
  // 触发新建会话事件，让父组件处理
  emit('new-tab')
}
</script>

<style scoped>
.terminal-tabs {
  display: flex;
  align-items: center;
  height: 36px;
  padding-right: 8px;
}

.tabs-container {
  display: flex;
  align-items: center;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
}

.tabs-container::-webkit-scrollbar {
  height: 3px;
}

.tabs-container::-webkit-scrollbar-thumb {
  background-color: var(--scrollbar-thumb, #424242);
  border-radius: 3px;
}

.new-tab-btn {
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
  flex-shrink: 0;
}

.new-tab-btn:hover {
  background-color: var(--hover-bg, #3c3c3c);
  color: var(--text-color, #cccccc);
}
</style>
