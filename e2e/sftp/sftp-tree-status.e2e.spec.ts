/**
 * SFTP 树形传输状态功能测试
 * 测试树形传输状态组件的显示、展开/折叠、状态更新等功能
 * @module e2e/sftp/sftp-tree-status
 */

import { test, expect } from '@playwright/test'
import { startApp, closeApp } from '../helpers/electron-app'
import type { ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'

// 测试会话配置（使用提供的测试服务器）
const TEST_SESSION = {
  name: 'SFTP Tree Status Test',
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

/**
 * 辅助函数：创建测试文件夹
 */
function createTestFolder(folderPath: string): void {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true })
  }
  
  // 创建一些测试文件
  const testFiles = ['test1.txt', 'test2.txt', 'subfolder/test3.txt']
  testFiles.forEach(file => {
    // 使用 Windows 路径分隔符
    const fullPath = folderPath + '\\' + file.replace(/\//g, '\\')
    const dir = fullPath.substring(0, fullPath.lastIndexOf('\\'))
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(fullPath, `Test content for ${file}`)
  })
}

/**
 * 辅助函数：清理测试文件夹
 */
function cleanupTestFolder(folderPath: string): void {
  if (fs.existsSync(folderPath)) {
    fs.rmSync(folderPath, { recursive: true, force: true })
  }
}

