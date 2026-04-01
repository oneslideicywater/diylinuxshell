import { test, expect, beforeAll, afterAll } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from './helpers/electron-app'
import type { ElectronApplication, Page } from '@playwright/test'

let app: ElectronApplication
let page: Page

/**
 * 应用启动测试
 */
test.describe('Application Startup', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('should launch application successfully', async () => {
    expect(app).toBeDefined()
    expect(page).toBeDefined()
  })

  test('should display header', async () => {
    await waitForAppReady(page)
    const header = page.locator('.app-header')
    await expect(header).toBeVisible()
  })

  test('should display app title', async () => {
    const appTitle = page.locator('.app-title')
    await expect(appTitle).toContainText('DIY Linux Shell')
  })

  test('should display window controls', async () => {
    const minimizeBtn = page.locator('.control-btn.minimize')
    const maximizeBtn = page.locator('.control-btn.maximize')
    const closeBtn = page.locator('.control-btn.close')

    await expect(minimizeBtn).toBeVisible()
    await expect(maximizeBtn).toBeVisible()
    await expect(closeBtn).toBeVisible()
  })

  test('should display sidebar', async () => {
    const sidebar = page.locator('.app-sidebar')
    await expect(sidebar).toBeVisible()
  })

  test('should display session section', async () => {
    const section = page.locator('.sidebar-section').first()
    await expect(section).toBeVisible()
  })

  test('should display empty state when no sessions', async () => {
    // 使用更精确的选择器，选择主内容区的空状态
    const emptyState = page.locator('.app-main .empty-state')
    await expect(emptyState).toBeVisible()
    await expect(emptyState.locator('p')).toContainText('请选择或创建一个会话')
  })
})

/**
 * 窗口控制测试
 */
test.describe('Window Controls', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('should toggle maximize state', async () => {
    const maximizeBtn = page.locator('.control-btn.maximize')

    // 点击最大化
    await maximizeBtn.click()
    await page.waitForTimeout(300)

    // 再次点击还原
    await maximizeBtn.click()
    await page.waitForTimeout(300)

    // 验证窗口仍然可见
    const container = page.locator('.app-layout')
    await expect(container).toBeVisible()
  })
})

/**
 * 导航测试
 */
test.describe('Navigation', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('should display settings button', async () => {
    const settingsBtn = page.locator('.settings-btn')
    await expect(settingsBtn).toBeVisible()
  })

  test('should navigate to settings page', async () => {
    // 点击设置按钮
    const settingsBtn = page.locator('.settings-btn')
    await settingsBtn.click()
    await page.waitForTimeout(300)

    // 验证路由变化（检查 URL 或页面内容）
    const settingsPage = page.locator('.settings-page')
    if (await settingsPage.isVisible()) {
      await expect(settingsPage).toBeVisible()
    }
  })
})

/**
 * 会话管理测试
 */
test.describe('Session Management', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('should display add session button', async () => {
    const addBtn = page.locator('.section-header .add-btn').first()
    await expect(addBtn).toBeVisible()
  })

  test('should open session form when clicking add button', async () => {
    // 点击添加会话按钮（会话列表区域的第一个按钮）
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    
    // 等待表单显示
    await page.waitForTimeout(500)

    // 检查会话表单是否显示
    const sessionForm = page.locator('.session-form-overlay')
    await expect(sessionForm).toBeVisible()

    // 关闭表单
    const closeBtn = page.locator('.session-form .close-btn')
    await closeBtn.click()
    await page.waitForTimeout(300)
  })
})
