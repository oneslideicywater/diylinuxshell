/**
 * SFTP 文件传输组件
 * 提供本地与服务器之间的文件传输功能（类似 Xftp）
 * @module components/session/SftpTransfer
 */

<template>
  <div v-if="props.sftpWindowVisible" class="sftp-overlay" :class="{ 'embedded-mode': props.embedded }" @click="handleOverlayClick">
    <div class="sftp-window" :class="{ 'is-maximized': isMaximized, 'embedded-mode': props.embedded }" @click.stop>
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
            <p class="header-subtitle">{{ currentSession?.name }} - {{ currentSession?.host }}:{{ currentSession?.port }}</p>
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
          v-model:local-path="localState.localPath.value"
          v-model:local-files="localState.localFiles.value"
          v-model:selected-local="localState.selectedLocal.value"
          :upload-tasks="uploadTasks"
          @local-dblclick="handleLocalDblClick"
          @upload-file="uploadFile"
          @upload-folder="uploadFolder"
          @delete-local="handleDeleteLocal"
        />

        <!-- 远程文件浏览器 -->
        <SftpRemote
          ref="remotePanelRef"
          v-model:remote-path="remoteState.remotePath.value"
          v-model:remote-files="remoteState.remoteFiles.value"
          v-model:selected-remote="remoteState.selectedRemote.value"
          :session-id="props.sessionId"
          :download-tasks="downloadTasks"
          :connection-id="currentSftpConnectionId"
          @remote-dblclick="handleRemoteDblClick"
          @download-local="downloadLocal"
          @create-folder="confirmNewFolder"
          @delete-remote="handleDeleteRemote"
          
        />
      </div>

      <!-- 状态栏 -->
      <SftpStatusContainer
        :local-file-count="localState.localFileCount.value"
        :remote-file-count="remoteState.remoteFileCount.value"
        :connection-id="currentSftpConnectionId"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { Session } from '@shared/types'
import type { TransferTask } from '@shared/types/sftp'
import SftpStatusContainer from './status/SftpStatusContainer.vue'
import SftpLocal from './SftpLocal.vue'
import SftpRemote from './SftpRemote.vue'
import { useSessionStore } from '@/stores/session'


import { uploadFolder as uploadFolderToServer, uploadFile as uploadSingleFileLocal } from './script/upload'
import { downloadFile, downloadFolder } from './script/download'
import { deleteFileOrFolder } from './script/delete'

import {
  createLocalFileState,
  initLocalDefaultDir,
  deleteLocalFile,
  type LocalFileState
} from './script/local'

import {
  createRemoteFileState,
  initRemoteDefaultDir,
  type RemoteFileState
} from './script/remote'




/**
 * Props 定义（安全改进 v2）
 * 
 * 改进说明：
 * - 旧接口：session: Session | null ← 接收完整会话对象（包含敏感信息）
 * - 新接口：sessionId: string ← 只接收会话 ID，组件自行从 SessionStore 获取非敏感信息
 * 
 * 安全优势：
 * - 会话对象不再通过 props 传递，减少暴露风险
 * - 组件按需从 Store 获取信息，遵循最小权限原则
 */
interface Props {
  /** SFTP 窗口是否可见 */
  sftpWindowVisible: boolean
  /** 会话 ID（用于从 SessionStore 获取会话信息） */
  sessionId: string
  /** 是否为嵌入式模式（true: 切换时不断开连接，false: 弹窗模式会断开） */
  embedded?: boolean
  /** SFTP 连接标识符（每个标签独立，用于建立独立的 SFTP 连接） */
  sftpConnectionId?: string
}

const props = withDefaults(defineProps<Props>(), {
  sftpWindowVisible: false,
  sessionId: '',
  embedded: false,
  sftpConnectionId: ''
})

/**
 * Session Store 实例
 * 用于根据 sessionId 获取会话信息（非敏感部分）
 */
const sessionStore = useSessionStore()

/**
 * 计算属性：当前会话对象（从 SessionStore 动态获取）
 * 只在需要时查询，不存储在组件状态中
 */
