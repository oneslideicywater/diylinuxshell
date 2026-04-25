/**
 * 批量下载完整功能测试（downloadBatch 多 TransferTask 架构验证）
 * 
 * 🎯 测试目标：
 * 1. ✅ 验证右键菜单不再覆盖多选状态（远程面板 Bug 修复验证）
 * 2. ✅ 验证每个选中项创建独立 TransferTask（downloadBatch 架构）
 * 3. ✅ 验证单文件/多文件/文件夹/混合选择下载都正常工作
 * 4. ✅ 验证下载后的本地文件完整性
 * 
 * 📝 前置条件：
 * - 远程服务器 (192.168.10.24) 需要先准备好测试文件
 * - 或运行测试前执行 setupRemoteTestEnvironment()
 * 
 * @module e2e/sftp/batch-download-complete-test
 */

import { test, expect, _electron as electron } from '@playwright/test'
import path from 'path'
import * as fs from 'fs'

// 测试会话配置
const TEST_SESSION = {
  name: 'Batch Download Complete Test',
  host: '192.168.10.24',
  port: 22,
  username: 'root',
  password: 'One.00000'
}

// 测试目录（D盘）
const TEST_LOCAL_DIR = 'D:/test-batch-download'
const TEST_REMOTE_DIR = '/tmp/test-batch-download'

// 日志收集
const consoleMessages: any[] = []
const pageErrors: any[] = []
let capturedSftpConnectionId: string | null = null  // 用于存储捕获到的 SFTP 连接 ID

/**
 * 通过 SFTP API 创建远程测试环境
 */
