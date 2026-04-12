# BUG-024-AppLayout-currentMode 未定义导致模式切换失败

## 📋 Bug 概述

**Bug 编号**: BUG-024  
**发现日期**: 2026-04-11  
**严重程度**: 🔴 高（功能不可用）  
**影响范围**: AppLayout 组件的 SSH/SFTP 模式切换  
**状态**: ✅ 已修复  

---

## 🐛 问题描述

### 现象描述

`AppLayout.vue` 中 `handleModeChange` 函数引用了 `currentMode.value`，但该变量未在 `<script setup>` 中声明，导致 **TypeScript 编译错误：找不到名称 "currentMode"**。

### 复现步骤

1. 打开 AppLayout.vue 文件
2. 定位到第 260-268 行 `handleModeChange` 函数
3. 观察到函数内使用 `currentMode.value = mode`
4. 在整个 `<script setup>` 块中搜索 `currentMode`
5. **预期**: 找到变量声明
6. **实际**: 变量未定义，TypeScript 报错

### 影响范围

- ❌ 无法切换 SSH/SFTP 模式
- ❌ TypeScript 类型检查失败
- ❌ TerminalTabs 的 mode-change 事件无法正常处理

---

## 🔍 根因分析

### 问题代码位置

**文件**: `src/renderer/src/components/layout/AppLayout.vue`  
**行号**: 第 260-268 行（handleModeChange 函数）  
**问题**: 缺少 `currentMode` 变量声明

```typescript
// 问题代码
const handleModeChange = (mode: 'ssh' | 'sftp') => {
  currentMode.value = mode  // ❌ TS2304: Cannot find name 'currentMode'
}
```

### 原因分析

1. 开发者在实现模式切换功能时，添加了 `handleModeChange` 处理函数
2. 但忘记声明响应式变量 `currentMode` 来存储当前模式状态
3. 导致 TypeScript 编译器找不到该变量的定义

---

## 🛠️ 解决方案

### 修复内容

**文件**: `src/renderer/src/components/layout/AppLayout.vue`  
**行号**: 第 147-148 行（新增）

```typescript
// 窗口最大化状态
const isMaximized = ref(false)

// ✅ 新增：当前模式：SSH 或 SFTP
const currentMode = ref<'ssh' | 'sftp'>('ssh')

// 侧边栏宽度相关
```

### 验证方法

1. 运行 `npx tsc --noEmit` 检查类型错误
2. 确认无 AppLayout.vue 相关错误
3. 测试模式切换按钮是否正常工作

---

## 📊 相关信息

| 项目 | 内容 |
|------|------|
| **涉及组件** | AppLayout.vue |
| **影响功能** | SSH/SFTP 模式切换 |
| **修复日期** | 2026-04-11 |
| **修复方式** | 添加 `ref<'ssh' \| 'sftp'>` 声明 |
| **测试状态** | ✅ TypeScript 检查通过 |

---

## 💡 经验教训

1. **先声明后使用**: 添加新功能时，确保所有依赖的变量都已正确声明
2. **及时类型检查**: 每次修改后运行 TypeScript 检查，避免遗漏未定义的变量
3. **完整实现**: 实现事件处理函数时，同时完成相关的状态管理逻辑
