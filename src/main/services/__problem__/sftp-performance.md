# SFTP 服务性能问题分析

> 分析文件: [sftp.ts](../sftp.ts)
> 分析日期: 2026-04-25

---

## P0 - 串行文件传输（最严重） ✅ 已解决

> 📋 关联：[sftp-transfer-state-machine.md](../../docs/relation/sftp-transfer-state-machine.md) | 修复位置: [runConcurrent](../sftp.ts#L396-L436)

**状态**: ~~未解决~~ → **已通过并发池 (`runConcurrent`) 解决**

**原问题描述**: 文件夹内的文件**完全串行**处理，每个文件必须等前一个完成才开始。

**修复方案**: 引入 Promise Pool 并发执行器，默认 `MAX_CONCURRENCY=5` 并发数。

---

## P1 - 下载缓冲区过小 ✅ 已解决

> 📋 关联：[sftp-transfer-state-machine.md](../../docs/relation/sftp-transfer-state-machine.md) | 修复位置: [downloadFile](../sftp.ts#L247-L256)

**状态**: ~~未解决~~ → **已通过增大缓冲区解决 (32KB → 256KB)**

**原问题描述**: 32KB 缓冲区在现代网络环境下太小，导致频繁回调、带宽利用率低。

**修复方案**: 缓冲区从 `32KB` 增大到 `256KB`，平衡带宽利用率与内存占用。

---

## P1 - 上传无背压控制 ✅ 已解决

> 📋 关联：[sftp-transfer-state-machine.md](../../docs/relation/sftp-transfer-state-machine.md) | 修复位置: [uploadFile](../sftp.ts#L499-L510)

**状态**: ~~未解决~~ → **已通过背压 (backpressure) 控制解决**

**原问题描述**: `data` 事件触发速度远快于 SFTP `write` 回调，导致内存积压大量未完成 write 请求。

**修复方案（两项）**:
1. **背压控制**: 收到 data 后立即 `readStream.pause()`，write 回调完成后 `resume()` 继续读取
2. **缓冲区增大**: `createReadStream` 添加 `highWaterMark: 256KB`（默认64KB），减少 ~75% 的 write 回调次数

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

| 优先级 | 问题 | 状态 | 影响 |
|--------|------|------|------|
| P0 | 串行文件传输 | ✅ 已解决 | 大文件夹传输时间翻倍 |
| P1 | 下载缓冲区过小 | ✅ 已解决 | 带宽利用率低 |
| P1 | 上传无背压控制 | ✅ 已解决 | 大文件内存溢出风险 |
| P2 | listDir 全量加载 | ⏳ 待处理 | 大目录卡顿 |
| P2 | 无连接池 | ⏳ 待处理 | 无法并发任务 |
| P2 | deleteFile 串行删除 | ⏳ 待处理 | 删除大量文件缓慢 |
| P3 | 重复 stat 调用 | ⏳ 待处理 | 轻微延迟增加 |
| P3 | 高频 Date.now() | ⏳ 待处理 | 微小 CPU 开销 |
| P3 | 递归调用栈溢出风险 | ⏳ 待处理 | 极深目录结构崩溃 |
