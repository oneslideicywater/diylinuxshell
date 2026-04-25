/**
 * SFTP 本地创建文件夹功能测试
 * 测试在本地文件浏览器中创建新文件夹的功能
 * @module e2e/sftp/sftp-local-create-folder
 */

import { test, expect } from '@playwright/test'
import { startApp, closeApp } from '../helpers/electron-app'
import type { ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// 测试会话配置（使用提供的测试服务器）
const TEST_SESSION = {
  name: 'SFTP Local Folder Test',
  host: '192.168.10.24',
  port: 22,
  username: 'root',
  password: 'One.00000'
}

// 用于存储控制台消息和错误
const consoleMessages: any[] = []
const pageErrors: any[] = []

/**
 * 辅助函数：打开 SFTP 窗口（完整版）
 */
async function openSFTPWindow(page: Page): Promise<void> {
  // 1. 等待主界面加载完成（增加超时时间）
  await page.waitForSelector('.session-list', { timeout: 20000 })

  // 2. 创建测试会话（如果不存在）
  await page.evaluate(async (sessionData) => {
    const sessions = await (window as any).api.session.getAll()
    const existing = sessions.find((s: any) => s.name === sessionData.name)
    if (!existing) {
      await (window as any).api.session.create(sessionData)
    }
  }, TEST_SESSION)

  await page.reload()
  await page.waitForSelector('.session-list', { timeout: 20000 })
  
  // 3. 等待会话列表渲染
  await page.waitForTimeout(3000)

  // 4. 点击展开分组 (点击 group-header 来展开)
  const groupHeader = page.locator('.group-header').first()
  
  try {
    await groupHeader.waitFor({ state: 'visible', timeout: 10000 })
    await groupHeader.click({ force: true })
  } catch (e) {
    console.log('等待 group-header 超时，尝试其他方式...')
    // 如果找不到 group-header，可能已经展开了
    const sessionItem = page.locator('.session-item').first()
    if (await sessionItem.count() > 0) {
      console.log('找到 session-item，跳过展开步骤')
    } else {
      throw e
    }
  }
  
  // 5. 等待分组展开（等待 session-item 出现）
  let sessionFound = false
  for (let i = 0; i < 3; i++) {
    try {
      await page.waitForSelector('.session-item', { timeout: 5000 })
      sessionFound = true
      break
    } catch (e) {
      console.log(`第 ${i + 1} 次尝试查找 session-item 失败，重试...`)
      if (i < 2) {
        await groupHeader.click({ force: true }).catch(() => {})
        await page.waitForTimeout(2000)
      }
    }
  }
  
  if (!sessionFound) {
    throw new Error('无法找到会话项')
  }
  
  await page.waitForTimeout(1000)

  // 6. 找到测试会话
  const sessionItem = page.locator('.session-item', {
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
  
  // 7. 鼠标悬停显示操作按钮
  await sessionItem.scrollIntoViewIfNeeded({ timeout: 5000 })
  await sessionItem.hover({ force: true })

  // 8. 点击 SFTP 按钮
  const sftpButton = await sessionItem.locator('.action-btn.sftp').first()
  await sftpButton.click({ force: true })

  // 9. 等待 SFTP 窗口打开
  await page.waitForSelector('.sftp-overlay', { timeout: 10000 })
  await page.waitForTimeout(3000)
}

test.describe('SFTP 本地创建文件夹功能', () => {
  let electronApp: ElectronApplication | null = null
  let page: Page | null = null

  /**
   * 测试前准备：启动应用并打开 SFTP 窗口
   */
  test.beforeAll(async () => {
    // 启动 Electron 应用
    const appResult = await startApp()
    electronApp = appResult.electronApp
    page = appResult.page
    
    // 监听控制台消息
    if (page) {
      page.on('console', msg => {
        consoleMessages.push(msg)
        console.log('Console:', msg.type(), msg.text())
      })
      
      page.on('pageerror', error => {
        pageErrors.push(error)
        console.error('Page Error:', error.message)
      })
      
      // 等待应用完全加载
      await page.waitForTimeout(3000)
    }
  })

  /**
   * 测试后清理：关闭应用
   */
  test.afterAll(async () => {
    if (electronApp && page) {
      await closeApp(electronApp, page)
    }
  })

  /**
   * 测试用例：通过右键菜单在当前浏览目录创建文件夹
   * 场景：选中某个文件后，在该文件所在目录创建新文件夹
   */
  test('应该在本地文件所在目录成功创建新文件夹', async () => {
    if (!page) throw new Error('Page 未初始化')
    
    console.log('\n=== 开始测试：本地创建文件夹 ===')
    
    // 1. 打开 SFTP 窗口
    await openSFTPWindow(page)
    await page.waitForTimeout(2000)
    
    // 2. 使用 D 盘测试目录（遵循规则：不使用 C 盘路径）
    const testBaseDir = 'D:\\test_sftp_local_folder'
    const testFileName = `test_file_${Date.now()}.txt`
    const newFolderName = 'hello'  // 用户指定的文件夹名称
    
    // 创建测试基础目录和测试文件
    if (!fs.existsSync(testBaseDir)) {
      fs.mkdirSync(testBaseDir, { recursive: true })
      console.log('✅ 创建测试目录:', testBaseDir)
    }
    
    const testFilePath = path.join(testBaseDir, testFileName)
    fs.writeFileSync(testFilePath, `测试文件内容 - ${Date.now()}`)
    console.log('✅ 创建测试文件:', testFilePath)
    
    try {
      // 3. 导航到本地测试目录
      const localPathInput = page.locator('.file-panel.local .path-input').first()
      await localPathInput.fill(testBaseDir)
      await localPathInput.press('Enter')
      await page.waitForTimeout(2000)
      
      console.log('📍 当前导航到:', testBaseDir)
      
      // 4. 选择测试文件（模拟用户的操作场景）
      const testFileItem = page.locator('.file-panel.local .file-item', {
        hasText: testFileName
      }).first()
      
      await expect(testFileItem).toBeVisible({ timeout: 5000 })
      await testFileItem.click({ force: true })
      console.log('✅ 选中测试文件:', testFileName)
      
      // 5. 右键点击选中的文件，显示上下文菜单（使用 JavaScript 触发）
      await testFileItem.evaluate((element) => {
        const event = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          view: window
        })
        element.dispatchEvent(event)
      })
      await page.waitForTimeout(1000)
      
      // 验证右键菜单出现
      const contextMenu = page.locator('.file-context-menu')
      await expect(contextMenu).toBeVisible({ timeout: 3000 })
      console.log('✅ 右键菜单已显示')
      
      // 6. 点击"新建文件夹"菜单项
      const createFolderMenuItem = contextMenu.locator('.context-menu-item:has-text("新建文件夹")')
      await expect(createFolderMenuItem).toBeVisible()
      await createFolderMenuItem.click({ force: true })
      console.log('✅ 点击"新建文件夹"菜单项')
      
      // 7. 等待创建文件夹对话框出现
      const dialogOverlay = page.locator('.dialog-overlay')
      await expect(dialogOverlay).toBeVisible({ timeout: 3000 })
      await page.waitForTimeout(500)
      console.log('✅ 创建文件夹对话框已显示')
      
      // 8. 输入文件夹名称
      const folderNameInput = page.locator('.dialog-overlay .form-input').first()
      await expect(folderNameInput).toBeVisible()
      await folderNameInput.fill(newFolderName)
      console.log('✅ 输入文件夹名称:', newFolderName)
      
      // 9. 点击确定按钮
      const confirmButton = page.locator('.dialog-overlay .btn-primary').first()
      await expect(confirmButton).toBeVisible()
      await confirmButton.click({ force: true })
      console.log('✅ 点击确定按钮')
      
      // 10. 等待文件夹创建完成并刷新列表
      await page.waitForTimeout(3000)
      
      // 手动刷新文件列表（确保显示新创建的文件夹）
      // 尝试定位刷新按钮（调试用，void 标记有意忽略）
      void (page.locator('.file-panel.local .nav-btn[title="上级目录"]').first())
      // 如果找不到刷新按钮，尝试重新导航到当前目录
      const pathInput = page.locator('.file-panel.local .path-input').first()
      await pathInput.fill(testBaseDir)
      await pathInput.press('Enter')
      await page.waitForTimeout(2000)
      
      // 11. 验证新文件夹出现在本地文件列表中
      const localFileItems = page.locator('.file-panel.local .file-item')
      let found = false
      let attempts = 0
      const maxAttempts = 8
      
      while (!found && attempts < maxAttempts) {
        const files = await localFileItems.allTextContents()
        console.log(`\n🔍 尝试 ${attempts + 1}/${maxAttempts}:`)
        console.log(`   当前文件数量: ${files.length}`)
        console.log(`   文件列表内容:`, JSON.stringify(files, null, 2))
        
        found = files.some(file => file.includes(newFolderName))
        if (found) {
          console.log(`\n✅✅✅ 成功找到文件夹: "${newFolderName}" ✅✅✅`)
        } else {
          console.log(`❌ 未找到 "${newFolderName}"，等待重试...`)
          await page.waitForTimeout(1000)
          attempts++
        }
      }
      
      // 如果还是没找到，打印更多信息帮助调试
      if (!found) {
        console.error('\n❌❌❌ 最终未找到文件夹，开始详细诊断 ❌❌❌')
        
        // 检查当前路径
        const currentPath = await page.locator('.file-panel.local .path-input').first().inputValue()
        console.error('当前路径输入框的值:', currentPath)
        
        // 检查文件系统中的实际状态
        const folderExistsInFS = await page.evaluate(async (folderPath) => {
          try {
            const fs = await import('fs')
            return fs.existsSync(folderPath)
          } catch (e) {
            return `Error: ${e.message}`
          }
        }, path.join(testBaseDir, newFolderName))
        console.error('文件系统中文件夹是否存在:', folderExistsInFS)
        
        // 列出目录中的所有文件
        const dirContents = await page.evaluate(async (dirPath) => {
          try {
            const fs = await import('fs')
            return fs.readdirSync(dirPath)
          } catch (e) {
            return `Error: ${e.message}`
          }
        }, testBaseDir)
        console.error('目录实际内容:', dirContents)
      }
      
      expect(found).toBe(true)
      console.log('✅ 新文件夹已出现在文件列表中')
      
      // 12. 验证文件夹在文件系统中确实存在（使用完整路径验证）
      const expectedFolderPath = path.join(testBaseDir, newFolderName)
      const folderExists = fs.existsSync(expectedFolderPath)
      expect(folderExists).toBe(true)
      console.log('✅ 文件夹在文件系统中存在:', expectedFolderPath)
      
      // 13. 验证文件夹路径符合预期
      const stats = fs.statSync(expectedFolderPath)
      expect(stats.isDirectory()).toBe(true)
      console.log('✅ 验证为目录类型')
      
      console.log('\n=== ✅ 测试通过：本地创建文件夹功能正常 ===')
      console.log(`📁 创建的文件夹路径: ${expectedFolderPath}`)
      
    } finally {
      // 清理测试数据
      console.log('\n🧹 开始清理测试数据...')
      
      // 删除创建的文件夹
      const createdFolderPath = path.join(testBaseDir, newFolderName)
      if (fs.existsSync(createdFolderPath)) {
        fs.rmSync(createdFolderPath, { recursive: true, force: true })
        console.log('✅ 已删除创建的文件夹:', createdFolderPath)
      }
      
      // 删除测试文件
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath)
        console.log('✅ 已删除测试文件:', testFilePath)
      }
      
      // 删除测试基础目录（如果为空）
      if (fs.existsSync(testBaseDir)) {
        const remainingFiles = fs.readdirSync(testBaseDir)
        if (remainingFiles.length === 0) {
          fs.rmdirSync(testBaseDir)
          console.log('✅ 已删除测试目录:', testBaseDir)
        }
      }
      
      console.log('✅ 测试数据清理完成\n')
    }
  })

  /**
   * 测试用例：验证创建重名文件夹时的错误提示
   */
  test('应该正确处理创建重名文件夹的情况', async () => {
    if (!page) throw new Error('Page 未初始化')
    
    console.log('\n=== 开始测试：创建重名文件夹错误处理 ===')
    
    // 1. 打开 SFTP 窗口
    await openSFTPWindow(page)
    await page.waitForTimeout(2000)
    
    // 2. 使用 D 盘测试目录
    const testBaseDir = 'D:\\test_duplicate_folder'
    const existingFolderName = 'existing_folder'
    
    // 创建测试目录和已存在的文件夹
    if (!fs.existsSync(testBaseDir)) {
      fs.mkdirSync(testBaseDir, { recursive: true })
    }
    
    const existingFolderPath = path.join(testBaseDir, existingFolderName)
    if (!fs.existsSync(existingFolderPath)) {
      fs.mkdirSync(existingFolderPath)
      console.log('✅ 创建已存在的文件夹:', existingFolderPath)
    }
    
    try {
      // 3. 导航到测试目录
      const localPathInput = page.locator('.file-panel.local .path-input').first()
      await localPathInput.fill(testBaseDir)
      await localPathInput.press('Enter')
      await page.waitForTimeout(2000)
      
      // 4. 先选择一个文件（确保文件列表已加载）
      const firstFileItem = page.locator('.file-panel.local .file-item').first()
      const fileCount = await page.locator('.file-panel.local .file-item').count()
      console.log('📍 当前目录文件数量:', fileCount)
      
      if (fileCount === 0) {
        throw new Error('测试目录为空，无法继续测试')
      }
      
      await firstFileItem.click({ force: true })
      
      // 5. 右键点击选中的文件，显示上下文菜单（使用 JavaScript 触发）
      await firstFileItem.evaluate((element) => {
        const event = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          view: window
        })
        element.dispatchEvent(event)
      })
      await page.waitForTimeout(1000)
      
      // 5. 点击"新建文件夹"
      const contextMenu = page.locator('.file-context-menu')
      await expect(contextMenu).toBeVisible({ timeout: 3000 })
      
      const createFolderMenuItem = contextMenu.locator('.context-menu-item:has-text("新建文件夹")')
      await createFolderMenuItem.click({ force: true })
      
      // 6. 等待对话框出现
      const dialogOverlay = page.locator('.dialog-overlay')
      await expect(dialogOverlay).toBeVisible({ timeout: 3000 })
      
      // 7. 输入已存在的文件夹名称
      const folderNameInput = page.locator('.dialog-overlay .form-input').first()
      await folderNameInput.fill(existingFolderName)
      
      // 8. 点击确定按钮
      const confirmButton = page.locator('.dialog-overlay .btn-primary').first()
      await confirmButton.click({ force: true })
      await page.waitForTimeout(1000)
      
      // 9. 验证显示错误信息
      const errorElement = page.locator('.dialog-overlay .form-error').first()
      await expect(errorElement).toBeVisible({ timeout: 2000 })
      
      const errorMessage = await errorElement.textContent()
      expect(errorMessage).toContain('已存在')
      console.log('✅ 正确显示错误信息:', errorMessage)
      
      console.log('\n=== ✅ 测试通过：重名文件夹错误处理正常 ===')
      
    } finally {
      // 清理测试数据
      if (fs.existsSync(testBaseDir)) {
        fs.rmSync(testBaseDir, { recursive: true, force: true })
        console.log('✅ 已清理测试目录:', testBaseDir)
      }
    }
  })

  /**
   * 测试用例：验证非法文件夹名称的处理
   */
  test('应该拒绝包含非法字符的文件夹名称', async () => {
    if (!page) throw new Error('Page 未初始化')
    
    console.log('\n=== 开始测试：非法文件夹名称处理 ===')
    
    // 1. 打开 SFTP 窗口
    await openSFTPWindow(page)
    await page.waitForTimeout(2000)
    
    // 2. 使用 D 盘测试目录
    const testBaseDir = 'D:\\test_invalid_folder_name'
    
    // 创建测试目录
    if (!fs.existsSync(testBaseDir)) {
      fs.mkdirSync(testBaseDir, { recursive: true })
    }
    
    try {
      // 3. 导航到测试目录
      const localPathInput = page.locator('.file-panel.local .path-input').first()
      await localPathInput.fill(testBaseDir)
      await localPathInput.press('Enter')
      await page.waitForTimeout(2000)
      
      // 4. 先选择一个文件（确保文件列表已加载）
      const firstFileItem = page.locator('.file-panel.local .file-item').first()
      const fileCount = await page.locator('.file-panel.local .file-item').count()
      
      if (fileCount === 0) {
        throw new Error('测试目录为空，无法继续测试')
      }
      
      await firstFileItem.click({ force: true })
      
      // 5. 右键点击选中的文件，显示上下文菜单（使用 JavaScript 触发）
      await firstFileItem.evaluate((element) => {
        const event = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          view: window
        })
        element.dispatchEvent(event)
      })
      await page.waitForTimeout(1000)
      
      // 5. 点击"新建文件夹"
      const contextMenu = page.locator('.file-context-menu')
      await expect(contextMenu).toBeVisible({ timeout: 3000 })
      
      const createFolderMenuItem = contextMenu.locator('.context-menu-item:has-text("新建文件夹")')
      await createFolderMenuItem.click({ force: true })
      
      // 6. 等待对话框出现
      const dialogOverlay = page.locator('.dialog-overlay')
      await expect(dialogOverlay).toBeVisible({ timeout: 3000 })
      
      // 7. 输入包含非法字符的文件夹名称（包含 \ / : * ? " < > |）
      const invalidFolderName = 'invalid<folder>name'
      const folderNameInput = page.locator('.dialog-overlay .form-input').first()
      await folderNameInput.fill(invalidFolderName)
      
      // 8. 点击确定按钮
      const confirmButton = page.locator('.dialog-overlay .btn-primary').first()
      await confirmButton.click({ force: true })
      await page.waitForTimeout(1000)
      
      // 9. 验证显示错误信息
      const errorElement = page.locator('.dialog-overlay .form-error').first()
      await expect(errorElement).toBeVisible({ timeout: 2000 })
      
      const errorMessage = await errorElement.textContent()
      expect(errorMessage).toContain('不能包含')
      console.log('✅ 正确显示非法字符错误信息:', errorMessage)
      
      console.log('\n=== ✅ 测试通过：非法文件夹名称处理正常 ===')
      
    } finally {
      // 清理测试数据
      if (fs.existsSync(testBaseDir)) {
        fs.rmSync(testBaseDir, { recursive: true, force: true })
        console.log('✅ 已清理测试目录:', testBaseDir)
      }
    }
  })
})
