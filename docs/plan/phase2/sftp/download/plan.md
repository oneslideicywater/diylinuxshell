# SFTP 文件下载功能 - 实现计划

## 1. 概述

本文档详细描述 SFTP 文件下载功能的实现计划，包括单文件下载、文件夹下载、下载取消等功能。

**预计工期**：1-2 天

**前置依赖**：Phase 1 核心功能已完成，SFTP 基础服务已实现

---

## 2. 任务清单

### 2.1 服务层

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| DOWNLOAD-1 | 实现单文件下载 | sftp.ts/download | SFTP 服务基础 | P0 | ✅ 已完成 |
| DOWNLOAD-2 | 实现文件下载进度监听 | sftp.ts/download | DOWNLOAD-1 | P0 | ✅ 已完成 |
| DOWNLOAD-3 | 实现文件夹下载（递归） | sftp.ts/downloadFolder | DOWNLOAD-1 | P1 | ✅ 已完成 |
| DOWNLOAD-4 | 实现下载任务管理 | downloadManager.ts | DOWNLOAD-1 | P0 | ✅ 已完成 |
| DOWNLOAD-5 | 实现取消下载功能 | sftp.ts/cancelDownload | DOWNLOAD-4 | P1 | ✅ 已完成 |
| DOWNLOAD-6 | 实现断点续传（可选） | sftp.ts/resumeDownload | DOWNLOAD-1 | P2 | 待评估 |

### 2.2 状态管理层

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| DOWNLOAD-7 | 实现下载任务状态管理 | globalState.ts | DOWNLOAD-4 | P0 | ✅ 已完成 |
| DOWNLOAD-8 | 实现下载进度更新 | globalState.ts | DOWNLOAD-2 | P0 | ✅ 已完成 |

### 2.3 组件层

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| DOWNLOAD-9 | 实现树形进度显示组件 | SftpTransferTree.vue | DOWNLOAD-7 | P0 | ✅ 已完成 |
| DOWNLOAD-10 | 实现树节点组件 | TreeNode.vue | DOWNLOAD-9 | P0 | ✅ 已完成 |
| DOWNLOAD-11 | 实现文件夹展开/收起功能 | TreeNode.vue | DOWNLOAD-10 | P1 | ✅ 已完成 |

### 2.4 类型定义

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| DOWNLOAD-12 | 定义 DownloadTask 类型 | types/download.ts | - | P0 | ✅ 已完成 |
| DOWNLOAD-13 | 定义 DownloadProgress 类型 | types/download.ts | - | P0 | ✅ 已完成 |
| DOWNLOAD-14 | 定义 DownloadOptions 类型 | types/download.ts | - | P0 | ✅ 已完成 |
| DOWNLOAD-15 | 定义 TreeNode 类型 | types/download.ts | - | P0 | ✅ 已完成 |

### 2.5 测试

| 序号 | 任务 | 产出物 | 依赖 | 优先级 | 状态 |
|------|------|--------|------|--------|------|
| DOWNLOAD-16 | 编写单文件下载 E2E 测试 | download.e2e.spec.ts | DOWNLOAD-1 | P1 | 待开始 |
| DOWNLOAD-17 | 编写文件夹下载 E2E 测试 | download.e2e.spec.ts | DOWNLOAD-3 | P1 | 待开始 |
| DOWNLOAD-18 | 编写取消下载 E2E 测试 | download.e2e.spec.ts | DOWNLOAD-5 | P1 | 待开始 |
| DOWNLOAD-19 | 编写树形进度 E2E 测试 | download.e2e.spec.ts | DOWNLOAD-9 | P1 | 待开始 |
| DOWNLOAD-20 | 编写展开/收起 E2E 测试 | download.e2e.spec.ts | DOWNLOAD-11 | P1 | 待开始 |

---

## 3. 实现顺序

