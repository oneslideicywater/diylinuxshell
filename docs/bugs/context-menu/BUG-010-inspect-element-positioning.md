# BUG-010: 审查元素功能无法定位到右键点击的元素

## 问题描述

**发现日期**: 2026-04-02

**严重程度**: 低

**影响范围**: 终端右键菜单 - 开发者工具

**问题描述**: 
在终端标签页中右键点击"审查元素"后，开发者工具可以打开，但无法定位到右键点击位置的元素。这会影响开发调试效率。

## 复现步骤

1. 启动应用程序
2. 创建SSH连接并打开终端标签页
3. 在终端中右键点击
4. 点击"审查元素"菜单项
5. 观察开发者工具打开，但未定位到对应元素

## 预期行为

- 点击"审查元素"应该打开开发者工具
- 开发者工具应该自动定位到右键点击位置的元素
- 在 Elements 面板中高亮显示对应的 DOM 元素
- 方便开发者查看和修改元素的样式和属性

## 实际行为

**已确认**：开发者工具可以打开，但无法定位到右键点击位置的元素

在 `XTerminal.vue` 中，`handleInspectElement` 函数只是发送了打开开发者工具的消息，但没有传递右键点击的坐标：

```typescript
const handleInspectElement = (): void => {
  // 在 Electron 中打开开发者工具
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.send('open-devtools')
  }
  
  // 隐藏菜单
  contextMenuVisible.value = false
}
```

在主进程中，也只是简单地打开开发者工具，没有使用 `inspectElement` 方法：

```typescript
ipcMain.on('open-devtools', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.webContents.openDevTools()
})
```

## 根本原因分析

**已确认**：缺少坐标传递和元素定位逻辑

1. **坐标未保存**：右键点击时没有保存全局坐标（相对于窗口的坐标）
2. **坐标未传递**：IPC 消息没有携带右键点击的坐标信息
3. **元素未定位**：主进程没有调用 `webContents.inspectElement(x, y)` 方法

### 问题代码

```typescript
// XTerminal.vue - 修复前
const handleContextMenu = (event: MouseEvent): void => {
  event.preventDefault()
  
  // 计算菜单位置，但没有保存全局坐标
  const containerRect = terminalContainer.value?.getBoundingClientRect()
  // ... 其他代码
}

const handleInspectElement = (): void => {
  // 没有传递坐标
  window.electron.ipcRenderer.send('open-devtools')
}
```

## 影响的文件

- `src/renderer/src/components/terminal/XTerminal.vue` - 终端组件（已修复）
- `src/main/index.ts` - 主进程入口（已修复）

## 解决方案

### 方案 1: 保存坐标并使用 inspectElement 方法（已采用）

#### 修改 XTerminal.vue

1. 添加全局坐标状态：

```typescript
// 右键点击的全局坐标（用于审查元素）
const contextMenuGlobalPosition = ref({ x: 0, y: 0 })
```

2. 在右键菜单显示时保存坐标：

```typescript
const handleContextMenu = (event: MouseEvent): void => {
  event.preventDefault()
  
  // 保存右键点击的全局坐标（相对于窗口，用于审查元素）
  contextMenuGlobalPosition.value = { x: event.clientX, y: event.clientY }
  
  // ... 其他代码
}
```

3. 传递坐标给开发者工具：

```typescript
const handleInspectElement = (): void => {
  // 在 Electron 中打开开发者工具并检查指定位置的元素
  // 通过 window.electron API 发送 IPC 消息，传递右键点击的坐标
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.send('open-devtools', {
      x: contextMenuGlobalPosition.value.x,
      y: contextMenuGlobalPosition.value.y
    })
  }
  
  // 隐藏菜单
  contextMenuVisible.value = false
}
```

#### 修改 main/index.ts

处理坐标并定位元素：

```typescript
/**
 * IPC处理：打开开发者工具
 * 打开当前窗口的开发者工具，用于审查元素
 * 如果提供了坐标参数，则定位到指定位置的元素
 * @param event - IPC 事件对象
 * @param data - 可选的坐标数据 { x: number, y: number }
 */
ipcMain.on('open-devtools', (event, data?: { x: number; y: number }) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    // 打开开发者工具
    win.webContents.openDevTools()
    
    // 如果提供了坐标，则检查指定位置的元素
    if (data && typeof data.x === 'number' && typeof data.y === 'number') {
      // 延迟一点时间，等待开发者工具打开
      setTimeout(() => {
        win.webContents.inspectElement(data.x, data.y)
      }, 100)
    }
  }
})
```

### 工作流程

1. **保存坐标**：当用户右键点击终端时，保存全局坐标（相对于窗口的坐标）
2. **传递坐标**：点击"审查元素"时，将坐标通过 IPC 发送给主进程
3. **打开开发者工具**：主进程打开开发者工具
4. **定位元素**：使用 `webContents.inspectElement(x, y)` 方法定位到指定位置的元素

### 关键技术点

- **clientX/clientY**：鼠标事件的全局坐标（相对于窗口）
- **inspectElement(x, y)**：Electron 的 WebContents 方法，用于在开发者工具中定位元素
- **延迟定位**：需要等待开发者工具完全打开后再定位元素（使用 setTimeout）

### 优点

- ✅ 精确定位到右键点击位置的元素
- ✅ 提升调试效率
- ✅ 符合浏览器开发者工具的行为习惯
- ✅ 代码改动小，易于维护

### 注意事项

- 需要使用全局坐标（相对于窗口），而不是相对于容器的坐标
- 需要延迟调用 `inspectElement`，等待开发者工具完全打开
- 延迟时间不宜过长或过短，100ms 是一个合适的值

## 测试计划

1. 手动测试：
   - 在终端中右键点击不同位置
   - 点击"审查元素"
   - 验证开发者工具打开并定位到对应元素
   - 验证 Elements 面板中高亮显示正确的元素

## 状态
- [x] 问题已确认
- [x] 根本原因已分析
- [x] 解决方案已实现
- [ ] 测试用例已编写
- [ ] 测试已通过
- [ ] 已合并到主分支

## 备注

这是一个影响开发调试效率的问题，虽然不影响正常功能，但对于开发者来说是一个重要的体验优化。
