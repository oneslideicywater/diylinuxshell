/**
 * SFTP 取消上传功能测试 - 简化版
 * 测试在上传过程中取消上传的功能
 * @module e2e/sftp/cancel-upload-simple
 */

import { test, expect } from '@playwright/test'
import { startApp, closeApp } from '../helpers/electron-app'
import type { ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// 测试会话配置
const TEST_SESSION = {
  name: 'SFTP Cancel Test',
  host: '192.168.10.24',
  port: 22,
  username: 'root',
  password: 'One.00000'
}

/**
 * 辅助函数：打开 SFTP 窗口
 */
async function openSFTPWindow(page: Page): Promise<void> {
  await page.waitForSelector('.session-list', { timeout: 10000 })

  // 创建测试会话
  await page.evaluate(async (sessionData) => {
    const sessions = await (window as any).api.session.getAll()
    const existing = sessions.find((s: any) => s.name === sessionData.name)
    if (!existing) {
      await (window as any).api.session.create(sessionData)
    }
  }, TEST_SESSION)

  await page.reload()
  await page.waitForSelector('.session-list', { timeout: 10000 })
  await page.waitForTimeout(3000)

  const groupHeader = await page.locator('.group-header').first()
  await groupHeader.click({ force: true })
  
  try {
    await page.waitForSelector('.session-item', { timeout: 5000 })
  } catch (e) {
    await groupHeader.click({ force: true })
    await page.waitForSelector('.session-item', { timeout: 5000 })
  }
  
  await page.waitForTimeout(1000)

  const sessionItem = await page.locator('.session-item', {
    hasText: TEST_SESSION.name
  }).first()
  
  await sessionItem.scrollIntoViewIfNeeded({ timeout: 5000 })
  await sessionItem.hover({ force: true })

  const sftpButton = await sessionItem.locator('.action-btn.sftp').first()
  await sftpButton.click({ force: true })

  await page.waitForSelector('.sftp-overlay', { timeout: 5000 })
  await page.waitForTimeout(3000)
}

test.describe('SFTP 取消上传功能 - 简化测试', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  /**
   * 测试用例：验证取消按钮存在且能点击
   */
  test('取消按钮应该存在且能正常显示', async () => {
    const folderName = `test_${Date.now()}`
    const tempDir = os.tmpdir()
    const testFolderPath = path.join(tempDir, folderName)
    
    try {
      // 创建测试文件夹
      if (!fs.existsSync(testFolderPath)) {
        fs.mkdirSync(testFolderPath, { recursive: true })
      }
      // 创建几个文件
      for (let i = 0; i < 3; i++) {
        fs.writeFileSync(path.join(testFolderPath, `file${i}.txt`), `content ${i}`)
      }

      // 打开 SFTP 窗口
      await openSFTPWindow(page)
      await page.waitForTimeout(2000)

      // 导航到测试文件夹
      const localPathInput = await page.locator('.file-panel.local .path-input').first()
      await localPathInput.click()
      await localPathInput.fill(testFolderPath)
      await localPathInput.press('Enter')
      await page.waitForTimeout(3000)

      // 验证文件列表已加载
      const localFileItems = page.locator('.file-panel.local .file-item')
      const localCount = await localFileItems.count()
      expect(localCount).toBeGreaterThan(0)

      // 右键点击第一个文件
      const firstFile = await localFileItems.first()
      await firstFile.click({ button: 'right', force: true })
      await page.waitForTimeout(1000)

      // 验证右键菜单显示
      const contextMenu = await page.locator('.context-menu')
      await expect(contextMenu).toBeVisible()

      // 点击上传文件夹菜单项
      const uploadMenuItem = await page.locator('.context-menu-item', {
        hasText: '上传文件夹到服务器'
      })
      await uploadMenuItem.click({ force: true })
      
      // 等待传输开始
      await page.waitForTimeout(3000)

      // 验证传输树容器显示
      const transferTreeContainer = await page.locator('.transfer-tree-container')
      await expect(transferTreeContainer).toBeVisible()

      // 验证取消按钮显示
      const cancelButton = await page.locator('.cancel-upload-btn')
      await expect(cancelButton).toBeVisible()

      // 验证取消按钮文本
      const buttonText = await cancelButton.textContent()
      expect(buttonText).toContain('取消上传')

      // 验证取消按钮有图标
      const icon = await cancelButton.locator('svg')
      await expect(icon).toBeVisible()

      console.log('✓ 取消按钮存在且可见')

      // 点击取消按钮
      await cancelButton.click({ force: true })
      console.log('✓ 点击了取消按钮')
      
      // 等待取消生效
      await page.waitForTimeout(2000)

      // 验证节点状态变为已取消
      const cancelledNodes = await page.locator('.status-cancelled')
      const cancelledCount = await cancelledNodes.count()
      
      // 应该至少有一个节点被取消
      expect(cancelledCount).toBeGreaterThan(0)
      console.log('✓ 节点状态变为已取消')

      // 验证取消按钮消失
      await expect(cancelButton).not.toBeVisible()
      console.log('✓ 取消按钮已隐藏')

      console.log('✓ 取消上传测试成功')
      
    } catch (error: any) {
      console.error('测试失败:', error)
      throw error
    } finally {
      // 清理测试文件夹
      try {
        if (fs.existsSync(testFolderPath)) {
          fs.rmSync(testFolderPath, { recursive: true, force: true })
        }
      } catch (e) {
        // 忽略清理错误
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
   * 测试用例：右键菜单应该能正常关闭
   */
  test('右键菜单应该能正常关闭', async () => {
    try {
      // 打开 SFTP 窗口
      await openSFTPWindow(page)
      await page.waitForTimeout(2000)

      // 右键点击本地文件列表区域
      const filePanel = await page.locator('.file-panel.local')
      await filePanel.click({ button: 'right', force: true })
      await page.waitForTimeout(500)

      // 验证右键菜单显示
      const contextMenu = await page.locator('.context-menu')
      await expect(contextMenu).toBeVisible()

      // 点击菜单外部区域
      const filePanel2 = await page.locator('.file-panel.local')
      await filePanel2.click({ force: true })
      await page.waitForTimeout(500)

      // 验证菜单已关闭
      await expect(contextMenu).not.toBeVisible()

      console.log('✓ 右键菜单关闭测试成功')
      
    } catch (error: any) {
      console.error('右键菜单测试失败:', error)
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
