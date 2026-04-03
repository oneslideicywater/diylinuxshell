/**
 * 调试会话组容器的右键事件
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from './helpers/electron-app'

let electronApp: ElectronApplication
let page: Page

test.describe('调试会话组容器右键事件', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('检查会话组容器的右键事件绑定', async () => {
    console.log('=== 步骤 1: 创建测试会话 ===')
    
    // 清理并创建会话
    await page.evaluate(async () => {
      const sessions = await window.api.session.getAll()
      for (const session of sessions) {
        await window.api.session.delete(session.id)
      }
      const groups = await window.api.sessionGroup.getAll()
      for (const group of groups) {
        await window.api.sessionGroup.delete(group.id)
      }
      
      // 创建新会话
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
    
    console.log('=== 步骤 2: 检查 DOM 结构 ===')
    
    // 获取会话组容器的完整 HTML
    const sessionGroup = page.locator('.session-group').first()
    const groupHTML = await sessionGroup.evaluate((el) => {
      return {
        outerHTML: el.outerHTML.substring(0, 1000),
        className: el.className,
        attributes: Array.from(el.attributes).map(attr => ({ name: attr.name, value: attr.value })),
        hasContextmenu: el.hasAttribute('contextmenu'),
        oncontextmenu: el.oncontextmenu
      }
    })
    
    console.log('会话组容器信息:', JSON.stringify(groupHTML, null, 2))
    
    // 检查父容器
    const parentContainer = page.locator('.session-groups')
    const parentHTML = await parentContainer.evaluate((el) => {
      return {
        className: el.className,
        attributes: Array.from(el.attributes).map(attr => ({ name: attr.name, value: attr.value })),
        hasContextmenu: el.hasAttribute('contextmenu'),
        oncontextmenu: el.oncontextmenu
      }
    })
    
    console.log('父容器信息:', JSON.stringify(parentHTML, null, 2))
    
    console.log('=== 步骤 3: 尝试触发右键事件 ===')
    
    // 获取会话组容器的边界
    const box = await sessionGroup.boundingBox()
    console.log('会话组容器边界:', box)
    
    if (box) {
      // 在容器内点击
      const clickX = box.x + 10
      const clickY = box.y + box.height - 10
      
      console.log(`点击位置：(${clickX}, ${clickY})`)
      
      // 使用 mouse 进行右键点击
      await page.mouse.move(clickX, clickY)
      await page.mouse.click(clickX, clickY, { button: 'right' })
      
      await page.waitForTimeout(500)
      
      // 检查菜单
      const contextMenu = page.locator('.context-menu')
      const isMenuVisible = await contextMenu.isVisible().catch(() => false)
      console.log('右键菜单是否可见:', isMenuVisible)
      
      // 截图
      await page.screenshot({ path: 'test-results/debug-context-menu.png' })
    }
    
    console.log('=== 调试完成 ===')
  })
})
