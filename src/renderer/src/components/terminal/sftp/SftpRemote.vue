/**
 * SFTP 远程文件浏览器组件
 * 提供远程文件的浏览、导航、选择等功能
 * @module components/session/SftpRemote
 */

<template>
  <div class="file-panel remote" ref="panelRef">
    <div class="panel-header">
      <div class="panel-path">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="3" width="12" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="7" cy="7" r="1.5" fill="currentColor"/>
        </svg>
        <input
          v-model="remotePath"
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
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
      :class="{ 'is-dragging': isDraggingOver }"
    >
      <!-- 已断连状态提示 -->
      <div v-if="!props.connected" class="disconnected-overlay">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" class="disconnected-icon">
          <path d="M8.5 7.5l15 15m0-15l-15 15M22 4v8m0 0l4-3M22 12l4 3M10 20v8m0 0l-4 3M10 28l-4-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="disconnected-text">SFTP 连接已断开</span>
        <span class="disconnected-hint">请右键标签页选择「重连会话」</span>
      </div>
      <template v-else>
      <div
        v-for="item in remoteFiles"
        :key="item.path"
        :data-path="item.path"
        class="file-item"
        :class="{ selected: selectedRemotes.includes(item.path) }"
        @click="handleClick(item.path, $event)"
      >
        <svg v-if="item.isDirectory" width="16" height="16" viewBox="0 0 16 16" fill="none" class="file-icon is-folder">
          <path d="M14 13.5C14 14.3284 13.3284 15 12.5 15H3.5C2.67157 15 2 14.3284 2 13.5V5.5C2 4.67157 2.67157 4 3.5 4H6.5L7.5 5H12.5C13.3284 5 14 5.67157 14 6.5V13.5Z" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none" class="file-icon">
          <path d="M9 1H4C2.89543 1 2 1.89543 2 3V13C2 14.1046 2.89543 15 4 15H12C13.1046 15 14 14.1046 14 13V6L9 1Z" stroke="currentColor" stroke-width="1.5"/>
          <path d="M9 1V6H14" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        <span class="file-name">{{ item.name }}</span>
        <span class="file-size">{{ formatSize(item.size) }}</span>
      </div>
    </template>
    </div>
    
    <!-- 远程文件右键菜单（通过 Store 管理全局唯一性） -->
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
import { ref, watch, nextTick, computed } from 'vue'
import type { TransferTask } from '@shared/types/sftp'

import { formatSize } from '@/utils/fs-utils'
import { useContextMenuStore } from '@/stores/contextMenu'
import { useSftpSelectionStore } from '@/stores/sftpSelection'
import { loadRemoteFiles, remoteUpRemote, handleRemoteDblClick, type RemoteFileState } from './script/remote'
import AlertDialog from '@/components/common/AlertDialog.vue'

/**
 * Props 定义（安全改进 v3 - 完全移除 session 依赖）
 * 
 * 设计原则：
 * - 只接收必要的标识符：sessionId + connectionId
 * - 组件内部通过 SessionStore 自行获取会话信息（非敏感部分）
 * - 所有 SFTP API 调用都使用 connectionId
 * - 符合最小权限原则，不传递任何会话对象
 */
interface Props {
  /** 当前远程路径 */
  remotePath: string
  /** 远程文件列表 */
  remoteFiles: any[]
  /**
   * 会话 ID（用于从 SessionStore 获取会话信息）
   * 仅用于显示名称、主机等非敏感信息
   */
  sessionId: string
  /** 下载任务数组 */
  downloadTasks: TransferTask[]
  /**
   * SFTP 连接标识符（每个标签独立）
   * 对应主进程 sftpPool.getConnection(connectionId) 的 key
   * 必须与建立连接时使用的 ID 一致
   */
  connectionId?: string
  /** SFTP 连接状态，false 时显示断连提示 */
  connected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  sessionId: '',
  downloadTasks: () => [],
  connectionId: '',
  connected: true
})

/**
 * 计算属性：当前会话对象（从 SessionStore 动态获取）
 */
const emit = defineEmits<{
  /** 路径变化事件 */
  'update:remotePath': [value: string]
  /** 文件列表变化事件 */
  'update:remoteFiles': [value: any[]]
  /** 远程文件双击事件 */
  'remote-dblclick': []
  /**
   * 下载事件（统一接口：支持单文件/单文件夹/多文件混合选择）
   * - 单文件时：paths.length = 1
   * - 单文件夹时：paths.length = 1
   * - 多文件/文件夹时：paths.length > 1
   */
  'download-batch': [paths: string[]]
  /** 创建远程文件夹事件 */
  'create-folder': [folderName: string]
  /**
   * 删除远程文件事件（统一接口：支持单文件/多文件批量删除）
   * - 单文件时：paths.length = 1
   * - 多文件时：paths.length > 1
   */
  'delete-batch': [paths: string[]]
}>()

/**
 * 内部状态
 */
