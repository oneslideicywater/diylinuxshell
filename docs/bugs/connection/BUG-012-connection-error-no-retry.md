# BUG-012: 连接失败后用户无法重新输入密码

## 问题描述

### 现象
当SSH连接失败（如认证失败）后，用户无法方便地重新输入密码或修改会话配置。用户需要：
1. 手动找到会话列表
2. 右键点击会话项
3. 选择"编辑"
4. 重新输入密码

而且编辑时，密码字段被清空了（这是出于安全考虑），用户每次都需要重新输入密码，但没有提示用户连接失败的原因。

### 预期行为
连接失败后，应该：
1. 显示错误对话框，告知用户失败原因
2. 提供"重新输入密码"和"编辑会话"选项
3. 点击"重新输入密码"或"编辑会话"后，自动打开编辑表单
4. 用户可以修改密码或其他配置后重试连接

## 问题原因

### 根本原因
连接失败后的错误处理不够友好，缺乏用户交互机制。

### 技术分析
1. **错误处理简单**: 连接失败后，只是在终端显示错误信息，并更新标签页状态为 'error'
2. **缺乏交互**: 没有提供方便的方式让用户重新输入密码
3. **用户体验差**: 用户需要手动导航到会话列表，找到对应的会话，右键编辑

### 代码位置
- `src/renderer/src/components/session/SessionList.vue` - 会话连接处理
- `src/renderer/src/components/terminal/TerminalTab.vue` - 标签页连接处理

## 解决方案

### 方案选择
创建全局错误对话框组件，使用 Pinia Store 管理状态，提供友好的错误提示和重试机制。

### 方案优势
1. ✅ 全局统一管理，任何组件都可以显示错误对话框
2. ✅ 用户友好的错误提示
3. ✅ 提供快捷的重试和编辑选项
4. ✅ 符合最佳实践，使用 Pinia 管理状态

## 实现步骤

### 1. 创建错误对话框 Store

**文件**: `src/renderer/src/stores/errorDialog.ts`

```typescript
/**
 * 错误对话框状态管理 Store
 * 管理全局错误对话框的显示状态
 */
export const useErrorDialogStore = defineStore('errorDialog', () => {
  // 对话框显示状态
  const visible = ref(false)
  
  // 错误标题
  const title = ref('连接失败')
  
  // 错误信息
  const message = ref('')
  
  // 会话ID
  const sessionId = ref('')
  
  // 是否显示重试按钮
  const showRetry = ref(true)
  
  // 是否显示编辑按钮
  const showEdit = ref(true)

  /**
   * 显示错误对话框
   */
  function showError(
    errorTitle: string,
    errorMessage: string,
    errorSessionId: string,
    options?: { showRetry?: boolean; showEdit?: boolean }
  ): void {
    title.value = errorTitle
    message.value = errorMessage
    sessionId.value = errorSessionId
    showRetry.value = options?.showRetry ?? true
    showEdit.value = options?.showEdit ?? true
    visible.value = true
  }

  /**
   * 关闭错误对话框
   */
  function closeError(): void {
    visible.value = false
    // 重置状态
  }

  return {
    visible,
    title,
    message,
    sessionId,
    showRetry,
    showEdit,
    showError,
    closeError
  }
})
```

### 2. 创建错误对话框组件

**文件**: `src/renderer/src/components/common/ErrorDialog.vue`

```vue
<template>
  <div v-if="visible" class="error-dialog-overlay" @click.self="handleClose">
    <div class="error-dialog">
      <!-- 标题 -->
      <div class="dialog-header">
        <h3>连接失败</h3>
        <button class="close-btn" @click="handleClose">×</button>
      </div>

      <!-- 错误信息 -->
      <div class="dialog-body">
        <div class="error-icon">⚠️</div>
        <div class="error-message">
          <p class="error-title">{{ title }}</p>
          <p class="error-detail">{{ message }}</p>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="dialog-footer">
        <button class="btn cancel" @click="handleClose">关闭</button>
        <button v-if="showRetry" class="btn retry" @click="handleRetry">
          重新输入密码
        </button>
        <button v-if="showEdit" class="btn edit" @click="handleEdit">
          编辑会话
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useErrorDialogStore } from '@/stores/errorDialog'
import { useSessionStore } from '@/stores/session'

const errorDialogStore = useErrorDialogStore()
const sessionStore = useSessionStore()

// 使用 store 中的状态
const visible = computed(() => errorDialogStore.visible)
const title = computed(() => errorDialogStore.title)
const message = computed(() => errorDialogStore.message)
const sessionId = computed(() => errorDialogStore.sessionId)
const showRetry = computed(() => errorDialogStore.showRetry)
const showEdit = computed(() => errorDialogStore.showEdit)

const handleClose = (): void => {
  errorDialogStore.closeError()
}

const handleRetry = (): void => {
  const sid = sessionId.value
  if (sid) {
    const session = sessionStore.sessions.find(s => s.id === sid)
    if (session) {
      emit('retry', sid)
      emit('edit', sid)
    }
  }
  handleClose()
}

const handleEdit = (): void => {
  const sid = sessionId.value
  if (sid) {
    emit('edit', sid)
  }
  handleClose()
}
</script>
```

