/**
 * SFTP 取消上传功能测试
 * 测试在上传过程中取消上传的功能
 * @module e2e/sftp/cancel-upload
 */

import { test, expect } from '@playwright/test'
import { startApp, closeApp } from '../helpers/electron-app'
import type { ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// 测试会话配置（使用提供的测试服务器）
const TEST_SESSION = {
  name: 'SFTP Cancel Upload Test',
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

  // 点击展开分组 (点击 group-header 来展开)
  const groupHeader = await page.locator('.group-header').first()
  await groupHeader.click({ force: true })
  
  // 等待分组展开（等待 session-item 出现）
  try {
    await page.waitForSelector('.session-item', { timeout: 5000 })
  } catch (e) {
    console.log('第一次点击后未检测到会话项，尝试再次点击')
    await groupHeader.click({ force: true })
    await page.waitForSelector('.session-item', { timeout: 5000 })
  }
  
  await page.waitForTimeout(1000)

  // 找到测试会话
  const sessionItem = await page.locator('.session-item', {
    hasText: TEST_SESSION.name
  }).first()
  
  // 检查元素是否存在
  const count = await sessionItem.count()
  if (count === 0) {
    console.error('找不到会话:', TEST_SESSION.name)
    const allSessions = await page.locator('.session-item').allTextContents()
    console.error('所有会话:', allSessions)
    throw new Error('找不到测试会话')
  }
  
  // 鼠标悬停显示操作按钮
  await sessionItem.scrollIntoViewIfNeeded({ timeout: 5000 })
  await sessionItem.hover({ force: true })

  // 点击 SFTP 按钮
  const sftpButton = await sessionItem.locator('.action-btn.sftp').first()
  await sftpButton.click({ force: true })

  // 等待 SFTP 窗口打开
  await page.waitForSelector('.sftp-overlay', { timeout: 5000 })
  await page.waitForTimeout(3000)
}

/**
 * 辅助函数：创建测试文件夹和文件
 */
function createTestFolder(folderName: string, fileSizeMB: number = 10): { folderPath: string, fileNames: string[] } {
  const tempDir = os.tmpdir()
  const testFolderPath = path.join(tempDir, folderName)
  
  // 创建文件夹
  if (!fs.existsSync(testFolderPath)) {
    fs.mkdirSync(testFolderPath, { recursive: true })
  }
  
  const fileNames: string[] = []
  
  // 创建指定大小的文件
  const bufferSize = 1024 * 1024 // 1MB
  const buffer = Buffer.alloc(bufferSize, 'test data for cancel upload functionality')
  
  for (let i = 0; i < fileSizeMB; i++) {
    const fileName = `large_file_${i}.dat`
    const filePath = path.join(testFolderPath, fileName)
    fs.writeFileSync(filePath, buffer)
    fileNames.push(fileName)
  }
  
  return {
    folderPath: testFolderPath,
    fileNames
  }
}

/**
 * 辅助函数：清理测试文件
 */
function cleanupTestFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      if (fs.statSync(filePath).isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true })
      } else {
        fs.unlinkSync(filePath)
      }
    }
  } catch (e) {
    console.log('清理测试文件失败:', e)
  }
}

