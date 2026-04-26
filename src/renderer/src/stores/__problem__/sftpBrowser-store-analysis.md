# SftpBrowser Store 问题分析

> 文件路径: `src/renderer/src/stores/sftpBrowser.ts`

## 1. 类型安全问题

### 1.1 大量使用 `any` 类型

**严重程度**: 高

**问题描述**:
文件类型使用 `any[]`，失去类型安全保护，容易引发运行时错误。

**代码位置**:
```typescript
local: {
  localPath: string
  localFiles: any[]  // ❌ 应为 FileEntry[] 或类似类型
  localFileCount: number
}
remote: {
  remotePath: string
  remoteFiles: any[]  // ❌ 应为 RemoteFileEntry[] 或类似类型
  remoteFileCount: number
  connectionId: string
}
```

**建议修复**:
- 定义 `LocalFileEntry` 和 `RemoteFileEntry` 接口
- 或使用 `@shared/types` 中已有的文件类型

---

### 1.2 `handleLocalDblClick` 和 `handleRemoteDblClick` 事件类型不精确

**严重程度**: 中

**问题描述**:
使用 `MouseEvent` 但实际只需要 `target` 属性，且强制类型转换不安全。

**代码位置**:
```typescript
async function handleLocalDblClick(connectionId: string, event: MouseEvent, drivesPath: string): Promise<void> {
  const target = (event.target as HTMLElement).closest('.file-item')
  // ...
}
```

**建议修复**:
- 使用更精确的事件类型
- 或在组件层处理 DOM 操作，Store 只接收路径参数

---

## 2. 数据一致性问题

### 2.1 失败时静默降级到"此电脑"视图

**严重程度**: 中

**问题描述**:
`loadLocalFiles` 失败时自动切换到 `drivesPath`，但不通知用户发生了错误。

**代码位置**:
```typescript
async function loadLocalFiles(connectionId: string, drivesPath: string): Promise<void> {
  // ...
  } catch (error: any) {
    console.error('[sftpBrowser] 加载本地文件失败:', error)
    // 失败时进入此电脑视图
    state.localPath = drivesPath
    const result = await window.api.sftp.getDrives()
    if (result.success && result.data) {
      state.localFiles = result.data
      state.localFileCount = result.data.length
    }
  }
}
```

**建议修复**:
- 抛出错误让调用方处理
- 或返回错误状态：`{ success: false, error: '...' }`

---

### 2.2 `getState` 自动创建状态可能导致意外数据

**严重程度**: 低

**问题描述**:
`getState` 在找不到状态时自动创建，可能掩盖调用方传入错误 `connectionId` 的问题。

**代码位置**:
```typescript
function getState(connectionId: string) {
  if (!stateMap.value.has(connectionId)) {
    stateMap.value.set(connectionId, {
      local: { /* 默认值 */ },
      remote: { /* 默认值 */ }
    })
  }
  return stateMap.value.get(connectionId)!
}
```

**建议修复**:
- 分离 `getState`（只读）和 `getOrCreateState`（创建）
- 或在开发环境打印警告

---

## 3. 性能问题

### 3.1 `computed` 在 Store 方法中创建

**严重程度**: 高

**问题描述**:
`getLocalPath`, `getLocalFiles` 等方法每次调用都创建新的 `computed`，可能导致内存泄漏和性能问题。

**代码位置**:
```typescript
function getLocalPath(connectionId: string) {
  return computed(() => getState(connectionId).local.localPath)  // ❌ 每次调用创建新 computed
}

function getLocalFiles(connectionId: string) {
  return computed(() => getState(connectionId).local.localFiles)
}
```

**建议修复**:
- 返回普通函数，让组件自行创建 computed
- 或缓存 computed 实例

```typescript
// 方案1：返回普通函数
function getLocalPath(connectionId: string): () => string {
  return () => getState(connectionId).local.localPath
}

// 组件中使用：
// const localPath = computed(() => store.getLocalPath(connId)())
```

---

### 3.2 文件列表未做虚拟滚动优化

**严重程度**: 中

**问题描述**:
大量文件时，完整加载并渲染所有文件会导致性能问题。

