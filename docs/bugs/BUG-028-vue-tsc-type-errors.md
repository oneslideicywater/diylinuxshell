# BUG-028: vue-tsc 类型错误全面修复

> 检测时间: 2026-04-18  
> 检测工具: `npx vue-tsc --noEmit`  
> 错误总数: 18 个 / 12 个文件  
> 修复状态: ✅ 全部完成 (exit code: 0)

## 问题背景

之前使用 `npx tsc --noEmit` 检查类型，但 **tsc 不解析 Vue SFC 的 `<script setup>`**，导致 `.vue` 文件中的类型错误全部漏检。切换为 `vue-tsc` 后发现 18 个错误。

## 修复清单

### P0 - Session 组件（本次重构涉及）✅

| # | 文件 | 行 | 错误码 | 描述 | 修复方式 |
|---|------|---|--------|------|---------|
| 1 | SessionSidebarContainer.vue | L118 | TS6133 | `GroupIcon` 导入未使用 | 删除 import |
| 2 | SessionSidebarContainer.vue | L122 | TS6133 | `MAX_GROUP_DEPTH` 导入未使用 | 删除 import |
| 3 | SessionSidebarContainer.vue | L224 | TS6133 | `getGroupSessions` 解构未使用 | 从解构中移除 |
| 4 | SessionSidebarContainer.vue | L723 | TS6133 | `event` 参数未使用 | 改为 `_event` |

### P1 - TS6133 未使用变量/导入 ✅

| # | 文件 | 行 | 未使用项 | 修复方式 |
|---|------|---|---------|---------|
| 5 | ConfirmDialog.vue | L37 | `ref` | 从 import 移除 |
| 6 | AppLayout.vue | L159 | `activeTab` 计算属性 | 删除定义 |
| 7 | GroupTreeSelect.vue | L53 | `onMounted` | 从 import 移除 |
| 8 | SessionForm.vue | L337 | `onMounted` | 从 import 移除 |
| 9 | SftpRemote.vue | L164 | `currentSession` 计算属性 | 删除定义及依赖的 sessionStore |
| 10 | SftpRemote.vue | L388 | `event` 参数 | 改为 `_event` |
| 11 | SftpTaskStatus.vue | L37 | `props` | 改为直接调用 defineProps() |
| 12 | TerminalTab.vue | L103 | `emit` | 改为直接调用 defineEmits() |
| 13 | TerminalTabs.vue | L36 | `ref` | 从 import 移除 |
| 14 | TerminalTabs.vue | L44 | `sessionStore` | 删除变量及 import |

### P2 - 类型不兼容 ✅

| # | 文件 | 行 | 错误码 | 描述 | 修复方式 |
|---|------|---|--------|------|---------|
| 15 | SftpTransfer.vue | L53,63 | TS2345 | `confirmNewFolder` 参数类型不兼容 | 签名改为 `string \| Event` |
| 16 | Settings.vue | L36 | TS2322 | Slider `@change` 签名不匹配 | 改为 `number \| number[]` |
| 17 | Settings.vue | L127 | TS2322 | Switch `@change` 签名不匹配 | 改为 `string \| number \| boolean` |

## 额外发现并修复（连锁反应）

| # | 文件 | 问题 | 修复 |
|---|------|------|------|
| + | SftpRemote.vue | 删除 currentSession 后 sessionStore 变未使用 | 连锁删除 |
| + | GroupHeader.vue | L171 `zIndex: 1000` number→string | 改为 `'1000'` |
| + | SessionItem.vue | L232 `zIndex: 1000` number→string | 改为 `'1000'` |
| + | globalState.test.ts | 缺少 vitest 类型声明 | 补充 import |

## 经验总结

1. **工具选择**：Vue 项目必须用 `vue-tsc --noEmit`，不能用 `tsc --noEmit`
2. **检查流程**：每次改完代码应执行 `vue-tsc` + `eslint` 双重验证
3. **连锁删除**：删除变量后需检查其依赖是否也变为未使用
4. **规则更新**：已将 `.trae/rules/disable.md` 第 2 条更新为推荐 vue-tsc
