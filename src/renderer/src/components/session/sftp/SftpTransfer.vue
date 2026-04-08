/**
 * SFTP 文件传输组件
 * 提供本地与服务器之间的文件传输功能（类似 Xftp）
 * @module components/session/SftpTransfer
 */

<template>
  <div v-if="props.sftpWindowVisible" class="sftp-overlay" @click="handleOverlayClick">
    <div class="sftp-window" :class="{ 'is-maximized': isMaximized }" @click.stop>
      <!-- 窗口头部 -->
      <div class="sftp-header">
        <div class="header-left">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="header-icon">
            <path
              d="M18 16C18 17.1046 17.1046 18 16 18H4C2.89543 18 2 17.1046 2 16V4C2 2.89543 2.89543 2 4 2H8L10 5H16C17.1046 5 18 5.89543 18 7V16Z"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <div class="header-title">
            <h3>SFTP 文件传输</h3>
            <p class="header-subtitle">{{ session?.name }} - {{ session?.host }}:{{ session?.port }}</p>
          </div>
        </div>
        <div class="header-actions">
          <button class="header-btn" @click="refresh" title="刷新">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 8a6 6 0 11-1.17-3.54" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M14 2v4h-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
          <button class="header-btn" @click="toggleMaximize" title="最大化/还原">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="12" height="12" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </button>
          <button class="header-btn close" @click.stop="close" title="关闭">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="pointer-events: none;">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- 主内容区：双栏布局 -->
      <div class="sftp-body">
        <!-- 新建文件夹输入对话框 -->
        <div v-if="showNewFolderDialog" class="dialog-overlay" @click="cancelNewFolder">
          <div class="dialog-box" @click.stop>
            <h4>新建文件夹</h4>
            <input
              v-model="newFolderName"
              type="text"
              class="dialog-input"
              placeholder="请输入文件夹名称"
              @keyup.enter="confirmNewFolder"
              autofocus
            />
            <div class="dialog-buttons">
              <button class="dialog-btn cancel" @click="cancelNewFolder">取消</button>
              <button class="dialog-btn confirm" @click="confirmNewFolder">确定</button>
            </div>
          </div>
        </div>

        <!-- 本地文件浏览器 -->
        <SftpLocal
          ref="localPanelRef"
          v-model:local-path="localPath"
          v-model:local-files="localFiles"
          v-model:selected-local="selectedLocal"
          @local-dblclick="handleLocalDblClick"
          @upload-file="uploadFile"
          @upload-folder="uploadFolder"
          @delete-local="handleDeleteLocal"
          @upload-tasks-update="handleUploadTasksUpdate"
        />

        <!-- 远程文件浏览器 -->
        <SftpRemote
          ref="remotePanelRef"
          v-model:remote-path="remotePath"
          v-model:remote-files="remoteFiles"
          v-model:selected-remote="selectedRemote"
          :session="props.session"
          @remote-dblclick="handleRemoteDblClick"
          @download-local="downloadLocal"
          @create-folder="createRemoteFolder"
          @delete-remote="handleDeleteRemote"
          @download-tasks-update="handleDownloadTasksUpdate"
        />
      </div>

      <!-- 状态栏 -->
      <SftpStatusContainer
        :local-file-count="localFileCount"
        :remote-file-count="remoteFileCount"
        :current-path="statusBarCurrentPath"
        :transfer-tasks="transferTasks"
        :delete-tasks="deleteTasks"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { Session } from '@shared/types'
import type { TransferTask } from '@shared/types/sftp'
import SftpStatusContainer from './status/SftpStatusContainer.vue'
import SftpLocal from './SftpLocal.vue'
import SftpRemote from './SftpRemote.vue'


import { uploadFile as uploadFileLocal, deleteLocalFile as deleteLocalFileLocal, loadLocalFiles as loadLocalFilesUtil, uploadFolder as uploadFolderLocal } from './script/local'
import { createRemoteFolder as createRemoteFolderRemote, loadRemoteFiles as loadRemoteFilesUtil, downloadToLocal as downloadToLocalRemote } from './script/remote'
import { DeleteManager, createDeleteTask } from './script/deleteManager'
import type { DeleteTask } from '@shared/types/sftp'


