/**
 * SessionGroupTree/GroupHeader 右键菜单 - 强制触发并捕获控制台报错
 * 严格按照 electron-testing SKILL 标准流程
 */

import { test, ElectronApplication } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: any

// 存储所有控制台消息
const consoleMessages: any[] = []
const pageErrors: any[] = []

test.describe('GroupHeader 右键菜单 - 捕获真实控制台报错', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)

    // 清空之前的消息
    consoleMessages.length = 0
    pageErrors.length = 0

    // 监听控制台消息（严格按照 SKILL.md#L181-241）
    page.on('console', (msg: any) => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      }
      consoleMessages.push(message)

      // 输出所有级别的消息（用于调试）
      if (msg.type() === 'warning' || msg.type() === 'error') {
        console.error(`[${msg.type()}] ${msg.text()}`)
        if (msg.location()) {
          console.error(`   📍 Location: ${msg.location().url}:${msg.location().lineNumber}`)
        }
      } else if (msg.type() === 'log') {
        console.log(`[Console Log] ${msg.text()}`)
      }
    })

    // 监听页面错误（严格按照 SKILL.md#L181-241）
    page.on('pageerror', (error: any) => {
      const err = {
        message: error.message,
        stack: error.stack
      }
      pageErrors.push(err)
      console.error(`[Page Error] ${error.message}`)
      if (error.stack) {
        console.error(`   Stack: ${error.stack}`)
      }
    })
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('步骤1：强制触发 GroupHeader 右键菜单并捕获报错', async () => {
    console.log('\n=== 步骤1：强制触发 GroupHeader 右键菜单 ===')
    await page.waitForTimeout(2000)

    // 记录操作前的消息数量
    const messagesBeforeAction = consoleMessages.length

    // 等待 GroupHeader 出现
    await page.waitForSelector('.group-header', { timeout: 5000 })
    const headerCount = await page.locator('.group-header').count()
    console.log(`📊 找到 ${headerCount} 个 GroupHeader`)

    if (headerCount > 0) {
      const firstHeader = page.locator('.group-header').first()

      // 使用 force: true 强制触发右键点击（绕过覆盖层检测）
      try {
        await firstHeader.click({ button: 'right', force: true, timeout: 5000 })
        console.log('✅ 成功强制触发 GroupHeader 右键点击')

        // 等待足够时间让异步错误产生
        await page.waitForTimeout(2000)
      } catch (error: any) {
        console.error('❌ 强制右键点击失败:', error.message)
      }

      // 收集操作后的新消息
      const newMessages = consoleMessages.slice(messagesBeforeAction)
      console.log(`\n📊 操作后新增消息: ${newMessages.length} 条`)

      // 输出所有新增的消息
      if (newMessages.length > 0) {
        console.log('\n📋 新增的所有消息:')
        newMessages.forEach((msg, index) => {
          console.log(`${index + 1}. [${msg.type.toUpperCase()}] ${msg.text}`)
          if (msg.location) {
            console.log(`   📍 文件: ${msg.location.url}`)
            console.log(`   📍 行号: ${msg.location.lineNumber}`)
          }
        })

        // 特别标记错误和警告
        const errorsAndWarnings = newMessages.filter(msg =>
          msg.type === 'error' || msg.type === 'warning'
        )
        if (errorsAndWarnings.length > 0) {
          console.log('\n🔴 其中错误和警告:')
          errorsAndWarnings.forEach((msg, index) => {
            console.log(`${index + 1}. [${msg.type.toUpperCase()}] ${msg.text}`)
          })
        }
      } else {
        console.log('⚠️  未捕获到新的控制台消息')
      }
    } else {
      console.log('❌ 未找到 GroupHeader 元素')
    }
  })

  test('步骤2：通过 JavaScript 直接触发 contextmenu 事件', async () => {
    console.log('\n=== 步骤2：通过 JS 直接触发 contextmenu 事件 ===')

    // 使用 JavaScript 直接触发 contextmenu 事件（完全绕过 DOM 层面的问题）
    const messagesBeforeJS = consoleMessages.length

    try {
      const result = await page.evaluate(() => {
        return new Promise((resolve) => {
          // 找到第一个 GroupHeader 元素
          const groupHeader = document.querySelector('.group-header')
          if (!groupHeader) {
            resolve({ success: false, error: 'GroupHeader not found' })
            return
          }

          // 创建并分发 contextmenu 事件
          const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: 100,
            clientY: 100,
            button: 2, // 右键
            buttons: 2
          })

          groupHeader.dispatchEvent(event)

          resolve({
            success: true,
            message: 'contextmenu event dispatched',
            targetClass: groupHeader.className
          })
        })
      })

      console.log('✅ JavaScript 触发结果:', JSON.stringify(result))

      // 等待可能的异步错误
      await page.waitForTimeout(2000)

      // 收集新消息
      const newMessages = consoleMessages.slice(messagesBeforeJS)
      console.log(`\n📊 JS 触发后新增消息: ${newMessages.length} 条`)

      if (newMessages.length > 0) {
        console.log('\n📋 JS 触发后的新增消息:')
        newMessages.forEach((msg, index) => {
          console.log(`${index + 1}. [${msg.type.toUpperCase()}] ${msg.text}`)
          if (msg.location) {
            console.log(`   📍 文件: ${msg.location.url}:${msg.location.lineNumber}`)
          }
        })
      }
    } catch (error: any) {
      console.error('❌ JavaScript 执行失败:', error.message)
    }
  })

  test('步骤3：汇总分析所有捕获到的控制台报错', async () => {
    console.log('\n=== 步骤3：最终汇总分析 ===')
    console.log(''.padEnd(70, '='))
    console.log('')
    console.log(`📊 总体统计:`)
    console.log(`   控制台消息总数: ${consoleMessages.length}`)
    console.log(`   页面错误总数: ${pageErrors.length}`)
    console.log('')

    // 过滤出应用程序级别的错误和警告
    const appErrorsAndWarnings = consoleMessages.filter(msg => {
      const isTestFileError = msg.location?.url?.includes('.test.ts')
      const isErrorOrWarning = msg.type === 'error' || msg.type === 'warning'
      const isKnownIssue = msg.text?.includes('globalState.test.ts') ||
                           msg.text?.includes('beforeEach') ||
                           msg.text?.includes('vi.fn')
      return !isTestFileError && isErrorOrWarning && !isKnownIssue
    })

    console.log(`🎯 应用程序错误/警告数量: ${appErrorsAndWarnings.length}`)

    if (appErrorsAndWarnings.length > 0) {
      console.log('\n🔴 详细错误列表（这是修复 bug 的依据）:')
      console.log(''.padEnd(70, '-'))

      appErrorsAndWarnings.forEach((msg, index) => {
        console.log(`\n${index + 1}. [${msg.type.toUpperCase()}]`)
        console.log(`   消息内容: ${msg.text}`)
        if (msg.location) {
          console.log(`   📍 文件路径: ${msg.location.url}`)
          console.log(`   📍 行号: ${msg.location.lineNumber}`)
          console.log(`   📍 列号: ${msg.location.columnNumber}`)
        }
      })
    } else {
      console.log('\n✅ 未发现应用程序级别的错误或警告')
    }

    // 输出页面运行时错误
    if (pageErrors.length > 0) {
      console.log('\n💥 页面运行时错误:')
      console.log(''.padEnd(70, '-'))

      pageErrors.forEach((err, index) => {
        console.log(`\n${index + 1}. 错误消息: ${err.message}`)
        if (err.stack) {
          const stackLines = err.stack.split('\n').slice(0, 8)
          console.log('   堆栈信息:')
          stackLines.forEach(line => {
            console.log(`     ${line}`)
          })
        }
      })
    }

    // 显示所有日志消息（可能有有用的调试信息）
    const logMessages = consoleMessages.filter(msg => msg.type === 'log')
    if (logMessages.length > 0) {
      console.log('\n📝 所有日志消息（可能包含有用信息）:')
      logMessages.forEach((msg, index) => {
        console.log(`${index + 1}. ${msg.text}`)
      })
    }

    // 消息类型分布统计
    console.log('\n📈 控制台消息类型分布:')
    const typeStats: Record<string, number> = {}
    consoleMessages.forEach(msg => {
      typeStats[msg.type] = (typeStats[msg.type] || 0) + 1
    })
    Object.entries(typeStats).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`)
    })

    console.log('')
    console.log(''.padEnd(70, '='))
    console.log('✅ 控制台报错捕获完成 - 请根据上述信息修复 bug')
    console.log(''.padEnd(70, '='))
  })
})
