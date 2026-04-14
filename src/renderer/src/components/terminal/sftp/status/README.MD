让我帮你查找 `onUploadProgress` 的实现位置。
        
            
toolName: search_by_regex
            
status: success
          
query: onUploadProgress
          

        
            
toolName: view_files
            
status: success
          
            
filePath: f:\tech-docs\diy-linux-shell\src\preload\index.ts
          

        
            
toolName: search_by_regex
            
status: success
          
query: sftp:uploadProgress
          

        
            
toolName: view_files
            
status: success
          
            
filePath: f:\tech-docs\diy-linux-shell\src\main\ipc\sftp.ts
          
## 📍 `onUploadProgress` 实现位置

`onUploadProgress` 的完整实现涉及 **3 个层次**：

---

### 1️⃣ **Preload 层**（桥梁）- [preload/index.ts#L206](f:\tech-docs\diy-linux-shell\src\preload\index.ts#L206)

```typescript
// 监听上传进度
onUploadProgress: (callback) => {
  const channel = 'sftp:uploadProgress'  // IPC 通道名称
  const listener = (_event, data) => {
    callback(data)  // 接收主进程数据，调用回调
  }
  ipcRenderer.on(channel, listener)      // 注册监听器
  return () => ipcRenderer.removeListener(channel, listener)  // 返回清理函数
}
```

**作用**：
- 暴露给渲染进程的 API
- 监听 `sftp:uploadProgress` IPC 事件
- 返回清理函数（避免内存泄漏）

---

### 2️⃣ **Main 进程层**（数据源）- [main/ipc/sftp.ts#L136](f:\tech-docs\diy-linux-shell\src\main\ipc\sftp.ts#L136)

#### 单文件上传进度：
```typescript
ipcMain.handle('sftp:upload', async (event, sessionId, localPath, remotePath) => {
  const service = sftpPool.getConnection(sessionId)
  const window = BrowserWindow.fromWebContents(event.sender)
  
  // 带进度回调的上传
  await service.uploadFile(localPath, remotePath, 
    (progress, size, transferredSize, speed) => {
      // ★ 发送进度事件到渲染进程
      window.webContents.send('sftp:uploadProgress', {
        sessionId,
        localPath,
        remotePath,
        progress,        // 进度百分比 (0-100)
        size,            // 总大小（字节）
        transferredSize, // 已传输大小（字节）
        speed            // 传输速度（字节/秒）
      })
    }
  )
})
```

#### 文件夹上传进度：
```typescript
ipcMain.handle('sftp:uploadFolder', async (event, sessionId, localPath, remotePath) => {
  const service = sftpPool.getConnection(sessionId)
  const window = BrowserWindow.fromWebContents(event.sender)
  
  await service.uploadFolder(localPath, remotePath,
    (progress, currentFile, size, transferredSize, speed) => {
      // ★ 发送进度事件到渲染进程
      window.webContents.send('sftp:uploadProgress', {
        sessionId,
        localPath: currentFile,  // 当前正在上传的文件
        remotePath,
        progress,
        size,
        transferredSize,
        speed
      })
    }
  )
})
```

**作用**：
- 调用 SFTP 服务层执行实际上传
- 通过回调获取实时进度数据
- 使用 `window.webContents.send()` 广播给渲染进程

---

### 3️⃣ **渲染层**（消费者）- [script/upload.ts#L123](f:\tech-docs\diy-linux-shell\src\renderer\src\components\session\sftp\script\upload.ts#L123)

```typescript
const cleanupProgress = window.api.sftp.onUploadProgress((data) => {
  if (data.localPath === node.localPath && data.remotePath === node.remotePath) {
    // 更新节点状态
    node.progress = Math.round((data.transferredSize / data.size) * 100)
    node.speed = data.speed
    
    // 计算剩余时间
    if (data.speed > 0) {
      const remainingBytes = data.size - data.transferredSize
      node.remaining = formatTime(Math.ceil(remainingBytes / data.speed))
    }
    
    // 计算已用时间
    if (node.startTime) {
      node.elapsed = formatTime(Math.round((Date.now() - node.startTime) / 1000))
    }
  }
})

// 上传完成后清理
cleanupProgress()
```

---

## 🔗 完整数据流

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Process                             │
│  ┌──────────────┐    ┌──────────────┐                      │
│  │ SFTP Service │───▶│ IPC Handler   │─── send() ──────┐   │
│  │ (实际上传)   │    │ (sftp.ts)    │                │   │
│  └──────────────┘    └──────────────┘                │   │
└─────────────────────────────────────────────────────│─────┘
                                                      │ IPC
┌─────────────────────────────────────────────────────▼─────┐
│                    Preload Script                          │
│  ┌──────────────────────────────────────────────────┐     │
│  │ onUploadProgress(callback)                       │     │
│  │   ipcRenderer.on('sftp:uploadProgress', listener)│     │
│  └──────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────┐
│                   Renderer Process                         │
│  ┌───────────────────────────────────────────────────┐   │
│  │ upload.ts - uploadSingleFile()                    │   │
│  │   window.api.sftp.onUploadProgress((data) => {    │   │
│  │     更新 TransferNode 状态                        │   │
│  │   })                                              │   │
│  └───────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

## 📝 关键点

1. **IPC 通道名**：`sftp:uploadProgress`
2. **触发时机**：每次调用 `service.uploadFile()` 或 `service.uploadFolder()` 时
3. **数据格式**：包含 sessionId、路径、进度、大小、速度等
4. **清理机制**：返回清理函数，防止内存泄漏

需要我进一步查看 SFTP 服务层的具体实现吗？