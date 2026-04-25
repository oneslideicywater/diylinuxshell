# BUG-047: SFTP 上传无背压控制导致大文件内存溢出

## 基本信息
- **编号**: BUG-047
- **标题**: SFTP 上传无背压控制导致大文件内存溢出/文件损坏
- **发现日期**: 2026-04-25
- **状态**: 已修复
- **严重程度**: 高
- **影响模块**: SFTP 上传功能
- **来源文档**: [sftp-logic-correctness.md#问题5](../../src/main/services/__problem__/sftp-logic-correctness.md)

## 问题描述

上传文件时，`readStream` 的 `data` 事件持续触发读取本地文件，而 SFTP `write` 操作是异步回调。如果网络写入速度慢于本地读取速度，会导致：

1. 大量未完成的 `write` 请求堆积在内存中（内存溢出风险）
2. `position` 变量在回调乱序执行时可能出现竞态条件（文件内容损坏）
3. 大文件上传时内存占用急剧增长

### 错误现象

1. 用户上传大文件（>100MB）到远程服务器
2. 网络较慢或远程服务器响应延迟高
3. 进程内存占用持续增长，可能触发 OOM
4. 极端情况下上传的文件内容错乱

### 根因分析

**修复前代码** ([sftp.ts uploadFile](../../src/main/services/sftp.ts)):
```typescript
readStream.on('data', (chunk) => {
  // ← 没有暂停读取流！
  
  this.sftpHandle.write(handle, chunk, 0, chunk.length, position, (err) => {
    // write 是异步回调，不阻塞 readStream
    position += chunk.length   // ← 回调乱序时 position 可能出错
    uploadedBytes += chunk.length
  })
})
// ← readStream 继续触发 data 事件，新 chunk 涌入...
```

**数据流问题图示**：
```
时间线:
T1: data(chunk1) → write(chunk1, callback1)
T2: data(chunk2) → write(chunk2, callback2)   ← chunk1 还没写完！
T3: data(chunk3) → write(chunk3, callback3)   ← 堆积中...
...
T10: callback1 完成 → position += len(chunk1)
T11: callback3 完成 → position += len(chunk3)   ← 顺序乱了！
```

### 对比下载实现（正确模式）

**downloadFile 使用递归串行模式** ([sftp.ts downloadFile](../../src/main/services/sftp.ts)):
```typescript
const readChunk = () => {
  this.sftpHandle.read(handle, buffer, ..., (err, bytesRead) => {
    writeStream.write(data, () => {
      readChunk()  // ← 写完才读下一个，天然背压
    })
  })
}
readChunk()
```

## 修复方案

使用 `pause()/resume()` 实现背压控制：

```typescript
readStream.on('data', (chunk) => {
  readStream.pause()  // 收到数据后立即暂停读取
  
  this.sftpHandle.write(handle, chunk, 0, chunk.length, position, (err) => {
    // ... 处理逻辑 ...
    
    readStream.resume()  // 写入完成，恢复读取下一个 chunk
  })
})
```

**修复后数据流**：
```
时间线:
T1: data(chunk1) → pause() → write(chunk1, cb1)
T2: [readStream 已暂停，等待...]
T3: cb1 完成 → resume() → data(chunk2) → pause() → write(chunk2, cb2)
T4: [readStream 已暂停，等待...]
T5: cb2 完成 → resume() → data(chunk3) → pause() → ...
// 任何时候内存中只有 1 个未完成的 write 请求
```

## 修改文件

- [sftp.ts](../../src/main/services/sftp.ts) - `uploadFile` 方法，添加 `pause()/resume()` 背压控制

## 测试验证

1. 上传小文件（<1MB）→ 验证功能正常
2. 上传大文件（>100MB）→ 验证内存稳定，无溢出
3. 网络限速测试 → 验证背压生效，内存不堆积
4. 上传完成后校验文件 MD5 → 验证文件完整性
