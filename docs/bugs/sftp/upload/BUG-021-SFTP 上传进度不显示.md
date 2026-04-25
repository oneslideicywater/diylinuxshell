# BUG-021-SFTP 上传进度不显示实时进度

## Bug 描述

SFTP 文件传输时，树形组件显示所有文件节点，但所有文件的状态都显示为"等待中"，不显示实时上传进度。即使控制台日志显示进度回调已触发且找到了对应节点，界面也没有更新。

## 影响范围

- SFTP 文件夹上传功能
- 树形传输状态显示组件

## 复现步骤

1. 打开 SFTP 窗口
2. 在本地文件列表中选择 `D:\develop\goworkbunch\memcached-operator` 文件夹
3. 右键点击文件夹，选择"上传文件夹到服务器"
4. 观察底部树形传输状态面板

**预期结果**：
- 文件状态应从"等待中"变为"传输中"
- 进度条应实时更新上传进度
- 应显示传输速度和剩余时间

**实际结果**：
- 所有文件状态一直显示"等待中"
- 进度条不更新
- 传输完成后才变为"已完成"

## 根本原因

Vue 3 响应式系统问题：

1. `createTransferNode` 函数创建的是普通 JavaScript 对象，不是响应式对象
2. 当 `updateNodeProgress` 函数修改节点属性（如 `progress`、`status`）时，Vue 无法检测到这些变化
3. 视图不会重新渲染，导致进度不显示

## 解决方案

### 1. 使用 `reactive` 创建节点对象

修改 `createTransferNode` 函数：

```typescript
function createTransferNode(
  name: string,
  isDirectory: boolean,
  type: 'upload' | 'download' | 'delete',
  localPath?: string,
  remotePath?: string,
  size: number = 0
): TransferNode {
  return reactive({
    id: generateNodeId(),
    name,
    isDirectory,
    type,
    status: 'pending',
    progress: 0,
    size,
    localPath,
    remotePath,
    speed: 0,
    remaining: '-',
    elapsed: '0s',
    children: isDirectory ? [] : undefined,
    startTime: Date.now()
  })
}
```

### 2. 改进 `updateNodeProgress` 函数

```typescript
function updateNodeProgress(node: TransferNode, progress: number, transferredSize: number, speed: number): void {
  // 直接修改节点属性，Vue 3 的响应式系统应该能检测到
  node.progress = progress
  node.transferredSize = transferredSize
  node.speed = speed
  node.elapsed = formatTime((Date.now() - node.startTime) / 1000)
  
  if (progress >= 100) {
    node.status = 'completed'
    node.progress = 100
  } else {
    node.status = 'transferring'
  }
  
  // 强制触发响应式更新：重新赋值数组
  transferNodes.value = [...transferNodes.value]
}
```

## 修改文件

- `src/renderer/src/components/session/SftpTransfer.vue`
  - `createTransferNode` 函数：使用 `reactive()` 创建响应式对象
  - `updateNodeProgress` 函数：添加 elapsed 时间更新，使用 `progress >= 100` 避免浮点数精度问题，重新赋值数组强制触发更新

## 测试验证

运行 E2E 测试：
```bash
npx playwright test e2e/sftp/sftp-tree-upload.e2e.spec.ts --project=electron --headed
```

测试结果：✅ 通过

## 相关知识点

### Vue 3 响应式系统

- `ref()`: 用于创建基本类型的响应式引用
- `reactive()`: 用于创建对象的响应式代理
- 直接修改 `ref` 数组中的对象属性不会触发视图更新，需要使用 `reactive()` 创建对象

### 最佳实践

1. 在 Vue 3 Composition API 中，需要响应式更新的对象应使用 `reactive()` 创建
2. 更新数组时，重新赋值可以强制触发响应式更新
3. 使用 `progress >= 100` 而不是 `progress === 100` 可以避免浮点数精度问题

## 修复日期

2026-04-07

## 修复人

AI Assistant
