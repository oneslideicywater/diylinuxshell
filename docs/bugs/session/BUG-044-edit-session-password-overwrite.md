# Bug 4: 编辑会话密码后连接失败

### 问题描述

编辑会话时，修改密码字段后保存，然后点击连接，连接主机失败（即使输入的密码是正确的）。

### 根本原因

编辑会话时，SessionForm 组件会将密码字段清空（`password: ''`），保存时会把这个空字符串传递给后端，导致原有的密码被覆盖为空值。

### 解决方案

在 Home.vue 的 `handleSaveSession` 函数中，判断如果是编辑模式且密码为空，则不更新密码字段。

**修改文件：**

- `src/renderer/src/views/Home.vue`

**关键代码变更：**

```typescript
const handleSaveSession = async (data: Partial<Session>) => {
  try {
    if (editingSession.value) {
      // 更新会话
      // 如果是编辑模式且密码为空，则不更新密码字段（保持原密码）
      const updateData = { ...data }
      if (!data.password && editingSession.value.authType === 'password') {
        delete updateData.password
      }
      const updated = await window.api.session.update(editingSession.value.id, updateData)
      if (updated) {
        sessionStore.updateSession(updated.id, updated)
      }
    } else {
      // 创建会话
      const session = await window.api.session.create(data as Omit<Session, 'id' | 'createdAt' | 'updatedAt'>)
      sessionStore.session.add(session)
    }
    handleCloseSessionForm()
  } catch (error) {
    console.error('Failed to save session:', error)
  }
}
```

### 所属功能

会话管理 — 密码处理

### 修复日期

2026-04-03

### 状态

✅ 已修复
