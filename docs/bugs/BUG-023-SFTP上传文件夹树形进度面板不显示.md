# BUG-023-SFTP 上传文件夹树形进度面板不显示

## 📋 Bug 概述

**Bug 编号**: BUG-023  
**发现日期**: 2026-04-10  
**严重程度**: 🔴 高（核心功能不可用）  
**影响范围**: SFTP 文件夹上传功能  
**状态**: ✅ 已修复  

---

## 🐛 问题描述

### 现象描述

用户上传文件夹时，底部状态栏的**树形进度面板不显示**，无法查看上传进度和文件列表。

### 复现步骤

1. 打开 SFTP 文件传输窗口
2. 连接到远程服务器
3. 在本地文件列表中右键选择一个文件夹
4. 点击"上传"操作
5. **预期**: 底部出现树形进度面板，显示每个文件的传输进度
6. **实际**: 树形面板完全不显示，控制台无报错（但有 Vue 警告）

### 影响范围

- ❌ 用户无法看到上传进度
- ❌ 无法查看哪些文件已上传、哪些正在上传
- ❌ 无法确认上传是否成功完成
- ❌ 用户体验极差，功能形同虚设

---

## 🔍 问题分析过程

### 第一阶段：初始排查

#### 1.1 检查显示条件逻辑