/**
 * Props 定义
 */
interface Props {
  /** SFTP 窗口是否可见 */
  sftpWindowVisible: boolean
  /** SSH 会话对象 */
  session: Session | null
}

const props = withDefaults(defineProps<Props>(), {
  sftpWindowVisible: false,
  session: null
})

/**
 * Emits 定义
 */
const emit = defineEmits<{
  close: []
}>()

/**
 * ====================
 * 与子组件共享的状态（放在最前面）
 * ====================
 */

/**
 * 本地文件浏览状态（与 SftpLocal 共享）
 */
const localPath = ref('')
const localFiles = ref<any[]>([])
const selectedLocal = ref<string>('')
const localFileCount = ref(0)

/**
 * 远程文件浏览状态（与 SftpRemote 共享）
 */
const remotePath = ref('/')
const remoteFiles = ref<any[]>([])
const selectedRemote = ref<string>('')
const remoteFileCount = ref(0)

/**
 * 子组件引用
 */
const localPanelRef = ref<InstanceType<typeof SftpLocal> | null>(null)
const remotePanelRef = ref<InstanceType<typeof SftpRemote> | null>(null)

/**
 * 传输任务列表（合并上传和下载任务，计算属性）
 */
const transferTasks = computed<TransferTask[]>(() => {
  const uploadTasks = localPanelRef.value?.uploadTasks || []
  const downloadTasks = remotePanelRef.value?.downloadTasks || []
  return [...uploadTasks, ...downloadTasks]
})

/**
 * 删除任务数组（支持多个删除任务并发）
 */
const deleteTasks = ref<DeleteTask[]>([])

/**
 * ====================
 * 窗口状态
 * ====================
 */
const isMaximized = ref(false)


/**
 * 删除状态
 */
const deleting = ref(false)
const deletingCurrentPath = ref('')
const deleteProgressCleanup = ref<(() => void) | null>(null)


const statusBarCurrentPath = computed<string>(() => {
  // 如果有活跃的传输任务，显示传输路径
  const activeTask = transferTasks.value.find(task => task.status === 'active')
  if (activeTask && activeTask.nodes.length > 0) {
    const activeNode = activeTask.nodes.find(node => node.status === 'transferring')
    if (activeNode) {
      return activeNode.type === 'upload' ? (activeNode.localPath || '') : (activeNode.remotePath || '')
    }
  }
  return ''
})

/**
 * 新建文件夹对话框状态
 */
const showNewFolderDialog = ref(false)
const newFolderName = ref('')
const fileContextMenuPath = ref('')

/**
 * 关闭 SFTP 窗口
 */
function close(): void {
  emit('close')
}

/**
 * 处理遮罩层点击
 */
function handleOverlayClick(): void {
  close()
}

/**
 * 切换最大化
 */
function toggleMaximize(): void {
  isMaximized.value = !isMaximized.value
}

/**
 * 刷新文件列表
 */
async function refresh(): Promise<void> {
  await loadLocalFilesUtil({ localPath, localFiles, localFileCount })
  await loadRemoteFilesUtil({ remotePath, remoteFiles, remoteFileCount, session: computed(() => props.session) })
}

/**
 * 上传文件
 * @param filePath 文件路径，必须提供（来自本地目录栏选中的文件）
 */
async function uploadFile(filePath?: string): Promise<void> {
  console.log('[SftpTransfer] uploadFile called with filePath:', filePath)
  // 如果提供了文件路径，更新 selectedLocal
  if (filePath) {
    console.log('[SftpTransfer] Setting selectedLocal to:', filePath)
    selectedLocal.value = filePath
  }
  
  console.log('[SftpTransfer] Current selectedLocal:', selectedLocal.value)
  
  // 从本地面板获取 uploadTasks
  const localPanel = localPanelRef.value
  if (!localPanel) {
    console.error('[SftpTransfer] Local panel not available')
    alert('本地文件面板未就绪')
    return
  }
  
  await uploadFileLocal(
    selectedLocal,
    remotePath,
    props.session,
    localPanel.uploadTasks as any
  )
}

