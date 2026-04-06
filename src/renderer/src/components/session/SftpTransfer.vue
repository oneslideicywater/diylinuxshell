/**
 * SFTP 文件传输组件
 * 提供本地与服务器之间的文件传输功能（类似 Xftp）
 * @module components/session/SftpTransfer
 */

<template>
  <div v-if="visible" class="sftp-overlay" @click="handleOverlayClick">
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
            <p class="header-subtitle">{{ session.name }} - {{ session.host }}:{{ session.port }}</p>
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
          <button class="header-btn close" @click="close" title="关闭">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- 工具栏 -->
      <div class="sftp-toolbar">
        <button class="toolbar-btn" @click="uploadFile" @contextmenu.prevent="showContextMenu($event, 'upload')" title="上传文件">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 11V3M8 3L5 6M8 3l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M3 11v2h10v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>上传</span>
        </button>
        <button class="toolbar-btn" @click="downloadFile" @contextmenu.prevent="showContextMenu($event, 'download')" title="下载文件">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v8M8 11l-3-3M8 11l3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M3 11v2h10v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>下载</span>
        </button>
        <div class="toolbar-separator"></div>
        <button class="toolbar-btn" @click="createRemoteFolder" @contextmenu.prevent="showContextMenu($event, 'newFolder')" title="新建文件夹">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M14 12a2 2 0 002-2V6a2 2 0 00-2-2h-4l-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h10z" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 6v6M5 9h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>新建文件夹</span>
        </button>
        <div class="toolbar-separator"></div>
        <button class="toolbar-btn" @click="deleteFile" @contextmenu.prevent="showContextMenu($event, 'delete')" title="删除">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 4h10M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4M6 4V2h4v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>删除</span>
        </button>
      </div>

      <!-- 右键菜单（移到工具栏外部） -->
      <div v-if="contextMenuVisible" class="context-menu" :style="contextMenuStyle">
        <div class="context-menu-item" @click="handleContextMenuAction">
          <span class="menu-item-title">{{ currentContextMenuAction?.title }}</span>
          <span class="menu-item-description">{{ currentContextMenuAction?.description }}</span>
        </div>
      </div>

      <!-- 文件列表右键菜单 -->
      <div v-if="fileContextMenuVisible" class="context-menu file-context-menu" :style="fileContextMenuStyle">
        <!-- 本地文件菜单项 -->
        <div class="context-menu-item" @click="handleFileContextMenuAction('upload')" v-if="fileContextMenuType === 'local' && selectedLocalFile?.isDirectory === false">
          <span class="menu-item-title">上传到服务器</span>
          <span class="menu-item-description">将选中的本地文件上传到远程目录</span>
        </div>
        <div class="context-menu-item" @click="handleFileContextMenuAction('deleteLocal')" v-if="fileContextMenuType === 'local'">
          <span class="menu-item-title">删除</span>
          <span class="menu-item-description">删除选中的本地文件或文件夹</span>
        </div>
        
        <!-- 远程文件菜单项 -->
        <div class="context-menu-item" @click="handleFileContextMenuAction('download')" v-if="fileContextMenuType === 'remote'">
          <span class="menu-item-title">下载到本地</span>
          <span class="menu-item-description">将选中的远程文件或文件夹下载到本地</span>
        </div>
        <div class="context-menu-item" @click="handleFileContextMenuAction('newFolder')" v-if="fileContextMenuType === 'remote'">
          <span class="menu-item-title">新建文件夹</span>
          <span class="menu-item-description">在当前远程目录下创建新文件夹</span>
        </div>
        <div class="context-menu-item" @click="handleFileContextMenuAction('deleteRemote')" v-if="fileContextMenuType === 'remote'">
          <span class="menu-item-title">删除</span>
          <span class="menu-item-description">删除选中的远程文件或文件夹</span>
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
                @keyup.enter="loadLocalFiles"
              />
            </div>
            <button class="nav-btn" @click="localUp" title="上级目录">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M11 7H3M3 7l4-4M3 7l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="file-list" @dblclick="handleLocalDblClick" @contextmenu.prevent="handleLocalContextMenu">
            <div
              v-for="item in localFiles"
              :key="item.path"
              :data-path="item.path"
              class="file-item"
              :class="{ selected: selectedLocal === item.path }"
              @click="selectedLocal = item.path"
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
        </div>

        <!-- 远程文件浏览器 -->
        <div class="file-panel remote">
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
                @keyup.enter="loadRemoteFiles"
              />
            </div>
            <button class="nav-btn" @click="remoteUp" title="上级目录">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M11 7H3M3 7l4-4M3 7l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="file-list" @dblclick="handleRemoteDblClick" @contextmenu.prevent="handleRemoteContextMenu">
            <div
              v-for="item in remoteFiles"
              :key="item.path"
              :data-path="item.path"
              class="file-item"
              :class="{ selected: selectedRemote === item.path }"
              @click="selectedRemote = item.path"
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
        </div>
      </div>

      <!-- 传输进度 -->
      <div v-if="transferring" class="transfer-progress">
        <div class="progress-header">
          <span class="progress-title">{{ progressTitle }}</span>
          <button class="progress-close" @click="cancelTransfer">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <div class="progress-info">
          <span>{{ progressCurrent }} / {{ progressTotal }}</span>
          <span>{{ progressSpeed }}</span>
        </div>
      </div>

      <!-- 状态栏 -->
      <div class="sftp-footer">
        <div class="footer-item">
          <span class="footer-label">本地:</span>
          <span class="footer-value">{{ localFileCount }} 个项目</span>
        </div>
        <div class="footer-item">
          <span class="footer-label">远程:</span>
          <span class="footer-value">{{ remoteFileCount }} 个项目</span>
        </div>
        <div class="footer-status">
          <span v-if="!transferring" class="status-ready">就绪</span>
          <span v-else class="status-transferring">传输中...</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import type { Session } from '@shared/types'

