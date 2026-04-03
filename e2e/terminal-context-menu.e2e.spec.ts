/**
 * 终端右键菜单 E2E 测试
 * 测试终端的右键菜单功能，包括复制和粘贴操作
 */

import { test, expect, beforeAll, afterAll } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from './helpers/electron-app'
import { testConfig, generateUniqueName } from './config/test-config'
import type { ElectronApplication, Page } from '@playwright/test'

let app: ElectronApplication
let page: Page

/**
 * 终端右键菜单测试
 */
test.describe('终端右键菜单', () => {
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
   * 创建测试会话并连接
   */
  const createTestSession = async (): Promise<string> => {
    const sessionName = generateUniqueName('右键菜单测试')
    
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
    await passwordInput.fill(testConfig.ssh.password)

    // 保存会话
    const saveBtn = page.locator('.session-form .btn.submit')
    await saveBtn.click()
    await page.waitForTimeout(1000)

    // 连接会话
    const sessionItem = page.locator('.session-item').filter({ hasText: sessionName })
    await sessionItem.dblclick()
    await page.waitForTimeout(2000)

    return sessionName
  }

  test('右键点击终端显示上下文菜单', async () => {
    await createTestSession()

    // 等待终端加载
    await page.waitForTimeout(1000)

    // 右键点击终端
    const terminal = page.locator('.x-terminal')
    await terminal.click({ button: 'right' })
    await page.waitForTimeout(500)

    // 验证右键菜单显示
    const contextMenu = page.locator('.context-menu')
    await expect(contextMenu).toBeVisible()
  })

  test('右键菜单包含复制和粘贴选项', async () => {
    // 右键点击终端
    const terminal = page.locator('.x-terminal')
    await terminal.click({ button: 'right' })
    await page.waitForTimeout(500)

    // 验证复制选项
    const copyItem = page.locator('.context-menu-item').filter({ hasText: '复制' })
    await expect(copyItem).toBeVisible()

    // 验证粘贴选项
    const pasteItem = page.locator('.context-menu-item').filter({ hasText: '粘贴' })
    await expect(pasteItem).toBeVisible()
  })

  test('点击菜单外部关闭菜单', async () => {
    // 右键点击终端
    const terminal = page.locator('.x-terminal')
    await terminal.click({ button: 'right' })
    await page.waitForTimeout(500)

    // 验证菜单显示
    const contextMenu = page.locator('.context-menu')
    await expect(contextMenu).toBeVisible()

    // 点击菜单外部
    await page.mouse.click(10, 10)
    await page.waitForTimeout(300)

    // 验证菜单已关闭
    await expect(contextMenu).not.toBeVisible()
  })

  test('复制功能测试', async () => {
    // 先执行一个命令，生成一些输出
    const terminal = page.locator('.x-terminal')
    await terminal.click()
    await page.waitForTimeout(300)

    // 输入 echo 命令
    await page.keyboard.type('echo "test copy text"')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1000)

    // 选中文本（模拟鼠标拖动选择）
    const terminalBounds = await terminal.boundingBox()
    if (terminalBounds) {
      // 从左到右拖动选择文本
      await page.mouse.move(terminalBounds.x + 50, terminalBounds.y + 50)
      await page.mouse.down()
      await page.mouse.move(terminalBounds.x + 200, terminalBounds.y + 50)
      await page.mouse.up()
    }

    // 右键点击
    await terminal.click({ button: 'right' })
    await page.waitForTimeout(500)

    // 点击复制
    const copyItem = page.locator('.context-menu-item').filter({ hasText: '复制' })
    await copyItem.click()
    await page.waitForTimeout(500)

    // 验证菜单已关闭
    const contextMenu = page.locator('.context-menu')
    await expect(contextMenu).not.toBeVisible()
  })

  test('粘贴功能测试', async () => {
    // 先设置剪贴板内容
    await page.evaluate(() => {
      navigator.clipboard.writeText('pasted text from test')
    })

    // 右键点击终端
    const terminal = page.locator('.x-terminal')
    await terminal.click({ button: 'right' })
    await page.waitForTimeout(500)

    // 点击粘贴
    const pasteItem = page.locator('.context-menu-item').filter({ hasText: '粘贴' })
    await pasteItem.click()
    await page.waitForTimeout(500)

    // 验证菜单已关闭
    const contextMenu = page.locator('.context-menu')
    await expect(contextMenu).not.toBeVisible()
  })

  test('菜单项有正确的样式', async () => {
    // 右键点击终端
    const terminal = page.locator('.x-terminal')
    await terminal.click({ button: 'right' })
    await page.waitForTimeout(500)

    // 验证菜单项样式
    const copyItem = page.locator('.context-menu-item').filter({ hasText: '复制' })
    
    // 验证菜单项可见且可点击
    await expect(copyItem).toBeVisible()
    await expect(copyItem).toBeEnabled()

    // 验证菜单图标存在
    const menuIcon = copyItem.locator('.menu-icon')
    await expect(menuIcon).toBeVisible()
  })
})

