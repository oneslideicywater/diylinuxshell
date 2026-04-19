/**
 * 分组树形选择器组件（递归组件）
 * 用于在表单中以树形结构显示和选择分组
 * @module components/session/GroupTreeSelect
 */

<template>
  <div class="group-tree-select">
    <!-- 分组列表 -->
    <template v-for="group in rootGroups" :key="group.id">
      <!-- 分组选项 -->
      <div
        class="tree-option"
        :class="{ active: modelValue === group.id }"
        @click="handleOptionClick(group)"
        :style="{ paddingLeft: (group.depth - 1) * 20 + 12 + 'px' }"
      >
        <!-- 展开/折叠图标 -->
        <svg
          v-if="hasSubGroups(group.id)"
          class="expand-icon"
          :class="{ expanded: isExpanded(group.id) }"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          @click.stop="handleToggle(group.id)"
        >
          <path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="2" fill="none" />
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="2" fill="currentColor" />
        </svg>

        <!-- 分组名称 -->
        <span class="group-name">{{ group.name }}</span>
      </div>

      <!-- 递归渲染子分组（紧跟在父分组下方） -->
      <GroupTreeSelect
        v-if="hasSubGroups(group.id) && isExpanded(group.id)"
        :parent-group-id="group.id"
        :all-groups="allGroups"
        :model-value="modelValue"
        :expanded-groups="expandedGroups"
        @update:model-value="$emit('update:modelValue', $event)"
        @toggle="handleToggle"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SessionGroup } from '@shared/types'

interface Props {
  parentGroupId?: string | null // 父分组 ID，用于递归
  allGroups: SessionGroup[] // 所有分组
  modelValue?: string // 当前选中的分组 ID
  expandedGroups?: Set<string> // 展开的分组 ID 集合
}

const props = withDefaults(defineProps<Props>(), {
  parentGroupId: null,
  modelValue: '',
  expandedGroups: () => new Set()
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'toggle', groupId: string): void
}>()

/**
 * 获取根分组或指定父分组的直接子分组（去重）
 */
const rootGroups = computed(() => {
  const allGroups = props.allGroups
  
  const result = props.parentGroupId
    ? allGroups
        .filter(g => g.parentId === props.parentGroupId)
        .sort((a, b) => a.order - b.order)
    : allGroups
        .filter(g => !g.parentId || g.parentId === '')
        .sort((a, b) => a.order - b.order)
  
  // 检查是否有重复的 ID
  const ids = result.map(g => g.id)
  const uniqueIds = new Set(ids)
  if (ids.length !== uniqueIds.size) {
    console.error('[GroupTreeSelect] rootGroups 包含重复的 ID:', ids.filter((id, index) => ids.indexOf(id) !== index))
  }
  
  // 使用 Map 去重，保留第一个出现的分组
  const uniqueMap = new Map<string, SessionGroup>()
  result.forEach(group => {
    if (!uniqueMap.has(group.id)) {
      uniqueMap.set(group.id, group)
    }
  })
  
  const uniqueResult = Array.from(uniqueMap.values())
  
  if (uniqueResult.length !== result.length) {
    console.warn(`[GroupTreeSelect] 检测到 ${result.length - uniqueResult.length} 个重复分组，已自动去重`)
  }
  
  return uniqueResult
})

/**
 * 检查分组是否有子分组
 */
const hasSubGroups = (groupId: string): boolean => {
  return props.allGroups.some(g => g.parentId === groupId)
}

/**
 * 检查分组是否已展开
 */
const isExpanded = (groupId: string): boolean => {
  return props.expandedGroups?.has(groupId) ?? false
}

/**
 * 处理选择
 */
const handleSelect = (groupId: string) => {
  emit('update:modelValue', groupId)
}

/**
 * 处理分组选项点击（选择 + 展开/折叠）
 */
const handleOptionClick = (group: SessionGroup) => {
  console.log('[GroupTreeSelect] handleOptionClick:', group.name, 'id:', group.id)
  
  // 先选择该分组
  handleSelect(group.id)
  
  // 如果有子分组，自动切换展开/折叠状态
  if (hasSubGroups(group.id)) {
    console.log('[GroupTreeSelect] 有子分组，切换展开状态')
    handleToggle(group.id)
  } else {
    console.log('[GroupTreeSelect] 没有子分组')
  }
}

/**
 * 处理展开/折叠
 */
const handleToggle = (groupId: string) => {
  console.log('[GroupTreeSelect] handleToggle:', groupId)
  emit('toggle', groupId)
}
</script>

<style scoped>
.group-tree-select {
  display: flex;
  flex-direction: column;
}

.tree-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  cursor: pointer;
  color: var(--text-primary, #e0e0e0);
  font-size: 13px;
  transition: background-color 0.15s;
  border-radius: 4px;
  margin: 2px 0;
}

.tree-option:hover {
  background-color: var(--hover-bg, #3a3a3a);
}

.tree-option.active {
  background-color: var(--primary-color, #0e639c);
  color: white;
}

.tree-option .expand-icon {
  flex-shrink: 0;
  transition: transform 0.15s;
  cursor: pointer;
  opacity: 0.7;
}

.tree-option .expand-icon:hover {
  opacity: 1;
}

.tree-option .expand-icon.expanded {
  transform: rotate(90deg);
}

.tree-option .group-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 浅色主题 */
[data-theme='light'] .tree-option {
  color: #333333;
}

[data-theme='light'] .tree-option:hover {
  background-color: #f5f5f5;
}

[data-theme='light'] .tree-option.active {
  background-color: var(--primary-color, #0e639c);
  color: white;
}
</style>
