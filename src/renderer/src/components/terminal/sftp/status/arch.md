# SFTP Status 模块架构设计

> 本文档记录 `src/renderer/src/components/terminal/sftp/status/` 目录下的组件架构、数据流和核心设计决策。

---

## 组件层级与职责

```
SftpStatusContainer.vue          ← 多任务列表容器（外层）
└── SftpTaskStatus.vue           ← 单个任务状态容器（表头 + 内容）
    ├── SftpStatusHeader.vue     ← 固定表头（列名行）
    ├── ScanningPlaceholderRow.vue ← 扫描中占位行（root 为空时）
    └── SftpTransferTreeNode.vue  ← 树形节点（递归渲染文件/文件夹）
```

| 组件 | 职责 |
|------|------|
| [SftpStatusContainer](./SftpStatusContainer.vue) | 多任务展示容器，遍历 transferTasks 列表 |
| [SftpTaskStatus](./SftpTaskStatus.vue) | 单任务状态容器，协调表头+内容的滚动同步 |
| [SftpStatusHeader](./SftpStatusHeader.vue) | 固定表头，显示列名（复选框、名称、状态、进度等） |
| [ScanningPlaceholderRow](./ScanningPlaceholderRow.vue) | 扫描阶段占位行，展示基础信息 |
| [SftpTransferTreeNode](./SftpTransferTreeNode.vue) | 树形节点，递归渲染传输树 |

---

## 表头-内容同步滚动机制

### 问题背景

表格列数多（11列），当容器宽度不足时需要水平滚动。但表头和内容是**两个独立 DOM 元素**，必须保持水平位置同步。

> 详细实现（CSS 决策、方案对比、关键代码）见 [code.md](./code.md#excel-式表头-内容同步滚动)。

### 架构方案

采用 **「外层水平滚动 + 内层竖向滚动 + 表头 transform 跟随」** 模式（Excel 式布局）：

```
┌─ SftpTaskStatus (overflow-x: auto) ────────────────────────────┐ ★ 水平滚动条
│                                                                 │
│  ┌─ SftpStatusHeader (.tree-header, translateX) ──────────┐    │
│  │  ☑ │ 名称 │ 状态 │ 进度 │ 大小 │ 本地路径 │ ...         │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─ .tree-content (overflow-y: auto; overflow-x: hidden) ──┐   │
│  │  ☑ AAA-test-upload │ 已完成 │ 100% │ 233.8MB │ ...      │   │ ← 仅竖向
│  │    ├── file1.txt                                         │   │
│  │    └── file2.txt                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 数据流

```
用户拖动外层水平滚动条（表头下方）
  → .sftp-task-status @scroll → handleHorizontalScroll(event)
    → headerScrollLeft.value = -target.scrollLeft  （响应式更新）
      → SftpStatusHeader 接收 prop :header-scroll-left
        → .tree-header 应用 style="{ transform: translateX(${headerScrollLeft}px) }"
          → 表头视觉上跟随外层容器同步移动
```

### 设计优势

1. **滚动条位置正确**：水平滚动条紧贴表头下方（Excel 式），符合用户预期
2. **无循环触发风险**：单向数据流（外层→表头），不需要 `syncingScroll` 防护标志
3. **性能好**：`transform` 触发 GPU 合成层，不触发布局重排
4. **表头始终可见**：表头在外层、不在竖向滚动区内，竖向滚动时固定不动

> 完整的 CSS 决策和方案对比见 [code.md](./code.md)。

## 数据来源

所有数据通过 **Pinia Store** (`useSftpTransferStore`) 获取，组件不直接持有数据：

```
SftpTaskStatus.props.taskId
  → sftpTransferStore.transferTasks.find(t => t.id === taskId)
    → task.root?.id        → rootNodeId（渲染树的入口）
    → task.scanningNode    → scanningNodeData（扫描占位）
    → selectedTaskIds.has() → isSelectedComputed（选中状态）
```
