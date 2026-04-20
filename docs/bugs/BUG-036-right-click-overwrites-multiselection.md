# BUG-036: 右键菜单覆盖多选状态导致批量操作只处理单个文件

## 📋 Bug 基本信息

| 属性 | 值 |
|------|-----|
| **Bug ID** | BUG-036 |
| **发现日期** | 2026-04-19 |
| **严重程度** | 🔴 高（核心功能缺陷） |
| **影响范围** | SFTP 批量上传/下载/删除 |
| **修复状态** | ✅ 已修复 |
| **修复日期** | 2026-04-19 |

---

## 🐛 问题描述

### 现象
用户通过 Ctrl+Click 或 Shift+Click 选择多个文件/文件夹后，右键点击任意一个已选中项并选择"上传"操作时：
- **预期行为**: 所有选中的 N 个项目都被上传
- **实际行为**: 只有最后点击的 1 个项目被上传

### 复现步骤

```
1. 打开 SFTP 窗口
2. 导航到包含多个文件的本地目录
3. Ctrl+Click 选择文件 A、B、C（此时应有 3 个高亮项）
4. 在任意一个已选中的文件上右键点击
5. 观察现象：多选高亮消失，只剩右键点击的那 1 个文件被选中
6. 点击"上传"菜单项
7. 结果：只上传了 1 个文件，而非预期的 3 个
```

### 用户反馈截图证据

用户手动测试截图显示：
- 选择 5 个项目（3 文件 + 2 文件夹）
- 底部传输列表只显示了 1 个任务（`.g8` 文件夹）
- 其他 4 个项目未被上传

---

## 🔍 根因分析

### 完整调用链追踪

```
时间线:
  T1: Ctrl+click A → selectedLocals = [A]
  T2: Ctrl+click B → selectedLocals = [A, B]        ← 多选正确建立
  T3: Ctrl+click C → selectedLocals = [A, B, C]     ← 多选保持正确
  T4: 右键 click A → handleContextMenu() 执行:
       │  ❌ setSelectedFiles(connId, [A])           ← 覆盖为单选!
       │  selectedLocals 变成 [A]                    ← 多选状态丢失!
       │  弹出右键菜单...
  T5: 用户点"上传":
       │  uploadPaths = [...selectedLocals] = [A]   ← 只取到 1 个!
       │  emit('upload-batch', [A])
  T6: 最终只上传了 A 文件                            ← ❌ 错误结果
```

### Bug 所在位置

#### 位置 1：[SftpLocal.vue#L279-286](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/terminal/sftp/SftpLocal.vue#L279-L286)

```typescript
// ❌ BUG 代码（修复前）
function handleContextMenu(event: MouseEvent): void {
  const target = event.target as HTMLElement
  const fileItem = target.closest('.file-item') as HTMLElement

  let clickedFile: any = null

  if (fileItem) {
    const path = fileItem.dataset.path
    const file = localFiles.value.find(f => f.path === path)
    if (!file) return
    
    // ❌ 这里无条件覆盖了 Ctrl/Shift 建立的多选！
    sftpSelectionStore.setSelectedFiles(props.connectionId, [file.path])
    clickedFile = file
  }
  
  // ... 后续菜单逻辑使用 selectedLocals（此时已被破坏）
}
```

#### 位置 2：[SftpRemote.vue#L329-337](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/terminal/sftp/SftpRemote.vue#L329-L337)

```typescript
// ❌ 同样的 BUG（下载场景）
function handleContextMenu(event: MouseEvent): void {
  // ...
  if (fileItem) {
    // ❌ 同样无条件覆盖！
    sftpSelectionStore.setSelectedFiles(`remote-${props.connectionId}`, [file.path])
    clickedFile = file
  }
}
```

### 根本原因总结

> **`handleContextMenu` 函数在右键点击时无条件调用了 `setSelectedFiles(connectionId, [file.path])`，将之前通过 Ctrl/Shift 多选建立的 `selectedLocals` 数组从 `[A, B, C]` 覆盖为 `[A]`。后续的 `emit('upload-batch', ...)` 取到的已经是被破坏后的单选状态。**

这是 **多选 + 右键菜单** 场景下的经典 Bug 模式：
- 右键不应改变已有的选中状态
- 或者应在修改前快照当前选中项

---

## 🔧 修复方案

### 修复策略：智能判断是否需要更新选中状态

**核心思路**：在 `handleContextMenu` 中增加条件判断，只在必要时才更新选中状态：

```typescript
if (fileItem) {
  const path = fileItem.dataset.path
  const file = localFiles.value.find(f => f.path === path)
  if (!file) return
  
  clickedFile = file
  
  // ✅ 新增：智能判断
  const currentSelection = sftpSelectionStore.getSelectedFiles(props.connectionId)
  const isAlreadySelected = currentSelection.includes(file.path)
  
  // 只在以下情况才更新选中状态：
  // 1. 当前没有任何选中项（首次右键）
  // 2. 或当前点击的项不在已有选中列表中（右键未选中项）
  if (currentSelection.length === 0 || !isAlreadySelected) {
    sftpSelectionStore.setSelectedFiles(props.connectionId, [file.path])
  }
  // 否则：保留当前的多选状态不变！
}
```

### 修复效果矩阵