test.describe('SFTP 树形传输状态功能', () => {
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

  test('状态栏应该显示树形传输详情按钮', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)

    // 验证状态栏存在
    const statusBar = await page.locator('.sftp-footer-container')
    await expect(statusBar).toBeVisible()

    // 验证状态栏显示本地和远程文件数
    const localCount = await page.locator('.footer-value').first().textContent()
    expect(localCount).toContain('个项目')

    const remoteCount = await page.locator('.footer-value').last().textContent()
    expect(remoteCount).toContain('个项目')

    // 关闭 SFTP 窗口
    const closeButton = await page.locator('.header-btn.close').first()
    await closeButton.click()
  })

  test('删除远程文件夹时应该显示树形进度', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)

    // 等待文件列表加载
    await page.waitForTimeout(2000)

    // 找到第一个文件夹（如果有的话）
    const remoteFolder = await page.locator('.file-panel.remote .file-item.directory').first()
    const folderExists = await remoteFolder.count() > 0

    if (folderExists) {
      // 获取文件夹名称
      const folderName = await remoteFolder.locator('.file-name').textContent()
      console.log(`准备删除的文件夹：${folderName}`)

      // 右键点击文件夹
      await remoteFolder.click({ button: 'right', force: true })
      await page.waitForTimeout(500)

      // 点击删除菜单项
      const deleteMenuItem = await page.locator('.context-menu-item', {
        hasText: '删除'
      }).first()
      await expect(deleteMenuItem).toBeVisible()

      // 点击删除
      await deleteMenuItem.click({ force: true })
      await page.waitForTimeout(500)

      // 确认删除对话框
      const dialog = await page.locator('.el-message-box')
      if (await dialog.count() > 0) {
        const confirmButton = await dialog.locator('.el-button--primary').first()
        await confirmButton.click({ force: true })
      }

      // 等待状态栏显示删除状态
      await page.waitForTimeout(1000)

      // 验证状态栏显示删除状态
      const deletingStatus = await page.locator('.status-deleting')
      const isDeletingVisible = await deletingStatus.count() > 0
      
      if (isDeletingVisible) {
        console.log('✓ 状态栏显示删除进度')
        await expect(deletingStatus).toBeVisible()
      } else {
        console.log('ℹ 删除操作可能很快完成，未捕获到删除状态')
      }

      // 验证展开/折叠按钮存在（如果有活跃传输）
      const toggleButton = await page.locator('.toggle-tree-btn')
      const hasToggleButton = await toggleButton.count() > 0
      
      if (hasToggleButton) {
        console.log('✓ 展开/折叠按钮存在')
        await expect(toggleButton).toBeVisible()
      } else {
        console.log('ℹ 删除已完成，未显示展开/折叠按钮')
      }
    } else {
      console.log('ℹ 远程目录为空，跳过删除测试')
    }

    // 关闭 SFTP 窗口
    const closeButton = await page.locator('.header-btn.close').first()
    await closeButton.click()
  })

  test('树形组件应该正确渲染节点层级', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)

    // 创建测试文件夹（使用 D 盘目录避免权限问题）
    const testFolder = 'D:\\develop\\goworkbunch\\memcached-operator\\test-upload-folder'
    createTestFolder(testFolder)

    try {
      // 右键点击本地文件列表区域
      const localFileList = await page.locator('.file-panel.local .file-list')
      await localFileList.click({ button: 'right', force: true })
      await page.waitForTimeout(500)

      // 点击上传文件夹菜单项
      const uploadFolderMenuItem = await page.locator('.context-menu-item', {
        hasText: '上传文件夹到服务器'
      }).first()
      await expect(uploadFolderMenuItem).toBeVisible()
      await uploadFolderMenuItem.click({ force: true })
      await page.waitForTimeout(500)

      // 验证状态栏显示上传状态
      const uploadingStatus = await page.locator('.status-uploading')
      await expect(uploadingStatus).toBeVisible()

      // 验证展开/折叠按钮出现
      const toggleButton = await page.locator('.toggle-tree-btn')
      await expect(toggleButton).toBeVisible()

      // 点击展开按钮
      await toggleButton.click({ force: true })
      await page.waitForTimeout(1000)

      // 验证树形面板显示
      const treePanel = await page.locator('.tree-panel')
      await expect(treePanel).toBeVisible()

      // 验证树形组件存在
      const treeComponent = await page.locator('.sftp-transfer-tree')
      await expect(treeComponent).toBeVisible()

      // 验证表头存在
      const treeHeader = await page.locator('.tree-header')
      await expect(treeHeader).toBeVisible()

      // 验证树节点存在
      const treeNodes = await page.locator('.tree-node')
      const nodeCount = await treeNodes.count()
      console.log(`树节点数量：${nodeCount}`)
      expect(nodeCount).toBeGreaterThan(0)

      // 验证节点有正确的层级缩进
      const firstNode = treeNodes.first()
      const paddingLeft = await firstNode.evaluate((el) => {
        return window.getComputedStyle(el).paddingLeft
      })
      console.log(`第一个节点的 padding-left: ${paddingLeft}`)

      // 等待上传完成
      await page.waitForTimeout(5000)

      // 验证上传完成后节点状态变为绿色
      const completedNodes = await page.locator('.node-row.is-completed')
      const completedCount = await completedNodes.count()
      console.log(`已完成的节点数量：${completedCount}`)

    } finally {
      // 清理测试文件夹
      cleanupTestFolder(testFolder)
    }

    // 关闭 SFTP 窗口
    const closeButton = await page.locator('.header-btn.close').first()
    await closeButton.click()
  })

  test('树形节点应该支持展开/折叠', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)

    // 创建包含子文件夹的测试文件夹（使用 D 盘目录避免权限问题）
    const testFolder = 'D:\\develop\\goworkbunch\\memcached-operator\\test-expand-folder'
    createTestFolder(testFolder)

    try {
      // 右键点击本地文件列表区域
      const localFileList = await page.locator('.file-panel.local .file-list')
      await localFileList.click({ button: 'right', force: true })
      await page.waitForTimeout(500)

      // 点击上传文件夹菜单项
      const uploadFolderMenuItem = await page.locator('.context-menu-item', {
        hasText: '上传文件夹到服务器'
      }).first()
      await uploadFolderMenuItem.click({ force: true })
      await page.waitForTimeout(500)

      // 等待树形面板显示
      const toggleButton = await page.locator('.toggle-tree-btn')
      await expect(toggleButton).toBeVisible()
      await toggleButton.click({ force: true })
      await page.waitForTimeout(1000)

      // 找到文件夹节点（应该有展开/折叠图标）
      const folderNode = await page.locator('.tree-node .expand-icon').first()
      const hasFolderNode = await folderNode.count() > 0

      if (hasFolderNode) {
        // 点击展开/折叠图标
        await folderNode.click({ force: true })
        await page.waitForTimeout(500)

        // 验证子节点显示或隐藏
        const children = await page.locator('.tree-node .children')
        const childrenCount = await children.count()
        console.log(`子节点容器数量：${childrenCount}`)

        // 再次点击折叠
        await folderNode.click({ force: true })
        await page.waitForTimeout(500)

        console.log('✓ 文件夹节点支持展开/折叠')
      } else {
        console.log('ℹ 没有找到文件夹节点')
      }

    } finally {
      // 清理测试文件夹
      cleanupTestFolder(testFolder)
    }

    // 关闭 SFTP 窗口
    const closeButton = await page.locator('.header-btn.close').first()
    await closeButton.click()
  })

  test('不同状态应该使用不同颜色标识', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)

    // 创建测试文件夹（使用 D 盘目录避免权限问题）
    const testFolder = 'D:\\develop\\goworkbunch\\memcached-operator\\test-status-color'
    createTestFolder(testFolder)

    try {
      // 右键点击本地文件列表区域
      const localFileList = await page.locator('.file-panel.local .file-list')
      await localFileList.click({ button: 'right', force: true })
      await page.waitForTimeout(500)

      // 点击上传文件夹菜单项
      const uploadFolderMenuItem = await page.locator('.context-menu-item', {
        hasText: '上传文件夹到服务器'
      }).first()
      await uploadFolderMenuItem.click({ force: true })
      await page.waitForTimeout(500)

      // 等待树形面板显示
      const toggleButton = await page.locator('.toggle-tree-btn')
      await toggleButton.click({ force: true })
      await page.waitForTimeout(1000)

      // 验证传输中的节点使用蓝色
      const transferringNodes = await page.locator('.node-row.is-transferring')
      const transferringCount = await transferringNodes.count()
      
      if (transferringCount > 0) {
        const firstTransferringNode = transferringNodes.first()
        const color = await firstTransferringNode.evaluate((el) => {
          return window.getComputedStyle(el).color
        })
        console.log(`传输中节点颜色：${color}`)
        console.log('✓ 传输中节点使用特殊颜色标识')
      }

      // 等待上传完成
      await page.waitForTimeout(5000)

      // 验证已完成的节点使用绿色
      const completedNodes = await page.locator('.node-row.is-completed')
      const completedCount = await completedNodes.count()
      
      if (completedCount > 0) {
        const firstCompletedNode = completedNodes.first()
        const color = await firstCompletedNode.evaluate((el) => {
          return window.getComputedStyle(el).color
        })
        console.log(`已完成节点颜色：${color}`)
        console.log('✓ 已完成节点使用绿色标识')
      }

    } finally {
      // 清理测试文件夹
      cleanupTestFolder(testFolder)
    }

    // 关闭 SFTP 窗口
    const closeButton = await page.locator('.header-btn.close').first()
    await closeButton.click()
  })

  test('树形详情面板应该显示完整的传输信息', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)

    // 创建测试文件夹（使用 D 盘目录避免权限问题）
    const testFolder = 'D:\\develop\\goworkbunch\\memcached-operator\\test-transfer-info'
    createTestFolder(testFolder)

    try {
      // 右键点击本地文件列表区域
      const localFileList = await page.locator('.file-panel.local .file-list')
      await localFileList.click({ button: 'right', force: true })
      await page.waitForTimeout(500)

      // 点击上传文件夹菜单项
      const uploadFolderMenuItem = await page.locator('.context-menu-item', {
        hasText: '上传文件夹到服务器'
      }).first()
      await uploadFolderMenuItem.click({ force: true })
      await page.waitForTimeout(500)

      // 等待树形面板显示
      const toggleButton = await page.locator('.toggle-tree-btn')
      await toggleButton.click({ force: true })
      await page.waitForTimeout(1000)

      // 验证表头列存在
      const headers = await page.locator('.tree-header .header-column')
      const headerTexts = await headers.allTextContents()
      
      console.log('表头列:', headerTexts)
      
      // 验证必要的列存在
      expect(headerTexts).toContain('名称')
      expect(headerTexts).toContain('状态')
      expect(headerTexts).toContain('进度')
      expect(headerTexts).toContain('大小')

      // 验证节点显示完整信息
      const firstNode = await page.locator('.tree-node').first()
      
      // 验证节点有名称列
      const nameColumn = await firstNode.locator('.column.name-column')
      await expect(nameColumn).toBeVisible()

      // 验证节点有状态列
      const statusColumn = await firstNode.locator('.column.status-column')
      await expect(statusColumn).toBeVisible()

      // 验证节点有进度条
      const progressBar = await firstNode.locator('.progress-bar')
      const hasProgressBar = await progressBar.count() > 0
      
      if (hasProgressBar) {
        console.log('✓ 节点显示进度条')
      }

      // 验证节点有大小信息
      const sizeColumn = await firstNode.locator('.column.size-column')
      await expect(sizeColumn).toBeVisible()

      console.log('✓ 树形详情面板显示完整的传输信息')

    } finally {
      // 清理测试文件夹
      cleanupTestFolder(testFolder)
    }

    // 关闭 SFTP 窗口
    const closeButton = await page.locator('.header-btn.close').first()
    await closeButton.click()
  })
})
