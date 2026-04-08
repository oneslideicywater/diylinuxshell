# SFTP 文件删除功能 - 产品需求文档

## 1. 文档信息

| 项目 | 内容 |
|------|------|
| 产品名称 | DIY-Linux-Shell |
| 版本 | V1.1 |
| 阶段 | Phase 2 - SFTP 子功能 |
| 文档状态 | 待开始 |
| 更新日期 | 2026-04-08 |
| 父文档 | [SFTP Phase 2 PRD](../prd.md) |

---

## 2. 产品概述

### 2.1 功能定位

文件删除功能允许用户删除远程 SFTP 服务器上的文件和文件夹，支持单个删除和批量删除。

### 2.2 核心价值

| 价值点 | 说明 |
|--------|------|
| 安全删除 | 删除前确认，防止误操作 |
| 批量删除 | 支持选中多个文件/文件夹同时删除 |
| 进度可视 | 显示删除进度，让用户掌握操作状态 |
| 错误处理 | 删除失败时提供明确的错误信息 |

---

## 3. 功能需求

### 3.1 功能列表

| 功能模块 | 功能点 | 优先级 | 状态 |
|----------|--------|--------|------|
| 单文件删除 | 右键菜单删除 | P0 | 待开始 |
| 单文件删除 | 工具栏删除按钮 | P1 | 待开始 |
| 批量删除 | 多文件选择删除 | P0 | 待开始 |
| 批量删除 | 混合选择删除（文件 + 文件夹） | P1 | 待开始 |
| 删除确认 | 删除前确认对话框 | P0 | 待开始 |
| 删除确认 | 显示待删除文件列表 | P1 | 待开始 |
| 进度管理 | 删除进度显示 | P0 | 待开始 |
| 进度管理 | 树形进度显示 | P1 | 待开始 |
| 任务控制 | 取消单个删除 | P1 | 待开始 |
| 任务控制 | 取消所有删除 | P1 | 待开始 |
| 错误处理 | 删除失败提示 | P0 | 待开始 |
| 错误处理 | 权限不足提示 | P0 | 待开始 |
| 错误处理 | 文件占用提示 | P1 | 待开始 |

### 3.2 功能详情

#### 3.2.1 单文件删除

**功能描述**：
- 支持删除单个文件或文件夹
- 支持多种触发方式：右键菜单、工具栏按钮
- 删除前需要用户确认

**触发方式**：
1. **右键菜单删除**：右键点击远程文件，弹出菜单包含"删除"选项
2. **工具栏删除**：选中文件后，点击工具栏的删除按钮
3. **快捷键删除**：选中文件后按 Delete 键

**用户场景**：
1. 用户在右侧远程文件面板选择一个文件
2. 通过以下方式触发删除：
   - 右键点击文件，选择"删除"选项
   - 点击工具栏删除按钮
   - 按 Delete 键
3. 系统弹出确认对话框，显示待删除文件名称
4. 用户确认后，系统开始删除
5. 删除完成后，远程文件列表刷新

**验收标准**：
- [ ] 支持右键菜单删除单个文件
- [ ] 支持工具栏按钮删除单个文件
- [ ] 支持 Delete 快捷键删除
- [ ] 删除前显示确认对话框
- [ ] 删除完成后自动刷新远程文件列表
- [ ] 删除失败时显示错误信息

#### 3.2.2 批量删除

**功能描述**：
- 支持选中多个文件/文件夹同时删除
- 删除前显示所有待删除项的列表
- 批量删除使用树形进度组件显示

**触发方式**：
1. **多选删除**：按住 Ctrl/Cmd 选择多个文件，右键选择"删除"
2. **框选删除**：鼠标框选多个文件，右键选择"删除"
3. **Shift 连选**：按住 Shift 选择连续多个文件，点击删除按钮

**用户场景**：
1. 用户在右侧远程文件面板选择多个文件/文件夹
2. 右键点击选中项，选择"删除"选项
3. 系统弹出确认对话框，显示所有待删除项
4. 用户确认后，系统开始批量删除
5. 树形进度组件显示删除进度
6. 删除完成后，远程文件列表刷新