| 场景 | 旧行为（Bug） | 新行为（修复） | 结果 |
|------|--------------|---------------|------|
| Ctrl+选 A,B,C → 右键 A | 覆盖为 [A] ❌ | 保持 [A,B,C] ✅ | **正确** |
| 单击 A → 右键 A | 设为 [A] | 设为 [A] | 正常 |
| 空白区 → 右键文件 | 设为 [文件] | 设为 [文件] | 正常 |
| Ctrl+选 A,B → 右键 C（未选中） | 覆盖为 [C] | 覆盖为 [C] | 正确 |

---

## 📊 影响范围分析

### 受影响的功能模块

| 功能模块 | 组件 | 影响程度 | 修复状态 |
|---------|------|---------|---------|
| **📤 批量上传** | SftpLocal.vue + upload.ts | 🔴 严重（完全失效） | ✅ 已修复 |
| **📥 批量下载** | SftpRemote.vue + download.ts | 🔴 严重（同样 Bug） | ⚠️ 部分修复（右键 Bug 已修，downloadBatch 未实现） |
| **🗑️ 本地批量删除** | SftpLocal.vue | 🟡 中等（右键 Bug 导致） | ✅ 已修复 |
| **🗑️ 远程批量删除** | SftpRemote.vue | 🟡 中等（右键 Bug 导致） | ✅ 已修复 |

### 架构层面的影响

除了右键菜单的 Bug 外，还发现了架构设计问题：

**旧架构（❌ 错误）**：
```
选择 N 个项目 → 创建 1 个 TransferTask（包含 N 个子节点）
              → 只处理最后 1 个 ❌
```

**新架构（✅ 正确）**：
```
选择 N 个项目 → 创建 N 个独立的 TransferTask
              → 每个任务独立管理进度、状态、取消 ✅
```

详见 [upload.ts 重构](file:///f:/tech-docs-diy-linux-shell/src/renderer/src/components/terminal/sftp/script/upload.ts#L594-L740)

---

## ✅ 修复验证清单

### 代码层面验证
- [x] TypeScript 类型检查通过 (`vue-tsc --noEmit` → 0 错误)
- [x] SftpLocal.vue handleContextMenu 已修复
- [x] SftpRemote.vue handleContextMenu 已修复
- [x] uploadBatch 已重构为多 TransferTask 架构

### 功能层面验证（待手动测试）
- [ ] Ctrl+Click 多选后右键不丢失选择
- [ ] Shift+Click 范围选择后右键不丢失选择
- [ ] 混合选择文件和文件夹后批量上传全部成功
- [ ] 传输列表显示对应数量的独立任务
- [ ] 批量下载功能正常工作（需实现 downloadBatch）
- [ ] 批量删除功能正常工作

### E2E 测试用例
- [x] 创建了测试文件：`e2e/sftp/batch-upload-complete.e2e.spec.ts`
- [ ] 测试用例待运行验证（Playwright Ctrl+Click 在 Electron 中的兼容性问题待解决）

---

## 🧪 关联测试用例

| 测试文件 | 测试目标 | 状态 |
|---------|---------|------|
| `batch-upload-complete.e2e.spec.ts` | Bug 修复 + 多 TransferTask 架构 | 📝 已创建 |
| `batch-upload-multi-task.e2e.spec.ts` | 多 TransferTask 数量验证 | 📝 已创建 |
| `batch-upload-deep-test.e2e.spec.ts` | TransferTask 树形结构深度验证 | 📝 已创建 |

---

## 📚 相关文档

- **PRD**: [phase2/sftp/upload/prd.md](file:///f:/tech-docs/diy-linux-shell/docs/plan/phase2/sftp/upload/prd.md)
- **Plan**: [phase2/sftp/upload/plan.md](file:///f:/tech-docs/diy-linux-shell/docs/plan/phase2/sftp/upload/plan.md)
- **关联 Bug**: 
  - BUG-019 (SFTP 文件夹上传失败)
  - BUG-021 (SFTP 上传进度不显示)
  - BUG-023 (SFTP 上传文件夹树形进度面板不显示)

---

## 💡 经验教训

### 设计原则

1. **右键菜单不应改变选择状态**
   - 右键操作的上下文应该基于"当前选择"，而不是"点击位置"
   - 如果要改变选择，应该在左键点击时完成

2. **状态修改要有明确的意图**
   - 无条件的 `setSelectedFiles()` 是危险的
   - 应该先读取当前状态，再决定是否修改

3. **批量操作应该创建独立任务**
   - 符合用户的直觉预期（选择几个就显示几个）
   - 方便精细控制（单独暂停/取消某个任务）

### 类似模式的其他潜在问题

在以下场景中可能存在类似的"状态覆盖"问题：
- 拖拽开始时的选中状态
- 快捷键触发时的选中状态
- 双击打开时的选中状态

建议对上述场景进行审查。

---

## 🔄 修复历史

| 日期 | 操作 | 操作人 |
|------|------|--------|
| 2026-04-19 | 发现 Bug（用户手动测试反馈） | User |
| 2026-04-19 | 根因定位（完整调用链追踪） | Assistant |
| 2026-04-19 | 修复 SftpLocal.vue handleContextMenu | Assistant |
| 2026-04-19 | 修复 SftpRemote.vue handleContextMenu | Assistant |
| 2026-04-19 | 重构 uploadBatch 为多 TransferTask 架构 | Assistant |
| 2026-04-19 | 类型安全验证 (vue-tsc --noEmit) | Assistant |
| 2026-04-19 | 记录 Bug 到文档 | Assistant |

---

*文档版本: v1.0*
*最后更新: 2026-04-19*
