/**
 * 检查所有 context-menu 元素
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from './helpers/electron-app'

let electronApp: ElectronApplication
let page: Page

test.describe('检查所有 context-menu 元素', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('检查所有 context-menu 元素的状态', async () => {
    console.log('=== 创建测试会话 ===')
    
    // 清理并创建会话
    await page.evaluate(async () => {
      const sessions = await window.api.session.getAll()
      for (const session of sessions) {
        await window.api.session.delete(session.id)
      }
      
      await window.api.session.create({
        name: 'Test Session',
        host: '192.168.10.24',
        port: 22,
        username: 'root',
        password: 'One.00000'
      })
    })
    
    // 刷新页面
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)
    
    console.log('=== 右键点击占位 div ===')
    
    // 右键点击占位 div
    const spacer = page.locator('.session-list-spacer').first()
    await spacer.click({ button: 'right' })
    
    await page.waitForTimeout(500)
    
    console.log('=== 检查所有 context-menu 元素 ===')
    
    // 获取所有 context-menu 元素
    const allMenus = await page.locator('.context-menu').all()
    console.log('context-menu 元素总数:', allMenus.length)
    
    for (let i = 0; i < allMenus.length; i++) {
      const menu = allMenus[i]
      const isVisible = await menu.isVisible().catch(() => false)
      const className = await menu.getAttribute('class').catch(() => '')
      const style = await menu.evaluate((el) => {
        const computed = window.getComputedStyle(el)
        return {
          display: computed.display,
          visibility: computed.visibility,
          opacity: computed.opacity,
          left: computed.left,
          top: computed.top,
          zIndex: computed.zIndex,
          offsetWidth: el.offsetWidth,
          offsetHeight: el.offsetHeight
        }
      }).catch(() => null)
      
      console.log(`菜单 ${i}:`, {
        isVisible,
        className,
        style
      })
    }
    
    // 检查是否有包含"新建分组"文本的菜单
    const newGroupMenus = await page.locator('.context-menu .menu-item:has-text("新建分组")').all()
    console.log('包含"新建分组"的菜单项数量:', newGroupMenus.length)
    
    for (let i = 0; i < newGroupMenus.length; i++) {
      const item = newGroupMenus[i]
      const parentMenu = await item.locator('xpath=..').evaluate((el) => el.className)
      const isVisible = await item.isVisible().catch(() => false)
      console.log(`新建分组菜单项 ${i}:`, { parentMenu, isVisible })
    }
    
    // 截图
    await page.screenshot({ path: 'test-results/check-all-menus.png', fullPage: true })
    
    console.log('=== 测试完成 ===')
  })
})