const currentSession = computed<Session | undefined>(() => {
  if (!props.sessionId) return undefined
  return sessionStore.sessions.find(s => s.id === props.sessionId)
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
 * 本地文件浏览状态（使用 local.ts 中的工厂函数初始化）
 */
const localState: LocalFileState = createLocalFileState()

/**
 * 远程文件浏览状态（使用 remote.ts 中的工厂函数初始化）
 * 
 * 安全改进（v2）：
 * - 传递 connectionId 而不是 session 对象
 * - 初始值为空字符串，会在 watch 连接成功后通过 API 使用正确的 connectionId
 */
const remoteState: RemoteFileState = createRemoteFileState(props.sftpConnectionId || '')

/**
 * 子组件引用
 */
const localPanelRef = ref<InstanceType<typeof SftpLocal> | null>(null)
const remotePanelRef = ref<InstanceType<typeof SftpRemote> | null>(null)

/**
 * 上传任务列表（由父组件统一管理）
 */
const uploadTasks = ref<TransferTask[]>([])

/**
 * 下载任务列表（由父组件统一管理）
 */
const downloadTasks = ref<TransferTask[]>([])



/**
 * ====================
 * 窗口状态
 * ====================
 */
const isMaximized = ref(false)
/** SFTP 连接状态标志，防止重复连接导致 Channel open failure */
const sftpConnected = ref(false)

/**
 * 当前 SFTP 连接标识符
 * 优先使用 props.sftpConnectionId（每个标签独立），否则回退到 session.id
 */
const currentSftpConnectionId = computed(() => {
  return props.sftpConnectionId || (currentSession.value?.id || currentSession.value?.host || '')
})


/**
 * 删除状态
 */

const deletingCurrentPath = ref('')
const deleteProgressCleanup = ref<(() => void) | null>(null)


/**
 * 新建文件夹对话框状态
 */
const showNewFolderDialog = ref(false)
const newFolderName = ref('')
const fileContextMenuPath = ref('')

/**
 * 关闭 SFTP 窗口
 * 嵌入式模式下只触发关闭事件，不断开连接（保持连接供下次切换使用）
 * 弹窗模式下会断开 SFTP 连接，释放 SSH channel
 */
async function close(): Promise<void> {
  /* 非嵌入式模式：断开后端 SFTP 连接 */
  if (!props.embedded) {
    const connectionId = currentSftpConnectionId.value
    if (connectionId && sftpConnected.value) {
      try {
        await window.api.sftp.disconnect(connectionId)
      } catch (e) {
        console.warn('[SFTP] disconnect error (non-critical):', e)
      }
    }
    sftpConnected.value = false
  }
  
  /* 嵌入式模式：只触发关闭事件，让父组件切换回 SSH 模式 */
  emit('close')
}

/**
 * 处理遮罩层点击
 * 嵌入式模式下禁用此功能（因为是全屏显示，不需要点击外部关闭）
 */
function handleOverlayClick(): void {
  /* 嵌入式模式下不处理遮罩层点击 */
  if (props.embedded) {
    return
  }
  
  close()
}

/**
 * 切换最大化
 */
function toggleMaximize(): void {
  isMaximized.value = !isMaximized.value
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
    localState.localPath.value = filePath
  }
  
  const currentFilePath = localState.localPath.value
  if (!currentFilePath) {
    console.error('[SftpTransfer] 未提供文件路径')
    alert('请先选择要上传的文件')
    return
  }

  try {
    // 调用单文件上传函数（安全架构 v4：使用 sftpConnectionId，不再传递 session 对象）
    await uploadSingleFileLocal(
      currentFilePath,
      props.sftpConnectionId,        // ✅ SFTP 连接标识符（已在 TerminalTab 初始化时建立）
      props.sessionId,               // ✅ 可选：用于 UI 显示会话信息
      remoteState.remotePath.value   // 远程目标路径
    )
    
    console.log('[SftpTransfer] 文件上传完成')
    
    // 刷新远程文件列表
    await remotePanelRef.value?.loadFiles()
    
  } catch (error: any) {
    console.error('[SftpTransfer] 文件上传失败:', error)
    alert(`上传文件失败：${error.message}`)
  }
}

/**
 * 下载文件/文件夹到本地
 * @param path 远程文件/文件夹路径（来自右键菜单选中）
 * 
 * PRD 要求：
 * - 严禁弹出文件选择对话框
 * - 下载到当前本地目录
 * - 使用统一树形组件显示进度
 */
async function downloadLocal(path: string): Promise<void> {
  console.log('[SftpTransfer] downloadLocal called with path:', path)

  if (!path) {
    console.error('[SftpTransfer] 未提供下载路径')
    alert('请先选择要下载的远程文件/文件夹')
    return
  }

  if (!currentSession.value) {
    console.error('[SftpTransfer] 会话不存在')
    alert('SSH 会话未连接')
    return
  }

  try {
    // 获取当前本地目录作为下载目标路径（PRD：严禁弹出文件选择框）
    const localPath = localState.localPath.value
    
    if (!localPath) {
      throw new Error('当前本地目录为空，无法确定下载目标位置')
    }

    console.log(`[SftpTransfer] 开始下载: ${path}`)
    console.log(`[SftpTransfer] 目标本地目录: ${localPath}`)

    // 判断是文件还是文件夹（通过查询远程路径类型）
    // 注意：这里需要判断是否为文件夹，可以尝试列出目录或根据上下文判断
    // 简化处理：先尝试作为文件夹下载，如果失败则作为文件下载
    
    // 检查选中的远程项是否为文件夹
    const selectedItem = remoteState.remoteFiles.value.find(
      (item: any) => item.path === path || item.name === path.split('/').pop()
    )
    
    if (selectedItem && (selectedItem.type === 'd' || selectedItem.isDirectory)) {
      // 文件夹下载（安全架构 v4：使用 sftpConnectionId）
      console.log('[SftpTransfer] 检测到文件夹，使用文件夹下载模式')
      await downloadFolder(
        path,
        props.sftpConnectionId,  // ✅ SFTP 连接标识符
        props.sessionId,         // ✅ 可选：用于 UI 显示
        localPath
      )
    } else {
      // 单文件下载（安全架构 v4：使用 sftpConnectionId）
      console.log('[SftpTransfer] 检测到文件，使用单文件下载模式')
      await downloadFile(
        path,
        props.sftpConnectionId,  // ✅ SFTP 连接标识符
        props.sessionId,         // ✅ 可选：用于 UI 显示
        localPath
      )
    }
    
    // 下载完成后刷新本地文件列表（PRD 要求）
    console.log('[SftpTransfer] 刷新本地文件列表...')
    await refreshLocalFiles()
    
    console.log('[SftpTransfer] ✅ 下载完成！')
    
  } catch (error: any) {
    console.error('[SftpTransfer] ❌ 下载失败:', error)
    
    // 显示错误信息给用户（PRD 要求）
    const errorMessage = error.message || '下载过程中发生未知错误'
    alert(`下载失败: ${errorMessage}`)
    
    // 可以选择重新抛出错误让上层处理
    // throw error
  }
}

/**
 * 刷新本地和远程文件列表
 */
async function refresh(): Promise<void> {
  console.log('[SftpTransfer] 刷新文件列表')
  
  try {
    // 刷新本地文件列表
    if (localPanelRef.value) {
      await localPanelRef.value.loadFiles()
    }
    
    // 刷新远程文件列表
    if (remotePanelRef.value) {
      await remotePanelRef.value.loadFiles()
    }
    
    console.log('[SftpTransfer] ✅ 文件列表刷新完成')
  } catch (error: any) {
    console.error('[SftpTransfer] 刷新文件列表失败:', error)
  }
}

/**
 * 刷新本地文件列表（下载完成后调用）
 */
async function refreshLocalFiles(): Promise<void> {
  console.log('[SftpTransfer] 刷新本地文件列表')
  
  try {
    if (localPanelRef.value) {
      await localPanelRef.value.loadFiles()
    }
    console.log('[SftpTransfer] ✅ 本地文件列表刷新完成')
  } catch (error: any) {
    console.error('[SftpTransfer] 刷新本地文件列表失败:', error)
  }
}

/**
 * 上传文件夹（递归）
 * @param folderPath 文件夹路径，必须提供（来自本地目录栏选中的文件夹）
 */
async function uploadFolder(folderPath: string): Promise<void> {
  console.log('[SftpTransfer] uploadFolder called with folderPath:', folderPath)
  
  // 如果没有提供文件夹路径，尝试使用选中的本地路径
  if (!folderPath && localState.localPath.value) {
    console.log('[SftpTransfer] No folderPath provided, using localPath:', localState.localPath.value)
    folderPath = localState.localPath.value
  }

  if (!folderPath) {
    console.error('[SftpTransfer] 未提供文件夹路径')
    alert('请先选择要上传的文件夹')
    return
  }

  try {
    // 调用新的上传函数（使用 Pinia Store 管理）
    await uploadFolderToServer(
      folderPath,
      props.sftpConnectionId,
      props.sessionId,
      remoteState.remotePath.value
    )
    
    console.log('[SftpTransfer] 文件夹上传完成')
    
    // 刷新远程文件列表
    await remotePanelRef.value?.loadFiles()
    
  } catch (error: any) {
    console.error('[SftpTransfer] 文件夹上传失败:', error)
    alert(`上传文件夹失败：${error.message}`)
  }
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
 * 确认新建文件夹（远程）
 * @param folderName 文件夹名称（来自 SftpRemote 组件的 create-folder 事件）
 */
async function confirmNewFolder(folderName?: string): Promise<void> {
  // 优先使用传入的文件夹名称，否则使用对话框中的输入值
  const nameToUse = folderName || newFolderName.value.trim()
  
  if (!nameToUse) {
    console.error('[SftpTransfer] 文件夹名称不能为空')
    return
  }
  
  // 检查 SFTP 连接是否可用
  if (!props.sftpConnectionId) {
    console.error('[SftpTransfer] SFTP 连接标识符不存在')
    alert('SFTP 连接未建立，无法创建远程文件夹')
    return
  }
  
  try {
    // ✅ 统一在当前浏览的远程目录创建新文件夹
    const remoteFolderPath = `${remoteState.remotePath.value}/${nameToUse}`.replace(/\/+/g, '/')
    console.log('[SftpTransfer] 创建远程文件夹:', remoteFolderPath)
    
    // 调用 SFTP API 创建远程目录
    const result = await window.api.sftp.mkdir(props.sftpConnectionId, remoteFolderPath)
    
    if (!result.success) {
      throw new Error(result.error || '创建远程文件夹失败')
    }
    
    console.log('[SftpTransfer] ✅ 远程文件夹创建成功:', remoteFolderPath)
    
    // 关闭对话框
    showNewFolderDialog.value = false
    newFolderName.value = ''
    
    // 刷新远程文件列表以显示新创建的文件夹
    await remotePanelRef.value?.loadFiles()
    
  } catch (error: any) {
    console.error('[SftpTransfer] ❌ 创建远程文件夹失败:', error)
    alert(`创建远程文件夹失败: ${error.message || '未知错误'}`)
  }
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
 * 处理删除本地文件
 * 
 * PRD 要求：
 * - 删除前显示确认对话框
 * - 使用 TransferTask 统一管理删除任务（与上传/下载一致）
 * - 删除完成后刷新本地文件列表
 * 
 * @param path 本地文件/文件夹路径（来自右键菜单选中）
 */
async function handleDeleteLocal(path: string): Promise<void> {
  console.log('[SftpTransfer] handleDeleteLocal called with path:', path)
  
  if (!path) {
    console.error('[SftpTransfer] 未提供删除路径')
    alert('请先选择要删除的本地文件/文件夹')
    return
  }
  
  // 获取文件名/文件夹名，用于确认对话框显示
  const fileName = path.split(/[/\\]/).pop() || path
  
  // 检查是否为目录（简单判断：路径末尾是否有分隔符或通过其他方式）
  // 这里假设 localState.selectedLocal 包含选中项的信息
  const isDirectory = false // TODO: 根据实际情况判断是否为文件夹
  
  // 显示确认对话框（PRD 要求）
  const confirmed = window.confirm(
    `确定要删除以下文件/文件夹吗？\n\n📄 ${fileName}\n\n此操作不可撤销。`
  )
  
  if (!confirmed) {
    console.log('[SftpTransfer] 用户取消删除操作')
    return
  }
  
  try {
    // 调用重构后的 deleteLocalFile 函数（使用 TransferTask + Store）
    await deleteLocalFile(
      path,
      fileName,
      isDirectory,
      currentSftpConnectionId.value, // SFTP 连接标识符（用于任务隔离）
      async () => {
        // 刷新本地文件列表的回调函数
        if (localPanelRef.value?.loadFiles) {
          await localPanelRef.value.loadFiles()
        }
      }
    )
    
    console.log('[SftpTransfer] ✅ 本地文件删除完成')
    
  } catch (error: any) {
    console.error('[SftpTransfer] 删除本地文件失败:', error)
    alert(`删除失败：${error.message}`)
  }
}

/**
 * 处理删除远程文件/文件夹
 * PRD 要求：
 * - 删除前显示确认对话框（显示待删除项列表）
 * - 使用统一树形组件显示删除进度
 * - 删除完成后刷新远程文件列表
 * @param path 远程文件/文件夹路径（来自右键菜单选中）
 */
async function handleDeleteRemote(path: string): Promise<void> {
  console.log('[SftpTransfer] handleDeleteRemote called with path:', path)

  if (!path) {
    console.error('[SftpTransfer] 未提供删除路径')
    alert('请先选择要删除的远程文件/文件夹')
    return
  }

  // ✅ 安全架构 v4：检查 sftpConnectionId 是否存在（而非 session 对象）
  if (!props.sftpConnectionId) {
    console.error('[SftpTransfer] SFTP 连接标识符不存在')
    alert('SFTP 连接未建立')
    return
  }

  try {
    // 获取文件名/文件夹名，用于确认对话框显示
    const itemName = path.split('/').pop() || path
    
    // 显示确认对话框（PRD 要求）
    const confirmed = window.confirm(
      `确定要删除以下文件/文件夹吗？\n\n📄 ${itemName}\n\n此操作不可撤销。`
    )
    
    if (!confirmed) {
      console.log('[SftpTransfer] 用户取消删除操作')
      return
    }
    
    console.log(`[SftpTransfer] 开始删除: ${path}`)

    // 执行删除操作（安全架构 v4：使用 sftpConnectionId，不再传递 session 对象）
    await deleteFileOrFolder(
      path,
      props.sftpConnectionId,  // ✅ SFTP 连接标识符
      props.sessionId          // ✅ 可选：用于 UI 显示
    )
    
    // 删除完成后刷新远程文件列表（PRD 要求）
    console.log('[SftpTransfer] 刷新远程文件列表...')
    await refreshRemoteFiles()
    
    console.log('[SftpTransfer] ✅ 删除完成！')
    
  } catch (error: any) {
    console.error('[SftpTransfer] ❌ 删除失败:', error)
    
    // 显示错误信息给用户（PRD 要求）
    const errorMessage = error.message || '删除过程中发生未知错误'
    alert(`删除失败: ${errorMessage}`)
  }
}

/**
 * 刷新远程文件列表（删除完成后调用）
 */
async function refreshRemoteFiles(): Promise<void> {
  console.log('[SftpTransfer] 刷新远程文件列表')
  
  try {
    if (remotePanelRef.value) {
      await remotePanelRef.value.loadFiles()
    }
    console.log('[SftpTransfer] ✅ 远程文件列表刷新完成')
  } catch (error: any) {
    console.error('[SftpTransfer] 刷新远程文件列表失败:', error)
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
onMounted(async () => {
  // 添加全局点击事件监听，关闭右键菜单（使用捕获阶段）
  document.addEventListener('click', closeContextMenu, true)
  document.addEventListener('contextmenu', closeContextMenu, true)
  
  // 监听删除进度
  if (currentSession.value) {
    const connectionId = currentSftpConnectionId.value
    deleteProgressCleanup.value = window.api.sftp.onDeleteProgress((data) => {
      if (data.sessionId === connectionId) {
        deletingCurrentPath.value = data.currentPath
      }
    })
  }
  
  // 初始化本地默认目录（用户 home 目录）
  await initLocalDefaultDir(localState)
  
  // 初始化远程默认目录（SSH 登录用户的默认工作目录）
  initRemoteDefaultDir(remoteState)
  
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
 * 嵌入式模式下 sftpWindowVisible 初始即为 true，需要 immediate 触发连接
 * 
 * 安全改进：
 * - 使用 nextTick 确保操作在正确的生命周期时机执行
 * - 添加完善的空值检查和错误边界处理
 * - 避免在组件初始化阶段触发可能导致卸载的操作
 * - 全局 try-catch 防止未捕获异常导致 Vue 更新错误
 */
watch(() => props.sftpWindowVisible, async (newVal) => {
  try {
    if (newVal) {
      /* 已连接则跳过，防止重复连接导致 Channel open failure */
      if (sftpConnected.value) {
        return
      }

      // 检查 session 是否存在（延迟检查以等待 SessionStore 数据加载）
      if (!currentSession.value) {
        console.warn('[SFTP] Session 尚未准备好，稍后重试')
        // 延迟重试一次，避免组件初始化时 SessionStore 还未加载数据
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // 再次检查（此时 SessionStore 应该已经加载完成）
        if (!currentSession.value) {
          console.error('[SFTP] Session 仍然无效')
          // 不再调用 close()，避免在 immediate watch 中触发组件卸载
          // 而是设置一个标记让父组件处理
          sftpConnected.value = false
          return
        }
      }
      
      console.log('[SFTP] 开始连接, connectionId:', currentSftpConnectionId.value, 'sessionId:', props.sessionId)
      
      // 连接 SFTP（安全改进：只传 ID，配置从主进程 Store 获取）
      try {
        const connectionId = currentSftpConnectionId.value
        const sessionId = props.sessionId || currentSession.value?.id || currentSession.value?.host || ''
        
        // 检查必要参数
        if (!connectionId || !sessionId) {
          console.error('[SFTP] 缺少连接参数:', { connectionId, sessionId })
          alert('会话信息无效')
          sftpConnected.value = false
          return
        }
        
        // 检查 API 是否存在
        if (!window.api?.sftp) {
          console.error('SFTP API not available')
          alert('SFTP 功能不可用')
          sftpConnected.value = false
          return
        }
        
        // ✅ 新接口：只传两个 ID，不再传递敏感信息（密码等）
        const result = await window.api.sftp.connect(connectionId, sessionId)
        
        if (!result.success) {
          console.error('SFTP 连接失败:', result.error)
          alert(`SFTP 连接失败：${result.error}`)
          sftpConnected.value = false
          return
        }
        
        console.log('[SFTP] 连接成功, connectionId:', connectionId)
        sftpConnected.value = true
      } catch (error: any) {
        console.error('SFTP 连接失败:', error)
        alert(`SFTP 连接失败：${error.message}`)
        sftpConnected.value = false
        return
      }
      
      // 连接成功后，等待子组件准备好再加载文件列表
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // 使用 nextTick 确保 DOM 更新完成后再操作子组件
      await nextTick()
      
      // 调用子组件的 loadFiles 方法（添加安全检查）
      try {
        if (localPanelRef.value?.loadFiles) {
          await localPanelRef.value.loadFiles()
        }
        if (remotePanelRef.value?.loadFiles) {
          await remotePanelRef.value.loadFiles()
        }
      } catch (error: any) {
        console.warn('[SFTP] 加载文件列表时发生非关键错误:', error)
        // 文件加载失败不应该阻止连接状态
      }
    }
  } catch (error: any) {
    // 全局异常捕获，防止未捕获的异常导致 Vue 组件更新错误
    console.error('[SFTP] Watch 回调中发生未预期错误:', error)
    // 不抛出异常，避免中断 Vue 的更新周期
  }
}, { immediate: true })
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

/* 嵌入式模式：覆盖弹窗样式，全屏显示 */
.sftp-overlay.embedded-mode {
  position: relative;
  top: auto;
  left: auto;
  right: auto;
  bottom: auto;
  background: transparent;
  z-index: auto;
  width: 100%;
  height: 100%;
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

/* 嵌入式模式：窗口全屏显示 */
.sftp-window.embedded-mode {
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  border-radius: 0;
  box-shadow: none;
  margin: 0;
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
