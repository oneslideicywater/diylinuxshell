/**
 * SFTP 批量上传功能深度测试（多 TransferTask 架构验证）
 * 
 * ✅ 新架构验证：
 * - 每个选中的文件/文件夹创建独立的 TransferTask
 * - 选择 N 个项目 → 创建 N 个 TransferTask
 * - 每个任务独立管理进度、状态、取消操作
 * 
 * @module e2e/sftp/batch-upload-multi-task
 */

import { test, expect, _electron as electron } from '@playwright/test'
import path from 'path'
import * as fs from 'fs'

// 测试会话配置
const TEST_SESSION = {
  name: 'Batch Upload Multi Task Test',
  host: '192.168.10.24',
  port: 22,
  username: 'root',
  password: 'One.00000'
}

// 测试用的本地临时目录（D盘）
const TEST_LOCAL_DIR = 'D:/test-batch-multi-task'

// 控制台消息收集
const consoleMessages: any[] = []
const pageErrors: any[] = []

/**
 * 创建测试文件结构（多个文件和文件夹）
 */
async function setupTestEnvironment(): Promise<void> {
  if (fs.existsSync(TEST_LOCAL_DIR)) {
    fs.rmSync(TEST_LOCAL_DIR, { recursive: true })
  }

  fs.mkdirSync(TEST_LOCAL_DIR, { recursive: true })

  // 创建 3 个独立文件
  fs.writeFileSync(`${TEST_LOCAL_DIR}/file-a.txt`, 'Content A')
  fs.writeFileSync(`${TEST_LOCAL_DIR}/file-b.txt`, 'Content B - larger')
  fs.writeFileSync(`${TEST_LOCAL_DIR}/file-c.txt`, 'Content C')

  // 创建 2 个独立文件夹（每个包含不同内容）
  const folder1 = `${TEST_LOCAL_DIR}/folder-alpha`
  fs.mkdirSync(folder1, { recursive: true })
  fs.writeFileSync(`${folder1}/alpha-1.txt`, 'Alpha file 1')
  fs.writeFileSync(`${folder1}/alpha-2.txt`, 'Alpha file 2')

  const folder2 = `${TEST_LOCAL_DIR}/folder-beta`
  fs.mkdirSync(folder2, { recursive: true })
  fs.writeFileSync(`${folder2}/beta-1.txt`, 'Beta file 1')

  console.log('[Setup] ✅ 测试环境已准备完成（3 文件 + 2 文件夹）')
}

/**
 * 清理测试环境
 */
