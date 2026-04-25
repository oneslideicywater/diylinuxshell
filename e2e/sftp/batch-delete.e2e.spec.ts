/**
 * 批量删除功能测试（本地 + 远程）
 * 
 * 🎯 测试目标：
 * 1. ✅ 验证本地批量删除是否为每个选中项创建独立 TransferTask
 * 2. ✅ 验证远程批量删除是否为每个选中项创建独立 TransferTask
 * 3. ✅ 验证混合选择（文件+文件夹）的批量删除
 * 
 * @module e2e/sftp/batch-delete-test
 */

import { test, expect, _electron as electron } from '@playwright/test'
import path from 'path'
import * as fs from 'fs'

// 测试会话配置
const TEST_SESSION = {
  name: 'Batch Delete Test',
  host: '192.168.10.24',
  port: 22,
  username: 'root',
  password: 'One.00000'
}

// 测试目录（D盘）
const TEST_LOCAL_DIR = 'D:/test-batch-delete'
const TEST_REMOTE_DIR = '/tmp/test-batch-delete'

// 日志收集
const consoleMessages: any[] = []
const pageErrors: any[] = []
let capturedSftpConnectionId: string | null = null

/**
 * 创建本地测试环境
 */
async function setupLocalTestEnvironment(): Promise<void> {
  if (fs.existsSync(TEST_LOCAL_DIR)) {
    fs.rmSync(TEST_LOCAL_DIR, { recursive: true })
  }

  fs.mkdirSync(TEST_LOCAL_DIR, { recursive: true })

  // 创建 4 个文件 + 2 个文件夹
  for (let i = 1; i <= 4; i++) {
    fs.writeFileSync(`${TEST_LOCAL_DIR}/file${i}.txt`, `Content of file ${i}`)
  }

  const folder1 = `${TEST_LOCAL_DIR}/folder-A`
  fs.mkdirSync(folder1, { recursive: true })
  fs.writeFileSync(`${folder1}/inner-a1.txt`, 'Inner A1')

  const folder2 = `${TEST_LOCAL_DIR}/folder-B`
  fs.mkdirSync(folder2, { recursive: true })
  fs.writeFileSync(`${folder2}/inner-b1.txt`, 'Inner B1')
  fs.writeFileSync(`${folder2}/inner-b2.txt`, 'Inner B2')

  console.log('[Setup] ✅ 本地测试环境已准备完成（4 文件 + 2 文件夹）')
}

/**
 * 清理本地测试环境
 */
async function cleanupLocalTestEnvironment(): Promise<void> {
  if (fs.existsSync(TEST_LOCAL_DIR)) {
    fs.rmSync(TEST_LOCAL_DIR, { recursive: true })
    console.log('[Cleanup] ✅ 本地测试环境已清理')
  }
}

/**
 * 打开 SFTP 窗口
 */
async function openSFTPWindow(page: any): Promise<void> {
  await page.waitForSelector('.session-list', { timeout: 10000 })

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
  
  await sessionItem.scrollIntoViewIfNeeded({ force: true })
  await sessionItem.hover({ force: true })

  const sftpButton = await sessionItem.locator('.action-btn.sftp').first()
  await sftpButton.click({ force: true })

  await page.waitForSelector('.sftp-overlay', { timeout: 10000 })
  await page.waitForTimeout(3000)
  
  console.log('[SFTP] ✅ SFTP 窗口已打开')
}

/**
 * 导航到本地目录
 */
async function navigateToLocalDir(page: any, dirPath: string): Promise<void> {
  const localPathInput = await page.locator('.file-panel.local .panel-path .path-input').first()
  await localPathInput.fill('')
  await localPathInput.fill(dirPath)
  await localPathInput.press('Enter')
  await page.waitForTimeout(1000)
}

/**
 * 导航到远程目录
 */
async function navigateToRemoteDir(page: any, dirPath: string): Promise<void> {
  const remotePathInput = await page.locator('.file-panel.remote .panel-path .path-input').first()
  await remotePathInput.fill('')
  await remotePathInput.fill(dirPath)
  await remotePathInput.press('Enter')
  await page.waitForTimeout(2000)
}

/**
 * Ctrl+Click 多选（本地面板）
 */
