# Session Store 问题分析

> 文件路径: `src/renderer/src/stores/session.ts`

## 1. 数据一致性问题

### 1.1 删除分组后未清理关联数据

**严重程度**: 高

**问题描述**:
`removeSessionGroup` 函数删除分组后，仅将 `groupId` 设为 `undefined`，但未触发任何事件通知组件更新。如果组件缓存了分组信息，会导致数据不一致。

**代码位置**:
```typescript
function removeSessionGroup(id: string): void {
  const index = sessionGroups.value.findIndex(g => g.id === id)
  if (index !== -1) {
    sessionGroups.value.splice(index, 1)
    // 将该分组下的会话移至未分组
    sessions.value.forEach(s => {
      if (s.groupId === id) {
        s.groupId = undefined
      }
    })
  }
}
```

**建议修复**:
- 使用 `filter` 替代 `splice` 以保持响应式
- 添加事件通知机制或使用 computed 自动更新

---

### 1.2 删除会话未处理关联资源

**严重程度**: 中

**问题描述**:
`removeSession` 仅从列表中移除会话，但未清理可能存在的关联资源（如终端连接、标签页等）。

**代码位置**:
```typescript
function removeSession(id: string): void {
  const index = sessions.value.findIndex(s => s.id === id)
  if (index !== -1) {
    sessions.value.splice(index, 1)
    // 如果移除的是当前激活的会话，清除激活状态
    if (activeSessionId.value === id) {
      activeSessionId.value = ''
    }
  }
}
```

**建议修复**:
- 在删除前触发事件，让其他模块清理关联资源
- 或提供 `beforeRemove` 钩子

---

## 2. 性能问题

### 2.1 频繁使用 O(n) 查找

**严重程度**: 中

**问题描述**:
多个函数使用 `find` 或 `findIndex` 进行线性查找，在大量会话时性能较差：
- `getSessionById`: O(n)
- `updateSession`: O(n)
- `getGroupSessions`: O(n)
- `getSessionGroupById`: O(n)

**建议修复**:
- 使用 `Map` 建立 ID → 对象的索引
- 或使用 computed 缓存分组结果

---

### 2.2 未分组会话计算属性未优化

**严重程度**: 低

**问题描述**:
`ungroupedSessions` 计算属性每次访问都会遍历整个 sessions 数组。

**代码位置**:
```typescript
const ungroupedSessions = computed(() => {
  return sessions.value.filter(s => !s.groupId)
})
```

**建议修复**:
- 如果频繁访问，可考虑使用缓存或索引优化

---

## 3. 类型安全问题

### 3.1 缺少空值处理

**严重程度**: 低

**问题描述**:
`updateSession` 和 `updateSessionGroup` 在找不到目标时静默失败，不返回任何提示。

**代码位置**:
```typescript
function updateSession(id: string, updates: Partial<Session>): void {
  const session = sessions.value.find(s => s.id === id)
  if (session) {
    Object.assign(session, updates, { updatedAt: Date.now() })
  }
}
```

**建议修复**:
- 返回 `boolean` 表示是否成功
- 或抛出错误/警告日志

---

## 4. 功能缺失

### 4.1 缺少批量操作

**严重程度**: 低

**问题描述**:
没有批量删除、批量移动分组等操作，用户操作效率低。

**建议修复**:
- 添加 `removeSessions(ids: string[])` 
- 添加 `moveSessionsToGroup(sessionIds: string[], groupId: string)`

---

### 4.2 缺少排序功能

**严重程度**: 低

**问题描述**:
会话和分组没有排序逻辑，默认按添加顺序显示。

**建议修复**:
- 添加 `sortBy` 配置（按名称、按时间等）
- 提供 `sortSessions()` 方法

---

## 5. 响应式问题

### 5.1 splice 可能不触发响应式

**严重程度**: 中

**问题描述**:
在 Vue 3 中，`splice` 通常能触发响应式，但在某些边界情况下可能不如直接赋值可靠。

**建议修复**:
```typescript
// 更安全的写法
sessionGroups.value = sessionGroups.value.filter(g => g.id !== id)
```

---

## 总结

| 问题类型 | 数量 | 严重程度 |
|---------|------|---------|
| 数据一致性 | 2 | 高/中 |
| 性能问题 | 2 | 中/低 |
| 类型安全 | 1 | 低 |
| 功能缺失 | 2 | 低 |
| 响应式问题 | 1 | 中 |

**优先修复建议**:
1. 修复删除分组后的数据一致性问题
2. 添加索引优化查找性能
3. 改进响应式写法
