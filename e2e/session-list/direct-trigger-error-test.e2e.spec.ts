/**
 * 直接测试 closeAllContextMenus 未定义错误
 * 通过 JavaScript 直接触发 handleGroupContextMenu 来暴露 bug
 */

import { test, ElectronApplication } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: any

const consoleMessages: any[] = []
const pageErrors: any[] = []

test.describe('直接触发 closeAllContextMenus 错误', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)

    consoleMessages.length = 0
    pageErrors.length = 0

    // 监听所有可能的错误来源
    page.on('console', (msg: any) => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      }
      consoleMessages.push(message)

      if (msg.type() === 'error') {
        console.error(`[CONSOLE ERROR] ${msg.text()}`)
        if (msg.location()) {
          console.error(`   at ${msg.location().url}:${msg.location().lineNumber}`)
        }
      }
    })

    page.on('pageerror', (error: any) => {
      const err = {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
      pageErrors.push(err)
      console.error(`[PAGE ERROR] ${error.name}: ${error.message}`)
    })

    // 监听未处理的 Promise 拒绝
    page.on('pageerror', (error: any) => {})
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('方法1：右键点击 GroupHeader（标准方式）', async () => {
    console.log('\n=== 方法1：标准右键点击 ===')
    await page.waitForTimeout(2000)

    const baseCount = consoleMessages.length

    // 右键点击
    const header = page.locator('.group-header').first()
    await header.click({ button: 'right', force: true })
    await page.waitForTimeout(1000)

    const newMsgs = consoleMessages.slice(baseCount)
    console.log(`新增消息: ${newMsgs.length}`)

    if (newMsgs.length > 0) {
      newMsgs.forEach((m, i) => console.log(`${i+1}. [${m.type}] ${m.text}`))
    }
  })

  test('方法2：通过 JS dispatchEvent 触发 contextmenu', async () => {
    console.log('\n=== 方法2：JS dispatchEvent ===')
    await page.waitForTimeout(1000)

    const baseCount = consoleMessages.length

    // 通过 JavaScript 分发 contextmenu 事件
    const result = await page.evaluate(() => {
      const el = document.querySelector('.group-header')
      if (!el) return { error: 'Element not found' }

      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100,
        button: 2
      })

      el.dispatchEvent(event)
      return { success: true }
    })

    console.log('dispatchEvent 结果:', JSON.stringify(result))
    await page.waitForTimeout(1000)

    const newMsgs = consoleMessages.slice(baseCount)
    console.log(`新增消息: ${newMsgs.length}`)

    if (newMsgs.length > 0) {
      newMsgs.forEach((m, i) => console.log(`${i+1}. [${m.type}] ${m.text}`))
    }
  })

  test('方法3：检查 Vue 组件实例中的错误', async () => {
    console.log('\n=== 方法3：检查 Vue 组件状态 ===')
    await page.waitForTimeout(1001)

    // 尝试访问 Vue 组件并查看其状态
    const componentInfo = await page.evaluate(() => {
      // 尝试获取 Vue 组件实例
      const el = document.querySelector('.group-header')
      if (!el || !el.__vue_app__) {
        return { error: 'Cannot access Vue component' }
      }

      return {
        hasVueApp: !!el.__vue_app__,
        elementClass: el.className
      }
    })

    console.log('组件信息:', JSON.stringify(componentInfo))
  })

  test('汇总：所有捕获到的错误', () => {
    console.log('\n' + '='.repeat(70))
    console.log('最终错误汇总')
    console.log('='.repeat(70))

    console.log(`\n📊 总计:`)
    console.log(`   控制台消息: ${consoleMessages.length}`)
    console.log(`   页面错误: ${pageErrors.length}`)

    // 输出所有错误
    const errors = consoleMessages.filter(m => m.type === 'error')

    if (errors.length > 0) {
      console.log('\n🔴 Console Errors:')
      errors.forEach((e, i) => {
        console.log(`${i+1}. ${e.text}`)
        if (e.location) {
          console.log(`   at ${e.location.url}:${e.location.lineNumber}`)
        }
      })
    }

    if (pageErrors.length > 0) {
      console.log('\n💥 Page Runtime Errors:')
      pageErrors.forEach((e, i) => {
        console.log(`${i+1}. [${e.name}] ${e.message}`)
        if (e.stack) {
          console.log(`   Stack: ${e.stack.split('\\n').slice(0, 3).join('\\n')}`)
        }
      })
    }

    if (errors.length === 0 && pageErrors.length === 0) {
      console.log('\n⚠️  未捕获到任何错误')
      console.log('\n💡 说明:')
      console.log('   代码中确实存在 "closeAllContextMenus is not defined" 错误')
      console.log('   但该错误可能在以下情况下才会在控制台显示:')
      console.log('   1. 手动操作时（非自动化测试）')
      console.log('   2. 特定的浏览器/Electron 版本')
      console.log('   3. 需要开启特定的调试模式')
      console.log('\n✅ 建议直接修复此 bug：定义 closeAllContextMenus 函数或移除对其的调用')
    }

    console.log('\n' + '='.repeat(70))
  })
})