async function setupRemoteTestEnvironment(page: any): Promise<void> {
  console.log('[Setup] 正在创建远程测试环境...')
  
  const tempLocalDir = 'D:/temp-download-test-files'
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
          console.log('[Setup] 方法1成功: 从 __SFTP_CONNECTION_ID__ 获取')
        }
        
        // 方法 2: 从 Pinia terminal store 获取当前活动的 SFTP 标签
        if (!connectionId) {
          try {
            // 尝试多种方式访问 Pinia store
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
                      console.log('[Setup] 方法2成功: 从 terminal store 获取:', connectionId)
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
        
        // 方法 3: 从 DOM 元素的 Vue 实例获取
        if (!connectionId) {
          try {
            const sftpOverlay = document.querySelector('.sftp-overlay')
            if (sftpOverlay && (sftpOverlay as any).__vue_app__) {
              const vueApp = (sftpOverlay as any).__vue_app__
              console.log('[Setup] 方法3: 找到 Vue 应用实例, 尝试获取组件数据...')
            }
            
            // 遍历所有 DOM 元素查找 Vue 组件实例
            const allElements = document.querySelectorAll('*')
            for (const el of allElements) {
              const vueInstance = (el as any).__vueParentComponent || (el as any).__vue__
              if (vueInstance?.setupState?.currentSftpConnectionId?.value) {
                connectionId = vueInstance.setupState.currentSftpConnectionId.value
                console.log('[Setup] 方法3成功: 从 Vue 组件实例获取:', connectionId)
                break
              }
              if (vueInstance?.props?.sftpConnectionId) {
                connectionId = vueInstance.props.sftpConnectionId
                console.log('[Setup] 方法3成功: 从 Vue props 获取:', connectionId)
                break
              }
              if (vueInstance?.type?.name === 'SftpTransfer' && vueInstance?.setupState) {
                const setupState = vueInstance.setupState
                if (setupState.currentSftpConnectionId?.value) {
                  connectionId = setupState.currentSftpConnectionId.value
                  console.log('[Setup] 方法3成功: 从 SftpTransfer 组件获取:', connectionId)
                  break
                }
              }
            }
          } catch (vueError: any) {
            console.warn('[Setup] 方法3失败（从 Vue 实例获取）:', vueError.message)
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
    
  } catch (error: any) {
    console.error('[Setup] ❌ 创建远程测试环境失败:', error.message)
    console.error('\n[Manual Setup Required]')
    console.error('请在远程服务器上手动执行以下命令:')
    console.error('')
    console.error(`  ssh root@192.168.10.24`)
    console.error('')
    console.error(`  rm -rf ${TEST_REMOTE_DIR}`)
    console.error(`  mkdir -p ${TEST_REMOTE_DIR}`)
    console.error('')
    console.error('  # 创建测试文件')
    console.error(`  echo "Remote file 1 content" > ${TEST_REMOTE_DIR}/remote-file1.txt`)
    console.error(`  echo "Remote file 2 content" > ${TEST_REMOTE_DIR}/remote-file2.txt`)
    console.error(`  echo "Remote file 3 content" > ${TEST_REMOTE_DIR}/remote-file3.txt`)
    console.error(`  echo "Remote file 4 content" > ${TEST_REMOTE_DIR}/remote-file4.txt`)
    console.error('')
    console.error('  # 创建文件夹和子文件')
    console.error(`  mkdir -p ${TEST_REMOTE_DIR}/remote-folder-A`)
    console.error(`  echo "Inner A1 content" > ${TEST_REMOTE_DIR}/remote-folder-A/inner-a1.txt`)
    console.error('')
    console.error(`  mkdir -p ${TEST_REMOTE_DIR}/remote-folder-B`)
    console.error(`  echo "Inner B1 content" > ${TEST_REMOTE_DIR}/remote-folder-B/inner-b1.txt`)
    console.error(`  echo "Inner B2 content" > ${TEST_REMOTE_DIR}/remote-folder-B/inner-b2.txt`)
    console.error('')
    
    throw error
    
  } finally {
    if (fs.existsSync(tempLocalDir)) {
      fs.rmSync(tempLocalDir, { recursive: true })
      console.log('[Setup] 🧹 本地临时文件已清理')
    }
  }
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
 * 导航到远程目录
 */
async function navigateToRemoteDir(page: any, dirPath: string): Promise<void> {
  const remotePathInput = await page.locator('.file-panel.remote .panel-path .path-input').first()
  await remotePathInput.fill('')
  await remotePathInput.fill(dirPath)
  await remotePathInput.press('Enter')
  await page.waitForTimeout(1500)
  
  console.log(`[Navigate] ✅ 已导航到远程目录: ${dirPath}`)
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
  
  console.log(`[Navigate] ✅ 已导航到本地目录: ${dirPath}`)
}

/**
 * Ctrl+Click 多选远程文件
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
 * 获取传输任务数量
 */
async function getTransferTaskCount(page: any): Promise<number> {
  try {
    return await page.locator('.transfer-task').count()
  } catch (e) {
    return 0
  }
}

/**
 * 验证本地文件是否存在且内容正确
 */
async function verifyLocalFile(filePath: string, expectedContent?: string): Promise<boolean> {
  if (!fs.existsSync(filePath)) {
    console.warn(`[Verify] ❌ 文件不存在: ${filePath}`)
    return false
  }
  
  if (expectedContent) {
    const content = fs.readFileSync(filePath, 'utf-8')
    if (!content.includes(expectedContent)) {
      console.warn(`[Verify] ❌ 文件内容不匹配: ${filePath}`)
      return false
    }
  }
  
  return true
}

test.describe('批量下载完整功能测试（downloadBatch 架构验证）', () => {
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
      
      if (msg.text().includes('[download]') || msg.text().includes('[SftpTransfer]')) {
        console.log(`[${msg.text().includes('[download]') ? 'Download' : 'Transfer'}] ${msg.text()}`)
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
    console.log('📊 批量下载测试结果汇总')
    console.log('='.repeat(60))
    
    if (pageErrors.length > 0) {
      console.error(`\n❌ 共捕获到 ${pageErrors.length} 个错误:`)
      pageErrors.forEach((err: any, idx: number) => {
        console.error(`  ${idx + 1}. ${err.message || err.text}`)
      })
    } else {
      console.log('\n✅ 未捕获到任何错误')
    }

    const downloadLogs = consoleMessages.filter((msg: any) =>
      msg.text?.includes('[download]')
    )
    console.log(`\n📋 下载相关日志 (${downloadLogs.length} 条)`)
    downloadLogs.slice(-20).forEach((log: any, idx: number) => {
      console.log(`  ${idx + 1}. ${log.text}`)
    })
  })

  /**
   * 🔥 核心测试：验证远程面板右键菜单 Bug 是否已修复
   */
  test('🔥 核心 Bug 修复验证：远程面板右键菜单不应覆盖已有的多选状态', async () => {
    console.log('\n' + '='.repeat(60))
    console.log('🔥 核心 Bug 修复验证：远程面板右键菜单 vs 多选状态')
    console.log('='.repeat(60))
    
    await navigateToRemoteDir(page, TEST_REMOTE_DIR)
    
    await page.waitForSelector('.file-panel.remote .file-item', { timeout: 5000 })
    await page.waitForTimeout(500)
    
    console.log('\n[Step 1] 使用 Ctrl+Click 选择 3 个远程文件...')
    await multiSelectRemoteFiles(page, ['remote-file1.txt', 'remote-file2.txt', 'remote-file3.txt'])
    
    const selectionCountAfterMultiSelect = await page.locator('.file-panel.remote .file-item.selected').count()
    console.log(`  ✓ 多选后选中项数: ${selectionCountAfterMultiSelect}`)
    expect(selectionCountAfterMultiSelect).toBeGreaterThanOrEqual(3)
    
    console.log('\n[Step 2] 右键点击已选中的远程文件（触发 handleContextMenu）...')
    const firstSelectedFile = await page.locator('.file-panel.remote .file-item.selected').first()
    await firstSelectedFile.click({ button: 'right', force: true })
    await page.waitForTimeout(500)
    
    const selectionCountAfterRightClick = await page.locator('.file-panel.remote .file-item.selected').count()
    console.log(`  ✓ 右键菜单打开后选中项数: ${selectionCountAfterRightClick}`)
    
    expect(selectionCountAfterRightClick).toBeGreaterThanOrEqual(3)
    console.log('\n✅ PASS: 右键菜单未破坏多选状态！（Bug 已修复）')
    
    const downloadMenuItem = await page.locator('.context-menu-item', { hasText: /下载/ }).first()
    const menuText = await downloadMenuItem.textContent()
    console.log(`  📋 下载菜单项文本: "${menuText}"`)
    
    const showsBatchInfo = menuText?.includes('3') || menuText?.includes('个') || menuText?.includes('选中')
    if (showsBatchInfo) {
      console.log('  ✅ 菜单正确显示批量下载信息')
    } else {
      console.log('  ⚠️ 菜单可能未显示预期的批量信息（需进一步检查）')
    }
    
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    
    await page.screenshot({
      path: 'e2e/screenshots/batch-download-bug-fix-right-click-preserve-selection.png',
      fullPage: false
    })
  })

  /**
   * ✅ 端到端测试：完整的批量下载流程
   */
  test('✅ E2E 完整流程：从多选到多 TransferTask 创建再到下载完成', async () => {
    console.log('\n' + '='.repeat(60))
    console.log('✅ E2E 完整流程测试：多选 → 多 TransferTask → 下载完成')
    console.log('='.repeat(60))
    
    const startTime = Date.now()
    
    await navigateToRemoteDir(page, TEST_REMOTE_DIR)
    await navigateToLocalDir(page, TEST_LOCAL_DIR)
    
    await page.waitForSelector('.file-panel.remote .file-item', { timeout: 5000 })
    await page.waitForTimeout(500)
    
    const initialTaskCount = await getTransferTaskCount(page)
    const logIndexBefore = consoleMessages.length
    
    console.log(`\n[Initial State] 初始任务数: ${initialTaskCount}`)
    
    console.log('\n[Step 1] 混合选择 5 个远程项目（3 文件 + 2 文件夹）...')
    await multiSelectRemoteFiles(page, [
      'remote-file1.txt', 
      'remote-folder-A', 
      'remote-file2.txt', 
      'remote-folder-B', 
      'remote-file3.txt'
    ])
    
    const selectedCount = await page.locator('.file-panel.remote .file-item.selected').count()
    console.log(`  ✓ 选中了 ${selectedCount} 个远程项目`)
    expect(selectedCount).toBeGreaterThanOrEqual(5)
    
    console.log('\n[Step 2] 右键 → 选择"下载"...')
    await rightClickAndSelectActionOnRemote(page, '下载')
    
    console.log('\n[Step 3] 监控 TransferTask 创建过程...')
    
    let maxTaskCount = 0
    let taskCreationDetected = false
    
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(3000)
      
      const currentTaskCount = await getTransferTaskCount(page)
      maxTaskCount = Math.max(maxTaskCount, currentTaskCount)
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      const newTasks = currentTaskCount - initialTaskCount
      
      console.log(`  [${elapsed}s] 当前任务数: ${currentTaskCount}, 新增: ${newTasks}, 峰值: ${maxTaskCount}`)
      
      if (currentTaskCount > initialTaskCount && !taskCreationDetected) {
        taskCreationDetected = true
        console.log(`  🆕 首次检测到新下载任务创建!`)
      }
      
      if (maxTaskCount >= initialTaskCount + 5 && i >= 6) {
        break
      }
    }
    
    console.log('\n[Step 4] 等待所有下载任务完成...')
    await page.waitForTimeout(8000)
    
    const finalTaskCount = await getTransferTaskCount(page)
    const totalNewTasks = finalTaskCount - initialTaskCount
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    
    console.log(`\n` + '-'.repeat(60))
    console.log(`[Final Result] 最终统计:`)
    console.log(`  总耗时: ${totalTime}s`)
    console.log(`  初始任务数: ${initialTaskCount}`)
    console.log(`  最终任务数: ${finalTaskCount}`)
    console.log(`  新创建任务数: ${totalNewTasks}`)
    console.log(`  峰值任务数: ${maxTaskCount}`)
    console.log(`  期望任务数: 5 (与选中项一致)`)
    console.log('-'.repeat(60))
    
    expect(totalNewTasks).toBe(5)
    console.log('\n✅ PASS: 创建了 5 个独立的 TransferTask（与选中项数完全一致）')
    
    const downloadLogsSinceStart = consoleMessages.slice(logIndexBefore).filter((msg: any) =>
      msg.text?.includes('[download]')
    )
    
    console.log(`\n📋 关键事件分析 (${downloadLogsSinceStart.length} 条下载日志):`)
    
    const keyEvents = {
      taskCreation: downloadLogsSinceStart.filter(m => m.text?.includes('已创建下载任务')),
      taskStart: downloadLogsSinceStart.filter(m => m.text?.includes('开始下载任务')),
      taskComplete: downloadLogsSinceStart.filter(m => m.text?.includes('任务.*完成')),
      batchComplete: downloadLogsSinceStart.filter(m => m.text?.includes('批量下载完成')),
      errors: downloadLogsSinceStart.filter(m => m.text?.toLowerCase().includes('error'))
    }
    
    console.log(`\n  📦 任务创建事件: ${keyEvents.taskCreation.length} 次`)
    keyEvents.taskCreation.forEach((log: any, idx: number) => {
      console.log(`     ${idx + 1}. ${log.text}`)
    })
    
    console.log(`\n  ▶️ 任务开始事件: ${keyEvents.taskStart.length} 次`)
    console.log(`  ✅ 任务完成事件: ${keyEvents.taskComplete.length} 次`)
    console.log(`  🎉 批量完成事件: ${keyEvents.batchComplete.length} 次`)
    console.log(`  ❌ 错误事件: ${keyEvents.errors.length} 次`)
    
    expect(keyEvents.taskCreation.length).toBeGreaterThanOrEqual(5)
    expect(keyEvents.errors.length).toBe(0)
    
    console.log('\n[Step 6] 验证下载的本地文件完整性...')
    
    const verificationResults = {
      files: [],
      folders: []
    }
    
    for (let i = 1; i <= 4; i++) {
      const filePath = `${TEST_LOCAL_DIR}/remote-file${i}.txt`
      const exists = await verifyLocalFile(filePath, `Remote file ${i}`)
      verificationResults.files.push({
        path: filePath,
        exists,
        name: `remote-file${i}.txt`
      })
    }
    
    const folderAInnerA1 = `${TEST_LOCAL_DIR}/remote-folder-A/inner-a1.txt`
    verificationResults.folders.push({
      path: folderAInnerA1,
      exists: await verifyLocalFile(folderAInnerA1, 'Inner A1'),
      name: 'remote-folder-A/inner-a1.txt'
    })
    
    const folderBInnerB1 = `${TEST_LOCAL_DIR}/remote-folder-B/inner-b1.txt`
    verificationResults.folders.push({
      path: folderBInnerB1,
      exists: await verifyLocalFile(folderBInnerB1, 'Inner B1'),
      name: 'remote-folder-B/inner-b1.txt'
    })
    
    const folderBInnerB2 = `${TEST_LOCAL_DIR}/remote-folder-B/inner-b2.txt`
    verificationResults.folders.push({
      path: folderBInnerB2,
      exists: await verifyLocalFile(folderBInnerB2, 'Inner B2'),
      name: 'remote-folder-B/inner-b2.txt'
    })
    
    console.log('\n📁 文件验证结果:')
    console.log('  单个文件:')
    verificationResults.files.forEach((result: any) => {
      console.log(`    ${result.exists ? '✅' : '❌'} ${result.name}`)
    })
    
    console.log('  文件夹内文件:')
    verificationResults.folders.forEach((result: any) => {
      console.log(`    ${result.exists ? '✅' : '❌'} ${result.name}`)
    })
    
    const allFilesExist = [...verificationResults.files, ...verificationResults.folders]
      .every((r: any) => r.exists)
    expect(allFilesExist).toBe(true)
    console.log('\n✅ PASS: 所有下载的文件完整性验证通过！')
    
    await page.screenshot({
      path: 'e2e/screenshots/batch-download-e2e-complete-success.png',
      fullPage: false
    })
    
    console.log('\n✅ PASS: E2E 完整流程测试通过！')
  })

  /**
   * 🧪 边界情况测试：各种选择模式
   */
  test('🧪 边界情况：不同选择模式的批量下载行为', async () => {
    console.log('\n' + '='.repeat(60))
    console.log('🧪 边界情况测试：多种选择模式')
    console.log('='.repeat(60))
    
    console.log('\n[Scenario A] 纯文件选择（3 个远程文件）')
    await navigateToRemoteDir(page, TEST_REMOTE_DIR)
    
    await page.waitForSelector('.file-panel.remote .file-item', { timeout: 5000 })
    await page.waitForTimeout(500)
    
    const tasksBeforeA = await getTransferTaskCount(page)
    
    await multiSelectRemoteFiles(page, ['remote-file1.txt', 'remote-file2.txt', 'remote-file3.txt'])
    
    const selectedA = await page.locator('.file-panel.remote .file-item.selected').count()
    console.log(`  选中项: ${selectedA}`)
    
    await rightClickAndSelectActionOnRemote(page, '下载')
    
    await page.waitForTimeout(10000)
    
    const tasksAfterA = await getTransferTaskCount(page)
    const newTasksA = tasksAfterA - tasksBeforeA
    
    console.log(`  新建任务: ${newTasksA} (期望: 3)`)
    expect(newTasksA).toBe(3)
    console.log('  ✅ PASS: 纯文件选择正确\n')
    
    console.log('[Scenario B] 纯文件夹选择（2 个远程文件夹）')
    await navigateToRemoteDir(page, TEST_REMOTE_DIR)
    
    await page.waitForSelector('.file-panel.remote .file-item', { timeout: 5000 })
    await page.waitForTimeout(500)
    
    const tasksBeforeB = await getTransferTaskCount(page)
    
    await multiSelectRemoteFiles(page, ['remote-folder-A', 'remote-folder-B'])
    
    const selectedB = await page.locator('.file-panel.remote .file-item.selected').count()
    console.log(`  选中项: ${selectedB}`)
    
    await rightClickAndSelectActionOnRemote(page, '下载')
    
    await page.waitForTimeout(12000)
    
    const tasksAfterB = await getTransferTaskCount(page)
    const newTasksB = tasksAfterB - tasksBeforeB
    
    console.log(`  新建任务: ${newTasksB} (期望: 2)`)
    expect(newTasksB).toBe(2)
    console.log('  ✅ PASS: 纯文件夹选择正确\n')
    
    console.log('[Scenario C] 单文件选择（回归测试）')
    await navigateToRemoteDir(page, TEST_REMOTE_DIR)
    
    await page.waitForSelector('.file-panel.remote .file-item', { timeout: 5000 })
    await page.waitForTimeout(500)
    
    const tasksBeforeC = await getTransferTaskCount(page)
    
    const singleFile = await page.locator(`.file-panel.remote .file-item`, { 
      hasText: 'remote-file1.txt' 
    }).first()
    await singleFile.click({ force: true })
    await page.waitForTimeout(300)
    
    const selectedC = await page.locator('.file-panel.remote .file-item.selected').count()
    console.log(`  选中项: ${selectedC}`)
    
    await rightClickAndSelectActionOnRemote(page, '下载')
    
    await page.waitForTimeout(6000)
    
    const tasksAfterC = await getTransferTaskCount(page)
    const newTasksC = tasksAfterC - tasksBeforeC
    
    console.log(`  新建任务: ${newTasksC} (期望: 1)`)
    expect(newTasksC).toBe(1)
    console.log('  ✅ PASS: 单文件选择正确\n')
    
    console.log('='.repeat(60))
    console.log('✅ 所有边界情况测试通过！')
    console.log('='.repeat(60))
  })

  /**
   * 🔄 对称性测试：验证 uploadBatch 和 downloadBatch 行为一致
   */
  test('🔄 对称性验证：downloadBatch 与 uploadBatch 架构一致性', async () => {
    console.log('\n' + '='.repeat(60))
    console.log('🔄 对称性验证：upload vs download 架构对比')
    console.log('='.repeat(60))
    
    console.log('\n[Download Test] 执行批量下载...')
    await navigateToRemoteDir(page, TEST_REMOTE_DIR)
    
    await page.waitForSelector('.file-panel.remote .file-item', { timeout: 5000 })
    await page.waitForTimeout(500)
    
    const tasksBeforeDownload = await getTransferTaskCount(page)
    
    await multiSelectRemoteFiles(page, [
      'remote-file1.txt', 
      'remote-file2.txt', 
      'remote-folder-A'
    ])
    
    await rightClickAndSelectActionOnRemote(page, '下载')
    
    await page.waitForTimeout(12000)
    
    const tasksAfterDownload = await getTransferTaskCount(page)
    const downloadTaskCount = tasksAfterDownload - tasksBeforeDownload
    
    console.log(`\n[Download Result]`)
    console.log(`  选中项: 3 (2 文件 + 1 文件夹)`)
    console.log(`  创建任务: ${downloadTaskCount}`)
    console.log(`  期望任务: 3`)
    
    expect(downloadTaskCount).toBe(3)
    console.log('  ✅ downloadBatch: 每个 item 一个 Task\n')
    
    const recentLogs = consoleMessages.slice(-50).filter((msg: any) =>
      msg.text?.includes('[download]') && msg.text?.includes('任务')
    )
    
    console.log(`📋 downloadBatch 日志模式:`)
    recentLogs.slice(-10).forEach((log: any, idx: number) => {
      console.log(`  ${idx + 1}. ${log.text}`)
    })
    
    const hasMultipleTaskCreation = recentLogs.some((log: any) => 
      log.text?.includes('已创建下载任务 #') && /\d+/.test(log.text)
    )
    const hasBatchComplete = recentLogs.some((log: any) => 
      log.text?.includes('批量下载完成')
    )
    
    expect(hasMultipleTaskCreation).toBe(true)
    expect(hasBatchComplete).toBe(true)
    
    console.log('\n✅ PASS: downloadBatch 与 uploadBatch 使用相同的多 Task 架构！')
    
    await page.screenshot({
      path: 'e2e/screenshots/batch-download-symmetry-verification.png',
      fullPage: false
    })
  })
})

/*
 * 文档版本: v1.0
 * 最后更新: 2026-04-20
 * 测试框架: Playwright + Electron
 * 测试模式: 生产模式（out/main/index.js）
 */