/**
 * 下载文件/文件夹到本地
 * @param path 远程文件/文件夹路径（来自右键菜单选中）
 */
async function downloadLocal(path: string): Promise<void> {
  console.log('[SftpTransfer] downloadLocal called with path:', path)
  
  // 从远程面板获取 downloadTasks
  const remotePanel = remotePanelRef.value
  if (!remotePanel) {
    console.error('[SftpTransfer] Remote panel not available')
    alert('远程文件面板未就绪')
    return
  }
  
  await downloadToLocalRemote(
    path,
    props.session,
    localPath,
    remotePanel.downloadTasks as any
  )
}

/**
 * 上传文件夹（递归）
 * @param folderPath 文件夹路径，必须提供（来自本地目录栏选中的文件夹）
 */
async function uploadFolder(folderPath: string): Promise<void> {
  console.log('[SftpTransfer] uploadFolder called with folderPath:', folderPath)
  
  // 如果没有提供文件夹路径，尝试使用选中的本地路径
  if (!folderPath && selectedLocal.value) {
    console.log('[SftpTransfer] No folderPath provided, using selectedLocal:', selectedLocal.value)
    folderPath = selectedLocal.value
  }

  
  // 创建传输任务对象
  const task: TransferTask = {
    id: `task-${Date.now()}`,
    type: 'upload',
    status: 'pending',
    nodes: [],
    totalBytes: 0,
    transferredBytes: 0,
    remainingTime: 0,
    elapsedTime: 0,
    createdAt: Date.now()
  }
  
  await uploadFolderLocal(
    props.session,
    remotePath,
    task,
    folderPath // 传递右键选中的文件夹路径
  )
}

/**
 * 创建远程文件夹
 */
async function createRemoteFolder(): Promise<void> {
  // 显示输入对话框
  showNewFolderDialog.value = true
  newFolderName.value = ''
}

/**
 * 取消新建文件夹
 */
function cancelNewFolder(): void {
  showNewFolderDialog.value = false
  newFolderName.value = ''
  fileContextMenuPath.value = ''
}

/**
 * 确认新建文件夹
 */
async function confirmNewFolder(): Promise<void> {
  await createRemoteFolderRemote(
    { remotePath, remoteFiles, remoteFileCount, session: computed(() => props.session) },
    newFolderName,
    showNewFolderDialog,
    fileContextMenuPath
  )
}


/**
 * 处理本地文件列表双击
 */
function handleLocalDblClick(): void {
  // 由 SftpLocal 组件内部处理
}

/**
 * 处理远程文件列表双击
 */
function handleRemoteDblClick(): void {
  // 由 SftpRemote 组件内部处理
}

/**
 * 处理上传任务更新
 */
function handleUploadTasksUpdate(tasks: TransferTask[]): void {
  // 不需要手动更新，transferTasks 是计算属性，会自动合并
  console.log('[SftpTransfer] 上传任务更新:', tasks.length)
}

/**
 * 处理下载任务更新
 */
function handleDownloadTasksUpdate(tasks: TransferTask[]): void {
  // 不需要手动更新，transferTasks 是计算属性，会自动合并
  console.log('[SftpTransfer] 下载任务更新:', tasks.length)
}

/**
 * 处理删除本地文件
 */
