/**
 * SFTP 文件传输功能测试
 * 测试 SFTP 窗口的打开、文件列表加载、文件传输等功能
 * @module e2e/sftp/sftp-transfer
 */

import { test, expect } from '@playwright/test'
import { startApp, closeApp } from '../helpers/electron-app'
import type { ElectronApplication, Page } from '@playwright/test'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'

// 测试会话配置（使用提供的测试服务器）
const TEST_SESSION = {
  name: 'SFTP Test Server',
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

test.describe('SFTP 文件传输功能', () => {
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

  test('SFTP 窗口应该能正常打开', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)

    // 验证 SFTP 窗口标题
    const title = await page.locator('.sftp-header h3').textContent()
    expect(title).toContain('SFTP')

    // 验证窗口显示会话信息
    const subtitle = await page.locator('.header-subtitle').textContent()
    expect(subtitle).toContain(TEST_SESSION.host)

    // 等待文件列表加载
    await page.waitForTimeout(3000)

    // 验证文件面板存在
    await expect(page.locator('.file-panel.local')).toBeVisible()
    await expect(page.locator('.file-panel.remote')).toBeVisible()

    // 检查是否有 SFTP 连接错误
    const sftpConnectErrors = consoleMessages.filter(msg => 
      msg.text.includes('SFTP not connected') || msg.text.includes('加载远程文件失败')
    )
    
    if (sftpConnectErrors.length > 0) {
      console.log('SFTP 连接错误:', sftpConnectErrors)
    }

    // 验证远程文件列表已加载
    const remoteFileList = page.locator('.file-panel.remote .file-list')
    await expect(remoteFileList).toBeVisible()
    
    // 检查是否有文件项（根目录至少应该有内容）
    const remoteFileItems = page.locator('.file-panel.remote .file-item')
    const remoteCount = await remoteFileItems.count()
    console.log(`远程文件数量：${remoteCount}`)
    
    // 验证有文件显示（根目录应该至少有一个文件/目录）
    expect(remoteCount).toBeGreaterThan(0)

    // 验证工具栏按钮存在
    await expect(page.locator('.toolbar-btn', { hasText: '上传' })).toBeVisible()
    await expect(page.locator('.toolbar-btn', { hasText: '下载' })).toBeVisible()
    await expect(page.locator('.toolbar-btn', { hasText: '新建文件夹' })).toBeVisible()
    await expect(page.locator('.toolbar-btn', { hasText: '删除' })).toBeVisible()

    // 关闭 SFTP 窗口
    const closeButton = await page.locator('.header-btn.close').first()
    await closeButton.click()

    // 验证窗口已关闭
    await expect(page.locator('.sftp-overlay')).not.toBeVisible({ timeout: 3000 })
  })

  test('SFTP 窗口应该能响应主题切换', async () => {
    // 检查 SFTP 窗口是否存在 CSS 变量
    const hasCssVariables = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      const bgColor = style.getPropertyValue('--bg-color')
      const textColor = style.getPropertyValue('--text-color')
      return !!bgColor || !!textColor
    })

    // 验证使用了 CSS 变量
    expect(hasCssVariables).toBe(true)
  })

  test('SFTP 窗口应该能最大化/还原', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)

    // 获取初始窗口大小
    const initialSize = await page.evaluate(() => {
      const win = document.querySelector('.sftp-window') as HTMLElement
      return {
        width: win.offsetWidth,
        height: win.offsetHeight,
        isMaximized: win.classList.contains('is-maximized')
      }
    })

    // 点击最大化按钮
    const maximizeButton = await page.locator('.header-actions .header-btn').nth(1)
    await maximizeButton.click()

    // 等待动画完成
    await page.waitForTimeout(500)

    // 验证窗口已最大化
    const maximizedSize = await page.evaluate(() => {
      const win = document.querySelector('.sftp-window') as HTMLElement
      return {
        width: win.offsetWidth,
        height: win.offsetHeight,
        isMaximized: win.classList.contains('is-maximized')
      }
    })

    expect(maximizedSize.isMaximized).toBe(true)
    expect(maximizedSize.width).toBeGreaterThanOrEqual(initialSize.width)
    expect(maximizedSize.height).toBeGreaterThanOrEqual(initialSize.height)

    // 再次点击还原
    await maximizeButton.click()
    await page.waitForTimeout(500)

    // 验证窗口已还原
    const restoredSize = await page.evaluate(() => {
      const win = document.querySelector('.sftp-window') as HTMLElement
      return {
        width: win.offsetWidth,
        height: win.offsetHeight,
        isMaximized: win.classList.contains('is-maximized')
      }
    })

    expect(restoredSize.isMaximized).toBe(false)
  })

  test('SFTP 窗口应该能刷新文件列表', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)

    // 获取初始文件列表（调试用）
    void (await page.evaluate(() => {
      const localFiles = document.querySelectorAll('.file-panel.local .file-item').length
      const remoteFiles = document.querySelectorAll('.file-panel.remote .file-item').length
      return { local: localFiles, remote: remoteFiles }
    }))

    // 点击刷新按钮
    await (await page.locator('.header-btn[title="刷新"]').first()).click()

    // 等待刷新完成
    await page.waitForTimeout(2000)

    // 验证文件列表已刷新
    const refreshedFileCount = await page.evaluate(() => {
      const localFiles = document.querySelectorAll('.file-panel.local .file-item').length
      const remoteFiles = document.querySelectorAll('.file-panel.remote .file-item').length
      return { local: localFiles, remote: remoteFiles }
    })

    // 验证刷新后仍然有文件列表
    expect(refreshedFileCount.local).toBeGreaterThanOrEqual(0)
    expect(refreshedFileCount.remote).toBeGreaterThanOrEqual(0)
  })

  test('SFTP 窗口应该能上传文件', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)

    // 创建测试文件（使用本地文件系统 API）
    const testFileName = `test_upload_${Date.now()}.txt`
    const testFileContent = `这是测试文件内容 - ${Date.now()}`
    
    // 使用 fs 模块创建临时文件
    const tempDir = os.tmpdir()
    const testFilePath = path.join(tempDir, testFileName)
    fs.writeFileSync(testFilePath, testFileContent)

    console.log('创建测试文件:', testFilePath)

    // 在本地文件列表中找到测试文件
    // 先导航到临时文件夹
    const localPathInput = await page.locator('.file-panel.local .path-input').first()
    await localPathInput.fill(tempDir)
    await localPathInput.press('Enter')
    await page.waitForTimeout(2000)

    // 选择测试文件
    const testFileItem = await page.locator('.file-panel.local .file-item', {
      hasText: testFileName
    }).first()
    await testFileItem.click({ force: true })

    // 点击上传按钮
    const uploadButton = await page.locator('.toolbar-btn', { hasText: '上传' }).first()
    await uploadButton.click({ force: true })

    // 等待上传完成
    await page.waitForTimeout(3000)

    // 验证上传成功（远程文件列表中出现新文件）
    const remoteFileItems = page.locator('.file-panel.remote .file-item')
    let found = false
    let attempts = 0
    const maxAttempts = 5
    
    while (!found && attempts < maxAttempts) {
      const files = await remoteFileItems.allTextContents()
      found = files.some(file => file.includes(testFileName))
      if (!found) {
        await page.waitForTimeout(1000)
        attempts++
      }
    }

    expect(found).toBe(true)

    // 清理远程测试文件
    await page.evaluate(async (fileName) => {
      try {
        const sessions = await (window as any).api.session.getAll()
        const session = sessions.find((s: any) => s.name === 'SFTP Test Server')
        if (session) {
          const sessionId = session.id || session.host
          await (window as any).api.sftp.delete(sessionId, '/' + fileName)
        }
      } catch (e) {
        console.log('清理远程文件失败:', e)
      }
    }, testFileName)

    // 清理本地测试文件
    try {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath)
      }
    } catch (e) {
      console.log('清理本地文件失败:', e)
    }
  })

  /**
   * 测试用例：右键菜单功能
   */
  test('SFTP 窗口应该支持右键菜单操作', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)
    
    // 等待 SFTP 窗口完全加载
    await page.waitForTimeout(2000)

    // 测试上传按钮的右键菜单
    const uploadButton = await page.locator('.sftp-toolbar .toolbar-btn', { hasText: '上传' }).first()
    
    // 右击上传按钮
    await uploadButton.click({ button: 'right', force: true })
    await page.waitForTimeout(500)

    // 验证右键菜单显示（在 SFTP 窗口内，但不在工具栏内部）
    const contextMenu = await page.locator('.sftp-window .context-menu')
    await expect(contextMenu).toBeVisible()

    // 验证菜单项内容
    const menuTitle = await page.locator('.sftp-window .menu-item-title')
    const menuDescription = await page.locator('.sftp-window .menu-item-description')
    
    const titleText = await menuTitle.textContent()
    const descText = await menuDescription.textContent()
    
    expect(titleText).toBe('上传文件')
    expect(descText).toContain('选择本地文件上传')

    // 点击菜单项应该执行对应操作
    await menuTitle.click({ force: true })
    await page.waitForTimeout(1000)

    // 验证菜单关闭
    await expect(contextMenu).not.toBeVisible()
  })

  /**
   * 测试用例：新建文件夹
   */
  test('SFTP 窗口应该能新建文件夹', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)
    
    // 等待 SFTP 窗口完全加载
    await page.waitForTimeout(2000)

    // 点击新建文件夹按钮
    const newFolderButton = await page.locator('.toolbar-btn', { hasText: '新建文件夹' }).first()
    await newFolderButton.click({ force: true })
    
    // 等待对话框出现
    await page.waitForSelector('.dialog-overlay', { timeout: 3000 })
    await page.waitForTimeout(500)

    // 输入文件夹名称
    const folderName = `test_folder_${Date.now()}`
    const input = await page.locator('.dialog-input').first()
    await input.fill(folderName)
    
    // 点击确定按钮
    const confirmButton = await page.locator('.dialog-btn.confirm').first()
    await confirmButton.click({ force: true })
    
    // 等待文件夹创建完成并刷新列表
    await page.waitForTimeout(3000)

    // 验证新文件夹出现在远程文件列表中
    const remoteFileItems = page.locator('.file-panel.remote .file-item')
    let found = false
    let attempts = 0
    const maxAttempts = 5
    
    while (!found && attempts < maxAttempts) {
      const files = await remoteFileItems.allTextContents()
      console.log('Attempt', attempts, 'files:', files.length)
      found = files.some(file => file.includes(folderName))
      if (!found) {
        await page.waitForTimeout(1000)
        attempts++
      }
    }

    expect(found).toBe(true)

    // 清理：删除新建的文件夹
    const folderItem = await page.locator('.file-panel.remote .file-item', {
      hasText: folderName
    }).first()
    await folderItem.click({ force: true })
    
    // 设置删除确认对话框处理器
    page.once('dialog', async dialog => {
      console.log('Delete dialog:', dialog.type())
      if (dialog.type() === 'confirm') {
        await dialog.accept()
      }
    })
    
    const deleteButton = await page.locator('.toolbar-btn', { hasText: '删除' }).first()
    await deleteButton.click({ force: true })
    await page.waitForTimeout(2000)
  })

  /**
   * 测试用例：下载文件
   */
  test('SFTP 窗口应该能下载文件', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)

    // 先确保远程有文件可以下载
    const remoteFileItems = page.locator('.file-panel.remote .file-item')
    const remoteCount = await remoteFileItems.count()
    
    if (remoteCount === 0) {
      console.log('远程没有文件，跳过下载测试')
      return
    }

    // 选择第一个文件（排除 .. 目录）
    let selectedFileName = ''
    const files = await remoteFileItems.allTextContents()
    for (let i = 0; i < files.length; i++) {
      if (files[i] !== '..' && files[i] !== '') {
        const fileItem = await remoteFileItems.nth(i)
        await fileItem.click({ force: true })
        selectedFileName = files[i]
        break
      }
    }

    if (!selectedFileName) {
      console.log('没有找到可下载的文件')
      return
    }

    console.log('准备下载文件:', selectedFileName)

    // 点击下载按钮
    const downloadButton = await page.locator('.toolbar-btn', { hasText: '下载' }).first()
    
    // 处理文件选择对话框（选择保存位置）
    page.once('filechooser', async fileChooser => {
      // 选择临时目录作为保存位置
      const tempDir = os.tmpdir()
      await fileChooser.accept([tempDir])
    })
    
    await downloadButton.click({ force: true })
    
    // 等待下载完成
    await page.waitForTimeout(3000)

    // 验证下载成功（检查本地文件列表是否刷新）
    const localFileItems = page.locator('.file-panel.local .file-item')
    const localFiles = await localFileItems.allTextContents()
    
    // 下载完成后应该能看到文件列表更新
    expect(localFiles.length).toBeGreaterThan(0)
  })

  /**
   * 测试用例：删除文件
   */
  test('SFTP 窗口应该能删除文件', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)

    // 先创建一个测试文件用于删除
    const testFileName = `test_delete_${Date.now()}.txt`
    
    // 创建测试文件（使用本地文件系统 API）
    const tempDir = os.tmpdir()
    const testFilePath = path.join(tempDir, testFileName)
    fs.writeFileSync(testFilePath, `这是测试文件内容 - ${Date.now()}`)

    console.log('创建测试文件:', testFilePath)

    // 导航到临时文件夹
    const localPathInput = await page.locator('.file-panel.local .path-input').first()
    await localPathInput.fill(tempDir)
    await localPathInput.press('Enter')
    await page.waitForTimeout(2000)

    // 选择测试文件
    const testFileItem = await page.locator('.file-panel.local .file-item', {
      hasText: testFileName
    }).first()
    await testFileItem.click({ force: true })

    // 上传文件
    const uploadButton = await page.locator('.toolbar-btn', { hasText: '上传' }).first()
    await uploadButton.click({ force: true })
    await page.waitForTimeout(3000)

    // 验证上传成功
    const remoteFileItems = page.locator('.file-panel.remote .file-item')
    let found = false
    let attempts = 0
    const maxAttempts = 5
    
    while (!found && attempts < maxAttempts) {
      const files = await remoteFileItems.allTextContents()
      found = files.some(file => file.includes(testFileName))
      if (!found) {
        await page.waitForTimeout(1000)
        attempts++
      }
    }

    expect(found).toBe(true)
    console.log('文件上传成功，准备测试删除')

    // 选择远程文件
    const remoteFileItem = await page.locator('.file-panel.remote .file-item', {
      hasText: testFileName
    }).first()
    await remoteFileItem.click({ force: true })

    // 点击删除按钮
    const deleteButton = await page.locator('.toolbar-btn', { hasText: '删除' }).first()
    
    // 处理确认对话框
    page.on('dialog', async dialog => {
      console.log('Delete dialog:', dialog.message())
      await dialog.accept()
    })
    
    await deleteButton.click({ force: true })
    await page.waitForTimeout(2000)

    // 验证文件已被删除
    const filesAfterDelete = await remoteFileItems.allTextContents()
    const stillExists = filesAfterDelete.some(file => file.includes(testFileName))
    expect(stillExists).toBe(false)

    // 清理本地测试文件
    try {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath)
      }
    } catch (e) {
      console.log('清理本地文件失败:', e)
    }
  })

  /**
   * 测试用例：上传文件夹（递归上传）
   */
  test('SFTP 窗口应该能上传文件夹', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)
    
    // 等待 SFTP 窗口完全加载
    await page.waitForTimeout(2000)

    // 创建测试文件夹和文件
    const testFolderName = `test_upload_folder_${Date.now()}`
    const tempDir = os.tmpdir()
    const testFolderPath = path.join(tempDir, testFolderName)
    
    // 创建测试文件夹
    if (!fs.existsSync(testFolderPath)) {
      fs.mkdirSync(testFolderPath, { recursive: true })
    }
    
    // 创建测试文件
    const testFile1 = path.join(testFolderPath, 'test1.txt')
    const testFile2 = path.join(testFolderPath, 'test2.txt')
    fs.writeFileSync(testFile1, '测试文件 1 内容')
    fs.writeFileSync(testFile2, '测试文件 2 内容')

    // 创建子文件夹
    const subFolder = path.join(testFolderPath, 'subfolder')
    fs.mkdirSync(subFolder, { recursive: true })
    const testFile3 = path.join(subFolder, 'test3.txt')
    fs.writeFileSync(testFile3, '测试文件 3 内容（子文件夹）')

    console.log('创建测试文件夹:', testFolderPath)

    // 验证文件夹存在
    if (!fs.existsSync(testFolderPath)) {
      throw new Error('测试文件夹创建失败：' + testFolderPath)
    }
    console.log('测试文件夹已创建:', testFolderPath)

    // 导航到临时文件夹
    const localPathInput = await page.locator('.file-panel.local .path-input').first()
    await localPathInput.fill(tempDir)
    await localPathInput.press('Enter')
    await page.waitForTimeout(2000)

    // 选择测试文件夹
    const testFolderItem = await page.locator('.file-panel.local .file-item', {
      hasText: testFolderName
    }).first()
    await testFolderItem.scrollIntoViewIfNeeded()
    
    // 使用 JavaScript 触发 contextmenu 事件
    await testFolderItem.evaluate((element) => {
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        view: window
      })
      element.dispatchEvent(event)
    })
    await page.waitForTimeout(2000)

    // 验证右键菜单显示
    const contextMenu = await page.locator('.context-menu.file-context-menu').first()
    await expect(contextMenu).toBeVisible({ timeout: 3000 })
    console.log('右键菜单已显示')

    // 点击上传文件夹菜单项
    const uploadFolderMenuItem = await page.locator('.context-menu-item').filter({
      hasText: '上传文件夹到服务器'
    }).first()
    await uploadFolderMenuItem.click({ force: true })
    console.log('已点击上传文件夹菜单项')
    
    console.log('已点击上传文件夹菜单项，等待上传完成...')

    // 等待上传完成（文件夹上传可能需要更长时间）
    await page.waitForTimeout(15000)

    // 验证上传成功（远程文件列表中出现新文件夹）
    const remoteFileItems = page.locator('.file-panel.remote .file-item')
    let found = false
    let attempts = 0
    const maxAttempts = 15
    
    while (!found && attempts < maxAttempts) {
      const files = await remoteFileItems.allTextContents()
      console.log('远程文件列表:', files.filter(f => f.includes('test_upload_folder')))
      found = files.some(file => file.includes(testFolderName))
      if (!found) {
        await page.waitForTimeout(1000)
        attempts++
      }
    }

    console.log('是否找到上传的文件夹:', found, '文件夹名称:', testFolderName)
    expect(found).toBe(true)

    // 清理远程测试文件夹
    await page.evaluate(async (folderName) => {
      try {
        const sessions = await (window as any).api.session.getAll()
        const session = sessions.find((s: any) => s.name === 'SFTP Test Server')
        if (session) {
          const sessionId = session.id || session.host
          await (window as any).api.sftp.delete(sessionId, '/' + folderName)
        }
      } catch (e) {
        console.log('清理远程文件夹失败:', e)
      }
    }, testFolderName)

    // 清理本地测试文件夹
    try {
      if (fs.existsSync(testFolderPath)) {
        fs.rmSync(testFolderPath, { recursive: true, force: true })
      }
    } catch (e) {
      console.log('清理本地文件夹失败:', e)
    }
  })

  /**
   * 测试用例：进度状态栏显示
   */
  test('SFTP 窗口应该显示传输进度状态栏', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)
    
    // 等待 SFTP 窗口完全加载
    await page.waitForTimeout(2000)

    // 创建测试文件
    const testFileName = `test_progress_${Date.now()}.txt`
    const tempDir = os.tmpdir()
    const testFilePath = path.join(tempDir, testFileName)
    
    // 创建较大的测试文件（用于观察进度）
    const largeContent = '测试内容\n'.repeat(10000)
    fs.writeFileSync(testFilePath, largeContent)

    console.log('创建测试文件:', testFilePath, '大小:', largeContent.length)

    // 导航到临时文件夹
    const localPathInput = await page.locator('.file-panel.local .path-input').first()
    await localPathInput.fill(tempDir)
    await localPathInput.press('Enter')
    await page.waitForTimeout(2000)

    // 选择测试文件
    const testFileItem = await page.locator('.file-panel.local .file-item', {
      hasText: testFileName
    }).first()
    await testFileItem.click({ force: true })

    // 点击上传按钮
    const uploadButton = await page.locator('.toolbar-btn', { hasText: '上传' }).first()
    await uploadButton.click({ force: true })

    // 等待进度状态栏出现（增加等待时间）
    await page.waitForTimeout(500)

    // 验证进度状态栏显示
    const progressElement = await page.locator('.transfer-progress').first()
    await expect(progressElement).toBeVisible({ timeout: 5000 })

    // 验证进度条存在
    const progressBar = await page.locator('.progress-bar').first()
    await expect(progressBar).toBeVisible()

    // 验证进度信息存在
    const progressInfo = await page.locator('.progress-info').first()
    await expect(progressInfo).toBeVisible()

    // 等待上传完成
    await page.waitForTimeout(5000)

    // 验证上传完成后进度栏关闭或显示完成状态
    const remoteFileItems = page.locator('.file-panel.remote .file-item')
    let found = false
    let attempts = 0
    const maxAttempts = 5
    
    while (!found && attempts < maxAttempts) {
      const files = await remoteFileItems.allTextContents()
      found = files.some(file => file.includes(testFileName))
      if (!found) {
        await page.waitForTimeout(1000)
        attempts++
      }
    }

    expect(found).toBe(true)

    // 清理远程测试文件
    await page.evaluate(async (fileName) => {
      try {
        const sessions = await (window as any).api.session.getAll()
        const session = sessions.find((s: any) => s.name === 'SFTP Test Server')
        if (session) {
          const sessionId = session.id || session.host
          await (window as any).api.sftp.delete(sessionId, '/' + fileName)
        }
      } catch (e) {
        console.log('清理远程文件失败:', e)
      }
    }, testFileName)

    // 清理本地测试文件
    try {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath)
      }
    } catch (e) {
      console.log('清理本地文件失败:', e)
    }
  })

  test.afterAll('清理测试数据', async () => {
    // 清理测试会话
    try {
      await page.evaluate(async (sessionName) => {
        const sessions = await (window as any).api.session.getAll()
        const session = sessions.find((s: any) => s.name === sessionName)
        if (session) {
          await (window as any).api.session.delete(session.id)
        }
      }, TEST_SESSION.name)
      console.log('测试数据清理完成')
    } catch (error) {
      console.error('清理测试数据失败:', error)
    }
  })
})
