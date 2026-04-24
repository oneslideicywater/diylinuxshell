---
name: "doc-rules"
description: "项目文档编写规范与路径规则。当创建/编辑文档(digest.md/arch.md/code.md/function-test.md/bug-test.md)、检查文档格式、修复markdown链接路径时调用。"
---

# 文档规则与路径规范

## 一、文档职责划分

| 文档类型 | 文件名 | 存放位置 | 职责 |
|---------|--------|---------|------|
| **函数摘要** | `digest.md` | 代码目录旁（如 `script/digest.md`） | 记录该目录下所有文件的**函数清单**：文件名、导出/内部函数、参数、返回值、一句话说明 |
| **功能+测试对应** | `function-test.md` | `docs/relation/<功能名>/` | 记录**功能和测试用例的对应关系** |
| **Bug追踪** | `bug-test.md` | `docs/relation/<功能名>/` | 记录 **bug 和测试用例的对应关系** + **bug 和所属功能的对应关系**（体现 bug 归属哪个功能模块） |
| **代码分析** | `code.md` | 代码目录旁（如 `script/code.md`） | 存放**代码分析内容**：核心逻辑解读、设计决策原因、关键实现细节 |
| **架构设计** | `arch.md` | 代码目录旁（如 `script/arch.md`） | 存放**架构层面**的内容：模块关系图、分层原则、数据流、接口契约 |

### 路径示例

```
src/renderer/src/components/terminal/sftp/
├── script/
│   ├── digest.md          ← 函数摘要
│   ├── code.md            ← 代码分析（如有）
│   ├── arch.md            ← 架构设计（如有）
│   ├── upload.ts
│   └── ...
├── fsm/
│   ├── digest.md          ← FSM 函数摘要
│   └── ...
docs/relation/sftp-transfer/
├── function-test.md       ← 功能 ↔ 测试用例 对应关系
├── bug-test.md            ← bug ↔ 测试用例 + bug ↔ 功能 对应关系
└── ...
```

---

## 二、写作规范

### 1. 避免重复

- 如果其他文档已经写了详细内容，**不要重复写**，直接加文档链接。
- 示例：状态机的完整转换矩阵、Mermaid 图、聚合规则等详细内容放在 `sftp-transfer-state-machine.md`，`digest.md` 中只写一行链接。

### 2. digest.md 只写必要信息

- **必须写**：文件名、每个**导出函数**的签名和一句话说明
- **可选写**：内部函数（如果对理解模块关键逻辑有帮助）
- **不写**：大段的设计说明、状态流转图、转换矩阵（这些归 code.md / arch.md / relation 文档）
- **不写**：过时的统计信息（如"总计 44 个函数"这种容易过期的数字）

### 3. 保持同步

- 增删函数后**必须更新**对应的 `digest.md`
- 文件重命名后**必须更新**所有引用该文件的文档

### 4. 每个文档职责清晰

- 写内容前先检查：是否已有其他文档覆盖了此内容？
- 如有 → 加链接；无 → 在正确的文档中撰写

### 5. Markdown 链接路径必须可 IDE 跳转

- **相对路径层级必须正确**：从当前文件位置计算到目标的正确 `../` 数量
- **目标文件必须存在**：不存在的文件标注「(待创建)」
- **避免 emoji 乱码**：不在 markdown 链接文本中使用可能导致编码问题的特殊字符
- **验证方法**：在 IDE 中 Ctrl+Click 测试每个链接是否能正确跳转

### 6. function-test.md 格式

记录功能点和对应的单元测试/e2e测试用例：

```markdown
## 功能：上传文件
| 功能点 | 测试文件 | 测试用例描述 |
|--------|---------|-------------|
| 单文件上传 | upload.test.ts | `should upload single file successfully` |
| 批量上传 | upload.test.ts | `should upload batch files with progress` |
| 上传取消 | upload.test.ts | `should cancel upload task correctly` |
```

### 7. bug-test.md 格式

记录 bug 与测试用例、bug 与功能模块的映射：

```markdown
## Bug 追踪表

| Bug 编号 | Bug 描述 | 所属功能 | 对应测试用例 | 状态 |
|----------|---------|---------|-------------|------|
| BUG-021 | 取消后异步回调覆盖状态为完成 | 状态机终态保护 | `cancelled → completed ❌` | 已修复 |
| BUG-XXX | 滑动开关只隐藏completed未隐藏pending | SFTP传输节点过滤 | （待补充） | 待验证 |
```
