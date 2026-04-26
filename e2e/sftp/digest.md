# SFTP 测试用例摘要

## 测试职责

测试 SFTP 文件传输功能，包括文件上传/下载、批量操作、取消传输、右键菜单、文件夹操作和传输进度验证。

## 测试文件清单

| 文件 | 描述 |
|------|------|
| [batch-delete.e2e.spec.ts](./batch-delete.e2e.spec.ts) | 批量删除远程文件 |
| [batch-download-complete.e2e.spec.ts](./batch-download-complete.e2e.spec.ts) | 批量下载完整流程 |
| [batch-upload-complete.e2e.spec.ts](./batch-upload-complete.e2e.spec.ts) | 批量上传完整流程 |
| [batch-upload-deep-test.e2e.spec.ts](./batch-upload-deep-test.e2e.spec.ts) | 深层目录批量上传 |
| [batch-upload-multi-task.e2e.spec.ts](./batch-upload-multi-task.e2e.spec.ts) | 多任务批量上传 |
| [batch-upload.e2e.spec.ts](./batch-upload.e2e.spec.ts) | 批量上传基础功能 |
| [bug-032-fileitem-contextmenu-not-show.e2e.spec.ts](./bug-032-fileitem-contextmenu-not-show.e2e.spec.ts) | BUG-032: file-item 右键菜单不弹出修复验证 |
| [bug-033-click-not-close-menu.e2e.spec.ts](./bug-033-click-not-close-menu.e2e.spec.ts) | BUG-033: 左键点击不关闭右键菜单修复验证 |
| [cancel-upload-simple.e2e.spec.ts](./cancel-upload-simple.e2e.spec.ts) | 简单取消上传 |
| [cancel-upload.e2e.spec.ts](./cancel-upload.e2e.spec.ts) | 取消上传完整流程 |
| [sftp-context-menu-global-unique.e2e.spec.ts](./sftp-context-menu-global-unique.e2e.spec.ts) | SFTP 右键菜单全局唯一性 |
| [sftp-local-create-folder.e2e.spec.ts](./sftp-local-create-folder.e2e.spec.ts) | 本地创建文件夹 |
| [sftp-local-refresh.e2e.spec.ts](./sftp-local-refresh.e2e.spec.ts) | 本地文件浏览器刷新 |
| [sftp-transfer.e2e.spec.ts](./sftp-transfer.e2e.spec.ts) | SFTP 窗口打开/关闭、文件上传/下载/删除、新建文件夹、最大化/还原 |
| [sftp-tree-expand-collapse.e2e.spec.ts](./sftp-tree-expand-collapse.e2e.spec.ts) | SFTP 传输树展开/折叠 |
| [sftp-tree-status.e2e.spec.ts](./sftp-tree-status.e2e.spec.ts) | SFTP 树形状态显示 |
| [sftp-tree-upload.e2e.spec.ts](./sftp-tree-upload.e2e.spec.ts) | SFTP 树形上传（文件夹递归上传） |
| [transfer-progress-verify.e2e.spec.ts](./transfer-progress-verify.e2e.spec.ts) | 传输进度验证 |
| [upload-progress-sync.e2e.spec.ts](./upload-progress-sync.e2e.spec.ts) | 上传进度同步 |

## 测试覆盖范围

- SFTP 窗口打开/关闭
- 本地/远程文件列表加载
- 单文件上传/下载
- 文件夹递归上传
- 批量上传/下载
- 取消传输
- 删除文件/文件夹
- 本地/远程创建文件夹
- 传输进度显示和同步
- 右键菜单全局唯一
- 文件列表刷新
- 主题适配
