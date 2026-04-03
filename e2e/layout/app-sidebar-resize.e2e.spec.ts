/**
 * 侧边栏拖拽调整功能 E2E 测试
 * 测试应用布局中侧边栏的拖拽调整功能
 */

import { test, expect } from '@playwright/test'
import { startApp, closeApp } from '../helpers/electron-app'

let app: any
let page: any

test.describe('应用侧边栏拖拽调整功能', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    
    // 等待应用加载
    await page.waitForTimeout(3000)
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('应该显示拖拽调整手柄', async () => {
    // 查找拖拽手柄
    const resizeHandle = page.locator('.sidebar-resize-handle')
    const isVisible = await resizeHandle.isVisible()
    
    expect(isVisible).toBe(true)
    
    // 检查样式
    const handleStyles = await resizeHandle.evaluate((el: any) => {
      const styles = window.getComputedStyle(el)
      return {
        cursor: styles.cursor,
        width: styles.width,
        height: styles.height
      }
    })
    
    expect(handleStyles.cursor).toBe('ew-resize')
    expect(parseInt(handleStyles.width)).toBeGreaterThan(0)
  })

  test('应该能够拖拽调整侧边栏宽度', async () => {
    // 获取侧边栏
    const sidebar = page.locator('.app-sidebar')
    
    // 获取初始宽度
    const initialWidth = await sidebar.evaluate((el: any) => {
      return el.offsetWidth
    })
    console.log('初始宽度:', initialWidth)
    
    // 获取拖拽手柄的位置
    const resizeHandle = page.locator('.sidebar-resize-handle')
    const handleBox = await resizeHandle.boundingBox()
    
    if (!handleBox) {
      throw new Error('拖拽手柄不可见')
    }
    
    // 执行拖拽操作（向右拖动，增加宽度）
    const startX = handleBox.x + 4
    const targetX = startX + 50  // 向右拖动 50px
    const y = handleBox.y + 50
    
    // 分步拖动
    await page.mouse.move(startX, y)
    await page.waitForTimeout(300)
    await page.mouse.down({ button: 'left' })
    await page.waitForTimeout(300)
    
    // 慢慢拖动
    for (let i = 0; i <= 10; i++) {
      const currentX = startX + (i * 5)
      await page.mouse.move(currentX, y)
      await page.waitForTimeout(100)
    }
    
    await page.mouse.up({ button: 'left' })
    await page.waitForTimeout(500)
    
    // 检查最终宽度
    const finalWidth = await sidebar.evaluate((el: any) => {
      return el.offsetWidth
    })
    console.log('最终宽度:', finalWidth)
    
    // 验证宽度增加
    expect(finalWidth).toBeGreaterThan(initialWidth)
  })

  test('应该限制最小宽度为 200px', async () => {
    const sidebar = page.locator('.app-sidebar')
    const resizeHandle = page.locator('.sidebar-resize-handle')
    
    // 获取当前宽度
    let currentWidth = await sidebar.evaluate((el: any) => el.offsetWidth)
    console.log('当前宽度:', currentWidth)
    
    // 获取拖拽手柄位置
    const handleBox = await resizeHandle.boundingBox()
    if (!handleBox) {
      throw new Error('拖拽手柄不可见')
    }
    
    // 向左拖动 100px（试图小于最小值）
    const startX = handleBox.x + 4
    const targetX = startX - 100
    const y = handleBox.y + 50
    
    await page.mouse.move(startX, y)
    await page.waitForTimeout(300)
    await page.mouse.down({ button: 'left' })
    await page.waitForTimeout(300)
    
    // 分步拖动
    for (let i = 0; i <= 10; i++) {
      const currentX = startX - (i * 10)
      await page.mouse.move(currentX, y)
      await page.waitForTimeout(100)
    }
    
    await page.mouse.up({ button: 'left' })
    await page.waitForTimeout(500)
    
    // 检查宽度（应该不小于 200px）
    const finalWidth = await sidebar.evaluate((el: any) => el.offsetWidth)
    console.log('最终宽度:', finalWidth)
    
    expect(finalWidth).toBeGreaterThanOrEqual(200)
  })

  test('应该限制最大宽度为 500px', async () => {
    const sidebar = page.locator('.app-sidebar')
    const resizeHandle = page.locator('.sidebar-resize-handle')
    
    // 获取当前宽度
    let currentWidth = await sidebar.evaluate((el: any) => el.offsetWidth)
    console.log('当前宽度:', currentWidth)
    
    // 获取拖拽手柄位置
    const handleBox = await resizeHandle.boundingBox()
    if (!handleBox) {
      throw new Error('拖拽手柄不可见')
    }
    
    // 向右拖动 100px（试图超过最大值）
    const startX = handleBox.x + 4
    const targetX = startX + 100
    const y = handleBox.y + 50
    
    await page.mouse.move(startX, y)
    await page.waitForTimeout(300)
    await page.mouse.down({ button: 'left' })
    await page.waitForTimeout(300)
    
    // 分步拖动
    for (let i = 0; i <= 10; i++) {
      const currentX = startX + (i * 10)
      await page.mouse.move(currentX, y)
      await page.waitForTimeout(100)
    }
    
    await page.mouse.up({ button: 'left' })
    await page.waitForTimeout(500)
    
    // 检查宽度（应该不大于 500px）
    const finalWidth = await sidebar.evaluate((el: any) => el.offsetWidth)
    console.log('最终宽度:', finalWidth)
    
    expect(finalWidth).toBeLessThanOrEqual(500)
  })

  test('应该显示拖拽时的视觉反馈', async () => {
    const resizeHandle = page.locator('.sidebar-resize-handle')
    
    // 获取初始样式
    const initialStyles = await resizeHandle.evaluate((el: any) => {
      return window.getComputedStyle(el).backgroundColor
    })
    
    // 按下鼠标
    await resizeHandle.dispatchEvent('mousedown', { button: 0 })
    await page.waitForTimeout(300)
    
    // 检查 resizing 状态
    const hasResizingClass = await resizeHandle.evaluate((el: any) => {
      return el.classList.contains('resizing')
    })
    
    expect(hasResizingClass).toBe(true)
    
    // 释放鼠标
    await page.mouse.up({ button: 'left' })
    await page.waitForTimeout(300)
  })

  test('应该记住侧边栏宽度', async () => {
    const sidebar = page.locator('.app-sidebar')
    const resizeHandle = page.locator('.sidebar-resize-handle')
    
    // 获取当前宽度
    const initialWidth = await sidebar.evaluate((el: any) => el.offsetWidth)
    console.log('初始宽度:', initialWidth)
    
    // 调整宽度
    const handleBox = await resizeHandle.boundingBox()
    if (!handleBox) {
      throw new Error('拖拽手柄不可见')
    }
    
    const startX = handleBox.x + 4
    const targetX = startX + 30
    const y = handleBox.y + 50
    
    await page.mouse.move(startX, y)
    await page.waitForTimeout(300)
    await page.mouse.down({ button: 'left' })
    await page.waitForTimeout(300)
    
    for (let i = 0; i <= 6; i++) {
      const currentX = startX + (i * 5)
      await page.mouse.move(currentX, y)
      await page.waitForTimeout(100)
    }
    
    await page.mouse.up({ button: 'left' })
    await page.waitForTimeout(500)
    
    // 获取调整后的宽度
    const adjustedWidth = await sidebar.evaluate((el: any) => el.offsetWidth)
    console.log('调整后的宽度:', adjustedWidth)
    
    // 检查 localStorage 中是否保存了宽度
    const storedWidth = await page.evaluate(() => {
      const stored = localStorage.getItem('app-sidebar-width')
      return stored ? parseInt(stored, 10) : null
    })
    console.log('localStorage 中保存的宽度:', storedWidth)
    
    // 验证宽度已保存
    expect(storedWidth).toBe(adjustedWidth)
  })
})