const remotePath = ref(props.remotePath)
const remoteFiles = ref(props.remoteFiles)
const remoteFileCount = ref(0)

/**
 * SFTP 选择状态 Store（按连接 ID 隔离）
 * 统一管理选中文件列表（单文件/多文件共用）
 * 注意：与 SftpLocal 共用同一个 Store，但通过 connectionId 隔离
 */
const sftpSelectionStore = useSftpSelectionStore()

/**
 * 当前连接的选中远程文件列表（从 Store 读取）
 * - 单文件操作时：数组长度 = 1
 * - 多文件操作时：数组长度 > 1
 * - 未选中时：空数组
 */
const selectedRemotes = computed<string[]>({
  get: () => sftpSelectionStore.getSelectedFiles(`remote-${props.connectionId}`),
  set: (value) => sftpSelectionStore.setSelectedFiles(`remote-${props.connectionId}`, value)
})

/**
 * 拖拽状态
 */
const isDraggingOver = ref(false)
/* 右键菜单 Store（全局唯一管理） */
const contextMenuStore = useContextMenuStore()
const menuOwnerId = 'sftp-remote'

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
 * 监听 props 变化
 */
watch(() => props.remotePath, (newVal) => {
  remotePath.value = newVal
})

// 监听 props 变化，同步到本地 ref（带类型保护）
watch(() => props.remoteFiles, (newVal) => {
  // 确保 newVal 是数组类型
  remoteFiles.value = Array.isArray(newVal) ? newVal : []
})

/**
 * 监听内部状态变化，同步到父组件
 */
watch(remotePath, (newVal) => {
  emit('update:remotePath', newVal)
})

watch(remoteFiles, (newVal) => {
  emit('update:remoteFiles', newVal)
})

/**
 * 创建远程文件状态对象供函数调用
 * 
 * 安全改进（v3）：
 * - 只返回 connectionId（SFTP 连接池标识符）
 * - 不再返回 session 对象
 * - 符合最小权限原则，只传递必要的连接信息
 */
const getRemoteState = (): RemoteFileState => ({
  remotePath,
  remoteFiles,
  remoteFileCount,
  connectionId: props.connectionId || ''
})

/**
 * 加载远程文件列表
 * 
 * 安全改进（v3）：
 * - 优先检查 connectionId（SFTP 连接标识符）
 * - 不再依赖 session prop，改用 SessionStore 获取会话信息
 */
async function loadFiles(): Promise<void> {
  // 检查 SFTP 连接标识符是否存在
  if (!props.connectionId) {
    console.warn('[SftpRemote] connectionId 不存在，跳过加载远程文件')
    return
  }
  
  try {
    await loadRemoteFiles(getRemoteState())
  } catch (error: any) {
    console.error('[SftpRemote] 加载远程文件失败:', error)
    // 不抛出异常，避免中断 Vue 更新周期
  }
}

/**
 * 处理路径输入回车
 */
function handlePathEnter(): void {
  loadFiles()
}

/**
 * 处理上级目录点击
 */
function handleUp(): void {
  remoteUpRemote(getRemoteState(), {
    posix: {
      dirname: (path: string) => {
        const idx = path.lastIndexOf('/')
        return idx > 0 ? path.substring(0, idx) : '/'
      }
    }
  })
}

/**
 * 处理文件点击（支持 Ctrl/Cmd/Shift 多选）
 * 统一使用 selectedRemotes 数组（单文件长度=1，多文件长度>1）
 */
function handleClick(path: string, event?: MouseEvent): void {
  if (event && (event.ctrlKey || event.metaKey)) {
    // Ctrl/Cmd 点击：切换选中状态（使用 Store 方法）
    sftpSelectionStore.toggleFileSelection(`remote-${props.connectionId}`, path)
  } else if (event && event.shiftKey) {
    // Shift 点击：范围选择（使用 Store 方法）
    sftpSelectionStore.rangeSelect(
      `remote-${props.connectionId}`,
      path,
      remoteFiles.value,
      (item: any) => item.path
    )
  } else {
    // 普通点击：清空多选，单选当前项
    sftpSelectionStore.setSelectedFiles(`remote-${props.connectionId}`, [path])
  }
}

/**
 * 处理文件双击
 */
function handleDblClick(event: MouseEvent): void {
  handleRemoteDblClick(event, getRemoteState())
  emit('remote-dblclick')
}

/**
 * 处理右键菜单
 * 通过全局 Store 管理菜单状态，确保全局唯一性
 * 菜单位置跟随鼠标右击的实际位置
 */
