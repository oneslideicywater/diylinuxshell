/**
 * SFTP 本地文件浏览器刷新功能测试
 * 测试右键菜单中的"刷新"功能是否正常工作
 * @module e2e/sftp/sftp-local-refresh
 */

import { test, expect } from '@playwright/test'
import { startApp, closeApp } from '../helpers/electron-app'
import type { ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// 测试会话配置（复用已有的会话）
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
  // 1. 等待主界面加载完成
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
    const sessionItem = page.locator('.session-item').first()
    if (await sessionItem.count() > 0) {
      console.log('找到 session-item，跳过展开步骤')
    } else {
      throw e
    }
  }
  
  // 5. 等待分组展开
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
  
  const count = await sessionItem.count()
  if (count === 0) {
    console.error('找不到会话:', TEST_SESSION.name)
    throw new Error('找不到测试会话')
  }
  
  // 7. 鼠标悬停显示操作按钮（使用 force 模式避免可见性问题）
  try {
    await sessionItem.hover({ force: true, timeout: 5000 })
  } catch (e) {
    console.log('hover 失败，尝试直接点击...')
    // 如果 hover 失败，直接继续
  }

  // 8. 点击 SFTP 按钮
  const sftpButton = await sessionItem.locator('.action-btn.sftp').first()
  await sftpButton.click({ force: true })

  // 9. 等待 SFTP 窗口打开
  await page.waitForSelector('.sftp-overlay', { timeout: 10000 })
  await page.waitForTimeout(3000)
}