async function multiSelectLocalFiles(page: any, fileNames: string[]): Promise<void> {
  for (let i = 0; i < fileNames.length; i++) {
    const fileName = fileNames[i]
    
    const fileItem = await page.locator(`.file-panel.local .file-item`, {
      hasText: fileName
    }).first()
    
    await fileItem.scrollIntoViewIfNeeded({ force: true })
    
    if (i === 0) {
      await fileItem.click({ force: true })
    } else {
      await fileItem.click({ modifiers: ['Control'], force: true })
    }
    
    await page.waitForTimeout(200)
  }
  
  console.log(`[Select] ✅ 已选择 ${fileNames.length} 个本地项目`)
}

/**
 * Ctrl+Click 多选（远程面板）
 */
async function multiSelectRemoteFiles(page: any, fileNames: string[]): Promise<void> {
  for (let i = 0; i < fileNames.length; i++) {
    const fileName = fileNames[i]
    
    const fileItem = await page.locator(`.file-panel.remote .file-item`, {
      hasText: fileName
    }).first()
    
    await fileItem.scrollIntoViewIfNeeded({ force: true })
    
    if (i === 0) {
      await fileItem.click({ force: true })
    } else {
      await fileItem.click({ modifiers: ['Control'], force: true })
    }
    
    await page.waitForTimeout(200)
  }
  
  console.log(`[Select] ✅ 已选择 ${fileNames.length} 个远程项目`)
}

/**
 * 右键点击第一个选中项并选择操作（本地面板）
 */
async function rightClickAndSelectActionOnLocal(page: any, actionName: string): Promise<void> {
  const firstSelectedItem = await page.locator('.file-panel.local .file-item.selected').first()
  await firstSelectedItem.click({ button: 'right', force: true })
  await page.waitForTimeout(500)
  
  const actionMenuItem = await page.locator('.context-menu-item', { hasText: new RegExp(actionName) }).first()
  await actionMenuItem.click({ force: true })
  console.log(`[Action] ✅ 已触发"${actionName}"操作（本地面板）`)
}

/**
 * 右键点击第一个选中项并选择操作（远程面板）
 */
async function rightClickAndSelectActionOnRemote(page: any, actionName: string): Promise<void> {
  const firstSelectedItem = await page.locator('.file-panel.remote .file-item.selected').first()
  await firstSelectedItem.click({ button: 'right', force: true })
  await page.waitForTimeout(500)
  
  const actionMenuItem = await page.locator('.context-menu-item', { hasText: new RegExp(actionName) }).first()
  await actionMenuItem.click({ force: true })
  console.log(`[Action] ✅ 已触发"${actionName}"操作（远程面板）`)
}

/**
 * 获取当前 TransferTask 数量
 */
async function getTransferTaskCount(page: any): Promise<number> {
  return await page.evaluate(() => {
    const taskElements = document.querySelectorAll('.transfer-task-item')
    return taskElements.length
  })
}

/**
 * 通过 SFTP API 创建远程测试环境（复用 batch-download 的测试数据）
 */
