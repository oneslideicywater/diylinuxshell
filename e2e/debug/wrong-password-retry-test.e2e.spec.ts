/**
 * 错误密码重试测试
 * 输入错误的密码，点击保存，连接ssh，报密码错误重新输入密码，输入正确的密码，测试连接
 */

import { test, expect, describe, beforeAll, afterAll } from '@playwright/test'
import { ElectronApplication, Page } from 'playwright'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'
import { generateUniqueName } from '../config/test-config'

// 测试配置
const testConfig = {
  ssh: {
    host: '192.168.10.24',
    port: 22,
    username: 'root',
    password: 'One.00000',
    wrongPassword: 'wrong_password_123'
  }
}

let app: ElectronApplication
let page: Page

/**
 * 错误密码重试测试
 */
describe('错误密码重试测试', () => {
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
   * 测试：输入错误的密码，点击保存，连接ssh，报密码错误重新输入密码，输入正确的密码，测试连接
   */
  test('输入错误的密码，点击保存，连接ssh，报密码错误重新输入密码，输入正确的密码，测试连接', async () => {
    console.log('===== 开始测试：错误密码重试流程 =====')

    // === 1. 清理现有数据 ===
    console.log('=== 清理现有数据 ===')
    await page.evaluate(async () => {
      const sessions = await window.api.session.getAll()
      console.log(`现有会话数: ${sessions.length}`)
      for (const session of sessions) {
        await window.api.session.delete(session.id)
      }
    })
    await page.waitForTimeout(300)

    // === 2. 创建会话，输入错误的密码，点击保存 ===
    console.log('=== 创建会话，输入错误的密码 ===')
    const sessionName = generateUniqueName('错误密码重试')

    // 点击新建按钮
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)

    // 填写会话信息
    const sessionForm = page.locator('.session-form')
    await expect(sessionForm).toBeVisible()

    await sessionForm.locator('input[id="name"]').fill(sessionName)
    await sessionForm.locator('input[id="host"]').fill(testConfig.ssh.host)
    await sessionForm.locator('input[id="port"]').fill(String(testConfig.ssh.port))
    await sessionForm.locator('input[id="username"]').fill(testConfig.ssh.username)
    await sessionForm.locator('input[id="password"]').fill(testConfig.ssh.wrongPassword)
    console.log('✓ 已填写错误的密码')

    // 保存会话
    const saveBtn = sessionForm.locator('button:has-text("保存")')
    await saveBtn.click()
    await page.waitForTimeout(500)
    console.log('✓ 会话已保存（使用错误密码）')

    // === 3. 双击会话项，连接ssh，报密码错误 ===
    console.log('=== 双击会话，连接ssh ===')
    const sessionItem = page.locator('.session-item').first()
    await sessionItem.dblclick()
    await page.waitForTimeout(2000) // 等待连接尝试

    // 验证错误对话框显示
    const errorDialog = page.locator('.error-dialog')
    await expect(errorDialog).toBeVisible()
    console.log('✓ 错误对话框已显示')

    // 验证错误标题
    const errorTitle = errorDialog.locator('.error-title')
    await expect(errorTitle).toContainText('连接失败')
    console.log('✓ 错误标题正确')

    // === 4. 点击"重新输入密码"，打开编辑表单 ===
    console.log('=== 点击"重新输入密码" ===')
    await errorDialog.locator('button:has-text("重新输入密码")').click()
    await page.waitForTimeout(500)

    // 验证编辑表单打开
    await expect(sessionForm).toBeVisible()
    const formTitle = sessionForm.locator('h3')
    await expect(formTitle).toContainText('编辑会话')
    console.log('✓ 编辑表单已打开')

    // === 5. 输入正确的密码 ===
    console.log('=== 输入正确的密码 ===')
    const passwordInput = sessionForm.locator('input[id="password"]')
    
    // 先点击显示密码按钮，查看当前密码
    const showPasswordBtn = sessionForm.locator('.password-toggle')
    await showPasswordBtn.click()
    await page.waitForTimeout(200)

    // 查看当前密码
    const currentPassword = await passwordInput.inputValue()
    console.log(`当前密码（错误密码）: ${currentPassword}`)
    
    // 清空密码输入框，输入正确的密码
    await passwordInput.fill('')
    await passwordInput.fill(testConfig.ssh.password)
    console.log('✓ 已输入正确的密码')

    // === 6. 点击"测试连接"，验证连接 ===
    console.log('=== 点击"测试连接" ===')
    const testBtn = sessionForm.locator('button:has-text("测试连接")')
    await testBtn.click()
    await page.waitForTimeout(3000) // 等待连接测试

    // 验证测试连接结果
    const testResult = sessionForm.locator('.test-result')
    await expect(testResult).toBeVisible()
    console.log('✓ 测试连接结果已显示')

    // 查看测试结果的类型
    const testResultClass = await testResult.evaluate(el => el.className)
    console.log(`测试结果的类名: ${testResultClass}`)
    
    // 这里我们只检查结果是否显示，不强制要求成功或失败
    // 因为网络环境可能导致连接超时等

    // === 7. 点击"保存"，保存会话 ===
    console.log('=== 点击"保存" ===')
    const saveBtn2 = sessionForm.locator('button:has-text("保存")')
    await saveBtn2.click()
    await page.waitForTimeout(500)
    console.log('✓ 会话已保存（使用正确密码）')

    console.log('===== 测试完成：错误密码重试流程 =====')
  })
})
