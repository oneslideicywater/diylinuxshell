# SFTP 服务架构设计

> 代码文件: [sftp.ts](./sftp.ts)
> 更新日期: 2026-04-26

---

## 一、模块定位

SFTP 服务是主进程的核心模块之一，负责与远程服务器的文件传输操作。

**职责边界：**
- ✅ SFTP 连接管理（连接/断开）
- ✅ 远程文件系统操作（列表、上传、下载、删除、创建目录）
- ❌ 不负责 UI 渲染（由 Renderer 进程处理）
- ❌ 不负责任务调度（由 IPC 层协调）

---

## 二、并发传输架构

### 2.1 核心问题背景

**原始痛点（P0 问题）：**
```
串行传输时间线：
[文件1: RTT+传输] → [文件2: RTT+传输] → [文件3: RTT+传输] → ...
                  ↑ 每个文件必须等前一个完成
总耗时 = N × (RTT + 传输时间)
```

**Node.js 单线程误解澄清：**
- Node.js 是单线程 **CPU 执行模型**
- 但 I/O 操作（网络请求）由操作系统内核处理，**不占用 JS 线程**
- `await` 会暂停当前函数，但**不会阻塞事件循环**
- 问题本质：`for` 循环 + `await` 导致**逻辑上串行**，浪费了 I/O 等待时间

### 2.2 并发池设计原理

#### 架构图

```mermaid
graph TB
    subgraph "调用层"
        A[downloadFolder / uploadFolder / deleteFile]
    end
    
    subgraph "并发池层"
        B[runConcurrent<br/>Promise Pool]
        C1[Task Queue<br/>等待队列]
        C2[Executing Set<br/>运行集合<br/>max size=5]
    end
    
    subgraph "执行层"
        D1[downloadFile #1]
        D2[downloadFile #2]
        D3[downloadFile #3]
        D4[downloadFile #4]
        D5[downloadFile #5]
        D6[downloadFile #6 ...]
    end
    
    A -->|构建 tasks 数组| B
    B --> C1
    B --> C2
    C1 -->|取出任务| C2
    C2 -->|并发数<5| C1
    C2 -->|分配执行| D1
    C2 -->|分配执行| D2
    C2 -->|分配执行| D3
    C2 -->|分配执行| D4
    C2 -->|分配执行| D5
    D6 -.->|等待槽位| C1
    
    D1 -->|完成| C2
    D2 -->|完成| C2
```

#### 核心机制

**1. 任务队列模式**

```typescript
// 延迟执行：用函数包裹任务，只在需要时才启动
const tasks: (() => Promise<void>)[] = node.children.map((child) => {
  return async () => {
    // 实际的下载/上传/删除逻辑
    await this.downloadFile(taskId, child, onProgress)
  }
})
```

**为什么用函数包裹？**
- 避免 `Promise.all()` 一次性启动所有任务（可能打爆服务器连接数）
- 实现"按需启动"，只有达到并发上限才等待
- 符合**生产者-消费者模式**

**2. 受控并发策略**

```typescript
private async runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number = 5  // 默认最大并行数
): Promise<T[]> {
  const executing: Set<Promise<void>> = new Set()
  
  for (const task of tasks) {
    const promise = task()  // 启动任务
    executing.add(promiseWrapper)
    
    if (executing.size >= concurrency) {
      await Promise.race(executing)  // 等待任意一个完成
    }
  }
  
  await Promise.all(executing)  // 等待剩余任务全部完成
}
```

**关键点：**
- `Promise.race(executing)`：等待最快完成的任务释放槽位
- 不是简单的 `Promise.all(tasks.map(t => t()))`（无控制）
- 自动实现**背压控制**（backpressure）

### 2.3 并发 vs 串行对比

#### 时间线对比（3 个文件，并发数=2）

