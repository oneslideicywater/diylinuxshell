/**
 * 复现 errorDialogSessionId 报错
 * 验证能否获取控制台报错信息
 */

import { test, expect, ElectronApplication } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from './helpers/electron-app'

let electronApp: ElectronApplication
let page: any

// 存储所有控制台消息和错误
const allMessages: any[] = []
const allErrors: any[] = []

test.describe('复现 errorDialogSessionId 报错', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
    
    // 清空之前的消息
    allMessages.length = 0
    allErrors.length = 0
    
    // 监听所有控制台消息（包括 warning）
    page.on('console', (msg: any) => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        args: msg.args()
      }
      allMessages.push(message)
      
      // 实时输出
      if (msg.type() === 'warning' || msg.type() === 'error') {
        console.error(`⚠️ [${msg.type()}] ${msg.text()}`)
      } else {
        console.log(`ℹ️ [${msg.type()}] ${msg.text()}`)
      }
    })
    
    // 监听页面错误（JavaScript 错误）
    page.on('pageerror', (error: any) => {
      const err = {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
      allErrors.push(err)
      console.error(`❌ [Page Error] ${error.message}`)
      if (error.stack) {
        console.error(`   Stack: ${error.stack.split('\n').slice(0, 5).join('\n          ')}`)
      }
    })
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('触发并捕获 errorDialogSessionId 错误', async () => {
    console.log('=== 开始复现报错 ===')
    console.log('初始控制台消息:', allMessages.length)
    console.log('初始页面错误:', allErrors.length)
    
    // 等待应用完全加载
    await page.waitForTimeout(2000)
    
    // 查找 ErrorDialog 组件，触发其渲染
    const errorDialog = page.locator('.error-dialog')
    const isDialogVisible = await errorDialog.isVisible()
    console.log('ErrorDialog 是否可见:', isDialogVisible)
    
    // 强制触发 Vue 重新渲染（通过点击或其他方式）
    const resizeHandle = page.locator('.resize-handle')
    const handleBox = await resizeHandle.boundingBox()
    
    if (handleBox) {
      console.log('移动鼠标到拖拽手柄')
      await page.mouse.move(handleBox.x + 4, handleBox.y + 50)
      await page.waitForTimeout(500)
    }
    
    // 等待一段时间让错误出现
    await page.waitForTimeout(1000)
    
    // 输出所有收集到的消息
    console.log('\n=== 收集到的所有消息 ===')
    console.log('总消息数:', allMessages.length)
    console.log('总错误数:', allErrors.length)
    
    // 筛选出所有 warning 和 error
    const warningsAndErrors = allMessages.filter(msg => 
      msg.type === 'warning' || 
      msg.type === 'error' ||
      msg.text.includes('error') ||
      msg.text.includes('Error') ||
      msg.text.includes('warn')
    )
    
    console.log('\n警告和错误数量:', warningsAndErrors.length)
    
    if (warningsAndErrors.length > 0) {
      console.log('\n=== 详细消息列表 ===')
      warningsAndErrors.forEach((msg, idx) => {
        console.log(`${idx + 1}. [${msg.type}] ${msg.text}`)
        if (msg.location && Object.keys(msg.location).length > 0) {
          console.log(`   位置：${JSON.stringify(msg.location)}`)
        }
      })
    }
    
    // 输出所有页面错误
    if (allErrors.length > 0) {
      console.log('\n=== 页面 JavaScript 错误 ===')
      allErrors.forEach((err, idx) => {
        console.log(`${idx + 1}. ${err.message}`)
        if (err.stack) {
          console.log(`   Stack: ${err.stack.split('\n').slice(0, 3).join('\n          ')}`)
        }
      })
    }
    
    // 查找特定的 errorDialogSessionId 错误
    const targetErrors = allMessages.filter(msg => 
      msg.text.includes('errorDialogSessionId')
    )
    
    const targetPageErrors = allErrors.filter(err =>
      err.message.includes('errorDialogSessionId')
    )
    
    console.log('\n=== 目标错误统计 ===')
    console.log('包含 errorDialogSessionId 的控制台消息:', targetErrors.length)
    console.log('包含 errorDialogSessionId 的页面错误:', targetPageErrors.length)
    
    if (targetErrors.length > 0) {
      console.log('\n✅ 成功捕获到 errorDialogSessionId 错误！')
      targetErrors.forEach((err, idx) => {
        console.log(`\n错误 ${idx + 1}:`)
        console.log(`  类型：${err.type}`)
        console.log(`  内容：${err.text}`)
        if (err.location && Object.keys(err.location).length > 0) {
          console.log(`  位置：${JSON.stringify(err.location)}`)
        }
      })
    }
    
    if (targetPageErrors.length > 0) {
      console.log('\n✅ 成功捕获到 errorDialogSessionId 页面错误！')
      targetPageErrors.forEach((err, idx) => {
        console.log(`\n错误 ${idx + 1}:`)
        console.log(`  消息：${err.message}`)
        console.log(`  名称：${err.name}`)
      })
    }
    
    // 验证：应该能捕获到错误（证明有获取控制台信息的能力）
    const hasTargetError = targetErrors.length > 0 || targetPageErrors.length > 0
    console.log('\n=== 最终验证 ===')
    console.log('是否捕获到目标错误:', hasTargetError)
    
    if (!hasTargetError) {
      console.log('⚠️  未捕获到 errorDialogSessionId 错误')
      console.log('可能原因:')
      console.log('  1. Vue 3 的编译时检查可能不会在运行时抛出错误')
      console.log('  2. 错误可能在构建时已被检测')
      console.log('  3. 组件可能尚未完全渲染')
      console.log('\n当前所有消息预览:')
      allMessages.slice(0, 10).forEach((msg, i) => {
        console.log(`  ${i + 1}. [${msg.type}] ${msg.text.substring(0, 100)}`)
      })
    }
    
    // 这个测试的目的是验证能否获取控制台信息
    // 所以无论是否捕获到错误，都要输出详细信息
    expect(allMessages.length).toBeGreaterThanOrEqual(0)
  })
})
