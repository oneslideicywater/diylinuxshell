# 如何调试 Electron 应用

本文档介绍 DIY-Linux-Shell 项目的调试方法和技巧。

## 1. 开发模式运行（推荐）

最常用的调试方式是开发模式：

```powershell
npm run dev
```

**特点：**
- 自动热重载
- 自动打开 DevTools
- 支持 Vue DevTools
- 实时查看代码修改效果

## 2. VS Code 调试配置

项目已配置 `.vscode/launch.json`，支持在 VS Code 中调试。

### 调试主进程

1. 按 `F5` 打开调试面板
2. 选择 "Debug Main Process"
3. 开始调试

### 调试渲染进程

1. 先运行 `npm run dev` 启动开发服务器
2. 按 `F5` 打开调试面板
3. 选择 "Debug Renderer Process"
4. 开始调试

### launch.json 配置说明

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Main Process",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron-vite",
      "args": ["--sourcemap"],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Renderer Process",
      "type": "chrome",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/src/renderer",
      "timeout": 30000
    }
  ]
}
```

## 3. 右键菜单审查元素

项目已实现右键菜单功能，支持审查元素：

**菜单功能：**

| 菜单项 | 功能 |
|--------|------|
| 检查元素 | 打开 DevTools 并定位到点击位置的元素 |
| 重新加载 | 刷新页面 |
| 强制重新加载 | 清除缓存并刷新 |
| 后退 | 导航到上一页 |
| 前进 | 导航到下一页 |

**使用方法：**
1. 运行 `npm run dev`
2. 在应用中右键点击任意位置
3. 选择 "检查元素" 打开 DevTools

## 4. DevTools 调试

### 快捷键

- **开发模式**：`Ctrl+Shift+I` 或 `F12` 打开 DevTools
- **右键菜单**：右键 → 检查元素

### 代码中打开 DevTools

在主进程代码中添加：

```typescript
// 主进程 - 自动打开 DevTools
mainWindow.webContents.openDevTools()
```

### 条件打开 DevTools

```typescript
// 仅在开发环境打开
if (is.dev) {
  mainWindow.webContents.openDevTools()
}
```

## 5. 主进程调试

### console.log 输出

在主进程代码中使用 `console.log()`，输出会显示在终端中：

```typescript
// 主进程代码
console.log('主进程日志:', data)
```

### VS Code 断点调试

1. 在主进程代码中设置断点
2. 使用 "Debug Main Process" 配置启动调试
3. 代码会在断点处暂停

## 6. 渲染进程调试

### console.log 输出

在渲染进程（Vue 组件）中使用 `console.log()`，输出会显示在 DevTools 的 Console 面板中：

```typescript
// 渲染进程代码（Vue 组件）
console.log('渲染进程日志:', data)
```

### Vue DevTools

开发模式下支持 Vue DevTools：
1. 打开 DevTools
2. 切换到 "Vue" 标签页
3. 查看组件树和状态

## 7. 常见调试场景

### 调试 IPC 通信

```typescript
// 主进程 - 监听 IPC 消息
ipcMain.handle('channel-name', (event, data) => {
  console.log('收到 IPC 消息:', data)
  // 处理逻辑
})

// 渲染进程 - 发送 IPC 消息
const result = await window.api.session.getAll()
console.log('IPC 返回结果:', result)
```

### 调试 SSH 连接

```typescript
// 在 SSHManager 中添加日志
console.log('SSH 连接状态:', connection.status)
console.log('SSH 错误:', connection.error)
```

### 调试终端输出

```typescript
// 监听终端数据
window.api.terminal.onData((_event, data) => {
  console.log('终端数据:', data)
})
```

## 8. 生产环境调试

### 查看日志文件

生产环境下，日志会输出到控制台或日志文件。

### 手动打开 DevTools

在已打包的应用中，可以通过快捷键或菜单打开 DevTools（如果已配置）。

### 使用 --inspect 参数

```powershell
# 启动时添加调试参数
diy-linux-shell.exe --inspect=9229
```

然后在 Chrome 中访问 `chrome://inspect` 进行调试。

## 9. 调试技巧

### 使用 debugger 语句

```typescript
// 代码中添加 debugger
function someFunction() {
  debugger // 代码会在此处暂停
  // 其他代码
}
```

### 使用 Vue 组件名称

```typescript
// 在 Vue 组件中添加 name 属性，便于调试
defineOptions({
  name: 'MyComponent'
})
```

### 使用 Pinia DevTools

Pinia 状态管理支持 DevTools 调试：
1. 打开 DevTools
2. 切换到 "Vue" 标签页
3. 查看 Pinia 状态

## 10. 相关文档

- [Electron 官方文档 - 调试](https://www.electronjs.org/docs/latest/tutorial/application-debugging)
- [Vue 3 调试指南](https://vuejs.org/guide/extras/debugging.html)
- [VS Code 调试文档](https://code.visualstudio.com/docs/editor/debugging)
