/**
 * 测试会话组容器空白处右键菜单
 * 场景：在有会话的情况下，点击会话组的空白区域
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: Page

test.describe('会话组容器空白处右键菜单', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('在会话组容器空白处右击应显示新建分组菜单', async () => {
    console.log('=== 步骤 1: 清理所有数据 ===')
    
    // 清理所有数据
    await page.evaluate(async () => {
      const sessions = await window.api.session.getAll()
      for (const session of sessions) {
        await window.api.session.delete(session.id)
      }
      const groups = await window.api.sessionGroup.getAll()
      for (const group of groups) {
        await window.api.sessionGroup.delete(group.id)
      }
    })
    
    // 刷新页面
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)
    
    console.log('=== 步骤 2: 创建测试会话 ===')
    
    // 直接通过 API 创建会话
    const createResult = await page.evaluate(async () => {
      try {
        const session = await window.api.session.create({
          name: 'Test Session',
          host: '192.168.10.24',
          port: 22,
          username: 'root',
          password: 'One.00000'
        })
        return { success: true, session }
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error)
        }
      }
    })
    
    console.log('创建结果:', createResult)
    
    // 刷新页面以显示新会话
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)
    
    console.log('=== 步骤 3: 检查页面结构 ===')
    
    // 检查会话数量
    const sessions = await page.locator('.session-item').count()
    console.log('会话数量:', sessions)
    
    // 检查空状态是否存在
    const emptyState = page.locator('.session-list .empty-state')
    const isEmptyVisible = await emptyState.isVisible().catch(() => false)
    console.log('空状态是否可见:', isEmptyVisible)
    
    // 检查会话组容器
    const sessionGroups = page.locator('.session-groups')
    const isGroupsVisible = await sessionGroups.isVisible().catch(() => false)
    console.log('会话组容器是否可见:', isGroupsVisible)
    
    // 获取会话组容器的 HTML
    const groupsHTML = await sessionGroups.evaluate((el) => {
      return el.innerHTML.substring(0, 500)
    })
    console.log('会话组容器 HTML 片段:', groupsHTML)
    
    // 检查是否有会话项
    if (sessions > 0) {
      console.log('=== 步骤 4: 在会话下方空白处右键点击 ===')
      
      // 获取第一个会话的位置
      const firstSession = page.locator('.session-item').first()
      const sessionBox = await firstSession.boundingBox()
      console.log('第一个会话位置:', sessionBox)
      
      if (sessionBox) {
        // 点击会话下方的空白区域
        const clickX = sessionBox.x + sessionBox.width / 2
        const clickY = sessionBox.y + sessionBox.height + 20
        
        console.log(`点击位置：(${clickX}, ${clickY})`)
        
        // 使用 page.mouse 进行右键点击
        await page.mouse.move(clickX, clickY)
        await page.mouse.click(clickX, clickY, { button: 'right' })
      } else {
        // 如果无法获取会话位置，直接点击会话组容器
        console.log('点击会话组容器')
        await sessionGroups.click({ button: 'right', position: { x: 50, y: 100 } })
      }
      
      await page.waitForTimeout(500)
      
      console.log('=== 步骤 5: 检查右键菜单 ===')
      
      // 检查菜单是否出现
      const contextMenu = page.locator('.context-menu')
      const isMenuVisible = await contextMenu.isVisible().catch(() => false)
      console.log('右键菜单是否可见:', isMenuVisible)
      
      if (isMenuVisible) {
        // 获取菜单内容
        const menuItems = await contextMenu.locator('.menu-item').allTextContents()
        console.log('菜单项:', menuItems)
        
        // 验证包含"新建分组"
        const hasNewGroup = menuItems.some(item => item.includes('新建分组'))
        console.log('是否包含"新建分组":', hasNewGroup)
        
        // 截图
        await page.screenshot({ path: 'test-results/session-below-context-menu.png' })
        
        expect(hasNewGroup).toBe(true)
      } else {
        console.log('❌ 右键菜单未出现！')
        
        // 检查是否有其他菜单元素
        const allMenus = await page.locator('[class*="context-menu"]').all()
        console.log('页面上所有 context-menu 元素数量:', allMenus.length)
        
        // 检查会话组容器的事件绑定
        const hasContextMenu = await sessionGroups.evaluate((el) => {
          const eventListeners = el.getAttribute('contextmenu')
          return eventListeners !== null
        })
        console.log('会话组容器是否有 contextmenu 属性:', hasContextMenu)
        
        // 截图
        await page.screenshot({ path: 'test-results/session-below-no-menu.png' })
        
        expect(isMenuVisible).toBe(true)
      }
    } else {
      console.log('❌ 会话创建失败，当前没有会话')
      
      // 截图
      await page.screenshot({ path: 'test-results/no-sessions-created.png' })
      
      expect(sessions).toBeGreaterThan(0)
    }
    
    console.log('=== 测试完成 ===')
  })
})
