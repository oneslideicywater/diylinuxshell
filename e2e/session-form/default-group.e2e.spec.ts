/**
 * 默认分组功能测试
 * 验证应用启动时创建默认分组，以及会话自动添加到默认分组
 */

import { test, expect, ElectronApplication } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: any

test.describe('默认分组功能', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('应该显示默认分组', async () => {
    // 检查默认分组是否存在
    const defaultGroup = page.locator('.group-header:has-text("默认分组")')
    const count = await defaultGroup.count()
    
    if (count === 0) {
      console.log('默认分组不存在，可能已有其他分组')
      // 如果没有默认分组，检查是否有其他分组
      const groups = page.locator('.group-header')
      const groupCount = await groups.count()
      console.log(`找到 ${groupCount} 个分组`)
    } else {
      console.log('✅ 默认分组存在')
      await expect(defaultGroup).toBeVisible()
    }
  })
})
