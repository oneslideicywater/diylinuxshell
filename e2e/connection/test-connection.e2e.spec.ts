/**
 * 测试连接功能 E2E 测试
 * 测试会话表单中的测试连接按钮功能
 */

import { test, expect, beforeAll, afterAll } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'
import { testConfig, generateUniqueName } from '../config/test-config'
import type { ElectronApplication, Page } from '@playwright/test'

let app: ElectronApplication
let page: Page

/**
 * 测试连接功能测试
 */
test.describe('测试连接功能', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  // 每个测试前关闭可能存在的表单
  test.beforeEach(async () => {
    // 如果表单还打开着，点击取消按钮关闭
    const sessionForm = page.locator('.session-form-overlay')
    if (await sessionForm.isVisible().catch(() => false)) {
      const cancelBtn = page.locator('.session-form .btn.cancel')
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click()
        await page.waitForTimeout(300)
      }
    }
  })

  test('应该显示测试连接按钮', async () => {
    // 点击新建会话按钮
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await expect(addBtn).toBeVisible()
    await addBtn.click()
    await page.waitForTimeout(500)

    // 验证表单弹出
    const sessionForm = page.locator('.session-form-overlay')
    await expect(sessionForm).toBeVisible()

    // 验证测试连接按钮存在
    const testBtn = page.locator('.session-form .btn.test')
    await expect(testBtn).toBeVisible()
    await expect(testBtn).toContainText('测试连接')
  })

  test('必填字段为空时测试连接应该显示验证错误', async () => {
    // 点击新建会话按钮
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)

    // 直接点击测试连接（不填写任何字段）
    const testBtn = page.locator('.session-form .btn.test')
    await testBtn.click()
    await page.waitForTimeout(500)

    // 应该显示验证错误
    const testResult = page.locator('.session-form .test-result.error')
    await expect(testResult).toBeVisible()
    await expect(testResult).toContainText('请填写完整的主机地址、端口和用户名')
  })

  test('填写完整信息后测试连接应该成功', async () => {
    // 点击新建会话按钮
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)

    const sessionName = generateUniqueName('测试连接')
    
    // 填写会话信息
    const nameInput = page.locator('.session-form input[id="name"]')
    const hostInput = page.locator('.session-form input[id="host"]')
    const portInput = page.locator('.session-form input[id="port"]')
    const usernameInput = page.locator('.session-form input[id="username"]')
    const passwordInput = page.locator('.session-form input[id="password"]')

    await nameInput.fill(sessionName)
    await hostInput.fill(testConfig.ssh.host)
    await portInput.fill(String(testConfig.ssh.port))
    await usernameInput.fill(testConfig.ssh.username)
    await passwordInput.fill(testConfig.ssh.password)

    // 点击测试连接
    const testBtn = page.locator('.session-form .btn.test')
    await testBtn.click()

    // 等待连接测试完成（可能需要几秒）
    await page.waitForTimeout(5000)

    // 应该显示成功消息
    const testResult = page.locator('.session-form .test-result.success')
    await expect(testResult).toBeVisible()
    await expect(testResult).toContainText('成功连接')
  })

  test('密码为空时测试连接应该显示验证错误', async () => {
    // 点击新建会话按钮
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)

    // 只填写主机和用户名，不填密码
    const hostInput = page.locator('.session-form input[id="host"]')
    const usernameInput = page.locator('.session-form input[id="username"]')
    
    await hostInput.fill(testConfig.ssh.host)
    await usernameInput.fill(testConfig.ssh.username)

    // 点击测试连接
    const testBtn = page.locator('.session-form .btn.test')
    await testBtn.click()
    await page.waitForTimeout(500)

    // 应该显示验证错误
    const testResult = page.locator('.session-form .test-result.error')
    await expect(testResult).toBeVisible()
    await expect(testResult).toContainText('密码认证需要输入密码')
  })

  test('可以关闭测试结果提示', async () => {
    // 点击新建会话按钮
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)

    // 直接点击测试连接（不填写任何字段）
    const testBtn = page.locator('.session-form .btn.test')
    await testBtn.click()
    await page.waitForTimeout(500)

    // 验证错误提示存在
    const testResult = page.locator('.session-form .test-result.error')
    await expect(testResult).toBeVisible()

    // 点击关闭按钮
    const closeBtn = page.locator('.test-result .close-result')
    await closeBtn.click()
    await page.waitForTimeout(300)

    // 验证错误提示已消失
    await expect(testResult).not.toBeVisible()
  })

  test('测试连接按钮在连接过程中应该显示加载状态', async () => {
    // 点击新建会话按钮
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)

    // 填写完整信息
    const sessionName = generateUniqueName('测试加载状态')
    const nameInput = page.locator('.session-form input[id="name"]')
    const hostInput = page.locator('.session-form input[id="host"]')
    const portInput = page.locator('.session-form input[id="port"]')
    const usernameInput = page.locator('.session-form input[id="username"]')
    const passwordInput = page.locator('.session-form input[id="password"]')

    await nameInput.fill(sessionName)
    await hostInput.fill(testConfig.ssh.host)
    await portInput.fill(String(testConfig.ssh.port))
    await usernameInput.fill(testConfig.ssh.username)
    await passwordInput.fill(testConfig.ssh.password)

    // 点击测试连接
    const testBtn = page.locator('.session-form .btn.test')
    await testBtn.click()

    // 验证按钮显示加载状态（检查是否有 spinner 或"连接中..."文本）
    const loadingText = page.locator('.btn.test:has-text("连接中...")')
    const spinner = page.locator('.btn.test .spinner')
    
    // 要么显示"连接中..."文本，要么显示 spinner
    const loadingCount = await loadingText.count()
    const spinnerCount = await spinner.count()
    expect(loadingCount + spinnerCount).toBeGreaterThan(0)
  })
})
