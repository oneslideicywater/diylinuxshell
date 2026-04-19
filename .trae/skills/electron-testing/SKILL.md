---
name: "electron-testing"
description: "Electron 应用测试最佳实践。当测试 Electron 应用、调试 E2E 测试、或遇到 window.api undefined 问题时调用。"
---

# Electron 应用测试最佳实践

> **核心原则**：必须使用 Playwright `_electron.launch()` 启动完整 Electron 应用，禁止直接访问 `http://localhost:5173/` 浏览器模式。

---

## 📌 两种测试模式

| 模式 | 用途 | 特点 |
|------|------|------|
| **生产模式** | 功能测试、E2E 测试 | 使用 `out/main/index.js`，代码已编译优化 |
| **开发模式** | 捕获 Vue 运行时错误、调试 | 使用 Vite dev server，Vue 完整输出所有 warn/error |

### ⚠️ 关键区别

- **生产模式**：无法捕获 Vue 组件事件处理器的运行时错误（代码已压缩/优化）
- **开发模式**：可以捕获完整的控制台报错，包括 `[Vue warn]` 和 `ReferenceError`

---

## 🔧 标准测试模板

### 1️⃣ 生产模式（默认，用于功能测试）

```typescript
import { test, _electron as electron, ElectronApplication } from '@playwright/test'
import path from 'path'

let app: ElectronApplication
let page: any

test.describe('功能测试', () => {
  test.beforeAll(async () => {
    // 启动应用（生产模式）
    app = await electron.launch({
      args: [path.join(__dirname, '../../out/main/index.js')],
      stdio: 'pipe'
    })

    // 监听主进程日志
    const proc = app.process()
    proc.stdout?.on('data', (d) => console.log('[Main]', d.toString().trim()))
    proc.stderr?.on('data', (d) => console.error('[Main Err]', d.toString().trim()))

    page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)
  })

  test.afterAll(async () => {
    if (app) await app.close()
  })

  test('测试用例名称', async () => {
    // 测试逻辑...
    await page.locator('.element').click()
    await expect(page.locator('.result')).toBeVisible()
  })
})
```

### 2️⃣ 开发模式（用于捕获控制台报错）

```typescript
import { test, _electron as electron, ElectronApplication } from '@playwright/test'
import path from 'path'

let app: ElectronApplication
let page: any

test.describe('Dev 模式 - 控制台报错捕获', () => {
  test.beforeAll(async () => {
    // 启动应用（开发模式 - 关键：设置 ELECTRON_RENDERER_URL）
    app = await electron.launch({
      args: [path.join(__dirname, '../../out/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'development',
        ELECTRON_RENDERER_URL: 'http://localhost:5173'  // Vite dev server 地址
      },
      stdio: 'pipe'
    })

    // 监听主进程日志
    const proc = app.process()
    proc.stdout?.on('data', (d) => console.log('[Main]', d.toString().trim()))
    proc.stderr?.on('data', (d) => console.error('[Main Err]', d.toString().trim()))

    page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(3000)

    // 注入错误拦截器（在页面加载后立即注入）
    await injectErrorCapturers()
  })

  test.afterAll(async () => {
    if (app) await app.close()
  })

  /**
   * 注入多层级错误拦截器
   * 捕获 console.error / console.warn / window.onerror
   */
  async function injectErrorCapturers(): Promise<void> {
    await page.evaluate(() => {
      ;(window as any).__CAPTURED_ERRORS__ = []

      // 拦截 console.error
      const origError = console.error.bind(console)
      console.error = function(...args: any[]) {
        const msg = args.map(a =>
          a instanceof Error ? `[Error] ${a.message}\n${a.stack}` :
          typeof a === 'object' ? JSON.stringify(a) : String(a)
        ).join(' ')
        ;(window as any).__CAPTURED_ERRORS__.push({ type: 'ERROR', message: msg, time: Date.now() })
        origError.apply(console, args)
      }

      // 拦截 console.warn（Vue warn 在这里输出）
      const origWarn = console.warn.bind(console)
      console.warn = function(...args: any[]) {
        const msg = args.map(a =>
          typeof a === 'object' ? JSON.stringify(a) : String(a)
        ).join(' ')
        ;(window as any).__CAPTURED_ERRORS__.push({ type: 'WARN', message: msg, time: Date.now() })
        origWarn.apply(console, args)
      }

      // 拦截 window.onerror（捕获未定义变量等 ReferenceError）
      window.onerror = function(msg, src, line, col, err) {
        ;(window as any).__CAPTURED_ERRORS__.push({
          type: 'WINDOW_ERROR',
          message: String(msg),
          details: err ? `${err.name}: ${err.message}` : '',
          source: `${src}:${line}:${col}`,
          time: Date.now()
        })
        return false
      }
    })
  }

  test('右击元素并收集控制台报错', async () => {
    // 清空记录
    await page.evaluate(() => { ;(window as any).__CAPTURED_ERRORS__ = [] })

    // 执行操作（例如右键点击）
    const element = page.locator('.target-element').first()
    await element.click({ button: 'right', force: true })
    
    // 等待错误传播（Vue 异步错误需要时间）
    await page.waitForTimeout(3000)

    // 收集并分析结果
    const data = await page.evaluate(() => (window as any).__CAPTURED_ERRORS__ || [])

    // 分类统计
    const errors = data.filter((d: any) => d.type === 'ERROR')
    const warnings = data.filter((d: any) => d.type === 'WARN')  // 包含 [Vue warn]
    const winErrors = data.filter((d: any) => d.type === 'WINDOW_ERROR')  // 包含 ReferenceError

    // 输出报告
    console.log(`\n❌ Errors: ${errors.length}`)
    errors.forEach((e: any, i: number) => console.log(`  ${i + 1}. ${e.message}`))

    console.log(`\n⚠️  Warnings: ${warnings.length}`)
    warnings.forEach((w: any, i: number) => console.log(`  ${i + 1}. ${w.message}`))

    console.log(`\n💥 Window Errors: ${winErrors.length}`)
    winErrors.forEach((we: any, i: number) => 
      console.log(`  ${i + 1}. ${we.message} | ${we.details} | 来源: ${we.source}`))
  })
})
```