/**
 * 会话右键菜单测试
 */
test.describe('会话右键菜单', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('右键点击会话项显示菜单', async () => {
    console.log('===== 开始测试：右键点击会话项显示菜单 =====')
    
    // 创建测试会话
    const sessionName = generateUniqueName('会话菜单测试')
    
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
    await passwordInput.fill(testConfig.ssh.password)

    // 保存会话
    const saveBtn = page.locator('.session-form button:has-text("保存")')
    await saveBtn.click()
    await page.waitForTimeout(500)
    
    // 右键点击会话项
    const sessionItem = page.locator('.session-item').first()
    await sessionItem.click({ button: 'right' })
    await page.waitForTimeout(300)
    
    // 验证菜单显示
    const menu = sessionItem.locator('.context-menu')
    await expect(menu).toBeVisible()
    console.log('✓ 会话菜单已显示')
    
    // 验证菜单项
    await expect(menu.locator('text=连接')).toBeVisible()
    await expect(menu.locator('text=编辑')).toBeVisible()
    await expect(menu.locator('text=复制会话')).toBeVisible()
    await expect(menu.locator('text=删除')).toBeVisible()
    await expect(menu.locator('text=属性')).toBeVisible()
    console.log('✓ 所有菜单项可见')
    
    // 点击菜单外部关闭菜单
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    
    console.log('===== 测试完成：会话菜单显示正常 =====')
  })

  test('菜单互斥：打开会话菜单时其他菜单自动关闭', async () => {
    console.log('===== 开始测试：会话菜单与其他菜单互斥 =====')
    
    // 创建测试会话并连接
    const sessionName = generateUniqueName('菜单互斥测试')
    
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
    await passwordInput.fill(testConfig.ssh.password)

    // 保存会话
    const saveBtn = page.locator('.session-form button:has-text("保存")')
    await saveBtn.click()
    await page.waitForTimeout(500)
    
    // 双击连接会话
    const sessionItem = page.locator('.session-item').first()
    await sessionItem.dblclick()
    await page.waitForTimeout(2000)
    
    // 右键点击标签页，打开标签页菜单
    const tab = page.locator('.terminal-tab').first()
    await tab.click({ button: 'right' })
    await page.waitForTimeout(300)
    
    // 验证标签页菜单显示
    const tabMenu = tab.locator('.context-menu')
    await expect(tabMenu).toBeVisible()
    console.log('✓ 标签页菜单已显示')
    
    // 右键点击会话项，打开会话菜单
    await sessionItem.click({ button: 'right' })
    await page.waitForTimeout(300)
    
    // 验证标签页菜单已关闭
    await expect(tabMenu).not.toBeVisible()
    console.log('✓ 标签页菜单已关闭')
    
    // 验证会话菜单显示
    const sessionMenu = sessionItem.locator('.context-menu')
    await expect(sessionMenu).toBeVisible()
    console.log('✓ 会话菜单已显示')
    
    console.log('===== 测试完成：菜单互斥行为正常 =====')
  })
})
