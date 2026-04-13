/**
 * SFTP 本地文件浏览器组件
 * 提供本地文件的浏览、导航、选择等功能
 * @module components/session/SftpLocal
 */

<template>
  <div class="file-panel local">
    <div class="panel-header">
      <div class="panel-path">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 11V4l3-3h9v10H1z" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        <input
          v-model="localPath"
          type="text"
          class="path-input"
          @keyup.enter="handlePathEnter"
        />
      </div>
      <button class="nav-btn" @click="handleUp" title="上级目录">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M11 7H3M3 7l4-4M3 7l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    <div
      class="file-list"
      @dblclick="handleDblClick"
      @contextmenu.prevent="handleContextMenu"
    >
      <div
        v-for="item in localFiles"
        :key="item.path"
        :data-path="item.path"
        :data-is-directory="item.isDirectory"
        class="file-item"
        :class="{ selected: selectedLocal === item.path }"
        @click="handleClick(item.path, $event)"
      >
        <svg v-if="item.isDirectory" width="16" height="16" viewBox="0 0 16 16" fill="none" class="file-icon">
          <path d="M14 12a2 2 0 002-2V6a2 2 0 00-2-2h-4l-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h10z" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none" class="file-icon">
          <path d="M13 12a2 2 0 002-2V6l-4-4H5a2 2 0 00-2 2v12a2 2 0 002 2h8z" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        <span class="file-name">{{ item.name }}</span>
        <span class="file-size">{{ formatSize(item.size) }}</span>
      </div>
    </div>
    
    <!-- 本地文件右键菜单 -->
    <div v-if="contextMenuVisible" class="context-menu file-context-menu" :style="contextMenuStyle">
      <div class="context-menu-item" @click="handleMenuAction('createFolder')">
        <span class="menu-item-title">新建文件夹</span>
        <span class="menu-item-description">在当前本地目录创建新文件夹</span>
      </div>
      <div class="context-menu-item" @click="handleMenuAction('upload')" v-if="selectedFile || hasMultipleSelection">
        <span class="menu-item-title">上传</span>
        <span class="menu-item-description">将选中的本地文件/文件夹上传到远程目录</span>
      </div>
      <div class="context-menu-item" @click="handleMenuAction('deleteLocal')">
        <span class="menu-item-title">删除</span>
        <span class="menu-item-description">删除选中的本地文件或文件夹</span>
      </div>
    </div>
    
    <!-- 新建文件夹对话框 -->
    <div v-if="createFolderDialogVisible" class="dialog-overlay" @click.self="closeCreateFolderDialog">
      <div class="dialog">
        <div class="dialog-header">
          <h3 class="dialog-title">新建文件夹</h3>
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
            />
            <div v-if="folderNameError" class="form-error">{{ folderNameError }}</div>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-secondary" @click="closeCreateFolderDialog">取消</button>
          <button class="btn btn-primary" @click="confirmCreateFolder" :disabled="!folderName || !!folderNameError">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue'
import type { TransferTask } from '@shared/types/sftp'

import { formatSize } from '@/utils/fs-utils'
import { requestContextMenu, clearContextMenuOwner } from './script/globalState'
import { loadLocalFiles, handleLocalDblClick, localUp, type LocalFileState } from './script/local'

/**
 * Props 定义
 */
interface Props {
  /** 当前本地路径 */
  localPath: string
  /** 本地文件列表 */
  localFiles: any[]
  /** 选中的本地文件路径 */
  selectedLocal: string
  /** 上传任务列表 */
  uploadTasks?: TransferTask[]
}

const props = withDefaults(defineProps<Props>(), {
  uploadTasks: () => []
})

/**
 * Emits 定义
 */
const emit = defineEmits<{
  /** 路径变化事件 */
  'update:localPath': [value: string]
  /** 选中文件变化事件 */
  'update:selectedLocal': [value: string]
  /** 文件列表变化事件 */
  'update:localFiles': [value: any[]]
  /** 本地文件双击事件 */
  'local-dblclick': []
  /** 上传文件事件 */
  'upload-file': [path: string]
  /** 上传文件夹事件 */
  'upload-folder': [path: string]
  /** 删除本地文件事件 */
  'delete-local': [path: string]
}>()

/**
 * 内部状态
 */
const localPath = ref(props.localPath)
const localFiles = ref(props.localFiles)
const selectedLocal = ref(props.selectedLocal)
const localFileCount = ref(0)

/**
 * 创建本地文件状态对象供函数调用
 */
const getLocalState = (): LocalFileState => ({
  localPath,
  localFiles,
  localFileCount
})

/**
 * 右键菜单状态
 */
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const selectedFile = ref<any | null>(null)

/**
 * 创建文件夹对话框状态
 */
const createFolderDialogVisible = ref(false)
const folderName = ref('')
const folderNameError = ref('')
const folderNameInput = ref<HTMLInputElement | null>(null)

/**
 * 右键菜单样式
 */
const contextMenuStyle = computed(() => ({
  position: 'absolute' as const,
  left: `${contextMenuPosition.value.x}px`,
  top: `${contextMenuPosition.value.y}px`,
  zIndex: 10000
}))

/**
 * 是否有多选文件/文件夹
 */
const hasMultipleSelection = computed(() => {
  // 简化处理：如果选中的文件路径包含多个路径（用分隔符分隔），则为多选
  // 这里需要根据实际的多选实现来调整
  return false // TODO: 实现真正的多选逻辑
})

/**
 * 监听 props 变化
 */
watch(() => props.localPath, (newVal) => {
  localPath.value = newVal
})

watch(() => props.localFiles, (newVal) => {
  localFiles.value = newVal
})

watch(() => props.selectedLocal, (newVal) => {
  selectedLocal.value = newVal
})