**验收标准**：
- [ ] 支持 Ctrl/Cmd 多选文件删除
- [ ] 支持 Shift 连续多选文件删除
- [ ] 支持混合选择文件和文件夹删除
- [ ] 删除前显示所有待删除项的列表
- [ ] 批量删除使用统一树形组件显示进度
- [ ] 支持取消批量删除任务
- [ ] 删除完成后刷新远程文件列表

#### 3.2.3 文件夹删除

**功能描述**：
- 支持删除整个文件夹及其所有子文件夹和文件
- 递归删除文件夹内容
- 显示文件夹删除进度

**用户场景**：
1. 用户在右侧远程文件面板选择一个文件夹
2. 右键选择"删除"
3. 系统弹出确认对话框，提示将删除整个文件夹及其内容
4. 用户确认后，系统递归删除文件夹内容
5. 显示删除进度（总文件数、已删除数）

**验收标准**：
- [ ] 支持递归删除文件夹
- [ ] 删除前提示将删除整个文件夹及其内容
- [ ] 树形进度中显示文件夹层级结构
- [ ] 显示文件夹删除总体进度
- [ ] 支持删除空文件夹
- [ ] 支持删除深层级文件夹
- [ ] 使用统一树形组件显示删除进度

#### 3.2.4 删除确认对话框

**功能描述**：
- 删除前显示确认对话框
- 显示待删除的文件/文件夹数量和列表
- 提供"不再提示"选项（可选）

**对话框内容**：
```
确认删除

确定要删除以下 3 个文件/文件夹吗？

📁 folder1/
📄 file1.txt
📄 file2.txt

此操作不可撤销。

☐ 不再提示（可选）

[取消] [删除]
```

**验收标准**：
- [ ] 显示待删除项的数量
- [ ] 显示待删除项的名称列表
- [ ] 提示此操作不可撤销
- [ ] 提供"不再提示"选项
- [ ] 支持键盘操作（Enter 确认，Esc 取消）

#### 3.2.5 删除进度显示

**功能描述**：
- 使用 **SftpTransferTreeNode 组件**实时显示删除进度
- 文件夹作为父节点，文件和子文件夹作为子节点
- 支持展开/收起文件夹节点
- 显示已删除数量、总数量
- 每个节点显示独立的删除状态

**列显示规则**：

| 列名称 | 删除场景显示规则 |
|--------|-----------------|
| 名称列 | ✅ 始终显示（文件名/文件夹名 + 图标） |
| 状态列 | ✅ 始终显示（等待中、删除中、已完成、错误、已取消） |
| 进度列 | ⚠️ 仅显示 0%（未开始）和 100%（已完成），删除是原子操作 |
| 大小列 | ✅ 始终显示（文件/文件夹大小） |
| 本地路径列 | ✅ 删除本地文件时显示本地路径，删除远程文件时显示 `-` |
| 箭头列 | ✅ 始终显示 `×`（表示删除操作） |
| 远程路径列 | ✅ 删除远程文件时显示远程路径，删除本地文件时显示 `-` |
| 速度列 | ❌ 删除操作不显示速度（显示 `-`） |
| 估计剩余列 | ✅ 显示估计剩余时间（批量删除时） |
| 经过时间列 | ✅ 显示已用时间 |

**树形结构示例**：

**删除本地单文件：**
```
📄 file.txt
├─ 状态：已完成 ✓
├─ 进度：0%
├─ 大小：1.2 KB
├─ 本地路径：D:\project\file.txt
├─ 远程路径：-
├─ 速度：-
├─ 估计剩余：-
└─ 经过时间：00:00:01
```

**删除远程单文件：**
```
📄 file.txt
├─ 状态：已完成 ✓
├─ 进度：0%
├─ 大小：1.2 KB
├─ 本地路径：-
├─ 远程路径：/home/file.txt
├─ 速度：-
├─ 估计剩余：-
└─ 经过时间：00:00:01
```