```
┌─ 串行模式 ─────────────────────────────────────┐
│ 时间轴 →                                        │
│ [文件1: RTT+传输] [文件2: RTT+传输] [文件3: RTT+传输] │
│ 总耗时 = T1 + T2 + T3                           │
└─────────────────────────────────────────────────┘

┌─ 并发模式 ─────────────────────────────────────┐
│ 时间轴 →                                        │
│ [文件1][文件2] ─→ [文件3]                        │
│   ↑ 同时进行     ↑ 文件1或2完成后启动             │
│ 总耗時 = max(T1,T2) + T3                        │
└─────────────────────────────────────────────────┘
```

#### 性能提升量化

| 场景 | 文件数 | 单文件大小 | RTT | 串行耗时 | 并发耗时(5路) | 提升倍数 |
|------|--------|-----------|-----|---------|-------------|---------|
| 小文件批量下载 | 100 | 1MB | 50ms | ~5s | ~1s | **5x** |
| 上传 node_modules | 500 | 50KB | 30ms | ~15s | ~3s | **5x** |
| 删除临时文件 | 1000 | 10KB | 20ms | ~20s | ~4s | **5x** |

### 2.4 三大操作的并发化改造

#### 1️⃣ downloadFolder（文件夹下载）

```mermaid
flowchart TD
    A[downloadFolder 被调用] --> B{children 为空?}
    B -->|是| Z[返回]
    B -->|否| C[创建本地目录 mkdirSync]
    C --> D[构建 tasks 数组]
    
    D --> E[runConcurrent tasks]
    
    E --> F1[Task1: downloadFile 或 downloadFolder]
    E --> F2[Task2: downloadFile 或 downloadFolder]
    E --> Fn[TaskN: downloadFile 或 downloadFolder]
    
    F1 --> G[所有任务完成]
    F2 --> G
    Fn --> G
    
    G --> H[返回]
    
    style E fill:#f9f,stroke:#333,stroke-width:2px
```

**设计决策：**
- 目录创建使用 `mkdirSync`（同步），确保子文件写入时目录已存在
- 子节点可以是文件或目录，递归进入后内部也会并发处理
- 进度回调保持不变：文件夹不上报，叶子文件逐个触发

#### 2️⃣ uploadDirectoryRecursive（文件夹上传）

```mermaid
flowchart TD
    A[uploadDirectoryRecursive] --> B{检查取消标志}
    B -->|已取消| ERR[抛出 Upload cancelled]
    B -->|未取消| C[mkdir 创建远程目录]
    C --> D{children 为空?}
    D -->|是| RET[返回]
    D -->|否| E[构建 tasks 数组]
    
    E --> F[runConcurrent tasks]
    
    F --> G1[Task1: uploadFile 或递归]
    F --> G2[Task2: uploadFile 或递归]
    
    G1 --> H[所有任务完成]
    G2 --> H
    
    H --> RET
    
    style F fill:#f9f,stroke:#333,stroke-width:2px
```

**特殊处理：**
- 每个任务开始前检查 `this.uploadCancelled`（粗粒度取消）
- `uploadFile` 内部也会检查该标志（细粒度取消）
- 与 downloadFolder 对称设计，保持一致的并发策略

#### 3️⃣ deleteFile（删除操作）

```mermaid
flowchart TD
    A[deleteFile 被调用] --> B[stat 判断类型]
    B --> C{是目录?}
    
    C -->|否| D[unlink 删除文件]
    D --> E[上报 100% 进度]
    E --> DONE[resolve]
    
    C -->|是| F[readdir 读取子项]
    F --> G{子项为空?}
    G -->|是| H[rmdir 删除空目录]
    H --> E
    
    G -->|否| I[构建 tasks 数组]
    I --> J[runConcurrent 并发删除]
    
    J --> K1[Task1: deleteFile 递归]
    J --> K2[Task2: deleteFile 递归]
    
    K1 --> L[所有子项删除完毕]
    K2 --> L
    
    L --> M[rmdir 删除空目录]
    M --> E
    
    style J fill:#f9f,stroke:#333,stroke-width:2px
```

