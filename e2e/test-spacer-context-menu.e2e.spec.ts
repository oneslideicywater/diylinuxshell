/**
 * 测试点击占位 div 的右键菜单
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from './helpers/electron-app'

let electronApp: ElectronApplication
let page: Page

test.describe('点击占位 div 右键菜单', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('右键点击 session-list-spacer 应显示新建分组菜单', async () => {
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
    
    console.log('=== 定位占位 div ===')
    
    // 定位占位 div
    const spacer = page.locator('.session-list-spacer').first()
    const spacerVisible = await spacer.isVisible()
    console.log('占位 div 是否可见:', spacerVisible)
    
    const spacerBox = await spacer.boundingBox()
    console.log('占位 div 边界:', spacerBox)
    
    if (spacerBox) {
      console.log('=== 右键点击占位 div 中心 ===')
      
      // 点击占位 div 中心
      const clickX = spacerBox.x + spacerBox.width / 2
      const clickY = spacerBox.y + spacerBox.height / 2
      
      console.log(`点击位置：(${clickX}, ${clickY})`)
      
      await spacer.click({ button: 'right' })
      
      await page.waitForTimeout(500)
      
      console.log('=== 检查右键菜单 ===')
      
      // 检查菜单是否出现
      const contextMenu = page.locator('.context-menu')
      const isMenuVisible = await contextMenu.isVisible().catch(() => false)
      console.log('右键菜单是否可见:', isMenuVisible)
      
      if (isMenuVisible) {
        const menuItems = await contextMenu.locator('.menu-item').allTextContents()
        console.log('菜单项:', menuItems)
        
        const hasNewGroup = menuItems.some(item => item.includes('新建分组'))
        console.log('是否包含"新建分组":', hasNewGroup)
        
        await page.screenshot({ path: 'test-results/spacer-context-menu-success.png' })
        
        expect(hasNewGroup).toBe(true)
      } else {
        console.log('❌ 右键菜单未出现！')
        
        // 检查页面上所有菜单元素
        const allMenus = await page.locator('[class*="context-menu"]').all()
        console.log('页面上所有 context-menu 元素数量:', allMenus.length)
        
        // 检查占位 div 的事件绑定
        const hasContextMenu = await spacer.evaluate((el) => {
          return el.hasAttribute('contextmenu')
        })
        console.log('占位 div 是否有 contextmenu 属性:', hasContextMenu)
        
        await page.screenshot({ path: 'test-results/spacer-context-menu-failed.png' })
        
        expect(isMenuVisible).toBe(true)
      }
    } else {
      console.log('❌ 占位 div 边界获取失败')
      expect(spacerBox).not.toBeNull()
    }
    
    console.log('=== 测试完成 ===')
  })
})