// 使用 POSIX 路径处理（跨平台兼容）
const pathUtils = {
  dirname: (p: string): string => {
    // 处理 Windows 路径
    if (p.includes('\\')) {
      const parts = p.split(/[/\\]/)
      if (parts.length <= 1) return p
      parts.pop()
      return parts.join('\\') || '\\'
    }
    // 处理 POSIX 路径
    const parts = p.split('/')
    if (parts.length <= 1) return p
    parts.pop()
    return parts.join('/') || '/'
  },
  posix: {
    dirname: (p: string): string => {
      const parts = p.split('/')
      if (parts.length <= 1) return p
      parts.pop()
      return parts.join('/') || '/'
    }
  }
}

/**
 * Props 定义
 */
interface Props {
  visible: boolean
  session: Session | null
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  session: null
})

/**
 * Emits 定义
 */
const emit = defineEmits<{
  close: []
}>()

/**
 * 窗口状态
 */
const isMaximized = ref(false)
const transferring = ref(false)
const progressTitle = ref('')
const progressPercent = ref(0)
const progressCurrent = ref('')
const progressTotal = ref('')
const progressSpeed = ref('')

/**
 * 文件浏览状态
 */
const localPath = ref('')
const remotePath = ref('/')
const localFiles = ref<any[]>([])
const remoteFiles = ref<any[]>([])
const selectedLocal = ref<string>('')
const selectedRemote = ref<string>('')
const localFileCount = ref(0)
const remoteFileCount = ref(0)

/**
 * 新建文件夹对话框状态
 */
const showNewFolderDialog = ref(false)
const newFolderName = ref('')

/**
 * 右键菜单状态
 */
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const currentContextMenuAction = ref<{
  type: string
  title: string
  description: string
} | null>(null)

/**
 * 文件列表右键菜单状态
 */
const fileContextMenuVisible = ref(false)
const fileContextMenuPosition = ref({ x: 0, y: 0 })
const fileContextMenuType = ref<'local' | 'remote'>('local')
const fileContextMenuPath = ref<string>('') // 右键菜单打开时的路径

/**
 * 选中的文件信息（computed）
 */
