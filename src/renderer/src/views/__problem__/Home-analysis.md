# Home 视图问题分析

> 文件路径: `src/renderer/src/views/Home.vue`

## 1. 数据流问题

### 1.1 `handleRetryFromError` 和 `handleEditFromError` 逻辑重复

**严重程度**: 中

**问题描述**:
两个函数完全相同的逻辑，都获取会话后调用 `handleEditSession`，存在代码重复。

**代码位置**:
```typescript
const handleRetryFromError = async (sessionId: string): Promise<void> => {
  const freshSession = await window.api.session.getById(sessionId)
  if (freshSession) {
    handleEditSession(freshSession)
  }
}

const handleEditFromError = async (sessionId: string): Promise<void> => {
  const freshSession = await window.api.session.getById(sessionId)
  if (freshSession) {
    handleEditSession(freshSession)
  }
}
```

**建议修复**:
```typescript
const handleOpenSessionForm = async (sessionId: string): Promise<void> => {
  const freshSession = await window.api.session.getById(sessionId)
  if (freshSession) {
    handleEditSession(freshSession)
  }
}

// 如果未来逻辑不同，再拆分
const handleRetryFromError = handleOpenSessionForm
const handleEditFromError = handleOpenSessionForm
```

---

### 1.2 `handleSaveSession` 缺少错误提示

**严重程度**: 中

**问题描述**:
保存失败时只打印控制台错误，没有向用户显示错误提示。

**代码位置**:
```typescript
} catch (error) {
  console.error('Failed to save session:', error)
  // ❌ 没有用户提示
}
```

**建议修复**:
```typescript
} catch (error) {
  console.error('Failed to save session:', error)
  ElMessage.error('保存会话失败')
}
```

---

## 2. 功能缺失

### 2.1 缺少表单加载状态

**严重程度**: 中

**问题描述**:
保存会话时没有加载状态，用户可以重复点击保存按钮。

**建议修复**:
```typescript
const isSaving = ref(false)

const handleSaveSession = async (data: Partial<Session>) => {
  if (isSaving.value) return
  isSaving.value = true
  try {
    // ... 保存逻辑
  } finally {
    isSaving.value = false
  }
}
```

---

### 2.2 缺少会话创建/更新成功提示

**严重程度**: 低

**问题描述**:
保存成功后没有提示用户操作结果。

**建议修复**:
```typescript
if (editingSession.value) {
  // ...
  ElMessage.success('会话已更新')
} else {
  // ...
  ElMessage.success('会话已创建')
}
```

---

## 3. 代码质量问题

### 3.1 调试日志未清理

**严重程度**: 低

**问题描述**:
`handleEditSession` 中包含多个 `console.log` 调试语句，生产环境不应保留。

**代码位置**:
```typescript
const handleEditSession = async (session: Session | undefined) => {
  console.log('[Home] handleEditSession 被调用, session:', session?.name, 'id:', session?.id)
  // ...
  console.log('[Home] showSessionForm 设置为 true')
}
```

**建议修复**:
- 使用统一的日志工具，支持按环境过滤
- 或清理生产环境不需要的日志

---

### 3.2 `handleEditSession` 中 `getById` 失败后的降级处理不完善

**严重程度**: 中

**问题描述**:
当 `getById` 失败时使用原始 session，但原始 session 的密码可能是加密的，导致表单显示乱码。

**代码位置**:
```typescript
try {
  freshSession = await window.api.session.getById(session.id)
} catch (e) {
  console.warn('[Home] getById 失败, 使用原始 session:', e)
}

if (freshSession) {
  editingSession.value = freshSession
} else {
  editingSession.value = session  // ❌ 可能包含加密密码
}
```

**建议修复**:
- 显示错误提示
- 或确保传入的 session 已经解密

---

### 3.3 直接依赖 Store 而非通过 Props

**严重程度**: 低

**问题描述**:
组件直接导入并使用 `useSessionStore` 和 `useErrorDialogStore`，作为页面级组件这是可以接受的，但如果需要测试或复用会带来困难。

**建议**:
- 作为页面级组件，当前做法可以接受
- 如果需要单元测试，考虑通过 props 或 provide/inject 注入

---

## 4. 架构问题

### 4.1 路由守卫缺失

**严重程度**: 低

**问题描述**:
从设置页面返回主页时，没有检查是否有未保存的更改。

**建议修复**:
- 如果需要，添加路由守卫检查

---

## 总结

| 问题类型 | 数量 | 严重程度 |
|---------|------|---------|
| 数据流 | 2 | 中 |
| 功能缺失 | 2 | 中/低 |
| 代码质量 | 3 | 中/低 |
| 架构问题 | 1 | 低 |

**优先修复建议**:
1. 合并 `handleRetryFromError` 和 `handleEditFromError` 的重复逻辑
2. 添加保存失败的用户提示
3. 添加表单加载状态防止重复提交
4. 清理调试日志
