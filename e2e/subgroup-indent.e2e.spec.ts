/**
 * 子分组缩进测试
 * 测试嵌套分组的缩进是否正确，确保子分组不会超出侧边栏
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from './helpers/electron-app'
import { testConfig } from './config/test-config'

let electronApp: ElectronApplication
let page: Page

test.describe('子分组缩进测试', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('应该正确显示多层嵌套分组的缩进', async () => {
    // 1. 创建根分组
    await page.click('.add-session-group-btn')
    await page.waitForSelector('.group-form')
    await page.fill('#groupName', '根分组')
    await page.click('.icon-option:first-child')
    await page.click('.group-form .btn-primary')
    await page.waitForSelector('.group-form', { state: 'hidden' })

    // 2. 创建第 2 层子分组
    const rootGroupHeader = page.locator('.group-header:has-text("根分组")').first()
    await rootGroupHeader.hover()
    await rootGroupHeader.locator('.add-subgroup-btn').click()
    await page.waitForSelector('.group-form')
    await page.fill('#groupName', '子分组-2')
    await page.click('.icon-option:first-child')
    await page.click('.group-form .btn-primary')
    await page.waitForSelector('.group-form', { state: 'hidden' })

    // 3. 创建第 3 层子分组
    const subGroup2Header = page.locator('.group-header:has-text("子分组 -2")').first()
    await subGroup2Header.hover()
    await subGroup2Header.locator('.add-subgroup-btn').click()
    await page.waitForSelector('.group-form')
    await page.fill('#groupName', '子分组 -3')
    await page.click('.icon-option:first-child')
    await page.click('.group-form .btn-primary')
    await page.waitForSelector('.group-form', { state: 'hidden' })

    // 4. 创建第 4 层子分组
    const subGroup3Header = page.locator('.group-header:has-text("子分组 -3")').first()
    await subGroup3Header.hover()
    await subGroup3Header.locator('.add-subgroup-btn').click()
    await page.waitForSelector('.group-form')
    await page.fill('#groupName', '子分组 -4')
    await page.click('.icon-option:first-child')
    await page.click('.group-form .btn-primary')
    await page.waitForSelector('.group-form', { state: 'hidden' })

    // 5. 创建第 5 层子分组（最大层级）
    const subGroup4Header = page.locator('.group-header:has-text("子分组 -4")').first()
    await subGroup4Header.hover()
    await subGroup4Header.locator('.add-subgroup-btn').click()
    await page.waitForSelector('.group-form')
    await page.fill('#groupName', '子分组 -5')
    await page.click('.icon-option:first-child')
    await page.click('.group-form .btn-primary')
    await page.waitForSelector('.group-form', { state: 'hidden' })

    // 6. 验证所有分组都可见
    const groupHeaders = page.locator('.group-header')
    await expect(groupHeaders).toHaveCount(5)

    // 7. 检查每个分组的缩进值
    const depths = [1, 2, 3, 4, 5]
    const expectedPadding = [0, 8, 16, 24, 32] // 每层 8px 缩进

    for (let i = 0; i < depths.length; i++) {
      const groupHeader = page.locator('.group-header').nth(i)
      const paddingLeft = await groupHeader.evaluate((el) => {
        return parseInt(window.getComputedStyle(el).paddingLeft)
      })
      
      console.log(`分组 ${i + 1} (层级${depths[i]}) 的 paddingLeft: ${paddingLeft}px`)
      
      // 验证缩进是否正确（允许 2px 误差）
      expect(paddingLeft).toBeLessThanOrEqual(expectedPadding[i] + 2)
    }

    // 8. 检查第 5 层分组是否在可视区域内
    const deepestGroup = page.locator('.group-header:has-text("子分组 -5")').first()
    await expect(deepestGroup).toBeVisible()
    
    // 获取分组位置和侧边栏宽度
    const sidebarWidth = await page.locator('.session-list').evaluate((el) => el.offsetWidth)
    const deepestGroupRect = await deepestGroup.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width
      }
    })

    console.log(`侧边栏宽度：${sidebarWidth}px`)
    console.log(`第 5 层分组位置：left=${deepestGroupRect.left}px, right=${deepestGroupRect.right}px`)
    
    // 确保第 5 层分组的右边缘没有超出侧边栏
    expect(deepestGroupRect.right).toBeLessThanOrEqual(sidebarWidth)
  })

  test('子分组不应该超出侧边栏边界', async () => {
    // 找到最深的分组
    const deepestGroup = page.locator('.group-header:has-text("子分组 -5")').first()
    await expect(deepestGroup).toBeVisible()

    // 获取侧边栏容器
    const sidebar = page.locator('.session-list')
    const sidebarRect = await sidebar.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width
      }
    })

    // 获取最深分组的边界
    const deepestGroupRect = await deepestGroup.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      return {
        left: rect.left,
        right: rect.right
      }
    })

    console.log('侧边栏边界:', sidebarRect)
    console.log('最深分组边界:', deepestGroupRect)

    // 验证最深分组没有超出侧边栏右边界
    expect(deepestGroupRect.right).toBeLessThanOrEqual(sidebarRect.right)
    
    // 验证最深分组仍然有足够的宽度显示内容
    const groupName = deepestGroup.locator('.group-name')
    const groupNameRect = await groupName.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      return {
        width: rect.width
      }
    })
    
    console.log(`分组名称宽度：${groupNameRect.width}px`)
    // 分组名称至少应该有 50px 的显示空间
    expect(groupNameRect.width).toBeGreaterThan(50)
  })
})