const selectedLocalFile = computed(() => {
  if (!selectedLocal.value) return null
  return localFiles.value.find(f => f.path === selectedLocal.value) || null
})

const selectedRemoteFile = computed(() => {
  if (!selectedRemote.value) return null
  return remoteFiles.value.find(f => f.path === selectedRemote.value) || null
})

/**
 * 右键菜单动作映射
 */
const contextMenuActions: Record<string, { title: string; description: string }> = {
  upload: {
    title: '上传文件',
    description: '选择本地文件上传到当前远程目录'
  },
  download: {
    title: '下载文件',
    description: '选择远程文件下载到本地指定目录'
  },
  newFolder: {
    title: '新建文件夹',
    description: '在当前远程目录下创建新的文件夹'
  },
  delete: {
    title: '删除',
    description: '删除当前选中的本地或远程文件'
  }
}

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
  await loadLocalFiles()
  await loadRemoteFiles()
}

/**
 * 加载本地文件列表
 */
async function loadLocalFiles(): Promise<void> {
  try {
    let pathToLoad = localPath.value
    if (!pathToLoad) {
      // 使用 API 获取主目录
      const result = await window.api.sftp.getHomeDir()
      if (result.success && result.data) {
        pathToLoad = result.data
      } else {
        // 默认值
        pathToLoad = 'C:\\'
      }
    }
    
    localPath.value = pathToLoad
    
    const result = await window.api.sftp.getLocalFiles(pathToLoad)
    if (result.success && result.data) {
      localFiles.value = result.data
      localFileCount.value = localFiles.value.length
    }
  } catch (error) {
    console.error('加载本地文件失败:', error)
    // 出错时加载根目录
    localPath.value = 'C:\\'
    const result = await window.api.sftp.getLocalFiles(localPath.value)
    if (result.success && result.data) {
      localFiles.value = result.data
      localFileCount.value = localFiles.value.length
    }
  }
}

/**
 * 加载远程文件列表
 */
async function loadRemoteFiles(): Promise<void> {
  if (!props.session) {
    console.error('Session is null')
    return
  }
  
  try {
    const sessionId = props.session.id || props.session.host
    console.log('Loading remote files:', sessionId, remotePath.value)
    
    const result = await window.api.sftp.listDir(sessionId, remotePath.value)
    
    if (result.success && result.data) {
      remoteFiles.value = result.data
      remoteFileCount.value = remoteFiles.value.length
      console.log('Remote files loaded:', remoteFileCount.value)
    } else {
      console.error('加载远程文件失败:', result.error)
      remoteFiles.value = []
      remoteFileCount.value = 0
    }
  } catch (error: any) {
    console.error('加载远程文件失败:', error)
    remoteFiles.value = []
    remoteFileCount.value = 0
  }
}

/**
 * 本地文件列表双击
 */
function handleLocalDblClick(event: MouseEvent): void {
  const target = (event.target as HTMLElement).closest('.file-item')
  if (!target) return
  
  const item = localFiles.value.find(f => f.path === (target as HTMLElement).dataset.path)
  if (item?.isDirectory) {
    localPath.value = item.path
    loadLocalFiles()
  }
}

/**
 * 远程文件列表双击
 */
function handleRemoteDblClick(event: MouseEvent): void {
  const target = (event.target as HTMLElement).closest('.file-item')
  if (!target) return
  
  const item = remoteFiles.value.find(f => f.path === (target as HTMLElement).dataset.path)
  if (item?.isDirectory) {
    remotePath.value = item.path
    loadRemoteFiles()
  }
}

/**
 * 上传文件
 */