test.describe('SFTP 取消上传功能', () => {
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
    
    // 监听主进程输出
    app.process().stdout?.on('data', (data) => {
      console.log(`[Main Process] ${data.toString()}`)
    })
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  /**
   * 测试用例 1: 测试取消上传文件夹功能
   * 场景：上传一个大文件夹，在上传过程中点击取消按钮
   */
  test('应该能取消上传文件夹', async () => {
    const folderName = `cancel_test_folder_${Date.now()}`
    let testFolderPath: string | null = null
    
    try {
      // 打开 SFTP 窗口
      await openSFTPWindow(page)
      
      // 等待 SFTP 窗口完全加载
      await page.waitForTimeout(2000)

      // 创建测试文件夹（10MB 大小，足够慢以便能点击取消）
      const testData = createTestFolder(folderName, 10)
      testFolderPath = testData.folderPath
      
      console.log('创建测试文件夹:', testFolderPath)

      // 导航到临时文件夹
      const localPathInput = await page.locator('.file-panel.local .path-input').first()
      await localPathInput.click()
      await localPathInput.fill(testFolderPath)
      await localPathInput.press('Enter')
      await page.waitForTimeout(3000)

      // 验证文件列表已加载
      const localFileItems = page.locator('.file-panel.local .file-item')
      const localCount = await localFileItems.count()
      console.log('本地文件数量:', localCount)
      expect(localCount).toBeGreaterThan(0)

      // 右键点击文件夹（第一个文件）
      const folderItem = await localFileItems.first()
      await folderItem.click({ button: 'right', force: true })
      await page.waitForTimeout(1000)

      // 验证右键菜单显示
      const contextMenu = await page.locator('.context-menu')
      await expect(contextMenu).toBeVisible()

      // 点击"上传文件夹到服务器"菜单项
      const uploadFolderMenuItem = await page.locator('.context-menu-item', {
        hasText: '上传文件夹到服务器'
      })
      await uploadFolderMenuItem.click({ force: true })
      
      // 等待传输开始
      await page.waitForTimeout(3000)

      // 验证传输进度树显示
      const transferTree = await page.locator('.transfer-tree-container')
      await expect(transferTree).toBeVisible()

      // 验证取消按钮显示
      const cancelButton = await page.locator('.cancel-upload-btn')
      await expect(cancelButton).toBeVisible()

      // 等待一会儿，确保传输已经开始
      await page.waitForTimeout(2000)

      // 检查是否有正在传输的节点
      const transferringNodes = await page.locator('.tree-node .status-transferring')
      const transferringCount = await transferringNodes.count()
      console.log('正在传输的节点数:', transferringCount)

      // 点击取消按钮
      await cancelButton.click({ force: true })
      console.log('点击了取消按钮')
      
      // 等待取消生效
      await page.waitForTimeout(3000)

      // 验证节点状态变为已取消
      const cancelledNodes = await page.locator('.tree-node .status-cancelled')
      const cancelledCount = await cancelledNodes.count()
      console.log('已取消的节点数:', cancelledCount)

      // 应该至少有一个节点被取消
      expect(cancelledCount).toBeGreaterThan(0)

      // 验证取消按钮消失（因为传输已经停止）
      await expect(cancelButton).not.toBeVisible()

      console.log('取消上传测试成功')
      
    } catch (error: any) {
      console.error('取消上传测试失败:', error)
      throw error
    } finally {
      // 清理测试文件
      if (testFolderPath) {
        cleanupTestFile(testFolderPath)
      }
      
      // 关闭 SFTP 窗口
      try {
        const closeButton = await page.locator('.header-btn.close').first()
        await closeButton.click()
        await page.waitForTimeout(1000)
      } catch (e) {
        // 忽略关闭错误
      }
    }
  })

  /**
   * 测试用例 2: 测试取消按钮的 UI 交互
   */
  test('取消按钮应该有正确的 UI 样式和交互', async () => {
    const folderName = `ui_test_folder_${Date.now()}`
    let testFolderPath: string | null = null
    
    try {
      // 打开 SFTP 窗口
      await openSFTPWindow(page)
      await page.waitForTimeout(2000)

      // 创建测试文件夹
      const testData = createTestFolder(folderName, 5)
      testFolderPath = testData.folderPath

      // 导航到文件夹
      const localPathInput = await page.locator('.file-panel.local .path-input').first()
      await localPathInput.fill(testFolderPath)
      await localPathInput.press('Enter')
      await page.waitForTimeout(2000)

      // 右键点击文件夹开始上传
      const localFileItems = page.locator('.file-panel.local .file-item')
      const folderItem = await localFileItems.first()
      await folderItem.click({ button: 'right', force: true })
      await page.waitForTimeout(500)

      const uploadFolderMenuItem = await page.locator('.context-menu-item', {
        hasText: '上传文件夹到服务器'
      })
      await uploadFolderMenuItem.click({ force: true })
      
      // 等待传输开始
      await page.waitForTimeout(2000)

      // 验证取消按钮存在
      const cancelButton = await page.locator('.cancel-upload-btn')
      await expect(cancelButton).toBeVisible()

      // 验证取消按钮的文本
      const buttonText = await cancelButton.textContent()
      expect(buttonText).toContain('取消上传')

      // 验证取消按钮有图标
      const icon = await cancelButton.locator('svg')
      await expect(icon).toBeVisible()

      // 验证取消按钮的位置（应该在右上角）
      const buttonBox = await cancelButton.boundingBox()
      expect(buttonBox).not.toBeNull()
      
      if (buttonBox) {
        // 按钮应该在容器的右侧
        const container = await page.locator('.transfer-tree-container')
        const containerBox = await container.boundingBox()
        expect(containerBox).not.toBeNull()
        
        if (containerBox) {
          // 按钮的 right 应该接近容器的 right
          expect(buttonBox.x + buttonBox.width).toBeGreaterThan(containerBox.x + containerBox.width * 0.5)
        }
      }

      // 点击取消
      await cancelButton.click({ force: true })
      await page.waitForTimeout(1000)

      console.log('取消按钮 UI 测试成功')
      
    } catch (error: any) {
      console.error('取消按钮 UI 测试失败:', error)
      throw error
    } finally {
      // 清理测试文件
      if (testFolderPath) {
        cleanupTestFile(testFolderPath)
      }
      
      // 关闭 SFTP 窗口
      try {
        const closeButton = await page.locator('.header-btn.close').first()
        await closeButton.click()
        await page.waitForTimeout(1000)
      } catch (e) {
        // 忽略关闭错误
      }
    }
  })

  /**
   * 测试用例 3: 测试取消后节点状态显示
   */
  test('取消上传后节点状态应该显示为已取消', async () => {
    const folderName = `status_test_folder_${Date.now()}`
    let testFolderPath: string | null = null
    
    try {
      // 打开 SFTP 窗口
      await openSFTPWindow(page)
      await page.waitForTimeout(2000)

      // 创建测试文件夹
      const testData = createTestFolder(folderName, 5)
      testFolderPath = testData.folderPath

      // 导航到文件夹
      const localPathInput = await page.locator('.file-panel.local .path-input').first()
      await localPathInput.fill(testFolderPath)
      await localPathInput.press('Enter')
      await page.waitForTimeout(2000)

      // 右键点击文件夹开始上传
      const localFileItems = page.locator('.file-panel.local .file-item')
      const folderItem = await localFileItems.first()
      await folderItem.click({ button: 'right', force: true })
      await page.waitForTimeout(500)

      const uploadFolderMenuItem = await page.locator('.context-menu-item', {
        hasText: '上传文件夹到服务器'
      })
      await uploadFolderMenuItem.click({ force: true })
      
      // 等待传输开始
      await page.waitForTimeout(2000)

      // 点击取消
      const cancelButton = await page.locator('.cancel-upload-btn')
      await cancelButton.click({ force: true })
      await page.waitForTimeout(2000)

      // 验证节点状态
      const treeNodes = page.locator('.tree-node')
      const nodeCount = await treeNodes.count()
      console.log('总节点数:', nodeCount)

      // 检查是否有已取消状态的节点
      let hasCancelledNode = false
      const nodes = await treeNodes.all()
      
      for (const node of nodes) {
        const statusElement = await node.locator('.status-cancelled')
        const count = await statusElement.count()
        if (count > 0) {
          hasCancelledNode = true
          break
        }
      }

      expect(hasCancelledNode).toBe(true)

      // 验证没有正在传输的节点
      const transferringNodes = page.locator('.tree-node .status-transferring')
      const transferringCount = await transferringNodes.count()
      expect(transferringCount).toBe(0)

      console.log('节点状态测试成功')
      
    } catch (error: any) {
      console.error('节点状态测试失败:', error)
      throw error
    } finally {
      // 清理测试文件
      if (testFolderPath) {
        cleanupTestFile(testFolderPath)
      }
      
      // 关闭 SFTP 窗口
      try {
        const closeButton = await page.locator('.header-btn.close').first()
        await closeButton.click()
        await page.waitForTimeout(1000)
      } catch (e) {
        // 忽略关闭错误
      }
    }
  })

  /**
   * 测试用例 4: 测试右键菜单关闭功能
   */
  test('右键菜单应该能正常关闭', async () => {
    try {
      // 打开 SFTP 窗口
      await openSFTPWindow(page)
      await page.waitForTimeout(2000)

      // 右键点击本地文件列表
      const localFileList = await page.locator('.file-panel.local .file-list')
      await localFileList.click({ button: 'right', force: true })
      await page.waitForTimeout(500)

      // 验证右键菜单显示
      const contextMenu = await page.locator('.context-menu')
      await expect(contextMenu).toBeVisible()

      // 点击菜单外部区域关闭菜单
      const filePanel = await page.locator('.file-panel.local')
      await filePanel.click({ force: true })
      await page.waitForTimeout(500)

      // 验证菜单已关闭
      await expect(contextMenu).not.toBeVisible()

      console.log('右键菜单关闭测试成功')
      
    } catch (error: any) {
      console.error('右键菜单关闭测试失败:', error)
      throw error
    } finally {
      // 关闭 SFTP 窗口
      try {
        const closeButton = await page.locator('.header-btn.close').first()
        await closeButton.click()
        await page.waitForTimeout(1000)
      } catch (e) {
        // 忽略关闭错误
      }
    }
  })
})
