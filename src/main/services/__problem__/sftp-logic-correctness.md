# SFTP 上传/下载/删除逻辑正确性分析

> 分析文件:
>
> - 主进程: [sftp.ts](../sftp.ts)
> - 渲染进程: [download.ts](../../renderer/src/components/terminal/sftp/script/download.ts)、[upload.ts](../../renderer/src/components/terminal/sftp/script/upload.ts)、[delete.ts](../../renderer/src/components/terminal/sftp/script/delete.ts)
> - 工具函数: [utils.ts](../../renderer/src/components/terminal/sftp/script/utils.ts)
>   分析日期: 2026-04-25

***

## 一、下载逻辑

### ✅ 正确部分

1. **两阶段设计合理**：先扫描远程目录树 → 再逐个下载文件
2. **取消机制完善**：在关键节点都检查了 `isTaskCancelled()`
3. **进度回调机制**：主进程每写入一个 chunk 就上报进度，前端监听更新
4. **空文件处理**：[sftp.ts:L216-L230](../sftp.ts#L216-L230) 对空文件做了特殊处理，触发最后一次进度回调

### ❌ 逻辑问题

#### 问题1：文件夹 size 字段始终为 0 **~~位置~~**~~:~~ [~~download.ts:L186-L260~~](../../renderer/src/components/terminal/sftp/script/download.ts#L186-L260)

> **核实结果：不存在**（2026-04-25）
>
> `mutateNode` 函数通过 `deltaBytes` 自动向祖先链传播 `transferredBytes`，文件夹节点的累加已由 Store 层正确处理。
> 参见 [sftpTransfer.ts:L304-L345](../../renderer/src/stores/sftpTransfer.ts#L304-L345)

***

#### 问题2：进度回调的 `nodeId` 匹配依赖 IPC 层正确传递 **~~位置~~**~~:~~ [~~download.ts:L90-L108~~](../../renderer/src/components/terminal/sftp/script/download.ts#L90-L108)

> **核实结果：不存在**（2026-04-25）
>
> IPC 层正确提取了 `node.id` 作为 `nodeId` 传递给前端：
>
> - Service: `onProgress(speed, transferredBytes, taskId, node)` → 传入完整 node 对象
> - IPC: `nodeId: node.id` → 正确提取 → [ipc/sftp.ts:L107-L112](../../main/ipc/sftp.ts#L107-L112)
> - Preload: 完整透传 `nodeId` 字段 → [preload/index.ts:L225-L232](../../preload/index.ts#L225-L232)
> - Renderer: `data.nodeId === node.id` → 正确匹配

***

#### 问题3：单文件下载路径拼接缺少分隔符 **~~位置~~**~~:~~ [~~download.ts:L663~~](../../renderer/src/components/terminal/sftp/script/download.ts#L663)

> **核实结果：存在，但影响有限**（2026-04-25）
>
> - **问题代码**：[download.ts:L684](../../renderer/src/components/terminal/sftp/script/download.ts#L684) `scanningNode.localPath` 使用字符串拼接 `${localBasePath}${fileName}`
> - **实际影响**：`scanningNode` 仅用于扫描阶段 UI 占位显示，不影响实际下载。实际下载使用的是 `scanRemoteTree` 返回的 `ipcRoot`，其 `localPath` 使用了正确的 `path.join`（[sftp.ts:L956](../sftp.ts#L956)）
> - **严重程度降级**：高 → 低（UI 显示问题，不影响功能）

***

## 二、上传逻辑

### ✅ 正确部分

1. **扫描本地文件树**：[sftp.ts:L734-L876](../sftp.ts#L734-L876) 递归扫描本地目录，生成完整 TransferNode 树
2. **递归上传逻辑正确**：[upload.ts:L144-L236](../../renderer/src/components/terminal/sftp/script/upload.ts#L144-L236) 先创建远程目录 → 递归子节点 → 标记完成
3. **空文件夹处理**：有专门的 `else if (node.isDirectory)` 分支处理空文件夹

### ❌ 逻辑问题

#### 问题4：上传失败时进度监听器未清理 **~~位置~~**~~:~~ [~~upload.ts:L33-L119~~](../../renderer/src/components/terminal/sftp/script/upload.ts#L33-L119)

> **核实结果：存在**（2026-04-25）
>
> - **问题代码**：[upload.ts:L87-L89](../../renderer/src/components/terminal/sftp/script/upload.ts#L87-L89) `cleanupProgress()` 只在成功时调用
> - **对比**：[delete.ts:L113-L115](../../renderer/src/components/terminal/sftp/script/delete.ts#L113-L115) 使用了 `finally` 块确保清理
> - **影响**：上传失败时，进度监听器不会被清理，多次失败后可能导致内存泄漏

***

#### 问题5：上传无背压控制，可能导致内存溢出 **~~位置~~**~~:~~ [~~sftp.ts:L393-L430~~](../sftp.ts#L393-L430)

> **核实结果：存在**（2026-04-25）
>
> - **问题代码**：[sftp.ts:L393-L425](../sftp.ts#L393-L425) `readStream.on('data')` 持续触发，SFTP `write` 异步回调不阻塞读取
> - **对比下载**：[downloadFile](../sftp.ts#L220-L260) 使用递归 `readChunk()` 模式，写完才读下一个（天然背压）
> - **风险**：网络慢时大量 write 请求堆积、position 变量竞态条件、大文件内存溢出

***

## 三、删除逻辑

### ✅ 正确部分

1. **从叶子节点开始删除**：[delete.ts:L140-L172](../../renderer/src/components/terminal/sftp/script/delete.ts#L140-L172) 先递归删除所有子节点，最后删除父目录
2. **进度回调用** **`finally`** **清理**：[delete.ts:L88](../../renderer/src/components/terminal/sftp/script/delete.ts#L88)
3. **主进程删除逻辑完整**：[sftp.ts:L570-L660](../sftp.ts#L570-L660) 区分文件和目录，目录递归删除后 `rmdir`

### ❌ 逻辑问题

#### 问题6：删除循环中缺少取消检查 ✅ 已修复

**位置**: [delete.ts:L148-L157](../../renderer/src/components/terminal/sftp/script/delete.ts#L148-L157)

```typescript
for (const child of node.children) {
  // 检查任务是否已被取消（与 upload/download 保持一致的取消机制）
  if (isTaskCancelled(taskId, `停止删除剩余子项: ${node.name}`)) {
    break
  }

  await deleteFolderContent(child, sftpConnectionId, taskId)
}
```

**问题**: 对比 [upload.ts:L177-L183](../../renderer/src/components/terminal/sftp/script/upload.ts#L177-L183) 和 [download.ts:L210-L214](../../renderer/src/components/terminal/sftp/script/download.ts#L210-L214)，删除循环中**没有检查** **`isTaskCancelled()`**。

**影响**: 用户取消删除任务后，仍会继续删除剩余文件，无法中途停止。

**核实结果**: **存在，已修复 (BUG-048)**

**建议**: 每个循环迭代前检查：

```typescript
for (const child of node.children) {
  if (isTaskCancelled(taskId)) break
  await deleteFolderContent(child, sftpConnectionId, taskId)
}
```

***

#### 问题7：删除进度只有 0% 和 100% ✅ 已修复

**位置**: [sftp.ts:L613-L653](../sftp.ts#L613-L653)

```typescript
// 修复前：只有开始(0%)和完成(100%)
if (onProgress) {
  onProgress(0, node.size || 0, taskId, node)  // speed=0, transferredBytes=size
}

// 修复后：每个子项完成后上报中间进度
for (let i = 0; i < validEntries.length; i++) {
  await this.deleteFile(taskId, childNode, onProgress)
  
  // 每删除完一个子项，上报父节点中间进度
  if (onProgress && totalChildren > 0 && node.size) {
    const completedRatio = (i + 1) / totalChildren
    const intermediateBytes = Math.floor(node.size * completedRatio)
    onProgress(0, intermediateBytes, taskId, node)
  }
}
```

**问题**: 删除操作只有开始（0%）和完成（100%）两个状态。对于**大目录**，前端会长时间卡在 0%，然后突然跳到 100%。

对比前端 [delete.ts:L68-L72](../../renderer/src/components/terminal/sftp/script/delete.ts#L68-L72) 的计算：

```typescript
const progress = node.size > 0 ? Math.round((data.transferredBytes / node.size) * 100) : ...
```

**影响**: 删除大目录时，用户看不到中间进度，体验差。

**核实结果**: **存在，已修复 (BUG-050)**

**建议**: 每删除一个子文件就上报一次进度，累加 `transferredBytes`。

***

#### 问题8：`deleteFileByPath` 没有进度上报 ✅ 已修复

**位置**: [sftp.ts:L702-L770](../sftp.ts#L702-L770)

```typescript
// 修复前：没有任何 onProgress 调用
private async deleteFileByPath(taskId, remotePath, parentNode, onProgress?) {
  // ... 删除逻辑
  // 没有调用 onProgress
}

// 修复后：完整的进度上报链路
private async deleteFileByPath(taskId, remotePath, parentNode, onProgress?) {
  // 开始时上报 0%
  if (onProgress) { onProgress(0, 0, taskId, parentNode) }
  
  // 目录循环中每完成一个子项，上报中间进度
  for (let i = 0; i < validEntries.length; i++) {
    await this.deleteFileByPath(taskId, childPath, parentNode, onProgress)
    if (onProgress) { 
      const completedRatio = (i + 1) / totalChildren
      onProgress(0, Math.floor(parentNode.size * completedRatio), taskId, parentNode) 
    }
  }
  
  // 完成时上报 100%（文件 unlink 或目录 rmdir）
  if (onProgress) { onProgress(0, parentNode.size || 0, taskId, parentNode) }
}
```

**问题**: 回退删除路径时（子节点不在 TransferNode 树中），完全没有调用 `onProgress`，前端收不到任何进度更新。

**影响**: 如果走回退路径，前端进度条不会更新。

**核实结果**: **存在，已修复 (BUG-051)**

***

#### 问题9：删除任务一直处于 pending 状态

**位置**: [delete.ts:L370-L485](../../renderer/src/components/terminal/sftp/script/delete.ts#L370-L485)

**核实结果：存在**（2026-04-25）

---

##### 问题链路追踪

**1. 任务创建阶段**（[delete.ts:L370-L375](../../renderer/src/components/terminal/sftp/script/delete.ts#L370-L375)）

```typescript
const task = createTransferTask({
  type: 'delete',
  sftpConnectionId: sftpConnectionId,
  sessionId: sessionId,
  totalBytes: 0
})
// createTransferTask 默认 status: 'pending'
```

此时任务状态 = **`pending`** ✅

---

**2. 扫描完成阶段**（[delete.ts:L426-L434](../../renderer/src/components/terminal/sftp/script/delete.ts#L426-L434)）

```typescript
// 更新根节点状态为传输中
sftpTransferStore.mutateNode(task.id, ipcRoot.id, {
  status: 'transferring',  // ← 只更新了节点状态
  totalFiles: delScanResult.totalFiles || 0,
  size: delScanResult.totalBytes || 0,
  startTime: Date.now()
})
```

**问题**：这里只更新了**节点**的 `status`，没有更新**任务**的 `status`。

对比下载逻辑 [download.ts:L620-L622](../../renderer/src/components/terminal/sftp/script/download.ts#L620-L622)：
```typescript
// 下载逻辑有这行：
sftpTransferStore.updateTaskStatus(task.id, 'transferring')  // ← 删除逻辑缺失！
```

此时任务状态 = **`pending`** ❌（未改变）

---

**3. 执行循环阶段**（[delete.ts:L478-L485](../../renderer/src/components/terminal/sftp/script/delete.ts#L478-L485)）

```typescript
for (let i = 0; i < createdTasks.length; i++) {
  const task = createdTasks[i]
  
  sftpTransferStore.updateTaskRoot(task.id, {
    startTime: Date.now()  // ← 只更新了 startTime
  })
  
  try {
    await deleteFolderContent(task.root!, sftpConnectionId, task.id)
```

**问题**：执行循环开始前，**没有调用** `updateTaskStatus(task.id, 'transferring')`。

此时任务状态 = **`pending`** ❌（仍未改变）

---

**4. `deleteFolderContent` 内部的状态转换逻辑**（[delete.ts:L137-L172](../../renderer/src/components/terminal/sftp/script/delete.ts#L137-L172)）

```typescript
if (node.isDirectory && node.children && node.children.length > 0) {
  // 检查任务状态：如果当前是 pending，则更新为 transferring
  const currentTask = sftpTransferStore.getTask(taskId)
  if (currentTask && currentTask.status === 'pending') {
    sftpTransferStore.updateTaskStatus(taskId, 'transferring')
  }
  // ... 递归删除子节点
} else if (node.isDirectory) {
  // 空目录：直接删除，没有状态转换逻辑
  await deleteSingleItem(node, sftpConnectionId, taskId)
} else if (!node.isDirectory) {
  // 文件：直接删除，没有状态转换逻辑
  await deleteSingleItem(node, sftpConnectionId, taskId)
}
```

**关键问题**：
- **文件夹（有子节点）**：会触发状态转换 ✅
- **空目录**：不会触发状态转换 ❌
- **单文件**：不会触发状态转换 ❌

---

##### 场景分析

| 删除对象 | 进入的分支 | 是否转换任务状态 | 最终任务状态 |
|---------|-----------|----------------|-------------|
| 文件夹（有子节点） | `if (node.isDirectory && node.children...)` | ✅ 是 | `transferring` → `completed` |
| 空目录 | `else if (node.isDirectory)` | ❌ 否 | **`pending`**（卡住） |
| 单文件 | `else if (!node.isDirectory)` | ❌ 否 | **`pending`**（卡住） |

---

##### 根本原因总结

1. **扫描完成后**：只更新了节点状态，没有更新任务状态（对比下载逻辑缺失 `updateTaskStatus`）
2. **执行循环开始前**：没有显式将任务状态改为 `transferring`
3. **`deleteFolderContent` 内部**：只有"有子节点的文件夹"分支有状态转换逻辑，**单文件和空目录分支完全缺失**

**受影响场景**：
- 删除单个文件 → 任务永远停在 `pending`
- 删除空目录 → 任务永远停在 `pending`
- 删除有内容的文件夹 → 正常（因为进入了有状态转换的分支）

---

## 四、问题汇总

| 编号  | 模块 | 问题                       | 严重程度  | 影响           |
| --- | -- | ------------------------ | ----- | ------------ |
| 问题1 | 下载 | 文件夹 transferredBytes 未累加 | 中     | 前端进度显示不准确    |
| 问题2 | 下载 | nodeId 匹配依赖 IPC 层实现      | 中     | 进度回调可能不触发    |
| 问题3 | 下载 | 单文件路径拼接缺少分隔符             | **高** | 下载到错误路径      |
| 问题4 | 上传 | 失败时不清理进度监听器              | 中     | 内存泄漏         |
| 问题5 | 上传 | 无背压控制                    | **高** | 大文件内存溢出/文件损坏 |
| 问题6 | 删除 | 循环中缺少取消检查                | **高** | 无法取消删除任务     |
| 问题7 | 删除 | 进度只有 0% 和 100%           | 低     | 用户体验差        |
| 问题8 | 删除 | deleteFileByPath 无进度上报   | 中     | 回退路径进度丢失     |

***

## 五、修复优先级

| 优先级 | 问题                      | 修复难度                    |
| --- | ----------------------- | ----------------------- |
| P0  | 问题3：路径拼接 bug            | 低（改用 pathJoin）          |
| P0  | 问题6：删除无法取消              | 低（加 isTaskCancelled 检查） |
| P0  | 问题5：上传背压控制              | 中（改造读写流逻辑）              |
| P1  | 问题4：进度监听器清理             | 低（加 finally 块）          |
| P1  | 问题8：deleteFileByPath 进度 | 低（补充 onProgress 调用）     |
| P2  | 问题1：文件夹进度累加             | 中（需要递归累加逻辑）             |
| P2  | 问题2：nodeId 匹配确认         | 低（检查 IPC 层代码）           |
| P3  | 问题7：删除进度细化              | 中（改造删除逻辑）               |

