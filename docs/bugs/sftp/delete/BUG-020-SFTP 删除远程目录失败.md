# BUG-020: SFTP 删除远程目录失败

## 基本信息
- **编号**: BUG-020
- **标题**: SFTP 删除远程目录失败
- **发现日期**: 2026-04-07
- **状态**: 已修复
- **严重程度**: 高
- **影响模块**: SFTP 文件传输

## 问题描述

用户在使用 SFTP 功能删除远程目录时，删除失败并弹出错误提示框。

### 错误现象
1. 右键点击远程文件夹（如 `/tmp/memcached-operator`）
2. 选择"删除"
3. 弹出错误提示："删除失败：Failure"
4. 文件夹未能被删除

### 错误日志
```
deleteFile 开始删除目录：{ remotePath: '/tmp/memcached-operator' }
deleteFile rmdir 失败：{ remotePath: '/tmp/memcached-operator', error: 'Failure' }
```

## 根本原因

经过分析，问题的根本原因是：

### SSH2 rmdir 方法的限制
- **原因**: SSH2 库的 `rmdir` 方法只能删除**空目录**，不能删除包含文件或子目录的目录
- **位置**: `src/main/services/sftp.ts` 中的 `deleteFile` 方法
- **原始代码**:
  ```typescript
  // 错误的代码 - 直接调用 rmdir 删除目录
  if (stats.isDirectory()) {
    this.sftpHandle.rmdir(remotePath, (err: Error) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  }
  ```

### 为什么失败
当目录非空时（包含文件或子目录），直接调用 `rmdir` 会返回 "Failure" 错误。这与 Linux 的 `rmdir` 命令行为一致，只能删除空目录。

## 解决方案

### 修改文件
1. `src/main/services/sftp.ts`
   - 修改 `deleteFile` 方法，实现递归删除功能
   - 添加必要的日志输出，便于调试

### 实现细节
```typescript
/**
 * 删除远程文件或目录（递归）
 */
async deleteFile(remotePath: string): Promise<void> {
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
              await this.deleteFile(childPath)
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

### 删除流程
1. **判断类型**: 使用 `stat` 判断是文件还是目录
2. **删除目录**:
   - 使用 `readdir` 读取目录内容
   - 遍历所有条目（跳过 `.` 和 `..`）
   - 递归调用 `deleteFile` 删除每个子项
   - 所有子项删除完成后，使用 `rmdir` 删除空目录
3. **删除文件**: 使用 `unlink` 直接删除

### 日志输出
保留了关键的日志输出，便于调试和监控：
- `SFTPService.deleteFile stat 失败` - stat 操作失败
- `SFTPService.deleteFile 开始删除目录` - 开始删除目录
- `SFTPService.deleteFile readdir 失败` - 读取目录失败
- `SFTPService.deleteFile 删除子项失败` - 删除子项失败
- `SFTPService.deleteFile rmdir 失败` - 删除空目录失败
- `SFTPService.deleteFile 删除成功` - 删除成功
- `SFTPService.deleteFile unlink 失败` - 删除文件失败

## 测试验证

### 测试步骤
1. 连接到远程服务器
2. 打开 SFTP 窗口
3. 导航到包含文件和子目录的文件夹
4. 右键点击文件夹，选择"删除"
5. 确认删除

### 测试结果
✅ 成功删除空目录
✅ 成功删除包含文件的目录
✅ 成功删除包含子目录的目录
✅ 成功删除多层嵌套的目录结构
✅ 类型检查通过：`npx tsc --noEmit`
✅ 构建成功：`npm run build`

### 测试日志示例
```
SFTPService.deleteFile 开始删除目录：{ remotePath: '/tmp/tmp' }
deleteFile 删除子项：{ childPath: '/tmp/tmp/vue-test' }
SFTPService.deleteFile 开始删除目录：{ remotePath: '/tmp/tmp/vue-test' }
deleteFile 文件删除成功：{ remotePath: '/tmp/tmp/vue-test/package.json' }
deleteFile 删除成功：{ remotePath: '/tmp/tmp/vue-test' }
deleteFile 子项删除成功：{ childPath: '/tmp/tmp/vue-test' }
deleteFile 删除成功：{ remotePath: '/tmp/tmp' }
```

## 相关文件
- `src/main/services/sftp.ts` - SFTP 服务实现
- `src/renderer/src/components/session/SftpTransfer.vue` - SFTP 文件传输组件
- `src/preload/index.ts` - IPC API 暴露

## 经验教训
1. **理解第三方库的限制**: SSH2 的 `rmdir` 方法只能删除空目录，需要仔细阅读文档
2. **递归处理目录操作**: 删除目录时需要先递归删除所有内容
3. **保留必要的日志**: 在关键节点添加日志输出，便于问题排查
4. **错误处理**: 递归调用时要正确处理错误，避免部分删除成功部分失败
5. **特殊条目处理**: 需要跳过 `.` 和 `..` 特殊目录条目

## 参考链接
- SSH2 文档：https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
- Electron IPC 最佳实践
- Node.js fs 模块文档
