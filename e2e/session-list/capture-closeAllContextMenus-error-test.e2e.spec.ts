/**
 * GroupHeader 右键菜单 - 捕获 "closeAllContextMenus is not defined" 错误
 * Bug: SessionSidebarContainer.vue 中调用了未定义的 closeAllContextMenus() 函数
 * 触发方式: 右击 GroupHeader → 触发 handleGroupContextMenu → 调用 closeAllContextMenus() → 报错
 */

import { test, ElectronApplication } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: any

// 存储控制台消息和页面错误
const consoleMessages: any[] = []
const pageErrors: any[] = []

test.describe('捕获 GroupHeader 右键菜单的 closeAllContextMenus 错误', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)

    // 清空消息数组
    consoleMessages.length = 0
    pageErrors.length = 0

    // 监听所有控制台消息（包括 error 级别）
    page.on('console', (msg: any) => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      }
      consoleMessages.push(message)

      // 实时输出所有消息用于调试
      if (msg.type() === 'error') {
        console.error(`[ERROR] ${msg.text()}`)
      } else if (msg.type() === 'warning') {
        console.warn(`[WARN] ${msg.text()}`)
      }
    })

    // 监听页面运行时错误（Uncaught ReferenceError 等）
    page.on('pageerror', (error: any) => {
      const err = {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
      pageErrors.push(err)
      console.error(`[PAGE ERROR] ${error.name}: ${error.message}`)
    })
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('步骤1：右击 .group-header 元素并捕获 closeAllContextMenus 错误', async () => {
    console.log('\n' + '='.repeat(70))
    console.log('开始测试：右击 GroupHeader 捕获 closeAllContextMenus 错误')
    console.log('='.repeat(70))

    // 等待应用完全加载
    await page.waitForTimeout(2000)

    // 记录基准线
    const baseConsoleCount = consoleMessages.length
    const basePageErrorCount = pageErrors.length

    console.log(`\n📊 基准统计:`)
    console.log(`   控制台消息数: ${baseConsoleCount}`)
    console.log(`   页面错误数: ${basePageErrorCount}`)

    // 查找 GroupHeader 元素
    const groupHeaderLocator = page.locator('.group-header')
    const headerCount = await groupHeaderLocator.count()

    console.log(`\n🔍 找到 ${headerCount} 个 .group-header 元素`)

    if (headerCount === 0) {
      console.log('❌ 未找到 GroupHeader 元素，测试终止')
      return
    }

    // 获取第一个 GroupHeader 并确保可见
    const firstHeader = groupHeaderLocator.first()
    await firstHeader.waitFor({ state: 'visible', timeout: 5000 })

    const headerText = await firstHeader.textContent()
    console.log(`✅ 目标 GroupHeader: "${headerText?.trim()}"`)
    console.log('🖱️  准备执行右键点击...')

    // 使用 force: true 强制执行右键点击（绕过可能的覆盖层问题）
    try {
      await firstHeader.click({
        button: 'right',
        force: true,
        timeout: 5000
      })
      console.log('✅ 右键点击成功执行')
    } catch (clickError: any) {
      console.log(`⚠️  点击时遇到异常: ${clickError.message}`)
      console.log('   继续检查是否已触发错误...')
    }

    // 等待足够时间让 JavaScript 错误产生并传播
    console.log('\n⏳ 等待 2 秒让错误传播...')
    await page.waitForTimeout(2000)

    // 收集新增的消息和错误
    const newConsoleMessages = consoleMessages.slice(baseConsoleCount)
    const newPageErrors = pageErrors.slice(basePageErrorCount)

    console.log(`\n📊 操作后新增:`)
    console.log(`   控制台消息: +${newConsoleMessages.length}`)
    console.log(`   页面错误: +${newPageErrors.length}`)

    // 输出所有新增的控制台消息
    if (newConsoleMessages.length > 0) {
      console.log('\n📋 新增的控制台消息:')
      newConsoleMessages.forEach((msg, index) => {
        const icon = msg.type === 'error' ? '❌' : msg.type === 'warning' ? '⚠️' : 'ℹ️'
        console.log(`${icon} ${index + 1}. [${msg.type.toUpperCase()}] ${msg.text}`)
        if (msg.location) {
          console.log(`   📍 ${msg.location.url}:${msg.location.lineNumber}`)
        }
      })
    }

    // 特别查找目标错误："closeAllContextMenus is not defined"
    const targetConsoleError = newConsoleMessages.find(msg =>
      msg.text?.includes('closeAllContextMenus')
    )

    const targetPageError = newPageErrors.find(err =>
      err.message?.includes('closeAllContextMenus')
    )

    // 输出所有新增的页面运行时错误
    if (newPageErrors.length > 0) {
      console.log('\n💥 新增的页面运行时错误:')
      newPageErrors.forEach((err, index) => {
        console.log(`${index + 1}. [${err.name}] ${err.message}`)
        if (err.stack) {
          const stackLines = err.stack.split('\n').slice(0, 5)
          stackLines.forEach(line => console.log(`   ${line}`))
        }
      })
    }

    // 最终结果判断
    console.log('\n' + '='.repeat(70))
    console.log('🎯 测试结果:')
    console.log('='.repeat(70))

    if (targetConsoleError || targetPageError) {
      console.log('✅ 成功捕获到目标错误!')
      console.log('\n🔴 错误详情:')
      if (targetConsoleError) {
        console.log(`   类型: Console Error`)
        console.log(`   消息: ${targetConsoleError.text}`)
        console.log(`   位置: ${targetConsoleError.location?.url}:${targetConsoleError.location?.lineNumber}`)
      }
      if (targetPageError) {
        console.log(`   类型: Page Runtime Error (${targetPageError.name})`)
        console.log(`   消息: ${targetPageError.message}`)
        console.log(`   堆栈: ${targetPageError.stack?.split('\\n')[1]}`)
      }
      console.log('\n💡 这是导致 GroupHeader 右键菜单无法正常工作的根本原因!')
    } else if (newPageErrors.length > 0 || newConsoleMessages.some(m => m.type === 'error')) {
      console.log('⚠️  未找到特定目标错误，但捕获到了其他错误')
      console.log('   请查看上方的详细错误信息')
    } else {
      console.log('ℹ️  本次测试未捕获到任何错误')
      console.log('   可能原因:')
      console.log('   1. 测试环境与手动测试环境不同')
      console.log('   2. 需要特定的前置条件才能触发该错误')
      console.log('   3. 错误已被其他机制处理或吞没')
    }

    console.log('='.repeat(70))
  })

  test('步骤2：完整输出所有捕获到的错误信息供分析', async () => {
    console.log('\n' + '='.repeat(70))
    console.log('完整错误报告')
    console.log('='.repeat(70))

    // 统计所有错误
    const allConsoleErrors = consoleMessages.filter(msg => msg.type === 'error')

    console.log(`\n📈 总体统计:`)
    console.log(`   总控制台消息: ${consoleMessages.length}`)
    console.log(`   其中 Error: ${allConsoleErrors.length}`)
    console.log(`   页面运行时错误: ${pageErrors.length}`)

    // 输出所有控制台级别的错误
    if (allConsoleErrors.length > 0) {
      console.log('\n🔴 所有 Console Error:')
      allConsoleErrors.forEach((msg, index) => {
        console.log(`\n${index + 1}. ${msg.text}`)
        if (msg.location) {
          console.log(`   文件: ${msg.location.url}`)
          console.log(`   行号: ${msg.location.lineNumber}`)
        }
      })
    }

    // 输出所有页面运行时错误
    if (pageErrors.length > 0) {
      console.log('\n💥 所有 Page Runtime Error:')
      pageErrors.forEach((err, index) => {
        console.log(`\n${index + 1}. [${err.name}] ${err.message}`)
        if (err.stack) {
          console.log('   完整堆栈:')
          err.stack.split('\n').forEach(line => console.log(`     ${line}`))
        }
      })
    }

    // 如果完全没有错误
    if (allConsoleErrors.length === 0 && pageErrors.length === 0) {
      console.log('\n✅ 本次测试会话未捕获到任何错误')
    }

    console.log('\n' + '='.repeat(70))
  })
})
