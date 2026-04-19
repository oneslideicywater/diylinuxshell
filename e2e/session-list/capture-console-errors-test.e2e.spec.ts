/**
 * SessionGroupTree 右键菜单控制台报错捕获测试
 * 严格按照 electron-testing SKILL 标准流程
 */

import { test, ElectronApplication } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: any

// 存储所有控制台消息
const consoleMessages: any[] = []
const pageErrors: any[] = []

test.describe('SessionGroupTree 右键菜单 - 控制台报错捕获', () => {
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

      // 输出 warning 和 error 级别的消息
      if (msg.type() === 'warning' || msg.type() === 'error') {
        console.error(`[${msg.type()}] ${msg.text()}`)
        if (msg.location()) {
          console.error(`   📍 Location: ${msg.location().url}:${msg.location().lineNumber}`)
        }
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

  test('步骤1：应用加载后检查初始状态', async () => {
    console.log('\n=== 步骤1：检查初始加载状态 ===')
    await page.waitForTimeout(2000)

    console.log(`📊 初始状态统计:`)
    console.log(`   控制台消息总数: ${consoleMessages.length}`)
    console.log(`   页面错误总数: ${pageErrors.length}`)

    if (pageErrors.length > 0) {
      console.log('\n❌ 加载时发现的页面错误:')
      pageErrors.forEach((err, index) => {
        console.log(`${index + 1}. ${err.message}`)
      })
    }

    const errors = consoleMessages.filter(msg => msg.type === 'error')
    const warnings = consoleMessages.filter(msg => msg.type === 'warning')

    console.log(`\n📊 错误/警告分布:`)
    console.log(`   错误: ${errors.length}`)
    console.log(`   警告: ${warnings.length}`)

    if (errors.length > 0 || warnings.length > 0) {
      console.log('\n📋 所有错误和警告:')
      ;[...errors, ...warnings].forEach((msg, index) => {
        console.log(`${index + 1}. [${msg.type.toUpperCase()}] ${msg.text}`)
        if (msg.location) {
          console.log(`   文件: ${msg.location.url}:${msg.location.lineNumber}`)
        }
      })
    }
  })

  test('步骤2：执行 SessionGroupTree 右键点击操作', async () => {
    console.log('\n=== 步骤2：执行右键菜单操作 ===')

    // 记录操作前的消息数量
    const messagesBeforeAction = consoleMessages.length

    // 等待分组元素出现
    try {
      await page.waitForSelector('.session-group', { timeout: 5000 })
      const groupCount = await page.locator('.session-group').count()
      console.log(`找到 ${groupCount} 个分组`)

      if (groupCount > 0) {
        // 右键点击第一个分组（不使用 force，真实模拟用户操作）
        const firstGroup = page.locator('.session-group').first()

        try {
          await firstGroup.click({ button: 'right', timeout: 5000 })
          console.log('✅ 成功触发分组右键点击')

          // 等待可能的异步错误
          await page.waitForTimeout(1000)
        } catch (clickError: any) {
          console.log('⚠️  右键点击遇到问题:', clickError.message)

          // 即使点击失败，也要等待一下看是否有错误产生
          await page.waitForTimeout(500)
        }
      }

      // 尝试右键点击 GroupHeader
      const headerCount = await page.locator('.group-header').count()
      console.log(`找到 ${headerCount} 个 GroupHeader`)

      if (headerCount > 0) {
        const firstHeader = page.locator('.group-header').first()

        try {
          await firstHeader.click({ button: 'right', timeout: 5000 })
          console.log('✅ 成功触发 GroupHeader 右键点击')

          await page.waitForTimeout(1000)
        } catch (clickError: any) {
          console.log('⚠️  GroupHeader 右键点击遇到问题:', clickError.message)
          await page.waitForTimeout(500)
        }
      }

    } catch (error: any) {
      console.log('❌ 未找到分组元素:', error.message)
    }

    // 收集操作后的新消息
    const newMessages = consoleMessages.slice(messagesBeforeAction)
    console.log(`\n📊 操作后新增消息: ${newMessages.length} 条`)
  })

  test('步骤3：汇总分析所有控制台报错', async () => {
    console.log('\n=== 步骤3：汇总分析控制台报错 ===')
    console.log(''.padEnd(60, '='))
    console.log('')
    console.log(`📊 总体统计:`)
    console.log(`   控制台消息总数: ${consoleMessages.length}`)
    console.log(`   页面错误总数: ${pageErrors.length}`)
    console.log('')

    // 过滤出应用程序级别的错误（排除测试文件自身的问题）
    const appErrors = consoleMessages.filter(msg => {
      const isTestFileError = msg.location?.url?.includes('.test.ts')
      const isErrorOrWarning = msg.type === 'error' || msg.type === 'warning'
      const isKnownIssue = msg.text?.includes('globalState.test.ts') ||
                           msg.text?.includes('beforeEach') ||
                           msg.text?.includes('vi.fn')
      return !isTestFileError && isErrorOrWarning && !isKnownIssue
    })

    console.log(`🎯 应用程序错误/警告数量: ${appErrors.length}`)
    console.log('')

    if (appErrors.length > 0) {
      console.log('🔴 详细错误列表:')
      console.log(''.padEnd(60, '-'))

      appErrors.forEach((msg, index) => {
        console.log(`\n${index + 1}. [${msg.type.toUpperCase()}] ${msg.text}`)
        if (msg.location) {
          console.log(`   📍 文件: ${msg.location.url}`)
          console.log(`   📍 行号: ${msg.location.lineNumber}`)
          console.log(`   📍 列号: ${msg.location.columnNumber}`)
        }
      })
    } else {
      console.log('✅ 未发现应用程序级别的错误或警告')
    }

    // 输出页面运行时错误
    if (pageErrors.length > 0) {
      console.log('\n💥 页面运行时错误:')
      console.log(''.padEnd(60, '-'))

      pageErrors.forEach((err, index) => {
        console.log(`\n${index + 1}. ${err.message}`)
        if (err.stack) {
          // 只显示前10行堆栈信息
          const stackLines = err.stack.split('\n').slice(0, 10)
          console.log('   堆栈信息:')
          stackLines.forEach(line => {
            console.log(`     ${line}`)
          })
        }
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
    console.log(''.padEnd(60, '='))
    console.log('✅ 控制台报错捕获完成')
    console.log(''.padEnd(60, '='))
  })
})
