# BUG-003: 浅色主题仅对设置组件生效

## 问题描述

**发现日期**: 2026-04-01

**严重程度**: 中等

**影响范围**: 用户界面主题切换功能

**问题描述**: 
当用户在设置页面切换到浅色主题时，只有设置组件本身应用了浅色主题样式，而其他组件（终端组件、会话侧边栏、标签页栏等）仍然显示为深色主题。

## 复现步骤

1. 启动应用程序
2. 点击设置按钮进入设置页面
3. 在外观设置中切换到"浅色"主题
4. 观察界面变化

## 预期行为

切换到浅色主题后，所有界面组件（包括终端、会话侧边栏、标签页栏等）都应该应用浅色主题样式。

## 实际行为

只有设置页面本身应用了浅色主题，其他组件仍然保持深色主题样式。

## 根本原因分析

在 `src/renderer/src/stores/settings.ts` 的 `applyTheme` 函数中，只设置了以下 5 个 CSS 变量：

```typescript
root.style.setProperty('--bg-color', '#ffffff')
root.style.setProperty('--text-color', '#333333')
root.style.setProperty('--border-color', '#e0e0e0')
root.style.setProperty('--hover-bg', '#f0f0f0')
root.style.setProperty('--active-bg', '#e6f3ff')
```

但是其他组件使用了更多的 CSS 变量，这些变量没有被设置：

- `--sidebar-bg`: 侧边栏背景色
- `--header-bg`: 标题栏背景色
- `--tab-bg`: 标签页背景色
- `--tab-hover-bg`: 标签页悬停背景色
- `--tab-active-bg`: 激活标签页背景色
- `--text-secondary`: 次要文本颜色
- `--text-tertiary`: 第三级文本颜色
- `--scrollbar-thumb`: 滚动条颜色

这些变量使用了 CSS 中的 fallback 默认值，而这些默认值都是深色主题的颜色值，导致浅色主题无法正确应用。

## 影响的文件

- `src/renderer/src/stores/settings.ts` - 需要添加更多 CSS 变量
- `src/renderer/src/components/layout/AppLayout.vue` - 使用了未设置的 CSS 变量
- `src/renderer/src/components/terminal/TerminalTab.vue` - 使用了未设置的 CSS 变量
- `src/renderer/src/components/terminal/TerminalTabs.vue` - 使用了未设置的 CSS 变量
- `src/renderer/src/components/session/SessionList.vue` - 使用了未设置的 CSS 变量

## 解决方案

### 方案 1: 扩展 applyTheme 函数

在 `applyTheme` 函数中添加所有需要的 CSS 变量：

```typescript
const applyTheme = (theme: 'dark' | 'light'): void => {
  document.documentElement.setAttribute('data-theme', theme)
  
  const root = document.documentElement
  if (theme === 'dark') {
    // 深色主题
    root.style.setProperty('--bg-color', '#1e1e1e')
    root.style.setProperty('--text-color', '#cccccc')
    root.style.setProperty('--border-color', '#333333')
    root.style.setProperty('--hover-bg', '#2a2a2a')
    root.style.setProperty('--active-bg', '#094771')
    root.style.setProperty('--sidebar-bg', '#252526')
    root.style.setProperty('--header-bg', '#252526')
    root.style.setProperty('--tab-bg', '#2d2d2d')
    root.style.setProperty('--tab-hover-bg', '#3c3c3c')
    root.style.setProperty('--tab-active-bg', '#1e1e1e')
    root.style.setProperty('--text-secondary', '#808080')
    root.style.setProperty('--text-tertiary', '#606060')
    root.style.setProperty('--scrollbar-thumb', '#424242')
  } else {
    // 浅色主题
    root.style.setProperty('--bg-color', '#ffffff')
    root.style.setProperty('--text-color', '#333333')
    root.style.setProperty('--border-color', '#e0e0e0')
    root.style.setProperty('--hover-bg', '#f0f0f0')
    root.style.setProperty('--active-bg', '#e6f3ff')
    root.style.setProperty('--sidebar-bg', '#f3f3f3')
    root.style.setProperty('--header-bg', '#f3f3f3')
    root.style.setProperty('--tab-bg', '#e8e8e8')
    root.style.setProperty('--tab-hover-bg', '#d4d4d4')
    root.style.setProperty('--tab-active-bg', '#ffffff')
    root.style.setProperty('--text-secondary', '#666666')
    root.style.setProperty('--text-tertiary', '#999999')
    root.style.setProperty('--scrollbar-thumb', '#c1c1c1')
  }
}
```

## 测试计划

1. 单元测试：验证 applyTheme 函数设置了所有必要的 CSS 变量
2. E2E 测试：
   - 切换到浅色主题后，验证侧边栏背景色
   - 切换到浅色主题后，验证标签页栏背景色
   - 切换到浅色主题后，验证终端区域背景色
   - 验证主题切换后重启应用仍然保持

## 状态

- [x] 问题已确认
- [x] 根本原因已分析
- [x] 解决方案已实现
- [x] 测试用例已编写
- [x] 测试已通过
- [ ] 已合并到主分支

## 相关 Issue

无

## 备注

此问题影响用户体验，建议尽快修复。
