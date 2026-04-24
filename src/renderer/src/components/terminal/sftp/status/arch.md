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

> 详细实现见 [code.md](./code.md#表头-内容同步滚动)。

### 架构方案

采用 **「内容区持有滚动条 + 表头 transform 跟随」** 模式：

```
┌─ SftpTaskStatus (.sftp-task-status, overflow: hidden) ─────────────┐
│                                                                     │
│  ┌─ SftpStatusHeader (.sftp-transfer-tree) ───────────────────┐    │
│  │  ┌─ .tree-header (transform: translateX(-Npx)) ─────────┐  │    │
│  │  │  ☑ │ 名称 │ 状态 │ 进度 │ 大小 │ 本地路径 │ ...      │  │    │
│  │  └─────────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─ .tree-content (overflow: auto) ← ★ 滚动条持有者 ──────────┐   │
│  │  ☑ AAA-test-upload (0/6) │ 已完成 │ 100% │ 233.8MB │ ...  │   │
│  │    ├── file1.txt  │ ...                                 │   │
│  │    └── file2.txt  │ ...                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                              ▲── 水平+竖向滚动条  │
└─────────────────────────────────────────────────────────────────┘
```

### 数据流

```
用户在 .tree-content 区域滚动（水平或竖向）
  → @scroll.passive="handleContentScroll" 触发
    → headerScrollLeft.value = -target.scrollLeft  （仅同步水平偏移）
      → SftpStatusHeader 接收 prop :header-scroll-left
        → .tree-header 应用 style="{ transform: translateX(${headerScrollLeft}px) }"
          → 表头视觉上跟随内容区水平移动
```

### 设计优势

1. **实现简单**：单层 DOM 结构，无额外嵌套
2. **无循环触发风险**：单向数据流（内容→表头），不需要 `syncingScroll` 防护标志
3. **性能好**：`transform` 触发 GPU 合成层，不触发布局重排

> 完整的 CSS 决策和关键代码见 [code.md](./code.md)。

## 数据来源

所有数据通过 **Pinia Store** (`useSftpTransferStore`) 获取，组件不直接持有数据：

```
SftpTaskStatus.props.taskId
  → sftpTransferStore.transferTasks.find(t => t.id === taskId)
    → task.root?.id        → rootNodeId（渲染树的入口）
    → task.scanningNode    → scanningNodeData（扫描占位）
    → selectedTaskIds.has() → isSelectedComputed（选中状态）
```