async function setupRemoteTestEnvironment(page: any): Promise<void> {
  console.log('[Setup] 正在创建远程测试环境...')
  
  const tempLocalDir = 'D:/temp-delete-test-files'
  if (fs.existsSync(tempLocalDir)) {
    fs.rmSync(tempLocalDir, { recursive: true })
  }
  fs.mkdirSync(tempLocalDir, { recursive: true })
  
  for (let i = 1; i <= 4; i++) {
    fs.writeFileSync(`${tempLocalDir}/remote-file${i}.txt`, `Remote file ${i} content`)
  }
  
  fs.writeFileSync(`${tempLocalDir}/inner-a1.txt`, 'Inner A1 content')
  fs.writeFileSync(`${tempLocalDir}/inner-b1.txt`, 'Inner B1 content')
  fs.writeFileSync(`${tempLocalDir}/inner-b2.txt`, 'Inner B2 content')
  
  console.log(`[Setup] ✅ 本地临时文件已创建 (${tempLocalDir})`)
  
  try {
    const setupResult = await page.evaluate(async (config) => {
      const results = []
      
      try {
        let connectionId = null
        
        // 方法 1: 从全局 window 对象获取
        if ((window as any).__SFTP_CONNECTION_ID__) {
          connectionId = (window as any).__SFTP_CONNECTION_ID__
        }
        
        // 方法 2: 从 Pinia terminal store 获取当前活动的 SFTP 标签
        if (!connectionId) {
          try {
            const possibleStores = [
              (window as any).__VUE_PINIA__?._s,
              (window as any).pinia?._s,
              (window as any).__PINIA_STORES__
            ]
            
            for (const stores of possibleStores) {
              if (!stores) continue
              
              if (stores instanceof Map) {
                for (const [key, store] of stores.entries()) {
                  const s = store as any
                  if (s.tabs && Array.isArray(s.tabs)) {
                    const sftpTab = s.tabs.find((tab: any) => tab.type === 'sftp' && tab.sftpConnectionId)
                    if (sftpTab?.sftpConnectionId) {
                      connectionId = sftpTab.sftpConnectionId
                      break
                    }
                  }
                }
                if (connectionId) break
              }
            }
          } catch (storeError: any) {
            console.warn('[Setup] 方法2失败（从 store 获取）:', storeError.message)
          }
        }
        
        if (!connectionId) {
          throw new Error('无法获取 SFTP 连接 ID，请确保 SFTP 窗口已打开并连接成功')
        }
        
        console.log('[Setup] 使用连接 ID:', connectionId)
        console.log('[Setup] 创建远程目录...')
        
        const mkdirResult1 = await (window as any).api.sftp.mkdir(connectionId, config.remoteDir)
        results.push({ action: 'mkdir-main', success: mkdirResult1.success, error: mkdirResult1.error })
        
        if (!mkdirResult1.success) {
          throw new Error(`Failed to create main directory: ${mkdirResult1.error}`)
        }
        
        const mkdirResult2 = await (window as any).api.sftp.mkdir(connectionId, `${config.remoteDir}/remote-folder-A`)
        results.push({ action: 'mkdir-folder-A', success: mkdirResult2.success, error: mkdirResult2.error })
        
        const mkdirResult3 = await (window as any).api.sftp.mkdir(connectionId, `${config.remoteDir}/remote-folder-B`)
        results.push({ action: 'mkdir-folder-B', success: mkdirResult3.success, error: mkdirResult3.error })
        
        console.log('[Setup] ✅ 远程目录结构已创建')
        
        console.log('[Setup] 开始上传测试文件...')
        
        for (let i = 1; i <= 4; i++) {
          const uploadResult = await (window as any).api.sftp.upload(
            connectionId,
            `${config.localDir}/remote-file${i}.txt`,
            `${config.remoteDir}/remote-file${i}.txt`
          )
          
          results.push({
            action: `upload-file${i}`,
            success: uploadResult.success,
            error: uploadResult.error
          })
          
          if (!uploadResult.success) {
            throw new Error(`Failed to upload remote-file${i}.txt: ${uploadResult.error}`)
          }
          
          await new Promise(resolve => setTimeout(resolve, 300))
        }
        
        const uploadTasks = [
          { local: 'inner-a1.txt', remote: 'remote-folder-A/inner-a1.txt' },
          { local: 'inner-b1.txt', remote: 'remote-folder-B/inner-b1.txt' },
          { local: 'inner-b2.txt', remote: 'remote-folder-B/inner-b2.txt' }
        ]
        
        for (const task of uploadTasks) {
          const uploadResult = await (window as any).api.sftp.upload(
            connectionId,
            `${config.localDir}/${task.local}`,
            `${config.remoteDir}/${task.remote}`
          )
          
          results.push({
            action: `upload-${task.local}`,
            success: uploadResult.success,
            error: uploadResult.error
          })
          
          if (!uploadResult.success) {
            throw new Error(`Failed to upload ${task.local}: ${uploadResult.error}`)
          }
          
          await new Promise(resolve => setTimeout(resolve, 300))
        }
        
        console.log('[Setup] ✅ 所有测试文件已上传到远程服务器')
        
        return {
          success: true,
          results,
          message: 'Remote test environment created successfully'
        }
        
      } catch (error: any) {
        console.error('[Setup] ❌ 设置失败:', error.message)
        return {
          success: false,
          error: error.message,
          results
        }
      }
    }, {
      remoteDir: TEST_REMOTE_DIR,
      localDir: tempLocalDir
    })
    
    if (!setupResult.success) {
      throw new Error(setupResult.error || 'Unknown error during setup')
    }
    
    console.log('[Setup] ✅ 远程测试环境已准备完成（4 文件 + 2 文件夹）')
    console.log(`[Setup] 远程路径: ${TEST_REMOTE_DIR}`)
    
  } finally {
    if (fs.existsSync(tempLocalDir)) {
      fs.rmSync(tempLocalDir, { recursive: true })
      console.log('[Setup] 🧹 本地临时文件已清理')
    }
  }
}