**批量删除（混合本地）：**
```
📁 删除任务 (2/5)
├─ 📄 file1.txt
│  ├─ 状态：已完成 ✓
│  ├─ 进度：0%
│  ├─ 大小：1.2 KB
│  ├─ 本地路径：D:\file1.txt
│  └─ 经过时间：00:00:01
├─ 📄 file2.txt
│  ├─ 状态：删除中 ⏳
│  ├─ 进度：0%
│  ├─ 大小：3.4 KB
│  ├─ 本地路径：D:\file2.txt
│  ├─ 估计剩余：00:00:05
│  └─ 经过时间：00:00:02
├─ 📁 folder1/ (0/2)
│  ├─ 📄 file3.txt
│  │  ├─ 状态：等待中
│  │  ├─ 进度：0%
│  │  ├─ 大小：0 B
│  │  └─ 本地路径：D:\folder1\file3.txt
│  └─ 📄 file4.txt
│     ├─ 状态：等待中
│     ├─ 进度：0%
│     ├─ 大小：0 B
│     └─ 本地路径：D:\folder1\file4.txt
└─ 📄 file5.txt
   ├─ 状态：等待中
   ├─ 进度：0%
   ├─ 大小：2.1 KB
   └─ 本地路径：D:\file5.txt
```

**批量删除（混合远程）：**
```
📁 删除任务 (2/5)
├─ 📄 file1.txt
│  ├─ 状态：已完成 ✓
│  ├─ 进度：0%
│  ├─ 大小：1.2 KB
│  ├─ 远程路径：/home/file1.txt
│  └─ 经过时间：00:00:01
├─ 📄 file2.txt
│  ├─ 状态：删除中 ⏳
│  ├─ 进度：0%
│  ├─ 大小：3.4 KB
│  ├─ 远程路径：/home/file2.txt
│  ├─ 估计剩余：00:00:05
│  └─ 经过时间：00:00:02
├─ 📁 folder1/ (0/2)
│  ├─ 📄 file3.txt
│  │  ├─ 状态：等待中
│  │  ├─ 进度：0%
│  │  ├─ 大小：0 B
│  │  └─ 远程路径：/home/folder1/file3.txt
│  └─ 📄 file4.txt
│     ├─ 状态：等待中
│     ├─ 进度：0%
│     ├─ 大小：0 B
│     └─ 远程路径：/home/folder1/file4.txt
└─ 📄 file5.txt
   ├─ 状态：等待中
   ├─ 进度：0%
   ├─ 大小：2.1 KB
   └─ 远程路径：/home/file5.txt
```

**状态说明**：
- ✓ 已完成（`completed`）：文件/文件夹已成功删除
- ⏳ 删除中（`deleting`/`transferring`）：正在删除
- 等待中（`pending`）：等待删除
- ✗ 失败（`error`）：删除失败（显示错误原因）
- 已取消（`cancelled`）：已取消删除

**组件复用**：
- 直接使用 `SftpTransferTreeNode.vue` 组件
- 通过 `node.type` 区分删除操作（`type: 'delete'`）
- 通过 `node.localPath` 和 `node.remotePath` 区分本地/远程删除
- 进度列：删除操作仅显示 0% 或 100%
- 速度列：删除操作显示 `-`（无速度）

**验收标准**：
- [ ] 使用 SftpTransferTreeNode 组件显示删除进度
- [ ] 进度列仅显示 0%（未开始）或 100%（已完成）
- [ ] 删除本地文件时显示本地路径列，远程路径列显示 `-`
- [ ] 删除远程文件时显示远程路径列，本地路径列显示 `-`
- [ ] 箭头列始终显示 `×`
- [ ] 速度列显示 `-`（删除无速度）
- [ ] 估计剩余列和经过时间列正常显示
- [ ] 显示每个节点的删除状态
- [ ] 支持展开/收起文件夹节点
- [ ] 显示总体进度（已完成/总数）
- [ ] 删除失败时显示错误原因
- [ ] 支持取消删除任务

#### 3.2.6 错误处理

**错误场景**：

1. **权限不足**
   - 错误信息：`"权限不足：无法删除文件 '/path/to/file'"`
   - 建议操作：`"请联系管理员或检查文件权限"`

2. **文件被占用**
   - 错误信息：`"文件正在使用中：无法删除 '/path/to/file'"`
   - 建议操作：`"请确保文件未被其他程序使用"`

3. **文件不存在**
   - 错误信息：`"文件不存在：'/path/to/file'"`
   - 建议操作：`"文件可能已被删除，请刷新文件列表"`