async function uploadFile(): Promise<void> {
  if (!selectedLocal.value) {
    alert('请先选择要上传的文件')
    return
  }
  
  if (!props.session) return
  
  const sessionId = props.session.id || props.session.host
  const fileName = selectedLocal.value.split(/[\\/]/).pop() || ''
  const remoteFilePath = remotePath.value === '/' ? `/${fileName}` : `${remotePath.value}/${fileName}`
  
  try {
    transferring.value = true
    progressTitle.value = '上传文件中...'
    progressPercent.value = 0
    
    const result = await window.api.sftp.upload(sessionId, selectedLocal.value, remoteFilePath)
    
    if (result.success) {
      progressPercent.value = 100
      setTimeout(() => {
        transferring.value = false
        loadRemoteFiles()
        selectedLocal.value = ''
      }, 500)
    } else {
      alert(`上传失败：${result.error}`)
      transferring.value = false
    }
  } catch (error: any) {
    alert(`上传失败：${error.message}`)
    transferring.value = false
  }
}

/**
 * 下载文件（支持文件夹递归下载）
 */
async function downloadFile(): Promise<void> {
  if (!selectedRemote.value) {
    alert('请先选择要下载的文件或文件夹')
    return
  }
  
  const fileName = selectedRemote.value.split(/[\\/]/).pop() || ''
  
  try {
    if (!props.session) return
    const sessionId = props.session.id || props.session.host
    
    // 直接使用左侧当前文件夹路径
    const localTargetPath = `${localPath.value}/${fileName}`
    
    transferring.value = true
    progressTitle.value = '下载文件中...'
    progressPercent.value = 0
    
    let result
    // 判断是文件还是文件夹
    const selectedFile = remoteFiles.value.find(f => f.path === selectedRemote.value)
    if (selectedFile?.isDirectory) {
      // 下载文件夹
      result = await window.api.sftp.downloadFolder(sessionId, selectedRemote.value, localTargetPath)
    } else {
      // 下载文件
      result = await window.api.sftp.download(sessionId, selectedRemote.value, localTargetPath)
    }
    
    if (result.success) {
      progressPercent.value = 100
      setTimeout(() => {
        transferring.value = false
        loadLocalFiles()
        selectedRemote.value = ''
      }, 500)
    } else {
      alert(`下载失败：${result.error}`)
      transferring.value = false
    }
  } catch (error: any) {
    alert(`下载失败：${error.message}`)
    transferring.value = false
  }
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
  if (!newFolderName.value.trim()) {
    alert('请输入文件夹名称')
    return
  }
  
  if (!props.session) return
  const sessionId = props.session.id || props.session.host
  
  // 使用保存的路径，如果没有保存则使用当前 remotePath
  const basePath = fileContextMenuPath.value || remotePath.value
  const folderPath = basePath === '/' ? `/${newFolderName.value}` : `${basePath}/${newFolderName.value}`
  
  try {
    const result = await window.api.sftp.mkdir(sessionId, folderPath)
    if (result.success) {
      loadRemoteFiles()
      showNewFolderDialog.value = false
      newFolderName.value = ''
      fileContextMenuPath.value = ''
    } else {
      alert(`创建文件夹失败：${result.error}`)
    }
  } catch (error: any) {
    alert(`创建文件夹失败：${error.message}`)
  }
}

/**
 * 显示右键菜单
 */
function showContextMenu(event: MouseEvent, actionType: string): void {
  const action = contextMenuActions[actionType]
  if (!action) return
  
  currentContextMenuAction.value = {
    type: actionType,
    title: action.title,
    description: action.description
  }
  
  // 计算菜单位置
  const rect = (event.target as HTMLElement).getBoundingClientRect()
  contextMenuPosition.value = {
    x: rect.left,
    y: rect.bottom + 4 // 在按钮下方显示
  }
  
  contextMenuVisible.value = true
}

/**
 * 处理右键菜单点击
 */
function handleContextMenuAction(): void {
  if (!currentContextMenuAction.value) return
  
  const actionType = currentContextMenuAction.value.type
  
  // 执行对应的操作
  switch (actionType) {
    case 'upload':
      uploadFile()
      break
    case 'download':
      downloadFile()
      break
    case 'newFolder':
      createRemoteFolder()
      break
    case 'delete':
      deleteFile()
      break
  }
  
  // 关闭菜单
  contextMenuVisible.value = false
  currentContextMenuAction.value = null
}