/**
 * 监听内部状态变化，同步到父组件
 */
watch(localPath, (newVal) => {
  emit('update:localPath', newVal)
})

watch(localFiles, (newVal) => {
  emit('update:localFiles', newVal)
})

watch(selectedLocal, (newVal) => {
  emit('update:selectedLocal', newVal)
})

/**
 * 加载本地文件列表
 */
async function loadFiles(): Promise<void> {
  await loadLocalFiles(getLocalState())
}

/**
 * 处理路径输入回车
 */
function handlePathEnter(): void {
  loadFiles()
}

/**
 * 处理上级目录点击
 * 跨平台兼容：根据路径分隔符自动检测 Windows/Linux/macOS
 */
function handleUp(): void {
  localUp(getLocalState(), {
    dirname: (p: string) => {
      const sep = p.includes('\\') ? '\\' : '/'
      const idx = p.lastIndexOf(sep)
      return idx > 0 ? p.substring(0, idx) : (sep === '/' ? '/' : p.substring(0, 3))
    }
  })
}

/**
 * 处理文件点击（支持 Ctrl/Cmd/Shift 多选）
 */
function handleClick(path: string, event?: MouseEvent): void {
  if (event && (event.ctrlKey || event.metaKey)) {
    // Ctrl/Cmd 点击：切换选中状态
    if (selectedLocal.value === path) {
      selectedLocal.value = ''
    } else {
      selectedLocal.value = path
    }
  } else if (event && event.shiftKey) {
    // Shift 点击：范围选择（简化处理，选中从上一个到当前）
    const currentIndex = localFiles.value.findIndex(f => f.path === path)
    const lastIndex = localFiles.value.findIndex(f => f.path === selectedLocal.value)
    
    if (lastIndex !== -1 && currentIndex !== -1) {
      // 找到范围内的所有文件

      // 选中范围内的所有文件（这里简化为选中最后一个）
      selectedLocal.value = path
    } else {
      selectedLocal.value = path
    }
  } else {
    // 普通点击：单选
    selectedLocal.value = path
  }
}

/**
 * 处理文件双击
 */
function handleDblClick(event: MouseEvent): void {
  handleLocalDblClick(event, getLocalState())
  emit('local-dblclick')
}

/**
 * 处理右键菜单
 */
function handleContextMenu(event: MouseEvent): void {
  const target = event.target as HTMLElement
  const fileItem = target.closest('.file-item') as HTMLElement
  
  if (!fileItem) return
  
  const path = fileItem.dataset.path
  const file = localFiles.value.find(f => f.path === path)
  
  if (!file) return
  
  // 选中该文件
  selectedLocal.value = file.path
  
  // 请求显示右键菜单
  const canShow = requestContextMenu('local', closeContextMenu)
  if (!canShow) return
  
  // 设置选中的文件
  selectedFile.value = file
  
  // 设置菜单位置 - 使用相对于文件面板的位置
  const rect = fileItem.getBoundingClientRect()
  const panelRect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  contextMenuPosition.value = {
    x: rect.left - panelRect.left + 10,
    y: rect.bottom - panelRect.top + 4
  }
  
  // 显示菜单
  contextMenuVisible.value = true
}

/**
 * 关闭右键菜单
 */
function closeContextMenu(): void {
  contextMenuVisible.value = false
  selectedFile.value = null
  clearContextMenuOwner('local')
}

/**
 * 处理右键菜单动作
 */
function handleMenuAction(action: string): void {
  const file = selectedFile.value
  console.log('[SftpLocal] handleMenuAction called, action:', action, 'file:', file)
  if (!file) {
    console.error('[SftpLocal] No file selected')
    return
  }
  
  switch (action) {
    case 'createFolder':
      // 创建文件夹
      console.log('[SftpLocal] Emitting create-folder event')
      showCreateFolderDialog()
      break
    case 'upload':
      // 根据文件类型决定上传文件还是文件夹
      // TODO: 未来实现多选后，需要遍历所有选中的文件
      if (file.isDirectory) {
        // 上传文件夹
        console.log('[SftpLocal] Emitting upload-folder event with path:', file.path)
        emit('upload-folder', file.path)
      } else {
        // 上传文件
        console.log('[SftpLocal] Emitting upload-file event with path:', file.path)
        emit('upload-file', file.path)
      }
      break
    case 'deleteLocal':
      // 删除文件
      console.log('[SftpLocal] Emitting delete-local event with path:', file.path)
      emit('delete-local', file.path)
      break
  }
  
  // 关闭菜单
  closeContextMenu()
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
 * 确认创建文件夹
 */
async function confirmCreateFolder(): Promise<void> {
  const error = validateFolderName(folderName.value)
  if (error) {
    folderNameError.value = error
    return
  }
  

}

// 监听全局点击事件以关闭菜单
onMounted(() => {
  document.addEventListener('click', closeContextMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeContextMenu)
  clearContextMenuOwner('local')
})

// 导出函数供父组件调用
defineExpose({
  loadFiles,
  getSelectedFile: () => selectedLocal.value
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

.file-icon {
  flex-shrink: 0;
  color: var(--warning-color, #e6a23c);
}

.file-icon:not([color]) {
  color: var(--text-color-secondary, #999999);
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

/* 右键菜单样式 */
.context-menu {
  position: absolute;
  background: var(--card-bg, var(--bg-color, #ffffff));
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 4px 0;
  min-width: 200px;
  z-index: 10000;
}

.context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: background-color 0.2s;
}

.context-menu-item:hover {
  background: var(--hover-bg, #f0f0f0);
}

.menu-item-title {
  font-size: 13px;
  color: var(--text-color, #333333);
  font-weight: 500;
}

.menu-item-description {
  font-size: 11px;
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
