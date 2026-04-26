# SftpSelection Store 问题分析

> 文件路径: `src/renderer/src/stores/sftpSelection.ts`

## 1. 类型安全问题

### 1.1 `rangeSelect` 使用 `any[]` 类型

**严重程度**: 中

**问题描述**:
`rangeSelect` 方法的 `allFiles` 参数使用 `any[]`，依赖 `pathExtractor` 函数提取路径，类型不安全。

**代码位置**:
```typescript
function rangeSelect(
  connectionId: string,
  currentPath: string,
  allFiles: any[],  // ❌ 应为泛型或具体类型
  pathExtractor: (item: any) => string
): void {
  // ...
}
```

**建议修复**:
```typescript
function rangeSelect<T>(
  connectionId: string,
  currentPath: string,
  allFiles: T[],
  pathExtractor: (item: T) => string
): void {
  // ...
}
```

---

## 2. 数据一致性问题

### 2.1 `toggleFileSelection` 直接修改数组后重新赋值

**严重程度**: 中

**问题描述**:
先 `splice`/`push` 修改原数组，再创建新数组赋值给 Map。如果其他代码持有原数组引用，会看到不一致的状态。

**代码位置**:
```typescript
function toggleFileSelection(connectionId: string, path: string): void {
  const currentFiles = getSelectedFiles(connectionId)
  const index = currentFiles.indexOf(path)

  if (index > -1) {
    currentFiles.splice(index, 1)  // ❌ 修改原数组
  } else {
    currentFiles.push(path)        // ❌ 修改原数组
  }

  selectionMap.value.set(connectionId, [...currentFiles])  // 创建新数组
}
```

**建议修复**:
```typescript
function toggleFileSelection(connectionId: string, path: string): void {
  const currentFiles = getSelectedFiles(connectionId)
  const index = currentFiles.indexOf(path)

  if (index > -1) {
    selectionMap.value.set(connectionId, currentFiles.filter((_, i) => i !== index))
  } else {
    selectionMap.value.set(connectionId, [...currentFiles, path])
  }
}
```

---

### 2.2 `rangeSelect` 可能产生意外选择

**严重程度**: 低

**问题描述**:
范围选择时，如果 `lastSelectedPath` 在 `allFiles` 中已被删除（如文件被移动），会回退到只选择当前项。

**代码位置**:
```typescript
const lastIndex = allFiles.findIndex(item => pathExtractor(item) === lastSelectedPath)

if (lastIndex === -1 || currentIndex === -1) {
  // 未找到对应项，直接选中当前项
  setSelectedFiles(connectionId, [currentPath])
  return
}
```

**建议修复**:
- 打印警告日志
- 或抛出错误让调用方处理

---

## 3. 功能缺失

### 3.1 缺少全选/取消全选功能

**严重程度**: 中

**问题描述**:
没有一键全选或取消全选的功能，用户操作效率低。

**建议修复**:
```typescript
function selectAll(connectionId: string, allPaths: string[]): void {
  setSelectedFiles(connectionId, [...allPaths])
}

function clearAllSelection(connectionId: string): void {
  clearSelection(connectionId)
}
```

---

### 3.2 缺少选择状态持久化

**严重程度**: 低

**问题描述**:
刷新页面后选择状态丢失，用户需要重新选择。

**建议修复**:
- 将选择状态保存到 localStorage（按连接 ID）
- 启动时恢复选择状态

---

### 3.3 缺少选择数量限制

**严重程度**: 低

**问题描述**:
用户可以选择任意数量的文件，可能导致后续操作（如删除、传输）性能问题。

**建议修复**:
- 添加 `MAX_SELECTION_COUNT` 常量
- 超过限制时显示警告

---

## 4. 性能问题

### 4.1 `getSelectedFiles` 每次创建新数组

**严重程度**: 低

**问题描述**:
`getSelectedFiles` 在未选中时返回空数组 `[]`，每次调用都创建新对象。

**代码位置**:
```typescript
function getSelectedFiles(connectionId: string): string[] {
  return selectionMap.value.get(connectionId) || []  // ❌ 每次创建新数组
}
```

**建议修复**:
```typescript
const EMPTY_ARRAY: string[] = []

function getSelectedFiles(connectionId: string): string[] {
  return selectionMap.value.get(connectionId) || EMPTY_ARRAY
}
```

---

### 4.2 `rangeSelect` 遍历效率

**严重程度**: 低

**问题描述**:
`rangeSelect` 使用 `findIndex` 两次查找索引，在大量文件时性能较差。

**建议修复**:
- 如果 `allFiles` 已排序，可使用二分查找
- 或建立路径 → 索引的映射

---

## 5. 架构问题

### 5.1 只支持本地文件选择

**严重程度**: 中

**问题描述**:
Store 名称和注释都表明只管理"本地"文件选择（`selectedLocals`），但实际数据结构是通用的。如果未来需要支持远程文件选择，需要新建 Store。

**建议修复**:
- 重命名为 `useSftpFileSelectionStore`
- 或添加 `side: 'local' | 'remote'` 参数

---

### 5.2 缺少选择变化事件

**严重程度**: 低

**问题描述**:
其他组件无法监听选择状态变化，需要轮询或手动检查。

**建议修复**:
- 使用 Pinia 的 `$onAction` 监听
- 或提供 `onSelectionChange` 回调

---

## 6. 用户体验问题

### 6.1 缺少选择反馈

**严重程度**: 低

**问题描述**:
用户选择文件后，没有视觉反馈显示已选择的数量。

**建议修复**:
- 添加 `selectedCount` computed 属性
- 在 UI 显示"已选择 X 个文件"

---

## 总结

| 问题类型 | 数量 | 严重程度 |
|---------|------|---------|
| 类型安全 | 1 | 中 |
| 数据一致性 | 2 | 中/低 |
| 功能缺失 | 3 | 中/低 |
| 性能问题 | 2 | 低 |
| 架构问题 | 2 | 中/低 |
| 用户体验 | 1 | 低 |

**优先修复建议**:
1. 修复 `toggleFileSelection` 直接修改数组的问题
2. 添加全选/取消全选功能
3. 使用泛型改进 `rangeSelect` 类型安全
4. 使用常量空数组避免重复创建