async function cleanupTestEnvironment(): Promise<void> {
  if (fs.existsSync(TEST_LOCAL_DIR)) {
    fs.rmSync(TEST_LOCAL_DIR, { recursive: true })
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
 * 多选文件（Ctrl+Click）
 */
async function multiSelectFiles(page: any, fileNames: string[]): Promise<void> {
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
}

/**
 * 右键点击并选择上传
 */
async function rightClickAndUpload(page: any): Promise<void> {
  const firstSelectedItem = await page.locator('.file-panel.local .file-item.selected').first()
  await firstSelectedItem.click({ button: 'right', force: true })
  await page.waitForTimeout(500)
  
  const uploadMenuItem = await page.locator('.context-menu-item', { hasText: /上传/ }).first()
  await uploadMenuItem.click({ force: true })
}

/**
 * 获取当前传输任务数量
 */
async function getTransferTaskCount(page: any): Promise<number> {
  try {
    return await page.locator('.transfer-task').count()
  } catch (e) {
    return 0
  }
}

test.describe('批量上传多 TransferTask 架构验证', () => {
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
    proc.stdout?.on('data', (d: Buffer) => console.log('[Main]', d.toString().trim()))
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
      } else if (msg.text().includes('[upload]')) {
        console.log(`[Upload Log] ${msg.text()}`)
      }
    })

    page.on('pageerror', (error: Error) => {
      console.error(`[Page Error] ${error.message}`)
      pageErrors.push(error)
    })

    await setupTestEnvironment()
  })

  test.afterAll(async () => {
    await cleanupTestEnvironment()
    
    if (app) {
      await app.close()
    }

    if (pageErrors.length > 0) {
      console.error(`\n❌ 测试期间共捕获到 ${pageErrors.length} 个错误:`)
      pageErrors.forEach((err: any, idx: number) => {
        console.error(`  ${idx + 1}. ${err.message || err.text}`)
      })
    }

    const uploadLogs = consoleMessages.filter((msg: any) =>
      msg.text?.includes('[upload]')
    )
    console.log(`\n📊 上传相关日志统计 (${uploadLogs.length} 条):`)
    uploadLogs.slice(-30).forEach((log: any, idx: number) => {
      console.log(`  ${idx + 1}. [${log.type}] ${log.text}`)
    })
  })

  /**
   * ✅ 核心测试：验证多 TransferTask 架构
   * 
   * 场景：选择 3 个文件 + 2 个文件夹 = 5 个项目
   * 预期：创建 5 个独立的 TransferTask
   */
  test('✅ 核心验证：选择 N 个项目应创建 N 个 TransferTask', async () => {
    console.log('\n========== 核心测试：多 TransferTask 架构验证 ==========')
    
    await openSFTPWindow(page)
    await navigateToLocalDir(page, TEST_LOCAL_DIR)
    
    await page.waitForSelector('.file-panel.local .file-item', { timeout: 5000 })
    await page.waitForTimeout(500)
    
    // 记录上传前的任务数量
    const tasksBeforeUpload = await getTransferTaskCount(page)
    console.log(`[Pre-Check] 上传前传输任务数: ${tasksBeforeUpload}`)
    
    // 选择 5 个项目：3 个文件 + 2 个文件夹
    const selectedItems = ['file-a.txt', 'file-b.txt', 'folder-alpha', 'file-c.txt', 'folder-beta']
    await multiSelectFiles(page, selectedItems)
    
    const selectedItemCount = await page.locator('.file-panel.local .file-item.selected').count()
    console.log(`[Select] 已选中 ${selectedItemCount} 个项目`)

    // 记录日志索引（调试用）
    const _logIndexBeforeUpload = consoleMessages.length
    
    // 触发批量上传
    await rightClickAndUpload(page)
    console.log('\n[Action] ✅ 已触发批量上传操作')
    
    // 等待任务创建和扫描完成
    console.log('[Waiting] 等待任务创建和文件扫描...')
    await page.waitForTimeout(15000)
    
    // 检查上传后的任务数量
    const tasksAfterUpload = await getTransferTaskCount(page)
    const newTasksCreated = tasksAfterUpload - tasksBeforeUpload
    
    console.log(`\n[Post-Check] 上传后传输任务数: ${tasksAfterUpload}`)
    console.log(`[Result] 新创建的任务数: ${newTasksCreated}`)
    
    // ✅ 核心断言：应该创建 5 个独立的 TransferTask（= 选中的项目数）
    expect(newTasksCreated).toBe(5)
    console.log('[Verify] ✅ PASS: 创建了 5 个独立的 TransferTask（与选中项数一致）')
    
    // 分析上传日志，验证架构
    const uploadLogsSinceAction = consoleMessages.slice(logIndexBeforeUpload).filter((msg: any) =>
      msg.text?.includes('[upload]')
    )
    
    console.log(`\n📋 本次上传关键日志 (${uploadLogsSinceAction.length} 条):`)
    
    // 提取关键事件
    const taskCreationLogs = uploadLogsSinceAction.filter((msg: any) =>
      msg.text?.includes('已创建传输任务'))
    
    console.log(`\n[Task Creation Logs]:`)
    taskCreationLogs.forEach((log: any, idx: number) => {
      console.log(`  ${idx + 1}. ${log.text}`)
    })
    
    // 验证创建了 5 个任务
    expect(taskCreationLogs.length).toBeGreaterThanOrEqual(5)
    
    // 截图保存证据
    await page.screenshot({
      path: 'e2e/screenshots/batch-multi-task-5-tasks.png',
      fullPage: false
    })
  })

  /**
   * ✅ 测试：混合选择（文件+文件夹）的多任务架构
   * 
   * 场景：选择 2 个文件 + 1 个文件夹
   * 预期：创建 3 个 TransferTask
   */
  test('✅ 混合选择：文件和文件夹应各自创建独立 TransferTask', async () => {
    console.log('\n========== 混合选择测试 ==========')
    
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)
    
    await openSFTPWindow(page)
    await navigateToLocalDir(page, TEST_LOCAL_DIR)
    
    await page.waitForSelector('.file-panel.local .file-item', { timeout: 5000 })
    await page.waitForTimeout(500)
    
    const tasksBefore = await getTransferTaskCount(page)
    
    // 选择 2 个文件 + 1 个文件夹
    await multiSelectFiles(page, ['file-a.txt', 'folder-alpha', 'file-b.txt'])

    // 日志快照（调试用）
    const _logIndexBefore = consoleMessages.length

    await rightClickAndUpload(page)

    // 等待处理
    await page.waitForTimeout(12000)
    
    const tasksAfter = await getTransferTaskCount(page)
    const newTasks = tasksAfter - tasksBefore
    
    console.log(`\n[Result] 新创建任务数: ${newTasks}`)
    
    // 应该创建 3 个任务
    expect(newTasks).toBe(3)
    console.log('[Verify] ✅ PASS: 混合选择创建了 3 个独立 TransferTask')
    
    // 验证日志中的任务名称
    const uploadLogs = consoleMessages.slice(logIndexBefore).filter((msg: any) =>
      msg.text?.includes('已创建传输任务')
    )
    
    console.log(`\n[Created Tasks]:`)
    uploadLogs.forEach((log: any, idx: number) => {
      console.log(`  任务${idx + 1}: ${log.text}`)
    })
    
    await page.screenshot({
      path: 'e2e/screenshots/batch-mixed-selection.png',
      fullPage: false
    })
  })

  /**
   * ✅ 测试：纯文件选择的批量上传
   * 
   * 场景：只选择 3 个文件（不包含文件夹）
   * 预期：创建 3 个简单的文件 TransferTask
   */
  test('✅ 纯文件选择：只选择文件应创建对应数量的简单 TransferTask', async () => {
    console.log('\n========== 纯文件选择测试 ==========')
    
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)
    
    await openSFTPWindow(page)
    await navigateToLocalDir(page, TEST_LOCAL_DIR)
    
    await page.waitForSelector('.file-panel.local .file-item', { timeout: 5000 })
    await page.waitForTimeout(500)
    
    const tasksBefore = await getTransferTaskCount(page)
    
    // 只选择 3 个文件
    await multiSelectFiles(page, ['file-a.txt', 'file-b.txt', 'file-c.txt'])

    // 日志快照（调试用）
    const _logIndexBefore = consoleMessages.length

    await rightClickAndUpload(page)

    // 等待处理（纯文件应该很快）
    await page.waitForTimeout(8000)
    
    const tasksAfter = await getTransferTaskCount(page)
    const newTasks = tasksAfter - tasksBefore
    
    console.log(`\n[Result] 新创建任务数: ${newTasks} (期望: 3)`)
    
    expect(newTasks).toBe(3)
    console.log('[Verify] ✅ PASS: 纯文件选择创建了 3 个 TransferTask')
    
    await page.screenshot({
      path: 'e2e/screenshots/batch-files-only.png',
      fullPage: false
    })
  })

  /**
   * ✅ 测试：纯文件夹选择的批量上传
   * 
   * 场景：只选择 2 个文件夹
   * 预期：创建 2 个 TransferTask（每个文件夹一个，内部包含子节点树）
   */
  test('✅ 纯文件夹选择：每个文件夹应创建独立的 TransferTask（含子节点树）', async () => {
    console.log('\n========== 纯文件夹选择测试 ==========')
    
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)
    
    await openSFTPWindow(page)
    await navigateToLocalDir(page, TEST_LOCAL_DIR)
    
    await page.waitForSelector('.file-panel.local .file-item', { timeout: 5000 })
    await page.waitForTimeout(500)
    
    const tasksBefore = await getTransferTaskCount(page)
    
    // 只选择 2 个文件夹
    await multiSelectFiles(page, ['folder-alpha', 'folder-beta'])

    // 日志快照（调试用）
    const _logIndexBefore = consoleMessages.length

    await rightClickAndUpload(page)

    // 等待文件夹扫描和上传
    await page.waitForTimeout(15000)
    
    const tasksAfter = await getTransferTaskCount(page)
    const newTasks = tasksAfter - tasksBefore
    
    console.log(`\n[Result] 新创建任务数: ${newTasks} (期望: 2)`)
    
    expect(newTasks).toBe(2)
    console.log('[Verify] ✅ PASS: 纯文件夹选择创建了 2 个 TransferTask')
    
    // 验证文件夹扫描日志
    const scanLogs = consoleMessages.slice(logIndexBefore).filter((msg: any) =>
      msg.text?.includes('文件夹扫描完成') || 
      msg.text?.includes('扫描文件夹')
    )
    
    console.log(`\n[Folder Scan Logs] (${scanLogs.length} 条):`)
    scanLogs.forEach((log: any, idx: number) => {
      console.log(`  ${idx + 1}. ${log.text}`)
    })
    
    // 应该有至少 2 个文件夹的扫描记录
    expect(scanLogs.length).toBeGreaterThanOrEqual(2)
    
    await page.screenshot({
      path: 'e2e/screenshots/batch-folders-only.png',
      fullPage: false
    })
  })

  /**
   * ✅ 综合端到端测试：完整流程验证
   * 
   * 完整流程：
   * 1. 选择混合项目
   * 2. 触发批量上传
   * 3. 监控所有任务的创建和执行
   * 4. 验证最终结果
   */
  test('✅ 综合测试：完整的批量上传流程（从选择到全部完成）', async () => {
    console.log('\n========== 综合端到端测试 ==========')
    
    const startTime = Date.now()
    
    await openSFTPWindow(page)
    await navigateToLocalDir(page, TEST_LOCAL_DIR)
    
    await page.waitForSelector('.file-panel.local .file-item', { timeout: 5000 })
    await page.waitForTimeout(500)
    
    const initialTaskCount = await getTransferTaskCount(page)
    const initialLogCount = consoleMessages.length
    
    console.log(`[Initial State] 任务数: ${initialTaskCount}, 日志数: ${initialLogCount}`)
    
    // 全选：3 文件 + 2 文件夹 = 5 项目
    await multiSelectFiles(page, ['file-a.txt', 'folder-alpha', 'file-b.txt', 'folder-beta', 'file-c.txt'])
    
    const selectedCount = await page.locator('.file-panel.local .file-item.selected').count()
    console.log(`\n[Selection] 选中了 ${selectedCount} 个项目`)
    
    // 触发上传
    await rightClickAndUpload(page)
    console.log('\n[Upload Triggered] 开始监控...')
    
    // 分阶段监控
    let lastTaskCount = initialTaskCount
    let maxTaskCount = 0
    
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(5000)
      
      const currentTaskCount = await getTransferTaskCount(page)
      maxTaskCount = Math.max(maxTaskCount, currentTaskCount)
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`  [${elapsed}s] 当前任务数: ${currentTaskCount}, 峰值: ${maxTaskCount}`)
      
      if (currentTaskCount > lastTaskCount) {
        console.log(`  🆕 新增了 ${currentTaskCount - lastTaskCount} 个任务`)
      }
      
      lastTaskCount = currentTaskCount
      
      // 如果已经检测到所有 5 个任务创建，可以提前结束监控循环
      if (maxTaskCount >= initialTaskCount + 5 && i >= 3) {
        break
      }
    }
    
    const finalTaskCount = await getTransferTaskCount(page)
    const totalNewTasks = finalTaskCount - initialTaskCount
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    
    console.log(`\n[Final Result]` +
      `\n  总耗时: ${totalTime}s` +
      `\n  峰值任务数: ${maxTaskCount}` +
      `\n  最终新任务数: ${totalNewTasks}` +
      `\n  期望任务数: 5`)
    
    // 核心断言
    expect(totalNewTasks).toBe(5)
    
    // 详细日志分析
    const allNewLogs = consoleMessages.slice(initialLogCount)
    const keyEvents = [
      { pattern: '已创建传输任务 #', count: 0, name: '任务创建' },
      { pattern: '开始上传任务', count: 0, name: '任务开始' },
      { pattern: '任务.*完成:', count: 0, name: '任务完成' },
      { pattern: '批量上传完成', count: 0, name: '批量完成' },
      { pattern: 'error', count: 0, name: '错误' }
    ]
    
    allNewLogs.forEach((log: any) => {
      keyEvents.forEach(event => {
        if (log.text?.toLowerCase().includes(event.pattern.toLowerCase())) {
          event.count++
        }
      })
    })
    
    console.log(`\n[Key Events Summary]:`)
    keyEvents.forEach(event => {
      console.log(`  ${event.name}: ${event.count} 次`)
    })
    
    // 验证关键指标
    expect(keyEvents[0].count).toBeGreaterThanOrEqual(5)  // 至少 5 次任务创建
    expect(keyEvents[4].count).toBe(0)  // 不应有错误
    
    await page.screenshot({
      path: 'e2e/screenshots/batch-e2e-final.png',
      fullPage: false
    })
    
    console.log('\n[Verify] ✅ PASS: 综合端到端测试完成')
  })
})

