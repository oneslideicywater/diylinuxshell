# SftpTransfer Store 问题分析

> 文件路径: `src/renderer/src/stores/sftpTransfer.ts`

## 1. 数据一致性问题

### 1.1 `nodeIndexMap` 未使用响应式包装

**严重程度**: 高

**问题描述**:
`nodeIndexMap` 使用普通 `Map` 而非 `ref` 或 `reactive`，其变化不会触发 Vue 响应式更新。依赖此 Map 的组件可能无法及时获取最新数据。

**代码位置**:
```typescript
const nodeIndexMap = new Map<string, TransferNode>()  // ❌ 非响应式
```

**建议修复**:
```typescript
const nodeIndexMap = ref(new Map<string, TransferNode>())
// 或使用 reactive
const nodeIndexMap = reactive(new Map<string, TransferNode>())
```

---

### 1.2 `removeTask` 未清理节点索引

**严重程度**: 高

**问题描述**:
删除任务时只从任务列表移除，但未清理 `nodeIndexMap` 中对应的节点索引，导致内存泄漏和脏数据。

**代码位置**:
```typescript
function removeTask(taskId: string): void {
  const index = transferTasks.value.findIndex(t => t.id === taskId)
  if (index !== -1) {
    transferTasks.value.splice(index, 1)
    // ❌ 缺少清理 nodeIndexMap 的逻辑
  }
}
```

**建议修复**:
```typescript
function removeTask(taskId: string): void {
  const index = transferTasks.value.findIndex(t => t.id === taskId)
  if (index !== -1) {
    transferTasks.value.splice(index, 1)
    // 清理节点索引
    const prefix = `${taskId}::`
    for (const key of nodeIndexMap.keys()) {
      if (key.startsWith(prefix)) {
        nodeIndexMap.delete(key)
      }
    }
  }
}
```

---

### 1.3 `cleanupCompletedTasks` 与 `clearCompletedTasks` 逻辑重复

**严重程度**: 中

**问题描述**:
两个函数都负责清理已完成任务，但逻辑不同（一个保留 100 个，一个保留 5 个），容易混淆。

**代码位置**:
```typescript
const MAX_COMPLETED_TASKS = 100

function cleanupCompletedTasks(): void {
  // 保留 100 个
}

function clearCompletedTasks(): void {
  // 保留 5 个
}
```

**建议修复**:
- 统一为一个函数，使用参数控制保留数量
- 或明确区分用途（自动清理 vs 手动清理）

---

## 2. 性能问题

### 2.1 `mutateNode` 中大量日志输出

**严重程度**: 中

**问题描述**:
`mutateNode` 每次调用都打印详细日志，在高频更新场景（如文件传输）会严重影响性能。

**代码位置**:
```typescript
function mutateNode(taskId: string, nodeId: string, updates: Partial<TransferNode>): void {
  // ...
  console.log(
    `[sftpTransfer] 🕐 mutateNode | ` +
    `节点: ${node.name} ...` +  // 长字符串拼接
    // ...
  )
  
  // 祖先传播也打印日志
  console.log(
    `[sftpTransfer] [version= ${version.value }]🕐 祖先传播 transferBytes | ...`
  )
}
```

**建议修复**:
- 使用条件日志：`if (import.meta.env.DEV) console.log(...)`
- 或提供日志级别控制

---

### 2.2 `cleanupCompletedTasks` 多次遍历数组

**严重程度**: 低

**问题描述**:
函数内部多次调用 `filter` 和 `slice`，导致多次遍历数组。

**建议修复**:
- 一次遍历收集所有需要的信息
- 或使用更高效的数据结构

---

## 3. 类型安全问题

### 3.1 `mutateNode` 中使用 `as any` 绕过类型检查

**严重程度**: 中

**问题描述**:
使用 `(updates as any).status` 绕过类型检查，失去类型安全保护。

**代码位置**:
```typescript
if ('status' in updates && !shouldAllowNodeTransition(node, (updates as any).status, 'mutateNode')) {
  return
}
```

**建议修复**:
```typescript
if ('status' in updates && !shouldAllowNodeTransition(node, updates.status!, 'mutateNode')) {
  return
}
```

---

### 3.2 `updateNodeInTree` 同样使用 `as any`

**严重程度**: 中

**问题描述**:
与 `mutateNode` 相同的问题。

**建议修复**:
- 使用类型守卫或类型断言

---

## 4. 架构问题

### 4.1 存在两套节点更新方法

**严重程度**: 高

**问题描述**:
`mutateNode`（基于索引）和 `updateNodeStatus`（基于树遍历）功能重复，但实现和性能特征不同，容易误用。

