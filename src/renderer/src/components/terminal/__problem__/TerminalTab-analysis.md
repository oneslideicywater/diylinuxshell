# TerminalTab 组件问题分析

> 文件路径: `src/renderer/src/components/terminal/TerminalTab.vue`

## 1. 数据流问题

### 1.1 错误对话框状态未隔离

**严重程度**: 高

**问题描述**:
每个 `TerminalTab` 实例都读取全局 `errorDialogStore`，但多个标签页同时显示错误对话框时会互相覆盖。

**代码位置**:
```typescript
const errorDialogVisible = computed(() => errorDialogStore.visible)
const errorDialogTitle = computed(() => errorDialogStore.title)
const errorDialogMessage = computed(() => errorDialogStore.message)
const errorDialogSessionId = computed(() => errorDialogStore.sessionId)
```

**建议修复**:
- 只在 `errorDialogStore.sessionId === props.tab.sessionId` 时显示对话框
- 或让父组件统一管理错误对话框

---

### 1.2 `handleRetryConnect` 和 `handleEditFromError` 只打印日志

**严重程度**: 高

**问题描述**:
这两个函数只打印 `console.log`，没有实际触发任何操作，用户点击后无响应。

**代码位置**:
```typescript
const handleRetryConnect = (sessionId: string): void => {
  const session = sessionStore.getSessionById(sessionId)
  if (session) {
    console.log('Retry connect for session:', sessionId)
    // ❌ 没有实际操作
  }
}

const handleEditFromError = (sessionId: string): void => {
  const session = sessionStore.getSessionById(sessionId)
  if (session) {
    console.log('Edit session:', sessionId)
    // ❌ 没有实际操作
  }
}
```

**建议修复**:
- 通过事件通知父组件处理
- 或直接调用 Store 方法打开表单

---

## 2. 功能缺失

### 2.1 缺少标签页拖拽排序

**严重程度**: 低

**问题描述**:
不支持拖拽标签页调整顺序。

---

### 2.2 缺少标签页标题编辑

**严重程度**: 低

**问题描述**:
用户无法自定义标签页标题。

---

## 3. 性能问题

### 3.1 每次渲染都计算 `tabStatus`

**严重程度**: 低

**问题描述**:
`tabStatus` 每次都调用 `terminalStore.getTabById`，如果标签页很多，可能影响性能。

**代码位置**:
```typescript
const tabStatus = computed(() => {
  const storeTab = terminalStore.getTabById(props.tab.id)
  return storeTab?.status ?? props.tab.status
})
```

**建议修复**:
- 如果 Store 支持，使用 computed 直接读取状态
- 或让 Store 提供按 ID 订阅的方法

---

## 4. 样式问题

### 4.1 重复的样式定义

**严重程度**: 低

**问题描述**:
以下样式在文件中出现两次：

```css
/* 第一次 */
.terminal-tab.sftp-tab.active .type-icon.sftp-icon {
  color: var(--primary-color, #0e639c);
}

.terminal-tab.sftp-tab.active .tab-title {
  color: var(--tab-text-color, #ffffff);
}

/* 第二次（文件末尾） */
.terminal-tab.sftp-tab.active .type-icon.sftp-icon {
  color: var(--primary-color, #0e639c);
}

.terminal-tab.sftp-tab.active .tab-title {
  color: var(--tab-text-color, #ffffff);
}
```

**建议修复**:
- 删除重复的样式定义

---

### 4.2 颜色值异常

**严重程度**: 低

**问题描述**:
`#41f30bec` 看起来像是一个错误的颜色值（8 位 hex 可能是 rgba 格式）。

**代码位置**:
```css
.terminal-tab.sftp-tab.active .type-icon.sftp-icon.connected {
  color: #41f30bec;  /* ❌ 8 位 hex */
}

.terminal-tab.active .type-icon.ssh-icon.connected {
  color: #41f30bec;  /* ❌ 8 位 hex */
}
```

**建议修复**:
- 确认是否为 `#4ec9b0`（与其他 connected 状态一致）
- 或使用正确的 rgba 格式

---

## 5. 代码质量问题

### 5.1 直接依赖多个 Store

**严重程度**: 中

**问题描述**:
组件直接导入并使用 4 个 Store，作为子组件耦合度较高。

**代码位置**:
```typescript
import { useTerminalStore } from '@/stores/terminal'
import { useSessionStore } from '@/stores/session'
import { useContextMenuStore } from '@/stores/contextMenu'
import { useErrorDialogStore } from '@/stores/errorDialog'
```

**建议修复**:
- 作为标签页组件，当前做法可以接受
- 如果需要测试，考虑通过 props 注入

---

### 5.2 右键菜单位置计算硬编码尺寸

**严重程度**: 低

**问题描述**:
菜单尺寸硬编码为 `menuWidth = 160` 和 `menuHeight = 120`，如果菜单项变化可能不准确。

**建议修复**:
- 使用实际测量或动态计算

---

## 总结

| 问题类型 | 数量 | 严重程度 |
|---------|------|---------|
| 数据流 | 2 | 高 |
| 功能缺失 | 2 | 低 |
| 性能问题 | 1 | 低 |
| 样式问题 | 2 | 低 |
| 代码质量 | 2 | 中/低 |

**优先修复建议**:
1. 修复 `handleRetryConnect` 和 `handleEditFromError` 只打印日志的问题
2. 隔离错误对话框状态，避免多标签页互相覆盖
3. 删除重复的样式定义
4. 修正异常的颜色值 `#41f30bec`