function handleContextMenu(event: MouseEvent): void {
  const target = event.target as HTMLElement
  const fileItem = target.closest('.file-item') as HTMLElement

  let clickedFile: any = null

  if (fileItem) {
    const path = fileItem.dataset.path
    const file = remoteFiles.value.find(f => f.path === path)
    if (!file) return
    
    clickedFile = file
    
    const remoteConnectionId = `remote-${props.connectionId}`
    const currentSelection = sftpSelectionStore.getSelectedFiles(remoteConnectionId)
    const isAlreadySelected = currentSelection.includes(file.path)
    
    if (currentSelection.length === 0 || !isAlreadySelected) {
      sftpSelectionStore.setSelectedFiles(remoteConnectionId, [file.path])
    }
  }

  const x = event.clientX
  const y = event.clientY

  const menuItems = [
    {
      action: 'download',
      title: '下载',
      icon: 'download',
      description: selectedRemotes.value.length > 1 
        ? `下载选中的 ${selectedRemotes.value.length} 个文件/文件夹到本地目录`
        : '将选中的远程文件/文件夹下载到本地目录',
      visible: !!clickedFile || selectedRemotes.value.length > 1
    },
    { action: 'createFolder', title: '新建文件夹', icon: 'create-folder', description: '在当前远程目录下创建新文件夹' },
    { action: 'refresh', title: '刷新', icon: 'refresh', description: '重新加载当前浏览目录' },
    {
      action: 'deleteRemote',
      title: '删除',
      icon: 'delete',
      description: '删除选中的远程文件或文件夹',
      visible: !!clickedFile
    }
  ]

  /**
 * 获取当前选中的路径列表（优先使用多选，否则使用点击的文件）
 */
function getSelectedOrClickedPath(clickedFile: any): string[] {
  return selectedRemotes.value.length > 0 
    ? [...selectedRemotes.value] 
    : (clickedFile ? [clickedFile.path] : [])
}

contextMenuStore.showContextMenu(menuOwnerId, { x, y }, menuItems, (action: string) => {
    switch (action) {
      case 'download':
        emit('download-batch', getSelectedOrClickedPath(clickedFile))
        break
      case 'createFolder':
        showCreateFolderDialog()
        break
      case 'refresh':
        handleRefresh()
        break
      case 'deleteRemote':
        emit('delete-batch', getSelectedOrClickedPath(clickedFile))
        break
    }
  })
}

/**
 * 处理拖拽进入
 */
function handleDragOver(_event: DragEvent): void {
  isDraggingOver.value = true
}

/**
 * 处理拖拽离开
 */
function handleDragLeave(): void {
  isDraggingOver.value = false
}

/**
 * 处理拖拽放置（上传文件）
 */
async function handleDrop(event: DragEvent): Promise<void> {
  isDraggingOver.value = false
  
  const dataTransfer = event.dataTransfer
  if (!dataTransfer || !dataTransfer.files || dataTransfer.files.length === 0) {
    return
  }
  
  // 获取拖拽的文件
  const files = dataTransfer.files
  const filePaths: string[] = []
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    // 从 File 对象获取路径（需要 Electron API 支持）
    const filePath = (file as any).path
    if (filePath) {
      filePaths.push(filePath)
    }
  }
  
  if (filePaths.length === 0) {
    console.warn('[SftpRemote] 拖拽的文件无法获取路径')
    showAlert('无法获取拖拽文件的路径', '警告')
    return
  }
  

}

/**
 * 处理刷新操作：重新加载当前浏览目录的远程文件列表
 */
async function handleRefresh(): Promise<void> {
  console.log('[SftpRemote] 刷新远程目录:', remotePath.value)
  
  try {
    await loadFiles()
    console.log('[SftpRemote] ✅ 远程目录刷新成功')
  } catch (error: any) {
    console.error('[SftpRemote] ❌ 刷新远程目录失败:', error)
    // 不显示错误提示，静默失败即可（刷新失败不影响用户体验）
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
  const exists = remoteFiles.value.some(f => f.name === name && f.isDirectory)
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
 
  // 触发事件到父组件，由父组件执行实际的远程文件夹创建
  // （因为需要 sftpConnectionId 来调用 SFTP API）
  console.log('[SftpRemote] 触发 create-folder 事件，文件夹名称:', folderName.value.trim())
  emit('create-folder', folderName.value.trim())
  
  // 关闭对话框
  closeCreateFolderDialog()
}

// 导出函数供父组件调用
defineExpose({
  loadFiles,
  /** 获取当前所有选中的远程文件/文件夹路径（用于批量操作） */
  getSelectedFiles: () => [...selectedRemotes.value]
})

// 注意：初始化加载由父组件调用 loadFiles 触发
</script>

<style scoped>
.file-panel.remote {
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
  transition: background 0.2s;
}

.file-list.is-dragging {
  background: var(--drag-over-bg, rgba(64, 158, 255, 0.1));
  border: 2px dashed var(--primary-color, #409eff);
}

/* 已断连状态 */
.disconnected-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  gap: 12px;
  color: var(--text-color-secondary, #999999);
}

.disconnected-icon {
  color: var(--error-color, #f56c6c);
  opacity: 0.6;
}

.disconnected-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color-secondary, #999999);
}

.disconnected-hint {
  font-size: 12px;
  color: var(--text-color-muted, #bbbbbb);
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
  color: var(--primary-color, #409eff);
}

.file-icon.is-folder {
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
  margin-left: 8px;
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
