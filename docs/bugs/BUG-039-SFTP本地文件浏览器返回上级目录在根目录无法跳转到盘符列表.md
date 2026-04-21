# BUG-039-SFTP本地文件浏览器返回上级目录在根目录无法跳转到盘符列表

## 问题描述

SFTP 文件浏览器的本地面板（SftpLocal.vue）在 Windows 系统下，当路径处于盘符根目录（如 `C:\`）时，点击返回上一级按钮无反应，无法跳转到"此电脑"视图显示盘符列表。

## 复现步骤

1. 打开 SFTP 文件传输窗口
2. 连接远程服务器后，观察左侧本地面板
3. 导航到任意盘符的根目录（如 `C:\` 或 `D:\`）
4. 点击路径输入框左侧的 **↑ 返回上级** 按钮
5. **预期**：应跳转到"此电脑"视图，显示所有盘符（C:, D:, E: 等）
6. **实际**：按钮点击无反应，路径保持 `C:\` 不变

## 环境信息

- **操作系统**: Windows 10
- **框架**: Vue 3 + Pinia + TypeScript
- **组件**: SftpLocal.vue
- **Store**: useSftpBrowserStore (sftpBrowser.ts)
- **相关 API**: `window.api.sftp.dirname()` (基于 Node.js path.dirname)

## 根因分析

### 核心问题

**Node.js `path.dirname()` 的特殊行为**：

```
Windows 系统:
path.dirname('D:\\doc\\test') → 'D:\\doc'     ✅ 正常返回父目录
path.dirname('D:\\')        → 'D:\\'          ❌ 返回自身！

