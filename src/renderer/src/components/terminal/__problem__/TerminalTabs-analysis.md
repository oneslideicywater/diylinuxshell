# TerminalTabs 组件问题分析

> 文件路径: `src/renderer/src/components/terminal/TerminalTabs.vue`

## 1. 功能缺失

### 1.1 关闭标签页时未处理 SFTP 连接

**严重程度**: 高

**问题描述**:
关闭标签页时只断开 SSH 连接，没有处理 SFTP 连接，可能导致 SFTP 连接泄漏。

**代码位置**:
```typescript
const handleCloseTab = async (tabId: string) => {
  const tab = terminalStore.getTabById(tabId)
  if (tab) {
    await window.api.session.disconnect(tabId)  // ❌ 只断开 SSH
  }
  terminalStore.closeTab(tabId)
}
```

**建议修复**:
```typescript
const handleCloseTab = async (tabId: string) => {
  const tab = terminalStore.getTabById(tabId)
  if (tab) {
    if (tab.type === 'sftp' && tab.sftpConnectionId) {
      await window.api.sftp.disconnect(tab.sftpConnectionId)
    } else {
      await window.api.session.disconnect(tabId)
    }
  }
  terminalStore.closeTab(tabId)
}
```

---

### 1.2 缺少关闭前确认

**严重程度**: 中

**问题描述**:
如果标签页有正在进行的传输任务，关闭时没有提示用户。

**建议修复**:
- 检查是否有活跃任务
- 显示确认对话框

---

## 2. 代码质量问题

### 2.1 未使用的样式

**严重程度**: 低

**问题描述**:
`.mode-switch-btn` 相关样式在模板中没有使用。

**代码位置**:
```css
.mode-switch-btn {
  /* ... */
}

.mode-switch-btn.sftp-mode {
  /* ... */
}
```

**建议修复**:
- 如果未来需要，保留注释
- 否则删除

---

### 2.2 `tabs` prop 默认值处理

**严重程度**: 低

**问题描述**:
`tabs` prop 默认值为 `undefined`，computed 中需要判断。

**代码位置**:
```typescript
const tabs = computed(() => {
  if (props.tabs) {
    return props.tabs
  }
  return terminalStore.tabs
})
```

**建议修复**:
```typescript
const tabs = computed(() => props.tabs ?? terminalStore.tabs)
```

---

## 3. 架构问题

### 3.1 关闭标签页逻辑应该在 Store 中

**严重程度**: 中

**问题描述**:
关闭标签页涉及断开连接和更新状态，应该在 Store 中统一管理。

**建议修复**:
```typescript
// Store 中
const closeTab = async (tabId: string) => {
  const tab = getTabById(tabId)
  if (tab?.type === 'sftp' && tab.sftpConnectionId) {
    await window.api.sftp.disconnect(tab.sftpConnectionId)
  } else {
    await window.api.session.disconnect(tabId)
  }
  // 更新状态...
}
```

---

## 总结

| 问题类型 | 数量 | 严重程度 |
|---------|------|---------|
| 功能缺失 | 2 | 高/中 |
| 代码质量 | 2 | 低 |
| 架构问题 | 1 | 中 |

**优先修复建议**:
1. 关闭标签页时处理 SFTP 连接断开
2. 将关闭标签页逻辑移到 Store 中
3. 添加关闭前确认（如有活跃任务）
4. 清理未使用的样式
