/**
 * 测试控制台报错捕获能力
 * 用于验证能否正确获取控制台的错误信息
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: Page

/** 控制台消息结构 */
interface ConsoleMessage {
  type: string
  text: string
  location?: {
    url?: string
    lineNumber?: number
    columnNumber?: number
  }
  stack?: string
}

/** 页面错误结构 */
interface PageError {
  message: string
  stack?: string
}

// 存储所有控制台消息
const consoleMessages: ConsoleMessage[] = []
const pageErrors: PageError[] = []

test.describe('控制台报错捕获测试', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
    
    // 清空之前的消息
    consoleMessages.length = 0
    pageErrors.length = 0
    
    // 监听所有控制台消息
    page.on('console', (msg) => {
      const message: ConsoleMessage = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        stack: msg.stack()
      }
      consoleMessages.push(message)
      console.log(`[Console ${msg.type()}] ${msg.text()}`)
    })

    // 监听页面错误
    page.on('pageerror', (error) => {
      const err: PageError = {
        message: error.message,
        stack: error.stack
      }
      pageErrors.push(err)
      console.error(`[Page Error] ${error.message}`)
    })
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('验证 errorDialogSessionId 错误已修复', async () => {
    console.log('=== 验证修复结果 ===')
    console.log('当前控制台消息数量:', consoleMessages.length)
    console.log('当前页面错误数量:', pageErrors.length)
    
    // 等待页面完全加载
    await page.waitForTimeout(1000)
    
    // 查找并点击拖拽手柄，触发渲染
    const resizeHandle = page.locator('.resize-handle')
    const handleBox = await resizeHandle.boundingBox()
    
    if (!handleBox) {
      throw new Error('Resize handle not found')
    }
    
    console.log('拖拽手柄位置:', handleBox)
    
    // 移动鼠标到拖拽手柄上方，触发 hover
    await page.mouse.move(handleBox.x + 4, handleBox.y + 50)
    await page.waitForTimeout(500)
    
    // 检查是否有报错
    console.log('=== 检查控制台消息 ===')
    console.log('控制台消息总数:', consoleMessages.length)
    console.log('页面错误总数:', pageErrors.length)
    
    // 查找包含 "errorDialogSessionId" 的错误
    const errorDialogErrors = consoleMessages.filter(msg => 
      msg.text.includes('errorDialogSessionId')
    )
    
    console.log('找到 errorDialogSessionId 相关错误数量:', errorDialogErrors.length)
    
    // 查找所有 warning 和 error
    const warnings = consoleMessages.filter(msg => 
      msg.type === 'warning' || msg.type === 'error'
    )
    
    if (warnings.length > 0) {
      console.log('=== 所有警告和错误 ===')
      warnings.forEach((msg, index) => {
        console.log(`${index + 1}. [${msg.type}] ${msg.text}`)
      })
    } else {
      console.log('✅ 没有发现任何警告或错误！')
    }
    
    // 输出所有页面错误
    if (pageErrors.length > 0) {
      console.log('=== 所有页面错误 ===')
      pageErrors.forEach((err, index) => {
        console.log(`${index + 1}. ${err.message}`)
        if (err.stack) {
          console.log('   Stack:', err.stack.split('\n').slice(0, 3).join('\n          '))
        }
      })
    } else {
      console.log('✅ 没有发现任何页面错误！')
    }
    
    // 验证是否修复成功（不应该再有 errorDialogSessionId 错误）
    const hasErrorDialogError = consoleMessages.some(msg => 
      msg.text.includes('errorDialogSessionId')
    ) || pageErrors.some(err => 
      err.message.includes('errorDialogSessionId')
    )
    
    console.log('=== 测试结果 ===')
    console.log('是否捕获到 errorDialogSessionId 错误:', hasErrorDialogError)
    
    // 期望没有错误（证明修复成功）
    expect(hasErrorDialogError).toBe(false)
    
    console.log('✅ 验证通过：errorDialogSessionId 错误已修复！')
  })

  test('测试拖拽时的控制台输出', async () => {
    const resizeHandle = page.locator('.resize-handle')
    const handleBox = await resizeHandle.boundingBox()
    
    if (!handleBox) {
      throw new Error('Resize handle not found')
    }
    
    console.log('=== 开始拖拽测试 ===')
    
    // 执行拖拽
    await page.mouse.move(handleBox.x + 4, handleBox.y + 50)
    await page.mouse.down()
    await page.mouse.move(handleBox.x - 50, handleBox.y + 50)
    await page.mouse.up()
    
    await page.waitForTimeout(500)
    
    // 检查拖拽过程中的控制台消息
    const resizeMessages = consoleMessages.filter(msg => 
      msg.text.toLowerCase().includes('resize') || 
      msg.text.toLowerCase().includes('width') ||
      msg.text.toLowerCase().includes('drag')
    )
    
    console.log('拖拽相关消息数量:', resizeMessages.length)
    if (resizeMessages.length > 0) {
      resizeMessages.forEach((msg, i) => {
        console.log(`${i + 1}. [${msg.type}] ${msg.text}`)
      })
    }
    
    // 验证拖拽功能正常
    const sessionList = page.locator('.session-list')
    const width = await sessionList.evaluate((el: HTMLElement) => el.offsetWidth)
    console.log('拖拽后侧边栏宽度:', width)
    
    expect(width).toBeGreaterThan(0)
    expect(width).toBeLessThanOrEqual(500)
  })
})