test.describe('SFTP 本地文件浏览器刷新功能', () => {
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
   * 测试用例：点击"刷新"应该触发目录重新加载
   */
  test('点击\"刷新\"应该触发本地目录重新加载', async () => {
    if (!page) throw new Error('Page 未初始化')
    
    console.log('\n=== 开始测试：点击刷新重新加载文件列表 ===')
    
    // 1. 打开 SFTP 窗口
    await openSFTPWindow(page)
    
    // 2. 使用 D 盘测试目录
    const testBaseDir = 'D:\\test_refresh_action'
    const initialFileName = `initial_file_${Date.now()}.txt`
    const newFileName = `new_file_after_refresh_${Date.now()}.txt`
    
    // 创建测试目录和初始文件
    if (!fs.existsSync(testBaseDir)) {
      fs.mkdirSync(testBaseDir, { recursive: true })
    }
    
    const initialFilePath = path.join(testBaseDir, initialFileName)
    fs.writeFileSync(initialFilePath, `初始文件内容 - ${Date.now()}`)
    console.log('✅ 创建初始文件:', initialFilePath)
    
    try {
      // 3. 导航到测试目录
      const localPathInput = page.locator('.file-panel.local .path-input').first()
      await localPathInput.fill(testBaseDir)
      await localPathInput.press('Enter')
      await page.waitForTimeout(2000)
      
      // 4. 记录初始文件数量
      const initialFileItems = page.locator('.file-panel.local .file-item')
      const initialCount = await initialFileItems.count()
      console.log('📍 初始文件数量:', initialCount)
      
      expect(initialCount).toBeGreaterThan(0)
      
      // 5. 在文件系统中添加一个新文件（模拟外部变化）
      const newFilePath = path.join(testBaseDir, newFileName)
      fs.writeFileSync(newFilePath, `新文件内容 - ${Date.now()}`)
      console.log('✅ 在文件系统创建新文件:', newFilePath)
      
      // 6. 此时 UI 中不应该显示这个新文件
      let filesBeforeRefresh = await initialFileItems.allTextContents()
      const foundBeforeRefresh = filesBeforeRefresh.some(file => file.includes(newFileName))
      expect(foundBeforeRefresh).toBe(false)
      console.log('✅ 刷新前 UI 中未显示新文件（符合预期）')
      
      // 7. 右键点击选中的文件，显示上下文菜单
      const firstFileItem = page.locator('.file-panel.local .file-item').first()
      await firstFileItem.click({ force: true })
      
      // 使用 JavaScript 触发 contextmenu 事件
      await firstFileItem.evaluate((element) => {
        const event = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          view: window
        })
        element.dispatchEvent(event)
      })
      await page.waitForTimeout(1000)
      
      // 8. 验证右键菜单出现并包含"刷新"选项
      const contextMenu = page.locator('.file-context-menu')
      await expect(contextMenu).toBeVisible({ timeout: 5000 })
      console.log('✅ 右键菜单已显示')
      
      // 验证"刷新"选项存在
      const refreshMenuItem = contextMenu.locator('.context-menu-item:has-text("刷新")')
      await expect(refreshMenuItem).toBeVisible({ timeout: 5000 })
      console.log('✅ 找到"刷新"菜单项')
      
      // 验证描述文本正确
      const refreshDescription = await refreshMenuItem.locator('.menu-item-description').textContent()
      expect(refreshDescription).toContain('重新加载当前浏览目录')
      console.log('✅ 刷新菜单项描述文本正确:', refreshDescription)
      
      // 9. 点击"刷新"菜单项
      await refreshMenuItem.click({ force: true })
      console.log('✅ 点击"刷新"菜单项')
      
      // 10. 等待刷新完成
      await page.waitForTimeout(3000)
      
      // 11. 验证新文件出现在文件列表中
      const refreshedFileItems = page.locator('.file-panel.local .file-item')
      let foundAfterRefresh = false
      let attempts = 0
      const maxAttempts = 5
      
      while (!foundAfterRefresh && attempts < maxAttempts) {
        const filesAfterRefresh = await refreshedFileItems.allTextContents()
        foundAfterRefresh = filesAfterRefresh.some(file => file.includes(newFileName))
        
        if (foundAfterRefresh) {
          console.log(`\n✅✅✅ 第 ${attempts + 1} 次尝试后找到新文件: "${newFileName}" ✅✅✅`)
        } else {
          console.log(`🔍 第 ${attempts + 1}/${maxAttempts} 次：未找到新文件，等待重试...`)
          await page.waitForTimeout(1000)
          attempts++
        }
      }
      
      expect(foundAfterRefresh).toBe(true)
      console.log('✅ 刷新成功：新文件已出现在文件列表中')
      
      // 12. 验证控制台日志中包含刷新成功的消息
      const refreshLogMessages = consoleMessages.filter(msg => 
        msg.text().includes('[SftpLocal] 刷新本地目录') ||
        msg.text().includes('[SftpLocal] ✅ 本地目录刷新成功')
      )
      
      expect(refreshLogMessages.length).toBeGreaterThan(0)
      console.log('✅ 控制台包含刷新相关的日志')
      
      console.log('\n=== ✅ 测试通过：点击刷新重新加载文件列表 ===')
      
    } finally {
      // 清理测试数据
      if (fs.existsSync(testBaseDir)) {
        fs.rmSync(testBaseDir, { recursive: true, force: true })
        console.log('✅ 已清理测试目录:', testBaseDir)
      }
    }
  })

  /**
   * 测试用例：刷新功能应该在空目录下也能正常工作
   */
  test('刷新功能应该在空目录下也能正常工作', async () => {
    if (!page) throw new Error('Page 未初始化')
    
    console.log('\n=== 开始测试：空目录下的刷新功能 ===')
    
    // 1. 打开 SFTP 窗口
    await openSFTPWindow(page)
    
    // 2. 使用 D 盘空测试目录
    const testBaseDir = 'D:\\test_empty_dir_refresh'
    
    // 创建空的测试目录
    if (!fs.existsSync(testBaseDir)) {
      fs.mkdirSync(testBaseDir, { recursive: true })
    }
    
    try {
      // 3. 导航到空目录
      const localPathInput = page.locator('.file-panel.local .path-input').first()
      await localPathInput.fill(testBaseDir)
      await localPathInput.press('Enter')
      await page.waitForTimeout(2000)
      
      // 4. 验证初始状态（可能只有 ".." 目录）
      const initialFileItems = page.locator('.file-panel.local .file-item')
      const initialCount = await initialFileItems.count()
      console.log('📍 空目录初始文件数量:', initialCount)
      
      // 5. 右键点击显示上下文菜单（点击空白区域或 .. 目录）
      if (initialCount > 0) {
        const firstFileItem = page.locator('.file-panel.local .file-item').first()
        await firstFileItem.click({ force: true })
        
        await firstFileItem.evaluate((element) => {
          const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            view: window
          })
          element.dispatchEvent(event)
        })
      } else {
        const fileListArea = page.locator('.file-panel.local .file-list').first()
        await fileListArea.evaluate((element) => {
          const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            view: window
          })
          element.dispatchEvent(event)
        })
      }
      
      await page.waitForTimeout(1000)
      
      // 6. 验证右键菜单出现
      const contextMenu = page.locator('.file-context-menu')
      await expect(contextMenu).toBeVisible({ timeout: 5000 })
      console.log('✅ 右键菜单已显示')
      
      // 7. 验证"刷新"选项存在
      const refreshMenuItem = contextMenu.locator('.context-menu-item:has-text("刷新")')
      await expect(refreshMenuItem).toBeVisible({ timeout: 5000 })
      console.log('✅ 找到"刷新"菜单项')
      
      // 8. 点击"刷新"菜单项
      await refreshMenuItem.click({ force: true })
      console.log('✅ 点击"刷新"菜单项')
      
      // 9. 等待刷新完成
      await page.waitForTimeout(2000)
      
      // 10. 验证没有报错（刷新成功完成）
      // 检查控制台是否有刷新相关的错误日志
      const refreshErrors = consoleMessages.filter(msg => 
        msg.text().includes('刷新本地目录失败') || 
        msg.text().includes('refresh error')
      )
      
      expect(refreshErrors.length).toBe(0)
      console.log('✅ 空目录刷新完成，无错误')
      
      console.log('\n=== ✅ 测试通过：空目录下的刷新功能正常 ===')
      
    } finally {
      // 清理测试数据
      if (fs.existsSync(testBaseDir)) {
        fs.rmSync(testBaseDir, { recursive: true, force: true })
        console.log('✅ 已清理测试目录:', testBaseDir)
      }
    }
  })
})