/**
 * 处理本地文件列表右键菜单
 */
function handleLocalContextMenu(event: MouseEvent): void {
  const target = event.target as HTMLElement
  const fileItem = target.closest('.file-item') as HTMLElement
  
  if (!fileItem) return
  
  const path = fileItem.dataset.path
  const file = localFiles.value.find(f => f.path === path)
  
  if (!file) return
  
  // 选中该文件
  selectedLocal.value = file.path
  
  // 设置菜单位置
  const rect = fileItem.getBoundingClientRect()
  fileContextMenuPosition.value = {
    x: rect.left,
    y: rect.bottom + 4
  }
  
  // 保存当前本地路径
  fileContextMenuPath.value = localPath.value
  fileContextMenuType.value = 'local'
  fileContextMenuVisible.value = true
}

/**
 * 处理远程文件列表右键菜单
 */
function handleRemoteContextMenu(event: MouseEvent): void {
  const target = event.target as HTMLElement
  const fileItem = target.closest('.file-item') as HTMLElement
  
  if (!fileItem) return
  
  const path = fileItem.dataset.path
  const file = remoteFiles.value.find(f => f.path === path)
  
  if (!file) return
  
  // 选中该文件
  selectedRemote.value = file.path
  
  // 设置菜单位置
  const rect = fileItem.getBoundingClientRect()
  fileContextMenuPosition.value = {
    x: rect.left,
    y: rect.bottom + 4
  }
  
  // 保存当前远程路径，用于新建文件夹
  fileContextMenuPath.value = remotePath.value
  fileContextMenuType.value = 'remote'
  fileContextMenuVisible.value = true
}

/**
 * 处理文件列表右键菜单点击
 */
function handleFileContextMenuAction(action: string): void {
  // 根据类型获取选中的文件
  const selectedFile = fileContextMenuType.value === 'local'
    ? localFiles.value.find(f => f.path === selectedLocal.value)
    : remoteFiles.value.find(f => f.path === selectedRemote.value)
  
  if (!selectedFile) return
  
  switch (action) {
    case 'upload':
      // 上传选中的本地文件到远程
      if (fileContextMenuType.value === 'local') {
        uploadFile()
      }
      break
    case 'download':
      // 下载选中的远程文件到本地
      if (fileContextMenuType.value === 'remote') {
        downloadFile()
      }
      break
    case 'newFolder':
      // 在远程目录新建文件夹
      if (fileContextMenuType.value === 'remote') {
        showNewFolderDialog.value = true
        newFolderName.value = ''
      }
      break
    case 'deleteLocal':
      if (fileContextMenuType.value === 'local') {
        deleteLocalFile(selectedFile.path)
      }
      break
    case 'deleteRemote':
      if (fileContextMenuType.value === 'remote') {
        deleteRemoteFile(selectedFile.path)
      }
      break
  }
  
  // 关闭菜单
  fileContextMenuVisible.value = false
}

/**
 * 关闭右键菜单
 */
function closeContextMenu(event?: MouseEvent): void {
  // 如果事件目标是菜单内部，不关闭
  if (event) {
    const target = event.target as HTMLElement
    if (target.closest('.context-menu')) {
      return
    }
  }
  
  contextMenuVisible.value = false
  currentContextMenuAction.value = null
  fileContextMenuVisible.value = false
  fileContextMenuPath.value = ''
}

/**
 * 删除文件
 */
async function deleteFile(): Promise<void> {
  const toDelete = selectedLocal.value || selectedRemote.value
  if (!toDelete) {
    alert('请先选择要删除的文件')
    return
  }
  
  if (confirm('确定要删除选中的文件吗？')) {
    try {
      if (selectedRemote.value && props.session) {
        // 删除远程文件
        const sessionId = props.session.id || props.session.host
        const result = await window.api.sftp.delete(sessionId, selectedRemote.value)
        if (result.success) {
          loadRemoteFiles()
          selectedRemote.value = ''
        } else {
          alert(`删除失败：${result.error}`)
        }
      } else if (selectedLocal.value) {
        // 本地文件删除需要确认
        if (confirm('确定要删除本地文件吗？此操作不可恢复！')) {
          // TODO: 实现本地文件删除
          alert('本地文件删除功能待实现')
        }
      }
    } catch (error: any) {
      alert(`删除失败：${error.message}`)
    }
  }
}

