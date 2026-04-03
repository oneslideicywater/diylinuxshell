# BUG-007: 浅色主题下会话表单输入框样式问题

## 问题描述

**发现日期**: 2026-04-02

**严重程度**: 中

**影响范围**: 会话表单 - 浅色主题

**问题描述**: 
在浅色主题下，会话编辑表单的输入框样式有问题。输入框的背景色、文字颜色和边框颜色都是深色，导致文字显示不清楚，严重影响用户体验。

## 复现步骤

1. 启动应用程序
2. 进入设置页面 -> 外观设置
3. 切换到浅色主题
4. 返回主页
5. 点击"新建会话"按钮
6. 观察会话表单中的输入框样式

## 预期行为

在浅色主题下，会话表单输入框应该：
- 背景色：白色或浅色背景
- 文字颜色：深色文字，确保可读性
- 边框颜色：浅灰色边框，与主题一致

## 实际行为

- 背景色：深色背景（#3c3c3c）
- 文字颜色：浅色文字（#cccccc）
- 边框颜色：深色边框（#333333）
- 结果：文字和边框都是深色，在深色背景上显示不清楚

## 根本原因分析

在 `SessionForm.vue` 中，输入框使用了 CSS 变量：
```css
.form-group input {
  background-color: var(--input-bg, #3c3c3c);
  color: var(--text-color, #cccccc);
  border: 1px solid var(--border-color, #3c3c3c);
}
```

但是在 `settings.ts` 的 `applyTheme()` 函数中，没有设置 `--input-bg`、`--primary-color`、`--primary-hover`、`--button-bg`、`--button-hover-bg` 等 CSS 变量。这导致：

1. **CSS 变量未定义**：输入框使用了未定义的 CSS 变量
2. **使用默认值**：输入框使用了 CSS 变量的默认值（fallback），这些默认值是为深色主题设计的
3. **浅色主题下显示异常**：在浅色主题下，输入框仍然使用深色主题的默认值

## 影响的文件

- `src/renderer/src/stores/settings.ts` - 设置状态管理
- `src/renderer/src/components/session/SessionForm.vue` - 会话表单组件

## 解决方案

### 方案 1: 在 applyTheme 中添加缺失的 CSS 变量（已采用）

在 `settings.ts` 的 `applyTheme()` 函数中添加缺失的 CSS 变量：

```typescript
const applyTheme = (theme: 'dark' | 'light'): void => {
  const root = document.documentElement
  if (theme === 'dark') {
    // 深色主题
    root.style.setProperty('--input-bg', '#3c3c3c')
    root.style.setProperty('--primary-color', '#0e639c')
    root.style.setProperty('--primary-hover', '#1177bb')
    root.style.setProperty('--button-bg', '#0e639c')
    root.style.setProperty('--button-hover-bg', '#1177bb')
    // ... 其他变量
  } else {
    // 浅色主题
    root.style.setProperty('--input-bg', '#ffffff')
    root.style.setProperty('--primary-color', '#0e639c')
    root.style.setProperty('--primary-hover', '#1177bb')
    root.style.setProperty('--button-bg', '#0e639c')
    root.style.setProperty('--button-hover-bg', '#1177bb')
    // ... 其他变量
  }
}
```

### 方案 2: 添加 placeholder 样式

在 `SessionForm.vue` 中添加 placeholder 样式：

```css
.form-group input::placeholder {
  color: var(--text-tertiary, #606060);
}
```

## 技术细节

### CSS 变量系统

#### 深色主题
```css
--input-bg: #3c3c3c          /* 输入框背景色：深灰色 */
--primary-color: #0e639c     /* 主色调：蓝色 */
--primary-hover: #1177bb     /* 主色调悬停：浅蓝色 */
--button-bg: #0e639c         /* 按钮背景色：蓝色 */
--button-hover-bg: #1177bb   /* 按钮悬停背景色：浅蓝色 */
```

#### 浅色主题
```css
--input-bg: #ffffff          /* 输入框背景色：白色 */
--primary-color: #0e639c     /* 主色调：蓝色 */
--primary-hover: #1177bb     /* 主色调悬停：浅蓝色 */
--button-bg: #0e639c         /* 按钮背景色：蓝色 */
--button-hover-bg: #1177bb   /* 按钮悬停背景色：浅蓝色 */
```

### 关键发现

- 所有组件应该使用 CSS 变量，而不是硬编码的颜色值
- CSS 变量必须在 `applyTheme()` 函数中设置，否则会使用默认值
- 默认值（fallback）应该谨慎选择，确保在变量未定义时也能正常显示
- placeholder 颜色也需要使用 CSS 变量，确保在不同主题下都有良好的可读性

## 测试计划

1. E2E 测试：
   - 验证浅色主题下会话表单输入框样式正确
   - 验证输入框背景色为白色
   - 验证输入框文字颜色为深色
   - 验证输入框边框颜色为浅灰色
   - 验证所有输入框样式一致

## 状态
- [x] 问题已确认
- [x] 根本原因已分析
- [x] 解决方案已实现
- [x] 测试用例已编写
- [ ] 测试已通过
- [ ] 已合并到主分支

## 备注

这是一个影响用户体验的重要问题，会导致用户在浅色主题下无法正常使用会话表单。修复后，会话表单在所有主题下都能正常显示。
