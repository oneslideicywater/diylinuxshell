# 浅色主题下右键菜单文字显示不明显 Bug

## Bug 描述

在浅色主题下，右键点击会话列表时弹出的"新建分组"菜单中，文字颜色与背景对比度不足，导致菜单内容难以辨认。

## Bug 分类

- **类型**: UI/UX - 主题样式
- **严重程度**: 低
- **影响范围**: 所有右键菜单（新建分组菜单、会话操作菜单等）
- **主题**: 浅色主题

## 复现步骤

1. 启动应用
2. 切换到浅色主题
3. 在会话列表任意位置右键点击
4. 观察弹出的菜单

**预期结果**: 菜单文字清晰可见，与背景有足够对比度
**实际结果**: 菜单文字颜色过浅，在白色背景上难以辨认

## 根本原因

浅色主题下，`.context-menu` 的背景色设置为白色 (`#ffffff`)，但 `.menu-item` 的文字颜色使用的是 CSS 变量 `var(--text-primary, #e0e0e0)`。这个默认值 `#e0e0e0` 是浅灰色，在白色背景上对比度严重不足（对比度约为 1.3:1，远低于 WCAG AA 标准要求的 4.5:1）。

### 问题代码

```css
/* 默认样式 */
.menu-item {
  color: var(--text-primary, #e0e0e0); /* 浅灰色 */
}

/* 浅色主题 */
[data-theme='light'] .context-menu {
  background: #ffffff; /* 白色背景 */
  /* 缺少 .menu-item 的文字颜色定义 */
}
```

## 技术细节

### 问题组件
- `SessionList.vue` - 右键菜单样式定义

### 影响范围
所有使用 `.context-menu` 和 `.menu-item` 类的菜单：
- 列表右键菜单（新建分组）
- 分组右键菜单（重命名、删除）
- 会话右键菜单（编辑、复制、删除等）

### 对比度分析
- **修复前**: `#e0e0e0` on `#ffffff` = 1.3:1 ❌ (不满足任何 WCAG 标准)
- **修复后**: `#333333` on `#ffffff` = 12.6:1 ✅ (满足 WCAG AAA 标准)

## 解决方案

为浅色主题的菜单项添加明确的深色文字颜色：

```css
/* 浅色主题 */
[data-theme='light'] .context-menu {
  background: #ffffff;
  border-color: #e0e0e0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

/* 新增：浅色主题下菜单项的文字颜色 */
[data-theme='light'] .menu-item {
  color: #333333;
}

[data-theme='light'] .menu-item:hover {
  background-color: #f5f5f5;
}
```

### 颜色选择理由
- `#333333` 是深灰色，接近黑色但更柔和
- 在白色背景上提供 12.6:1 的对比度，满足 WCAG AAA 标准
- 与深色主题的 `#e0e0e0` 在深色背景上的对比度相当，保持视觉一致性

## 修复验证

### 手动测试
1. 启动应用：`npm run dev`
2. 切换到浅色主题
3. 在会话列表右键点击
4. 验证菜单文字清晰可见
5. 验证鼠标悬停效果正常

### 视觉检查清单
- [x] 菜单项文字清晰可读
- [x] 图标颜色正常显示
- [x] 悬停状态背景色变化明显
- [x] 危险操作项（删除等）保持红色
- [x] 分隔线可见

## 相关文件

### 修改的文件
- `src/renderer/src/components/session/SessionList.vue` - 添加浅色主题菜单样式

### 相关样式
```css
/* 深色主题（默认） */
[data-theme='dark'] .context-menu {
  background: #2a2a2a;
  border-color: #3a3a3a;
}

[data-theme='dark'] .menu-item {
  color: #e0e0e0; /* 浅色文字在深色背景上 */
}

/* 浅色主题（修复后） */
[data-theme='light'] .context-menu {
  background: #ffffff;
  border-color: #e0e0e0;
}

[data-theme='light'] .menu-item {
  color: #333333; /* 深色文字在白色背景上 */
}
```

## 经验总结

### 问题难点
1. **CSS 变量默认值陷阱**: 使用 `var(--text-primary, #e0e0e0)` 时，如果浅色主题没有覆盖 `--text-primary`，就会使用深色主题的默认值
2. **主题切换测试不足**: 开发时主要在深色主题下测试，忽略了浅色主题的验证
3. **对比度意识不足**: 没有严格按照无障碍标准检查颜色对比度

### 最佳实践
1. **明确的主题样式**: 为每个主题明确定义所有必要的样式，不要依赖默认值
2. **双向测试**: 在深色和浅色主题下都要进行完整的视觉测试
3. **遵循 WCAG 标准**: 确保文字和背景的对比度至少达到 WCAG AA 标准（4.5:1）
4. **CSS 变量使用**: 使用 CSS 变量时，确保在所有主题中都有定义

### 预防措施
1. 建立主题样式检查清单
2. 在 PRD 中明确主题切换的测试要求
3. 考虑添加 E2E 测试，自动切换主题并截图对比

## 时间线

- **发现时间**: 2026-04-02
- **修复时间**: 2026-04-02
- **修复人员**: AI Assistant
- **验证状态**: ✅ 已修复

## 参考链接

- [WCAG 对比度标准](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [WebAIM 对比度检查工具](https://webaim.org/resources/contrastchecker/)
- [CSS 变量最佳实践](https://developer.mozilla.org/zh-CN/docs/Web/CSS/Using_CSS_custom_properties)