**关键约束：**
- 必须等**所有子项删除完成后**才能 `rmdir`（否则目录非空会失败）
- 进度上报调整为：开始 0% → 完成 100%（不再逐个上报中间进度）
  - 原因：并发执行时，完成顺序不确定，按顺序上报中间进度无意义
- 错误传播：任一子项失败立即 reject（与原串行行为一致）

---

## 三、数据流架构

### 3.1 下载流程数据流

```mermaid
sequenceDiagram
    participant R as Renderer 进程
    participant I as IPC 层
    participant S as SFTPService
    participant SSH as ssh2 库
    participant FS as 本地文件系统
    
    R->>I: ipc.downloadFolder(taskId, node)
    I->>S: downloadFolder(taskId, node, onProgress)
    
    loop 并发执行（最多5路）
        S->>S: runConcurrent(tasks)
        
        alt 子节点是目录
            S->>S: downloadFolder(递归)
            Note over S: 内部也会并发处理
        else 子节点是文件
            S->>SSH: sftpHandle.open(remotePath)
            SSH-->>S: handle
            
            loop 读取 chunks（单个文件内串行）
                S->>SSH: sftpHandle.read(handle, buffer)
                SSH-->>S: data chunk
                
                S->>FS: writeStream.write(chunk)
                FS-->>S: 写入完成
                
                S->>I: onProgress(speed, bytes, taskId, node)
                I->>R: 更新 UI 进度条
            end
            
            S->>SSH: sftpHandle.close(handle)
        end
    end
    
    S-->>I: Promise.resolve()
    I-->>R: 下载完成通知
```

### 3.2 上传流程数据流（含背压控制）

```mermaid
sequenceDiagram
    participant R as Renderer 进程
    participant I as IPC 层
    participant S as SFTPService
    participant SSH as ssh2 库
    participant FS as 本地文件系统
    
    R->>I: ipc.uploadFolder(taskId, node)
    I->>S: uploadFolder(taskId, node, onProgress)
    
    S->>S: runConcurrent(tasks)
    
    loop 并发执行（最多5路）
        S->>SSH: sftpHandle.open(remotePath, 'w')
        SSH-->>S: handle
        
        S->>FS: fs.createReadStream(localPath)
        FS-->>S: readStream
        
        loop 背压控制循环
            readStream->>S: 'data' 事件（chunk）
            S->>readStream: pause() ⚠️ 暂停读取
            
            S->>SSH: sftpHandle.write(handle, chunk)
            
            Note over SSH,S: 等待网络响应...
            
            SSH-->>S: write 回调完成
            S->>I: onProgress(speed, bytes, taskId, node)
            S->>readStream: resume() ✅ 恢复读取
        end
        
        readStream->>S: 'end' 事件
        S->>SSH: sftpHandle.close(handle)
    end
    
    S-->>I: Promise.resolve()
```

**背压控制说明：**
- `readStream.pause()`：收到数据后立即暂停，防止内存堆积
- `write 回调完成后 resume()`：网络写入完成才允许读取下一个 chunk
- 与 downloadFile 的递归 `readChunk()` 模式对齐（都是串行写入）

---

## 四、接口契约

### 4.1 公共方法签名

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `connect(config)` | `SFTPConfig` | `Promise<void>` | 建立 SFTP 连接 |
| `listDir(remotePath)` | `string` | `Promise<FileInfo[]>` | 列出远程目录内容 |
| `downloadFile(taskId, node, onProgress?)` | `taskId, TransferNode, callback?` | `Promise<void>` | 下载单个文件 |
| `downloadFolder(taskId, node, onProgress?)` | `taskId, TransferNode, callback?` | `Promise<void>` | 下载整个文件夹（**并发**） |
| `uploadFile(taskId, node, onProgress?)` | `taskId, TransferNode, callback?` | `Promise<void>` | 上传单个文件 |
| `uploadFolder(taskId, node, onProgress?)` | `taskId, TransferNode, callback?` | `Promise<void>` | 上传整个文件夹（**并发**） |
| `deleteFile(taskId, node, onProgress?)` | `taskId, TransferNode, callback?` | `Promise<void>` | 删除文件或目录（**并发**） |
| `mkdir(remotePath)` | `string` | `Promise<void>` | 创建远程目录 |
| `cancelUpload()` | 无 | `void` | 取消当前上传任务 |

