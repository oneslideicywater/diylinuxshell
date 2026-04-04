# BUG-008 - TerminalTab 错误对话框属性未定义

**日期：** 2026-04-04  
**状态：** ✅ 已修复

---

## 复现步骤

1. 打开应用
2. 创建会话
3. 双击会话连接（如果连接失败会触发错误对话框）
4. 查看控制台

**预期结果：** 无控制台报错  
**实际结果：** 控制台报错 "Property "errorDialogMessage" was accessed during render but is not defined on instance."

---

## 原因

在 `TerminalTab.vue` 中使用了错误对话框组件 ErrorDialog，并绑定了 `errorDialogVisible`、`errorDialogTitle`、`errorDialogMessage`、`errorDialogSessionId` 等属性，但是没有在 script 中定义这些属性！

---

## 解决方法

在 TerminalTab.vue 中添加缺少的计算属性，从 errorDialogStore 获取相关状态！

---

## 修复文件

**文件：** `src/renderer/src/components/terminal/TerminalTab.vue:108-112`

---

### 更改前

```typescript
// 右键菜单状态
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })

// 计算属性：是否可以断开会话
```

### 更改后

```typescript
// 右键菜单状态
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })

// 错误对话框相关计算属性
const errorDialogVisible = computed(() => errorDialogStore.visible)
const errorDialogTitle = computed(() => errorDialogStore.title)
const errorDialogMessage = computed(() => errorDialogStore.message)
const errorDialogSessionId = computed(() => errorDialogStore.sessionId)

// 计算属性：是否可以断开会话
```

---

## 相关测试用例

待创建
