# SFTP 服务性能问题分析

> 分析文件: [sftp.ts](../sftp.ts)
> 分析日期: 2026-04-25

---

## P0 - 串行文件传输（最严重）

**位置**: [downloadFolder](../sftp.ts#L286-L310) / [uploadFolder](../sftp.ts#L455-L474)

```typescript
for (const child of node.children) {
  if (child.isDirectory) {
    await this.downloadFolder(taskId, child, onProgress)
  } else {
    await this.downloadFile(taskId, child, onProgress)
  }
}
```

**问题**: 文件夹内的文件**完全串行**处理，每个文件必须等前一个完成才开始。假设100个小文件，每个1MB，网络延迟50ms，串行需要至少5秒延迟开销。

**建议**: 同一目录下的文件应该**并发传输**（可配置并发数，如5-10个并发）。

---

## P1 - 下载缓冲区过小

**位置**: [downloadFile](../sftp.ts#L193)

```typescript
const buffer = Buffer.alloc(32 * 1024) // 32KB buffer
```

**问题**: 32KB 缓冲区在现代网络环境下太小。对于高带宽连接（如100Mbps+），这会导致：
- 频繁的回调调用
- 无法充分利用网络带宽
- CPU 在回调调度上浪费时间

**建议**: 至少 128KB-256KB，或根据文件大小动态调整。

---

## P1 - 上传无背压控制

**位置**: [uploadFile](../sftp.ts#L368-L445)

```typescript
const readStream = fs.createReadStream(localPath)
readStream.on('data', (chunk) => {
  this.sftpHandle.write(handle, chunk, ...)
})
```

**问题**: `createReadStream` 默认使用 64KB 缓冲区，但 `data` 事件触发速度可能远快于 SFTP `write` 回调完成速度，导致：
- 内存中积压大量未完成的 write 请求
- 大文件上传时内存占用过高

**建议**: 使用背压（backpressure）控制，等待 write 回调完成后再读取下一个 chunk。

---

## P2 - listDir 全量加载目录

**位置**: [listDir](../sftp.ts#L86-L131)

```typescript
this.sftpHandle.readdir(remotePath, async (err: Error, list: any[]) => {
```

**问题**: `readdir` 一次性读取**整个目录**的所有条目到内存。对于包含数千文件的目录（如 `/var/log`），会：
- 占用大量内存
- 阻塞 UI 响应
- 可能导致 OOM

**建议**: 使用 `opendir` + 分批读取（如果 ssh2 支持），或限制单次返回数量。

---

## P2 - 无连接池

**全局问题**: 整个类只有一个 `Client` 实例和 `sftpHandle`。

**问题**: 
- 无法并发执行多个独立任务（如同时上传和下载）
- 单个连接断开后所有操作失败

**建议**: 实现连接池，支持多个 SFTP 会话。

---

## P2 - deleteFile 串行删除

**位置**: [deleteFile](../sftp.ts#L614-L688)

```typescript
for (const entry of entries) {
  // ... 串行 await 删除
  await this.deleteFile(taskId, childNode, onProgress)
}
```

**问题**: 删除大量文件时完全串行，每个文件需要一次 RTT（往返时间）。

**建议**: 可以批量并发删除（但要注意服务器端的并发限制）。

---

## P3 - 重复 stat 调用

**位置**: [mkdir](../sftp.ts#L530-L553)

```typescript
this.sftpHandle.mkdir(remotePath, { mode: 0o755 }, (err: Error) => {
  if (err) {
    this.sftpHandle.stat(remotePath, (statErr: Error) => {
```

**问题**: 目录已存在时，会额外发起一次 `stat` 请求。在上传深层目录结构时，会产生大量冗余网络请求。

**建议**: 使用 `mkdir -p` 语义，或缓存已创建的目录路径。

---

## P3 - 高频调用 Date.now()

**位置**: [calculateTransferSpeed](../sftp.ts#L320-L331)

```typescript
private calculateTransferSpeed(...) {
  const now = Date.now()
  const timeDiff = (now - lastUpdateTime) / 1000
  return timeDiff > 0 ? (transferredBytes - lastTransferredBytes) / timeDiff : 0
}
```

**问题**: 每个 chunk 都调用 `Date.now()`，对于小文件高频传输时，这是一个不必要的开销。

**建议**: 降低进度回调频率（如每100ms或每1%进度才回调）。

---

## P3 - 递归可能导致调用栈溢出

**位置**: [downloadFolder](../sftp.ts#L286-L310) / [uploadDirectoryRecursive](../sftp.ts#L483-L512)

**问题**: 对于极深的目录结构（如 node_modules），递归调用可能导致调用栈溢出。

**建议**: 改用迭代 + 队列的方式处理。

---

## 性能问题优先级汇总

| 优先级 | 问题 | 影响 |
|--------|------|------|
| P0 | 串行文件传输 | 大文件夹传输时间翻倍 |
| P1 | 下载缓冲区过小 | 带宽利用率低 |
| P1 | 上传无背压控制 | 大文件内存溢出风险 |
| P2 | listDir 全量加载 | 大目录卡顿 |
| P2 | 无连接池 | 无法并发任务 |
| P2 | deleteFile 串行删除 | 删除大量文件缓慢 |
| P3 | 重复 stat 调用 | 轻微延迟增加 |
| P3 | 高频 Date.now() | 微小 CPU 开销 |
| P3 | 递归调用栈溢出风险 | 极深目录结构崩溃 |