4. **网络错误**
   - 错误信息：`"网络错误：删除失败"`
   - 建议操作：`"请检查网络连接后重试"`

**验收标准**：
- [ ] 删除失败时显示明确的错误信息
- [ ] 提供解决建议
- [ ] 支持重试操作
- [ ] 批量删除时，单个失败不影响其他文件删除

---

## 4. 组件设计

### 4.1 组件职责

| 组件 | 职责 | 维护的数据 |
|------|------|-----------|
| **SftpLocal.vue** | 本地文件浏览器，处理本地文件删除 | `deleteTasks`: 本地文件删除任务列表 |
| **SftpRemote.vue** | 远程文件浏览器，处理远程文件删除 | `deleteTasks`: 远程文件删除任务列表 |
| **SftpTransfer.vue** | 统筹管理所有删除任务 | 汇总 Local 和 Remote 的 `deleteTasks` |
| **SftpStatusContainer.vue** | 显示删除进度状态容器 | 使用全局 `transferNodes` |
| **SftpTransferTreeNode.vue** | 显示每个删除节点的详细进度 | 单个 `TransferNode` 数据 |

### 4.2 DeleteTask 数据结构

```typescript
interface DeleteTask {
  id: string              // 任务唯一标识
  name: string            // 文件/文件夹名称
  type: 'file' | 'folder' // 删除类型
  source: 'local' | 'remote' // 删除来源（本地/远程）
  status: 'pending' | 'deleting' | 'completed' | 'failed' | 'cancelled'
  path: string            // 文件路径（本地路径或远程路径）
  size: number            // 文件大小（字节）
  children?: DeleteTask[] // 子任务（文件夹删除时使用）
  error?: string          // 错误信息
  startTime: number       // 开始时间戳
  endTime?: number        // 结束时间戳
}
```

### 4.3 组件间数据流

```
用户操作
  │
  ├─> SftpLocal.vue (本地删除)
  │    └─> 维护本地 deleteTasks
  │         └─> 转换为 TransferNode
  │              └─> 更新全局 transferNodes
  │
  └─> SftpRemote.vue (远程删除)
       └─> 维护远程 deleteTasks
            └─> 转换为 TransferNode
                 └─> 更新全局 transferNodes

SftpTransfer.vue 汇总所有 transferNodes
  └─> SftpStatusContainer.vue 显示
       └─> SftpTransferTreeNode.vue 渲染每个节点
```

### 4.4 TransferNode 转换规则

删除任务转换为通用传输节点：

```typescript
function deleteTaskToTransferNode(task: DeleteTask): TransferNode {
  return {
    id: task.id,
    name: task.name,
    type: 'delete', // 删除操作类型
    isDirectory: task.type === 'folder',
    status: mapDeleteStatus(task.status), // pending, deleting, completed, error, cancelled
    progress: task.status === 'completed' ? 100 : 0, // 删除只有 0% 或 100%
    size: task.size,
    localPath: task.source === 'local' ? task.path : '-',
    remotePath: task.source === 'remote' ? task.path : '-',
    speed: 0, // 删除操作无速度
    remaining: calculateRemaining(task), // 估计剩余时间
    elapsed: calculateElapsed(task), // 经过时间
    children: task.children?.map(child => deleteTaskToTransferNode(child))
  }
}
```

### 4.5 删除逻辑实现

#### 4.5.1 删除远程文件/文件夹

**服务层实现**（`src/main/services/sftp.ts`）：