async function handleDeleteLocal(path: string): Promise<void> {
  if (!path || !props.session) return
  
  const confirmed = confirm('确定要删除选中的本地文件吗？')
  if (!confirmed) return
  
  try {
    // 获取文件信息
    const file = localFiles.value.find(f => f.path === path)
    if (!file) {
      throw new Error('文件不存在')
    }
    
    // 创建删除任务
    const task = createDeleteTask(
      path,
      file.name,
      file.isDirectory ? 'folder' : 'file',
      'local',
      file.size || 0
    )
    
    // 添加到任务数组
    deleteTasks.value.push(task)
    
    // 创建独立的删除管理器
    const sessionId = props.session.id || props.session.host
    const taskManager = new DeleteManager(sessionId)
    taskManager.addTask(task)
    
    // 执行删除
    deleting.value = true
    await taskManager.executeAll()
    
    // 更新任务状态
    const updatedTask = taskManager.getTaskStatus(task.id)
    if (updatedTask) {
      const taskIndex = deleteTasks.value.findIndex(t => t.id === task.id)
      if (taskIndex !== -1) {
        deleteTasks.value[taskIndex] = updatedTask
      }
    }
    
    // 刷新本地文件列表
    await localPanelRef.value?.loadFiles()
    
    // 检查是否失败
    if (taskManager.getFailedCount() > 0) {
      alert('删除失败')
    }
  } catch (error: any) {
    console.error('删除本地文件失败:', error)
    alert('删除本地文件失败')
  } finally {
    deleting.value = false
  }
}

/**
 * 处理删除远程文件
 */
async function handleDeleteRemote(path: string): Promise<void> {
  if (!path || !props.session) return
  
  const confirmed = confirm('确定要删除选中的远程文件吗？')
  if (!confirmed) return
  
  try {
    // 获取文件信息
    const file = remoteFiles.value.find(f => f.path === path)
    if (!file) {
      throw new Error('文件不存在')
    }
    
    // 创建删除任务
    const task = createDeleteTask(
      path,
      file.name,
      file.isDirectory ? 'folder' : 'file',
      'remote',
      file.size || 0
    )
    
    // 添加到任务数组
    deleteTasks.value.push(task)
    
    // 创建独立的删除管理器
    const sessionId = props.session.id || props.session.host
    const taskManager = new DeleteManager(sessionId)
    taskManager.addTask(task)
    
    // 执行删除
    deleting.value = true
    
    // 监听删除进度
    const cleanup = window.api.sftp.onDeleteProgress((data) => {
      if (data.sessionId === sessionId) {
        deletingCurrentPath.value = data.currentPath
      }
    })
    
    await taskManager.executeAll()
    
    // 清理监听器
    cleanup()
    
    // 更新任务状态
    const updatedTask = taskManager.getTaskStatus(task.id)
    if (updatedTask) {
      const taskIndex = deleteTasks.value.findIndex(t => t.id === task.id)
      if (taskIndex !== -1) {
        deleteTasks.value[taskIndex] = updatedTask
      }
    }
    
    // 刷新远程文件列表
    await remotePanelRef.value?.loadFiles()
    
    // 检查是否失败
    if (taskManager.getFailedCount() > 0) {
      alert('删除失败')
    }
  } catch (error: any) {
    console.error('删除远程文件失败:', error)
    alert('删除远程文件失败')
  } finally {
    deleting.value = false
    deletingCurrentPath.value = ''
  }
}






/**
 * 关闭右键菜单
 */
function closeContextMenu(event?: MouseEvent): void {
  if (event) {
    const target = event.target as HTMLElement
    // 如果点击的是右键菜单内部，不关闭
    if (target.closest('.context-menu')) {
      return
    }
  }
  // 关闭所有右键菜单会在各自的组件中处理
}


/**
 * 初始化
 */
onMounted(() => {
  // 添加全局点击事件监听，关闭右键菜单（使用捕获阶段）
  document.addEventListener('click', closeContextMenu, true)
  document.addEventListener('contextmenu', closeContextMenu, true)
  
  // 监听删除进度
  if (props.session) {
    const sessionId = props.session.id || props.session.host
    deleteProgressCleanup.value = window.api.sftp.onDeleteProgress((data) => {
      if (data.sessionId === sessionId) {
        deletingCurrentPath.value = data.currentPath
      }
    })
  }
  
  // 注意：文件列表加载移到 watch 中，等待子组件准备好后再调用
})

