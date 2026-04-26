# Settings 视图问题分析

> 文件路径: `src/renderer/src/views/Settings.vue`

## 1. 功能缺失

### 1.1 导出/导入/清除配置功能未实现

**严重程度**: 高

**问题描述**:
数据管理标签页的导出、导入、清除功能都是 TODO 状态，只显示成功提示，没有实际实现。

**代码位置**:
```typescript
const handleExportConfig = (): void => {
  // TODO: 实现导出配置
  ElMessage.success('配置导出成功')  // ❌ 虚假提示
}

const handleImportConfig = (): void => {
  // TODO: 实现导入配置
  ElMessage.success('配置导入成功')  // ❌ 虚假提示
}

const handleClearData = async (): Promise<void> => {
  // ...
  // TODO: 实现清除数据
  ElMessage.success('数据清除成功')  // ❌ 虚假提示
}
```

**建议修复**:
- 实现实际的导出/导入/清除逻辑
- 或在实现前禁用按钮并显示"开发中"提示

---

### 1.2 缺少配置变更的持久化确认

**严重程度**: 中

**问题描述**:
设置变更后立即保存，没有确认提示，用户可能误操作。

**建议修复**:
- 添加"应用"按钮，批量保存变更
- 或在关键设置变更时显示确认对话框

---

## 2. 性能问题

### 2.1 每次设置变更都触发独立的消息提示

**严重程度**: 低

**问题描述**:
每个设置变更都调用 `ElMessage.success()`，如果用户快速修改多个设置，会弹出多个消息，影响体验。

**代码位置**:
```typescript
const handleThemeChange = (val: string | number | boolean | undefined): void => {
  // ...
  ElMessage.success(`已切换到${theme === 'dark' ? '深色' : '浅色'}主题`)
}

const handleFontSizeChange = (val: number | number[]): void => {
  // ...
  ElMessage.success(`字体大小已设置为 ${val}px`)
}
// ... 每个 change handler 都有 ElMessage
```

**建议修复**:
- 移除大部分设置的即时提示
- 或只在关键设置变更时显示提示

---

## 3. 代码质量问题

### 3.1 过多的事件处理函数

**严重程度**: 中

**问题描述**:
每个设置项都有独立的 change handler，代码重复度高，可以统一处理。

**代码位置**:
```typescript
const handleFontSizeChange = (val: number | number[]): void => { /* ... */ }
const handleFontFamilyChange = (val: string | number | boolean): void => { /* ... */ }
const handleTerminalTypeChange = (val: string | number | boolean): void => { /* ... */ }
const handleCursorStyleChange = (val: string | number | boolean): void => { /* ... */ }
const handleCursorBlinkChange = (val: string | number | boolean): void => { /* ... */ }
const handleScrollbackChange = (cur: number | undefined, _prev?: number | undefined): void => { /* ... */ }
const handleConnectionTimeoutChange = (cur: number | undefined, _prev?: number | undefined): void => { /* ... */ }
const handleKeepaliveIntervalChange = (cur: number | undefined, _prev?: number | undefined): void => { /* ... */ }
const handleAutoReconnectChange = (val: string | number | boolean): void => { /* ... */ }
const handleReconnectAttemptsChange = (cur: number | undefined, _prev?: number | undefined): void => { /* ... */ }
```

**建议修复**:
```typescript
// 使用 watch 替代
watch(() => settingsStore.terminal.fontSize, (newSize) => {
  settingsStore.setFontSize(newSize)
})

// 或使用统一的 handler
const handleSettingChange = (key: string, value: unknown) => {
  settingsStore.updateSetting(key, value)
}
```

---

### 3.2 类型检查过于繁琐

**严重程度**: 中

**问题描述**:
每个 handler 都手动检查类型，代码冗长。Element Plus 的事件类型应该是已知的。

**代码位置**:
```typescript
const handleThemeChange = (val: string | number | boolean | undefined): void => {
  if (val !== 'dark' && val !== 'light') {
    console.error('Invalid theme value:', val)
    return
  }
  const theme = val as 'dark' | 'light'
  // ...
}
```

