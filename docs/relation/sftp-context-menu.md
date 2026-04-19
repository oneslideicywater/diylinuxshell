# SFTP 右键菜单 - 功能与测试用例对应关系

## 功能概述

SFTP 右键菜单功能覆盖 **本地文件面板（SftpLocal）** 和 **远程文件面板（SftpRemote）** 两个组件，通过 Pinia Store (`contextMenuStore`) 实现全局唯一性管理。

## 功能模块清单

| 模块 | 描述 | 涉及文件 |
|------|------|----------|
| 全局互斥 | Local/Remote 右键菜单同时只能显示一个 | `contextMenu.ts`, `SftpLocal.vue`, `SftpRemote.vue` |
| 位置跟随 | 菜单左上角 = 鼠标右击位置 | `SftpLocal.vue`, `SftpRemote.vue` |
| 左键关闭 | 任意位置左键点击关闭右键菜单 | `SftpLocal.vue`, `SftpRemote.vue` |
| 主题响应 | 菜单样式跟随暗色/亮色主题切换 | `contextMenu.ts`, 各组件 `<style>` |

## 测试用例对应关系

### 单元测试

| 测试文件 | 验证功能 | 对应代码 |
|----------|----------|----------|
| `src/renderer/src/stores/__tests__/contextMenu.test.ts` | Store 状态管理：show/hide/isOwner/互斥 | `stores/contextMenu.ts` |

### E2E 测试

| 测试场景 | 对应 PRD 章节 | 验证内容 | 测试文件 |
|----------|---------------|----------|----------|
| PRD场景1: 全局互斥 | [prd.md#L217-229](../plan/phase2/sftp/prd.md#L217-L229) | 右键Local → 再右键Remote → Local自动关闭 | `sftp-context-menu-global-unique.e2e.spec.ts` |
| PRD场景2: 位置跟随鼠标 | [prd.md#L325-335](../plan/phase2/sftp/prd.md#L325-L335) | 同组件内点击不同文件，菜单位置跟随更新 | 同上 |
| PRD场景3: 左键关闭菜单 | [prd.md#L231-234](../plan/phase2/sftp/prd.md#L231-L234) | 左键点击任意位置，右键菜单关闭 | 同上 |

### E2E 总入口注册

`e2e/all-tests.e2e.spec.ts` 中已注册：
- `SFTP Local和Remote右键菜单全局互斥（PRD场景1）`
- `SFTP同组件内切换文件时菜单位置跟随鼠标（PRD场景2）`
- `SFTP左键点击任意位置关闭右键菜单（PRD场景3）`

## Bug 与测试用例对应关系

| Bug 编号 | Bug 描述 | 修复验证测试 | 测试文件 |
|----------|----------|-------------|----------|
| BUG-029 | 右键菜单位置固定不跟随鼠标 | PRD场景2 | `sftp-context-menu-global-unique.e2e.spec.ts` |
| BUG-030 | SFTP 同时出现两个右键菜单 | PRD场景1 | 同上 |
| BUG-031 | 点击空白区域右键菜单不关闭 | PRD场景3 | 同上 |
| BUG-011 | 多组件右键菜单冲突（历史问题） | PRD场景1 覆盖 | 同上 |
| **BUG-032** | **全局重构后 file-item 右键无法弹出菜单** | **场景1-4** | **`bug-032-fileitem-contextmenu-not-show.e2e.spec.ts`** |
| **BUG-033** | **右键菜单弹出后左键点击 file-item 菜单不消失** | **场景1-3** | **`bug-033-click-not-close-menu.e2e.spec.ts`** |

### BUG-032 详细测试映射

| 场景 | 验证内容 | 结果 |
|------|----------|------|
| 场景1 | 右键 SftpLocal file-item → `.global-context-menu` 弹出 | ✅ |
| 场景2 | 右键 SftpRemote file-item → `.global-context-menu` 弹出 | ✅ |
| 场景3 | 左键点击空白区域 → 已打开的菜单关闭 | ✅ |
| 场景4 | 按 ESC 键 → 已打开的菜单关闭 | ✅ |

### BUG-033 详细测试映射

| 场景 | 验证内容 | 结果 |
|------|----------|------|
| 场景1 | 右键弹出菜单 → 左键点击另一个 file-item → 菜单关闭 | ✅ |
| 场景2 | 右键弹出菜单 → 左键点击空白区域 → 菜单关闭 | ✅ |
| 场景3 | 远程面板同样验证（右键→左键→关闭） | ✅ |
