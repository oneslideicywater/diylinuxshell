# Settings Store 问题分析

> 文件路径: `src/renderer/src/stores/settings.ts`

## 1. 数据一致性问题

### 1.1 主题强制覆盖用户选择

**严重程度**: 高

**问题描述**:
`loadSettings` 函数强制将主题设置为默认值（深色），忽略用户之前保存的主题选择。

**代码位置**:
```typescript
const loadSettings = (): AppConfig => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AppConfig>
      return {
        ...defaultConfig,
        ...parsed,
        theme: defaultConfig.theme, // ❌ 强制使用默认主题（深色）
        terminal: {
          ...defaultConfig.terminal,
          ...parsed.terminal
        }
      }
    }
  } catch (error) {
    console.error('加载设置失败:', error)
  }
  return { ...defaultConfig }
}
```

**建议修复**:
- 移除 `theme: defaultConfig.theme` 这行
- 或使用 `theme: parsed.theme ?? defaultConfig.theme`

---

### 1.2 `config` 对象与独立状态可能不同步

**严重程度**: 高

**问题描述**:
Store 同时维护独立的 ref（`theme`, `language`, `terminal` 等）和完整的 `config` 对象。watch 监听器在变化时重建 `config`，但在初始化时可能不同步。

**代码位置**:
```typescript
const theme = ref<'dark' | 'light'>(initialConfig.theme)
const language = ref(initialConfig.language)
const terminal = ref<TerminalConfig>({ ...initialConfig.terminal })
const config = ref<AppConfig>({ ...initialConfig })

// watch 在变化时同步，但初始值可能不一致
watch(
  [language, terminal, connectionTimeout, keepaliveInterval, autoReconnect, reconnectAttempts],
  () => {
    config.value = {
      theme: theme.value,
      language: language.value,
      // ...
    }
    saveSettings(config.value)
  },
  { deep: true }
)
```

**建议修复**:
- 只使用 `config` 对象，通过 computed 暴露子字段
- 或使用单一数据源模式

---

### 1.3 `resetSettings` 未保存到 localStorage

**严重程度**: 中

**问题描述**:
`resetSettings` 只重置内存中的状态，但未调用 `saveSettings` 持久化，刷新后恢复为用户之前的设置。

**代码位置**:
```typescript
const resetSettings = (): void => {
  theme.value = defaultConfig.theme
  language.value = defaultConfig.language
  terminal.value = { ...defaultConfig.terminal }
  // ... 重置所有状态
  applyTheme(defaultConfig.theme)
  // ❌ 缺少 saveSettings(config.value)
}
```

**建议修复**:
```typescript
const resetSettings = (): void => {
  // ... 重置逻辑
  config.value = { ...defaultConfig }
  saveSettings(config.value)  // 添加持久化
}
```

---

## 2. 性能问题

### 2.1 watch 深度监听导致频繁保存

**严重程度**: 中

**问题描述**:
`watch` 使用 `{ deep: true }` 监听 `terminal` 对象，任何子字段变化都会触发保存。如果用户快速调整多个设置，会产生多次 localStorage 写入。

**代码位置**:
```typescript
watch(
  [language, terminal, connectionTimeout, keepaliveInterval, autoReconnect, reconnectAttempts],
  () => {
    config.value = { /* ... */ }
    saveSettings(config.value)
  },
  { deep: true }
)
```

**建议修复**:
- 添加防抖：`watch(..., debounce(() => { saveSettings(...) }, 300))`
- 或提供"保存"按钮，手动触发保存

---

### 2.2 `setTheme` 与 watch 重复保存

**严重程度**: 低

**问题描述**:
`setTheme` 手动调用 `saveSettings`，但主题变化也可能触发 watch（如果 watch 包含 theme），导致重复保存。

**代码位置**:
```typescript
const setTheme = (newTheme: 'dark' | 'light'): void => {
  theme.value = newTheme
  config.value.theme = newTheme
  applyTheme(newTheme)
  saveSettings(config.value)  // 手动保存
}
```

