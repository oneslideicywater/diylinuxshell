# BUG-019: SFTP 文件夹上传失败

## 基本信息
- **编号**: BUG-019
- **标题**: SFTP 文件夹上传失败
- **发现日期**: 2026-04-07
- **状态**: 已修复
- **严重程度**: 高
- **影响模块**: SFTP 文件传输

## 问题描述

用户在使用 SFTP 功能上传文件夹时，上传失败并弹出错误提示框。

### 错误现象
1. 右键点击本地文件夹，选择"上传文件夹到服务器"
2. 弹出错误提示："上传失败：Failure" 或 "上传失败：No such file"
3. 文件夹未能成功上传到远程服务器

### 错误日志
```
uploadFolder 被调用：{ sessionId: 'session-xxx', localPath: 'D:\\develop\\goworkbunch\\memcached-operator', remotePath: '/memcached-operator' }
SFTPService.uploadFolder 开始上传：{ localPath: 'D:\\develop\\goworkbunch\\memcached-operator', remotePath: '/memcached-operator' }
创建远程目录失败：Failure
uploadFolder error: Failure
```

或

```
uploadFile sftpHandle.open 失败：{
  remotePath: '/memcached-operator/api/v1alpha1/groupversion_info.go',
  error: 'No such file'
}
```

## 根本原因

经过分析，发现了两个相关问题：

### 问题 1：创建远程目录失败
- **原因**: SSH2 库的 `mkdir` 方法需要传入权限模式参数，否则会返回 "Failure" 错误
- **位置**: `src/main/services/sftp.ts` 中的 `mkdir` 方法
- **代码**:
  ```typescript
  // 错误的代码
  this.sftpHandle.mkdir(remotePath, (err: Error) => {
    if (err) {
      reject(err)
    } else {
      resolve()
    }
  })
  
  // 正确的代码
  this.sftpHandle.mkdir(remotePath, { mode: 0o755 }, (err: Error) => {
    if (err) {
      // 处理目录已存在的情况
      if (err.message.includes('Failure') || err.message.includes('already exists')) {
        // 检查目录是否存在
        this.sftpHandle.stat(remotePath, (statErr: Error) => {
          if (statErr) {
            reject(err)
          } else {
            resolve()
          }
        })
      } else {
        reject(err)
      }
    } else {
      resolve()
    }
  })
  ```

### 问题 2：上传文件时父目录不存在
- **原因**: `uploadDirectoryRecursive` 方法在递归上传子目录时，没有先创建远程目录，导致上传文件时父目录不存在
- **位置**: `src/main/services/sftp.ts` 中的 `uploadDirectoryRecursive` 方法
- **代码**:
  ```typescript
  // 错误的代码 - 没有先创建远程目录
  private async uploadDirectoryRecursive(
    localDir: string,
    remoteDir: string,
    onProgress?: (progress: number, currentFile: string) => void
  ): Promise<void> {
    const entries = fs.readdirSync(localDir)
    // ... 直接处理文件和子目录
  }
  
  // 正确的代码 - 先创建远程目录
  private async uploadDirectoryRecursive(
    localDir: string,
    remoteDir: string,
    onProgress?: (progress: number, currentFile: string) => void
  ): Promise<void> {
    // 首先创建远程目录
    try {
      await this.mkdir(remoteDir)
    } catch (error: any) {
      throw error
    }
    
    const entries = fs.readdirSync(localDir)
    // ... 处理文件和子目录
  }
  ```

## 解决方案

### 修改文件
1. `src/main/services/sftp.ts`
   - 修改 `mkdir` 方法，添加权限模式参数并处理目录已存在的情况
   - 修改 `uploadDirectoryRecursive` 方法，在递归上传前先创建远程目录

### 测试验证
1. 右键点击本地文件夹
2. 选择"上传文件夹到服务器"
3. 验证文件夹及其所有子文件夹和文件都成功上传
4. 验证远程目录结构正确创建

### 测试结果
✅ 文件夹上传成功
✅ 所有子文件夹和文件都正确上传
✅ 远程目录结构正确
✅ 类型检查通过：`npx tsc --noEmit`
✅ 构建成功：`npm run build`

## 相关文件
- `src/main/services/sftp.ts` - SFTP 服务实现
- `src/renderer/src/components/session/SftpTransfer.vue` - SFTP 文件传输组件
- `src/preload/index.ts` - IPC API 暴露

## 经验教训
1. 使用第三方库时，需要仔细阅读文档，了解所有必需参数
2. 处理文件系统操作时，要考虑目录不存在的情况
3. 递归上传/下载功能需要确保父目录先创建
4. 添加详细的日志输出有助于快速定位问题

## 参考链接
- SSH2 文档：https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
- Electron IPC 最佳实践
