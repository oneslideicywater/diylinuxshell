# ErrorDialog Store 问题分析

> 文件路径: `src/renderer/src/stores/errorDialog.ts`

## 1. 数据一致性问题

### 1.1 多个错误同时发生时只保留最后一个

**严重程度**: 高

**问题描述**:
全局单例的错误对话框无法同时显示多个错误。如果短时间内发生多个错误，只有最后一个错误会被显示，其他错误被覆盖丢失。

**代码位置**:
```typescript
function showError(
  errorTitle: string,
  errorMessage: string,
  errorSessionId: string,
  options?: { showRetry?: boolean; showEdit?: boolean }
): void {
  title.value = errorTitle
  message.value = errorMessage
  sessionId.value = errorSessionId
  // 直接覆盖，之前的错误丢失
  visible.value = true
}
```

**建议修复**:
- 使用错误队列：`const errorQueue = ref<ErrorInfo[]>([])`
- 当前错误关闭后自动显示下一个
- 或支持多实例对话框

---

### 1.2 `closeError` 重置状态可能干扰异步操作

**严重程度**: 中

**问题描述**:
关闭对话框时立即重置所有状态，如果有异步操作依赖这些状态（如重试），可能获取到空值。

**代码位置**:
```typescript
function closeError(): void {
  visible.value = false
  title.value = '连接失败'
  message.value = ''
  sessionId.value = ''
  showRetry.value = true
  showEdit.value = true
}
```

**建议修复**:
- 延迟重置：在下一个 tick 或动画结束后重置
- 或返回错误信息供调用方使用

---

## 2. 功能缺失

### 2.1 缺少错误分类和优先级

**严重程度**: 中

**问题描述**:
所有错误都使用相同的对话框，无法区分：
- 致命错误（必须处理）
- 警告（可忽略）
- 信息提示

**建议修复**:
- 添加 `type: 'error' | 'warning' | 'info'` 字段
- 根据类型显示不同图标和样式

---

### 2.2 缺少错误堆栈信息支持

**严重程度**: 中

**问题描述**:
只显示简单的 `message`，不支持显示完整的错误堆栈，不利于调试。

**建议修复**:
- 添加 `stack?: string` 字段
- 提供"查看详情"按钮展开堆栈信息

---

### 2.3 缺少错误去重机制

**严重程度**: 低

**问题描述**:
相同的错误可能多次触发，导致用户反复看到相同的错误对话框。

**建议修复**:
- 添加错误指纹（如 `title + message` 的 hash）
- 短时间内相同错误只显示一次

---

### 2.4 缺少错误上报接口

**严重程度**: 低

**问题描述**:
错误只显示给用户，没有自动上报到日志系统。

**建议修复**:
- 在 `showError` 中调用错误上报 API
- 或提供 `reportError` 选项

---

## 3. 类型安全问题

### 3.1 缺少错误类型定义

**严重程度**: 低

**问题描述**:
错误信息使用字符串，没有结构化的错误类型定义。

**建议修复**:
```typescript
interface ErrorInfo {
  title: string
  message: string
  sessionId: string
  type: 'error' | 'warning' | 'info'
  stack?: string
  code?: string
  timestamp: number
}
```

---

## 4. 用户体验问题

### 4.1 缺少错误操作回调

**严重程度**: 中

**问题描述**:
用户点击"重试"或"编辑"后，没有回调通知调用方，需要调用方自行监听状态变化。

**建议修复**:
- 添加 `onRetry?: () => void` 和 `onEdit?: () => void` 回调
- 或使用 Promise 模式：`showError(...).then(action => {})`

---

### 4.2 硬编码默认标题

**严重程度**: 低

**问题描述**:
默认标题"连接失败"硬编码，不适用于所有错误场景。

**代码位置**:
```typescript
const title = ref('连接失败')

function closeError(): void {
  // ...
  title.value = '连接失败'  // 硬编码
}
```

**建议修复**:
- 使用国际化：`const title = ref(t('error.defaultTitle'))`
- 或根据错误类型动态设置

---

## 5. 架构问题

### 5.1 与 Electron 错误对话框集成不足

**严重程度**: 低

**问题描述**:
作为 Electron 应用，可以使用原生对话框，但当前完全使用自定义实现。

**建议修复**:
- 提供选项使用 Electron 原生对话框
- 或在设置中允许用户选择

---

## 总结

| 问题类型 | 数量 | 严重程度 |
|---------|------|---------|
| 数据一致性 | 2 | 高/中 |
| 功能缺失 | 4 | 中/低 |
| 类型安全 | 1 | 低 |
| 用户体验 | 2 | 中/低 |
| 架构问题 | 1 | 低 |

**优先修复建议**:
1. 实现错误队列支持多错误显示
2. 添加错误操作回调
3. 添加错误分类和优先级
4. 支持错误堆栈信息显示