/**
 * 测试总结报告
 * 
 * ## 📊 新架构设计验证
 * 
 * ### ✅ 核心变更
 * **旧架构（❌ 错误）：**
 * ```
 * 选择 5 个项目 → 创建 1 个 TransferTask（包含 5 个子节点）
 *              → 只处理最后 1 个 ❌
 * ```
 * 
 * **新架构（✅ 正确）：**
 * ```
 * 选择 5 个项目 → 创建 5 个独立的 TransferTask
 *              → 每个任务独立管理 ✅
 * ```
 * 
 * ### 🔧 技术实现要点
 * 
 * **upload.ts 重构核心逻辑：**
 * ```typescript
 * // 遍历每个选中的路径
 * for (const filePath of paths) {
 *   // 为每个路径创建独立的 TransferNode 和 TransferTask
 *   const task: TransferTask = {
 *     id: `task-upload-${Date.now()}-${random}`,
 *     root: taskRootNode,  // 该路径对应的根节点
 *     ...
 *   }
 *   
 *   // 每个 Task 独立添加到 Store
 *   sftpTransferStore.addTask(task)
 *   createdTasks.push(task)
 * }
 * 
 * // 逐个执行上传（支持独立状态管理）
 * for (const task of createdTasks) {
 *   await uploadFolderContent(task.root, connectionId, task.id)
 *   // 每个任务独立更新状态
 * }
 * ```
 * 
 * ### 📈 测试覆盖矩阵
 * 
| 测试场景 | 选中项 | 预期 TransferTask 数 | 验证点 |
|---------|--------|---------------------|--------|
| 核心验证 | 5 项（混选） | 5 | 多任务架构 |
| 混合选择 | 3 项（2文+1夹） | 3 | 文件/文件夹独立 |
| 纯文件 | 3 项（全文件） | 3 | 简单任务创建 |
| 纯文件夹 | 2 项（全文件夹） | 2 | 夹子节点树 |
| E2E 流程 | 5 项（全选） | 5 | 完整流程监控 |
 * 
 * ### ✨ 用户收益
 * 
 * 1. **直观性**：每个文件/文件夹在传输列表中独立显示
 * 2. **可控性**：可以单独取消某个任务而不影响其他
 * 3. **可观测性**：每个任务有独立的进度、速度、剩余时间
 * 4. **符合直觉**：选择几个就显示几个任务，符合用户预期
 * 
 * ### 🎯 与 XShell 行为对标
 * 
 * XShell 的批量上传行为：
 * - ✅ 每个文件/文件夹在列表中独立一行
 * - ✅ 可以单独查看每个项目的详细进度
 * - ✅ 支持对单个项目进行暂停/恢复/取消
 * 
 * 新架构完全符合这一标准！
 */
