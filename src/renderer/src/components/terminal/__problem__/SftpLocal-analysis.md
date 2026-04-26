# SftpLocal 组件问题分析

> 文件路径: `src/renderer/src/components/terminal/sftp/SftpLocal.vue`

## 1. 数据流问题

### 1.1 `getSelectedOrClickedPath` 函数定义位置错误

**严重程度**: 中

**问题描述**:
`getSelectedOrClickedPath` 函数定义在 `contextMenuStore.showContextMenu` 回调内部，作用域混乱。

**代码位置**:
```typescript
contextMenuStore.showContextMenu(menuOwnerId, { x, y }, menuItems, (action: string) => {
  // ...
})

/**
 * 获取当前选中的路径列表（优先使用多选，否则使用点击的文件）
 */
function getSelectedOrClickedPath(clickedFile: any): string[] {  // ❌ 在回调外部定义
  return selectedLocals.value.length > 0 
    ? [...selectedLocals.value] 
    : (clickedFile ? [clickedFile.path] : [])
}

contextMenuStore.showContextMenu(menuOwnerId, { x, y }, menuItems, (action: string) => {
    switch (action) {
      case 'upload':
        emit('upload-batch', getSelectedOrClickedPath(clickedFile))  // ❌ 使用外部函数
        break
```

**建议修复**:
- 将函数移到组件顶层作用域
- 或在回调内部定义

---

### 1.2 防抖定时器未清理

**严重程度**: 中

**问题描述**:
`localPathTimer` 在组件卸载时没有清理，可能导致内存泄漏。

**代码位置**:
```typescript
let localPathTimer: ReturnType<typeof setTimeout> | null = null

const localPathValue = computed<string>({
  set: (value: string) => {
    localPathTimer = setTimeout(() => {
      // ...
    }, 300)
  }
})

// ❌ onUnmounted 中没有清理
```

**建议修复**:
```typescript
import { onUnmounted } from 'vue'

onUnmounted(() => {
  if (localPathTimer) {
    clearTimeout(localPathTimer)
  }
})
```

---

## 2. 功能缺失

### 2.1 拖拽上传未实现

**严重程度**: 低

**问题描述**:
组件没有拖拽上传功能，而 `SftpRemote` 有。

---

## 3. 代码质量问题

### 3.1 `handleContextMenu` 中 `clickedFile` 类型不安全

**严重程度**: 中

**问题描述**:
`clickedFile` 使用 `any` 类型，缺少类型安全。

**代码位置**:
```typescript
let clickedFile: any = null  // ❌ any 类型
```

**建议修复**:
- 使用正确的文件项类型

---

### 3.2 `handleClick` 中 `item` 类型不安全

**严重程度**: 低

**问题描述**:
`rangeSelect` 回调中使用 `any` 类型。

**代码位置**:
```typescript
sftpSelectionStore.rangeSelect(
  props.connectionId,
  path,
  localFiles.value,
  (item: any) => item.path  // ❌ any 类型
)
```

---

### 3.3 重复的 `loadFiles` 调用

**严重程度**: 低

**问题描述**:
`handlePathEnter` 和 `handleUp` 都调用 `loadFiles`，但 `handlePathEnter` 中先设置路径再加载，可能重复。

---

## 4. 样式问题

### 4.1 对话框样式未使用 Teleport

**严重程度**: 中

**问题描述**:
创建文件夹对话框没有使用 `Teleport`，可能被父元素的 `overflow: hidden` 裁剪。

**代码位置**:
```vue
<div
  v-if="createFolderDialogVisible"
  class="dialog-overlay"
  @click.self="closeCreateFolderDialog"
>
  <!-- ❌ 没有 Teleport -->
</div>
```

**建议修复**:
```vue
<Teleport to="body">
  <div v-if="createFolderDialogVisible" class="dialog-overlay">
    <!-- ... -->
  </div>
</Teleport>
```

---

## 总结

| 问题类型 | 数量 | 严重程度 |
|---------|------|---------|
| 数据流 | 2 | 中 |
| 功能缺失 | 1 | 低 |
| 代码质量 | 3 | 中/低 |
| 样式问题 | 1 | 中 |

**优先修复建议**:
1. 修复 `getSelectedOrClickedPath` 函数位置
2. 添加组件卸载时清理防抖定时器
3. 使用 Teleport 包裹对话框
4. 修复类型安全问题
