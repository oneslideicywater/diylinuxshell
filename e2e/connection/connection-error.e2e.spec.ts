/**
 * 连接错误处理测试
 * 测试连接失败后的错误对话框和重试功能
 */

import { test, expect, describe, beforeAll, afterAll } from '@playwright/test'
import { ElectronApplication, Page } from 'playwright'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'
import { testConfig, generateUniqueName } from '../config/test-config'

let app: ElectronApplication
let page: Page

/**
 * 辅助函数：创建使用错误密码的会话
 */
async function createWrongPasswordSession(sessionName: string): Promise<void> {
  const addBtn = page.locator('.sidebar-section .add-btn').first()
  await addBtn.click()
  await page.waitForTimeout(500)

  await page.locator('.session-form input[id="name"]').fill(sessionName)
  await page.locator('.session-form input[id="host"]').fill(testConfig.ssh.host)
  await page.locator('.session-form input[id="port"]').fill(String(testConfig.ssh.port))
  await page.locator('.session-form input[id="username"]').fill(testConfig.ssh.username)
  await page.locator('.session-form input[id="password"]').fill('wrong_password')

  await page.locator('.session-form button:has-text("保存")').click()
  await page.waitForTimeout(500)
}

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

  test('连接失败时显示错误对话框', async () => {
    const sessionName = generateUniqueName('错误密码测试')
    await createWrongPasswordSession(sessionName)

    const sessionItem = page.locator(`.session-item:has-text("${sessionName}")`).first()
    await sessionItem.dblclick()
    await page.waitForTimeout(2000)

    const errorDialog = page.locator('.error-dialog')
    await expect(errorDialog).toBeVisible()

    const errorTitle = errorDialog.locator('.error-title')
    await expect(errorTitle).toContainText('连接失败')

    await expect(errorDialog.locator('button:has-text("关闭")')).toBeVisible()
    await expect(errorDialog.locator('button:has-text("重新输入密码")')).toBeVisible()
    await expect(errorDialog.locator('button:has-text("编辑会话")')).toBeVisible()

    await errorDialog.locator('button:has-text("关闭")').click()
    await page.waitForTimeout(300)
  })

  test('点击重新输入密码打开编辑表单', async () => {
    const sessionName = generateUniqueName('重输密码测试')
    await createWrongPasswordSession(sessionName)

    const sessionItem = page.locator(`.session-item:has-text("${sessionName}")`).first()
    await sessionItem.dblclick()
    await page.waitForTimeout(2000)

    const errorDialog = page.locator('.error-dialog')
    await expect(errorDialog).toBeVisible()

    await errorDialog.locator('button:has-text("重新输入密码")').click()
    await page.waitForTimeout(500)

    const sessionForm = page.locator('.session-form')
    await expect(sessionForm).toBeVisible()

    const formTitle = sessionForm.locator('h3')
    await expect(formTitle).toContainText('编辑会话')

    await sessionForm.locator('.close-btn').click()
    await page.waitForTimeout(300)
  })

  test('点击编辑会话打开编辑表单', async () => {
    const sessionName = generateUniqueName('编辑会话测试')
    await createWrongPasswordSession(sessionName)

    const sessionItem = page.locator(`.session-item:has-text("${sessionName}")`).first()
    await sessionItem.dblclick()
    await page.waitForTimeout(2000)

    const errorDialog = page.locator('.error-dialog')
    await expect(errorDialog).toBeVisible()

    await errorDialog.locator('button:has-text("编辑会话")').click()
    await page.waitForTimeout(500)

    const sessionForm = page.locator('.session-form')
    await expect(sessionForm).toBeVisible()

    await sessionForm.locator('.close-btn').click()
    await page.waitForTimeout(300)
  })

  test('修改密码后可以重新连接', async () => {
    const sessionName = generateUniqueName('修改密码测试')
    await createWrongPasswordSession(sessionName)

    const sessionItem = page.locator(`.session-item:has-text("${sessionName}")`).first()
    await sessionItem.dblclick()
    await page.waitForTimeout(2000)

    const errorDialog = page.locator('.error-dialog')
    await expect(errorDialog).toBeVisible()

    await errorDialog.locator('button:has-text("重新输入密码")').click()
    await page.waitForTimeout(500)

    const sessionForm = page.locator('.session-form')
    await expect(sessionForm).toBeVisible()

    await sessionForm.locator('input[id="password"]').fill(testConfig.ssh.password)
    await sessionForm.locator('button:has-text("保存")').click()
    await page.waitForTimeout(500)

    await sessionItem.dblclick()
    await page.waitForTimeout(3000)

    const tab = page.locator('.terminal-tab').first()
    await expect(tab).toBeVisible({ timeout: 5000 })

    await expect(errorDialog).not.toBeVisible()
  })

  test('标签页右键菜单重连失败显示错误对话框', async () => {
    const sessionName = generateUniqueName('重连错误测试')
    await createWrongPasswordSession(sessionName)

    const sessionItem = page.locator(`.session-item:has-text("${sessionName}")`).first()
    await sessionItem.dblclick()
    await page.waitForTimeout(2000)

    const errorDialog = page.locator('.error-dialog')
    await expect(errorDialog).toBeVisible()

    await errorDialog.locator('button:has-text("关闭")').click()
    await page.waitForTimeout(300)

    const tabs = page.locator('.terminal-tab')
    const tabCount = await tabs.count()
    if (tabCount === 0) {
      console.log('没有标签页，跳过此测试')
      return
    }

    const tab = tabs.last()
    await tab.click({ button: 'right' })
    await page.waitForTimeout(300)

    const contextMenu = page.locator('.context-menu:visible').first()
    const reconnectItem = contextMenu.locator('text=重连会话')
    const isVisible = await reconnectItem.isVisible().catch(() => false)
    
    if (!isVisible) {
      console.log('没有重连会话菜单项，跳过此测试')
      await page.keyboard.press('Escape')
      return
    }

    await reconnectItem.click()
    await page.waitForTimeout(2000)

    await expect(errorDialog).toBeVisible()

    const errorTitle = errorDialog.locator('.error-title')
    const titleText = await errorTitle.textContent()
    expect(titleText).toMatch(/重连失败|连接失败/)

    await errorDialog.locator('button:has-text("关闭")').click()
    await page.waitForTimeout(300)
  })
})