**代码位置**:
```typescript
// 方法1：基于索引，O(1) 查找
function mutateNode(taskId: string, nodeId: string, updates: Partial<TransferNode>): void {
  const node = nodeIndexMap.get(`${taskId}::${nodeId}`)
  // ...
}

// 方法2：基于树遍历，O(n) 查找
function updateNodeStatus(taskId: string, nodeId: string, updates: Partial<TransferNode>): void {
  // 递归遍历树查找节点
  const updated = updateNodeInTree(task.root, nodeId, updates, taskId)
  // ...
}
```

**建议修复**:
- 标记 `updateNodeStatus` 为 `@deprecated`
- 或统一为一个方法

---

### 4.2 `printTree` 等调试方法暴露在生产代码中

**严重程度**: 低

**问题描述**:
`printTree`、`printNodeRecursive` 等调试方法包含 emoji 和格式化输出，不应出现在生产代码中。

**建议修复**:
- 将调试方法移到单独的 `debug.ts` 文件
- 或使用条件编译移除

---

### 4.3 `mutateAllTaskNodes` 的安全锁设计脆弱

**严重程度**: 中

**问题描述**:
使用字符串匹配（`purpose === 'delete-local'`）作为安全锁，容易被绕过或误传。

**代码位置**:
```typescript
function mutateAllTaskNodes(
  taskId: string,
  status: TransferNode['status'],
  extraFields?: Partial<TransferNode>,
  purpose?: string
): void {
  if (purpose !== 'delete-local') {
    console.warn(...)
    return
  }
}
```

**建议修复**:
- 使用 Symbol 或枚举作为权限令牌
- 或在编译时检查调用方

---

## 5. 功能缺失

### 5.1 缺少任务优先级支持

**严重程度**: 低

**问题描述**:
所有任务平等对待，无法设置优先级（如优先传输小文件）。

**建议修复**:
- 添加 `priority` 字段
- 在任务调度时考虑优先级

---

### 5.2 缺少任务暂停/恢复功能

**严重程度**: 低

**问题描述**:
只能取消任务，无法暂停和恢复传输。

**建议修复**:
- 添加 `paused` 状态
- 实现暂停/恢复逻辑

---

## 6. 响应式问题

### 6.1 `selectedTaskIds` 使用 Set 需要重新赋值触发响应式

**严重程度**: 中

**问题描述**:
`Set` 的 `add`/`delete` 方法不会触发 Vue 响应式更新，需要重新赋值。

**代码位置**:
```typescript
function toggleTaskSelection(taskId: string): void {
  if (selectedTaskIds.value.has(taskId)) {
    selectedTaskIds.value.delete(taskId)
  } else {
    selectedTaskIds.value.add(taskId)
  }
  // 触发响应式更新（Set 需要重新赋值）
  selectedTaskIds.value = new Set(selectedTaskIds.value)
}
```

**建议修复**:
- 使用 `ref<Set<string>>` 并在每次修改后重新赋值
- 或使用数组替代 Set

---

### 6.2 `getNode` 使用 `void` 技巧触发响应式不可靠

**严重程度**: 中

**问题描述**:
使用 `void transferTasks.value.length` 触发响应式依赖收集是 hack 手段，可能在某些情况下失效。

**代码位置**:
```typescript
function getNode(taskId: string, nodeId: string): TransferNode | undefined {
  // 触发 transferTasks 的响应式依赖收集（确保 Store 变化时 computed 重算）
  void transferTasks.value.length
  return nodeIndexMap.get(`${taskId}::${nodeId}`)
}
```

**建议修复**:
- 将 `nodeIndexMap` 改为响应式
- 或使用 computed 包装

---

## 7. 代码质量问题

### 7.1 空注释块

**严重程度**: 低

**问题描述**:
存在孤立的 `/** */` 注释块，可能是遗留代码。

**代码位置**:
```typescript
function initNodeIndex(taskId: string): void {
  // ...
}

/**

/**
 * 更新指定节点的状态（核心方法）
 */
```

**建议修复**:
- 删除空注释块

---

## 总结

| 问题类型 | 数量 | 严重程度 |
|---------|------|---------|
| 数据一致性 | 3 | 高/中 |
| 性能问题 | 2 | 中/低 |
| 类型安全 | 2 | 中 |
| 架构问题 | 3 | 高/中 |
| 功能缺失 | 2 | 低 |
| 响应式问题 | 2 | 中 |
| 代码质量 | 1 | 低 |

**优先修复建议**:
1. 修复 `removeTask` 未清理节点索引导致的内存泄漏
2. 将 `nodeIndexMap` 改为响应式
3. 统一或标记废弃重复的节点更新方法
4. 减少生产环境的日志输出
