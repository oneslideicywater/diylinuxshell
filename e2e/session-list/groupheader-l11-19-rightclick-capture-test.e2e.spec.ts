/**
 * 专门测试：右击 GroupHeader.vue#L11-19 的 .group-header 元素
 * 目标：捕获修复 closeAllContextMenus 后可能出现的新的控制台报错
 * 策略：在应用最早阶段注入拦截器 + 多种触发方式
 */

import { test, ElectronApplication } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: any

test.describe('专门测试 - GroupHeader#L11-19 右击控制台报错', () => {
  test.beforeAll(async () => {
    // 启动应用（使用标准方式）
    const result = await startApp()
    electronApp = result.app
    page = result.page

    // 等待 DOM 加载完成（但不要等太久，尽早注入拦截器）
    await page.waitForLoadState('domcontentloaded')

    // 🔥 关键：在应用初始化的最早期注入拦截器
    // 在任何 Vue 组件挂载之前就设置好
    await page.evaluate(() => {
      // 创建全局存储
      (window as any).__CAPTURED_ERRORS__ = []

      // 拦截 console.error（使用 Object.defineProperty）
      const originalError = console.error.bind(console)
      console.error = function(...args: any[]) {
        const strArgs = args.map(arg => {
          if (arg instanceof Error) return `[Error] ${arg.message}\n${arg.stack}`
          return typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        }).join(' ')

        ;(window as any).__CAPTURED_ERRORS__.push({
          type: 'error',
          message: strArgs,
          timestamp: Date.now()
        })
        originalError.apply(console, args)
      }

      // 拦截 console.warn
      const originalWarn = console.warn.bind(console)
      console.warn = function(...args: any[]) {
        const message = args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ')

        ;(window as any).__CAPTURED_ERRORS__.push({
          type: 'warn',
          message: message,
          timestamp: Date.now()
        })
        originalWarn.apply(console, args)
      }

      // 拦截 console.log（记录所有日志）
      const originalLog = console.log.bind(console)
      console.log = function(...args: any[]) {
        const message = args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ')

        ;(window as any).__CAPTURED_ERRORS__.push({
          type: 'log',
          message: message,
          timestamp: Date.now()
        })
        originalLog.apply(console, args)
      }

      // 全局错误处理器
      window.onerror = function(message, source, lineno, colno, error) {
        (window as any).__CAPTURED_ERRORS__.push({
          type: 'WINDOW_ERROR',
          message: `${message}`,
          details: error ? `${error.name}: ${error.message}` : '',
          source: `${source}:${lineno}:${colno}`,
          timestamp: Date.now()
        })
        return false
      }

      // 未处理的 Promise rejection
      window.addEventListener('unhandledrejection', (event) => {
        (window as any).__CAPTURED_ERRORS__.push({
          type: 'UNHANDLED_REJECTION',
          message: event.reason ? `${event.reason.name || 'Error'}: ${event.reason.message || event.reason}` : 'Unknown',
          timestamp: Date.now()
        })
      })

      console.log('[CAPTURE] ✅ 拦截器已安装')
    })

    // 等待应用完全就绪
    await waitForAppReady(page)

    // 额外等待确保稳定
    await page.waitForTimeout(1000)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('步骤1：右击 .group-header 元素并收集所有控制台输出', async () => {
    console.log('\n' + '█'.repeat(80))
    console.log('🎯 开始：右击 GroupHeader#L11-19 并捕获控制台报错')
    console.log('█'.repeat(80))

    // 清空之前的记录
    await page.evaluate(() => {
      (window as any).__CAPTURED_ERRORS__ = []
    })

    console.log('✅ 已清空错误记录')

    // 等待一下让页面稳定
    await page.waitForTimeout(500)

    // 查找 .group-header 元素
    const headerLocator = page.locator('.group-header')
    const count = await headerLocator.count()

    console.log(`\n🔍 找到 ${count} 个 .group-header 元素`)

    if (count === 0) {
      console.log('❌ 未找到目标元素')
      return
    }

    // 获取第一个 GroupHeader 的信息
    const firstHeader = headerLocator.first()

    try {
      await firstHeader.waitFor({ state: 'attached', timeout: 3000 })
    } catch (e) {
      console.log('⚠️  元素未 attached')
    }

    const text = await firstHeader.textContent()
    const isVisible = await firstHeader.isVisible().catch(() => false)

    console.log(`✅ 目标: "${text?.trim()}"`)
    console.log(`   可见性: ${isVisible}`)

    // 执行右键点击
    console.log('\n🖱️  执行右键点击...')

    try {
      await firstHeader.click({
        button: 'right',
        force: true,
        timeout: 5000
      })
      console.log('✅ 右键点击成功')
    } catch (clickErr: any) {
      console.log(`⚠️  点击异常: ${clickErr.message}`)
    }

    // ⏳ 等待足够时间让错误传播
    console.log('\n⏳ 等待 3 秒...')
    await page.waitForTimeout(3000)

    // 📊 收集所有捕获到的输出
    const capturedData = await page.evaluate(() => {
      return (window as any).__CAPTURED_ERRORS__ || []
    })

    console.log('\n' + '█'.repeat(80))
    console.log('📊 完整捕获报告 - GroupHeader 右击后')
    console.log('█'.repeat(80))

    // 分类统计
    const errors = capturedData.filter((d: any) => d.type === 'error')
    const warnings = capturedData.filter((d: any) => d.type === 'warn')
    const logs = capturedData.filter((d: any) => d.type === 'log')
    const windowErrors = capturedData.filter((d: any) =>
      d.type === 'WINDOW_ERROR' || d.type === 'UNHANDLED_REJECTION'
    )

    console.log(`\n📈 统计:`)
    console.log(`   ❌ Errors: ${errors.length}`)
    console.log(`   ⚠️  Warnings: ${warnings.length}`)
    console.log(`   📝 Logs: ${logs.length} (仅显示相关)`)
    console.log(`   💥 Runtime Errors: ${windowErrors.length}`)

    // 输出所有 Errors
    if (errors.length > 0) {
      console.log('\n' + '-'.repeat(80))
      console.log('❌ Console Errors:')
      console.log('-'.repeat(80))
      errors.forEach((err: any, i: number) => {
        console.log(`\n[${i + 1}] ${err.message}`)

        // 标记关键信息
        if (err.message.includes('closeAllContextMenus')) {
          console.log('   👆 >>> "closeAllContextMenus" 相关!')
        }
        if (err.message.includes('is not defined')) {
          console.log('   👆 >>> 未定义函数/变量!')
        }
        if (err.message.includes('ReferenceError') || err.message.includes('TypeError')) {
          console.log('   👆 >>> JavaScript 错误!')
        }
        if (err.message.includes('Unhandled error during execution of component')) {
          console.log('   👆 >>> Vue 组件事件处理错误!')
        }
        if (err.message.includes('GroupHeader')) {
          console.log('   👆 >>> 与 GroupHeader 相关!')
        }
      })
    }

    // 输出所有 Warnings（重点！Vue warn 在这里）
    if (warnings.length > 0) {
      console.log('\n' + '-'.repeat(80))
      console.log('⚠️  Console Warnings (包含 Vue warn):')
      console.log('-'.repeat(80))
      warnings.forEach((warn: any, i: number) => {
        console.log(`\n[${i + 1}] ${warn.message}`)

        // 特别标记重要的警告
        if (warn.message.includes('[Vue warn]')) {
          console.log('   👆 >>> [Vue warn] 警告!')
        }
        if (warn.message.includes('Unhandled error during execution')) {
          console.log('   👆 >>> 未处理的组件事件错误!')
        }
        if (warn.message.includes('GroupHeader')) {
          console.log('   👆 >>> 与 GroupHeader 相关!')
        }
        if (warn.message.includes('contextmenu') || warn.message.includes('context-menu')) {
          console.log('   👆 >>> 右键菜单相关!')
        }
      })
    }

    // 输出运行时错误
    if (windowErrors.length > 0) {
      console.log('\n' + '-'.repeat(80))
      console.log('💥 Runtime Errors:')
      console.log('-'.repeat(80))
      windowErrors.forEach((we: any, i: number) => {
        console.log(`\n[${i + 1}] [${we.type}] ${we.message}`)
        if (we.details) {
          console.log(`   详情: ${we.details}`)
        }
        if (we.source) {
          console.log(`   来源: ${we.source}`)
        }
      })
    }

    // 输出相关的 Logs
    const relevantLogs = logs.filter((l: any) =>
      l.message.toLowerCase().includes('error') ||
      l.message.toLowerCase().includes('warn') ||
      l.message.includes('contextmenu') ||
      l.message.includes('context-menu') ||
      l.message.includes('groupheader') ||
      l.message.includes('group-header') ||
      l.message.includes('closeall')
    )

    if (relevantLogs.length > 0) {
      console.log('\n' + '-'.repeat(80))
      console.log('📝 相关的 Console Logs:')
      console.log('-'.repeat(80))
      relevantLogs.forEach((log: any, i: number) => {
        console.log(`[${i + 1}] ${log.message}`)
      })
    }

    // 最终汇总
    console.log('\n' + '█'.repeat(80))
    console.log('🎯 最终结果:')
    console.log('█'.repeat(80))

    const totalIssues = errors.length + warnings.length + windowErrors.length

    if (totalIssues > 0) {
      console.log(`\n✅ 成功捕获到 ${totalIssues} 个问题!`)
      console.log('   请查看上方详细信息以了解具体的 bug 内容。\n')

      // 输出原始数据供分析
      console.log('📋 原始数据（JSON 格式）:')
      const issuesOnly = [...errors, ...warnings, ...windowErrors]
      console.log(JSON.stringify(issuesOnly, null, 2))
    } else {
      console.log('\nℹ️  未捕获到任何问题')
      console.log('   可能原因:')
      console.log('   1. 修复后代码工作正常，无新错误')
      console.log('   2. 自动化环境与手动 dev 环境差异')
      console.log('   3. 错误被其他机制吞没\n')
    }

    console.log('█'.repeat(80))
  })
})
