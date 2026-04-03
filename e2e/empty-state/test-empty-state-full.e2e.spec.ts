/**
 * 完整的空状态右键菜单测试
 * 模拟用户的实际操作步骤
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: Page

test.describe('空状态右键菜单完整测试', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('清理所有数据后，右键点击空状态应显示新建分组菜单', async () => {
    console.log('=== 步骤1: 清理所有会话和分组 ===')
    
    // 等待页面加载
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)
    
    // 使用 JavaScript 清理所有数据
    const cleanupResult = await page.evaluate(async () => {
      try {
        // 清理会话
        const sessions = await window.api.session.getAll()
        for (const session of sessions) {
          await window.api.session.delete(session.id)
        }
        
        // 清理分组
        const groups = await window.api.sessionGroup.getAll()
        for (const group of groups) {
          await window.api.sessionGroup.delete(group.id)
        }
        
        return { 
          success: true, 
          sessionsDeleted: sessions.length, 
          groupsDeleted: groups.length 
        }
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error)
        }
      }
    })
    
    console.log('清理结果:', cleanupResult)
    expect(cleanupResult.success).toBe(true)
    
    // 刷新页面以更新UI
    console.log('=== 步骤2: 刷新页面 ===')
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)
    
    // 验证数据已清理
    console.log('=== 步骤3: 验证数据已清理 ===')
    const sessions = await page.locator('.session-item').count()
    const groups = await page.locator('.group-header').count()
    console.log('会话数量:', sessions)
    console.log('分组数量:', groups)
    expect(sessions).toBe(0)
    expect(groups).toBe(0)
    
    // 检查空状态是否显示
    console.log('=== 步骤4: 检查空状态 ===')
    const emptyState = page.locator('.session-list .empty-state')
    const isEmptyVisible = await emptyState.isVisible()
    console.log('空状态是否可见:', isEmptyVisible)
    expect(isEmptyVisible).toBe(true)
    
    // 获取空状态的文本和位置
    const emptyText = await emptyState.textContent()
    const emptyBox = await emptyState.boundingBox()
    console.log('空状态文本:', emptyText)
    console.log('空状态位置:', emptyBox)
    
    // 右键点击空状态
    console.log('=== 步骤5: 右键点击空状态 ===')
    await emptyState.click({ button: 'right' })
    await page.waitForTimeout(500)
    
    // 检查菜单是否出现
    console.log('=== 步骤6: 检查右键菜单 ===')
    const contextMenu = page.locator('.context-menu')
    const isMenuVisible = await contextMenu.isVisible().catch(() => false)
    console.log('右键菜单是否可见:', isMenuVisible)
    
    if (isMenuVisible) {
      // 获取菜单内容
      const menuHTML = await contextMenu.evaluate((el) => el.outerHTML)
      console.log('菜单HTML:', menuHTML.substring(0, 200))
      
      // 检查菜单项
      const menuItems = await contextMenu.locator('.menu-item').allTextContents()
      console.log('菜单项:', menuItems)
      
      // 验证包含"新建分组"
      const hasNewGroup = menuItems.some(item => item.includes('新建分组'))
      console.log('是否包含"新建分组":', hasNewGroup)
      
      // 截图
      await page.screenshot({ path: 'test-results/empty-state-menu-success.png' })
      
      expect(hasNewGroup).toBe(true)
    } else {
      // 检查是否有其他菜单元素
      const allMenus = await page.locator('[class*="context-menu"]').all()
      console.log('页面上所有context-menu元素数量:', allMenus.length)
      
      // 检查空状态的事件绑定
      const hasContextMenu = await emptyState.evaluate((el) => {
        return el.hasAttribute('contextmenu') || el.oncontextmenu !== null
      })
      console.log('空状态是否有contextmenu事件:', hasContextMenu)
      
      // 截图
      await page.screenshot({ path: 'test-results/empty-state-menu-failed.png' })
      
      expect(isMenuVisible).toBe(true)
    }
    
    console.log('=== 测试完成 ===')
  })
})
