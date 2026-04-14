# BUG-026: SFTP 拖拽手柄只对第一个组件有效

## 📋 Bug 基本信息

| 属性 | 值 |
|------|-----|
| **Bug ID** | BUG-026 |
| **报告日期** | 2026-04-14 |
| **严重程度** | 中等（影响多标签页场景） |
| **状态** | ✅ 已修复 |
| **影响范围** | 多个 SFTP 标签页同时打开时，只有第一个的拖拽手柄可用 |
| **修复文件** | `src/renderer/src/components/terminal/sftp/status/SftpStatusContainer.vue` |

---

## 🐛 问题描述

### 现象
当用户打开多个 SFTP 标签页（或多个 SSH 会话切换到 SFTP 模式）时，只有**第一个** SFTP 状态容器的拖拽手柄可以正常工作，其他标签页的拖拽手柄点击无响应。

### 复现步骤
1. 打开应用，创建或连接至少 2 个不同的 SSH 会话
2. 将两个会话都切换到 SFTP 模式
3. 在第二个（或后续）SFTP 窗口中尝试拖拽状态面板底部的拖拽手柄
4. **观察问题**：拖拽手柄无法响应鼠标事件

### 截图示意
```
┌─────────────────────────────────────────────────────────┐
│ DIY Linux Shell    [SSH] [SFTP]                         │
├──────────┬──────────────────────────────────────────────┤
│ 会话列表  │ ┌────────────┬──────────────┐               │
│          │ │ 本地        │ 远程         │  ← 第一个SFTP  │
│ 会话A ✓  │ │            │              │     ✅ 可拖拽   │
│ 会话B ✓  │ ├────────────┴──────────────┤               │
│          │ │ ⠿⠿⠿ (拖拽手柄)           │               │
│          │ │ 全部展开 全部折叠 传输中 ▼ │               │
│          │ │ 暂无传输中的任务           │               │
│          │ └───────────────────────────┘               │
│          │                                              │
│          │ ┌────────────┬──────────────┐               │
│          │ │ 本地        │ 远程         │  ← 第二个SFTP  │
│          │ │            │              │     ❌ 无法拖拽 │
│          │ ├────────────┴──────────────┤               │
│          │ │ ⠿⠿⠿ (拖拽手柄)           │  ← 点击无效！   │
│          │ │ 全部展开 全部折叠 传输中 ▼ │               │
│          │ └───────────────────────────┘               │
└──────────┴──────────────────────────────────────────────┘
```

---

## 🔍 根因分析

### 问题代码位置