/**
 * 清理远程测试环境
 */
async function cleanupRemoteTestEnvironment(page: any): Promise<void> {
  try {
    await page.evaluate(async (remoteDir) => {
      await (window as any).api.sftp.delete(remoteDir)
    }, TEST_REMOTE_DIR)
    
    console.log('[Cleanup] ✅ 远程测试环境已清理')
  } catch (error: any) {
    console.warn('[Cleanup] ⚠️ 清理远程环境失败:', error.message)
  }
}

test.describe('批量删除功能测试（本地 + 远程）', () => {
  let app: any
  let page: any

  test.beforeAll(async () => {
    app = await electron.launch({
      args: [path.join(__dirname, '../../out/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      },
      stdio: 'pipe'
    })

    // 日志收集和错误处理设置
    const proc = app.process()
    proc.stdout?.on('data', (d: Buffer) => {
      const output = d.toString().trim()
      console.log('[Main]', output)
      
      // 从主进程输出中捕获 SFTP 连接 ID
      const connectMatch = output.match(/\[SFTP\] 创建连接:\s*(sftp-[^\s]+)/)
      if (connectMatch && connectMatch[1]) {
        capturedSftpConnectionId = connectMatch[1]
        console.log('[Main Process Capture] ✅ 捕获到 SFTP 连接 ID:', capturedSftpConnectionId)
        
        // 存储到页面上下文中的全局变量
        page.evaluate((cid) => {
          (window as any).__SFTP_CONNECTION_ID__ = cid
        }, capturedSftpConnectionId).catch(() => {})
      }
    })
    proc.stderr?.on('data', (d: Buffer) => console.error('[Main Err]', d.toString().trim()))

    page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    page.on('console', (msg: any) => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        timestamp: Date.now()
      }
      consoleMessages.push(message)
      
      if (msg.type() === 'error') {
        console.error(`[Console Error] ${msg.text()}`)
        pageErrors.push(message)
      }
      
      if (msg.text().includes('[delete]') || msg.text().includes('[local]') || msg.text().includes('[SftpTransfer]')) {
        console.log(`[${msg.text().includes('[delete]') ? 'Delete' : msg.text().includes('[local]') ? 'Local' : 'Transfer'}] ${msg.text()}`)
      }
      
      // 捕获 SFTP 连接创建日志，提取 connectionId
      const connectLogMatch = msg.text().match(/\[SFTP\] 创建连接:\s*(sftp-[^\s]+)/)
      if (connectLogMatch && connectLogMatch[1]) {
        // 存储到页面上下文中的全局变量
        page.evaluate((cid) => {
          (window as any).__SFTP_CONNECTION_ID__ = cid
          console.log('[Auto Capture] ✅ 已自动捕获 SFTP 连接 ID:', cid)
        }, connectLogMatch[1]).catch(() => {})
        
        console.log('[Console Listener] ✅ 捕获到 SFTP 连接 ID:', connectLogMatch[1])
      }
    })

    page.on('pageerror', (error: Error) => {
      console.error(`[Page Error] ${error.message}`)
      pageErrors.push(error)
    })

    await cleanupLocalTestEnvironment()
    
    fs.mkdirSync(TEST_LOCAL_DIR, { recursive: true })
    await setupLocalTestEnvironment()
    
    await openSFTPWindow(page)
    await setupRemoteTestEnvironment(page)
  })

  test.afterAll(async () => {
    await cleanupLocalTestEnvironment()
    await cleanupRemoteTestEnvironment(page)
    
    if (app) {
      await app.close()
    }

    console.log('\n' + '='.repeat(60))
    console.log('📊 批量删除测试结果汇总')
    console.log('='.repeat(60))
    
    if (pageErrors.length > 0) {
      console.error(`\n❌ 共捕获到 ${pageErrors.length} 个错误:`)
      pageErrors.forEach((err: any, idx: number) => {
        console.error(`  ${idx + 1}. ${err.message || err.text}`)
      })
    } else {
      console.log('\n✅ 未捕获到任何错误')
    }

    const deleteLogs = consoleMessages.filter((msg: any) =>
      msg.text?.includes('[delete]') || msg.text?.includes('[local]')
    )
    console.log(`\n📋 删除相关日志 (${deleteLogs.length} 条)`)
    deleteLogs.slice(-20).forEach((log: any, idx: number) => {
      console.log(`  ${idx + 1}. ${log.text}`)
    })
  })

  /**
   * 🔥 测试 1：本地批量删除 - 验证多 TransferTask 架构
   */
  test('🔥 本地批量删除：多选 → 多 TransferTask → 全部删除', async () => {
    console.log('\n' + '='.repeat(60))
    console.log('🔥 本地批量删除测试：多选 → 多 TransferTask → 全部删除')
    console.log('='.repeat(60))
    
    await navigateToLocalDir(page, TEST_LOCAL_DIR)
    
    await page.waitForSelector('.file-panel.local .file-item', { timeout: 5000 })
    await page.waitForTimeout(500)
    
    // 记录初始状态
    const initialTaskCount = await getTransferTaskCount(page)
    console.log(`\n[Initial State] 初始任务数: ${initialTaskCount}`)
    
    // 步骤 1：选择 5 个项目（3 文件 + 2 文件夹）
    console.log('\n[Step 1] 选择 5 个本地项目（3 文件 + 2 文件夹）...')
    await multiSelectLocalFiles(page, ['file1.txt', 'folder-A', 'file2.txt', 'folder-B', 'file3.txt'])
    
    const selectedCount = await page.locator('.file-panel.local .file-item.selected').count()
    console.log(`  ✓ 选中了 ${selectedCount} 个项目`)
    expect(selectedCount).toBeGreaterThanOrEqual(5)
    
    // 步骤 2：右键并选择"删除"
    console.log('\n[Step 2] 右键 → 选择"删除"...')
    
    // 监听确认对话框
    page.once('dialog', async dialog => {
      console.log('[Dialog] 检测到确认对话框，点击确定')
      await dialog.accept()
    })
    
    await rightClickAndSelectActionOnLocal(page, '删除')
    
    // 步骤 3：监控 TransferTask 创建过程
    console.log('\n[Step 3] 监控 TransferTask 创建过程...')
    
    let maxTaskCount = 0
    const taskCreationLogs: string[] = []
    
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000)
      
      // 收集删除相关的日志
      const recentDeleteLogs = consoleMessages.slice(-50).filter((msg: any) =>
        msg.text?.includes('删除任务已创建') || msg.text?.includes('[local] ✅')
      )
      
      recentDeleteLogs.forEach((log: any) => {
        if (!taskCreationLogs.includes(log.text)) {
          taskCreationLogs.push(log.text)
        }
      })
      
      const currentTaskCount = await getTransferTaskCount(page)
      maxTaskCount = Math.max(maxTaskCount, currentTaskCount)
      
      console.log(`  [${i + 1}s] 当前任务数: ${currentTaskCount}, 峰值: ${maxTaskCount}, 日志数: ${taskCreationLogs.length}`)
      
      // 如果已经创建了足够的任务并且执行完毕，退出循环
      if (maxTaskCount >= initialTaskCount + 5 && i >= 10) break
      
      // 如果长时间没有新任务创建，也退出
      if (i > 10 && maxTaskCount <= initialTaskCount) break
    }
    
    // 步骤 4：验证最终结果
    console.log('\n[Final Result]')
    console.log(`  选中项: 5 (3 文件 + 2 文件夹)`)
    console.log(`  峰值任务数: ${maxTaskCount - initialTaskCount}`)
    console.log(`  任务创建日志数: ${taskCreationLogs.length}`)
    
    // 显示所有捕获到的任务创建日志
    console.log('\n📋 捕获到的删除任务创建日志:')
    taskCreationLogs.forEach((log: string, idx: number) => {
      console.log(`  ${idx + 1}. ${log}`)
    })
    
    // 验证是否创建了多个任务（期望至少 5 个）
    const totalNewTasks = maxTaskCount - initialTaskCount
    console.log(`\n✅ 本地批量删除: 新建 ${totalNewTasks} 个任务 (期望 ≥ 5)`)
    
    expect(totalNewTasks).toBeGreaterThanOrEqual(5)
    
    // 验证每个选中项都创建了独立的任务
    expect(taskCreationLogs.length).toBeGreaterThanOrEqual(5)
    
    console.log('\n✅ PASS: 本地批量删除使用多 Task 架构！')
  })

  /**
   * 🔥 测试 2：远程批量删除 - 验证多 TransferTask 架构
   */
  test('🔥 远程批量删除：多选 → 多 TransferTask → 全部删除', async () => {
    console.log('\n' + '='.repeat(60))
    console.log('🔥 远程批量删除测试：多选 → 多 TransferTask → 全部删除')
    console.log('='.repeat(60))
    
    await navigateToRemoteDir(page, TEST_REMOTE_DIR)
    
    await page.waitForSelector('.file-panel.remote .file-item', { timeout: 5000 })
    await page.waitForTimeout(500)
    
    // 记录初始状态
    const initialTaskCount = await getTransferTaskCount(page)
    console.log(`\n[Initial State] 初始任务数: ${initialTaskCount}`)
    
    // 步骤 1：选择 5 个项目（3 文件 + 2 文件夹）
    console.log('\n[Step 1] 选择 5 个远程项目（3 文件 + 2 文件夹）...')
    await multiSelectRemoteFiles(page, ['remote-file1.txt', 'remote-folder-A', 'remote-file2.txt', 'remote-folder-B', 'remote-file3.txt'])
    
    const selectedCount = await page.locator('.file-panel.remote .file-item.selected').count()
    console.log(`  ✓ 选中了 ${selectedCount} 个项目`)
    expect(selectedCount).toBeGreaterThanOrEqual(5)
    
    // 步骤 2：右键并选择"删除"
    console.log('\n[Step 2] 右键 → 选择"删除"...')
    
    // 监听确认对话框
    page.once('dialog', async dialog => {
      console.log('[Dialog] 检测到确认对话框，点击确定')
      await dialog.accept()
    })
    
    await rightClickAndSelectActionOnRemote(page, '删除')
    
    // 步骤 3：监控 TransferTask 创建过程
    console.log('\n[Step 3] 监控 TransferTask 创建过程...')
    
    let maxTaskCount = 0
    const taskCreationLogs: string[] = []
    
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000)
      
      // 收集删除相关的日志
      const recentDeleteLogs = consoleMessages.slice(-50).filter((msg: any) =>
        msg.text?.includes('删除任务已创建') || msg.text?.includes('[delete] ✅')
      )
      
      recentDeleteLogs.forEach((log: any) => {
        if (!taskCreationLogs.includes(log.text)) {
          taskCreationLogs.push(log.text)
        }
      })
      
      const currentTaskCount = await getTransferTaskCount(page)
      maxTaskCount = Math.max(maxTaskCount, currentTaskCount)
      
      console.log(`  [${i + 1}s] 当前任务数: ${currentTaskCount}, 峰值: ${maxTaskCount}, 日志数: ${taskCreationLogs.length}`)
      
      // 如果已经创建了足够的任务并且执行完毕，退出循环
      if (maxTaskCount >= initialTaskCount + 5 && i >= 10) break
      
      // 如果长时间没有新任务创建，也退出
      if (i > 10 && maxTaskCount <= initialTaskCount) break
    }
    
    // 步骤 4：验证最终结果
    console.log('\n[Final Result]')
    console.log(`  选中项: 5 (3 文件 + 2 文件夹)`)
    console.log(`  峰值任务数: ${maxTaskCount - initialTaskCount}`)
    console.log(`  任务创建日志数: ${taskCreationLogs.length}`)
    
    // 显示所有捕获到的任务创建日志
    console.log('\n📋 捕获到的删除任务创建日志:')
    taskCreationLogs.forEach((log: string, idx: number) => {
      console.log(`  ${idx + 1}. ${log}`)
    })
    
    // 验证是否创建了多个任务（期望至少 5 个）
    const totalNewTasks = maxTaskCount - initialTaskCount
    console.log(`\n✅ 远程批量删除: 新建 ${totalNewTasks} 个任务 (期望 ≥ 5)`)
    
    expect(totalNewTasks).toBeGreaterThanOrEqual(5)
    
    // 验证每个选中项都创建了独立的任务
    expect(taskCreationLogs.length).toBeGreaterThanOrEqual(5)
    
    console.log('\n✅ PASS: 远程批量删除使用多 Task 架构！')
  })
})

/*
 * 文档版本: v1.0
 * 最后更新: 2026-04-20
 * 测试框架: Playwright + Electron
 * 测试模式: 生产模式（out/main/index.js）
 */