```typescript
/**
 * 删除远程文件或目录（递归）
 * @param remotePath 远程文件/目录路径
 * @param onProgress 进度回调，返回当前删除的路径
 */
async deleteFile(remotePath: string, onProgress?: (currentPath: string) => void): Promise<void> {
  if (!this.sftpHandle) {
    throw new Error('SFTP not connected')
  }

  return new Promise((resolve, reject) => {
    this.sftpHandle.stat(remotePath, (err: Error, stats: any) => {
      if (err) {
        console.error('SFTPService.deleteFile stat 失败:', { remotePath, error: err.message })
        reject(err)
        return
      }

      if (stats.isDirectory()) {
        console.log('SFTPService.deleteFile 开始删除目录:', { remotePath })
        // 递归删除目录内容
        this.sftpHandle.readdir(remotePath, async (err: Error, entries: any[]) => {
          if (err) {
            console.error('SFTPService.deleteFile readdir 失败:', { remotePath, error: err.message })
            reject(err)
            return
          }

          // 删除所有子文件和子目录
          for (const entry of entries) {
            if (entry.filename === '.' || entry.filename === '..') {
              continue
            }
            const childPath = `${remotePath}/${entry.filename}`
            try {
              if (onProgress) {
                onProgress(childPath)
              }
              await this.deleteFile(childPath, onProgress)
            } catch (error: any) {
              console.error('SFTPService.deleteFile 删除子项失败:', { childPath, error: error.message })
              reject(error)
              return
            }
          }

          // 删除空目录
          this.sftpHandle.rmdir(remotePath, (err: Error) => {
            if (err) {
              console.error('SFTPService.deleteFile rmdir 失败:', { remotePath, error: err.message })
              reject(err)
            } else {
              console.log('SFTPService.deleteFile 删除成功:', { remotePath })
              resolve()
            }
          })
        })
      } else {
        // 删除文件
        console.log('SFTPService.deleteFile 删除文件:', { remotePath })
        this.sftpHandle.unlink(remotePath, (err: Error) => {
          if (err) {
            console.error('SFTPService.deleteFile unlink 失败:', { remotePath, error: err.message })
            reject(err)
          } else {
            resolve()
          }
        })
      }
    })
  })
}
```

**删除流程**：
1. 使用 `stat` 检查目标是文件还是文件夹
2. **如果是文件夹**：
   - 使用 `readdir` 读取所有内容
   - 递归删除每个子项（跳过 `.` 和 `..`）
   - 删除完所有子项后，使用 `rmdir` 删除空目录
3. **如果是文件**：
   - 直接使用 `unlink` 删除文件
4. 每次删除子项前调用 `onProgress` 回调更新进度

#### 4.5.2 删除本地文件/文件夹

**IPC 处理器**（`src/main/ipc/sftp.ts`）：

```typescript
import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import * as path from 'path'

/**
 * 删除本地文件或文件夹（递归）
 */
async function deleteLocalPath(localPath: string, onProgress?: (currentPath: string) => void): Promise<void> {
  try {
    const stats = await fs.stat(localPath)
    
    if (stats.isDirectory()) {
      // 递归删除文件夹内容
      const entries = await fs.readdir(localPath)
      for (const entry of entries) {
        const childPath = path.join(localPath, entry)
        if (onProgress) {
          onProgress(childPath)
        }
        await deleteLocalPath(childPath, onProgress)
      }
      // 删除空文件夹
      await fs.rmdir(localPath)
    } else {
      // 删除文件
      await fs.unlink(localPath)
    }
  } catch (error: any) {
    console.error('删除本地路径失败:', { localPath, error: error.message })
    throw error
  }
}

// 注册 IPC 处理器
ipcMain.handle('sftp:delete-local', async (event, { localPath }) => {
  try {
    await deleteLocalPath(localPath, (currentPath) => {
      // 发送进度到渲染进程
      event.sender.send('sftp:delete-progress', { currentPath })
    })
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})
```

#### 4.5.3 批量删除管理

**删除管理器**（`src/renderer/src/utils/deleteManager.ts`）：

