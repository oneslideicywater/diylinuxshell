/**
 * SFTP 本地文件浏览器组件
 * 提供本地文件的浏览、导航、选择等功能
 * 
 * 重构说明（v2 - Pinia Store 架构）：
 * - 移除 props/emit 双向绑定，改用 Pinia Store 统一管理状态
 * - 所有状态（localPath, localFiles, localFileCount）存储在 useSftpBrowserStore 中
 * - 通过 connectionId 隔离不同 SFTP 连接的状态
 * - 解决了 v-model:value 反模式和双重状态管理问题
 * @module components/session/SftpLocal
 */

<template>
  <div
    ref="panelRef"
    class="file-panel local"
  >
    <div class="panel-header">
      <div class="panel-path">
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
        >
          <path
            d="M1 11V4l3-3h9v10H1z"
            stroke="currentColor"
            stroke-width="1.5"
          />
        </svg>
        <input
          v-model="localPathValue"
          type="text"
          class="path-input"
          @keyup.enter="handlePathEnter"
        >
      </div>
      <button
        class="nav-btn"
        title="上级目录"
        @click="handleUp"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
        >
          <path
            d="M11 7H3M3 7l4-4M3 7l4 4"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
    <div
      class="file-list"
      @dblclick="handleDblClick"
      @contextmenu.prevent="handleContextMenu"
    >
      <!-- 骨架屏：本地目录加载中显示 -->
      <FileListSkeleton
        v-if="isLoadingLocal"
        :rows="10"
      />
      <div
        v-for="item in localFiles"
        :key="item.path"
        :data-path="item.path"
        :data-is-directory="item.isDirectory"
        :data-is-symlink="item.isSymbolicLink"
        class="file-item"
        :class="{ selected: selectedLocals.includes(item.path) }"
        :title="item.isSymbolicLink ? `符号链接 → ${item.linkTarget || '未知'}` : item.path"
        @click="handleClick(item.path, $event)"
      >
        <div class="file-icon-wrapper">
          <!-- 符号链接文件夹图标 -->
          <svg
            v-if="item.isDirectory && item.isSymbolicLink"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            class="file-icon is-folder is-symlink"
          >
            <path
              d="M14 13.5C14 14.3284 13.3284 15 12.5 15H3.5C2.67157 15 2 14.3284 2 13.5V5.5C2 4.67157 2.67157 4 3.5 4H6.5L7.5 5H12.5C13.3284 5 14 5.67157 14 6.5V13.5Z"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <!-- 符号链接链条标识 -->
            <path
              d="M11 9.5L9.5 11M9.5 11L11 12.5M9.5 11H7.5V9.5"
              stroke="currentColor"
              stroke-width="1"
              stroke-linecap="round"
              stroke-linejoin="round"
              opacity="0.8"
            />
          </svg>
          <!-- 符号链接文件图标 -->
          <svg
            v-else-if="item.isSymbolicLink"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            class="file-icon is-symlink"
          >
            <path
              d="M9 1H4C2.89543 1 2 1.89543 2 3V13C2 14.1046 2.89543 15 4 15H12C13.1046 15 14 14.1046 14 13V6L9 1Z"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M9 1V6H14"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <!-- 符号链接链条标识 -->
            <path
              d="M11 9.5L9.5 11M9.5 11L11 12.5M9.5 11H7.5V9.5"
              stroke="currentColor"
              stroke-width="1"
              stroke-linecap="round"
              stroke-linejoin="round"
              opacity="0.8"
            />
          </svg>
          <!-- 普通文件夹图标 -->
          <svg
            v-else-if="item.isDirectory"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            class="file-icon is-folder"
          >
            <path
              d="M14 13.5C14 14.3284 13.3284 15 12.5 15H3.5C2.67157 15 2 14.3284 2 13.5V5.5C2 4.67157 2.67157 4 3.5 4H6.5L7.5 5H12.5C13.3284 5 14 5.67157 14 6.5V13.5Z"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
          <!-- 普通文件图标 -->
          <svg
            v-else
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            class="file-icon"
          >
            <path
              d="M9 1H4C2.89543 1 2 1.89543 2 3V13C2 14.1046 2.89543 15 4 15H12C13.1046 15 14 14.1046 14 13V6L9 1Z"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M9 1V6H14"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
        </div>
        <span class="file-name">{{ item.name }}</span>
        <span class="file-size">{{ formatSize(item.size) }}</span>
      </div>
    </div>
    
    <!-- 本地文件右键菜单（通过 Store 管理全局唯一性） -->
    <!-- 新建文件夹对话框 -->
    <div
      v-if="createFolderDialogVisible"
      class="dialog-overlay"
      @click.self="closeCreateFolderDialog"
    >
      <div class="dialog">
        <div class="dialog-header">
          <h3 class="dialog-title">
            新建文件夹
          </h3>
        </div>
        <div class="dialog-body">
          <div class="form-item">
            <label class="form-label">文件夹名称</label>
            <input
              ref="folderNameInput"
              v-model="folderName"
              type="text"
              class="form-input"
              :class="{ 'is-invalid': folderNameError }"
              placeholder="请输入文件夹名称"
              @keyup.enter="confirmCreateFolder"
              @keyup.esc="closeCreateFolderDialog"
            >
            <div
              v-if="folderNameError"
              class="form-error"
            >
              {{ folderNameError }}
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button
            class="btn btn-secondary"
            @click="closeCreateFolderDialog"
          >
            取消
          </button>
          <button
            class="btn btn-primary"
            :disabled="!folderName || !!folderNameError"
            @click="confirmCreateFolder"
          >
            确定
          </button>
        </div>
      </div>
    </div>

    <!-- 统一提示对话框（替代 alert） -->
    <AlertDialog
      :visible="alertDialogVisible"
      :title="alertDialogConfig.title"
      :message="alertDialogConfig.message"
      :is-error="alertDialogConfig.isError"
      @confirm="handleAlertDialogClose"
      @close="handleAlertDialogClose"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed, watch } from 'vue'