/**
 * 删除本地文件
 */
async function deleteLocalFile(filePath: string): Promise<void> {
  if (confirm(`确定要删除 "${filePath}" 吗？此操作不可恢复！`)) {
    try {
      // TODO: 实现本地文件删除 API
      alert('本地文件删除功能待实现')
    } catch (error: any) {
      alert(`删除失败：${error.message}`)
    }
  }
}

/**
 * 删除远程文件
 */
async function deleteRemoteFile(filePath: string): Promise<void> {
  if (!props.session) return
  
  if (confirm(`确定要删除远程文件 "${filePath}" 吗？`)) {
    try {
      const sessionId = props.session.id || props.session.host
      const result = await window.api.sftp.delete(sessionId, filePath)
      if (result.success) {
        loadRemoteFiles()
        selectedRemote.value = ''
      } else {
        alert(`删除失败：${result.error}`)
      }
    } catch (error: any) {
      alert(`删除失败：${error.message}`)
    }
  }
}

/**
 * 本地目录向上级
 */
function localUp(): void {
  const parentPath = pathUtils.dirname(localPath.value)
  if (parentPath !== localPath.value) {
    localPath.value = parentPath
    loadLocalFiles()
  }
}

/**
 * 远程目录向上级
 */
function remoteUp(): void {
  const parentPath = pathUtils.posix.dirname(remotePath.value)
  if (parentPath !== remotePath.value) {
    remotePath.value = parentPath
    loadRemoteFiles()
  }
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return ''
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * 取消传输
 */
function cancelTransfer(): void {
  transferring.value = false
}

/**
 * 右键菜单位置样式
 */
const contextMenuStyle = computed(() => ({
  position: 'fixed' as const,
  left: `${contextMenuPosition.value.x}px`,
  top: `${contextMenuPosition.value.y}px`,
  zIndex: 10000
}))

/**
 * 文件列表右键菜单样式
 */
const fileContextMenuStyle = computed(() => ({
  position: 'fixed' as const,
  left: `${fileContextMenuPosition.value.x}px`,
  top: `${fileContextMenuPosition.value.y}px`,
  zIndex: 10000
}))

/**
 * 初始化
 */
onMounted(() => {
  // 添加全局点击事件监听，关闭右键菜单（使用捕获阶段）
  document.addEventListener('click', closeContextMenu, true)
  document.addEventListener('contextmenu', closeContextMenu, true)
  
  if (props.visible) {
    loadLocalFiles()
    loadRemoteFiles()
  }
})

/**
 * 组件卸载时清理
 */
onUnmounted(() => {
  document.removeEventListener('click', closeContextMenu, true)
  document.removeEventListener('contextmenu', closeContextMenu, true)
})

/**
 * 监听 visible 变化，加载文件列表
 */
watch(() => props.visible, async (newVal) => {
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
    
    // 连接成功后加载文件列表
    await loadLocalFiles()
    await loadRemoteFiles()
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
  background: var(--bg-color, #1e1e1e);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
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
  background: var(--bg-color-secondary, #2d2d2d);
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
  color: var(--text-color, #ffffff);
}

.header-subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-secondary, #888);
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
  color: var(--text-secondary, #888);
  cursor: pointer;
  transition: all 0.2s;
}

.header-btn:hover {
  background: var(--hover-bg, #333);
  color: var(--text-color, #fff);
}

.header-btn.close:hover {
  background: #e81123;
  color: white;
}

/* 工具栏 */
.sftp-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-color-secondary, #2d2d2d);
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--text-color-secondary, #888);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: var(--bg-color-tertiary, #333);
  color: var(--text-color, #fff);
  border-color: var(--border-color, #444);
}

.toolbar-separator {
  width: 1px;
  height: 20px;
  background: var(--border-color, #333);
  margin: 0 4px;
}

/* 主内容区 */
.sftp-body {
  flex: 1;
  display: flex;
  gap: 1px;
  background: var(--border-color, #333);
  overflow: hidden;
}

/* 文件面板 */
.file-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-color, #1e1e1e);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-color-secondary, #252526);
  border-bottom: 1px solid var(--border-color, #333);
}

.panel-path {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: var(--bg-color, #1e1e1e);
  border: 1px solid var(--border-color, #333);
  border-radius: 4px;
}

.path-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-color, #fff);
  font-size: 13px;
}

.nav-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-color, #333);
  border-radius: 4px;
  color: var(--text-color-secondary, #888);
  cursor: pointer;
  transition: all 0.2s;
}

.nav-btn:hover {
  background: var(--bg-color-tertiary, #333);
  color: var(--text-color, #fff);
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
  background: var(--bg-color-tertiary, #2a2a2a);
}

.file-item.selected {
  background: var(--primary-color-light, rgba(64, 158, 255, 0.15));
}

.file-icon {
  flex-shrink: 0;
  color: var(--text-color-secondary, #888);
}

.file-item.selected .file-icon {
  color: var(--primary-color, #409eff);
}

.file-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-color, #fff);
}

.file-size {
  font-size: 12px;
  color: var(--text-color-secondary, #666);
  min-width: 60px;
  text-align: right;
}

/* 传输进度 */
.transfer-progress {
  padding: 12px 16px;
  background: var(--bg-color-secondary, #252526);
  border-top: 1px solid var(--border-color, #333);
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
  color: var(--text-color, #fff);
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
  color: var(--text-color-secondary, #888);
  cursor: pointer;
  transition: all 0.2s;
}

.progress-close:hover {
  background: var(--bg-color-tertiary, #333);
  color: var(--text-color, #fff);
}

.progress-bar {
  height: 6px;
  background: var(--bg-color, #1e1e1e);
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
  color: var(--text-color-secondary, #888);
}

/* 状态栏 */
.sftp-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-color-secondary, #252526);
  border-top: 1px solid var(--border-color, #333);
  font-size: 12px;
}

.footer-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.footer-label {
  color: var(--text-color-secondary, #888);
}

.footer-value {
  color: var(--text-color, #fff);
  font-weight: 500;
}

.footer-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-ready {
  color: var(--text-color-secondary, #888);
}

.status-transferring {
  color: var(--primary-color, #409eff);
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
  background: var(--bg-color, #1e1e1e);
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  padding: 24px;
  min-width: 300px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.dialog-box h4 {
  margin: 0 0 16px 0;
  color: var(--text-color, #fff);
  font-size: 16px;
}

.dialog-input {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-color-secondary, #2d2d2d);
  border: 1px solid var(--border-color, #333);
  border-radius: 4px;
  color: var(--text-color, #fff);
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.dialog-input:focus {
  border-color: var(--primary-color, #0078d4);
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
  border: 1px solid var(--border-color, #333);
  background: var(--bg-color-secondary, #2d2d2d);
  color: var(--text-color, #fff);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.dialog-btn:hover {
  background: var(--bg-color-tertiary, #333);
}

.dialog-btn.cancel {
  background: transparent;
}

.dialog-btn.confirm {
  background: var(--primary-color, #0078d4);
  border-color: var(--primary-color, #0078d4);
}

.dialog-btn.confirm:hover {
  background: var(--primary-color-hover, #006abc);
}

/* 右键菜单样式 */
.context-menu {
  position: fixed;
  background: var(--bg-color, #1e1e1e);
  border: 1px solid var(--border-color, #333);
  border-radius: 6px;
  padding: 6px;
  min-width: 200px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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
  background: var(--bg-color-secondary, #2d2d2d);
}

.menu-item-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color, #fff);
  margin-bottom: 2px;
}

.menu-item-description {
  font-size: 11px;
  color: var(--text-color-secondary, #888);
  line-height: 1.3;
}
</style>