**建议修复**:
- 实现虚拟滚动
- 或分页加载文件列表

---

## 4. 功能缺失

### 4.1 缺少文件排序功能

**严重程度**: 中

**问题描述**:
文件列表没有排序功能（按名称、大小、修改时间等）。

**建议修复**:
- 添加 `sortField` 和 `sortOrder` 状态
- 提供 `sortFiles(field, order)` 方法

---

### 4.2 缺少文件过滤功能

**严重程度**: 低

**问题描述**:
不支持按文件类型过滤（如只显示文件夹、只显示特定扩展名）。

**建议修复**:
- 添加 `filter` 状态
- 提供 `setFilter(filter)` 方法

---

### 4.3 缺少路径历史记录

**严重程度**: 低

**问题描述**:
没有前进/后退功能，无法快速回到之前访问的目录。

**建议修复**:
- 添加 `pathHistory: string[]` 和 `historyIndex: number`
- 提供 `navigateBack()`, `navigateForward()` 方法

---

## 5. 架构问题

### 5.1 Store 包含过多 DOM 操作逻辑

**严重程度**: 高

**问题描述**:
`handleLocalDblClick` 和 `handleRemoteDblClick` 直接操作 DOM（`event.target.closest`），违反了 Store 应只管理状态的原则。

**代码位置**:
```typescript
async function handleLocalDblClick(connectionId: string, event: MouseEvent, drivesPath: string): Promise<void> {
  const target = (event.target as HTMLElement).closest('.file-item')  // ❌ DOM 操作
  if (!target) return
  
  const path = (target as HTMLElement).dataset.path  // ❌ 读取 DOM 属性
  // ...
}
```

**建议修复**:
- 将 DOM 操作移到组件层
- Store 只接收路径参数：`navigateToDirectory(connectionId, path)`

---

### 5.2 本地和远程文件操作逻辑重复

**严重程度**: 中

**问题描述**:
本地和远程文件的操作方法（`loadLocalFiles` vs `loadRemoteFiles`）逻辑相似但分别实现，增加维护成本。

**建议修复**:
- 提取公共逻辑到辅助函数
- 或使用策略模式统一处理

---

### 5.3 `navigateRemoteUp` 依赖外部 `dirname` 函数

**严重程度**: 中

**问题描述**:
`navigateRemoteUp` 需要调用方传入 `dirname` 函数，而 `navigateLocalUp` 使用内部 API，接口不一致。

**代码位置**:
```typescript
async function navigateRemoteUp(
  connectionId: string,
  dirname: (path: string) => string  // ❌ 依赖外部传入
): Promise<void> {
  // ...
}
```

**建议修复**:
- 统一使用 `window.api.sftp.dirname()`
- 或在 Store 内部导入 `path.dirname`

---

## 6. 错误处理问题

### 6.1 错误信息未传递给用户

**严重程度**: 中

**问题描述**:
多个方法 `catch` 错误后只打印日志，不通知用户。

**建议修复**:
- 使用 `useErrorDialogStore` 显示错误
- 或返回错误对象供调用方处理

---

### 6.2 缺少加载状态管理

**严重程度**: 中

**问题描述**:
没有 `isLoading` 状态，组件无法显示加载指示器。

**建议修复**:
```typescript
const loadingStates = ref<Map<string, { local: boolean, remote: boolean }>>(new Map())

async function loadLocalFiles(connectionId: string, drivesPath: string): Promise<void> {
  getState(connectionId).loading.local = true
  try {
    // ... 加载逻辑
  } finally {
    getState(connectionId).loading.local = false
  }
}
```

---

## 总结

| 问题类型 | 数量 | 严重程度 |
|---------|------|---------|
| 类型安全 | 2 | 高/中 |
| 数据一致性 | 2 | 中/低 |
| 性能问题 | 2 | 高/中 |
| 功能缺失 | 3 | 中/低 |
| 架构问题 | 3 | 高/中 |
| 错误处理 | 2 | 中 |

**优先修复建议**:
1. 修复 `computed` 在方法中创建导致的性能问题
2. 将 DOM 操作从 Store 移到组件层
3. 定义文件类型接口替代 `any`
4. 统一本地和远程文件操作接口