import type { TransferTask } from '@shared/types/sftp'

import { formatSize } from '@/utils/fs-utils'
import { useContextMenuStore } from '@/stores/contextMenu'
import { useSftpSelectionStore } from '@/stores/sftpSelection'
import { useSftpBrowserStore } from '@/stores/sftpBrowser'
import { DRIVES_PATH } from './script/local'
import AlertDialog from '@/components/common/AlertDialog.vue'
import FileListSkeleton from '@/components/common/FileListSkeleton.vue'

/**
 * Props 定义（v2 简化版）
 * 
 * 改进说明：
 * - 移除 localPath/localFiles props（不再需要 v-model 双向绑定）
 * - 只保留必要的标识符：connectionId + uploadTasks
 * - 所有状态通过 useSftpBrowserStore 按 connectionId 获取
 */
interface Props {
  /** 上传任务列表 */
  uploadTasks?: TransferTask[]
  /** SFTP 连接标识符（用于 Store 隔离） */
  connectionId?: string
}

const props = withDefaults(defineProps<Props>(), {
  uploadTasks: () => [],
  connectionId: ''
})

/**
 * Emits 定义（v2 简化版）
 * 
 * 只保留事件通知，不再需要状态同步的 emit
 */
const emit = defineEmits<{
  /** 本地文件双击事件 */
  'local-dblclick': []
  /**
   * 上传事件（统一接口：支持单文件/单文件夹/多文件混合选择）
   */
  'upload-batch': [paths: string[]]
  /**
   * 删除本地文件事件（统一接口：支持单文件/多文件批量删除）
   */
  'delete-batch': [paths: string[]]
}>()

/**
 * ====================
 * Store 实例（核心改进）
 * ====================
 */

/**
 * SFTP 文件浏览器状态 Store（按连接 ID 隔离，同时管理 Local 和 Remote）
 * 替代原来的 createLocalFileState() + 内部 ref 副本
 */
const sftpBrowserStore = useSftpBrowserStore()

/**
 * SFTP 选择状态 Store（按连接 ID 隔离）
 * 统一管理选中文件列表（单文件/多文件共用）
 */
const sftpSelectionStore = useSftpSelectionStore()

/**
 * 当前连接的本地路径（从 Store 直接读取，响应式）
 * 直接访问 state 避免嵌套 computed 导致的响应式失效问题
 */
const localPath = computed(() => {
  const state = sftpBrowserStore.getState(props.connectionId)
  return state?.local?.localPath || ''
})

/**
 * 本地路径输入框的双向绑定值
 * 
 * 性能优化：
 * - 使用本地 ref 立即响应用户输入（无卡顿）
 * - 防抖 300ms 后同步到 Store（避免频繁触发响应式更新）
 * - 解决 :model-value 非受控组件不更新显示的问题
 */
