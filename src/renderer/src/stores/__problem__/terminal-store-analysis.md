# Terminal Store 问题分析

> 文件路径: `src/renderer/src/stores/terminal.ts`

## 1. 类型安全问题

### 1.1 `createSftpTab` 使用 `any` 类型

**严重程度**: 高

**问题描述**:
`createSftpTab` 函数的 `session` 参数使用 `any` 类型，失去类型安全保护。

**代码位置**:
```typescript
function createSftpTab(title: string, session: any): Tab {
  const tabId = `sftp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const tab: Tab = {
    id: tabId,
    title: `${title} - SFTP`,
    sessionId: session.id || session.host,
    // ...
  }
}
```

**建议修复**:
- 使用 `Session` 类型替代 `any`
- 或定义明确的接口 `{ id?: string; host?: string }`

---

### 1.2 Tab ID 生成可能重复

**严重程度**: 中

**问题描述**:
使用 `Date.now()` + `Math.random()` 生成 ID，在极端情况下（快速连续创建）可能重复。

**代码位置**:
```typescript
id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
id: `sftp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
```

**建议修复**:
- 使用 `crypto.randomUUID()` (现代浏览器支持)
- 或使用计数器 + 时间戳

---

## 2. 数据一致性问题

### 2.1 `closeTab` 未清理终端连接

**严重程度**: 高

**问题描述**:
关闭标签页时仅从列表移除，但未断开终端连接或清理相关资源，可能导致内存泄漏。

**代码位置**:
```typescript
function closeTab(id: string): void {
  const index = tabs.value.findIndex(t => t.id === id)
  if (index !== -1) {
    tabs.value.splice(index, 1)
    terminalSizes.value.delete(id)
    // 缺少断开连接的逻辑
  }
}
```

**建议修复**:
- 在关闭前触发事件，通知主进程断开连接
- 或返回需要清理的连接 ID 列表

---

### 2.2 `switchMode` 逻辑复杂且难以维护

**严重程度**: 中

**问题描述**:
`switchMode` 函数包含大量分支逻辑，难以理解和测试。

**代码位置**:
```typescript
function switchMode(mode: 'ssh' | 'sftp'): void {
  if (currentMode.value !== mode) {
    const previousMode = currentMode.value
    // 50+ 行复杂逻辑
  }
}
```

**建议修复**:
- 拆分为多个小函数：`saveCurrentMode()`, `restoreTargetMode()`, `fallbackToFirstTab()`
- 使用策略模式简化逻辑

---

## 3. 性能问题

### 3.1 频繁使用 O(n) 查找

**严重程度**: 中

**问题描述**:
多个函数使用 `find` 进行线性查找：
- `setActiveTab`: 先 `some` 再赋值
- `updateTabTitle`: O(n)
- `updateTabTerminalId`: O(n)
- `updateTabStatus`: O(n)
- `getTabById`: O(n)

**建议修复**:
- 使用 `Map<string, Tab>` 建立索引
- 或使用 computed 缓存

---

### 3.2 `switchMode` 中多次遍历

**严重程度**: 低

**问题描述**:
`switchMode` 中多次调用 `filter` 和 `find`，导致多次遍历数组。

**建议修复**:
- 一次遍历收集所有需要的信息
- 或预先建立模式 → 标签页的索引

---

## 4. 功能缺失

### 4.1 缺少标签页排序功能

**严重程度**: 低

**问题描述**:
标签页只能按添加顺序显示，无法拖拽排序或按名称排序。

**建议修复**:
- 添加 `reorderTabs(fromIndex, toIndex)` 方法
- 支持拖拽排序

---

### 4.2 缺少标签页持久化

**严重程度**: 低

**问题描述**:
刷新页面后所有标签页丢失，无法恢复上次的工作状态。

**建议修复**:
- 将标签页信息保存到 localStorage
- 启动时恢复未关闭的标签页

---

## 5. 响应式问题

### 5.1 `terminalSizes` 使用 Map 的响应式限制

**严重程度**: 中

**问题描述**:
Vue 3 对 `Map` 的响应式支持有限，直接调用 `set`/`delete` 可能不会触发所有组件更新。

**代码位置**:
```typescript
const terminalSizes = ref<Map<string, TerminalSize>>(new Map())

function updateTerminalSize(id: string, size: TerminalSize): void {
  terminalSizes.value.set(id, size)
}
```

**建议修复**:
- 使用 `Record<string, TerminalSize>` 替代 Map
- 或在 set 后触发更新：`terminalSizes.value = new Map(terminalSizes.value)`

---

### 5.2 `splice` 响应式问题

**严重程度**: 低

**问题描述**:
与 session store 相同，`splice` 在某些边界情况下可能不如直接赋值可靠。

**建议修复**:
```typescript
tabs.value = [...tabs.value.slice(0, index), ...tabs.value.slice(index + 1)]
```

---

## 6. 日志问题

### 6.1 过多调试日志

**严重程度**: 低

**问题描述**:
`switchMode` 函数包含大量 `console.log`，在生产环境可能造成性能问题。

**建议修复**:
- 使用条件日志：`if (import.meta.env.DEV) console.log(...)`
- 或使用日志库控制级别

---

## 总结

| 问题类型 | 数量 | 严重程度 |
|---------|------|---------|
| 类型安全 | 2 | 高/中 |
| 数据一致性 | 2 | 高/中 |
| 性能问题 | 2 | 中/低 |
| 功能缺失 | 2 | 低 |
| 响应式问题 | 2 | 中/低 |
| 日志问题 | 1 | 低 |

**优先修复建议**:
1. 修复 `createSftpTab` 的 `any` 类型
2. 添加关闭标签页时的连接清理逻辑
3. 使用 Map 或索引优化查找性能
4. 简化 `switchMode` 函数逻辑