### 4.2 回调接口

```typescript
type ProgressCallback = (
  speed: number,           // 当前传输速度（字节/秒）
  transferredBytes: number, // 已传输字节数
  taskId: string,          // 任务 ID（用于前端聚合）
  node: TransferNode       // 当前正在处理的节点
) => void
```

**调用时机：**
- **downloadFile**：每个 chunk 写入完成后调用，最后补发一次（确保 100%）
- **uploadFile**：每个 chunk 写入远程完成后调用，`end` 事件时补发一次
- **deleteFile**：开始时调用 0%，完成时调用 100%

---

## 五、配置参数

### 5.1 并发控制

```typescript
private static readonly MAX_CONCURRENCY: number = 5
```

**推荐配置场景：**

| 场景 | 推荐值 | 原因 |
|------|--------|------|
| 家庭网络/弱服务器 | 3-5 | 避免打爆服务器连接数 |
| 企业内网/强服务器 | 5-10 | 充分利用带宽 |
| 本地测试环境 | 10-20 | 压测性能极限 |

### 5.2 缓冲区大小

```typescript
// P1 优化：32KB → 256KB
const buffer = Buffer.alloc(256 * 1024)
```

**选型依据：**
- 32KB：在现代高带宽网络下太小，频繁回调浪费 CPU
- 256KB：带宽利用率与内存占用的平衡点
- 1MB+：可能导致内存压力过大（大文件场景）

---

## 六、错误处理策略

### 6.1 错误传播链

```mermaid
graph LR
    A[底层错误<br/>ssh2 回调 err] --> B[reject Promise]
    B --> C[runConcurrent 捕获]
    C --> D[立即 reject 整体任务]
    D --> E[IPC 层接收 Error]
    E --> F[Renderer 显示错误提示]
    
    style C fill:#ff9,stroke:#333,stroke-width:2px
```

**关键原则：**
- 任一子任务失败 → 整体任务立即失败（fail-fast）
- 不会静默跳过失败的任务（保证数据一致性）
- 所有错误都会打印到 console.error（便于调试）

### 6.2 特殊错误处理

| 错误类型 | 处理方式 | 示例 |
|----------|---------|------|
| 目录已存在 | 忽略并 stat 确认 | `mkdir` 时检查 |
| 符号链接断链 | 保持原判断显示为文件 | `stat` 失败时 fallback |
| 取消操作 | 抛出特定 Error | `Upload cancelled` |
| 网络断开 | 直接 reject | 由上层重连机制处理 |

---

## 七、性能优化总结

### 已解决的问题

| 优先级 | 问题 | 解决方案 | 状态 |
|--------|------|---------|------|
| **P0** | 串行文件传输 | `runConcurrent` 并发池（5路并行） | ✅ 已解决 |
| **P1** | 下载缓冲区过小 | 32KB → 256KB | ✅ 已解决 |
| P2 | listDir 全量加载 | （未改动，需评估影响） | ⏸️ 待定 |
| P2 | 无连接池 | （未改动，需架构级调整） | ⏸️ 待定 |
| **P2** | deleteFile 串行删除 | 改为并发删除 | ✅ 已解决 |
| P3 | 重复 stat 调用 | （未改动，影响较小） | ⏸️ 低优先级 |
| P3 | 高频 Date.now() | （未改动，影响微小） | ⏸️ 低优先级 |
| P3 | 递归栈溢出风险 | （未改动，极深目录才会触发） | ⏸️ 低优先级 |

### 相关文档

- [代码分析详情](./code.md) - 核心逻辑解读、设计决策原因、关键实现细节
- [性能问题清单](./__problem__/sftp-performance.md) - 原始问题描述和优先级