const localPathInput = ref('')
let localPathTimer: ReturnType<typeof setTimeout> | null = null

const localPathValue = computed<string>({
  get: () => localPathInput.value,
  set: (value: string) => {
    localPathInput.value = value
    
    if (localPathTimer) {
      clearTimeout(localPathTimer)
    }
    
    localPathTimer = setTimeout(() => {
      if (props.connectionId) {
        sftpBrowserStore.setLocalPath(props.connectionId, value)
      }
      localPathTimer = null
    }, 300)
  }
})

watch(() => props.connectionId, (newId) => {
  if (newId) {
    const state = sftpBrowserStore.getState(newId)
    localPathInput.value = state?.local?.localPath || ''
  }
}, { immediate: true })

watch(() => {
  const state = sftpBrowserStore.getState(props.connectionId)
  return state?.local?.localPath || ''
}, (newPath) => {
  if (!localPathTimer) {
    localPathInput.value = newPath
  }
})

/**
 * 当前连接的本地文件列表（从 Store 直接读取，响应式）
 * 直接访问 state 避免嵌套 computed 导致的响应式失效问题
 */
const localFiles = computed(() => {
  const state = sftpBrowserStore.getState(props.connectionId)
  return state?.local?.localFiles || []
})

/**
 * 本地目录加载中状态（用于控制骨架屏显示/隐藏）
 * 
 * 触发时机：
 *   - 显示：用户双击进入子目录 / 点击上级 / 路径回车导航
 *   - 隐藏：getDrives/getLocalFiles API 返回结果（无论成功或失败）
 */
const isLoadingLocal = computed(() => {
  const state = sftpBrowserStore.getState(props.connectionId)
  return state?.local?.isLoadingLocal ?? false
})

/**
 * 当前连接的选中文件列表（从 SelectionStore 读取）
 * - 单文件操作时：数组长度 = 1
 * - 多文件操作时：数组长度 > 1
 * - 未选中时：空数组
 */
const selectedLocals = computed<string[]>({
  get: () => sftpSelectionStore.getSelectedFiles(props.connectionId),
  set: (value) => sftpSelectionStore.setSelectedFiles(props.connectionId, value)
})

/**
 * 右键菜单状态
 */
/* 右键菜单 Store（全局唯一管理） */
const contextMenuStore = useContextMenuStore()
const menuOwnerId = 'sftp-local'

/**
 * 创建文件夹对话框状态
 */
const createFolderDialogVisible = ref(false)
const folderName = ref('')
const folderNameError = ref('')
const folderNameInput = ref<HTMLInputElement | null>(null)

/** 统一提示对话框状态（替代 alert） */
const alertDialogVisible = ref(false)
const alertDialogConfig = ref({ title: '提示', message: '', isError: false })

function showAlert(message: string, title = '提示', isError = false): void {
  alertDialogConfig.value = { title, message, isError }
  alertDialogVisible.value = true
}

function handleAlertDialogClose(): void {
  alertDialogVisible.value = false
}

/**
 * 加载本地文件列表（委托给 Store）
 */
async function loadFiles(): Promise<void> {
  await sftpBrowserStore.loadLocalFiles(props.connectionId, DRIVES_PATH)
}

/**
 * 处理路径输入回车 — 使用输入框的值导航到目标目录
 * （修复：之前使用 DRIVES_PATH 常量，忽略了用户输入的实际路径）
 */
async function handlePathEnter(): Promise<void> {
  const targetPath = localPathInput.value.trim()
  if (!targetPath || !props.connectionId) return

  // 立即同步设置路径（跳过 debounce 延迟），然后加载文件
  sftpBrowserStore.setLocalPath(props.connectionId, targetPath)
  await sftpBrowserStore.loadLocalFiles(props.connectionId, DRIVES_PATH)
}

/**
 * 处理上级目录点击（委托给 Store，Store 内部智能判断平台）
 */
async function handleUp(): Promise<void> {
  if (!props.connectionId) return
  
  await sftpBrowserStore.navigateLocalUp(props.connectionId, DRIVES_PATH)
}

/**
 * 处理文件点击（支持 Ctrl/Cmd/Shift 多选）
 * 统一使用 selectedLocals 数组（单文件长度=1，多文件长度>1）
 */
