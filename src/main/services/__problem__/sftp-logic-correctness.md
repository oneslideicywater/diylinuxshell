# SFTP 上传/下载/删除逻辑正确性分析

> 分析文件:
> - 主进程: [sftp.ts](../sftp.ts)
> - 渲染进程: [download.ts](../../renderer/src/components/terminal/sftp/script/download.ts)、[upload.ts](../../renderer/src/components/terminal/sftp/script/upload.ts)、[delete.ts](../../renderer/src/components/terminal/sftp/script/delete.ts)
> - 工具函数: [utils.ts](../../renderer/src/components/terminal/sftp/script/utils.ts)
> 分析日期: 2026-04-25

---

## 一、下载逻辑

### ✅ 正确部分

1. **两阶段设计合理**：先扫描远程目录树 → 再逐个下载文件
2. **取消机制完善**：在关键节点都检查了 `isTaskCancelled()`
3. **进度回调机制**：主进程每写入一个 chunk 就上报进度，前端监听更新
4. **空文件处理**：[sftp.ts:L216-L230](../sftp.ts#L216-L230) 对空文件做了特殊处理，触发最后一次进度回调

### ❌ 逻辑问题

#### 问题1：文件夹 size 字段始终为 0

**位置**: [download.ts:L186-L260](../../renderer/src/components/terminal/sftp/script/download.ts#L186-L260)

```typescript
if (node.isDirectory && node.children && node.children.length > 0) {
  // 只创建本地目录 + 递归子节点
  // 文件夹本身没有累加子文件的 size
}
```

**问题**: 文件夹节点的 `size` 字段在扫描阶段已设置（来自 `scanRemoteTree`），但下载完成后文件夹的 `transferredBytes` 没有累加子文件的传输量。

**影响**: 前端如果显示文件夹的 `transferredBytes/size` 进度，会显示不准确。

---

#### 问题2：进度回调的 `nodeId` 匹配依赖 IPC 层正确传递

**位置**: [download.ts:L90-L108](../../renderer/src/components/terminal/sftp/script/download.ts#L90-L108)

```typescript
const cleanupProgress = window.api.sftp.onDownloadProgress((data) => {
  if (data.nodeId === node.id) {  // ← 依赖 IPC 层传递 nodeId
```

**问题**: 主进程 [sftp.ts:L243-L253](../sftp.ts#L243-L253) 的 `onProgress` 回调传的是 `node` 对象，但 IPC 中间层是否正确提取了 `node.id` 并作为 `nodeId` 传递给前端？

**建议**: 需要确认 IPC 层的实现是否正确映射了 `nodeId` 字段。

---

#### 问题3：单文件下载路径拼接缺少分隔符

**位置**: [download.ts:L663](../../renderer/src/components/terminal/sftp/script/download.ts#L663)

```typescript
localPath: localBasePath ? `${localBasePath}${fileName}` : '',
```

**问题**: 如果 `localBasePath` 末尾没有 `/` 或 `\`，拼接结果会是 `C:\Users\testfile.txt` 而不是 `C:\Users\test\file.txt`。

**对比**: 同文件 [L594-L596](../../renderer/src/components/terminal/sftp/script/download.ts#L594-L596) 使用了 `pathJoin` API，但这里用了字符串拼接。

**影响**: 单文件下载到错误路径，或创建目录失败。

---

## 二、上传逻辑

### ✅ 正确部分

1. **扫描本地文件树**：[sftp.ts:L734-L876](../sftp.ts#L734-L876) 递归扫描本地目录，生成完整 TransferNode 树
2. **递归上传逻辑正确**：[upload.ts:L144-L236](../../renderer/src/components/terminal/sftp/script/upload.ts#L144-L236) 先创建远程目录 → 递归子节点 → 标记完成
3. **空文件夹处理**：有专门的 `else if (node.isDirectory)` 分支处理空文件夹

### ❌ 逻辑问题

#### 问题4：上传失败时进度监听器未清理

**位置**: [upload.ts:L33-L119](../../renderer/src/components/terminal/sftp/script/upload.ts#L33-L119)

```typescript
const cleanupProgress = window.api.sftp.onUploadProgress((data) => { ... })
const result = await window.api.sftp.upload(connectionId, taskId, node)
cleanupProgress()  // ← 只在成功时清理
```

**问题**: 如果 `upload` 抛出异常，`cleanupProgress()` 不会被调用。对比 [delete.ts:L88](../../renderer/src/components/terminal/sftp/script/delete.ts#L88) 用了 `finally` 块。

**影响**: 上传失败时，进度监听器不会被清理，多次失败后可能导致内存泄漏。

**建议**: 使用 `try...finally` 确保清理：
```typescript
try {
  const result = await window.api.sftp.upload(connectionId, taskId, node)
} finally {
  cleanupProgress()
}
```

---

#### 问题5：上传无背压控制，可能导致内存溢出

**位置**: [sftp.ts:L393-L430](../sftp.ts#L393-L430)

```typescript
readStream.on('data', (chunk) => {
  this.sftpHandle.write(handle, chunk, 0, chunk.length, position, (err: Error) => {
    // write 回调是异步的，但 readStream 不会等待它完成
  })
})
```

**问题**: `readStream` 的 `data` 事件会持续触发，而 SFTP `write` 是异步回调。如果读取速度快于写入速度，会导致：
- 大量 write 请求堆积在内存中
- `position` 变量可能存在竞态条件（回调顺序可能乱序）

**影响**: 大文件上传时可能内存溢出，或者文件内容损坏（如果 write 回调乱序执行）。

**建议**: 暂停读取流直到 write 回调完成：
```typescript
readStream.on('data', (chunk) => {
  readStream.pause()  // 暂停读取
  this.sftpHandle.write(handle, chunk, 0, chunk.length, position, (err) => {
    readStream.resume()  // 恢复读取
  })
})
```

---

## 三、删除逻辑

### ✅ 正确部分

1. **从叶子节点开始删除**：[delete.ts:L140-L172](../../renderer/src/components/terminal/sftp/script/delete.ts#L140-L172) 先递归删除所有子节点，最后删除父目录
2. **进度回调用 `finally` 清理**：[delete.ts:L88](../../renderer/src/components/terminal/sftp/script/delete.ts#L88)
3. **主进程删除逻辑完整**：[sftp.ts:L570-L660](../sftp.ts#L570-L660) 区分文件和目录，目录递归删除后 `rmdir`

### ❌ 逻辑问题

#### 问题6：删除循环中缺少取消检查

**位置**: [delete.ts:L140-L172](../../renderer/src/components/terminal/sftp/script/delete.ts#L140-L172)

```typescript
for (const child of node.children) {
  await deleteFolderContent(child, sftpConnectionId, taskId)
  // ← 没有检查 isTaskCancelled()
}
```

**问题**: 对比 [upload.ts:L177-L183](../../renderer/src/components/terminal/sftp/script/upload.ts#L177-L183) 和 [download.ts:L210-L214](../../renderer/src/components/terminal/sftp/script/download.ts#L210-L214)，删除循环中**没有检查 `isTaskCancelled()`**。

**影响**: 用户取消删除任务后，仍会继续删除剩余文件，无法中途停止。

**建议**: 每个循环迭代前检查：
```typescript
for (const child of node.children) {
  if (isTaskCancelled(taskId)) break
  await deleteFolderContent(child, sftpConnectionId, taskId)
}
```

---

#### 问题7：删除进度只有 0% 和 100%

**位置**: [sftp.ts:L635-L638](../sftp.ts#L635-L638)

```typescript
if (onProgress) {
  onProgress(0, node.size || 0, taskId, node)  // speed=0, transferredBytes=size
}
```

**问题**: 删除操作只有开始（0%）和完成（100%）两个状态。对于**大目录**，前端会长时间卡在 0%，然后突然跳到 100%。

对比前端 [delete.ts:L68-L72](../../renderer/src/components/terminal/sftp/script/delete.ts#L68-L72) 的计算：
```typescript
const progress = node.size > 0 ? Math.round((data.transferredBytes / node.size) * 100) : ...
```

**影响**: 删除大目录时，用户看不到中间进度，体验差。

**建议**: 每删除一个子文件就上报一次进度，累加 `transferredBytes`。

---

#### 问题8：`deleteFileByPath` 没有进度上报

**位置**: [sftp.ts:L668-L698](../sftp.ts#L668-L698)

```typescript
private async deleteFileByPath(taskId, remotePath, parentNode, onProgress?) {
  // ... 删除逻辑
  // 没有调用 onProgress
}
```

**问题**: 回退删除路径时（子节点不在 TransferNode 树中），完全没有调用 `onProgress`，前端收不到任何进度更新。

**影响**: 如果走回退路径，前端进度条不会更新。

---

## 四、问题汇总

| 编号 | 模块 | 问题 | 严重程度 | 影响 |
|------|------|------|---------|------|
| 问题1 | 下载 | 文件夹 transferredBytes 未累加 | 中 | 前端进度显示不准确 |
| 问题2 | 下载 | nodeId 匹配依赖 IPC 层实现 | 中 | 进度回调可能不触发 |
| 问题3 | 下载 | 单文件路径拼接缺少分隔符 | **高** | 下载到错误路径 |
| 问题4 | 上传 | 失败时不清理进度监听器 | 中 | 内存泄漏 |
| 问题5 | 上传 | 无背压控制 | **高** | 大文件内存溢出/文件损坏 |
| 问题6 | 删除 | 循环中缺少取消检查 | **高** | 无法取消删除任务 |
| 问题7 | 删除 | 进度只有 0% 和 100% | 低 | 用户体验差 |
| 问题8 | 删除 | deleteFileByPath 无进度上报 | 中 | 回退路径进度丢失 |

---

## 五、修复优先级

| 优先级 | 问题 | 修复难度 |
|--------|------|---------|
| P0 | 问题3：路径拼接 bug | 低（改用 pathJoin） |
| P0 | 问题6：删除无法取消 | 低（加 isTaskCancelled 检查） |
| P0 | 问题5：上传背压控制 | 中（改造读写流逻辑） |
| P1 | 问题4：进度监听器清理 | 低（加 finally 块） |
| P1 | 问题8：deleteFileByPath 进度 | 低（补充 onProgress 调用） |
| P2 | 问题1：文件夹进度累加 | 中（需要递归累加逻辑） |
| P2 | 问题2：nodeId 匹配确认 | 低（检查 IPC 层代码） |
| P3 | 问题7：删除进度细化 | 中（改造删除逻辑） |
