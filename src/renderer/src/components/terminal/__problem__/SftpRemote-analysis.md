# SftpRemote 组件问题分析

> 文件路径: `src/renderer/src/components/terminal/sftp/SftpRemote.vue`

## 1. 功能缺失

### 1.1 `handleDrop` 拖拽上传未完整实现

**严重程度**: 高

**问题描述**:
`handleDrop` 函数获取了文件路径后，没有触发上传操作，功能不完整。

**代码位置**:
```typescript
async function handleDrop(event: DragEvent): Promise<void> {
  isDraggingOver.value = false
  
  const dataTransfer = event.dataTransfer
  if (!dataTransfer || !dataTransfer.files || dataTransfer.files.length === 0) {
    return
  }
  
  const files = dataTransfer.files
  const filePaths: string[] = []
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
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
  // ❌ 函数结束，没有后续上传操作
}
```

**建议修复**:
```typescript
if (filePaths.length === 0) {
  console.warn('[SftpRemote] 拖拽的文件无法获取路径')
  showAlert('无法获取拖拽文件的路径', '警告')
  return
}

// 触发上传
emit('upload-batch', filePaths)
```

---

### 1.2 缺少断连后自动重连提示

**严重程度**: 低

**问题描述**:
显示断连提示后，用户需要手动右键菜单重连，没有一键重连按钮。

---

## 2. 数据流问题

### 2.1 防抖定时器未清理

**严重程度**: 中

**问题描述**:
与 `SftpLocal` 相同，`remotePathTimer` 在组件卸载时没有清理。

**建议修复**:
```typescript
import { onUnmounted } from 'vue'

onUnmounted(() => {
  if (remotePathTimer) {
    clearTimeout(remotePathTimer)
  }
})
```

---

## 3. 代码质量问题

### 3.1 `handleContextMenu` 中 `clickedFile` 类型不安全

**严重程度**: 中

**问题描述**:
与 `SftpLocal` 相同，使用 `any` 类型。

---

### 3.2 `handleClick` 中 `item` 类型不安全

**严重程度**: 低

**问题描述**:
与 `SftpLocal` 相同。

---

### 3.3 `getSelectedOrClickedPath` 函数定义位置

**严重程度**: 中

**问题描述**:
与 `SftpLocal` 相同，函数定义在回调外部但在回调内部使用。

---

## 4. 样式问题

### 4.1 对话框未使用 Teleport

**严重程度**: 中

**问题描述**:
与 `SftpLocal` 相同。

---

### 4.2 断连覆盖层可能遮挡操作

**严重程度**: 低

**问题描述**:
断连覆盖层使用 `v-if` 控制，但可能遮挡文件列表的右键菜单。

**代码位置**:
```vue
<div v-if="!props.connected" class="disconnected-overlay">
  <!-- 覆盖整个文件列表 -->
</div>
```

**建议修复**:
- 确保覆盖层不阻止右键菜单
- 或在覆盖层上提供重连按钮

---

## 5. 架构问题

### 5.1 与 `SftpLocal` 大量重复代码

**严重程度**: 中

**问题描述**:
两个组件有大量相似的代码（路径输入、文件列表、右键菜单、创建文件夹等），可以抽取为公共组件或 composable。

**建议修复**:
- 创建 `useFileBrowser` composable
- 或创建基础 `FileBrowser` 组件

---

## 总结

| 问题类型 | 数量 | 严重程度 |
|---------|------|---------|
| 功能缺失 | 2 | 高/低 |
| 数据流 | 1 | 中 |
| 代码质量 | 3 | 中/低 |
| 样式问题 | 2 | 中/低 |
| 架构问题 | 1 | 中 |

**优先修复建议**:
1. 完成 `handleDrop` 拖拽上传功能
2. 添加组件卸载时清理防抖定时器
3. 使用 Teleport 包裹对话框
4. 考虑抽取公共逻辑减少重复代码
5. 修复类型安全问题
