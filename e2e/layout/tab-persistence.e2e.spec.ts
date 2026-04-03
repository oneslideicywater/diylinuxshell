/**
 * 标签页持久化 E2E 测试
 * 验证修复 BUG-008: 打开设置后返回主界面标签页内容消失
 */

import { test, expect, beforeAll, afterAll } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'
import { testConfig, generateUniqueName } from '../config/test-config'
import type { ElectronApplication, Page } from '@playwright/test'

let app: ElectronApplication
let page: Page

/**
 * 标签页持久化测试
 */
test.describe('标签页持久化', () => {
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
   * 测试用例：打开设置后返回主界面标签页保持
   * 验证修复 BUG-008: 打开设置后返回主界面标签页内容消失
   * 确保标签页在路由切换后仍然存在
   */
  test('打开设置后返回主界面标签页保持', async () => {
    console.log('===== 开始测试：打开设置后返回主界面标签页保持 =====')
    
    // 创建测试会话并连接
    const sessionName = generateUniqueName('持久化测试')
    console.log(`创建测试会话: ${sessionName}`)
    
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
    console.log('连接SSH会话')
    const sessionItem = page.locator('.session-item').filter({ hasText: sessionName })
    await sessionItem.dblclick()
    await page.waitForTimeout(2000)

    // 验证标签页已创建
    const tab = page.locator('.terminal-tab').filter({ hasText: sessionName })
    await expect(tab).toBeVisible()
    console.log('✓ 标签页已创建')

    // 验证终端可见
    const terminal = page.locator('.x-terminal')
    await expect(terminal).toBeVisible()
    console.log('✓ 终端已显示')

    // 输入一些命令
    await terminal.click()
    await page.waitForTimeout(300)
    await page.keyboard.type('echo "test before settings"')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
    console.log('✓ 已输入测试命令')

    // 截图：进入设置前
    await page.screenshot({ path: 'test-results/before-settings.png', fullPage: false })
    console.log('截图已保存: test-results/before-settings.png')

    // 进入设置页面
    console.log('进入设置页面')
    const settingsBtn = page.locator('.sidebar-section .settings-btn, .settings-btn').first()
    await settingsBtn.click()
    await page.waitForTimeout(500)

    // 验证设置页面显示
    const settingsContainer = page.locator('.settings-container')
    await expect(settingsContainer).toBeVisible()
    console.log('✓ 设置页面已显示')

    // 截图：设置页面
    await page.screenshot({ path: 'test-results/settings-page.png', fullPage: false })
    console.log('截图已保存: test-results/settings-page.png')

    // 返回主界面
    console.log('返回主界面')
    const backBtn = page.locator('.back-btn')
    await backBtn.click()
    await page.waitForTimeout(500)

    // 截图：返回主界面后
    await page.screenshot({ path: 'test-results/after-settings.png', fullPage: false })
    console.log('截图已保存: test-results/after-settings.png')

    // 验证标签页仍然存在
    const tabAfterSettings = page.locator('.terminal-tab').filter({ hasText: sessionName })
    await expect(tabAfterSettings).toBeVisible()
    console.log('✓ 标签页仍然存在')

    // 验证终端仍然可见
    const terminalAfterSettings = page.locator('.x-terminal')
    await expect(terminalAfterSettings).toBeVisible()
    console.log('✓ 终端仍然可见')

    // 验证终端内容仍然存在（输入历史）
    // 检查终端中是否包含之前输入的命令
    const terminalContent = await terminal.evaluate((el) => {
      // 获取终端中的所有文本内容
      const xterm = el.querySelector('.xterm')
      return xterm ? xterm.textContent : ''
    })
    console.log(`终端内容: ${terminalContent.substring(0, 100)}...`)
    
    // 验证终端内容包含之前输入的命令
    expect(terminalContent).toContain('test before settings')
    console.log('✓ 终端内容保持不变')

    console.log('===== 测试完成：标签页持久化验证通过 =====')
    console.log('请查看截图：')
    console.log('  - test-results/before-settings.png (进入设置前)')
    console.log('  - test-results/settings-page.png (设置页面)')
    console.log('  - test-results/after-settings.png (返回主界面后)')
  })

  /**
   * 测试用例：多次切换设置页面标签页保持
   * 验证多次路由切换后标签页仍然保持
   */
  test('多次切换设置页面标签页保持', async () => {
    console.log('===== 开始测试：多次切换设置页面标签页保持 =====')
    
    // 创建测试会话并连接
    const sessionName = generateUniqueName('多次切换测试')
    console.log(`创建测试会话: ${sessionName}`)
    
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

    // 验证标签页已创建
    const tab = page.locator('.terminal-tab').filter({ hasText: sessionName })
    await expect(tab).toBeVisible()
    console.log('✓ 标签页已创建')

    // 多次切换设置页面
    for (let i = 1; i <= 3; i++) {
      console.log(`第 ${i} 次切换`)
      
      // 进入设置页面
      const settingsBtn = page.locator('.sidebar-section .settings-btn, .settings-btn').first()
      await settingsBtn.click()
      await page.waitForTimeout(300)

      // 验证设置页面显示
      const settingsContainer = page.locator('.settings-container')
      await expect(settingsContainer).toBeVisible()

      // 返回主界面
      const backBtn = page.locator('.back-btn')
      await backBtn.click()
      await page.waitForTimeout(300)

      // 验证标签页仍然存在
      const tabAfterSwitch = page.locator('.terminal-tab').filter({ hasText: sessionName })
      await expect(tabAfterSwitch).toBeVisible()
      console.log(`✓ 第 ${i} 次切换后标签页仍然存在`)
    }

    console.log('===== 测试完成：多次切换验证通过 =====')
  })
})
