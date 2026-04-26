/**
 * SFTP 文件传输组件
 * 提供本地与服务器之间的文件传输功能（类似 Xftp）
 * @module components/session/SftpTransfer
 */

<template>
  <div
    v-if="props.sftpWindowVisible"
    class="sftp-overlay"
    :class="{ 'embedded-mode': props.embedded }"
    @click="handleOverlayClick"
  >
    <div
      class="sftp-window"
      :class="{ 'is-maximized': isMaximized, 'embedded-mode': props.embedded }"
      @click.stop
    >
      <!-- 窗口头部 -->
      <div class="sftp-header">
        <div class="header-left">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            class="header-icon"
          >
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
            <p class="header-subtitle">
              {{ currentSession?.name }} - {{ currentSession?.host }}:{{ currentSession?.port }}
            </p>
          </div>
        </div>
        <div class="header-actions">
          <button
            class="header-btn"
            title="刷新"
            @click="refresh"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M14 8a6 6 0 11-1.17-3.54"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
              <path
                d="M14 2v4h-4"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          </button>
          <button
            class="header-btn"
            title="最大化/还原"
            @click="toggleMaximize"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
            >
              <rect
                x="2"
                y="2"
                width="12"
                height="12"
                stroke="currentColor"
                stroke-width="1.5"
              />
            </svg>
          </button>
          <button
            class="header-btn close"
            title="关闭"
            @click.stop="close"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              style="pointer-events: none;"
            >
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- 主内容区：双栏布局 -->
      <div class="sftp-body">
        <!-- 新建文件夹输入对话框 -->
        <div
          v-if="showNewFolderDialog"
          class="dialog-overlay"
          @click="cancelNewFolder"
        >
          <div
            class="dialog-box"
            @click.stop
          >
            <h4>新建文件夹</h4>
            <input
              v-model="newFolderName"
              type="text"
              class="dialog-input"
              placeholder="请输入文件夹名称"
              autofocus
              @keyup.enter="confirmNewFolder"
            >
            <div class="dialog-buttons">
              <button
                class="dialog-btn cancel"
                @click="cancelNewFolder"
              >
                取消
              </button>
              <button
                class="dialog-btn confirm"
                @click="confirmNewFolder"
              >
                确定
              </button>
            </div>
          </div>
        </div>

        <!-- 本地文件浏览器 -->
        <SftpLocal
          ref="localPanelRef"
          :upload-tasks="uploadTasks"
          :connection-id="currentSftpConnectionId"
          @local-dblclick="handleLocalDblClick"
          @upload-batch="handleUploadBatch"
          @delete-batch="handleDeleteLocalBatch"
        />

        <!-- 远程文件浏览器 -->
        <SftpRemote
          ref="remotePanelRef"
          :session-id="props.sessionId"
          :download-tasks="downloadTasks"
          :connection-id="currentSftpConnectionId"
          :connected="sftpConnected"
          @remote-dblclick="handleRemoteDblClick"
          @download-batch="handleDownloadBatch"
          @create-folder="confirmNewFolder"
          @delete-batch="handleDeleteRemoteBatch"
        />
      </div>

      <!-- 状态栏 -->
      <SftpStatusContainer
        :local-file-count="sftpBrowserStore.getLocalFileCount(currentSftpConnectionId).value"
        :remote-file-count="sftpBrowserStore.getRemoteFileCount(currentSftpConnectionId).value"
        :connection-id="currentSftpConnectionId"
      />
    </div>

    <!-- 统一确认对话框（替代 window.confirm） -->
    <ConfirmDialog
      :visible="confirmDialogVisible"
      :title="confirmDialogConfig.title"
      :message="confirmDialogConfig.message"
      :is-warning="confirmDialogConfig.isWarning"
      @confirm="handleConfirmDialogConfirm"
      @cancel="handleConfirmDialogCancel"
      @close="handleConfirmDialogCancel"
    />

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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { Session } from '@shared/types'
import type { TransferTask } from '@shared/types/sftp'
import SftpStatusContainer from './status/SftpStatusContainer.vue'
import SftpLocal from './SftpLocal.vue'
import SftpRemote from './SftpRemote.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import AlertDialog from '@/components/common/AlertDialog.vue'
import { useSessionStore } from '@/stores/session'
import { useTerminalStore } from '@/stores/terminal'


