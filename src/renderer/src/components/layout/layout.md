# 布局组件

本目录包含应用的整体布局组件。

## 组件结构

```
layout/
├── AppLayout.vue    # 应用主布局
├── Sidebar.vue      # 左侧边栏
└── layout.md        # 本文档
```

## AppLayout.vue 中的 Slot 插槽

### 代码片段

```vue
<main class="app-main">
  <slot>
    <!-- 默认内容：终端区域 -->
    <div class="terminal-area">
      <XTerminal v-if="activeTab" :tab="activeTab" />
      <div v-else class="empty-state">
        <p>请选择或创建一个会话</p>
      </div>
    </div>
  </slot>
</main>
```

### Slot 是什么？

Slot（插槽）是 Vue 的内容分发机制，允许父组件向子组件传递模板内容。

### 工作原理

```
┌─────────────────────────────────────────────────────────────────┐
│                      AppLayout.vue                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   <main class="app-main">                                       │
│     <slot>                                                      │
│       ┌─────────────────────────────────────────────────────┐   │
│       │  默认内容（Default Content）                         │   │
│       │                                                       │   │
│       │  当父组件没有提供插槽内容时，显示这里的内容           │   │
│       │                                                       │   │
│       │  <div class="terminal-area">                         │   │
│       │    <XTerminal v-if="activeTab" :tab="activeTab" />   │   │
│       │    <div v-else class="empty-state">                  │   │
│       │      <p>请选择或创建一个会话</p>                     │   │
│       │    </div>                                            │   │
│       │  </div>                                              │   │
│       └─────────────────────────────────────────────────────┘   │
│     </slot>                                                     │
│   </main>                                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 两种使用场景

#### 场景 1：使用默认内容

```vue
<!-- 父组件使用 -->
<template>
  <AppLayout />
</template>
```

**结果**：显示默认的终端区域内容

```
┌─────────────────────────────────────┐
│  AppLayout                          │
│  ┌─────────────────────────────┐    │
│  │ 默认内容：终端区域          │    │
│  │                             │    │
│  │  XTerminal 组件             │    │
│  │  或 "请选择或创建一个会话"  │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

#### 场景 2：覆盖默认内容

```vue
<!-- 父组件使用 -->
<template>
  <AppLayout>
    <!-- 自定义插槽内容，会替换默认内容 -->
    <div class="settings-page">
      <h1>设置页面</h1>
      <SettingsForm />
    </div>
  </AppLayout>
</template>
```

**结果**：显示自定义的设置页面内容

```
┌─────────────────────────────────────┐
│  AppLayout                          │
│  ┌─────────────────────────────┐    │
│  │ 自定义内容：设置页面        │    │
│  │                             │    │
│  │  <h1>设置页面</h1>          │    │
│  │  <SettingsForm />           │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### 实际应用

在 DIY-Linux-Shell 项目中：

| 页面 | 使用方式 | 显示内容 |
|------|----------|----------|
| 首页 | `<AppLayout />` | 默认终端区域（未使用插槽） |
| 设置页 | `<AppLayout><Settings /></AppLayout>` | 设置页面（使用插槽覆盖默认内容） |

### Home.vue 中的使用方式

```vue
<!-- Home.vue -->
<template>
  <AppLayout 
    @add-session="showSessionForm = true" 
    @edit-session="handleEditSession" 
    @open-settings="handleOpenSettings" 
  />
</template>
```

**分析**：
- **没有使用插槽**：没有在 `<AppLayout>` 标签内部放置任何内容
- **使用了 Props 和 Events**：
  - `@add-session` 是监听 AppLayout 抛出的事件
  - 效果：点击 Sidebar 的添加按钮 → 触发事件 → Home.vue 显示会话表单

```
Home.vue 中的 AppLayout
    │
    ▼
<AppLayout 
  @add-session="showSessionForm = true"      ← 监听事件
  @edit-session="handleEditSession"           ← 监听事件  
  @open-settings="handleOpenSettings"        ← 监听事件
/>
    │
    ▼
没有插槽内容传入 → 显示默认的终端区域
```

**对比**：

| 使用方式 | 说明 |
|----------|------|
| `<AppLayout />` | 无插槽，显示默认内容 |
| `<AppLayout><div>自定义内容</div></AppLayout>` | 有插槽，显示自定义内容 |

### 代码执行流程

```
1. AppLayout 组件渲染
    │
    ▼
2. 检查是否有插槽内容传入
    │
    ├── 有传入 ──► 渲染传入的内容
    │
    └── 无传入 ──► 渲染默认内容
                    │
                    ▼
                检查 activeTab
                    │
                    ├── 有 activeTab ──► 渲染 XTerminal
                    │
                    └── 无 activeTab ──► 渲染空状态提示
```

### Slot 的好处

| 好处 | 说明 |
|------|------|
| **灵活性** | 同一个布局组件可以承载不同的内容 |
| **复用性** | 布局结构复用，内容可变 |
| **默认值** | 提供合理的默认内容，无需每次都指定 |
| **解耦** | 布局与内容分离，各司其职 |

### 相关 Vue 语法

```vue
<!-- 默认插槽 -->
<slot>默认内容</slot>

<!-- 具名插槽 -->
<slot name="header">默认头部</slot>
<slot name="footer">默认底部</slot>

<!-- 使用具名插槽 -->
<AppLayout>
  <template #header>
    <CustomHeader />
  </template>
  <template #footer>
    <CustomFooter />
  </template>
</AppLayout>

<!-- 作用域插槽 -->
<slot :data="someData" :user="currentUser">
  {{ someData }}
</slot>
```

## 相关文档

- [Vue Slot 官方文档](https://vuejs.org/guide/components/slots.html)
- [终端组件](../terminal/README.md)
