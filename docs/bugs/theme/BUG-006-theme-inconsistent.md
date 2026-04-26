# BUG-006: 设置组件和主页面主题默认不一致

## 问题描述

**发现日期**: 2026-04-02

**严重程度**: 中

**影响范围**: 主题系统 - 所有组件

**问题描述**: 
应用启动时，设置组件和主页面的默认主题不一致。虽然从 localStorage 加载了主题配置，但没有应用到 DOM，导致所有组件使用默认的 CSS 变量值，而不是实际的主题配置。

## 复现步骤

1. 启动应用程序
2. 观察主页面的主题（默认为深色）
3. 进入设置页面
4. 观察设置页面的主题
5. 发现两个页面的主题可能不一致

## 预期行为

应用启动时，所有组件应该使用相同的主题，主题应该从 localStorage 加载并应用到整个应用。

## 实际行为

- 主页面：使用默认主题（深色）
- 设置组件：可能使用不同的主题
- 原因：主题配置加载后未应用到 DOM

## 根本原因分析

在 `settings.ts` 的 `useSettingsStore` 中，虽然从 localStorage 加载了主题配置，但没有调用 `applyTheme()` 函数将主题应用到 DOM。这导致：

1. **CSS 变量未设置**：`applyTheme()` 负责设置 CSS 变量（如 `--bg-color`, `--text-color` 等）
2. **data-theme 属性未设置**：`applyTheme()` 负责设置 `data-theme` 属性，用于 CSS 选择器
3. **组件使用默认值**：所有组件使用 CSS 变量的默认值（fallback），而不是实际的主题配置

## 影响的文件

- `src/renderer/src/stores/settings.ts` - 设置状态管理
- `src/renderer/src/views/Settings.vue` - 设置页面组件

## 解决方案

### 方案 1: 在 store 初始化时应用主题（已采用）

在 `useSettingsStore` 初始化时，立即调用 `applyTheme()` 将主题应用到 DOM：

```typescript
export const useSettingsStore = defineStore('settings', () => {
  // 加载初始设置
  const initialConfig = loadSettings()
  
  // 应用初始主题到 DOM
  applyTheme(initialConfig.theme)
  
  // ... 其他代码
})
```

### 方案 2: 移除主题类绑定，使用 data-theme 属性

修改 `Settings.vue`，移除 `:class="settingsStore.theme"` 绑定，完全依赖 CSS 变量：

```vue
<!-- 修改前 -->
<div class="settings-container" :class="settingsStore.theme">

<!-- 修改后 -->
<div class="settings-container">
```

### 方案 3: 更新 CSS 选择器

将所有 `.settings-container.light` 选择器改为 `[data-theme="light"] .settings-container`：

```css
/* 修改前 */
.settings-container.light {
  background-color: #ffffff;
}

/* 修改后 */
[data-theme="light"] .settings-container {
  background-color: #ffffff;
}
```

## 技术细节

### 主题系统工作原理

1. **主题配置存储**：
   - 默认主题：`dark`（在 `defaultConfig` 中定义）
   - 用户配置：存储在 localStorage 的 `app-settings` 中

2. **主题应用流程**：
   ```
   应用启动 → 加载配置 → 应用主题到 DOM → 设置 CSS 变量和 data-theme 属性 → 组件使用 CSS 变量
   ```

3. **CSS 变量系统**：
   - 深色主题：
     ```css
     --bg-color: #1e1e1e
     --text-color: #cccccc
     --border-color: #333333
     /* ... */
     ```
   - 浅色主题：
     ```css
     --bg-color: #ffffff
     --text-color: #333333
     --border-color: #e0e0e0
     /* ... */
     ```

4. **组件使用方式**：
   ```css
   .settings-container {
     background-color: var(--bg-color, #000000);
     color: var(--text-color, #ffffff);
   }
   ```

### 关键发现

- `applyTheme()` 函数负责设置 CSS 变量和 `data-theme` 属性
- 所有组件应该使用 CSS 变量，而不是硬编码的颜色值
- `data-theme` 属性用于 CSS 选择器，实现主题特定的样式
- 必须在应用启动时调用 `applyTheme()`，否则所有组件使用默认值

## 测试计划

1. E2E 测试：
   - 验证应用启动时主题一致性
   - 验证主题切换后所有组件主题一致
   - 验证 localStorage 中的主题配置正确应用

## 状态
- [x] 问题已确认
- [x] 根本原因已分析
- [x] 解决方案已实现
- [x] 测试用例已编写
- [ ] 测试已通过
- [ ] 已合并到主分支

## 备注

这是一个影响用户体验的重要问题，会导致应用看起来不一致。修复后，所有组件将使用统一的主题系统。
