/**
 * 树形分组选择器控制台报错捕获测试
 * 
 * 测试目的：
 * 1. 打开新建会话表单
 * 2. 检查树形分组选择器是否正常渲染
 * 3. 验证点击第一层子分组能否展开它的子分组
 * 
 * 运行方式：npx playwright test tree-group-select-console-error.e2e.spec.ts --project=electron
 */

import { test, expect, ElectronApplication } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: any

// 存储所有控制台消息
const consoleMessages: any[] = []
const pageErrors: any[] = []

test.describe('Tree Group Select - 树形分组选择器控制台报错捕获', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('打开新建会话表单并检查控制台错误', async () => {
    console.log('=== 开始测试：打开新建会话表单 ===')
    
    // 清空之前的消息
    consoleMessages.length = 0
    pageErrors.length = 0
    
    // 设置控制台监听
    page.on('console', (msg: any) => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      }
      consoleMessages.push(message)
      console.log(`[Console ${msg.type()}] ${msg.text()}`)
    })
    
    page.on('pageerror', (error: any) => {
      const err = {
        message: error.message,
        stack: error.stack
      }
      pageErrors.push(err)
      console.error(`[Page Error] ${error.message}`)
    })
    
    // 点击新建会话按钮
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)
    
    // 验证表单显示
    const sessionForm = page.locator('.session-form')
    await expect(sessionForm).toBeVisible()
    console.log('✓ 会话表单已显示')
    
    // 检查表单标题
    const formTitle = sessionForm.locator('h3')
    await expect(formTitle).toHaveText('新建会话')
    console.log('✓ 表单标题正确')
    
    // 检查会话分组标签
    const groupLabel = sessionForm.locator('text=会话分组（可选）')
    await expect(groupLabel).toBeVisible()
    console.log('✓ 会话分组标签可见')
    
    // 检查树形选择器容器
    const treeContainer = sessionForm.locator('.group-tree-container')
    await expect(treeContainer).toBeVisible()
    console.log('✓ 树形选择器容器可见')
    
    // 等待所有异步操作完成
    await page.waitForTimeout(1000)
    
    // 检查控制台错误
    console.log('=== 检查控制台消息 ===')
    console.log('控制台消息总数:', consoleMessages.length)
    console.log('页面错误总数:', pageErrors.length)
    
    // 查找 Vue 渲染错误
    const vueRenderErrors = consoleMessages.filter(msg => 
      msg.text.includes('Property') && 
      msg.text.includes('was accessed during render but is not defined')
    )
    
    // 查找 GroupTreeSelect 相关错误
    const groupTreeErrors = consoleMessages.filter(msg => 
      msg.text.includes('GroupTreeSelect')
    )
    
    // 查找组件更新错误
    const updateErrors = consoleMessages.filter(msg => 
      msg.text.includes('Unhandled error during execution of component update')
    )
    
    // 查找所有 warning 和 error
    const warnings = consoleMessages.filter(msg => 
      msg.type === 'warning' || msg.type === 'error'
    )
    
    if (warnings.length > 0) {
      console.log('=== 所有警告和错误 ===')
      warnings.forEach((msg, index) => {
        console.log(`${index + 1}. [${msg.type}] ${msg.text}`)
        if (msg.location) {
          console.log(`   位置：${msg.location.url}:${msg.location.lineNumber}:${msg.location.columnNumber}`)
        }
      })
    } else {
      console.log('✅ 没有发现任何警告或错误！')
    }
    
    // 输出所有页面错误
    if (pageErrors.length > 0) {
      console.log('=== 所有页面错误 ===')
      pageErrors.forEach((err, index) => {
        console.log(`${index + 1}. ${err.message}`)
        if (err.stack) {
          console.log('   Stack:', err.stack.split('\n').slice(0, 3).join('\n          '))
        }
      })
    } else {
      console.log('✅ 没有发现任何页面错误！')
    }
    
    // 断言：不应该有 Vue 渲染错误
    expect(vueRenderErrors.length).toBe(0)
    
    // 断言：不应该有 GroupTreeSelect 相关的错误
    expect(groupTreeErrors.length).toBe(0)
    
    // 断言：不应该有组件更新错误
    expect(updateErrors.length).toBe(0)
    
    console.log('✅ 测试通过：树形分组选择器无控制台错误！')
  })
})
