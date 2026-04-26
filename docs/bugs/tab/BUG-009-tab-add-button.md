# BUG-009: 标签栏点击+按钮应该新增标签页

## 问题描述

**发现日期**: 2026-04-02

**严重程度**: 中

**影响范围**: 标签页管理 - 用户交互

**问题描述**: 
标签栏上的+按钮点击后，应该新增一个空白标签页，但当前没有响应或功能不正确。这会影响用户创建多个终端会话的体验。

## 复现步骤

1. 启动应用程序
2. 观察标签栏上的+按钮
3. 点击+按钮
4. 观察是否有新标签页创建

## 预期行为

- 点击+按钮应该创建一个新的空白标签页
- 新标签页应该自动激活
- 用户可以在新标签页中创建新的SSH连接
- 参考xshell的行为标准

## 实际行为

**已确认**：点击+按钮没有任何响应

在 `TerminalTabs.vue` 中，`handleNewTab` 函数只是打印了一个日志，并没有实现创建标签页的功能：

```typescript
const handleNewTab = () => {
  // TODO: 打开会话选择对话框
  console.log('New tab')
}
```

## 根本原因分析

**已确认**：+按钮点击事件未正确处理

1. **事件未触发**：`handleNewTab` 函数没有触发任何有意义的事件
2. **缺少事件传递**：`TerminalTabs` 组件没有向父组件传递事件
3. **功能未实现**：没有实现创建标签页或打开会话选择对话框的功能

### 问题代码

```vue
<!-- TerminalTabs.vue - 修复前 -->
<button class="new-tab-btn" title="新建标签" @click="handleNewTab">
  <!-- SVG 图标 -->
</button>

<script setup lang="ts">
const handleNewTab = () => {
  // TODO: 打开会话选择对话框
  console.log('New tab')
}
</script>
```

## 影响的文件

- `src/renderer/src/components/terminal/TerminalTabs.vue` - 标签页栏组件（已修复）
- `src/renderer/src/components/layout/AppLayout.vue` - 应用布局组件（已修复）

## 解决方案

### 方案 1: 触发新建会话流程（已采用）

点击+按钮时，触发新建会话流程，让用户创建或选择一个会话来创建标签页。

#### 修改 TerminalTabs.vue

添加事件定义和触发：

```vue
<script setup lang="ts">
// 定义事件
const emit = defineEmits<{
  (e: 'new-tab'): void
}>()

/**
 * 新建标签页
 * 修复 BUG-009: 点击+按钮触发新建会话流程
 */
const handleNewTab = () => {
  // 触发新建会话事件，让父组件处理
  emit('new-tab')
}
</script>
```

#### 修改 AppLayout.vue

监听 new-tab 事件并触发 add-session 事件：

```vue
<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="header-center">
        <!-- 修复 BUG-009: 监听 new-tab 事件，触发新建会话流程 -->
        <TerminalTabs @new-tab="emit('add-session')" />
      </div>
    </header>
  </div>
</template>
```

### 工作流程

1. 用户点击标签栏的+按钮
2. `TerminalTabs` 组件触发 `new-tab` 事件
3. `AppLayout` 组件监听到事件，触发 `add-session` 事件
4. `Home.vue` 组件监听到事件，显示 `SessionForm` 表单
5. 用户填写会话信息并保存
6. 用户双击会话连接，创建标签页

### 优点

- ✅ 符合xshell的行为标准
- ✅ 复用现有的新建会话流程
- ✅ 代码改动小，易于维护
- ✅ 用户体验一致

### 注意事项

- 点击+按钮会打开新建会话表单，而不是直接创建空白标签页
- 用户需要填写会话信息并保存后，才能创建标签页
- 如果需要创建空白标签页，需要修改标签页的数据结构（允许sessionId为空）

## 测试计划

1. E2E 测试：
   - 验证+按钮存在且可见
   - 点击+按钮
   - 验证新标签页已创建
   - 验证新标签页已激活
   - 验证可以创建多个标签页

## 状态
- [x] 问题已确认
- [x] 根本原因已分析
- [x] 解决方案已实现
- [x] 测试用例已编写
- [ ] 测试已通过
- [ ] 已合并到主分支

## 备注

这是一个影响用户体验的功能问题，需要按照xshell的行为标准来实现。
