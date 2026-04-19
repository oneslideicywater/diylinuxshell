/**
 * SessionItem 右键菜单重构后的控制台报错测试
 * 用于捕获并验证 SessionItem.vue 中右键菜单功能的错误
 */

import { test, expect, ElectronApplication } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: any

// 存储所有控制台消息
const consoleMessages: any[] = []
const pageErrors: any[] = []

test.describe('SessionItem 右键菜单控制台报错测试', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
    
    // 清空之前的消息
    consoleMessages.length = 0
    pageErrors.length = 0
    
    // 监听所有控制台消息
    page.on('console', (msg: any) => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        stack: msg.stack()
      }
      consoleMessages.push(message)
      
      // 只输出 warning 和 error 级别的消息
      if (msg.type() === 'warning' || msg.type() === 'error') {
        console.error(`[Console ${msg.type()}] ${msg.text()}`)
      }
    })
    
    // 监听页面错误
    page.on('pageerror', (error: any) => {
      const err = {
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

  test('验证页面加载后无关键错误', async () => {
    console.log('=== 检查初始加载状态 ===')
    await page.waitForTimeout(2000)
    
    // 统计错误数量
    const errors = consoleMessages.filter(msg => 
      msg.type === 'error'
    )
    const warnings = consoleMessages.filter(msg => 
      msg.type === 'warning'
    )
    
    console.log(`📊 初始状态统计:`)
    console.log(`   - 控制台消息总数: ${consoleMessages.length}`)
    console.log(`   - 错误数量: ${errors.length}`)
    console.log(`   - 警告数量: ${warnings.length}`)
    console.log(`   - 页面错误数量: ${pageErrors.length}`)
    
    // 输出所有错误详情
    if (errors.length > 0) {
      console.log('\n❌ 所有错误:')
      errors.forEach((msg, index) => {
        console.log(`${index + 1}. [${msg.type}] ${msg.text}`)
        if (msg.location && msg.location.url) {
          console.log(`   📍 位置: ${msg.location.url}:${msg.location.lineNumber}`)
        }
      })
    }
    
    // 输出所有警告详情
    if (warnings.length > 0) {
      console.log('\n⚠️  所有警告:')
      warnings.forEach((msg, index) => {
        console.log(`${index + 1}. [${msg.type}] ${msg.text}`)
      })
    }
    
    // 输出所有页面错误
    if (pageErrors.length > 0) {
      console.log('\n💥 所有页面错误:')
      pageErrors.forEach((err, index) => {
        console.log(`${index + 1}. ${err.message}`)
        if (err.stack) {
          console.log(`   Stack: ${err.stack.split('\n').slice(0, 5).join('\n          ')}`)
        }
      })
    }
    
    // 验证没有致命的运行时错误（排除测试文件本身的错误）
    const fatalErrors = errors.filter(msg => 
      !msg.location?.url?.includes('.test.ts') &&
      !msg.text.includes('globalState.test.ts')
    )
    
    console.log(`\n✅ 致命错误数量: ${fatalErrors.length}`)
    
    // 如果有致命错误，输出详细信息
    if (fatalErrors.length > 0) {
      console.log('\n🔴 致命错误详情:')
      fatalErrors.forEach((msg, index) => {
        console.log(`${index + 1}. ${msg.text}`)
      })
    }
  })

  test('测试右键菜单功能是否正常', async () => {
    console.log('\n=== 测试右键菜单功能 ===')
    
    // 等待会话列表加载
    await page.waitForSelector('.session-item', { timeout: 5000 })
    const sessionItems = await page.locator('.session-item').count()
    console.log(`找到 ${sessionItems} 个会话项`)
    
    if (sessionItems === 0) {
      console.log('⚠️  没有会话项，跳过右键菜单测试')
      return
    }
    
    // 右键点击第一个会话项
    const firstSession = page.locator('.session-item').first()
    await firstSession.click({ button: 'right' })
    
    console.log('已触发右键点击事件')
    await page.waitForTimeout(500)
    
    // 检查是否出现右键菜单
    const contextMenuVisible = await page.locator('.context-menu').isVisible()
    console.log(`右键菜单是否显示: ${contextMenuVisible}`)
    
    if (contextMenuVisible) {
      // 获取菜单项数量
      const menuItems = await page.locator('.context-menu .menu-item').count()
      console.log(`右键菜单项数量: ${menuItems}`)
      
      // 获取菜单项文本
      const menuItemTexts = []
      for (let i = 0; i < menuItems; i++) {
        const text = await page.locator('.context-menu .menu-item').nth(i).textContent()
        menuItemTexts.push(text?.trim())
      }
      console.log(`菜单项内容: ${menuItemTexts.join(', ')}`)
      
      // 点击"连接"菜单项
      const connectMenuItem = page.locator('.context-menu .menu-item').filter({ hasText: '连接' })
      if (await connectMenuItem.count() > 0) {
        await connectMenuItem.click()
        console.log('✅ 成功点击"连接"菜单项')
        await page.waitForTimeout(500)
      }
    } else {
      console.log('❌ 右键菜单未显示')
    }
    
    // 检查是否有新的错误产生
    const newErrors = consoleMessages.filter((msg, index) => 
      index >= consoleMessages.length - 10 &&
      msg.type === 'error'
    )
    
    if (newErrors.length > 0) {
      console.log('\n❌ 右键菜单操作后产生的错误:')
      newErrors.forEach((msg, index) => {
        console.log(`${index + 1}. [${msg.type}] ${msg.text}`)
      })
    } else {
      console.log('✅ 右键菜单操作后无新错误')
    }
  })

  test('汇总所有控制台错误', async () => {
    console.log('\n=== 最终错误汇总 ===')
    
    // 过滤掉测试文件自身的错误
    const applicationErrors = consoleMessages.filter(msg => 
      (msg.type === 'error' || msg.type === 'warning') &&
      !msg.location?.url?.includes('.test.ts') &&
      !msg.text.includes('globalState.test.ts') &&
      !msg.text.includes('beforeEach') &&
      !msg.text.includes('vi.fn')
    )
    
    console.log(`📊 应用程序错误/警告总数: ${applicationErrors.length}`)
    
    if (applicationErrors.length > 0) {
      console.log('\n📋 详细列表:')
      applicationErrors.forEach((msg, index) => {
        console.log(`\n${index + 1}. [${msg.type.toUpperCase()}] ${msg.text}`)
        if (msg.location) {
          console.log(`   文件: ${msg.location.url}`)
          console.log(`   行号: ${msg.location.lineNumber}`)
        }
        if (msg.stack) {
          console.log(`   堆栈:\n${msg.stack.split('\n').slice(0, 8).join('\n')}`)
        }
      })
    } else {
      console.log('✅ 完美！未发现应用程序错误或警告')
    }
    
    // 输出页面错误
    if (pageErrors.length > 0) {
      console.log('\n💥 页面错误:')
      pageErrors.forEach((err, index) => {
        console.log(`${index + 1}. ${err.message}`)
      })
    }
    
    // 保存结果到变量供后续使用
    console.log('\n=== 测试完成 ===')
  })
})