**建议修复**:
- 使用 TypeScript 严格模式，让编译器检查类型
- 或创建类型安全的包装函数

---

### 3.3 字体列表硬编码

**严重程度**: 低

**问题描述**:
字体选项硬编码在模板中，不易扩展。

**代码位置**:
```vue
<el-select v-model="settingsStore.terminal.fontFamily">
  <el-option label="Cascadia Code" value="Cascadia Code" />
  <el-option label="Fira Code" value="Fira Code" />
  <el-option label="Consolas" value="Consolas" />
  <el-option label="Monaco" value="Monaco" />
</el-select>
```

**建议修复**:
```typescript
const FONT_OPTIONS = [
  { label: 'Cascadia Code', value: 'Cascadia Code' },
  { label: 'Fira Code', value: 'Fira Code' },
  { label: 'Consolas', value: 'Consolas' },
  { label: 'Monaco', value: 'Monaco' },
] as const
```

```vue
<el-option
  v-for="font in FONT_OPTIONS"
  :key="font.value"
  :label="font.label"
  :value="font.value"
/>
```

---

### 3.4 终端类型列表硬编码

**严重程度**: 低

**问题描述**:
与字体列表相同的问题。

---

### 3.5 光标样式列表硬编码

**严重程度**: 低

**问题描述**:
与字体列表相同的问题。

---

## 4. 样式问题

### 4.1 大量重复的深色/浅色主题样式

**严重程度**: 中

**问题描述**:
每个 Element Plus 组件都单独写样式覆盖，代码冗长且难以维护。

**建议修复**:
- 使用 Element Plus 的 CSS 变量定制主题
- 或创建统一的主题配置文件

```css
:root {
  --el-bg-color: var(--bg-color);
  --el-text-color: var(--text-color);
  --el-border-color: var(--border-color);
  /* ... */
}
```

---

### 4.2 缺少响应式适配

**严重程度**: 低

**问题描述**:
左侧标签页固定 `width: 200px`，在小屏幕可能不够用。

**建议修复**:
```css
.settings-content :deep(.el-tabs__header) {
  width: 200px;
  min-width: 150px;
}
```

---

## 5. 无障碍访问问题

### 5.1 返回按钮缺少文本

**严重程度**: 中

**问题描述**:
返回按钮只有 SVG 图标，屏幕阅读器无法识别。

**代码位置**:
```vue
<button class="back-btn" title="返回" @click="handleBack">
  <svg width="16" height="16" viewBox="0 0 16 16">
    <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" fill="none" />
  </svg>
</button>
```

**建议修复**:
- 当前已有 `title="返回"`，这是好的
- 可以添加 `aria-label="返回主页"` 增强可访问性

```vue
<button class="back-btn" title="返回" aria-label="返回主页" @click="handleBack">
```

---

## 6. 架构问题

### 6.1 设置变更立即生效，缺少批量保存机制

**严重程度**: 中

**问题描述**:
每个设置变更都立即调用 Store 的 setter 并持久化，如果用户想撤销操作，无法实现。

**建议修复**:
- 添加"应用"和"取消"按钮
- 使用本地状态暂存变更，点击"应用"后批量保存

---

## 总结

| 问题类型 | 数量 | 严重程度 |
|---------|------|---------|
| 功能缺失 | 2 | 高/中 |
| 性能问题 | 1 | 低 |
| 代码质量 | 5 | 中/低 |
| 样式问题 | 2 | 中/低 |
| 无障碍访问 | 1 | 中 |
| 架构问题 | 1 | 中 |

**优先修复建议**:
1. 实现导出/导入/清除配置功能，或禁用按钮
2. 合并过多的事件处理函数，使用 watch 或统一 handler
3. 使用 Element Plus CSS 变量简化主题样式
4. 提取硬编码的选项列表为常量
5. 考虑添加批量保存机制
