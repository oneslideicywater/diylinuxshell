# BUG-037: SFTP 本地文件列表点击/双击后文本被浏览器原生选中

## 📋 Bug 基本信息

| 属性 | 值 |
|------|-----|
| **Bug ID** | BUG-037 |
| **发现日期** | 2026-04-20 |
| **严重程度** | 🟡 中（UI/UX 问题） |
| **影响范围** | SFTP 本地文件浏览器 (SftpLocal.vue) |
| **修复状态** | ✅ 已修复 |
| **修复日期** | 2026-04-20 |

---

## 🐛 问题描述

### 现象
在 SFTP 本地文件列表中，用户单击或双击文件/文件夹进入子目录时：
- **预期行为**: 文件项正常响应点击/双击，无文本选中效果
- **实际行为**: 所有文件名文字呈现蓝色高亮（浏览器原生 text selection），视觉体验差

### 复现步骤

```
1. 打开 SFTP 窗口，切换到本地文件面板
2. 导航到任意本地目录（如 F:\）
3. 双击某个文件夹进入子目录
4. 观察现象：所有文件名文字都被蓝色高亮选中
```

### 用户反馈截图证据

用户截图显示：F:\ 盘符根目录下所有文件夹名称（$RECYCLE.BIN、BaiduNetdiskDownload、images-percona.zip 等）均呈现蓝色文字选中状态。

---

## 🔍 根因分析

### Bug 所在位置

[SftpLocal.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/terminal/sftp/SftpLocal.vue) 的 `.file-list` CSS 样式缺少 `user-select: none` 属性：

```css
/* ❌ 修复前 */
.file-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
  /* 缺少 user-select: none */
}
```

### 根本原因总结

> **`.file-list` 容器未设置 `user-select: none`**，导致浏览器默认的文本选择机制在以下场景被触发：
> - **双击文件夹**：浏览器默认双击行为会选中单词/整行文本
> - **快速连续点击**：可能触发浏览器的拖拽文本选择
> - **鼠标拖拽经过文件项**：触发范围文本选择

这是 Web 应用中常见的 UI 问题——交互密集型组件（如文件管理器、列表）需要显式禁用原生文本选择。

---

## 🔧 修复方案

### 修复策略：添加 user-select: none

在 `.file-list` CSS 规则中增加 `user-select: none`：

```css
/* ✅ 修复后 */
.file-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
  user-select: none;   /* 禁止文件列表区域的文本选择 */
}
```

### 修复影响范围

| 元素 | 受影响 | 说明 |
|------|--------|------|
| `.file-list` 内的 `.file-item` | ✅ 禁用选择 | 文件项不可选中文本 |
| `.file-list` 内的 `.file-name` | ✅ 禁用选择 | 文件名不可选中文本 |
| `.file-list` 内的 `.file-size` | ✅ 禁用选择 | 文件大小不可选中文本 |
| `.panel-path .path-input`（路径输入框） | ❌ 不受影响 | 输入框不在 `.file-list` 内，仍可正常选中文本 |

---

## 📊 关联信息

### 所属功能模块

| 功能模块 | 组件 | 说明 |
|---------|------|------|
| SFTP 本地文件浏览器 | SftpLocal.vue | 本地文件浏览、导航、选择 |

### 关联测试用例

| 测试文件 | 测试目标 | 状态 |
|---------|---------|------|
| （待补充） | 点击/双击文件不触发文本选中 | 📝 待创建 |

### 相关文档

- **PRD**: [phase2/sftp/prd.md](file:///f:/tech-docs/diy-linux-shell/docs/plan/phase2/sftp/prd.md)
- **关联 Bug**: 无直接关联

---

## 💡 经验教训

1. **交互型组件必须禁用原生文本选择**
   - 文件管理器、表格、列表等需要频繁点击操作的组件
   - 应在容器级别统一设置 `user-select: none`
   
2. **路径输入框需保持可选择性**
   - 路径输入框通常需要用户复制/粘贴路径
   - 确保禁用选择的范围精确，不影响输入类元素

3. **同类问题排查建议**
   - SftpRemote.vue 远程文件列表可能存在相同问题
   - 其他列表型组件也应检查是否缺少 `user-select: none`

---

## 🔄 修复历史

| 日期 | 操作 | 操作人 |
|------|------|--------|
| 2026-04-20 | 发现 Bug（用户反馈截图） | User |
| 2026-04-20 | 根因定位（CSS 缺少 user-select） | Assistant |
| 2026-04-20 | 修复 SftpLocal.vue .file-list 样式 | Assistant |
| 2026-04-20 | 记录 Bug 到文档 | Assistant |

---

*文档版本: v1.0*
*最后更新: 2026-04-20*