/**
 * 组件卸载时清理
 */
onUnmounted(() => {
  document.removeEventListener('click', closeContextMenu, true)
  document.removeEventListener('contextmenu', closeContextMenu, true)
  // 清理删除进度监听器
  if (deleteProgressCleanup.value) {
    deleteProgressCleanup.value()
  }
})

/**
 * 监听 visible 变化，加载文件列表
 */
watch(() => props.sftpWindowVisible, async (newVal) => {
  if (newVal) {
    // 检查 session 是否存在
    if (!props.session) {
      console.error('Session is null')
      alert('会话信息无效')
      close()
      return
    }
    
    console.log('SFTP window opened, connecting to:', props.session.host)
    
    // 连接 SFTP
    try {
      const sessionId = props.session.id || props.session.host
      // 检查 API 是否存在
      if (!window.api?.sftp) {
        console.error('SFTP API not available')
        alert('SFTP 功能不可用')
        close()
        return
      }
      
      const result = await window.api.sftp.connect(sessionId, {
        host: props.session.host,
        port: props.session.port || 22,
        username: props.session.username,
        password: props.session.password
      })
      
      if (!result.success) {
        console.error('SFTP 连接失败:', result.error)
        alert(`SFTP 连接失败：${result.error}`)
        close()
        return
      }
      
      console.log('SFTP connected successfully')
    } catch (error: any) {
      console.error('SFTP 连接失败:', error)
      alert(`SFTP 连接失败：${error.message}`)
      close()
      return
    }
    
    // 连接成功后，等待子组件准备好再加载文件列表
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // 调用子组件的 loadFiles 方法
    if (localPanelRef.value?.loadFiles) {
      await localPanelRef.value.loadFiles()
    }
    if (remotePanelRef.value?.loadFiles) {
      await remotePanelRef.value.loadFiles()
    }
  }
})
</script>

<style scoped>
/* SFTP 窗口遮罩层 */
.sftp-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease-out;
}

