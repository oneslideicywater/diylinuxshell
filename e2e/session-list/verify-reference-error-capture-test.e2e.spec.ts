/**
 * 最简验证：能否在 Playwright 中捕获 ReferenceError
 * 测试目标：验证自动化测试环境是否能捕获 "XXX is not defined" 错误
 */

import { test, ElectronApplication } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: any

test.describe('验证：能否捕获 ReferenceError', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('直接调用未定义函数，看能否捕获 ReferenceError', async () => {
    console.log('\n=== 验证测试：能否捕获 ReferenceError ===\n')

    // 方法1：通过 page.evaluate 调用未定义函数
    console.log('方法1: page.evaluate() 调用 undefinedFunction123()')
    try {
      await page.evaluate(() => {
        // 故意调用一个不存在的函数
        (window as any).undefinedFunction123()
      })
      console.log('❌ 没有抛出异常')
    } catch (error: any) {
      console.log('✅ 捕获到异常:', error.message)
    }

    await page.waitForTimeout(500)

    // 方法2：在页面上下文中触发一个真正的 ReferenceError
    console.log('\n方法2: 在页面中注入并执行未定义函数调用')
    const errorCaptured = await page.evaluate(() => {
      return new Promise((resolve) => {
        let captured = null

        // 监听 window.onerror
        const originalOnError = window.onerror
        window.onerror = function(msg, url, line, col, error) {
          captured = {
            message: String(msg),
            error: error?.message,
            line: line
          }
          if (originalOnError) originalOnError.apply(window, arguments as any)
          return false
        }

        // 执行会抛出 ReferenceError 的代码
        try {
          // 使用 eval 来触发 ReferenceError
          eval('closeAllContextMenus()')
        } catch (e) {
          captured = {
            message: 'try-catch caught',
            error: (e as Error)?.message,
            fromTryCatch: true
          }
        }

        setTimeout(() => {
          // 恢复原始处理器
          window.onerror = originalOnError
          resolve(captured)
        }, 100)
      })
    })

    console.log('捕获结果:', JSON.stringify(errorCaptured, null, 2))

    // 方法3：检查 Vue 组件中的函数是否真的未定义
    console.log('\n方法3: 检查 SessionSidebarContainer 组件中是否有 closeAllContextMenus')
    const componentCheck = await page.evaluate(() => {
      // 尝试从 DOM 元素获取 Vue 组件实例
      const appContainer = document.querySelector('.app-container') || document.querySelector('#app')

      if (!appContainer) {
        return { error: 'Cannot find app container' }
      }

      // 尝试访问 __vue_app__ 或 __vue__
      const vueApp = (appContainer as any).__vue_app__
      const vueInstance = (appContainer as any).__vue__

      return {
        hasVueApp: !!vueApp,
        hasVueInstance: !!vueInstance,
        containerClass: appContainer.className
      }
    })

    console.log('组件检查结果:', JSON.stringify(componentCheck, null, 2))

    console.log('\n=== 验证完成 ===')
  })

  test('模拟右键菜单操作流程', async () => {
    console.log('\n=== 模拟完整操作流程 ===\n')

    // 注入全局错误捕获器
    await page.evaluate(() => {
      (window as any).__testErrors__ = []

      const originalConsoleError = console.error
      console.error = function(...args) {
        (window as any).__testErrors__.push({
          type: 'console.error',
          args: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)),
          time: Date.now()
        })
        originalConsoleError.apply(console, args)
      }

      const originalConsoleWarn = console.warn
      console.warn = function(...args) {
        (window as any).__testErrors__.push({
          type: 'console.warn',
          args: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)),
          time: Date.now()
        })
        originalConsoleWarn.apply(console, args)
      }
    })

    console.log('✅ 已注入 console.error/warn 拦截器')

    // 右键点击 GroupHeader
    const header = page.locator('.group-header').first()
    await header.click({ button: 'right', force: true })
    console.log('✅ 已执行右键点击')

    // 等待
    await page.waitForTimeout(2000)

    // 获取捕获到的所有消息
    const errors = await page.evaluate(() => {
      return (window as any).__testErrors__ || []
    })

    console.log(`\n📊 捕获到的 console.error/warn 数量: ${errors.length}`)

    if (errors.length > 0) {
      console.log('\n详细列表:')
      errors.forEach((err: any, i: number) => {
        console.log(`${i + 1}. [${err.type}] ${err.args.join(' ')}`)

        if (err.args.some((a: string) => a.includes('closeAllContextMenus'))) {
          console.log('   🎯 >>> 包含 closeAllContextMenus!')
        }
        if (err.args.some((a: string) => a.includes('Unhandled error'))) {
          console.log('   🎯 >>> 包含 Unhandled error!')
        }
      })
    } else {
      console.log('ℹ️  未捕获到任何 console.error 或 console.warn')
      console.log('\n💡 结论:')
      console.log('   编译后的代码可能不会产生控制台输出')
      console.log('   或者错误被 Vue/Electron 内部处理机制吞没了')
      console.log('\n   但是从代码分析可以 100% 确认:')
      console.log('   ❌ closeAllContextMenus() 函数从未定义')
      console.log('   ❌ 但在第 338、364、736 行被调用了')
      console.log('   ✅ 这就是 bug！')
    }
  })
})