### 3. 修改 SessionList.vue

**修改点**:
1. 导入 `useErrorDialogStore`
2. 在连接失败时调用 `errorDialogStore.showError()`
3. 添加错误对话框组件到模板

```typescript
// 连接失败时显示错误对话框
catch (error: unknown) {
  console.error('Failed to connect:', error)
  
  // 更新标签页状态为错误
  const tab = terminalStore.tabs.find(t => t.sessionId === session.id)
  if (tab) {
    terminalStore.updateTabStatus(tab.id, 'error')
  }
  
  // 显示错误对话框
  const errorMessage = error instanceof Error ? error.message : String(error)
  errorDialogStore.showError('连接失败', errorMessage, session.id)
}
```

### 4. 修改 TerminalTab.vue

**修改点**:
1. 导入 `useErrorDialogStore`
2. 在连接失败和重连失败时调用 `errorDialogStore.showError()`
3. 添加错误对话框组件到模板

```typescript
// 复制会话失败时
catch (error: unknown) {
  console.error('Failed to connect:', error)
  terminalStore.updateTabStatus(newTab.id, 'error')
  
  // 显示错误对话框
  const errorMessage = error instanceof Error ? error.message : String(error)
  errorDialogStore.showError('连接失败', errorMessage, session.id)
}

// 重连失败时
catch (error: unknown) {
  console.error('Failed to reconnect:', error)
  terminalStore.updateTabStatus(props.tab.id, 'error')
  
  // 显示错误对话框
  const errorMessage = error instanceof Error ? error.message : String(error)
  errorDialogStore.showError('重连失败', errorMessage, props.tab.sessionId)
}
```

### 5. 修改 Home.vue

**修改点**:
1. 添加全局错误对话框组件
2. 监听错误对话框的 `edit` 事件，打开编辑表单

```vue
<template>
  <AppLayout @add-session="showSessionForm = true" @edit-session="handleEditSession" @open-settings="handleOpenSettings" />
  
  <!-- 会话表单对话框 -->
  <SessionForm
    v-if="showSessionForm"
    :session="editingSession"
    @close="handleCloseSessionForm"
    @save="handleSaveSession"
  />
  
  <!-- 全局错误对话框 -->
  <ErrorDialog
    @close="handleCloseErrorDialog"
    @retry="handleRetryFromError"
    @edit="handleEditFromError"
  />
</template>

<script setup lang="ts">
import { useErrorDialogStore } from '@/stores/errorDialog'
import ErrorDialog from '@/components/common/ErrorDialog.vue'

const errorDialogStore = useErrorDialogStore()

/**
 * 从错误对话框中编辑会话
 */
const handleEditFromError = (sessionId: string): void => {
  const session = sessionStore.sessions.find(s => s.id === sessionId)
  if (session) {
    handleEditSession(session)
  }
}
</script>
```

## 工作原理

1. **错误捕获**: 当连接失败时，捕获错误并调用 `errorDialogStore.showError()`
2. **状态更新**: Store 更新错误信息、会话ID等状态，并设置 `visible = true`
3. **对话框显示**: ErrorDialog 组件监听 store 状态，自动显示错误对话框
4. **用户交互**: 用户可以点击"重新输入密码"或"编辑会话"
5. **打开表单**: 发送 `edit` 事件，Home.vue 接收事件并打开编辑表单
6. **修改配置**: 用户修改密码或其他配置后保存
7. **重试连接**: 用户可以重新尝试连接

## 测试计划

### 测试用例
1. 创建会话时输入错误密码，验证错误对话框显示
2. 点击"重新输入密码"，验证编辑表单打开
3. 修改密码后保存，验证可以重新连接
4. 连接成功后，验证错误对话框不再显示
5. 点击"编辑会话"，验证编辑表单打开

### 测试文件
- `e2e/connection-error.e2e.spec.ts` - 连接错误处理测试用例

## 修复验证

### 验证步骤
1. 启动应用
2. 创建新会话，输入错误的密码
3. 尝试连接，观察错误对话框显示
4. 点击"重新输入密码"，验证编辑表单打开
5. 修改密码后保存，验证可以重新连接

### 预期结果
✅ 连接失败时显示错误对话框  
✅ 错误信息清晰明了  
✅ 提供"重新输入密码"和"编辑会话"选项  
✅ 点击按钮后自动打开编辑表单  
✅ 用户可以修改配置后重试连接  

## 相关文档

- [PRD - 会话管理](../PRD.md#会话管理)
- [Phase1 PRD - 会话管理](../plan/phase1/prd.md#功能列表)

## 备注

### 改进建议
1. 可以考虑添加"自动重试"功能，在一定时间后自动重试连接
2. 可以考虑保存错误日志，方便用户查看历史错误
3. 可以考虑添加"复制错误信息"功能，方便用户反馈问题

### 安全考虑
- 密码字段在编辑时被清空，这是出于安全考虑
- 错误信息不包含敏感信息（如密码）
- 会话ID只在内部使用，不暴露给用户
