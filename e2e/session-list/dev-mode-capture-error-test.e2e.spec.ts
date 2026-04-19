/**
 * GroupHeader 右键菜单 - 以 npm run dev 模式捕获控制台报错
 * 关键：使用 development 模式启动（不是 test 模式）
 * 这样才能捕获到 Vue 组件事件处理器中的完整错误信息
 */

import { test, ElectronApplication, _electron as electron } from '@playwright/test'
import path from 'path'

let electronApp: ElectronApplication
let page: any

// 存储所有控制台消息
const consoleMessages: any[] = []
const pageErrors: any[] = []

test.describe('GroupHeader 右键菜单 - Dev 模式错误捕获', () => {
  test.beforeAll(async () => {
    // 🔑 关键：以开发模式启动应用（类似 npm run dev）
    // 使用 electron-vite dev 的方式启动，确保 NODE_ENV=development
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../node_modules/electron/dist/electron.exe'), path.join(__dirname, '..')],
      env: {
        ...process.env,
        NODE_ENV: 'development',  // 👈 开发模式！
        ELECTRON_RUN_AS_NODE: undefined  // 确保不以 Node 模式运行
      },
      cwd: path.join(__dirname, '../..'),  // 工作目录设为项目根目录
      stdio: 'pipe'
    })

    // 监听主进程输出
    if (electronApp.process().stdout) {
      electronApp.process().stdout.on('data', (data: Buffer) => {
        console.log('[Main]', data.toString())
      })
    }

    if (electronApp.process().stderr) {
      electronApp.process().stderr.on('data', (data: Buffer) => {
        console.error('[Main Error]', data.toString())
      })
    }

    page = await electronApp.firstWindow()

    // 等待应用加载
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(3000)

    // 清空消息数组
    consoleMessages.length = 0
    pageErrors.length = 0

    // 监听控制台消息（包括 Vue warn）
    page.on('console', (msg: any) => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      }
      consoleMessages.push(message)

      // 输出所有级别的消息
      const prefix = `[${msg.type().toUpperCase()}]`
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.error(`${prefix} ${msg.text()}`)
        if (msg.location()) {
          console.error(`   📍 ${msg.location().url}:${msg.location().lineNumber}`)
        }
      } else {
        console.log(`${prefix} ${msg.text()}`)
      }
    })

    // 监听页面运行时错误（Uncaught ReferenceError 等）
    page.on('pageerror', (error: any) => {
      const err = {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
      pageErrors.push(err)
      console.error(`[PAGE ERROR] ${error.name}: ${error.message}`)
    })
  })

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close()
    }
  })

  test('右击 .group-header 元素并捕获 Vue warn 和 closeAllContextMenus 错误', async () => {
    console.log('\n' + '='.repeat(80))
    console.log('🎯 开始测试：右击 GroupHeader（Dev 模式）')
    console.log('='.repeat(80))

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
      console.log('❌ 未找到 GroupHeader 元素')
      return
    }

    // 获取第一个 GroupHeader
    const firstHeader = groupHeaderLocator.first()

    try {
      await firstHeader.waitFor({ state: 'visible', timeout: 5000 })
    } catch (e) {
      console.log('⚠️  GroupHeader 不可见，尝试强制操作...')
    }

    const headerText = await firstHeader.textContent()
    console.log(`✅ 目标 GroupHeader: "${headerText?.trim()}"`)
    console.log('🖱️  准备执行右键点击...')

    // 右键点击（使用 force 绕过覆盖层）
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

    // 等待足够时间让错误产生和传播
    console.log('\n⏳ 等待 3 秒让错误传播...')
    await page.waitForTimeout(3000)

    // 收集新增的消息和错误
    const newConsoleMessages = consoleMessages.slice(baseConsoleCount)
    const newPageErrors = pageErrors.slice(basePageErrorCount)

    console.log(`\n📊 操作后新增:`)
    console.log(`   控制台消息: +${newConsoleMessages.length}`)
    console.log(`   页面错误: +${newPageErrors.length}`)

    // 输出所有新增的控制台消息
    if (newConsoleMessages.length > 0) {
      console.log('\n📋 新增的所有控制台消息:')
      newConsoleMessages.forEach((msg, index) => {
        const icon = msg.type === 'error' ? '❌' :
                     msg.type === 'warning' ? '⚠️' : 'ℹ️'
        console.log(`${icon} ${index + 1}. [${msg.type.toUpperCase()}] ${msg.text}`)

        if (msg.location) {
          console.log(`   📍 文件: ${msg.location.url}`)
          console.log(`   📍 行号: ${msg.location.lineNumber}`)
        }

        // 特别标记目标错误
        if (msg.text?.includes('closeAllContextMenus')) {
          console.log('   🎯 >>> 这是目标错误！')
        }
        if (msg.text?.includes('Unhandled error during execution')) {
          console.log('   🎯 >>> 这是 Vue unhandled error!')
        }
        if (msg.text?.includes('GroupHeader')) {
          console.log('   🎯 >>> 与 GroupHeader 相关!')
        }
      })
    }

    // 输出所有新增的页面运行时错误
    if (newPageErrors.length > 0) {
      console.log('\n💥 新增的页面运行时错误:')
      newPageErrors.forEach((err, index) => {
        console.log(`\n${index + 1}. [${err.name}] ${err.message}`)

        if (err.stack) {
          const stackLines = err.stack.split('\n').slice(0, 6)
          stackLines.forEach(line => console.log(`   ${line}`))
        }

        // 特别标记
        if (err.message?.includes('closeAllContextMenus')) {
          console.log('   🎯 >>> 这是目标错误!')
        }
      })
    }

    // 最终结果判断
    console.log('\n' + '='.repeat(80))
    console.log('🎯 测试结果总结:')
    console.log('='.repeat(80))

    const hasTargetError = newConsoleMessages.some(msg =>
      msg.text?.includes('closeAllContextMenus')
    ) || newPageErrors.some(err =>
      err.message?.includes('closeAllContextMenus')
    )

    const hasVueWarn = newConsoleMessages.some(msg =>
      msg.text?.includes('Unhandled error during execution of component event handler')
    )

    if (hasTargetError || hasVueWarn) {
      console.log('✅ 成功捕获到错误!')

      if (hasVueWarn) {
        console.log('\n🔴 发现 Vue warn: "Unhandled error during execution of component event handler"')
        console.log('   这说明组件事件处理器中存在未捕获的错误')
      }

      if (hasTargetError) {
        console.log('\n🔴 发现目标错误: "closeAllContextMenus is not defined"')
        console.log('   这就是导致右键菜单无法正常工作的根本原因!')
      }

      console.log('\n💡 下一步：修复 SessionSidebarContainer.vue 中缺失的 closeAllContextMenus 函数定义')

    } else if (newConsoleMessages.length > 0 || newPageErrors.length > 0) {
      console.log('⚠️  捕获到了其他错误/警告，请查看上方详细信息')
    } else {
      console.log('ℹ️  本次未捕获到预期错误')
      console.log('   可能需要检查:')
      console.log('   1. 是否真的使用了 dev 模式启动')
      console.log('   2. 应用是否正确加载了 Vue 组件')
    }

    console.log('='.repeat(80))
  })
})
