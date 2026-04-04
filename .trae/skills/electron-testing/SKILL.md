---
name: "electron-testing"
description: "Electron 应用测试最佳实践。当测试 Electron 应用、调试 E2E 测试、或遇到 window.api undefined 问题时调用。"
---

# Electron 应用测试最佳实践

- 获取控制台日志用于调试
- 不要使用浏览器模式编写测试用例

## 核心概念

### Electron 应用的两种访问方式

1. **桌面应用模式** (`npm run dev` 或打包后的应用)
   - 启动完整的 Electron 应用
   - preload 脚本正常加载
   - `window.api` 可用
   - contextBridge 正常工作
   - 使用这个模式进行测试时，需要确保 `window.api` 是可用的

2. **浏览器模式** (直接访问 `http://localhost:5173/`)
   - 仅加载渲染进程的 Web 页面
   - **没有** preload 脚本
   - `window.api` 是 `undefined`
   - 无法调用 IPC 通信
   - 不要使用这个模式进行测试

## 常见错误

### 错误：在浏览器中测试 Electron 应用

```
❌ 错误做法：
npm run dev  // 启动 Electron 应用
// 然后用 Chrome DevTools 连接到 http://localhost:5173/
// 此时 window.api 是 undefined
```

**原因**：浏览器直接访问的是渲染进程的 Web 页面，没有 Electron 的 preload 脚本注入 `window.api`。

### 正确做法：使用 Playwright 测试 Electron

```typescript
// ✅ 正确做法：使用 Playwright 的 _electron.launch()
import { _electron as electron } from '@playwright/test'

const app = await electron.launch({
  args: [path.join(__dirname, '../out/main/index.js')],
  stdio: 'pipe'
})

const page = await app.firstWindow()
```

## Playwright Electron 测试配置

### 1. 启动配置

```typescript
// e2e/helpers/electron-app.ts
export async function startApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../out/main/index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test'
    },
    stdio: 'pipe'  // 捕获主进程日志
  })

  // 监听主进程日志
  electronApp.process().stdout?.on('data', (data) => {
    console.log('[Main stdout]', data.toString())
  })
  electronApp.process().stderr?.on('data', (data) => {
    console.error('[Main stderr]', data.toString())
  })

  const page = await electronApp.firstWindow()

  // 监听渲染进程日志
  page.on('console', (msg) => {
    console.log(`[Renderer ${msg.type()}]`, msg.text())
  })
  page.on('pageerror', (error) => {
    console.error('[Renderer error]', error.message)
  })

  await page.waitForLoadState('domcontentloaded')

  return { app: electronApp, page }
}
```

### 2. 测试示例

```typescript
// e2e/connection.e2e.spec.ts
import { test, expect } from '@playwright/test'
import { startApp, closeApp } from './helpers/electron-app'

test.describe('SSH 连接测试', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('创建会话并连接', async () => {
    // 测试代码...
    await page.locator('.session-item').dblclick()
    await expect(page.locator('.xterm')).toBeVisible()
  })
})
```

### 3. Playwright 配置

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    {
      name: 'electron',
      use: { 
        // Electron 项目不需要 browserName
      },
    },
  ],
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list']
  ],
})
```

## 调试技巧

### 1. 查看主进程日志

```typescript
// 在 startApp 中添加
electronApp.process().stdout?.on('data', (data) => {
  console.log('[Main]', data.toString())
})
```

### 2. 查看渲染进程日志

```typescript
page.on('console', (msg) => {
  console.log(`[Renderer ${msg.type()}]`, msg.text())
})
```

### 3. 检查 window.api 是否存在

```typescript
const hasApi = await page.evaluate(() => {
  return typeof window.api !== 'undefined'
})
console.log('window.api exists:', hasApi)
```

### 4. 右键检查元素（开发模式）

在 Electron 应用中右键点击 → "检查元素" 可以打开 DevTools。

## 关键要点

| 场景 | 正确方法 |
|------|----------|
| E2E 测试 | Playwright `_electron.launch()` |
| 手动调试 | `npm run dev` + 应用内右键检查 |
| 单元测试 | Vitest + mock |
| 集成测试 | Vitest + IPC handler 测试 |

## 常见问题排查

### Q: `window.api` 是 undefined

**检查清单**：
1. 确认使用 Playwright `_electron.launch()` 启动
2. 确认 preload 脚本路径正确
3. 确认 `contextBridge.exposeInMainWorld('api', api)` 已执行
4. 检查 `contextIsolation` 配置

### Q: 测试中超时

**可能原因**：
1. SSH 连接超时 - 增加等待时间
2. 元素未渲染 - 检查选择器
3. 应用未启动 - 检查构建输出

### Q: 测试隔离问题

**解决方案**：
- 每个测试后清理状态
- 使用唯一的会话名称
- 关闭未关闭的弹窗/表单

## 捕获控制台报错

### 1. Playwright 配置

在 `playwright.config.ts` 中添加多项目支持：

```typescript
export default defineConfig({
  projects: [
    {
      name: 'electron',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'chromium',  // 用于捕获 Vue 运行时警告
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
```

### 2. Electron 模式 - 捕获控制台消息

```typescript
import { test, expect, ElectronApplication } from '@playwright/test'
import { startApp, closeApp } from './helpers/electron-app'

const consoleMessages: any[] = []
const pageErrors: any[] = []

test.describe('测试', () => {
  let page: any
  
  test.beforeAll(async () => {
    const result = await startApp()
    page = result.page
    
    consoleMessages.length = 0
    pageErrors.length = 0
    
    // 监听控制台
    page.on('console', (msg: any) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      })
      if (msg.type() === 'warning' || msg.type() === 'error') {
        console.error(`[${msg.type()}] ${msg.text}`)
      }
    })
    
    // 监听页面错误
    page.on('pageerror', (error: any) => {
      pageErrors.push({ message: error.message, stack: error.stack })
      console.error(`[Page Error] ${error.message}`)
    })
  })

  test.afterAll(async () => {
    await closeApp(page)
  })

  test('捕获错误', async () => {
    // 执行操作
    await page.locator('.some-element').click()
    await page.waitForTimeout(1000)
    
    // 查找特定错误
    const targetErrors = consoleMessages.filter(msg => 
      msg.text.includes('错误关键词')
    )
    
    console.log(`找到 ${targetErrors.length} 个错误`)
    targetErrors.forEach(err => {
      console.log(`[${err.type}] ${err.text}`)
    })
  })
})
```


### 4. 运行测试

```bash
# Electron 模式
npx playwright test --project=electron

# 浏览器模式（需先运行 npm run dev）
npx playwright test --project=chromium
```

### 5. 关键要点

- **清空消息**：测试前清空数组 `consoleMessages.length = 0`
- **等待时间**：给足时间让错误出现 `await page.waitForTimeout(1000)`
- **过滤错误**：按类型或关键词过滤
- **详细输出**：输出类型、内容、位置