**注意**: 当前 watch 不包含 `theme`，所以不会重复保存，但设计不一致。

**建议修复**:
- 将 `theme` 加入 watch 监听列表
- 或统一使用手动保存模式

---

## 3. 功能缺失

### 3.1 缺少设置导入/导出功能

**严重程度**: 中

**问题描述**:
用户无法备份和恢复设置，更换设备时需要重新配置。

**建议修复**:
- 添加 `exportSettings(): string` 导出 JSON
- 添加 `importSettings(json: string): void` 导入

---

### 3.2 缺少设置验证

**严重程度**: 中

**问题描述**:
加载设置时没有验证字段有效性，损坏的配置可能导致应用异常。

**建议修复**:
```typescript
const validateConfig = (config: Partial<AppConfig>): AppConfig => {
  return {
    ...defaultConfig,
    ...config,
    terminal: {
      ...defaultConfig.terminal,
      ...config.terminal,
      fontSize: clamp(config.terminal?.fontSize ?? 14, 8, 72),
    }
  }
}
```

---

### 3.3 缺少主题跟随系统功能

**严重程度**: 低

**问题描述**:
不支持自动跟随系统主题（深色/浅色）。

**建议修复**:
- 添加 `theme: 'dark' | 'light' | 'auto'` 选项
- 使用 `window.matchMedia('(prefers-color-scheme: dark)')` 监听系统主题

---

## 4. 类型安全问题

### 4.1 主题配色对象缺少类型定义

**严重程度**: 低

**问题描述**:
`darkTheme` 和 `lightTheme` 对象没有类型定义，容易拼写错误。

**建议修复**:
```typescript
interface TerminalThemeColors {
  background: string
  foreground: string
  cursor: string
  // ... 所有颜色字段
}

const darkTheme: TerminalThemeColors = { /* ... */ }
```

---

## 5. 架构问题

### 5.1 CSS 变量管理与 Store 耦合

**严重程度**: 中

**问题描述**:
`applyTheme` 函数直接在 Store 中操作 DOM 设置 CSS 变量，违反了关注点分离原则。

**代码位置**:
```typescript
const applyTheme = (theme: 'dark' | 'light'): void => {
  document.documentElement.setAttribute('data-theme', theme)
  const root = document.documentElement
  root.style.setProperty('--bg-color', '#1e1e1e')
  // ... 大量 CSS 变量设置
}
```

**建议修复**:
- 将 CSS 变量管理移到单独的模块
- 或使用 CSS 类切换，由样式表处理变量

---

### 5.2 localStorage 操作未抽象

**严重程度**: 低

**问题描述**:
`loadSettings` 和 `saveSettings` 直接操作 localStorage，难以替换为其他存储方式（如 IndexedDB）。

**建议修复**:
```typescript
interface StorageAdapter {
  get<T>(key: string): T | null
  set<T>(key: string, value: T): void
}

const localStorageAdapter: StorageAdapter = {
  get: (key) => { /* ... */ },
  set: (key, value) => { /* ... */ }
}
```

---

## 6. 响应式问题

### 6.1 `config` 对象重建导致引用变化

**严重程度**: 低

**问题描述**:
每次 watch 触发时都创建新的 `config` 对象，依赖 `config` 引用的组件可能意外重新渲染。

**建议修复**:
- 使用 `Object.assign(config.value, newConfig)` 更新属性
- 或只暴露 computed 只读视图

---

## 总结

| 问题类型 | 数量 | 严重程度 |
|---------|------|---------|
| 数据一致性 | 3 | 高/中 |
| 性能问题 | 2 | 中/低 |
| 功能缺失 | 3 | 中/低 |
| 类型安全 | 1 | 低 |
| 架构问题 | 2 | 中/低 |
| 响应式问题 | 1 | 低 |

**优先修复建议**:
1. 修复主题强制覆盖问题，尊重用户选择
2. 修复 `resetSettings` 未持久化问题
3. 统一数据源，避免 `config` 与独立状态不同步
4. 添加设置防抖保存，减少 localStorage 写入