function handleClick(path: string, event?: MouseEvent): void {
  if (event && (event.ctrlKey || event.metaKey)) {
    // Ctrl/Cmd 点击：切换选中状态（使用 Store 方法）
    sftpSelectionStore.toggleFileSelection(props.connectionId, path)
  } else if (event && event.shiftKey) {
    // Shift 点击：范围选择（使用 Store 方法）
    sftpSelectionStore.rangeSelect(
      props.connectionId,
      path,
      localFiles.value,
      (item: any) => item.path
    )
  } else {
    // 普通点击：清空多选，单选当前项
    sftpSelectionStore.setSelectedFiles(props.connectionId, [path])
  }
}

/**
 * 处理文件双击（委托给 Store）
 */
async function handleDblClick(event: MouseEvent): Promise<void> {
  if (!props.connectionId) return
  await sftpBrowserStore.handleLocalDblClick(props.connectionId, event, DRIVES_PATH)
  emit('local-dblclick')
}

/**
 * 处理右键菜单
 * 通过全局 Store 管理菜单状态，确保全局唯一性
 * 菜单左上角 = 鼠标右击位置
 */
function handleContextMenu(event: MouseEvent): void {
  const target = event.target as HTMLElement
  const fileItem = target.closest('.file-item') as HTMLElement

  let clickedFile: any = null

  if (fileItem) {
    const path = fileItem.dataset.path
    const file = localFiles.value.find(f => f.path === path)
    if (!file) return
    
    clickedFile = file
    
    const currentSelection = sftpSelectionStore.getSelectedFiles(props.connectionId)
    const isAlreadySelected = currentSelection.includes(file.path)
    
    if (currentSelection.length === 0 || !isAlreadySelected) {
      sftpSelectionStore.setSelectedFiles(props.connectionId, [file.path])
    }
  }

  const x = event.clientX
  const y = event.clientY

  const menuItems = [
    { action: 'createFolder', title: '新建文件夹', icon: 'create-folder', description: '在当前本地目录创建新文件夹' },
    { action: 'refresh', title: '刷新', icon: 'refresh', description: '重新加载当前浏览目录' },
    {
      action: 'upload',
      title: '上传',
      icon: 'upload',
      description: selectedLocals.value.length > 1 
        ? `上传选中的 ${selectedLocals.value.length} 个文件/文件夹到远程目录`
        : '将选中的本地文件/文件夹上传到远程目录',
      visible: !!clickedFile || selectedLocals.value.length > 1
    },
    {
      action: 'deleteLocal',
      title: '删除',
      icon: 'delete',
      description: '删除选中的本地文件或文件夹',
      visible: !!clickedFile
    }
  ]

  /**
 * 获取当前选中的路径列表（优先使用多选，否则使用点击的文件）
 */
function getSelectedOrClickedPath(clickedFile: any): string[] {
  return selectedLocals.value.length > 0 
    ? [...selectedLocals.value] 
    : (clickedFile ? [clickedFile.path] : [])
}

contextMenuStore.showContextMenu(menuOwnerId, { x, y }, menuItems, (action: string) => {
    switch (action) {
      case 'createFolder':
        showCreateFolderDialog()
        break
      case 'refresh':
        handleRefresh()
        break
      case 'upload':
        emit('upload-batch', getSelectedOrClickedPath(clickedFile))
        break
      case 'deleteLocal':
        emit('delete-batch', getSelectedOrClickedPath(clickedFile))
        break
    }
  })
}

/**
 * 处理刷新操作：重新加载当前浏览目录的文件列表
 */
async function handleRefresh(): Promise<void> {
  console.log('[SftpLocal] 刷新本地目录:', localPath.value)
  
  try {
    await loadFiles()
    console.log('[SftpLocal] ✅ 本地目录刷新成功')
  } catch (error: any) {
    console.error('[SftpLocal] ❌ 刷新本地目录失败:', error)
    showAlert(error.message || '刷新失败', '错误', true)
  }
}

/**
 * 显示创建文件夹对话框
 */
function showCreateFolderDialog(): void {
  folderName.value = '新建文件夹'
  folderNameError.value = ''
  createFolderDialogVisible.value = true
  nextTick(() => {
    if (folderNameInput.value) {
      folderNameInput.value.focus()
      folderNameInput.value.select()
    }
  })
}

/**
 * 关闭创建文件夹对话框
 */
function closeCreateFolderDialog(): void {
  createFolderDialogVisible.value = false
  folderName.value = ''
  folderNameError.value = ''
}