Linux/Mac 系统:
path.dirname('/home/user')  → '/home'         ✅ 正常返回父目录
path.dirname('/')           → '/'             ❌ 返回自身！
```

**问题代码**（修复前）：

```typescript
// sftpBrowser.ts - navigateLocalUp() 方法（有 Bug）
async function navigateLocalUp(connectionId: string, drivesPath: string): Promise<void> {
  const currentPath = state.localPath
  
  if (!currentPath || currentPath === drivesPath) return
  
  const result = await window.api.sftp.dirname(currentPath)
  const parentPath = result.data as string
  
  if (parentPath !== currentPath) {  // ❌ 关键判断错误！
    // 当 currentPath='C:\\' 时, parentPath 也是 'C:\\'
    // 条件为 false，导致不执行导航
    state.localPath = parentPath
    await loadLocalFiles(connectionId, drivesPath)
  }
}
```

**Bug 触发场景**：

| 当前路径 | `dirname()` 返回值 | `parentPath !== currentPath` | 是否导航 | 结果 |
|----------|-------------------|---------------------------|---------|------|
| `D:\doc\test` | `D:\doc` | `true` | ✅ 是 | 正常 |
| `D:\doc` | `D:\` | `true` | ✅ 是 | 正常 |
| **`C:\`** | **`C:\`** | **❌ false** | **🔴 否** | **Bug! 不动** |
| **`/`** | **`/`** | **❌ false** | **🔴 否** | **Bug! 不动** |
| `此电脑` | N/A (提前返回) | - | ❌ 否 | 正常（已是最顶层） |

### 设计缺陷

1. **未考虑 `path.dirname()` 边界情况**：根目录调用 dirname 会返回自身
2. **缺少根目录检测逻辑**：没有识别"已在根目录"的特殊状态
3. **缺少跳转到"此电脑"的处理**：根目录应该跳转到虚拟的"此电脑"视图

## 解决方案

### 方案设计

```
┌─────────────────────────────────────────────┐
│          navigateLocalUp 完整流程            │
│                                             │
│  1. 检查是否已在此电脑视图                    │
│     └─ 是 → 直接 return（已是最顶层）        │
│                                             │
│  2. 调用 path.dirname() 获取父目录            │
│     └─ API 调用失败 → 保持原路径不变         │
│                                             │
│  3. 判断父目录与当前路径关系                  │
│     ├─ parentPath === currentPath           │
│     │   └─ 说明已在根目录                     │
│     │       └─ 跳转到"此电脑"视图 ✅          │
│     └─ parentPath !== currentPath           │
│         └─ 正常导航到父目录                   │
│                                             │
└─────────────────────────────────────────────┘
```

### 核心代码实现

```typescript
// sftpBrowser.ts - navigateLocalUp() 方法（修复后）
async function navigateLocalUp(connectionId: string, drivesPath: string): Promise<void> {
  const state = getState(connectionId).local
  const currentPath = state.localPath
  
  // 1. 已在最顶层（"此电脑"视图或空路径）
  if (!currentPath || currentPath === drivesPath) {
    console.log('[sftpBrowser] 已在最顶层，无法继续返回上级')
    return
  }
  
  try {
    // 2. 调用 API 计算父目录
    const result = await window.api.sftp.dirname(currentPath)
    if (!result.success || !result.data) {
      console.warn('[sftpBrowser] 获取父目录失败:', result.error)
      return
    }
    
    const parentPath = result.data as string
    
    // 3. 判断是否到达根目录
    if (parentPath === currentPath) {
      console.log('[sftpBrowser] 已在根目录，跳转到"此电脑"视图')
      state.localPath = drivesPath
      await loadLocalFiles(connectionId, drivesPath)
    } else {
      state.localPath = parentPath
      await loadLocalFiles(connectionId, drivesPath)
    }
  } catch (error: any) {
    console.error('[sftpBrowser] navigateLocalUp 异常:', error)
  }
}
```

### 关键改进点

| 改进项 | 修改前 | 修改后 |
|--------|--------|--------|
| **根目录检测** | 无（依赖 `!==` 判断隐式处理） | 显式判断 `===` |
| **根目录行为** | 保持原路径（不动） | 跳转到"此电脑"视图 |
| **条件逻辑** | `if (parentPath !== currentPath)` | `if (parentPath === currentPath)` |

## 修复文件清单

| 文件 | 修改类型 | 行号 | 主要改动 |
|------|----------|------|----------|
| [sftpBrowser.ts](../../src/renderer/src/stores/sftpBrowser.ts) | **Bug 修复** | L193-L202 | 根目录检测 + 跳转逻辑 |
| [sftpBrowser.test.ts](../../src/renderer/src/stores/__tests__/sftpBrowser.test.ts) | **新增测试** | L26-L29, L405-L501 | Mock 扩展 + 7 个测试用例 |

## 测试验证

### 功能测试用例

| 用例 ID | 场景 | 输入路径 | 预期输出 | 实际结果 | 状态 |
|---------|------|----------|----------|----------|------|
| NAV-001 | 普通目录返回父目录 | `D:\doc\test` | `D:\doc` | `D:\doc` | ✅ 通过 |
| NAV-002 | Windows 盘符根跳转 | `C:\` | `此电脑` | `此电脑` | ✅ 通过 |
| NAV-003 | Linux 根目录跳转 | `/` | `此电脑` | `此电脑` | ✅ 通过 |
| NAV-004 | "此电脑"保持不变 | `此电脑` | `此电脑` | `此电脑` | ✅ 通过 |
| NAV-005 | 空路径保持不变 | `` | `` | `` | ✅ 通过 |
| NAV-006 | API 失败容错 | `D:\projects\test` + mock 失败 | 保持原路径 | 原路径不变 | ✅ 通过 |
| NAV-007 | 连续点击逐级返回 | `D:\a\b\c` × 5次 | 完整路径链 | 全部正确 | ✅ 通过 |

### 单元测试运行命令

```bash
npx vitest run src/renderer/src/stores/__tests__/sftpBrowser.test.ts
```

**测试结果**: **34/34 全部通过** ✅

```
 ✓ useSftpBrowserStore SFTP 文件浏览器状态管理 (34)
   ✓ 状态初始化 (3)
   ✓ 本地文件操作 (7)
   ✓ 远程文件操作 (8)
   ✓ 连接隔离 (3)
   ✓ 清理方法 (3)
   ✓ 边界情况 (3)
   ✓ navigateLocalUp 导航到上级目录 (7)  ← 新增
```

### 类型检查运行命令

```bash
npx vue-tsc --noEmit
```

**结果**: **仅 AlertDialog 预存警告（TS6133）** ✅

## 完整导航规则（修复后）

### Windows 系统导航路径

```
D:\projects\diy-linux-shell\src\components
         ↓ 点击 ↑
D:\projects\diy-linux-shell\src
         ↓ 点击 ↑
D:\projects\diy-linux-shell
         ↓ 点击 ↑
D:\projects
         ↓ 点击 ↑
D:\
         ↓ 点击 ↑ (根目录检测触发)
此电脑  ← 显示所有盘符 [C:] [D:] [E:]
         ↓ 点击 ↑ (已是最顶层)