import { uploadBatch } from './script/upload'
import { downloadBatch } from './script/download'

import { useSftpBrowserStore } from '@/stores/sftpBrowser'




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
const terminalStore = useTerminalStore()

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
 * SFTP 文件浏览器状态 Store（按连接 ID 隔离，同时管理 Local 和 Remote）
 * 替代原来的 useSftpLocalStore + createRemoteFileState()
 */
const sftpBrowserStore = useSftpBrowserStore()

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
 * 监听终端 Store 中的标签页状态变化，同步 sftpConnected
 * 解决：TerminalTab 右键菜单断开后，SftpTransfer 本地状态未更新的问题
 */
watch(
  () => {
    const connId = props.sftpConnectionId
    if (!connId) return null
    const tab = terminalStore.getTabById(connId)
    return tab?.status ?? null
  },
  (newStatus) => {
    if (newStatus === null) return
    const shouldBeConnected = newStatus === 'connected' || newStatus === 'connecting'
    if (sftpConnected.value !== shouldBeConnected) {
      console.log(`[SftpTransfer] Store状态同步: ${sftpConnected.value} → ${shouldBeConnected} (store=${newStatus})`)
      sftpConnected.value = shouldBeConnected
    }
  },
  { immediate: true }
)

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

/**
 * 新建文件夹对话框状态
 */
const showNewFolderDialog = ref(false)
const newFolderName = ref('')
const fileContextMenuPath = ref('')

/** 统一确认对话框状态（替代 window.confirm） */
const confirmDialogVisible = ref(false)
const confirmDialogConfig = ref({ title: '', message: '', isWarning: true })
let confirmDialogResolve: ((confirmed: boolean) => void) | null = null

/**
 * 显示统一确认对话框，返回 Promise（用户点击确定 resolve(true)，取消 resolve(false)）
 * @param title - 对话框标题
 * @param message - 对话框内容
 * @param isWarning - 是否警告样式（红色按钮）
 */
function showConfirmDialog(title: string, message: string, isWarning = true): Promise<boolean> {
  return new Promise((resolve) => {
    confirmDialogResolve = resolve
    confirmDialogConfig.value = { title, message, isWarning }
    confirmDialogVisible.value = true
  })
}

/** 用户点击确定 */
function handleConfirmDialogConfirm(): void {
  confirmDialogVisible.value = false
  confirmDialogResolve?.(true)
  confirmDialogResolve = null
}

/** 用户点击取消或关闭 */
function handleConfirmDialogCancel(): void {
  confirmDialogVisible.value = false
  confirmDialogResolve?.(false)
  confirmDialogResolve = null
}

/** 统一提示对话框状态（替代 alert） */
const alertDialogVisible = ref(false)
const alertDialogConfig = ref({ title: '提示', message: '', isError: false })

/**
 * 显示统一提示对话框（替代 alert，异步非阻塞）
 * @param message - 提示内容
 * @param title - 标题（默认"提示"）
 * @param isError - 是否错误样式（红色按钮）
 */
function showAlert(message: string, title = '提示', isError = false): void {
  alertDialogConfig.value = { title, message, isError }
  alertDialogVisible.value = true
}

/** 用户关闭提示对话框 */
function handleAlertDialogClose(): void {
  alertDialogVisible.value = false
}

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
    terminalStore.updateTabStatus(props.sftpConnectionId, 'disconnected')
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
 * 上传文件夹（递归）
 * @param folderPath 文件夹路径，必须提供（来自本地目录栏选中的文件夹）
 */
/**
 * 批量上传处理函数（支持混合选择文件和文件夹）
 * @param paths 选中的文件/文件夹路径数组（来自 SftpLocal 组件的多选）
 */
async function handleUploadBatch(paths: string[]): Promise<void> {
  console.log('[SftpTransfer] handleUploadBatch called with', paths.length, 'items:', paths)

  if (!paths || paths.length === 0) {
    console.error('[SftpTransfer] 未提供批量上传路径')
    showAlert('请先选择要上传的文件/文件夹')
    return
  }

  try {
    // 调用批量上传函数（安全架构 v4：使用 sftpConnectionId）
    await uploadBatch(
      paths,
      props.sftpConnectionId,
      props.sessionId,
      sftpBrowserStore.getRemotePath(props.sftpConnectionId).value
    )

    console.log('[SftpTransfer] ✅ 批量上传完成')

    // 刷新远程文件列表
    await remotePanelRef.value?.loadFiles()

  } catch (error: any) {
    console.error('[SftpTransfer] ❌ 批量上传失败:', error)
    showAlert(`批量上传失败：${error.message}`, '错误', true)
  }
}