[SftpStatusContainer.vue#L580-L587](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/terminal/sftp/status/SftpStatusContainer.vue#L580-L587) 中的 `handleResize` 函数：

```typescript
/**
 * 处理拖拽
 */
function handleResize(event: MouseEvent): void {
  if (!isResizing) return
  
  // ❌ 问题在这里：使用全局 querySelector 只返回第一个匹配元素
  const container = document.querySelector('.sftp-footer-container')
  if (!container) return
  
  const rect = container.getBoundingClientRect()
  const newHeight = rect.bottom - event.clientY
  
  // 限制高度范围
  if (newHeight >= MIN_HEIGHT && newHeight <= MAX_HEIGHT) {
    treePanelHeight.value = newHeight
  }
}
```

### 技术原因

#### DOM 结构分析

```html
<!-- AppLayout.vue 中有多个 SFTP 实例 -->
<div class="terminal-area">
  <!-- 第一个 SFTP 标签页 -->
  <div v-show="tab.id === activeTabId_1">
    <div class="sftp-footer-container">  <!-- ✅ 这个会被选中 -->
      ...
    </div>
  </div>

  <!-- 第二个 SFTP 标签页 -->
  <div v-show="tab.id === activeTabId_2">
    <div class="sftp-footer-container">  <!-- ❌ 这个永远不会被选中 -->
      ...
    </div>
  </div>
</div>
```

#### `querySelector` 行为

```javascript
// document.querySelector() 的规范行为：
// - 返回文档中匹配指定选择器的**第一个**元素
// - 即使有多个元素匹配同一选择器，也只返回第一个
// - 返回值类型：Element | null

// 当调用：
const container = document.querySelector('.sftp-footer-container')

// 结果：始终返回页面中第一个 .sftp-footer-container 元素
// 无论用户在哪个 SFTP 标签页中操作拖拽手柄
```

#### 执行流程错误演示

```
时间轴:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━►

T=0ms     用户在第二个 SFTP 标签页中按下拖拽手柄
          │
          ├─ startResize() 被调用：
          │   isResizing = true
          │   注册 mousemove/mouseup 监听器
          │   设置 cursor: row-resize
          │
          ├─ 用户开始移动鼠标（T=100ms）
          │
          └─ handleResize(event) 被调用：
              
              ❌ 错误步骤 1:
              container = document.querySelector('.sftp-footer-container')
              → 返回的是**第一个** SFTP 容器的 DOM 元素
              → 不是当前正在操作的容器！
              
              ❌ 错误步骤 2:
              rect = container.getBoundingClientRect()
              → 获取的是第一个容器的位置和尺寸
              → 可能不在当前视口内（因为 v-show 隐藏了）
              → 或者位置完全错误
              
              ❌ 错误步骤 3:
              newHeight = rect.bottom - event.clientY
              → 计算出的高度值是错误的
              → 可能导致：
                • 高度不变化（如果第一个容器不可见）
                • 高度跳变到错误值
                • 完全不符合用户的拖拽意图
              
              结果：用户体验到"拖拽手柄没有反应"
```

### 影响范围评估

| 场景 | 是否受影响 | 说明 |
|------|-----------|------|
| 单个 SFTP 标签页 | ❌ 不影响 | 只有一个组件时，querySelector 正好返回它 |
| 多个 SFTP 标签页（v-if 切换） | ❌ 不影响 | v-if 会销毁重建，同一时刻只有一个存在 |
| 多个 SFTP 标签页（v-show 切换） | ✅ **受影响** | 多个实例共存，只有第一个可用 |
| 嵌入式模式 + 弹窗模式混合 | ✅ **可能受影响** | 取决于 DOM 顺序 |

---

## 💡 解决方案：使用组件内部 ref 引用

### 设计思路

将全局 DOM 查询改为**组件内部的 ref 引用**，确保每个组件实例都引用自己的容器元素：

```
┌─────────────────────────────────────────────────────────┐
│                  修复前 vs 修复后                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ❌ 修复前（全局查询）：                                 │
│                                                         │
│  Component A ──┐                                        │
│                 ├──→ document.querySelector()           │
│  Component B ──┘       ↓                                │
│                    返回 Component A 的元素              │
│                    （Component B 永远无法获取自己的元素） │
│                                                         │
│                                                         │
│  ✅ 修复后（组件 ref）：                                 │
│                                                         │
│  Component A ──→ containerRef.value ──→ DOM Element A   │
│                                                         │
│  Component B ──→ containerRef.value ──→ DOM Element B   │
│                                                         │
│  每个 Vue 组件实例都有独立的 ref 引用                   │
│  通过模板中的 ref 属性自动绑定到对应的 DOM 元素          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 代码修改

#### 修改 1：在模板中添加 ref 引用

**文件**: [SftpStatusContainer.vue#L9](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/terminal/sftp/status/SftpStatusContainer.vue#L9)

```vue
<template>
  <!-- ✅ 添加 ref="containerRef" -->
  <div class="sftp-footer-container" ref="containerRef">
    <!-- 简化状态栏 -->
    <div class="sftp-footer">
      ...
    </div>
    
    <!-- 树形面板 -->
    <div class="tree-panel" :style="{ height: treePanelHeight + 'px' }">
      ...
    </div>
  </div>
</template>
```

#### 修改 2：声明 ref 变量

**文件**: [SftpStatusContainer.vue#L361-L365](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/terminal/sftp/status/SftpStatusContainer.vue#L361-L365)

```typescript
/**
 * 组件容器 DOM 引用（用于拖拽计算）
 * 使用 ref 而非 querySelector，确保多实例场景下每个组件引用正确的 DOM 元素
 */
const containerRef = ref<HTMLDivElement | null>(null)
```

#### 修改 3：更新 handleResize 函数

**文件**: [SftpStatusContainer.vue#L400-L416](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/terminal/sftp/status/SftpStatusContainer.vue#L400-L416)

```typescript
/**
 * 处理拖拽
 * 
 * ✅ 修复：使用组件内部的 ref 引用，而不是全局 querySelector
 * 这样可以确保在有多个 SftpStatusContainer 实例的场景下，
 * 每个实例都能正确获取到自己对应的 DOM 元素
 */
function handleResize(event: MouseEvent): void {
  if (!isResizing) return
  
  // ✅ 使用组件内部的 ref 引用，而不是全局 querySelector
  const container = containerRef.value
  if (!container) return
  
  const rect = container.getBoundingClientRect()
  const newHeight = rect.bottom - event.clientY
  
  // 限制高度范围
  if (newHeight >= MIN_HEIGHT && newHeight <= MAX_HEIGHT) {
    treePanelHeight.value = newHeight
  }
}
```

---

## 🔧 技术细节对比

### Vue 3 Ref 机制

```javascript
// Vue 3 的 template ref 工作原理：

// 1. 在模板中声明 ref 属性
<template>
  <div ref="containerRef"></div>  // Vue 编译器会识别这个属性
</template>

// 2. 在 script 中声明同名的 ref 变量
const containerRef = ref<HTMLDivElement | null>(null)

// 3. Vue 自动绑定（组件挂载后）
//    - Vue 会在 onMounted 之后自动将 DOM 元素赋值给 containerRef.value
//    - 每个组件实例都有独立的 containerRef
//    - 组件卸载时自动设为 null

// 4. 为什么这样能解决问题？
//    - Component A 的 containerRef.value → Component A 的 div
//    - Component B 的 containerRef.value → Component B 的 div
//    - 互不影响，各自独立
```

### 性能优势

| 方案 | 时间复杂度 | 内存占用 | 缓存友好性 |
|------|-----------|---------|-----------|
| `document.querySelector()` | O(n) 遍历整个 DOM 树 | 无缓存 | ❌ 每次都要遍历 |
| `ref.value` | O(1) 直接访问 | Vue 内部维护强引用 | ✅ 常量时间访问 |

```javascript
// 性能差异示例（假设页面有 1000 个元素）：

// 方案 1: querySelector
for (let i = 0; i < 100; i++) {  // 快速拖拽时触发 100 次
  const el = document.querySelector('.sftp-footer-container')
  // 每次都要遍历最多 1000 个元素
  // 总计: 100 × 1000 = 100,000 次比较
}

// 方案 2: ref.value
for (let i = 0; i < 100; i++) {  // 快速拖拽时触发 100 次
  const el = containerRef.value
  // 直接从内存读取引用
  // 总计: 100 × 1 = 100 次内存访问
  // 性能提升约 1000 倍！
}
```

---

## ✅ 验证测试

### 测试用例 1：单标签页场景

```javascript
// 测试目标：验证单个 SFTP 标签页的拖拽功能正常

describe('单标签页拖拽功能', () => {
  it('应该能够正常调整状态面板高度', async () => {
    // 1. 打开一个 SFTP 标签页
    await openSftpTab(sessionId1)
    
    // 2. 获取拖拽手柄
    const handle = await page.locator('.resize-handle').first()
    
    // 3. 模拟拖拽操作
    const box = await handle.boundingBox()
    await handle.hover()
    await page.mouse.down()
    await page.mouse.move(box.x, box.y + 100)
    await page.mouse.up()
    
    // 4. 验证面板高度已改变
    const panel = await page.locator('.tree-panel')
    const height = await panel.evaluate(el => el.style.height)
    expect(parseInt(height)).toBeGreaterThan(500)  // 默认500px，应增加
  })
})
```

### 测试用例 2：多标签页场景（核心验证）

```javascript
// 测试目标：验证多个 SFTP 标签页的拖拽功能都能正常工作

describe('多标签页拖拽功能', () => {
  beforeEach(async () => {
    // 打开 3 个不同的 SFTP 标签页
    await openSftpTab('session-A')
    await openSftpTab('session-B')
    await openSftpTab('session-C')
  })

  it('第一个标签页的拖拽手柄应该正常工作', async () => {
    await switchToTab('session-A')
    await testDragFunctionality(shouldWork: true)
  })

  it('第二个标签页的拖拽手柄应该正常工作', async () => {
    await switchToTab('session-B')
    await testDragFunctionality(shouldWork: true)  // ✅ 之前这里是 false
  })

  it('第三个标签页的拖拽手柄应该正常工作', async () => {
    await switchToTab('session-C')
    await testDragFunctionality(shouldWork: true)  // ✅ 之前这里是 false
  })
})

async function testDragFunctionality(shouldWork: boolean) {
  const handle = await page.locator('.resize-handle').first()
  const initialHeight = await getTreePanelHeight()
  
  // 执行拖拽
  await simulateDrag(handle, deltaY: 50)
  
  const finalHeight = await getTreePanelHeight()
  
  if (shouldWork) {
    expect(Math.abs(finalHeight - initialHeight)).toBeCloseTo(50, -1)
  } else {
    expect(finalHeight).toEqual(initialHeight)
  }
}
```

### 测试用例 3：标签页切换后拖拽

```javascript
// 测试目标：验证在不同标签页之间切换后，拖拽功能仍然正常

describe('标签页切换后的拖拽功能', () => {
  it('从标签A切换到标签B后，标签B的拖拽应该正常', async () => {
    // 1. 在标签A中拖拽一次
    await switchToTab('session-A')
    await dragHandle(deltaY: 30)
    
    // 2. 切换到标签B
    await switchToTab('session-B')
    
    // 3. 在标签B中拖拽
    const beforeHeight = await getTreePanelHeight()
    await dragHandle(deltaY: -40)
    const afterHeight = await getTreePanelHeight()
    
    // 4. 验证标签B的高度改变了
    expect(afterHeight).toEqual(beforeHeight - 40)
  })
})
```

---

## 📊 修复前后对比

| 维度 | 修复前 | 修复后 |
|------|--------|--------|
| **功能性** | 只有第一个组件能用 | 所有组件都能正常使用 |
| **代码质量** | 使用全局 API（不安全） | 使用组件 ref（符合 Vue 最佳实践） |
| **性能** | O(n) DOM 查询 | O(1) 直接访问 |
| **可维护性** | 依赖 CSS 类名唯一性 | 组件自包含，无需外部依赖 |
| **类型安全** | 返回 Element 类型（需断言） | 泛型 ref<HTMLDivElement>（类型安全） |

---

## 🎓 经验总结

### 教训 1：Vue 组件应避免使用全局 DOM 查询

```javascript
// ❌ 反面教材：
function someMethod() {
  const el = document.querySelector('.some-class')  // 危险！
}

// ✅ 推荐做法：
const elRef = ref<HTMLElement | null>(null)

function someMethod() {
  const el = elRef.value  // 安全！组件作用域内
}
```

### 教训 2：多实例组件必须使用组件级状态

```javascript
// 如果一个组件会在页面中出现多次（如标签页、列表项等），
// 必须确保所有状态都是组件实例级别的，而非全局的：

// ✅ 正确的状态管理方式：
const componentState = ref(...)      // 组件级状态
const domRef = ref<HTMLElement>(...) // 组件级 DOM 引用
const eventHandlers = (...)          // 组件级事件处理函数

// ❌ 错误的方式：
document.querySelector(...)          // 全局查询
window.globalVariable = ...          // 全局变量
document.addEventListener(...)       // 未清理的全局监听
```

### 教训 3：v-show 场景需要特别注意

```javascript
// v-show 不会销毁组件，只是隐藏显示
// 这意味着多个组件实例可能同时存在于 DOM 中

// 在设计组件时需要考虑：
// 1. 是否支持多实例？
// 2. 实例间是否会有冲突？
// 3. 是否使用了全局资源（DOM 查询、事件监听、定时器等）？

// 本案例就是因为未考虑 v-show 导致的多实例场景而引发的 Bug
```

---

## 📝 相关问题

- [BUG-025: 切换 SSH/SFTP 模式后终端未正确 Resize](./BUG-025-switch-mode-terminal-not-resize.md) - 同样涉及 v-show 场景的问题
- [BUG-027: SFTP 窗口未占满视窗右侧区域](./BUG-027-sftp-window-not-full-width.md) - 同时修复的布局问题

---

**修复完成日期**: 2026-04-14  
**修复人**: AI Assistant  
**审核状态**: 待人工验证