/* SFTP 主窗口 */
.sftp-window {
  width: 1200px;
  height: 700px;
  background: var(--card-bg, var(--bg-color, #1e1e1e));
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.3s ease-out;
}

.sftp-window.is-maximized {
  width: 100%;
  height: 100%;
  border-radius: 0;
}

/* 窗口头部 */
.sftp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--header-bg, var(--bg-color-secondary, #2d2d2d));
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  color: var(--primary-color, #409eff);
}

.header-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color, #333333);
}

.header-subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-secondary, #666666);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--text-color, #333333);
  cursor: pointer;
  transition: all 0.2s;
}

.header-btn:hover {
  background: var(--hover-bg, #e8e8e8);
  color: var(--primary-color, #409eff);
}

.header-btn.close:hover {
  background: #e81123;
  color: white;
}

/* 主内容区 */
.sftp-body {
  flex: 1;
  display: flex;
  gap: 1px;
  background: var(--border-color, #e0e0e0);
  overflow: hidden;
}

/* 文件面板 */
.file-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-color, #ffffff);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--sidebar-bg, var(--bg-color-secondary, #f3f3f3));
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.panel-path {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: var(--input-bg, var(--bg-color, #ffffff));
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 4px;
}

.path-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-color, #333333);
  font-size: 13px;
}

.nav-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 4px;
  color: var(--text-color-secondary, #666666);
  cursor: pointer;
  transition: all 0.2s;
}

.nav-btn:hover {
  background: var(--hover-bg, #f0f0f0);
  color: var(--text-color, #333333);
}

/* 文件列表 */
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
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.file-item:hover {
  background: var(--hover-bg, #f0f0f0);
}

.file-item.selected {
  background: var(--active-bg, rgba(64, 158, 255, 0.15));
}

.file-icon {
  flex-shrink: 0;
  color: var(--text-color-secondary, #666666);
}

.file-item.selected .file-icon {
  color: var(--primary-color, #409eff);
}

.file-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-color, #333333);
}

.file-size {
  font-size: 12px;
  color: var(--text-color-secondary, #999999);
  min-width: 60px;
  text-align: right;
}

/* 传输进度 */
.transfer-progress {
  padding: 12px 16px;
  background: var(--sidebar-bg, var(--bg-color-secondary, #f3f3f3));
  border-top: 1px solid var(--border-color, #e0e0e0);
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.progress-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color, #333333);
}

.progress-close {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--text-color-secondary, #666666);
  cursor: pointer;
  transition: all 0.2s;
}

.progress-close:hover {
  background: var(--hover-bg, #f0f0f0);
  color: var(--text-color, #333333);
}

.progress-bar {
  height: 6px;
  background: var(--bg-color, #ffffff);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-color, #409eff), var(--primary-color-light, #66b1ff));
  transition: width 0.3s ease;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-color-secondary, #999999);
}

/* 状态栏 */
.sftp-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--sidebar-bg, var(--bg-color-secondary, #f3f3f3));
  border-top: 1px solid var(--border-color, #e0e0e0);
  font-size: 12px;
}

.footer-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.footer-label {
  color: var(--text-color-secondary, #999999);
}

.footer-value {
  color: var(--text-color, #333333);
  font-weight: 500;
}

.footer-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-ready {
  color: var(--text-color-secondary, #999999);
}

.status-transferring {
  color: var(--primary-color, #409eff);
  animation: pulse 1.5s infinite;
}

.status-deleting {
  color: var(--danger-color, #f56c6c);
  animation: pulse 1.5s infinite;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* 新建文件夹对话框样式 */
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
  z-index: 10000;
}

.dialog-box {
  background: var(--card-bg, var(--bg-color, #ffffff));
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px;
  padding: 24px;
  min-width: 300px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.dialog-box h4 {
  margin: 0 0 16px 0;
  color: var(--text-color, #333333);
  font-size: 16px;
}

.dialog-input {
  width: 100%;
  padding: 8px 12px;
  background: var(--input-bg, var(--bg-color, #ffffff));
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 4px;
  color: var(--text-color, #333333);
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.dialog-input:focus {
  border-color: var(--primary-color, #409eff);
}

.dialog-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.dialog-btn {
  padding: 6px 16px;
  border-radius: 4px;
  border: 1px solid var(--border-color, #e0e0e0);
  background: var(--bg-color-secondary, #f3f3f3);
  color: var(--text-color, #333333);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.dialog-btn:hover {
  background: var(--hover-bg, #e8e8e8);
}

.dialog-btn.cancel {
  background: transparent;
}

.dialog-btn.confirm {
  background: var(--primary-color, #409eff);
  border-color: var(--primary-color, #409eff);
  color: #ffffff;
}

.dialog-btn.confirm:hover {
  background: var(--primary-color-light, #66b1ff);
}

/* 右键菜单样式 */
.context-menu {
  position: fixed;
  background: var(--card-bg, var(--bg-color, #ffffff));
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 6px;
  padding: 6px;
  min-width: 200px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  animation: fadeIn 0.15s ease-out;
}

/* 文件列表右键菜单 */
.file-context-menu {
  min-width: 220px;
}

.context-menu-item {
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.context-menu-item:hover {
  background: var(--hover-bg, #f0f0f0);
}

.menu-item-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color, #fff);
  margin-bottom: 2px;
}

.menu-item-description {
  font-size: 11px;
  color: var(--text-color-secondary, #999999);
  line-height: 1.3;
}

/* 传输树容器 */
.transfer-tree-container {
  position: relative;
}

/* 取消上传按钮 */
.cancel-upload-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: var(--danger-color, #f56c6c);
  border: none;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 10;
}

.cancel-upload-btn:hover {
  background: var(--danger-color, #f56c6c);
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(245, 108, 108, 0.4);
}

.cancel-upload-btn:active {
  transform: translateY(0);
}

.cancel-upload-btn svg {
  width: 12px;
  height: 12px;
}
</style>