/**
 * 验证文件夹名称
 */
function validateFolderName(name: string): string | null {
  if (!name || name.trim() === '') {
    return '文件夹名称不能为空'
  }
  
  // 检查非法字符
  const illegalChars = /[\\/:*?"<>|]/
  if (illegalChars.test(name)) {
    return '文件夹名称不能包含以下字符：\\ / : * ? " < > |'
  }
  
  // 检查是否包含 ..
  if (name.includes('..')) {
    return '文件夹名称不能包含 ".."'
  }
  
  // 检查重名
  const exists = localFiles.value.some(f => f.name === name && f.isDirectory)
  if (exists) {
    return '该名称的文件夹已存在'
  }
  
  return null
}

/**
 * 确认创建文件夹（委托给 Store）
 */
async function confirmCreateFolder(): Promise<void> {
  const error = validateFolderName(folderName.value)
  if (error) {
    folderNameError.value = error
    return
  }

  try {
    if (!props.connectionId) {
      throw new Error('connectionId 不存在')
    }
    
    await sftpBrowserStore.createLocalFolder(props.connectionId, folderName.value.trim(), DRIVES_PATH)
    
    console.log('[SftpLocal] ✅ 本地文件夹创建成功')
    
    closeCreateFolderDialog()
  } catch (error: any) {
    console.error('[SftpLocal] ❌ 创建本地文件夹失败:', error)
    folderNameError.value = error.message || '创建文件夹失败，请重试'
  }
}

// 导出函数供父组件调用
defineExpose({
  loadFiles,
  /** 获取当前所有选中的文件/文件夹路径（用于批量操作） */
  getSelectedFiles: () => [...selectedLocals.value]
})

// 注意：初始化加载由父组件调用 loadFiles 触发
</script>

<style scoped>
.file-panel.local {
  display: flex;
  flex-direction: column;
  background: var(--bg-color, #ffffff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--sidebar-bg, var(--bg-color-secondary, #f3f3f3));
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.panel-path {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--input-bg, var(--bg-color, #ffffff));
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 3px;
}

.panel-path .path-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 13px;
  line-height: 20px;
  height: 20px;
  min-width: 0;
  background: transparent;
  color: var(--text-color, #333333);
}

.nav-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color, #ffffff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-color-secondary, #999999);
}

.nav-btn:hover {
  background: var(--hover-bg, #f0f0f0);
  border-color: var(--border-color, #d0d0d0);
  color: var(--text-color, #333333);
}

.nav-btn:active {
  background: var(--hover-bg, #e8e8e8);
}

.file-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.15s;
}

.file-item:hover {
  background: var(--hover-bg, rgba(255, 255, 255, 0.05));
}

.file-item.selected {
  background: var(--active-bg, rgba(64, 158, 255, 0.15));
}

.file-icon-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.file-icon {
  flex-shrink: 0;
  color: var(--primary-color, #409eff);
}

.file-icon.is-folder {
  color: var(--warning-color, #e6a23c);
}

.file-icon.is-symlink {
  color: var(--primary-color, #409eff);
}

.file-icon.is-folder.is-symlink {
  color: var(--warning-color, #e6a23c);
}

.file-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-color, #333333);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-color-secondary, #999999);
}

/* 对话框样式 */
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
  z-index: 10001;
}

.dialog {
  background: var(--bg-color, #ffffff);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  min-width: 400px;
  max-width: 500px;
  overflow: hidden;
}

.dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color, #333333);
}

.dialog-body {
  padding: 20px;
}

.form-item {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color, #333333);
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-color, #333333);
  background: var(--bg-color, #ffffff);
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-color, #409eff);
}

.form-input.is-invalid {
  border-color: var(--error-color, #f56c6c);
}

.form-error {
  margin-top: 4px;
  font-size: 12px;
  color: var(--error-color, #f56c6c);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color, #e0e0e0);
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: var(--bg-color-secondary, #f5f5f5);
  border: 1px solid var(--border-color, #e0e0e0);
  color: var(--text-color, #333333);
}

.btn-secondary:hover {
  background: var(--hover-bg, #e8e8e8);
}

.btn-primary {
  background: var(--primary-color, #409eff);
  color: #ffffff;
}

.btn-primary:hover {
  background: var(--primary-color-hover, #66b1ff);
}

.btn-primary:disabled {
  background: var(--primary-color-disabled, #a0cfff);
  cursor: not-allowed;
}
</style>
