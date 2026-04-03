/**
 * 连接错误处理测试
 * 测试连接失败后的错误对话框和重试功能
 */

import { test, expect, describe, beforeAll, afterAll } from '@playwright/test'
import { ElectronApplication, Page } from 'playwright'
import { startApp, closeApp, waitForAppReady } from './helpers/app'
import { generateUniqueName } from './helpers/utils'

// 测试配置
const testConfig = {
  ssh: {
    host: '192.168.10.24',
    port: 22,
    username: 'root',
    password: 'One.00000',
    wrongPassword: 'wrong_password'
  }
}

let app: ElectronApplication
let page: Page

/**
 * 连接错误处理测试
 */
describe('连接错误处理', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  /**
   * 测试1：连接失败时显示错误对话框
   */
  test('连接失败时显示错误对话框', async () => {
    console.log('===== 开始测试：连接失败时显示错误对话框 =====')

    // 创建测试会话（使用错误密码）
    const sessionName = generateUniqueName('错误密码测试')

    // 点击新建按钮
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)

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
    await passwordInput.fill(testConfig.ssh.wrongPassword)

    // 保存会话
    const saveBtn = page.locator('.session-form button:has-text("保存")')
    await saveBtn.click()
    await page.waitForTimeout(500)

    // 双击会话项尝试连接
    const sessionItem = page.locator('.session-item').first()
    await sessionItem.dblclick()
    await page.waitForTimeout(2000) // 等待连接尝试

    // 验证错误对话框显示
    const errorDialog = page.locator('.error-dialog')
    await expect(errorDialog).toBeVisible()
    console.log('✓ 错误对话框已显示')

    // 验证错误信息
    const errorTitle = errorDialog.locator('.error-title')
    await expect(errorTitle).toContainText('连接失败')
    console.log('✓ 错误标题正确')

    // 验证按钮
    await expect(errorDialog.locator('button:has-text("关闭")')).toBeVisible()
    await expect(errorDialog.locator('button:has-text("重新输入密码")')).toBeVisible()
    await expect(errorDialog.locator('button:has-text("编辑会话")')).toBeVisible()
    console.log('✓ 所有按钮可见')

    // 关闭错误对话框
    await errorDialog.locator('button:has-text("关闭")').click()
    await page.waitForTimeout(300)

    console.log('===== 测试完成：错误对话框显示正常 =====')
  })

  /**
   * 测试2：点击"重新输入密码"打开编辑表单
   */
  test('点击重新输入密码打开编辑表单', async () => {
    console.log('===== 开始测试：点击重新输入密码打开编辑表单 =====')

    // 找到之前创建的会话
    const sessionItem = page.locator('.session-item').first()
    await sessionItem.dblclick()
    await page.waitForTimeout(2000)

    // 等待错误对话框显示
    const errorDialog = page.locator('.error-dialog')
    await expect(errorDialog).toBeVisible()

    // 点击"重新输入密码"
    await errorDialog.locator('button:has-text("重新输入密码")').click()
    await page.waitForTimeout(500)

    // 验证编辑表单打开
    const sessionForm = page.locator('.session-form')
    await expect(sessionForm).toBeVisible()
    console.log('✓ 编辑表单已打开')

    // 验证表单标题
    const formTitle = sessionForm.locator('h3')
    await expect(formTitle).toContainText('编辑会话')
    console.log('✓ 表单标题正确')

    // 关闭表单
    await sessionForm.locator('.close-btn').click()
    await page.waitForTimeout(300)

    console.log('===== 测试完成：重新输入密码功能正常 =====')
  })

  /**
   * 测试3：点击"编辑会话"打开编辑表单
   */
  test('点击编辑会话打开编辑表单', async () => {
    console.log('===== 开始测试：点击编辑会话打开编辑表单 =====')

    // 找到之前创建的会话
    const sessionItem = page.locator('.session-item').first()
    await sessionItem.dblclick()
    await page.waitForTimeout(2000)

    // 等待错误对话框显示
    const errorDialog = page.locator('.error-dialog')
    await expect(errorDialog).toBeVisible()

    // 点击"编辑会话"
    await errorDialog.locator('button:has-text("编辑会话")').click()
    await page.waitForTimeout(500)

    // 验证编辑表单打开
    const sessionForm = page.locator('.session-form')
    await expect(sessionForm).toBeVisible()
    console.log('✓ 编辑表单已打开')

    // 关闭表单
    await sessionForm.locator('.close-btn').click()
    await page.waitForTimeout(300)

    console.log('===== 测试完成：编辑会话功能正常 =====')
  })

  /**
   * 测试4：修改密码后可以重新连接
   */
  test('修改密码后可以重新连接', async () => {
    console.log('===== 开始测试：修改密码后可以重新连接 =====')

    // 找到之前创建的会话
    const sessionItem = page.locator('.session-item').first()
    await sessionItem.dblclick()
    await page.waitForTimeout(2000)

    // 等待错误对话框显示
    const errorDialog = page.locator('.error-dialog')
    await expect(errorDialog).toBeVisible()

    // 点击"重新输入密码"
    await errorDialog.locator('button:has-text("重新输入密码")').click()
    await page.waitForTimeout(500)

    // 验证编辑表单打开
    const sessionForm = page.locator('.session-form')
    await expect(sessionForm).toBeVisible()

    // 输入正确的密码
    const passwordInput = sessionForm.locator('input[id="password"]')
    await passwordInput.fill(testConfig.ssh.password)

    // 保存会话
    const saveBtn = sessionForm.locator('button:has-text("保存")')
    await saveBtn.click()
    await page.waitForTimeout(500)

    // 双击会话项重新连接
    await sessionItem.dblclick()
    await page.waitForTimeout(2000)

    // 验证连接成功（标签页状态为 connected）
    const tab = page.locator('.terminal-tab').first()
    await expect(tab).toHaveClass(/.*active.*/)
    console.log('✓ 连接成功')

    // 验证错误对话框不再显示
    await expect(errorDialog).not.toBeVisible()
    console.log('✓ 错误对话框已关闭')

    console.log('===== 测试完成：修改密码后重新连接成功 =====')
  })

  /**
   * 测试5：标签页右键菜单重连失败显示错误对话框
   */
  test('标签页右键菜单重连失败显示错误对话框', async () => {
    console.log('===== 开始测试：标签页右键菜单重连失败显示错误对话框 =====')

    // 创建一个新的会话（使用错误密码）
    const sessionName = generateUniqueName('重连错误测试')

    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)

    const nameInput = page.locator('.session-form input[id="name"]')
    const hostInput = page.locator('.session-form input[id="host"]')
    const portInput = page.locator('.session-form input[id="port"]')
    const usernameInput = page.locator('.session-form input[id="username"]')
    const passwordInput = page.locator('.session-form input[id="password"]')

    await nameInput.fill(sessionName)
    await hostInput.fill(testConfig.ssh.host)
    await portInput.fill(String(testConfig.ssh.port))
    await usernameInput.fill(testConfig.ssh.username)
    await passwordInput.fill(testConfig.ssh.wrongPassword)

    const saveBtn = page.locator('.session-form button:has-text("保存")')
    await saveBtn.click()
    await page.waitForTimeout(500)

    // 双击会话项尝试连接
    const sessionItem = page.locator(`.session-item:has-text("${sessionName}")`)
    await sessionItem.dblclick()
    await page.waitForTimeout(2000)

    // 等待错误对话框显示
    const errorDialog = page.locator('.error-dialog')
    await expect(errorDialog).toBeVisible()

    // 关闭错误对话框
    await errorDialog.locator('button:has-text("关闭")').click()
    await page.waitForTimeout(300)

    // 右键点击标签页
    const tab = page.locator('.terminal-tab').last()
    await tab.click({ button: 'right' })
    await page.waitForTimeout(300)

    // 点击"重连会话"
    const contextMenu = tab.locator('.context-menu')
    await contextMenu.locator('text=重连会话').click()
    await page.waitForTimeout(2000)

    // 验证错误对话框显示
    await expect(errorDialog).toBeVisible()
    console.log('✓ 重连失败时错误对话框已显示')

    // 验证错误标题
    const errorTitle = errorDialog.locator('.error-title')
    await expect(errorTitle).toContainText('重连失败')
    console.log('✓ 错误标题正确')

    // 关闭错误对话框
    await errorDialog.locator('button:has-text("关闭")').click()
    await page.waitForTimeout(300)

    console.log('===== 测试完成：重连失败错误对话框显示正常 =====')
  })
})