| 阶段 | 序号 | 任务 | 产出物 | 依赖 | 说明 | 状态 |
|------|------|------|--------|------|------|------|
| 1. 类型定义 | DOWNLOAD-12 | 定义 DownloadTask 类型 | types/download.ts | - | 定义下载任务数据结构 | ✅ 已完成 |
| 1. 类型定义 | DOWNLOAD-13 | 定义 DownloadProgress 类型 | types/download.ts | - | 定义下载进度数据结构 | ✅ 已完成 |
| 1. 类型定义 | DOWNLOAD-14 | 定义 DownloadOptions 类型 | types/download.ts | - | 定义下载配置选项 | ✅ 已完成 |
| 1. 类型定义 | DOWNLOAD-15 | 定义 TreeNode 类型 | types/download.ts | - | 定义树节点数据结构 | ✅ 已完成 |
| 2. 服务层 | DOWNLOAD-1 | 实现单文件下载 | sftp.ts/download | 类型定义 | 基础下载功能 | ✅ 已完成 |
| 2. 服务层 | DOWNLOAD-2 | 实现文件下载进度监听 | sftp.ts/download | DOWNLOAD-1 | 实时进度回调 | ✅ 已完成 |
| 2. 服务层 | DOWNLOAD-4 | 实现下载任务管理 | downloadManager.ts | DOWNLOAD-1 | 任务队列管理 | ✅ 已完成 |
| 2. 服务层 | DOWNLOAD-5 | 实现取消下载功能 | sftp.ts/cancelDownload | DOWNLOAD-4 | 支持取消任务 | ✅ 已完成 |
| 2. 服务层 | DOWNLOAD-3 | 实现文件夹下载（递归） | sftp.ts/downloadFolder | DOWNLOAD-1 | 递归下载 | ✅ 已完成 |
| 3. 状态管理层 | DOWNLOAD-7 | 实现下载任务状态管理 | globalState.ts | DOWNLOAD-4 | 全局状态管理 | ✅ 已完成 |
| 3. 状态管理层 | DOWNLOAD-8 | 实现下载进度更新 | globalState.ts | DOWNLOAD-2 | 进度状态同步 | ✅ 已完成 |
| 4. 组件层 | DOWNLOAD-9 | 实现树形进度显示组件 | SftpTransferTree.vue | DOWNLOAD-7 | 树形进度组件 | ✅ 已完成 |
| 4. 组件层 | DOWNLOAD-10 | 实现树节点组件 | TreeNode.vue | DOWNLOAD-9 | 树节点组件 | ✅ 已完成 |
| 4. 组件层 | DOWNLOAD-11 | 实现文件夹展开/收起功能 | TreeNode.vue | DOWNLOAD-10 | 交互功能 | ✅ 已完成 |
| 5. 测试 | DOWNLOAD-16 | 编写单文件下载 E2E 测试 | download.e2e.spec.ts | DOWNLOAD-1 | 基础功能测试 | 待开始 |
| 5. 测试 | DOWNLOAD-17 | 编写文件夹下载 E2E 测试 | download.e2e.spec.ts | DOWNLOAD-3 | 递归下载测试 | 待开始 |
| 5. 测试 | DOWNLOAD-18 | 编写取消下载 E2E 测试 | download.e2e.spec.ts | DOWNLOAD-5 | 取消功能测试 | 待开始 |
| 5. 测试 | DOWNLOAD-19 | 编写树形进度 E2E 测试 | download.e2e.spec.ts | DOWNLOAD-9 | 树形进度测试 | 待开始 |
| 5. 测试 | DOWNLOAD-20 | 编写展开/收起 E2E 测试 | download.e2e.spec.ts | DOWNLOAD-11 | 交互功能测试 | 待开始 |

---

## 4. 技术要点

### 4.1 文件下载流程

1. 选择要下载的文件
2. 创建下载任务
3. 建立 SFTP 连接
4. 读取远程文件内容
5. 写入本地文件系统
6. 监听下载进度
7. 更新任务状态
8. 关闭连接

### 4.2 文件夹下载流程

1. 递归遍历远程文件夹结构
2. 在本地创建对应目录
3. 逐个下载文件
4. 维护文件夹下载进度

### 4.3 取消下载

1. 维护下载任务列表
2. 支持取消单个任务
3. 支持取消所有任务
4. 清理已下载的部分文件

### 4.4 下载路径选择

1. 默认下载到本地当前目录
2. 直接使用左侧文件面板的当前路径
3. 避免文件覆盖冲突

### 4.5 已实现功能

#### 4.5.1 单文件下载
- ✅ 支持右键菜单下载
- ✅ 支持拖拽下载（通过右键菜单触发）
- ✅ 实时进度监听
- ✅ 树形进度显示

#### 4.5.2 文件夹下载
- ✅ 递归下载文件夹
- ✅ 保持原有目录结构
- ✅ 文件夹进度显示
- ✅ 支持展开/收起

#### 4.5.3 下载任务管理
- ✅ 树形进度组件显示所有下载任务
- ✅ 支持取消下载任务
- ✅ 状态管理（pending、transferring、completed、cancelled、error）

#### 4.5.4 进度监听
- ✅ IPC 层进度回调
- ✅ 渲染进程进度更新
- ✅ 速度和剩余时间显示

---

## 5. 风险点

| 风险 | 影响 | 应对措施 | 状态 |
|------|------|----------|------|
| 大文件下载中断 | 需要重新下载 | 考虑实现断点续传 | 待评估 |
| 文件夹层级过深 | 递归性能问题 | 限制最大递归深度 | 待优化 |
| 网络不稳定 | 下载失败 | 增加重试机制 | 待实现 |
| 本地磁盘空间不足 | 无法写入 | 提前检查空间并提示 | 待实现 |
| 文件名不合法 | 本地保存失败 | 文件名转义处理 | 待实现 |

---

## 6. 验收标准

- [x] 单文件下载功能正常
- [x] 文件夹递归下载功能正常
- [x] 下载进度实时显示
- [x] 支持取消下载
- [x] 错误处理完善
- [ ] E2E 测试全部通过