```typescript
import type { DeleteTask } from '@shared/types/sftp'

/**
 * 删除任务管理器
 * 管理批量删除任务的执行和取消
 */
export class DeleteManager {
  private tasks: Map<string, DeleteTask> = new Map()
  private cancelled: boolean = false

  /**
   * 添加删除任务
   */
  addTask(task: DeleteTask): void {
    this.tasks.set(task.id, task)
  }

  /**
   * 执行所有删除任务
   */
  async executeAll(): Promise<void> {
    this.cancelled = false
    
    for (const [taskId, task] of this.tasks) {
      if (this.cancelled) {
        task.status = 'cancelled'
        continue
      }

      task.status = 'deleting'
      task.startTime = Date.now()

      try {
        if (task.source === 'local') {
          await this.executeLocalDelete(task)
        } else {
          await this.executeRemoteDelete(task)
        }
        task.status = 'completed'
        task.endTime = Date.now()
      } catch (error: any) {
        task.status = 'failed'
        task.error = error.message
        task.endTime = Date.now()
      }
    }
  }

  /**
   * 执行本地删除
   */
  private async executeLocalDelete(task: DeleteTask): Promise<void> {
    // 递归删除文件夹
    if (task.type === 'folder') {
      await this.deleteFolderRecursively(task)
    } else {
      // 删除单个文件
      await window.electronAPI.deleteLocalFile(task.path)
    }
  }

  /**
   * 执行远程删除
   */
  private async executeRemoteDelete(task: DeleteTask): Promise<void> {
    // 递归删除远程文件夹
    if (task.type === 'folder') {
      await this.deleteRemoteFolderRecursively(task)
    } else {
      // 删除单个文件
      await window.electronAPI.deleteRemoteFile(task.path)
    }
  }

  /**
   * 递归删除本地文件夹
   */
  private async deleteFolderRecursively(task: DeleteTask): Promise<void> {
    // 实现递归删除逻辑
  }

  /**
   * 递归删除远程文件夹
   */
  private async deleteRemoteFolderRecursively(task: DeleteTask): Promise<void> {
    // 实现递归删除逻辑
  }

  /**
   * 取消所有删除任务
   */
  cancel(): void {
    this.cancelled = true
    for (const task of this.tasks.values()) {
      if (task.status === 'pending') {
        task.status = 'cancelled'
      }
    }
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(taskId: string): DeleteTask | undefined {
    return this.tasks.get(taskId)
  }
}
```

---

## 5. 非功能需求

### 4.1 性能需求

| 指标 | 要求 |
|------|------|
| 删除响应时间 | < 100ms |
| 批量删除 | 支持同时删除 100+ 个文件 |
| 大文件夹删除 | 支持删除 1000+ 文件的文件夹 |

### 4.2 安全需求

- [ ] 删除前必须确认
- [ ] 删除操作不可撤销
- [ ] 删除系统文件时额外警告

### 4.3 用户体验

- [ ] 删除操作有明确的视觉反馈
- [ ] 进度显示清晰易懂
- [ ] 错误信息友好且可操作

---

## 5. 数据埋点需求

| 事件名称 | 事件类型 | 触发时机 | 事件参数 |
|----------|----------|----------|----------|
| `sftp_delete_start` | 删除开始 | 用户确认删除后 | `count` (删除数量), `type` (single/batch/folder) |
| `sftp_delete_complete` | 删除完成 | 删除任务完成 | `success_count`, `failed_count`, `duration` |
| `sftp_delete_error` | 删除失败 | 删除失败时 | `error_type`, `file_path` |
| `sftp_delete_cancel` | 删除取消 | 用户取消删除 | `deleted_count`, `remaining_count` |

---

## 6. 验收标准

### 6.1 功能验收

- [ ] 支持右键菜单删除单个文件
- [ ] 支持工具栏删除按钮
- [ ] 支持 Delete 快捷键删除
- [ ] 支持批量删除多个文件/文件夹
- [ ] 删除前显示确认对话框
- [ ] 使用树形组件显示删除进度
- [ ] 删除完成后刷新远程文件列表
- [ ] 删除失败时显示错误信息

### 6.2 兼容性验收

- [ ] Windows 10/11 测试通过
- [ ] 支持中文文件名
- [ ] 支持特殊字符文件名

### 6.3 性能验收

- [ ] 删除响应时间 < 100ms
- [ ] 批量删除 100+ 文件不卡顿
- [ ] 大文件夹删除进度流畅

---

## 7. 附录

### 7.1 术语解释

| 术语 | 解释 |
|------|------|
| 单文件删除 | 删除单个文件或文件夹 |
| 批量删除 | 同时删除多个文件/文件夹 |
| 递归删除 | 删除文件夹及其所有内容 |
| 树形进度 | 使用树形结构显示删除进度 |

### 7.2 参考资料

- [SFTP Phase 2 PRD](../prd.md)
- [文件上传 PRD](../upload/prd.md)
- [文件下载 PRD](../download/prd.md)
