# 通用对话框组件使用文档

> 记录项目中所有通用对话框组件的使用关系，确保统一 UI 风格。

---

## 组件概览

| 组件 | 文件路径 | 用途 | 替代 |
|------|---------|------|------|
| **AlertDialog** | `components/common/AlertDialog.vue` | 单按钮提示对话框（仅"确定"） | `alert()` |
| **ConfirmDialog** | `components/common/ConfirmDialog.vue` | 双按钮确认对话框（"确定"+"取消"） | `window.confirm()` |
| **ErrorDialog** | `components/common/ErrorDialog.vue` | 连接错误对话框（带重试/编辑操作） | — |
| **GlobalContextMenu** | `components/common/GlobalContextMenu.vue` | 全局右键菜单（多菜单项） | — |

---

## AlertDialog 使用详情

### 功能说明
- 单按钮模式，仅显示「确定」按钮
- 支持 `isError` 属性切换警告样式（红色按钮）
- 替代原生 `alert()`

### 使用方式

```typescript
// 引入组件
import AlertDialog from '@/components/common/AlertDialog.vue'

// 模板绑定
<AlertDialog
  :visible="alertDialogVisible"
  :title="alertDialogConfig.title"
  :message="alertDialogConfig.message"
  :is-error="alertDialogConfig.isError"
  @confirm="handleAlertDialogClose"
  @close="handleAlertDialogClose"
/>

// 状态管理
const alertDialogVisible = ref(false)
const alertDialogConfig = ref({ title: '提示', message: '', isError: false })

function showAlert(message: string, title = '提示', isError = false): void {
  alertDialogConfig.value = { title, message, isError }
  alertDialogVisible.value = true
}

function handleAlertDialogClose(): void {
  alertDialogVisible.value = false
}
```

### 使用组件清单

| 组件文件 | 使用场景 | 调用示例 |
|---------|---------|---------|
| **SftpTransfer.vue** | 上传/下载/删除失败提示、前置校验、SFTP 连接错误 | `showAlert('批量上传失败：xxx', '错误', true)` |
| **SftpRemote.vue** | 拖拽文件无法获取路径 | `showAlert('无法获取拖拽文件的路径', '警告')` |
| **SessionSidebarContainer.vue** | 分组删除/保存失败、会话保存失败 | `showAlert(errorMessage, '错误', true)` |

### 纯脚本文件处理

以下 `.ts` 脚本文件无法直接使用 Vue 组件，采用 **throw Error + 上层 catch showAlert** 模式：

| 脚本文件 | 原调用 | 处理方式 |
|---------|-------|---------|
| `sftp/script/remote.ts` | 6 处 `alert()` | 全部改为 `throw new Error()` |
| `sftp/script/local.ts` | 3 处 `alert()` | 全部改为 `throw new Error()` |

调用链路：
```
script/remote.ts 或 script/local.ts
  → throw new Error('xxx')
    → SftpTransfer.vue catch 块
      → showAlert(error.message, '错误', true)
```

---

## ConfirmDialog 使用详情

### 功能说明
- 双按钮模式：「取消」+「确定」
- 支持 `isWarning` 属性切换警告样式（红色确定按钮）
- 返回 Promise，支持 `await`
- 替代原生 `window.confirm()`

### 使用方式

```typescript
// 引入组件
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

// 模板绑定
<ConfirmDialog
  :visible="confirmDialogVisible"
  :title="confirmDialogConfig.title"
  :message="confirmDialogConfig.message"
  :is-warning="confirmDialogConfig.isWarning"
  @confirm="handleConfirmDialogConfirm"
  @cancel="handleConfirmDialogCancel"
  @close="handleConfirmDialogCancel"
/>

// Promise 封装
let confirmDialogResolve: ((confirmed: boolean) => void) | null = null

async function showConfirmDialog(title: string, message: string, isWarning = true): Promise<boolean> {
  return new Promise((resolve) => {
    confirmDialogResolve = resolve
    confirmDialogConfig.value = { title, message, isWarning }
    confirmDialogVisible.value = true
  })
}

function handleConfirmDialogConfirm(): void {
  confirmDialogVisible.value = false
  confirmDialogResolve?.(true)
  confirmDialogResolve = null
}

function handleConfirmDialogCancel(): void {
  confirmDialogVisible.value = false
  confirmDialogResolve?.(false)
  confirmDialogResolve = null
}

// 调用示例
const confirmed = await showConfirmDialog('确认删除', '确定要删除吗？')
if (!confirmed) return // 用户点击了取消
```

### 使用组件清单

| 组件文件 | 使用场景 |
|---------|---------|
| **SftpTransfer.vue** | 批量删除本地/远程文件前的二次确认 |

---

## ErrorDialog 使用详情

### 功能说明
- 连接专用错误对话框
- 带「重试连接」和「编辑会话」操作按钮
- 通过 `useErrorDialogStore` 全局状态管理

### 使用组件清单

| 组件文件 | 使用场景 |
|---------|---------|
| **SessionSidebarContainer.vue** | SSH 连接失败时展示 |

---

## GlobalContextMenu 使用详情

### 功能说明
- 全局唯一右键菜单（通过 Store 管理）
- 支持菜单项显隐过滤 (`visible` 属性)
- 多个组件共享同一菜单实例

### 使用组件清单

| 组件文件 | 菜单项 |
|---------|-------|
| **TerminalTab.vue** | 复制会话 / 断开会话 / 重连会话 |
| **SessionItem.vue** | 添加会话 / 连接 / 编辑 / 复制 / 删除 / 审查元素 |
| **GroupHeader.vue** | 添加会话 / 新建子分组 / 编辑分组 / 删除分组 / 审查元素 |
| **SftpLocal.vue** | 新建文件夹 / 刷新 / 上传 / 删除 |
| **SftpRemote.vue** | 下载 / 新建文件夹 / 刷新 / 删除 |
| **SessionSidebarContainer.vue** | 新建分组 / 新建会话 |
| **XTerminal.vue** | （空菜单，预留扩展） |

---

## 迁移记录

| 日期 | 变更内容 |
|------|---------|
| 2026-04-20 | 创建 AlertDialog 组件，替代全部 28 处 `alert()` |
| 2026-04-20 | SftpTransfer 集成 ConfirmDialog，替代 2 处 `window.confirm()` |
| 2026-04-20 | script/remote.ts 6 处 alert → throw Error |
| 2026-04-20 | script/local.ts 3 处 alert → throw Error |
| 2026-04-20 | SessionSidebarContainer: `confirm()` → ConfirmDialog（删除会话）|
| 2026-04-20 | SessionSidebarContainer: showLevelLimitAlert 改用 AlertDialog（语义修正）|
