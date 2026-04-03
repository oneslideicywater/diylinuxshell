/**
 * 清理测试数据
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from './helpers/electron-app'

let electronApp: ElectronApplication
let page: Page

test.describe('清理测试数据', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('清理所有会话和分组', async () => {
    console.log('=== 开始清理 ===')
    
    // 等待会话列表加载
    await page.waitForSelector('.session-list', { timeout: 10000 })
    
    // 使用 JavaScript 清理数据
    await page.evaluate(async () => {
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
      
      return { sessionsDeleted: sessions.length, groupsDeleted: groups.length }
    })
    
    // 刷新页面
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    
    // 检查结果
    const sessions = await page.locator('.session-item').count()
    const groups = await page.locator('.group-header').count()
    
    console.log('清理后会话数量:', sessions)
    console.log('清理后分组数量:', groups)
    
    // 截图
    await page.screenshot({ path: 'test-results/after-cleanup.png' })
    
    console.log('=== 清理完成 ===')
    
    expect(sessions).toBe(0)
    expect(groups).toBe(0)
  })
})
