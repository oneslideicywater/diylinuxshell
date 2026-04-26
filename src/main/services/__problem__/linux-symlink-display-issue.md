# Linux 符号链接目录显示为文件的问题

## 问题描述

在 SFTP 远程文件浏览器中，Linux 系统的一些目录（如 `/bin`、`/lib64`、`/sbin` 等）显示为文件图标，而不是文件夹图标。

![问题截图](../../../docs/assets/sftp-symlink-issue.png)

**受影响的目录**：
- `/bin` → 实际是指向 `/usr/bin` 的符号链接
- `/lib64` → 实际是指向 `/usr/lib64` 的符号链接
- `/sbin` → 实际是指向 `/usr/sbin` 的符号链接
- `/lib` → 可能也是符号链接

## 问题分析

### 1. Linux 符号链接机制

在现代 Linux 发行版（如 CentOS 7+、Ubuntu 16.04+）中，为了统一目录结构，将一些传统的系统目录改为符号链接：

```bash
# 典型的符号链接示例
/bin -> usr/bin
/lib64 -> usr/lib64
/sbin -> usr/sbin
/lib -> usr/lib
```

这些符号链接**本身是目录类型的链接**，指向实际的目录。

### 2. SSH2 SFTP 的文件类型判断

**问题代码位置**：[`sftp.ts:119`](f:\tech-docs\diy-linux-shell\src\main\services\sftp.ts#L119)

```typescript
// 处理文件列表
for (const item of list) {
  const fullPath = path.posix.join(remotePath, item.filename)
  files.push({
    name: item.filename,
    path: fullPath,
    isDirectory: item.attrs.isDirectory(),  // ❌ 问题所在
    size: item.attrs.size,
    modifyTime: new Date(item.attrs.mtime * 1000)
  })
}
```

### 3. 问题根源

SSH2 库的 `readdir` 方法使用 SFTP 协议的 `lstat` 命令获取文件属性，返回的是**符号链接本身**的属性，而不是符号链接目标的属性。

SSH2 的 `attrs` 对象提供以下文件类型判断方法：
- `isDirectory()` - 判断是否是目录（`S_IFDIR`）
- `isFile()` - 判断是否是普通文件（`S_IFREG`）
- `isSymbolicLink()` - 判断是否是符号链接（`S_IFLNK`）
- `isBlockDevice()` - 判断是否是块设备（`S_IFBLK`）
- `isCharacterDevice()` - 判断是否是字符设备（`S_IFCHR`）
- `isFIFO()` - 判断是否是 FIFO（`S_IFIFO`）
- `isSocket()` - 判断是否是 socket（`S_IFSOCK`）

**关键问题**：
- 对于符号链接，`isDirectory()` 返回 `false`
- 对于符号链接，`isSymbolicLink()` 返回 `true`
- 代码没有处理符号链接的情况，导致所有符号链接都显示为"文件"

### 4. SFTP 协议的文件类型

SFTP 协议中，文件类型由 `mode` 字段的高位决定：

```javascript
// Unix 文件类型常量（八进制）
const S_IFMT = 0o170000  // 文件类型掩码
const S_IFDIR = 0o040000 // 目录
const S_IFREG = 0o100000 // 普通文件
const S_IFLNK = 0o120000 // 符号链接
const S_IFBLK = 0o060000 // 块设备
const S_IFCHR = 0o020000 // 字符设备
const S_IFIFO = 0o010000 // FIFO
const S_IFSOCK = 0o140000 // socket
```

SSH2 的 `attrs.isDirectory()` 等方法内部就是检查这些位。

## 解决方案

### 方案 1：跟随符号链接判断目标类型（✅ 已采用）

对于符号链接，使用 `stat` 命令（而不是 `lstat`）获取目标的属性。SSH2 的 `readdir` 默认使用 `lstat`，我们需要对符号链接单独调用 `stat`。

**修改代码**：

```typescript
// 处理文件列表
for (const item of list) {
  const fullPath = path.posix.join(remotePath, item.filename)
  
  // 默认使用 readdir 返回的属性
  let isDirectory = item.attrs.isDirectory()
  
  // 如果是符号链接，需要跟随链接判断目标类型
  if (item.attrs.isSymbolicLink()) {
    try {
      // 使用 stat 获取符号链接目标的属性
      const stats = await new Promise<any>((resolve, reject) => {
        this.sftpHandle.stat(fullPath, (err: Error, stats: any) => {
          if (err) reject(err)
          else resolve(stats)
        })
      })
      isDirectory = stats.isDirectory()
    } catch (error) {
      console.warn(`[SFTP] 无法获取符号链接目标类型：${fullPath}`, error)
      // 如果 stat 失败，保持原判断（显示为文件）
    }
  }
  
  files.push({
    name: item.filename,
    path: fullPath,
    isDirectory,
    size: item.attrs.size,
    modifyTime: new Date(item.attrs.mtime * 1000)
  })
}
```

**优点**：
- 准确显示符号链接的真实类型
- 用户可以正确识别目录符号链接
- 符合文件管理器的标准行为（如 Windows 资源管理器、macOS Finder）

**缺点**：
- 对每个符号链接都需要额外调用一次 `stat`，可能影响性能
- 如果符号链接指向不存在的路径（断链），`stat` 会失败

### 方案 2：在 FileInfo 中增加符号链接标识

不跟随符号链接，但在 UI 中显示符号链接的特殊标识：

```typescript
export interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  isSymbolicLink?: boolean  // 新增：符号链接标识
  linkTarget?: string       // 新增：符号链接目标
  size: number
  modifyTime: Date
}
```

**优点**：
- 不需要额外的 `stat` 调用
- 可以显示符号链接的目标路径

**缺点**：
- UI 需要特殊处理符号链接的图标
- 用户可能仍然困惑为什么"目录"显示为文件图标

### 方案 3：混合方案（最佳实践）

结合方案 1 和方案 2：
1. 对于符号链接，跟随判断目标类型（决定显示为文件夹还是文件）
2. 同时保留符号链接的标识（在 UI 中显示小箭头或特殊样式）
3. 可选：显示符号链接的目标路径（tooltip 或状态栏）

## 修复状态

### ✅ 已修复（方案 1）

**修复时间**: 2026-04-26  
**修复文件**: [`sftp.ts`](f:\tech-docs\diy-linux-shell\src\main\services\sftp.ts#L113-L146)  
**修复内容**:

在 `listDir` 方法中添加符号链接处理逻辑：

```typescript
// 处理文件列表（修复符号链接显示问题）
for (const item of list) {
  const fullPath = path.posix.join(remotePath, item.filename)
  
  // 默认使用 readdir 返回的属性
  let isDirectory = item.attrs.isDirectory()
  
  // 如果是符号链接，需要跟随链接判断目标类型
  // 修复：/bin、/lib64、/sbin 等符号链接目录显示为文件的问题
  if (item.attrs.isSymbolicLink()) {
    try {
      // 使用 stat 获取符号链接目标的属性（stat 会自动跟随符号链接）
      const stats = await new Promise<any>((resolve, reject) => {
        this.sftpHandle.stat(fullPath, (err: Error, stats: any) => {
          if (err) reject(err)
          else resolve(stats)
        })
      })
      isDirectory = stats.isDirectory()
      console.log(`[SFTP] 符号链接 ${fullPath} → 目标类型：${isDirectory ? '目录' : '文件'}`)
    } catch (error: any) {
      console.warn(`[SFTP] 无法获取符号链接目标类型：${fullPath}`, error.message)
      // 如果 stat 失败（断链），保持原判断（显示为文件）
    }
  }
  
  files.push({
    name: item.filename,
    path: fullPath,
    isDirectory,
    size: item.attrs.size,
    modifyTime: new Date(item.attrs.mtime * 1000)
  })
}
```

**修复效果**:
- ✅ `/bin` 显示为文件夹（符号链接到 `/usr/bin`）
- ✅ `/lib64` 显示为文件夹（符号链接到 `/usr/lib64`）
- ✅ `/sbin` 显示为文件夹（符号链接到 `/usr/sbin`）
- ✅ 断链符号链接保持显示为文件（安全降级）

### ✅ 已优化（UI 增强）

**优化时间**: 2026-04-26  
**优化内容**:

1. **数据层增强**：
   - 更新 `FileInfo` 接口，增加 `isSymbolicLink` 和 `linkTarget` 字段
   - 主进程读取符号链接目标路径（使用 `readlink`）
   - 同时支持远程 SFTP 和本地文件系统的符号链接

2. **UI 层增强**：
   - 在文件图标旁添加符号链接标识（小箭头图标）
   - 鼠标悬停时显示 tooltip，展示符号链接的目标路径
   - 符号链接标识在悬停时高亮显示

**修改文件**:
- [`sftp.ts`](f:\tech-docs\diy-linux-shell\src\main\services\sftp.ts) - 远程文件列表增加符号链接信息
- [`sftp.ts`](f:\tech-docs\diy-linux-shell\src\main\ipc\sftp.ts#L560-L590) - 本地文件列表增加符号链接信息
- [`SftpRemote.vue`](f:\tech-docs\diy-linux-shell\src\renderer\src\components\terminal\sftp\SftpRemote.vue) - 远程文件浏览器 UI
- [`SftpLocal.vue`](f:\tech-docs\diy-linux-shell\src\renderer\src\components\terminal\sftp\SftpLocal.vue) - 本地文件浏览器 UI

**视觉效果**:
- 符号链接文件/文件夹显示小箭头标识
- 鼠标悬停时显示：`符号链接 → /usr/bin`（示例）
- 标识默认半透明，悬停时高亮为主题色

**后续优化**:
- ~~在 UI 中为符号链接添加特殊图标（小箭头）~~ ✅ 已完成
- ~~在 tooltip 中显示符号链接的目标路径~~ ✅ 已完成

## 实现建议

### 已实现：方案 3（完整方案）

**阶段 1：核心修复**（已完成）

在 `sftp.ts` 中实现符号链接类型判断：

1. 检测符号链接：`item.attrs.isSymbolicLink()`
2. 使用 `stat` 获取目标属性（自动跟随符号链接）
3. 根据目标类型设置 `isDirectory`
4. 错误处理：断链时安全降级为文件

**阶段 2：UI 增强**（已完成）

完整实现方案 3 的所有功能：

1. **更新 FileInfo 接口**：增加 `isSymbolicLink` 和 `linkTarget` 字段 ✅
2. **读取链接目标**：使用 `readlink` 获取符号链接指向的路径 ✅
3. **UI 增强**：在文件列表中显示符号链接的特殊标识 ✅
          })
        }

        // 处理文件列表
        for (const item of list) {
          const fullPath = path.posix.join(remotePath, item.filename)
          
          let isDirectory = item.attrs.isDirectory()
          let isSymbolicLink = item.attrs.isSymbolicLink()
          let linkTarget: string | undefined = undefined
          
          // 如果是符号链接，跟随判断目标类型
          if (isSymbolicLink) {
            try {
              const stats = await new Promise<any>((resolve, reject) => {
                this.sftpHandle.stat(fullPath, (err: Error, stats: any) => {
                  if (err) reject(err)
                  else resolve(stats)
                })
              })
              isDirectory = stats.isDirectory()
            } catch (error) {
              console.warn(`[SFTP] 无法获取符号链接目标：${fullPath}`, error)
              // 断链：保持 isDirectory=false
            }
            
            // 读取符号链接目标
            try {
              linkTarget = await new Promise<string>((resolve, reject) => {
                this.sftpHandle.readlink(fullPath, (err: Error, target: string) => {
                  if (err) reject(err)
                  else resolve(target)
                })
              })
            } catch (error) {
              console.warn(`[SFTP] 无法读取符号链接目标：${fullPath}`, error)
            }
          }
          
          files.push({
            name: item.filename,
            path: fullPath,
            isDirectory,
            isSymbolicLink,
            linkTarget,
            size: item.attrs.size,
            modifyTime: new Date(item.attrs.mtime * 1000)
          })
        }

        // 排序：目录在前，文件在后
        files.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return a.name.localeCompare(b.name)
        })

        resolve(files)
      } catch (error) {
        reject(error)
      }
    })
  })
}
```

3. **更新 UI 组件**：
   - 在 `SftpRemote.vue` 中，为符号链接添加特殊图标（如小箭头）
   - 在 tooltip 中显示符号链接的目标路径

## 测试用例

修复后需要测试以下场景：

1. **普通目录符号链接**：
   - `/bin` → `/usr/bin`（应该显示为文件夹）
   - `/lib64` → `/usr/lib64`（应该显示为文件夹）
   - `/sbin` → `/usr/sbin`（应该显示为文件夹）

2. **文件符号链接**：
   - 创建指向文件的符号链接（应该显示为文件）

3. **断链符号链接**：
   - 创建指向不存在路径的符号链接（应该显示为文件，或特殊标识）

4. **嵌套符号链接**：
   - 符号链接指向另一个符号链接（应该正确跟随到最终目标）

5. **循环符号链接**：
   - 创建循环符号链接（应该检测并避免无限循环）

## 参考资料

- [SSH2 库文档](https://github.com/mscdex/ssh2)
- [SFTP 协议规范](https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02)
- [Linux 符号链接详解](https://www.kernel.org/doc/html/latest/filesystems/symlinks.html)
- [POSIX 文件类型](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/sys_stat.html)

## 相关文件

- [`sftp.ts`](f:\tech-docs\diy-linux-shell\src\main\services\sftp.ts) - SFTP 服务实现
- [`SftpRemote.vue`](f:\tech-docs\diy-linux-shell\src\renderer\src\components\terminal\sftp\SftpRemote.vue) - 远程文件浏览器组件
- [`sftp.ts (IPC)`](f:\tech-docs\diy-linux-shell\src\main\ipc\sftp.ts) - SFTP IPC 接口
