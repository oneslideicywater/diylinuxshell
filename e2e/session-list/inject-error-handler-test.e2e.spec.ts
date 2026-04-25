/**
 * GroupHeader 右键菜单 - 注入 Vue errorHandler 捕获 closeAllContextMenus 错误
 * 策略：在页面加载后注入全局 Vue 错误处理器，捕获所有组件事件中的未处理错误
 */

import { test, ElectronApplication } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: any

// 存储所有捕获到的错误
const capturedErrors: any[] = []
const consoleMessages: any[] = []

test.describe('GroupHeader 右键菜单 - 注入 Vue ErrorHandler', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)

    // 清空数组
    capturedErrors.length = 0
    consoleMessages.length = 0

    // 🔑 关键：注入自定义的 window.onerror 和 unhandledrejection 处理器
    await page.evaluate(() => {
      // 存储错误到 window 对象，方便后续读取
      (window as any).__capturedErrors__ = []

      // 捕获全局 JavaScript 错误（包括 ReferenceError）
      window.onerror = function(message, source, lineno, colno, error) {
        const errInfo = {
          type: 'window.onerror',
          message: String(message),
          source: source,
          line: lineno,
          column: colno,
          error: error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
          } : null,
          timestamp: new Date().toISOString()
        }
        ;(window as any).__capturedErrors__.push(errInfo)
        return false  // 不阻止默认行为
      }

      // 捕获未处理的 Promise 拒绝
      window.addEventListener('unhandledrejection', (event) => {
        const errInfo = {
          type: 'unhandledrejection',
          message: event.reason?.message || String(event.reason),
          reason: event.reason ? {
            name: event.reason.name,
            message: event.reason.message,
            stack: event.reason.stack
          } : null,
          timestamp: new Date().toISOString()
        }
        ;(window as any).__capturedErrors__.push(errInfo)
      })

      // 尝试拦截 console.error 来捕获 Vue warn
      const originalConsoleError = console.error
      console.error = function(...args) {
        const errorMsg = args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ')

        ;(window as any).__capturedErrors__.push({
          type: 'console.error',
          message: errorMsg,
          timestamp: new Date().toISOString()
        })

        originalConsoleError.apply(console, args)
      }

      // 尝试拦截 console.warn 来捕获 Vue warn
      const originalConsoleWarn = console.warn
      console.warn = function(...args) {
        const warnMsg = args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ')

        ;(window as any).__capturedErrors__.push({
          type: 'console.warn',
          message: warnMsg,
          timestamp: new Date().toISOString()
        })

        originalConsoleWarn.apply(console, args)
      }

      console.log('✅ 错误捕获器已注入')
    })

    // 同时也监听 Playwright 的控制台消息作为备份
    page.on('console', (msg: any) => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      }
      consoleMessages.push(message)

      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.error(`[PW ${msg.type()}] ${msg.text()}`)
      }
    })
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('右击 .group-header 并通过注入的处理器捕获 closeAllContextMenus 错误', async () => {
    console.log('\n' + '='.repeat(80))
    console.log('🎯 开始测试：右击 GroupHeader（注入 ErrorHandler）')
    console.log('='.repeat(80))

    // 等待页面稳定
    await page.waitForTimeout(2000)

    // 记录基准线：从注入的处理器获取当前错误数
    const baseErrorCount = await page.evaluate(() => {
      return (window as any).__capturedErrors__?.length || 0
    })

    console.log(`\n📊 基准统计:`)
    console.log(`   已捕获的错误数: ${baseErrorCount}`)

    // 查找 GroupHeader 元素
    const groupHeaderLocator = page.locator('.group-header')
    const headerCount = await groupHeaderLocator.count()

    console.log(`\n🔍 找到 ${headerCount} 个 .group-header 元素`)

    if (headerCount === 0) {
      console.log('❌ 未找到 GroupHeader 元素')
      return
    }

    const firstHeader = groupHeaderLocator.first()

    try {
      await firstHeader.waitFor({ state: 'visible', timeout: 5000 })
    } catch (e) {
      console.log('⚠️  GroupHeader 可能不可见，继续尝试...')
    }

    const headerText = await firstHeader.textContent()
    console.log(`✅ 目标: "${headerText?.trim()}"`)
    console.log('🖱️  执行右键点击...')

    // 右键点击
    try {
      await firstHeader.click({
        button: 'right',
        force: true,
        timeout: 5000
      })
      console.log('✅ 右键点击成功')
    } catch (clickError: any) {
      console.log(`⚠️  点击异常: ${clickError.message}`)
    }

    // 等待足够时间让错误产生和被捕获
    console.log('\n⏳ 等待 3 秒...')
    await page.waitForTimeout(3000)

    // 从注入的处理器获取所有新捕获的错误
    const allCapturedErrors = await page.evaluate(() => {
      return (window as any).__capturedErrors__ || []
    })

    const newErrors = allCapturedErrors.slice(baseErrorCount)

    console.log(`\n📊 操作后新增错误: ${newErrors.length} 个`)

    // 输出所有新增的错误
    if (newErrors.length > 0) {
      console.log('\n🔴 通过注入的处理器捕获到的新增错误:')
      console.log(''.padEnd(80, '-'))

      newErrors.forEach((err: any, index: number) => {
        console.log(`\n${index + 1}. [${err.type}]`)
        console.log(`   消息: ${err.message}`)

        if (err.source) {
          console.log(`   文件: ${err.source}:${err.line}:${err.column}`)
        }

        if (err.error) {
          console.log(`   错误名: ${err.error.name}`)
          console.log(`   堆栈: ${err.error.stack?.split('\\n').slice(0, 4).join('\\n') || 'N/A'}`)
        }

        if (err.reason) {
          console.log(`   原因: ${err.reason.name}: ${err.reason.message}`)
        }

        // 特别标记目标错误
        if (err.message?.includes('closeAllContextMenus')) {
          console.log('   🎯 >>>>> 这是目标错误: "closeAllContextMenus is not defined"! <<<<<')
        }
        if (err.message?.includes('Unhandled error during execution')) {
          console.log('   🎯 >>>>> Vue unhandled error! <<<<<')
        }
        if (err.message?.includes('GroupHeader')) {
          console.log('   🎯 >>>>> 与 GroupHeader 相关! <<<<<')
        }
      })

      console.log('\n' + ''.padEnd(80, '-'))
    }

    // 同时输出 Playwright 控制台监听器捕获的消息
    const newConsoleMsgs = consoleMessages.filter((_, i) => i >= 0)  // 所有消息都是新的
    if (newConsoleMsgs.length > 0) {
      console.log('\n📋 Playwright 控制台监听器捕获的消息:')
      newConsoleMsgs.forEach((msg, index) => {
        if (msg.type === 'error' || msg.type === 'warning') {
          console.log(`${index + 1}. [${msg.type.toUpperCase()}] ${msg.text}`)
        }
      })
    }

    // 最终结果判断
    console.log('\n' + '='.repeat(80))
    console.log('🎯 测试结果:')
    console.log('='.repeat(80))

    const hasTargetError = newErrors.some((err: any) =>
      err.message?.includes('closeAllContextMenus')
    )

    const hasVueWarn = newErrors.some((err: any) =>
      err.message?.includes('Unhandled error during execution of component event handler')
    )

    if (hasTargetError) {
      console.log('✅ 成功捕获到 "closeAllContextMenus is not defined" 错误!')
      console.log('\n💡 Bug 确认:')
      console.log('   文件: SessionSidebarContainer.vue')
      console.log('   函数: handleGroupContextMenu()')
      console.log('   问题: 调用了未定义的 closeAllContextMenus() 函数')
      console.log('\n🔧 修复方案: 定义 closeAllContextMenus 函数或移除调用')
    } else if (hasVueWarn) {
      console.log('✅ 捕获到 Vue unhandled error warning!')
      console.log('   说明组件事件处理器中存在未捕获的错误')
    } else if (newErrors.length > 0) {
      console.log('⚠️  捕获到了其他错误/警告，请查看上方详情')
    } else {
      console.log('ℹ️  未捕获到预期错误')
      console.log('   但从代码分析可以确认 bug 存在:')
      console.log('   - SessionSidebarContainer.vue 第364行调用了 closeAllContextMenus()')
      console.log('   - 该函数从未定义')
    }

    console.log('='.repeat(80))
  })

  test('完整输出所有捕获的错误信息', async () => {
    console.log('\n' + '='.repeat(80))
    console.log('📊 完整错误报告')
    console.log('='.repeat(80))

    const allErrors = await page.evaluate(() => {
      return (window as any).__capturedErrors__ || []
    })

    console.log(`\n总捕获错误数: ${allErrors.length}`)

    if (allErrors.length > 0) {
      console.log('\n所有错误的类型分布:')
      const typeStats: Record<string, number> = {}
      allErrors.forEach((err: any) => {
        typeStats[err.type] = (typeStats[err.type] || 0) + 1
      })
      Object.entries(typeStats).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`)
      })

      console.log('\n详细错误列表:')
      allErrors.forEach((err: any, index: number) => {
        console.log(`\n${index + 1}. [${err.type}] ${err.message}`)
      })
    }

    console.log('\n' + '='.repeat(80))
  })
})