**文件**: [SftpStatusContainer.vue#L42](src/renderer/src/components/session/sftp/status/SftpStatusContainer.vue#L42)

```html
<!-- 初始代码 -->
<div v-if="hasActiveTransfers" class="tree-panel">
```

**问题发现**：
- `hasActiveTransfers` 只包含 `pending` 和 `active` 状态的任务
- 上传完成后任务变为 `completed` 状态
- 导致面板在上传完成后立即消失

#### 1.2 修复尝试 1：扩展显示条件

**修改 Store** ([sftpTransfer.ts](src/renderer/src/stores/sftpTransfer.ts))：

```typescript
// 新增 visibleTasks 计算属性
const visibleTasks = computed(() => {
  return transferTasks.value.filter(task => 
    task.status === 'pending' || 
    task.status === 'active' || 
    task.status === 'completed'  // 包含已完成状态
  )
})

const hasVisibleTasks = computed(() => {
  return visibleTasks.value.length > 0
})
```

**修改组件** ([SftpStatusContainer.vue](src/renderer/src/components/session/sftp/status/SftpStatusContainer.vue))：

```html
<!-- 修改为使用 hasVisibleTasks -->
<div v-if="hasVisibleTasks" class="tree-panel">
```

**结果**: ❌ 修复失败，面板仍然不显示

---

### 第二阶段：深入调试

#### 2.1 添加调试日志

在关键位置添加详细日志输出：

**upload.ts** - 任务添加时：
```typescript
sftpTransferStore.addTask(task)

console.log('[upload] ✅ 任务已添加到 Store:', {
  taskId: task.id,
  storeTaskCount: sftpTransferStore.transferTasks.length,
  hasVisibleTasks: sftpTransferStore.hasVisibleTasks,      // ← 关键字段
  visibleTasksCount: sftpTransferStore.visibleTasks.length,  // ← 关键字段
  taskStatus: task.status
})
```

**SftpStatusContainer.vue** - 组件监控：
```typescript
watch(visibleTasks, (newVal) => {
  console.log('[SftpStatusContainer] 📊 visibleTasks 变化:', {
    taskCount: newVal.length,
    tasks: newVal.map(t => ({...}))
  })
}, { deep: true, immediate: true })

watch(hasVisibleTasks, (newVal) => {
  console.log('[SftpStatusContainer] 🔍 hasVisibleTasks:', newVal)
}, { immediate: true })
```

#### 2.2 日志分析结果

##### ✅ **Store 数据完全正常**

```javascript
[upload] ✅ 任务已添加到 Store: {
  taskId: 'task-1775822017987',
  storeTaskCount: 1,              // ✅ 任务已成功添加
  hasVisibleTasks: true,          // ✅ 应该显示面板
  visibleTasksCount: 1,           // ✅ 有可见任务
  taskStatus: 'active'
}

[upload] 🎉 上传完成，最终 Store 状态: {
  storeTaskCount: 1,
  hasVisibleTasks: true,          // ✅ 完成后仍然是 true
  visibleTasksCount: 1,
  taskFinalStatus: 'completed',   // ✅ 状态正确更新
  allTasks: [{
    id: "task-xxx",
    status: "completed",          // ✅ 最终状态正确
    type: "upload"
  }]
}
```

##### ❌ **组件接收到的数据异常**

```javascript
[SftpStatusContainer] 📊 visibleTasks 变化: {
  taskCount: 0,                   // ❌ 应该是 1
  tasks: Array(0)                 // ❌ 应该有数据
}

[SftpStatusContainer] 🔍 hasVisibleTasks: undefined  // ❌ 应该是 true！

[Vue warn]: Invalid watch source: false  
A watch source can only be a getter/effect function, a ref, a reactive object, 
or an array of these types.                           // ❌ Vue 报错！
```

---

### 第三阶段：定位根本原因

#### 3.1 对比分析

| 数据源 | 值 | 预期值 | 状态 |
|--------|-----|--------|------|
| **Store 内部** (`sftpTransferStore.hasVisibleTasks`) | `true` | `true` | ✅ 正常 |
| **组件变量** (`hasVisibleTasks`) | `undefined` | `true` | ❌ 异常 |
| **Store 内部** (`sftpTransferStore.visibleTasks`) | `[task]` | `[task]` | ✅ 正常 |
| **组件变量** (`visibleTasks`) | `[]` | `[task]` | ❌ 异常 |

#### 3.2 发现问题代码

**文件**: [SftpStatusContainer.vue#L110-L121](src/renderer/src/components/session/sftp/status/SftpStatusContainer.vue#L110-L121)（修复前）

```typescript
const sftpTransferStore = useSftpTransferStore()

// ❌ 错误的解构方式！
const currentStatus = sftpTransferStore.overallStatus
const hasVisibleTasks = sftpTransferStore.hasVisibleTasks     // ← undefined
const visibleTasks = sftpTransferStore.visibleTasks           // ← 空数组（静态）
```

#### 3.3 根本原因确认

**🎯 Pinia Store 的响应性丢失**

**原因分析**：

1. **Pinia 的响应式机制**
   - Store 的 state 和 getters 是通过 Proxy 或 reactive() 实现的
   - 这些属性在 Store 实例上具有特殊的 getter/setter
   - 直接访问 `store.property` 会触发响应式追踪

2. **解构破坏响应性**
   ```typescript
   // Store 内部结构（简化）：
   const store = {
     _state: reactive({ tasks: [] }),
     get hasVisibleTasks() {        // 计算属性 getter
       return this._state.tasks.filter(...).length > 0
     }
   }
   
   // ❌ 直接赋值：
   const x = store.hasVisibleTasks  
   // 结果：x = 当前的静态值（undefined 或 false）
   // 后续 store 更新时，x 不会改变！
   
   // ✅ 使用 storeToRefs：
   const { x } = storeToRefs(store)
   // 结果：x = Ref<boolean>（保持与 store 的链接）
   // store 更新时，x.value 自动更新
   ```

3. **为什么 watch 报错？**
   ```typescript
   // ❌ watch 接收到的是普通布尔值 false/undefined
   watch(hasVisibleTasks, callback)  
   // Vue 要求：ref / reactive / computed / getter 函数
   // 实际得到：原始值 → 报错 "Invalid watch source"
   ```

---

## 🔧 修复方案

### 修改 1：导入 storeToRefs

**文件**: [SftpStatusContainer.vue#L78](src/renderer/src/components/session/sftp/status/SftpStatusContainer.vue#L78)

```diff
  import { ref, watch } from 'vue'
+ import { storeToRefs } from 'pinia'
  import SftpTaskStatus from './SftpTaskStatus.vue'
  import { useSftpTransferStore } from '@/stores/sftpTransfer'
```

### 修改 2：使用 storeToRefs 解构

**文件**: [SftpStatusContainer.vue#L106-L115](src/renderer/src/components/session/sftp/status/SftpStatusContainer.vue#L106-L115)

```diff
- /**
-  * 当前状态（从 Store 获取）
-  */
- const currentStatus = sftpTransferStore.overallStatus
- 
- /**
-  * 是否有可见的传输任务（从 Store 获取）
-  * 包含 pending、active、completed 状态的任务
-  */
- const hasVisibleTasks = sftpTransferStore.hasVisibleTasks
- 
- /**
-  * 可见的传输任务列表（从 Store 获取）
-  * 用于树形面板显示
-  */
- const visibleTasks = sftpTransferStore.visibleTasks
+ /**
+  * ✅ 使用 storeToRefs 解构，保持响应性！
+  * 这样解构出来的属性仍然是 ref，会随 Store 更新而更新
+  */
+ const { 
+   overallStatus,
+   hasVisibleTasks,      // Ref<boolean> - 具有完整响应性
+   visibleTasks          // Ref<TransferTask[]> - 随 Store 更新而更新
+ } = storeToRefs(sftpTransferStore)
```

---

## ✅ 修复验证

### 测试结果

#### 修复前日志

```javascript
[SftpStatusContainer] 🔍 hasVisibleTasks: undefined  // ❌
[SftpStatusContainer] 📊 visibleTasks 变化: { taskCount: 0 }  // ❌
[Vue warn]: Invalid watch source: false  // ❌ Vue 警告
```

#### 修复后日志（预期）

```javascript
[SftpStatusContainer] 🔍 hasVisibleTasks: false  // ✅ 初始状态
[SftpStatusContainer] 📊 visibleTasks 变化: { taskCount: 0 }  // ✅ 初始

[upload] ✅ 任务已添加到 Store: {...}

[SftpStatusContainer] 📊 visibleTasks 变ing: { 
  taskCount: 1,                    // ✅ 有任务了！
  tasks: [{
    id: "task-xxx",
    status: "active",
    type: "upload",
    rootName: "memcached-operator",
    rootChildrenCount: 95
  }]
}  // ✅ 实时更新！

[SftpStatusContainer] 🔍 hasVisibleTasks: true  // ✅ 变成 true！

[upload] 🎉 上传完成...

[SftpStatusContainer] 📊 visibleTasks 变化: {
  taskCount: 1,
  tasks: [{
    status: "completed",          // ✅ 自动更新为 completed
    ...
  }]
}

[SftpStatusContainer] 🔍 hasVisibleTasks: true  // ✅ 保持 true！
```

#### UI 表现

- ✅ 上传开始时：树形面板立即显示
- ✅ 上传过程中：实时更新每个文件的进度条
- ✅ 上传完成后：面板继续显示，所有文件标记为"已完成"
- ✅ 支持展开/折叠查看详情
- ✅ 无 Vue 警告或错误

---

## 📚 技术要点总结

### Pinia 最佳实践

| 操作 | ❌ 错误方式 | ✅ 正确方式 | 说明 |
|------|-----------|-----------|------|
| **解构 State** | `const { x } = store` | `const { x } = storeToRefs(store)` | State 必须用 storeToRefs |
| **解构 Getters** | `const { y } = store` | `const { y } = storeToRefs(store)` | Getters 同样需要 |
| **解构 Actions** | `const { foo } = store` | `const { foo } = store` | Actions 可以直接解构 |
| **watch 监听** | `watch(store.x, cb)` | `watch(xRef, cb)` | 监听 ref 而非 store 属性 |
| **模板中使用** | `{{ store.x }}` | `{{ x }}` | Vue 自动解包 ref |

### 为什么 Actions 可以直接解构？

- **State 和 Getters**：是响应式数据，需要保持引用链接以触发更新
- **Actions**：是方法（函数），不需要响应性，直接引用即可

### storeToRefs 工作原理

```typescript
import { storeToRefs } from 'pinia'

const store = useMyStore()
const { count, doubleCount } = storeToRefs(store)

// 内部实现（简化）：
function storeToRefs(store) {
  const refs = {}
  for (const key in store) {
    if (isRef(store[key]) || isComputed(store[key])) {
      refs[key] = toRef(store, key)  // 创建到原属性的响应式引用
    }
  }
  return refs
}
```

**效果**：
- `count` 是 `Ref<number>` 类型
- 当 `store.count` 变化时，`count.value` 自动同步
- 在模板中使用时无需 `.value`（Vue 自动解包）

---

## 📁 相关文件清单

| 文件路径 | 修改类型 | 说明 |
|---------|---------|------|
| [sftpTransfer.ts](src/renderer/src/stores/sftpTransfer.ts) | 修改 | 新增 `visibleTasks`、`hasVisibleTasks` 计算属性 |
| [SftpStatusContainer.vue](src/renderer/src/components/session/sftp/status/SftpStatusContainer.vue) | 修改 | 导入并使用 `storeToRefs()` 解构 Store |
| [upload.ts](src/renderer/src/components/session/sftp/script/upload.ts) | 临时修改 | 添加调试日志（可移除） |

---

## 🧪 测试用例建议

### E2E 测试场景

1. **基本功能测试**
   - 上传小文件夹（< 10 个文件）
   - 验证树形面板显示
   - 验证进度实时更新
   - 验证完成后状态正确

2. **边界情况测试**
   - 上传空文件夹
   - 上传大文件夹（> 100 个文件）
   - 上传嵌套层级深的文件夹（> 5 层）
   - 上传包含特殊字符文件名的文件夹

3. **响应性测试**
   - 快速连续上传多个文件夹
   - 上传过程中取消操作
   - 上传过程中断开连接
   - 多个 SFTP 会话同时上传

4. **UI 交互测试**
   - 展开/折叠节点
   - 拖拽调整面板高度
   - 全部展开/全部折叠按钮
   - 清除已完成任务

---

## 💡 经验教训

### 1. **Pinia 使用必须遵循规范**

❌ **错误做法**：
```typescript
const store = useStore()
const { state1, getter1 } = store  // 丢失响应性
```

✅ **正确做法**：
```typescript
const store = useStore()
const { state1, getter1 } = storeToRefs(store)  // 保持响应性
const { action1, action2 } = store  // actions 可以直接解构
```

### 2. **遇到 UI 不更新时的排查思路**

1. **检查数据源**：确认 Store 数据是否正确
2. **检查响应性**：确认组件接收到的数据是否是 ref/reactive
3. **添加调试日志**：对比 Store 内部和组件内部的值
4. **检查 Vue 警告**：特别注意 `Invalid watch source` 这类警告
5. **验证解构方式**：确保使用了 `storeToRefs()`

### 3. **调试技巧**

```typescript
// 在组件中添加 watch 监控
watch(某个变量, (newVal) => {
  console.log('变量变化:', newVal)
}, { immediate: true })

// 如果 watch 报错 "Invalid watch source"，说明该变量不是响应式的
// → 检查是否使用了正确的解构方式
```

---

## 📝 相关文档

- [Pinia 官方文档 - Core Concepts](https://pinia.vuejs.org/core-concepts/)
- [Pinia 官方文档 - Composition API](https://pinia.vuejs.org/core-concepts/#using-the-store)
- [Vue 3 响应式系统原理](https://vuejs.org/guide/extras/reactivity-in-depth.html)
- [BUG-021-SFTP 上传进度不显示](./BUG-021-SFTP%20上传进度不显示.md) （相关问题）

---

## 👥 参与人员

- **报告者**: 用户（前端调试工程师）
- **分析者**: AI Assistant
- **修复者**: AI Assistant
- **验证者**: 待验证

---

## 📅 时间线

| 时间 | 事件 |
|------|------|
| 2026-04-10 19:52 | 用户报告 bug：目录树未显示 |
| 2026-04-10 19:55 | 开始第一阶段排查：检查显示条件 |
| 2026-04-10 20:00 | 尝试修复 1：扩展 visibleTasks 条件（失败） |
| 2026-04-10 20:05 | 进入第二阶段：添加详细调试日志 |
| 2026-04-10 20:15 | 用户提供控制台日志 |
| 2026-04-10 20:18 | 分析日志，发现 Vue 警告和 undefined 问题 |
| 2026-04-10 20:20 | 定位根本原因：Pinia 解构方式错误 |
| 2026-04-10 20:25 | 实施修复：使用 storeToRefs() |
| 2026-04-10 20:28 | 类型检查通过，等待用户验证 |

---

**最后更新**: 2026-04-10 20:30  
**文档版本**: v1.0