---

## 🎯 使用场景选择

| 场景 | 推荐模式 | 说明 |
|------|---------|------|
| **功能测试** | 生产模式 | 测试正常流程是否工作 |
| **Bug 调试** | 开发模式 | 捕获具体的控制台报错信息 |
| **回归测试** | 生产模式 | 验证修复后无新问题 |
| **性能测试** | 生产模式 | 接近真实用户环境 |

---

## 🔍 捕获控制台报错的方法对比

### 方法 1：Playwright 内置监听（仅限生产模式）

```typescript
// 在 beforeAll 中添加
page.on('console', (msg: any) => {
  if (msg.type() === 'warning' || msg.type() === 'error') {
    console.error(`[${msg.type()}] ${msg.text()}`)
  }
})

page.on('pageerror', (error: any) => {
  console.error(`[Page Error] ${error.message}`)
})
```

**优点**：简单易用  
**缺点**：无法捕获 Vue 运行时的详细堆栈信息

### 方法 2：页面内拦截（推荐用于开发模式）

```typescript
// 在页面 evaluate 中重写 console 方法
await page.evaluate(() => {
  ;(window as any).__CAPTURED_ERRORS__ = []
  const origError = console.error.bind(console)
  console.error = function(...args) {
    ;(window as any).__CAPTURED_ERRORS__.push({ /* ... */ })
    origError.apply(console, args)
  }
})
```

**优点**：可捕获完整错误信息和堆栈  
**缺点**：需要在页面加载后尽早注入

---

## 💡 调试技巧

### 1. 检查 window.api 是否存在

```typescript
const hasApi = await page.evaluate(() => typeof window.api !== 'undefined')
console.log('window.api exists:', hasApi)
// 如果 false → 检查 preload 路径和 contextIsolation 配置
```

### 2. 手动调试（开发模式）

```bash
npm run dev
# 在应用中右键点击 → "检查元素" 打开 DevTools
```

### 3. 截图辅助定位问题

```typescript
// 测试失败时自动截图
await page.screenshot({ path: 'debug-screenshot.png', fullPage: true })
```

---

## ❌ 常见问题排查

### Q1: `window.api` 是 undefined

**检查清单**：
1. ✅ 使用 `_electron.launch()` 启动（非浏览器访问）
2. ✅ preload 脚本路径正确：`join(__dirname, '../preload/index.js')`
3. ✅ `contextBridge.exposeInMainWorld('api', api)` 已执行
4. ✅ `contextIsolation: true` 配置正确

### Q2: 测试中超时

**可能原因及解决方案**：
| 原因 | 解决方案 |
|------|---------|
| SSH 连接慢 | 增加 `waitForTimeout()` 时间 |
| 元素未渲染 | 使用 `waitForSelector()` 替代直接查找 |
| 应用未启动完成 | 增加 beforeAll 中的等待时间 |

### Q3: 测试隔离问题

**解决方案**：
- 每个测试后清理状态（关闭弹窗、清空表单）
- 使用唯一的会话/分组名称
- 在 afterAll 中关闭应用

### Q4: 开发模式端口被占用

**错误信息**：`Port 5173 is in use, trying another one...`

**解决**：
```bash
# 先关闭占用端口的进程
netstat -ano | findstr :5173
taskkill /PID <PID号> /F

# 或者修改 ELECTRON_RENDERER_URL 为其他端口
ELECTRON_RENDERER_URL: 'http://localhost:5174'
```

---

## 📝 实际案例参考

| 文件路径 | 用途 |
|---------|------|
| `e2e/session-list/dev-mode-groupheader-capture-test.e2e.spec.ts` | 开发模式捕获 GroupHeader 右键菜单报错 |
| `e2e/debug/console-messages.e2e.spec.ts` | 生产模式捕获控制台消息 |
| `e2e/helpers/electron-app.ts` | startApp / closeApp 辅助函数 |

---

## 🚀 快速开始清单

编写新测试用例时，按以下步骤操作：

1. **确定测试模式**
   - 功能测试 → 生产模式模板
   - Bug 调试 → 开发模式模板

2. **复制对应模板**

3. **修改关键部分**
   - 测试描述 (`test.describe`)
   - 元素选择器 (`page.locator(...)`)
   - 操作类型 (click / dblclick / fill 等)

4. **运行测试**
   ```bash
   # 运行单个测试文件
   npx playwright test e2e/your-test.e2e.spec.ts --project=electron
   
   # 运行所有测试
   npx playwright test --project=electron
   ```

5. **分析结果**
   - 通过 → 功能正常
   - 失败 → 查看截图和错误信息
   - 有控制台报错 → 使用开发模式重新测试获取详细信息
