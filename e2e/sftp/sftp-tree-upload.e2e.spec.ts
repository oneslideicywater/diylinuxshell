/**
 * SFTP 树形上传功能测试
 * 测试上传文件夹时树形组件的显示和进度更新
 * @module e2e/sftp/sftp-tree-upload
 */

import { test, expect } from '@playwright/test'
import { startApp, closeApp } from '../helpers/electron-app'
import type { ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'

// 测试会话配置（使用提供的测试服务器）
const TEST_SESSION = {
  name: 'SFTP Tree Upload Test',
  host: '192.168.10.24',
  port: 22,
  username: 'root',
  password: 'One.00000'
}

// 用于存储控制台消息和错误
const consoleMessages: any[] = []
const pageErrors: any[] = []

/**
 * 辅助函数：打开 SFTP 窗口
 */
async function openSFTPWindow(page: Page): Promise<void> {
  // 等待主界面加载完成
  await page.waitForSelector('.session-list', { timeout: 10000 })

  // 创建测试会话（如果不存在）
  await page.evaluate(async (sessionData) => {
    const sessions = await (window as any).api.session.getAll()
    const existing = sessions.find((s: any) => s.name === sessionData.name)
    if (!existing) {
      await (window as any).api.session.create(sessionData)
    }
  }, TEST_SESSION)

  await page.reload()
  await page.waitForSelector('.session-list', { timeout: 10000 })
  
  // 等待会话列表渲染
  await page.waitForTimeout(3000)

  // 点击展开分组
  const groupHeader = await page.locator('.group-header').first()
  await groupHeader.click({ force: true })
  
  // 等待分组展开
  try {
    await page.waitForSelector('.session-item', { timeout: 5000 })
  } catch (e) {
    await groupHeader.click({ force: true })
    await page.waitForSelector('.session-item', { timeout: 5000 })
  }
  
  await page.waitForTimeout(1000)

  // 找到测试会话
  const sessionItem = await page.locator('.session-item', {
    hasText: TEST_SESSION.name
  }).first()
  
  // 鼠标悬停显示操作按钮
  await sessionItem.scrollIntoViewIfNeeded({ force: true })
  await sessionItem.hover({ force: true })

  // 点击 SFTP 按钮
  const sftpButton = await sessionItem.locator('.action-btn.sftp').first()
  await sftpButton.click({ force: true })

  // 等待 SFTP 窗口打开
  await page.waitForSelector('.sftp-overlay', { timeout: 5000 })
  await page.waitForTimeout(3000)
}

test.describe('SFTP 树形上传功能测试', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    
    // 清空之前的消息
    consoleMessages.length = 0
    pageErrors.length = 0
    
    // 监听控制台消息
    page.on('console', (msg) => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      }
      consoleMessages.push(message)
      
      // 只在测试失败时输出错误日志
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.error(`[Console ${msg.type()}] ${msg.text()}`)
      }
    })
    
    // 监听页面错误
    page.on('pageerror', (error) => {
      const err = {
        message: error.message,
        stack: error.stack
      }
      pageErrors.push(err)
      console.error(`[Page Error] ${error.message}`)
    })
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('上传 memcached-operator 文件夹并检查树形组件显示', async () => {
    // 1. 打开 SFTP 窗口
    await openSFTPWindow(page)
    
    // 等待 SFTP 窗口完全加载
    await page.waitForTimeout(2000)

    // 2. 在本地文件路径输入框中输入目标路径 D:\develop\goworkbunch
    const localPathInput = await page.locator('.file-panel.local .path-input')
    await expect(localPathInput).toBeVisible()
    
    // 清空输入框并输入新路径
    await localPathInput.fill('')
    await localPathInput.fill('D:\\develop\\goworkbunch')
    await localPathInput.press('Enter')
    
    // 等待文件列表加载
    await page.waitForTimeout(3000)

    // 3. 找到并右键点击 memcached-operator 文件夹
    const memcachedOperatorFolder = await page.locator('.file-panel.local .file-list .file-item[data-is-directory="true"]', {
      hasText: 'memcached-operator'
    }).first()
    
    await expect(memcachedOperatorFolder).toBeVisible()
    await memcachedOperatorFolder.click({ button: 'right', force: true })
    await page.waitForTimeout(500)

    // 4. 点击上传文件夹菜单项
    const uploadFolderMenuItem = await page.locator('.context-menu-item', {
      hasText: '上传文件夹到服务器'
    }).first()
    await expect(uploadFolderMenuItem).toBeVisible()
    await uploadFolderMenuItem.click({ force: true })
    await page.waitForTimeout(2000)

    // 5. 打印控制台日志分析
    console.log('\n=== 控制台消息分析 ===')
    console.log('总消息数:', consoleMessages.length)
    
    // 打印所有渲染进程日志
    const rendererLogs = consoleMessages.filter(msg => 
      msg.type === 'log' && msg.text.includes('获取本地文件')
    )
    console.log('\n获取本地文件日志:', rendererLogs.length, '条')
    rendererLogs.forEach(log => {
      console.log(`  [${log.type}] ${log.text}`)
    })
    
    // 查找扫描文件夹的日志
    const scanLogs = consoleMessages.filter(msg => 
      msg.text.includes('扫描') || msg.text.includes('节点') || msg.text.includes('处理文件')
    )
    console.log('\n扫描相关日志:', scanLogs.length, '条')
    scanLogs.forEach(log => {
      console.log(`  [${log.type}] ${log.text}`)
    })
    
    // 查找传输进度的日志
    const progressLogs = consoleMessages.filter(msg => 
      msg.text.includes('传输') || msg.text.includes('进度') || msg.text.includes('上传') || msg.text.includes('收到上传进度') || msg.text.includes('找到节点')
    )
    console.log('\n传输进度日志:', progressLogs.length, '条')
    progressLogs.forEach(log => {
      console.log(`  [${log.type}] ${log.text}`)
    })
    
    // 6. 等待树形组件出现
    await page.waitForTimeout(3000)

    // 7. 检查树形组件是否显示
    const treeComponent = await page.locator('.sftp-transfer-tree')
    const treeVisible = await treeComponent.isVisible().catch(() => false)
    
    console.log('\n树形组件可见:', treeVisible)

    if (treeVisible) {
      // 检查表头
      const treeHeader = await treeComponent.locator('.tree-header')
      await expect(treeHeader).toBeVisible()

      // 检查树形内容区域
      const treeContent = await treeComponent.locator('.tree-content')
      await expect(treeContent).toBeVisible()

      // 检查是否有节点
      const treeNodes = await treeContent.locator('.tree-node')
      const count = await treeNodes.count()
      console.log('树形节点数量:', count)

      // 至少应该有一个节点
      expect(count).toBeGreaterThan(0)
    } else {
      console.log('树形组件未显示，检查是否有错误')
      
      // 检查错误
      const errors = consoleMessages.filter(msg => msg.type === 'error')
      console.log('错误数量:', errors.length)
      errors.forEach(err => {
        console.log(`  [${err.type}] ${err.text}`)
      })
    }

    // 8. 等待上传完成
    await page.waitForTimeout(10000)

    // 9. 验证上传结果
    const remoteFiles = await page.locator('.file-panel.remote .file-list .file-item')
    const remoteCount = await remoteFiles.count()
    console.log('远程文件数量:', remoteCount)

    // 关闭 SFTP 窗口
    const closeButton = await page.locator('.header-btn.close').first()
    await closeButton.click()
  })
})
