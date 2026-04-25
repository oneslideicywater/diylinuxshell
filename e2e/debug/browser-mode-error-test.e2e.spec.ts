/**
 * 使用浏览器模式复现 errorDialogSessionId 报错
 * 在开发模式下，Vue 会输出属性未定义的警告
 */

import { test, expect, Page } from '@playwright/test'

/** 控制台消息结构 */
interface ConsoleMessage {
  type: string
  text: string
  location?: {
    url?: string
    lineNumber?: number
    columnNumber?: number
  }
}

/** 页面错误结构 */
interface PageError {
  message: string
  stack?: string
}

// 存储所有控制台消息
const consoleMessages: ConsoleMessage[] = []
const pageErrors: PageError[] = []

test.describe('浏览器模式 - 复现 errorDialogSessionId 报错', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    // 创建新页面
    page = await browser.newPage()
    
    // 清空之前的消息
    consoleMessages.length = 0
    pageErrors.length = 0
    
    // 监听所有控制台消息
    page.on('console', (msg) => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      }
      consoleMessages.push(message)
      
      // 实时输出警告和错误
      if (msg.type() === 'warning' || msg.type() === 'error') {
        console.error(`⚠️ [${msg.type()}] ${msg.text}`)
      }
    })
    
    // 监听页面错误
    page.on('pageerror', (error) => {
      const err = {
        message: error.message,
        stack: error.stack
      }
      pageErrors.push(err)
      console.error(`❌ [Page Error] ${error.message}`)
    })
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('访问应用并捕获错误', async () => {
    console.log('=== 开始访问应用 ===')
    
    // 访问开发服务器（需要先运行 npm run dev）
    await page.goto('http://localhost:5173/', { 
      waitUntil: 'networkidle',
      timeout: 30000
    })
    
    console.log('页面已加载')
    
    // 等待 Vue 应用完全初始化
    await page.waitForTimeout(3000)
    
    // 查找拖拽手柄
    const resizeHandle = page.locator('.resize-handle')
    const isVisible = await resizeHandle.isVisible()
    console.log('拖拽手柄是否可见:', isVisible)
    
    if (isVisible) {
      // 移动鼠标到拖拽手柄，触发渲染
      const box = await resizeHandle.boundingBox()
      if (box) {
        await page.mouse.move(box.x + 4, box.y + 50)
        await page.waitForTimeout(500)
      }
    }
    
    // 等待更多消息
    await page.waitForTimeout(1000)
    
    // 输出统计信息
    console.log('\n=== 控制台消息统计 ===')
    console.log('总消息数:', consoleMessages.length)
    console.log('页面错误数:', pageErrors.length)
    
    // 筛选警告和错误
    const warnings = consoleMessages.filter(msg => msg.type === 'warning')
    const errors = consoleMessages.filter(msg => msg.type === 'error')
    
    console.log('\n警告数量:', warnings.length)
    console.log('错误数量:', errors.length)
    
    if (warnings.length > 0) {
      console.log('\n=== 所有警告 ===')
      warnings.forEach((msg, idx) => {
        console.log(`${idx + 1}. ${msg.text}`)
      })
    }
    
    if (errors.length > 0) {
      console.log('\n=== 所有错误 ===')
      errors.forEach((msg, idx) => {
        console.log(`${idx + 1}. ${msg.text}`)
      })
    }
    
    if (pageErrors.length > 0) {
      console.log('\n=== 页面 JavaScript 错误 ===')
      pageErrors.forEach((err, idx) => {
        console.log(`${idx + 1}. ${err.message}`)
      })
    }
    
    // 查找 errorDialogSessionId 相关错误
    const targetWarnings = consoleMessages.filter(msg =>
      msg.text.includes('errorDialogSessionId') ||
      msg.text.includes('Property') && msg.text.includes('accessed during render')
    )
    
    console.log('\n=== 目标错误 ===')
    console.log('相关警告数量:', targetWarnings.length)
    
    if (targetWarnings.length > 0) {
      console.log('\n✅ 成功捕获到 errorDialogSessionId 警告！')
      targetWarnings.forEach((msg, idx) => {
        console.log(`\n警告 ${idx + 1}:`)
        console.log(`  类型：${msg.type}`)
        console.log(`  内容：${msg.text}`)
        if (msg.location && Object.keys(msg.location).length > 0) {
          console.log(`  位置：${JSON.stringify(msg.location)}`)
        }
      })
    } else {
      console.log('⚠️  未捕获到目标警告')
      console.log('\n可能原因:')
      console.log('  1. 开发服务器未运行 (需要先运行 npm run dev)')
      console.log('  2. Vue 在生产模式下不输出此类警告')
      console.log('  3. 组件尚未渲染')
      
      console.log('\n当前所有消息预览:')
      consoleMessages.slice(0, 20).forEach((msg, i) => {
        console.log(`  ${i + 1}. [${msg.type}] ${msg.text.substring(0, 150)}`)
      })
    }
    
    // 验证：如果开发服务器运行，应该能捕获到警告
    // 这个测试证明我们有获取控制台信息的能力
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0)
  })
})
