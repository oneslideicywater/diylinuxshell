# Bug 记录：Tab 切换时终端不切换

## 基本信息

| 项目 | 内容 |
|------|------|
| Bug ID | BUG-001 |
| 发现日期 | 2026-04-01 |
| 严重程度 | 高 |
| 状态 | 已修复 |
| 影响版本 | Phase 1 MVP |
| 修复版本 | Phase 1 MVP |

## 问题描述

### 现象

点击切换 tab 页时，tab 页的样式是切换了（active 类正确切换），但是对应的终端内容没有切换，始终显示同一个终端。

### 复现步骤

1. 创建两个 SSH 会话并连接
2. 点击不同的 tab 页进行切换
3. 观察终端内容

### 预期行为

切换 tab 页后，应该显示对应会话的终端内容，每个 tab 有独立的终端实例。

### 实际行为

所有 tab 共用同一个终端实例，切换 tab 后终端内容不变。

## 根因分析

### 问题代码位置

`src/renderer/src/components/layout/AppLayout.vue`

### 问题原因

原实现只创建了一个 XTerminal 组件实例，通过 `v-if` 条件渲染：

```vue
<!-- 问题代码 -->
<div class="terminal-area">
  <XTerminal v-if="activeTab" :tab="activeTab" />
  <div v-else class="empty-state">
    <p>请选择或创建一个会话</p>
  </div>
</div>
```

这种实现方式的问题：
1. 只有一个 XTerminal 实例
2. 切换 tab 时只是改变了传入的 `tab` prop
3. XTerminal 组件内部会重新初始化终端，导致之前的内容丢失
4. 实际上终端实例没有真正切换

## 解决方案

### 修复方案

为每个 tab 创建独立的终端实例，使用 `v-show` 控制显示：

```vue
<!-- 修复后的代码 -->
<div class="terminal-area">
  <template v-for="tab in tabs" :key="tab.id">
    <XTerminal 
      v-show="tab.id === activeTabId" 
      :tab="tab" 
    />
  </template>
  <div v-if="tabs.length === 0" class="empty-state">
    <p>请选择或创建一个会话</p>
  </div>
</div>
```

### 关键改动

1. 使用 `v-for` 遍历所有 tab，为每个 tab 创建独立的 XTerminal 实例
2. 使用 `v-show` 代替 `v-if`，保持所有终端实例在 DOM 中
3. 通过 `tab.id === activeTabId` 控制显示哪个终端
4. 添加 CSS 样式使终端实例正确定位

### CSS 修改

```css
/* 终端区域 */
.terminal-area {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

/* 每个终端实例占满整个区域，通过 v-show 控制显示 */
.terminal-area :deep(.x-terminal) {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
```

## 测试验证

### 新增测试用例

在 `e2e/tabs.e2e.spec.ts` 中新增以下测试用例：

1. `点击标签页切换到对应终端` - 验证点击 tab 后终端正确切换
2. `当前激活的标签页高亮显示` - 验证 active 样式正确应用
3. `切换标签页后终端内容相应切换` - 核心测试，确保切换后终端也切换
4. `切换标签页后可以在新终端中输入命令` - 验证切换后终端可交互
5. `多个标签页各自保持独立的终端状态` - 验证每个终端状态独立

### 辅助函数

```typescript
/**
 * 辅助函数：获取当前可见的终端元素
 */
async function getVisibleTerminal(): Promise<{ count: number; isVisible: boolean }> {
  const terminals = page.locator('.x-terminal')
  const count = await terminals.count()
  
  let isVisible = false
  for (let i = 0; i < count; i++) {
    const terminal = terminals.nth(i)
    const display = await terminal.evaluate((el) => {
      return window.getComputedStyle(el).display
    })
    if (display !== 'none') {
      isVisible = true
      break
    }
  }
  
  return { count, isVisible }
}
```

### 测试结果

| 测试项 | 结果 |
|--------|------|
| 点击标签页切换到对应终端 | ✅ 通过 |
| 当前激活的标签页高亮显示 | ✅ 通过 |
| 切换标签页后终端内容相应切换 | ✅ 通过 |
| 切换标签页后可以在新终端中输入命令 | ✅ 通过 |
| 多个标签页各自保持独立的终端状态 | ✅ 通过 |

## 影响范围

### 修改的文件

1. `src/renderer/src/components/layout/AppLayout.vue` - 主要修复
2. `e2e/tabs.e2e.spec.ts` - 新增测试用例

### 影响的功能

- 多标签页切换
- 终端状态保持
- SSH 会话管理

## 经验教训

### 设计层面

1. **组件实例管理**：对于需要保持状态的组件，应该为每个数据项创建独立实例，而不是复用单个实例
2. **v-if vs v-show**：
   - `v-if`：条件渲染，切换时会销毁和重建组件
   - `v-show`：始终渲染，只是切换 CSS display 属性
   - 需要保持状态的场景应使用 `v-show`

### 测试层面

1. **测试要验证实际行为**：不能只验证 UI 状态（如 active 类），还要验证功能行为（如终端内容切换）
2. **E2E 测试的重要性**：这个问题在单元测试中不容易发现，E2E 测试能更好地模拟用户实际操作

## 相关文档

- [PRD.md](../PRD.md) - 产品需求文档
- [plan.md](../plan.md) - 实现计划
- [phase1/prd.md](../plan/phase1/prd.md) - Phase 1 PRD
- [phase1/test-report.md](../plan/phase1/test-report.md) - 测试报告