此电脑  ← 保持不变
```

### Linux/Mac 系统导航路径

```
/home/user/documents/projects
         ↓ 点击 ↑
/home/user/documents
         ↓ 点击 ↑
/home/user
         ↓ 点击 ↑
/home
         ↓ 点击 ↑
/  (根目录)
         ↓ 点击 ↑ (根目录检测触发)
此电脑  ← 显示所有盘符（Linux 下可能为空或挂载点）
         ↓ 点击 ↑ (已是最顶层)
此电脑  ← 保持不变
```

## 相关 Bug 关联

- [BUG-038-SFTP路径输入框文本不显示.md](./BUG-038-SFTP路径输入框文本不显示.md): 同一轮重构中发现的关联问题（已解决）
- 本 Bug 属于 BUG-038 修复后的回归测试中发现的新问题

## 所属功能模块

- **功能**: SFTP 文件浏览器
- **子功能**: 本地文件导航 - 返回上级目录
- **相关组件**: 
  - [SftpLocal.vue](../../src/renderer/src/components/terminal/sftp/SftpLocal.vue) - UI 组件（调用方）
  - [sftpBrowser.ts](../../src/renderer/src/stores/sftpBrowser.ts) - Store（业务逻辑）
- **相关 API**: 
  - `window.api.sftp.dirname()` - 基于 Node.js path.dirname
  - `window.api.sftp.getDrives()` - 获取盘符列表

## 对应测试用例

### 单元测试

**文件位置**: [sftpBrowser.test.ts#L405-L501](../../src/renderer/src/stores/__tests__/sftpBrowser.test.ts#L405-L501)

**测试套件名称**: `navigateLocalUp 导航到上级目录`

**包含测试用例**:
1. `普通目录应返回父目录（如 D:\doc\test → D:\doc）`
2. `Windows 盘符根目录（C:\）应跳转到"此电脑"`
3. `Linux 根目录 / 应跳转到"此电脑"`
4. `"此电脑"视图应保持不变（已是最顶层）`
5. `空路径应保持不变`
6. `API 调用失败时应保持原路径不变`
7. `连续点击应逐级返回（D:\a\b\c → D:\a\b → D:\a → D:\ → 此电脑）`

### E2E 测试建议

暂无专门 E2E 测试用例（建议后续补充）

建议添加场景：
1. `sftp-local-navigate-up.spec.ts`: 验证从深层级目录连续点击返回直到"此电脑"
2. `sftp-root-directory-detection.spec.ts`: 验证不同操作系统根目录的正确识别和跳转

## 技术要点总结

### Node.js path.dirname() 边界行为

```javascript
// Windows
const path = require('path')
path.dirname('C:\\Users\\test\\doc')  // 'C:\\Users\\test'  ✅
path.dirname('C:\\Users\\test')      // 'C:\\Users'       ✅
path.dirname('C:\\Users')            // 'C:\\'            ✅
path.dirname('C:\\')                 // 'C:\\'            ⚠️ 返回自身!
path.dirname('C:')                   // 'C:'              ⚠️ 返回自身!

// Unix/Linux/Mac
path.dirname('/home/user/doc')       // '/home/user'      ✅
path.dirname('/home/user')           // '/home'           ✅
path.dirname('/home')                // '/'               ✅
path.dirname('/')                    // '/'               ⚠️ 返回自身!
```

### 最佳实践

1. **始终检查 `dirname()` 返回值是否等于输入值**
2. **根目录应跳转到应用定义的虚拟视图**（如"此电脑"、"我的电脑"等）
3. **使用已有 API 而非手动字符串操作**（本项目使用 `sftp:dirname` IPC 接口）
4. **完善的边界测试覆盖**（特别是根目录、空路径、API 失败等场景）

## 修复日期

**2026-04-21**

## 修复人员

AI Assistant (前端调试工程师)

## 验收标准

- [x] Windows 盘符根目录（`C:\`、`D:\` 等）能正确跳转到"此电脑"
- [x] Linux 根目录（`/`）能正确跳转到"此电脑"
- [x] "此电脑"视图再次点击返回保持不变
- [x] 普通目录正常返回父目录
- [x] 连续多次点击能完整走完整个导航路径链
- [x] API 调用失败时有容错处理（保持原路径）
- [x] 类型检查通过
- [x] 单元测试全部通过（34/34）
- [x] Bug 文档已记录
