
```
src/renderer/src/components/session/sftp/
├── index.ts                  # 统一导出
├── transfer-tree.ts          # 树节点操作工具
├── local.ts                  # 本地文件操作工具函数
├── remote.ts                 # 远程文件操作工具函数
├── SftpLocal.vue             # 本地文件浏览器组件
├── SftpRemote.vue            # 远程文件浏览器组件
├── SftpTransfer.vue          # 主组件
├── status/                   # 状态相关组件
│   ├── SftpStatusContainer.vue  # 状态容器组件
│   ├── SftpStatusHeader.vue     # 状态头组件（表头 + 树形列表）
│   └── SftpTransferTreeNode.vue # 树节点组件
└── script/                   # 脚本和工具函数
    ├── globalState.ts        # 全局状态管理
    ├── globalState.test.ts   # 全局状态测试
    └── index.ts              # 脚本导出
```