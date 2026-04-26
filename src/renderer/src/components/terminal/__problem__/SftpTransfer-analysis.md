# SftpTransfer 组件问题分析

> 文件路径: `src/renderer/src/components/terminal/sftp/SftpTransfer.vue`

## 1. 功能缺失

### 1.1 `handleDeleteRemoteBatch` 函数被截断

**严重程度**: 高

**问题描述**:
文件内容显示 `handleDeleteRemoteBatch` 函数描述后没有完整实现，可能功能未完成。

**代码位置**:
```typescript
/**
 * 处理批量删除远程文件/文件夹（支持混合选择）
 * 
 */
// ❌ 函数实现被截断
```

**建议修复**:
- 检查完整实现是否存在
- 如果未完成，补充实现

---

### 1.2 刷新功能依赖子组件引用

**严重程度**: 中

**问题描述**:
`refresh` 函数通过 `ref` 调用子组件的 `loadFiles` 方法，耦合度高。

**代码位置**:
```typescript
async function refresh(): Promise<void> {
  if (localPanelRef.value) {
    await localPanelRef.value.loadFiles()
  }
  if (remotePanelRef.value) {
    await remotePanelRef.value.loadFiles()
  }
}
```

**建议修复**:
- 通过 Store 触发刷新
- 或使用事件总线

---

## 2. 数据流问题

### 2.1 `currentSftpConnectionId` 回退逻辑复杂

**严重程度**: 中

**问题描述**:
连接 ID 的回退逻辑涉及多个条件，容易出错。

**代码位置**:
```typescript
const currentSftpConnectionId = computed(() => {
  return props.sftpConnectionId || (currentSession.value?.id || currentSession.value?.host || '')
})
```

**建议修复**:
- 简化逻辑，确保始终有有效的 connectionId
- 或在 props 中要求必须提供

---

### 2.2 `sftpConnected` 状态可能与 Store 不同步

**严重程度**: 中

**问题描述**:
组件内部维护 `sftpConnected` 状态，同时通过 watch 监听 Store 同步，可能出现短暂不一致。

**代码位置**:
```typescript
const sftpConnected = ref(false)

watch(
  () => {
    const connId = props.sftpConnectionId
    if (!connId) return null
    const tab = terminalStore.getTabById(connId)
    return tab?.status ?? null
  },
  (newStatus) => {
    // 同步逻辑
  }
)
```

**建议修复**:
- 直接使用 Store 的状态，不维护本地副本
- 或确保同步逻辑覆盖所有场景

---

## 3. 代码质量问题

### 3.1 大量 console.log 调试日志

**严重程度**: 中

**问题描述**:
组件中包含大量 `console.log` 调试语句，生产环境不应保留。

**代码位置**:
```typescript
console.log('[SftpTransfer] handleUploadBatch called with', paths.length, 'items:', paths)
console.log('[SftpTransfer] ✅ 批量上传完成')
console.log('[SftpTransfer] 刷新文件列表')
console.log('[SftpTransfer] ✅ 文件列表刷新完成')
// ... 多处
```

**建议修复**:
- 使用统一的日志工具，支持按环境过滤
- 或清理生产环境不需要的日志

---

### 3.2 `confirmNewFolder` 函数参数类型混乱

**严重程度**: 中

**问题描述**:
`folderName` 参数可能是 `string` 或 `Event`，类型不安全。

**代码位置**:
```typescript
async function confirmNewFolder(folderName?: string | Event): Promise<void> {
  const nameToUse = (typeof folderName === 'string' ? folderName : undefined) || newFolderName.value.trim()
  // ...
}
```

**建议修复**:
- 分开两个函数处理不同来源
- 或统一使用 ref 值

---

### 3.3 动态导入未错误处理

**严重程度**: 低

**问题描述**:
`handleDeleteLocalBatch` 中使用动态导入，但没有错误处理。

**代码位置**:
```typescript
const { deleteLocalBatch } = await import('./script/delete')
```

**建议修复**:
```typescript
try {
  const { deleteLocalBatch } = await import('./script/delete')
  // ...
} catch (error) {
  console.error('Failed to load delete module:', error)
  showAlert('加载删除模块失败')
}
```

---

## 4. 架构问题

### 4.1 组件职责过多

**严重程度**: 中

**问题描述**:
`SftpTransfer` 作为父组件，管理窗口状态、上传/下载任务、新建文件夹、删除确认等多个职责。

**建议修复**:
- 将任务管理移到 Store
- 将对话框管理移到单独的 composable

---

### 4.2 `close` 函数混合多种逻辑

**严重程度**: 低

**问题描述**:
`close` 函数同时处理断开连接、更新状态、触发事件，职责不单一。

**代码位置**:
```typescript
async function close(): Promise<void> {
  if (!props.embedded) {
    // 断开连接
    // 更新状态
  }
  emit('close')
}
```

**建议修复**:
- 拆分为 `disconnect` 和 `emitClose` 两个函数

---

## 5. 样式问题

### 5.1 对话框未使用 Teleport

**严重程度**: 中

**问题描述**:
新建文件夹对话框和确认对话框没有使用 `Teleport`。

---

## 总结

| 问题类型 | 数量 | 严重程度 |
|---------|------|---------|
| 功能缺失 | 2 | 高/中 |
| 数据流 | 2 | 中 |
| 代码质量 | 3 | 中/低 |
| 架构问题 | 2 | 中/低 |
| 样式问题 | 1 | 中 |

**优先修复建议**:
1. 检查并完成 `handleDeleteRemoteBatch` 函数实现
2. 清理调试日志
3. 简化 `currentSftpConnectionId` 回退逻辑
4. 直接使用 Store 的 `sftpConnected` 状态
5. 使用 Teleport 包裹对话框
