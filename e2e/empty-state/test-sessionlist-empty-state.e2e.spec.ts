/**
 * 测试SessionList中的空状态右键菜单
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: Page

test.describe('SessionList空状态右键菜单', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('右键点击SessionList空状态应显示新建分组菜单', async () => {
    console.log('=== 开始测试 ===')
    
    // 等待页面加载
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)
    
    // 精确定位SessionList中的空状态
    const sessionListEmptyState = page.locator('.session-list .empty-state')
    
    // 检查是否存在
    const count = await sessionListEmptyState.count()
    console.log('SessionList空状态元素数量:', count)
    
    if (count > 0) {
      // 获取第一个元素
      const emptyState = sessionListEmptyState.first()
      
      // 检查文本内容
      const text = await emptyState.textContent()
      console.log('空状态文本:', text)
      
      // 检查可见性
      const isVisible = await emptyState.isVisible()
      console.log('空状态是否可见:', isVisible)
      
      // 检查边界框
      const boundingBox = await emptyState.boundingBox()
      console.log('空状态边界框:', boundingBox)
      
      // 右键点击空状态
      console.log('右键点击空状态')
      await emptyState.click({ button: 'right' })
      
      // 等待一下
      await page.waitForTimeout(500)
      
      // 检查菜单是否出现
      const contextMenu = page.locator('.context-menu')
      const isMenuVisible = await contextMenu.isVisible().catch(() => false)
      console.log('右键菜单是否可见:', isMenuVisible)
      
      if (isMenuVisible) {
        // 检查菜单内容
        const menuItems = await contextMenu.locator('.menu-item').allTextContents()
        console.log('菜单项:', menuItems)
        
        // 检查是否包含"新建分组"
        const hasNewGroup = menuItems.some(item => item.includes('新建分组'))
        console.log('是否包含"新建分组":', hasNewGroup)
        
        // 截图
        await page.screenshot({ path: 'test-results/sessionlist-empty-context-menu.png' })
        
        expect(hasNewGroup).toBe(true)
      } else {
        console.log('❌ 右键菜单未出现！')
        
        // 检查页面上所有菜单元素
        const allMenus = await page.locator('[class*="menu"]').all()
        console.log('页面上所有菜单元素数量:', allMenus.length)
        
        // 截图
        await page.screenshot({ path: 'test-results/no-context-menu-found.png' })
        
        expect(isMenuVisible).toBe(true)
      }
    } else {
      console.log('❌ 未找到SessionList空状态元素')
      
      // 检查是否有会话
      const sessions = await page.locator('.session-item').count()
      console.log('会话数量:', sessions)
      
      // 如果有会话，尝试点击会话列表
      if (sessions > 0) {
        const sessionList = page.locator('.session-list')
        console.log('点击会话列表')
        await sessionList.click({ button: 'right' })
        
        await page.waitForTimeout(500)
        
        const contextMenu = page.locator('.context-menu')
        const isMenuVisible = await contextMenu.isVisible().catch(() => false)
        console.log('右键菜单是否可见:', isMenuVisible)
      }
      
      expect(count).toBeGreaterThan(0)
    }
    
    console.log('=== 测试结束 ===')
  })
})
