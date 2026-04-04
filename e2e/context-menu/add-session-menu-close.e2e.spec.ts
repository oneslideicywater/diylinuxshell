/**
 * 右键菜单添加会话测试
 * 验证右击子分组选择添加会话后，菜单项是否正确关闭
 * 
 * 运行方式：npx playwright test add-session-menu-close.e2e.spec.ts --project=electron
 */

import { test, expect } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'
import { ElectronApplication, Page } from 'playwright'

let electronApp: ElectronApplication
let page: Page

test.describe('右键菜单添加会话', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('右击分组添加会话后菜单应关闭', async () => {
    // 1. 等待应用加载完成
    await page.waitForTimeout(3000)
    
    // 2. 通过 IPC 验证默认分组存在
    const groups = await page.evaluate(async () => {
      if (window.api && window.api.sessionGroup) {
        return await window.api.sessionGroup.getAll()
      }
      return []
    })
    
    expect(groups.length).toBeGreaterThan(0)
    const defaultGroup = groups.find(g => g.name === '默认分组')
    expect(defaultGroup).toBeDefined()
    
    // 3. 等待页面渲染分组
    await page.waitForSelector('.group-name:has-text("默认分组")', { timeout: 10000 })
    
    // 4. 右击分组头部
    const groupHeader = page.locator('.group-header').first()
    await groupHeader.click({ button: 'right' })
    
    // 5. 等待右键菜单出现
    const contextMenu = page.locator('.context-menu').first()
    await contextMenu.waitFor({ state: 'visible', timeout: 5000 })
    
    // 6. 点击"添加会话"菜单项
    const addSessionMenuItem = contextMenu.getByText('添加会话')
    await addSessionMenuItem.click()
    
    // 7. 等待编辑表单出现
    const sessionForm = page.locator('.session-form')
    await sessionForm.waitFor({ state: 'visible', timeout: 5000 })
    
    // 8. 验证右键菜单已关闭
    const isMenuVisible = await contextMenu.isVisible()
    expect(isMenuVisible).toBe(false)
    
    // 9. 关闭表单
    const cancelButton = sessionForm.getByText('取消')
    if (await cancelButton.isVisible()) {
      await cancelButton.click()
    }
  })
})
