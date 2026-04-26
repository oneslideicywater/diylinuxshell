# Bug 3: 编辑会话时分组选择器显示为空

### 问题描述

点击编辑会话，打开编辑窗口后，分组选择器显示为空，没有选中会话原来所在的分组。

### 根本原因

SessionForm 组件中，watch 监听 session 变化时，没有将 `session.groupId` 赋值给 `formData.value.groupId`，导致表单数据中的 groupId 始终为空字符串。

### 解决方案

在 watch 函数中，添加 `groupId: session.groupId || ''` 字段。

**修改文件：**

- `src/renderer/src/components/session/SessionForm.vue`

**关键代码变更：**

```typescript
watch(
  () => props.session,
  (session) => {
    if (session) {
      formData.value = {
        name: session.name,
        host: session.host,
        port: session.port,
        username: session.username,
        groupId: session.groupId || '', // 新增这行
        authType: session.authType,
        password: '',
        keyPath: session.keyPath || '',
        keyPassphrase: ''
      }
    }
  },
  { immediate: true }
)
```

### 所属功能

会话管理 — 编辑表单

### 修复日期

2026-04-03

### 状态

✅ 已修复
