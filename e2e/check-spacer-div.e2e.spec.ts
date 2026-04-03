/**
 * 检查占位 div 是否渲染
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from './helpers/electron-app'

let electronApp: ElectronApplication
let page: Page

test.describe('检查占位 div', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('检查 session-list-spacer 是否存在', async () => {
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
    
    console.log('=== 检查 DOM 结构 ===')
    
    // 检查占位 div
    const spacer = page.locator('.session-list-spacer')
    const spacerCount = await spacer.count()
    console.log('占位 div 数量:', spacerCount)
    
    if (spacerCount > 0) {
      const spacerVisible = await spacer.first().isVisible()
      console.log('占位 div 是否可见:', spacerVisible)
      
      const spacerBox = await spacer.first().boundingBox()
      console.log('占位 div 边界:', spacerBox)
      
      const spacerHTML = await spacer.first().evaluate((el) => {
        const styles = window.getComputedStyle(el)
        return {
          className: el.className,
          display: styles.display,
          height: styles.height,
          width: styles.width,
          flex: styles.flex,
          minHeight: styles.minHeight,
          offsetHeight: el.offsetHeight,
          offsetWidth: el.offsetWidth
        }
      })
      console.log('占位 div 样式:', spacerHTML)
    }
    
    // 检查 session-groups 容器
    const sessionGroups = page.locator('.session-groups')
    const groupsHTML = await sessionGroups.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      return {
        className: el.className,
        display: styles.display,
        flexDirection: styles.flexDirection,
        flex: styles.flex,
        height: styles.height,
        offsetHeight: el.offsetHeight,
        children: Array.from(el.children).map(child => ({
          className: child.className,
          tagName: child.tagName
        }))
      }
    })
    console.log('session-groups 容器样式:', groupsHTML)
    
    console.log('=== 测试完成 ===')
  })
})
