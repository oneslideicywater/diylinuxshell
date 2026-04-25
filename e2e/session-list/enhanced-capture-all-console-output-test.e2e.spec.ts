/**
 * 增强版：全面捕获 GroupHeader 右键菜单的所有控制台输出
 * 目标：修复 closeAllContextMenus 后，捕获新的控制台报错
 * 策略：多层级、全方位的错误捕获机制
 */

import { test, ElectronApplication } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: any

test.describe('增强版 - 全面捕获 GroupHeader 右键菜单控制台报错', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)

    // 等待应用完全稳定
    await page.waitForTimeout(2000)

    // 🔥 核心策略：在页面加载完成后立即注入多层级的错误捕获器
    await page.evaluate(() => {
      // 创建全局错误存储对象
      (window as any).__ALL_ERRORS__ = {
        consoleErrors: [],
        consoleWarnings: [],
        consoleLogs: [],
        windowErrors: [],
        unhandledRejections: [],
        vueWarnings: []
      }

      // 1️⃣ 拦截 console.error（最底层）
      const originalConsoleError = console.error
      console.error = function(...args) {
        const msg = args.map(arg => {
          if (arg instanceof Error) {
            return `[Error] ${arg.message}\n${arg.stack}`
          }
          return typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        }).join(' ')

        ;(window as any).__ALL_ERRORS__.consoleErrors.push({
          message: msg,
          timestamp: Date.now(),
          stack: new Error().stack
        })

        originalConsoleError.apply(console, args)
      }

      // 2️⃣ 拦截 console.warn（Vue warn 会走这里）
      const originalConsoleWarn = console.warn
      console.warn = function(...args) {
        const msg = args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ')

        ;(window as any).__ALL_ERRORS__.consoleWarnings.push({
          message: msg,
          timestamp: Date.now()
        })

        // 特别标记 Vue 相关的警告
        if (msg.includes('[Vue warn]') || msg.includes('Unhandled error')) {
          (window as any).__ALL_ERRORS__.vueWarnings.push({
            message: msg,
            timestamp: Date.now()
          })
        }

        originalConsoleWarn.apply(console, args)
      }

      // 3️⃣ 拦截 console.log（可能包含调试信息）
      const originalConsoleLog = console.log
      console.log = function(...args) {
        const msg = args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ')

        ;(window as any).__ALL_ERRORS__.consoleLogs.push({
          message: msg,
          timestamp: Date.now()
        })

        originalConsoleLog.apply(console, args)
      }

      // 4️⃣ 全局 window.onerror（捕获 ReferenceError 等）
      const originalOnError = window.onerror
      window.onerror = function(message, source, lineno, colno, error) {
        (window as any).__ALL_ERRORS__.windowErrors.push({
          type: 'window.onerror',
          message: String(message),
          source: source,
          line: lineno,
          column: colno,
          errorName: error?.name,
          errorMessage: error?.message,
          errorStack: error?.stack,
          timestamp: Date.now()
        })

        if (originalOnError) {
          return originalOnError.apply(window, arguments as any)
        }
        return false
      }

      // 5️⃣ 未处理的 Promise rejection
      window.addEventListener('unhandledrejection', (event) => {
        (window as any).__ALL_ERRORS__.unhandledRejections.push({
          reason: event.reason?.message || String(event.reason),
          reasonName: event.reason?.name,
          reasonStack: event.reason?.stack,
          timestamp: Date.now()
        })
      })

      console.log('[Test] ✅ 多层级错误捕获器已注入完成')
    })

    // 同时也启用 Playwright 层面的监听（作为备份）
    page.on('console', (msg: any) => {
      const text = msg.text()
      const location = msg.location()

      // 实时输出到测试日志
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[PW ${msg.type().toUpperCase()}] ${text}`)
        if (location) {
          console.log(`   📍 ${location.url}:${location.location.lineNumber}`)
        }
      }
    })

    page.on('pageerror', (error: any) => {
      console.log(`[PW PAGE ERROR] ${error.name}: ${error.message}`)
    })
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('右击 .group-header 并全面收集所有控制台输出', async () => {
    console.log('\n' + '='.repeat(90))
    console.log('🎯 增强版测试：右击 GroupHeader - 全面收集控制台输出')
    console.log('='.repeat(90))

    // 清空之前的记录（从注入的存储中获取基准）
    await page.evaluate(() => {
      const store = (window as any).__ALL_ERRORS__
      if (store) {
        Object.keys(store).forEach(key => {
          store[key] = []
        })
      }
    })

    // 记录基准时间
    const baseTime = Date.now()

    console.log('\n📊 基准状态已重置')

    // 查找并右键点击 GroupHeader
    const groupHeaderLocator = page.locator('.group-header')
    const headerCount = await groupHeaderLocator.count()

    console.log(`\n🔍 找到 ${headerCount} 个 .group-header 元素`)

    if (headerCount > 0) {
      const firstHeader = groupHeaderLocator.first()

      try {
        await firstHeader.waitFor({ state: 'visible', timeout: 3000 })
      } catch (e) {
        console.log('⚠️  等待可见超时，继续尝试...')
      }

      const headerText = await firstHeader.textContent()
      console.log(`✅ 目标元素: "${headerText?.trim()}"`)
      console.log('🖱️  执行右键点击...')

      // 右键点击
      try {
        await firstHeader.click({
          button: 'right',
          force: true,
          timeout: 5000
        })
        console.log('✅ 右键点击成功执行')
      } catch (clickError: any) {
        console.log(`⚠️  点击异常: ${clickError.message}`)
      }

      // ⏳ 关键：等待足够长的时间让所有异步操作和错误传播完成
      console.log('\n⏳ 等待 5 秒让所有操作和错误完全传播...')
      await page.waitForTimeout(5000)

      // 📊 收集所有捕获到的信息
      const allCapturedData = await page.evaluate(() => {
        return (window as any).__ALL_ERRORS__ || {}
      })

      console.log('\n' + '='.repeat(90))
      console.log('📊 完整捕获报告')
      console.log('='.repeat(90))

      // 输出 console.error
      const errors = allCapturedData.consoleErrors || []
      console.log(`\n❌ Console Error (${errors.length} 条):`)
      if (errors.length > 0) {
        errors.forEach((err: any, i: number) => {
          console.log(`\n  ${i + 1}. ${err.message}`)
          if (err.stack) {
            console.log(`     Stack: ${err.stack.split('\\n').slice(2, 6).join('\\n')}`)
          }
        })
      } else {
        console.log('   无')
      }

      // 输出 console.warn（重点！Vue warn 在这里）
      const warnings = allCapturedData.consoleWarnings || []
      console.log(`\n⚠️  Console Warning (${warnings.length} 条):`)
      if (warnings.length > 0) {
        warnings.forEach((warn: any, i: number) => {
          console.log(`\n  ${i + 1}. ${warn.message}`)

          // 特别标记重要的警告
          if (warn.message.includes('closeAllContextMenus')) {
            console.log('     🎯 >>>>> 包含 "closeAllContextMenus"!')
          }
          if (warn.message.includes('Unhandled error during execution')) {
            console.log('     🎯 >>>>> Vue "Unhandled error" 警告!')
          }
          if (warn.message.includes('GroupHeader')) {
            console.log('     🎯 >>>>> 与 GroupHeader 相关!')
          }
          if (warn.message.includes('ReferenceError') || warn.message.includes('is not defined')) {
            console.log('     🎯 >>>>> 引用错误/未定义函数!')
          }
          if (warn.message.includes('TypeError')) {
            console.log('     🎯 >>>>> 类型错误!')
          }
        })
      } else {
        console.log('   无')
      }

      // 输出 Vue 特定警告
      const vueWarns = allCapturedData.vueWarnings || []
      if (vueWarns.length > 0) {
        console.log(`\n🔴 Vue 特定警告 (${vueWarns.length} 条):`)
        vueWarns.forEach((vw: any, i: number) => {
          console.log(`  ${i + 1}. ${vw.message}`)
        })
      }

      // 输出 window.onerror 错误
      const windowErrs = allCapturedData.windowErrors || []
      console.log(`\n💥 Window Errors (${windowErrs.length} 条):`)
      if (windowErrs.length > 0) {
        windowErrs.forEach((we: any, i: number) => {
          console.log(`\n  ${i + 1}. [${we.type}] ${we.errorName}: ${we.errorMessage}`)
          console.log(`     Source: ${we.source}:${we.line}:${we.column}`)
          if (we.errorStack) {
            console.log(`     Stack: ${we.errorStack.split('\\n').slice(0, 4).join('\\n')}`)
          }

          if (we.errorMessage?.includes('closeAllContextMenus')) {
            console.log('     🎯 >>>>> 目标错误!')
          }
        })
      } else {
        console.log('   无')
      }

      // 输出未处理的 Promise rejection
      const rejections = allCapturedData.unhandledRejections || []
      console.log(`\n⚡ Unhandled Rejections (${rejections.length} 条):`)
      if (rejections.length > 0) {
        rejections.forEach((r: any, i: number) => {
          console.log(`  ${i + 1}. ${r.reasonName}: ${r.reason}`)
        })
      } else {
        console.log('   无')
      }

      // 输出 console.log（可能有有用的调试信息）
      const logs = allCapturedData.consoleLogs || []
      const relevantLogs = logs.filter((log: any) =>
        log.message.includes('error') ||
        log.message.includes('Error') ||
        log.message.includes('warn') ||
        log.message.includes('contextmenu') ||
        log.message.includes('context-menu')
      )

      if (relevantLogs.length > 0) {
        console.log(`\n📝 相关的 Console Log (${relevantLogs.length} 条):`)
        relevantLogs.forEach((log: any, i: number) => {
          console.log(`  ${i + 1}. ${log.message}`)
        })
      }

      // 最终汇总
      console.log('\n' + '='.repeat(90))
      console.log('📈 最终统计:')
      console.log('='.repeat(90))
      console.log(`   ❌ Console Errors: ${errors.length}`)
      console.log(`   ⚠️  Console Warnings: ${warnings.length}`)
      console.log(`   🔴 Vue Warnings: ${vueWarns.length}`)
      console.log(`   💥 Window Errors: ${windowErrs.length}`)
      console.log(`   ⚡ Unhandled Rejections: ${rejections.length}`)
      console.log(`   📝 Total Logs: ${(allCapturedData.consoleLogs || []).length}`)

      const totalIssues = errors.length + warnings.length + vueWarns.length +
                          windowErrs.length + rejections.length

      console.log(`\n🎯 总计发现的问题: ${totalIssues}`)

      if (totalIssues > 0) {
        console.log('\n✅ 成功捕获到了控制台输出！请查看上方详细信息以修复 bug。')
      } else {
        console.log('\nℹ️  未捕获到任何问题输出')
        console.log('   这说明修复后右键菜单工作正常，没有产生新的错误。')
      }

      console.log('='.repeat(90))

    } else {
      console.log('❌ 未找到 .group-header 元素')
    }
  })
})
