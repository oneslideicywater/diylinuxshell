/**
 * GroupHeader 右键菜单 - 捕获 closeAllContextMenus 错误
 * 目标：右击 GroupHeader.vue#L11-18 的 .group-header 元素
 * 预期：捕获到 "closeAllContextMenus is not defined" 错误
 */

import { test, ElectronApplication } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: any

// 存储控制台消息
const consoleMessages: any[] = []
const pageErrors: any[] = []

test.describe('GroupHeader 右键菜单错误捕获', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)

    // 清空消息数组
    consoleMessages.length = 0
    pageErrors.length = 0

    // 监听控制台消息
    page.on('console', (msg: any) => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      }
      consoleMessages.push(message)

      if (msg.type() === 'error') {
        console.error(`[Console Error] ${msg.text()}`)
      }
    })

    // 监听页面运行时错误
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

  test('右击 GroupHeader 并捕获控制台报错', async () => {
    console.log('\n=== 开始右击 GroupHeader 测试 ===')

    // 等待页面加载完成
    await page.waitForTimeout(2000)

    // 记录操作前的消息数量
    const messagesBeforeRightClick = consoleMessages.length
    const errorsBeforeRightClick = pageErrors.length

    console.log(`📊 操作前 - 控制台消息: ${messagesBeforeRightClick}, 页面错误: ${errorsBeforeRightClick}`)

    // 查找 GroupHeader 元素 (.group-header)
    const groupHeaderExists = await page.locator('.group-header').count()
    console.log(`🔍 找到 ${groupHeaderExists} 个 GroupHeader`)

    if (groupHeaderExists > 0) {
      // 获取第一个 GroupHeader
      const firstGroupHeader = page.locator('.group-header').first()

      // 确保元素可见
      await firstGroupHeader.waitFor({ state: 'visible', timeout: 5000 })

      console.log('✅ GroupHeader 已就绪，准备右击...')

      // 右键点击 GroupHeader（使用 force 绕过覆盖层问题）
      try {
        await firstGroupHeader.click({
          button: 'right',
          force: true,
          timeout: 5000
        })
        console.log('✅ 成功右击 GroupHeader')
      } catch (clickError: any) {
        console.log(`⚠️  右击遇到问题: ${clickError.message}`)
        console.log('   但继续检查是否触发了错误...')
      }

      // 等待错误产生
      await page.waitForTimeout(1000)

      // 收集新增的消息和错误
      const newMessages = consoleMessages.slice(messagesBeforeRightClick)
      const newPageErrors = pageErrors.slice(errorsBeforeRightClick)

      console.log(`\n📊 操作后统计:`)
      console.log(`   新增控制台消息: ${newMessages.length}`)
      console.log(`   新增页面错误: ${newPageErrors.length}`)

      // 输出所有新增的控制台消息
      if (newMessages.length > 0) {
        console.log('\n📋 新增的控制台消息:')
        newMessages.forEach((msg, index) => {
          console.log(`${index + 1}. [${msg.type}] ${msg.text}`)
          if (msg.location) {
            console.log(`   📍 ${msg.location.url}:${msg.location.lineNumber}`)
          }
        })
      }

      // 特别查找 "closeAllContextMenus" 相关错误
      const targetError = newMessages.find(msg =>
        msg.text?.includes('closeAllContextMenus') ||
        msg.type === 'error'
      )

      if (targetError) {
        console.log('\n🎯 找到目标错误:')
        console.log(`   [${targetError.type}] ${targetError.text}`)
        if (targetError.location) {
          console.log(`   📍 文件: ${targetError.location.url}`)
          console.log(`   📍 行号: ${targetError.location.lineNumber}`)
        }
      }

      // 输出所有页面运行时错误
      if (newPageErrors.length > 0) {
        console.log('\n💥 新增的页面运行时错误:')
        newPageErrors.forEach((err, index) => {
          console.log(`${index + 1}. ${err.message}`)
          if (err.stack) {
            console.log(`   堆栈: ${err.stack.split('\\n').slice(0, 5).join('\\n')}`)
          }
        })
      }

      // 最终验证：是否捕获到了 "closeAllContextMenus is not defined" 错误
      const hasTargetError = newMessages.some(msg =>
        msg.text?.includes('closeAllContextMenus')
      ) || newPageErrors.some(err =>
        err.message?.includes('closeAllContextMenus')
      )

      console.log('\n' + '='.repeat(60))
      if (hasTargetError) {
        console.log('✅ 成功捕获到 "closeAllContextMenus is not defined" 错误')
        console.log('   这就是导致右键菜单无法正常工作的原因！')
      } else {
        console.log('⚠️  未捕获到目标错误，但可能捕获了其他错误信息')
      }
      console.log('='.repeat(60))

    } else {
      console.log('❌ 未找到 GroupHeader 元素')
    }
  })

  test('汇总所有捕获到的错误信息', async () => {
    console.log('\n=== 最终汇总 ===')

    // 过滤出所有错误级别的消息
    const allErrors = consoleMessages.filter(msg => msg.type === 'error')

    console.log(`\n📊 总体统计:`)
    console.log(`   控制台总消息数: ${consoleMessages.length}`)
    console.log(`   其中错误数: ${allErrors.length}`)
    console.log(`   页面运行时错误数: ${pageErrors.length}`)

    if (allErrors.length > 0 || pageErrors.length > 0) {
      console.log('\n🔴 所有错误详情:')

      allErrors.forEach((msg, index) => {
        console.log(`\n${index + 1}. [Console Error]`)
        console.log(`   消息: ${msg.text}`)
        if (msg.location) {
          console.log(`   位置: ${msg.location.url}:${msg.location.lineNumber}`)
        }
      })

      pageErrors.forEach((err, index) => {
        console.log(`\n${allErrors.length + index + 1}. [Runtime Error]`)
        console.log(`   消息: ${err.message}`)
        if (err.stack) {
          console.log(`   堆栈: ${err.stack.split('\\n').slice(0, 3).join('\\n')}`)
        }
      })
    } else {
      console.log('\n✅ 未捕获到任何错误')
    }
  })
})