/**
 * 处理批量下载（支持混合选择文件和文件夹）
 * @param paths - 远程文件/文件夹路径数组（来自 SftpRemote 组件的多选）
 */
async function handleDownloadBatch(paths: string[]): Promise<void> {
  console.log('[SftpTransfer] handleDownloadBatch called with', paths.length, 'items:', paths)

  if (!paths || paths.length === 0) {
    console.error('[SftpTransfer] 未提供批量下载路径')
    showAlert('请先选择要下载的文件/文件夹')
    return
  }

  try {
    await downloadBatch(
      paths,
      props.sftpConnectionId,
      props.sessionId,
      sftpBrowserStore.getState(props.sftpConnectionId || currentSftpConnectionId.value).local.localPath
    )

    console.log('[SftpTransfer] ✅ 批量下载完成')

    // 下载完成后刷新本地文件列表（新下载的文件已保存到本地）
    await localPanelRef.value?.loadFiles()
  } catch (error: any) {
    console.error('[SftpTransfer] ❌ 批量下载失败:', error)
    showAlert(`批量下载失败: ${error.message}`, '错误', true)
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
async function confirmNewFolder(folderName?: string | Event): Promise<void> {
  // 如果传入的是 Event 对象，忽略它，使用输入框的值
  const nameToUse = (typeof folderName === 'string' ? folderName : undefined) || newFolderName.value.trim()
  
  if (!nameToUse) {
    console.error('[SftpTransfer] 文件夹名称不能为空')
    return
  }
  
  // 检查 SFTP 连接是否可用
  if (!props.sftpConnectionId) {
    console.error('[SftpTransfer] SFTP 连接标识符不存在')
    showAlert('SFTP 连接未建立，无法创建远程文件夹')
    return
  }
  
  try {
    // ✅ 统一在当前浏览的远程目录创建新文件夹
    const remoteFolderPath = `${sftpBrowserStore.getRemotePath(props.sftpConnectionId).value}/${nameToUse}`.replace(/\/+/g, '/')
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
    showAlert(`创建远程文件夹失败: ${error.message || '未知错误'}`, '错误', true)
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
 * 处理批量删除本地文件/文件夹（支持混合选择）
 * 
 * ✅ 新架构：每个选中的文件/文件夹创建独立的 TransferTask
 * - 选择 N 个项目 → 创建 N 个 TransferTask
 * - 每个任务独立管理进度、状态、取消操作
 * - 符合用户期望的"多任务"模式（与 uploadBatch/downloadBatch 对称）
 * 
 * @param paths - 本地文件/文件夹路径数组（来自 SftpLocal 组件的多选）
 */
async function handleDeleteLocalBatch(paths: string[]): Promise<void> {
  console.log('[SftpTransfer] handleDeleteLocalBatch called with', paths.length, 'items:', paths)

  if (!paths || paths.length === 0) {
    console.error('[SftpTransfer] 未提供批量删除路径')
    showAlert('请先选择要删除的本地文件/文件夹')
    return
  }

  // 调用主进程接口获取文件名列表（使用 Node.js path.basename，屏蔽系统差异）
  const fileNamesResults = await Promise.all(paths.map(p => window.api.sftp.basename(p)))
  const fileNames = fileNamesResults.map((r, i) => r.data || paths[i])
  const confirmMessage = `确定要删除以下 ${paths.length} 个文件/文件夹吗？\n\n${fileNames.map((name, i) => `${i + 1}. 📄 ${name}`).join('\n')}\n\n此操作不可撤销。`

  const confirmed = await showConfirmDialog('确认删除', confirmMessage)
  if (!confirmed) {
    console.log('[SftpTransfer] 用户取消批量删除操作')
    return
  }

  try {
    console.log('[delete-local] 开始批量删除:', paths.length, '个文件/文件夹')
    
    const { deleteLocalBatch } = await import('./script/delete')
    
    await deleteLocalBatch(paths, currentSftpConnectionId.value)

    if (localPanelRef.value?.loadFiles) {
      await localPanelRef.value.loadFiles()
    }
    
    console.log(`[SftpTransfer] 🎉 批量本地文件删除完成！`)

  } catch (error: any) {
    console.error('[SftpTransfer] 批量删除本地文件失败:', error)
    showAlert(`批量删除失败：${error.message}`, '错误', true)
  }
}

/**
 * 处理批量删除远程文件/文件夹（支持混合选择）
 * 
 * ✅ 新架构：每个选中的文件/文件夹创建独立的 TransferTask
 * - 选择 N 个项目 → 创建 N 个 TransferTask
 * - 每个任务独立管理进度、状态、取消操作
 * - 符合用户期望的"多任务"模式（与 uploadBatch/downloadBatch 对称）
 * 
 * @param paths - 远程文件/文件夹路径数组（来自 SftpRemote 组件的多选）
 */
async function handleDeleteRemoteBatch(paths: string[]): Promise<void> {
  console.log('[SftpTransfer] handleDeleteRemoteBatch called with', paths.length, 'items:', paths)

  if (!paths || paths.length === 0) {
    console.error('[SftpTransfer] 未提供批量删除路径')
    showAlert('请先选择要删除的远程文件/文件夹')
    return
  }

  if (!props.sftpConnectionId) {
    console.error('[SftpTransfer] SFTP 连接标识符不存在')
    showAlert('SFTP 连接未建立，无法执行删除操作')
    return
  }

  // 调用主进程接口获取文件名列表（使用 Node.js path.basename，屏蔽系统差异）
  const fileNamesResults = await Promise.all(paths.map(p => window.api.sftp.basename(p)))
  const fileNames = fileNamesResults.map((r, i) => r.data || paths[i])
  const confirmMessage = `确定要删除以下 ${paths.length} 个文件/文件夹吗？\n\n${fileNames.map((name, i) => `${i + 1}. 📄 ${name}`).join('\n')}\n\n此操作不可撤销。`

  const confirmed = await showConfirmDialog('确认删除', confirmMessage)
  if (!confirmed) {
    console.log('[SftpTransfer] 用户取消批量删除操作')
    return
  }

  try {
    console.log('[delete-remote] 开始批量删除:', paths.length, '个文件/文件夹')
    
    const { deleteRemoteBatch } = await import('./script/delete')
    
    await deleteRemoteBatch(paths, props.sftpConnectionId, props.sessionId)

    // 删除完成后刷新远程文件列表
    if (remotePanelRef.value?.loadFiles) {
      await remotePanelRef.value.loadFiles()
    }
    
    console.log(`[SftpTransfer] 🎉 批量远程文件删除完成！`)

  } catch (error: any) {
    console.error('[SftpTransfer] 批量删除远程文件失败:', error)
    showAlert(`批量删除失败：${error.message}`, '错误', true)
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
  
  // 初始化本地默认目录（用户 home 目录）
  if (props.sftpConnectionId) {
    await sftpBrowserStore.initLocalDefaultDir(props.sftpConnectionId)
  }
  
  // 初始化远程默认目录（SSH 登录用户的默认工作目录）
  sftpBrowserStore.initRemoteDefaultDir(props.sftpConnectionId)
  
  // 注意：文件列表加载移到 watch 中，等待子组件准备好后再调用
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
          showAlert('会话信息无效', '错误', true)
          sftpConnected.value = false
          return
        }
        
        // 检查 API 是否存在
        if (!window.api?.sftp) {
          console.error('SFTP API not available')
          showAlert('SFTP 功能不可用', '错误', true)
          sftpConnected.value = false
          return
        }
        
        // ✅ 新接口：只传两个 ID，不再传递敏感信息（密码等）
        const result = await window.api.sftp.connect(connectionId, sessionId)
        
        if (!result.success) {
          console.error('SFTP 连接失败:', result.error)
          showAlert(`SFTP 连接失败：${result.error}`, '错误', true)
          sftpConnected.value = false
          return
        }
        
        console.log('[SFTP] 连接成功, connectionId:', connectionId)
        sftpConnected.value = true
        terminalStore.updateTabStatus(props.sftpConnectionId, 'connected')
      } catch (error: any) {
        console.error('SFTP 连接失败:', error)
        showAlert(`SFTP 连接失败：${error.message}`, '错误', true)
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
