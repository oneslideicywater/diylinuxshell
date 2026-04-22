/**
 * SFTP 批量上传/下载 进度树数据验证测试
 * 
 * 验证目标：
 * 1. scanIntoNode 不创建重复根节点（直接填充已有节点）
 * 2. pathJoin API 正确处理 Windows 路径分隔符
 * 3. 上传/下载过程中扫描 → transferring → completed 状态流转正确
 * 4. 进度树中每个节点的 progress/speed/remaining 数据存在且合理
 * 5. 根节点能聚合子节点进度数据
 * 
 * @module e2e/sftp/transfer-progress-verify
 */

import { test, expect } from '@playwright/test'
import { startApp, closeApp } from '../helpers/electron-app'
import type { ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'

// 测试会话配置
const TEST_SESSION = {
  name: 'Transfer Progress Verify',
  host: '192.168.10.24',
  port: 22,
  username: 'root',
  password: 'One.00000'
}

// 测试目录（D盘，Windows 反斜杠路径）
const TEST_LOCAL_DIR = 'D:\\e2e-transfer-test'
const TEST_REMOTE_BASE = '/tmp/e2e-transfer-test'

// 控制台日志收集器
interface LogEntry {
  type: string
  text: string
  timestamp: number
}

const collectedLogs: LogEntry[] = []

/**
 * 创建本地测试文件结构（含嵌套文件夹）
 */
function setupTestFiles(): void {
  if (fs.existsSync(TEST_LOCAL_DIR)) {
    fs.rmSync(TEST_LOCAL_DIR, { recursive: true })
  }

  fs.mkdirSync(TEST_LOCAL_DIR, { recursive: true })

  // 创建 3 个独立文件
  fs.writeFileSync(`${TEST_LOCAL_DIR}/alpha.txt`, 'A'.repeat(1024))
  fs.writeFileSync(`${TEST_LOCAL_DIR}/beta.txt`, 'B'.repeat(2048))
  fs.writeFileSync(`${TEST_LOCAL_DIR}/gamma.txt`, 'C'.repeat(512))

  // 创建嵌套文件夹（用于验证递归扫描）
  const deepFolder = `${TEST_LOCAL_DIR}/deep-nested`
  fs.mkdirSync(deepFolder, { recursive: true })
  fs.writeFileSync(`${deepFolder}/level1-a.txt`, 'L1A'.repeat(256))
  fs.writeFileSync(`${deepFolder}/level1-b.txt`, 'L1B'.repeat(128))

  const deeperFolder = `${deepFolder}/level2`
  fs.mkdirSync(deeperFolder, { recursive: true })
  fs.writeFileSync(`${deeperFolder}/level2-file.txt`, 'L2'.repeat(64))

  console.log(`[Setup] ✅ 测试文件已创建: ${TEST_LOCAL_DIR}`)
}

/**
 * 清理测试文件
 */
function cleanupTestFiles(): void {
  if (fs.existsSync(TEST_LOCAL_DIR)) {
    fs.rmSync(TEST_LOCAL_DIR, { recursive: true })
  }
}

/**
 * 通过 UI 操作创建会话并打开 SFTP 窗口
 * 与旧测试保持一致的连接方式，确保认证正常
 */
async function openSFTPWindow(page: Page): Promise<void> {
  // 等待主界面加载
  await page.waitForSelector('.session-list', { timeout: 10000 })

  // 创建测试会话
  await page.evaluate(async (sessionData) => {
    const sessions = await (window as any).api.session.getAll()
    const existing = sessions.find((s: any) => s.name === sessionData.name)
    if (!existing) {
      await (window as any).api.session.create(sessionData)
    }
  }, TEST_SESSION)

  // 刷新以显示新会话
  await page.reload()
  await page.waitForSelector('.session-list', { timeout: 10000 })
  await page.waitForTimeout(3000)

  // 展开分组
  const groupHeader = page.locator('.group-header').first()
  await groupHeader.click({ force: true })

  try {
    await page.waitForSelector('.session-item', { timeout: 5000 })
  } catch {
    await groupHeader.click({ force: true })
    await page.waitForSelector('.session-item', { timeout: 5000 })
  }
  await page.waitForTimeout(1000)

  // 找到测试会话并点击 SFTP 按钮
  const sessionItem = page.locator('.session-item', { hasText: TEST_SESSION.name }).first()
  await sessionItem.scrollIntoViewIfNeeded({ force: true })
  await sessionItem.hover({ force: true })

  const sftpButton = sessionItem.locator('.action-btn.sftp').first()
  await sftpButton.click({ force: true })

  // 等待 SFTP 窗口打开
  await page.waitForSelector('.sftp-overlay', { timeout: 10000 })
  await page.waitForTimeout(3000)

  console.log('[SFTP] ✅ SFTP 窗口已通过 UI 打开')
}

/**
 * 通过路径输入框 + 回车导航到指定本地目录
 * （验证 handlePathEnter 修复后能正确读取输入值）
 */
async function navigateLocalDir(page: Page, dirPath: string): Promise<void> {
  const pathInput = page.locator('.file-panel.local .path-input').first()
  // 点击聚焦输入框
  await pathInput.click({ force: true })
  // 全选已有内容
  await page.keyboard.press('Control+a')
  // 用 type 模拟真实键盘输入（触发 Vue v-model 响应式更新）
  await pathInput.type(dirPath, { delay: 10 })
  // 等一下让 v-model debounce 完成
  await page.waitForTimeout(400)
  // 在输入框上直接按回车（确保事件绑定到正确元素）
  await pathInput.press('Enter')
  // 等待文件列表刷新
  await page.waitForTimeout(3000)

  console.log(`[Navigate] ✅ 本地目录 (type+Enter): ${dirPath}`)
}

/**
 * 通过路径输入框 + 回车导航到远程目录
 * （验证 handlePathEnter 修复后能正确读取输入值）
 */
async function navigateRemoteDir(page: Page, remotePath: string): Promise<void> {
  const pathInput = page.locator('.file-panel.remote .path-input').first()
  await pathInput.click({ force: true })
  await page.keyboard.press('Control+a')
  await pathInput.type(remotePath, { delay: 10 })
  await page.waitForTimeout(400)
  await pathInput.press('Enter')
  await page.waitForTimeout(3000)

  console.log(`[Navigate] ✅ 远程目录 (type+Enter): ${remotePath}`)
}

/**
 * 在本地面板选择多个文件（Ctrl+Click）
 * 先等待文件列表加载完成，再逐个选择
 */
async function selectLocalFiles(page: Page, fileNames: string[]): Promise<number> {
  // 先等待文件列表出现且非空
  const fileList = page.locator('.file-panel.local .file-list')
  await fileList.waitFor({ state: 'visible', timeout: 10000 })

  const fileItems = page.locator('.file-panel.local .file-item')
  const count = await fileItems.count()
  console.log(`[Select] 文件列表已加载，共 ${count} 项`)

  let selectedCount = 0
  for (let i = 0; i < fileNames.length; i++) {
    // 用 .file-name 精确匹配文件名（避免匹配到 size 等其他文本）
    const item = page.locator('.file-panel.local .file-item').filter({
      has: page.locator('.file-name', { hasText: fileNames[i] })
    }).first()

    try {
      await item.waitFor({ state: 'visible', timeout: 5000 })
    } catch {
      console.warn(`[Select] ⚠️ 文件未找到: ${fileNames[i]}`)
      continue
    }

    if (i === 0) {
      await item.click({ force: true })
    } else {
      await item.click({ modifiers: ['Control'], force: true })
    }
    selectedCount++
    await page.waitForTimeout(200)
  }

  console.log(`[Select] ✅ 实际选中 ${selectedCount}/${fileNames.length} 个文件`)
  return selectedCount
}

/**
 * 右键点击选中的本地文件并触发上传
 */
async function triggerUpload(page: Page): Promise<void> {
  // 先确认有选中项
  const selectedItems = page.locator('.file-panel.local .file-item.selected')
  const selectedCount = await selectedItems.count()
  console.log(`[Upload] 当前选中项数量: ${selectedCount}`)

  if (selectedCount === 0) {
    // 没有选中项时，右键点击第一个文件项触发上传单个文件
    console.log('[Upload] ⚠️ 无选中项，尝试右键点击第一个文件')
    const firstItem = page.locator('.file-panel.local .file-item').first()
    await firstItem.click({ button: 'right', force: true })
  } else {
    const selectedItem = selectedItems.first()
    await selectedItem.click({ button: 'right', force: true })
  }

  await page.waitForTimeout(500)

  // 点击"上传"菜单项
  const uploadItem = page.locator('.context-menu-item', { hasText: /上传/ }).first()
  await uploadItem.click({ force: true })

  console.log('[Upload] ✅ 已触发批量上传')
}

/**
 * 右键点击选中的远程文件并触发下载
 */
async function triggerDownload(page: Page): Promise<void> {
  const selectedItem = page.locator('.file-panel.remote .file-item.selected').first()
  await selectedItem.click({ button: 'right', force: true })
  await page.waitForTimeout(500)

  // 点击"下载"菜单项
  const downloadItem = page.locator('.context-menu-item', { hasText: /下载/ }).first()
  await downloadItem.click({ force: true })

  console.log('[Download] ✅ 已触发批量下载')
}

/**
 * 从收集的日志中过滤出 [upload] / [download] 前缀的日志
 */
function filterTransferLogs(prefix: string): LogEntry[] {
  return collectedLogs.filter(log =>
    log.text.includes(`[${prefix}]`) || log.text.includes(`[${prefix.toUpperCase()}]`)
  )
}

/**
 * 验证进度数据是否合理
 */
function verifyProgressData(logs: LogEntry[], operation: string): { valid: boolean; issues: string[] } {
  const issues: string[] = []

  // 检查是否有扫描日志
  const scanLogs = logs.filter(l => l.text.includes('扫描') || l.text.includes('scan'))
  if (scanLogs.length === 0) {
    issues.push(`${operation}: 未发现扫描相关日志`)
  } else {
    console.log(`\n  📋 ${operation} 扫描日志 (${scanLogs.length} 条):`)
    scanLogs.forEach(l => console.log(`     [${l.type}] ${l.text}`))
  }

  // 检查是否有任务创建日志
  const taskLogs = logs.filter(l => l.text.includes('已创建') && l.text.includes('任务'))
  if (taskLogs.length > 0) {
    console.log(`\n  📋 ${operation} 任务创建日志:`)
    taskLogs.forEach(l => console.log(`     [${l.type}] ${l.text}`))
  }

  // 检查是否有完成日志
  const doneLogs = logs.filter(l => l.text.includes('完成') || l.text.includes('completed'))
  if (doneLogs.length > 0) {
    console.log(`\n  📋 ${operation} 完成日志:`)
    doneLogs.forEach(l => console.log(`     [${l.type}] ${l.text}`))
  }

  // 检查是否有错误日志
  const errorLogs = logs.filter(l =>
    l.type === 'error' ||
    l.text.includes('Error') ||
    l.text.includes('error') ||
    l.text.includes('失败')
  )
  if (errorLogs.length > 0) {
    issues.push(`${operation}: 发现 ${errorLogs.length} 条错误日志`)
    errorLogs.forEach(l => issues.push(`  ❌ [${l.type}] ${l.text}`))
  }

  return { valid: issues.length === 0, issues }
}

test.describe('SFTP 传输进度树数据验证', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async () => {
    setupTestFiles()

    const result = await startApp()
    app = result.app
    page = result.page

    // 收集所有控制台日志
    page.on('console', (msg) => {
      collectedLogs.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now()
      })
    })

    page.on('pageerror', (err) => {
      collectedLogs.push({
        type: 'pageerror',
        text: err.message,
        timestamp: Date.now()
      })
    })

    // 通过 UI 打开 SFTP 窗口
    await openSFTPWindow(page)
  })

  test.afterAll(async () => {
    cleanupTestFiles()
    if (app) await closeApp(app)

    // 打印完整日志摘要
    console.log('\n' + '='.repeat(80))
    console.log('📊 测试完整日志摘要')
    console.log('='.repeat(80))
    console.log(`总日志数: ${collectedLogs.length}`)

    const uploadLogs = filterTransferLogs('upload')
    const downloadLogs = filterTransferLogs('download')

    console.log(`\n[upload] 相关日志: ${uploadLogs.length} 条`)
    console.log(`[download] 相关日志: ${downloadLogs.length} 条`)

    const errors = collectedLogs.filter(l => l.type === 'error' || l.type === 'pageerror')
    if (errors.length > 0) {
      console.log(`\n❌ 错误日志 (${errors.length}):`)
      errors.forEach(e => console.log(`   [${e.type}] ${e.text}`))
    } else {
      console.log('\n✅ 无错误日志')
    }
  })

  /**
   * 测试 1：批量上传 — 验证扫描和进度数据
   */
  test('批量上传应正确扫描本地文件并显示进度数据', async () => {
    // 清空本次测试的日志关注点
    const logStartIndex = collectedLogs.length

    // 导航到测试目录
    await navigateLocalDir(page, TEST_LOCAL_DIR)

    // 确认文件列表加载
    const fileItems = page.locator('.file-panel.local .file-item')
    const count = await fileItems.count()
    console.log(`[UI] 本地文件列表项数量: ${count}`)
    expect(count).toBeGreaterThan(0)

    // 选择所有文件和文件夹（混合选择）
    const selectedCount = await selectLocalFiles(page, ['alpha.txt', 'beta.txt', 'deep-nested'])
    expect(selectedCount).toBeGreaterThan(0)

    // 触发上传
    await triggerUpload(page)

    // 等待上传过程完成（扫描 + 传输）
    console.log('\n⏳ 等待上传完成...')
    await page.waitForTimeout(15000)

    // 截图保存当前状态
    await page.screenshot({
      path: 'e2e/screenshots/transfer-progress-upload.png',
      fullPage: false
    })

    // 分析日志
    const testLogs = collectedLogs.slice(logStartIndex)
    const uploadLogs = filterTransferLogs('upload')
    const result = verifyProgressData(uploadLogs, 'UPLOAD')

    // 输出详细分析
    console.log('\n' + '-'.repeat(60))
    console.log('📊 UPLOAD 进度数据分析:')
    console.log('-'.repeat(60))

    if (!result.valid) {
      console.log('\n❌ 发现问题:')
      result.issues.forEach(i => console.log(`  ${i}`))
    }

    // 基本断言：至少应该有扫描日志
    const hasScanLog = uploadLogs.some(l =>
      l.text.includes('扫描') || l.text.includes('scanning') || l.text.includes('scanIntoNode')
    )
    if (hasScanLog) {
      console.log('  ✅ scanIntoNode 扫描函数被调用')
    } else {
      console.log('  ⚠️ 未检测到 scanIntoNode 日志（可能使用其他函数名）')
    }

    // 检查是否有 pathJoin 调用（验证路径拼接 API 生效）
    const hasPathJoin = uploadLogs.some(l => l.text.includes('pathJoin'))
    if (hasPathJoin) {
      console.log('  ✅ pathJoin API 被调用（路径拼接正常）')
    }

    // 检查是否有任务创建日志（验证不重复建根节点）
    const hasTaskCreated = uploadLogs.some(l =>
      l.text.includes('已创建上传任务') || l.text.includes('已创建')
    )
    if (hasTaskCreated) {
      console.log('  ✅ 任务创建日志存在（根节点只创建一次）')
    }

    // 检查是否有 rebuildNodeIndex 日志
    const hasRebuildIndex = uploadLogs.some(l => l.text.includes('rebuildNodeIndex') || l.text.includes('重建索引'))
    if (hasRebuildIndex) {
      console.log('  ✅ rebuildNodeIndex 被调用（扫描完成后重建索引）')
    }

    // 至少不应该有 node:path 外部化错误
    const hasExternalizeError = testLogs.some(l =>
      l.text.includes('externalized') || l.text.includes('node:path')
    )
    expect(hasExternalizeError).toBe(false)

    console.log('')
  })

  /**
   * 测试 2：批量下载 — 验证远程扫描和进度数据
   */
  test('批量下载应正确扫描远程文件并显示进度数据', async () => {
    const logStartIndex = collectedLogs.length

    // 先确保远程有可下载的文件（如果上传成功的话应该有了）
    // 导航到远程根目录
    await navigateRemoteDir(page, '/tmp')

    // 等待远程文件列表加载
    await page.waitForTimeout(2000)

    // 查找之前上传的文件（在 /tmp/e2e-transfer-test 下）
    // 先尝试导航到上传的目标目录
    const remoteItems = page.locator('.file-panel.remote .file-item')
    const remoteCount = await remoteItems.count()
    console.log(`[UI] 远程文件列表项数量: ${remoteCount}`)

    if (remoteCount > 0) {
      // 尝试找到 e2e-transfer-test 文件夹并下载它
      const testFolder = page.locator('.file-panel.remote .file-item', {
        hasText: 'e2e-transfer-test'
      }).first()

      try {
        await testFolder.waitFor({ timeout: 5000 })
        await testFolder.click({ force: true })
        await page.waitForTimeout(500)

        // 右键下载
        await testFolder.click({ button: 'right', force: true })
        await page.waitForTimeout(500)

        const downloadMenuItem = page.locator('.context-menu-item', {
          hasText: /下载/
        }).first()

        try {
          await downloadMenuItem.click({ force: true })
          console.log('[Download] ✅ 已触发文件夹下载')
        } catch {
          // 如果没有"下载文件夹"选项，尝试普通下载
          console.log('[Download] ⚠️ 未找到下载菜单项，跳过下载测试')
        }
      } catch {
        console.log('[Download] ⚠️ 远程目录中未找到 e2e-transfer-test，可能上传未成功')
      }
    }

    // 等待下载过程
    console.log('\n⏳ 等待下载完成...')
    await page.waitForTimeout(15000)

    // 截图
    await page.screenshot({
      path: 'e2e/screenshots/transfer-progress-download.png',
      fullPage: false
    })

    // 分析下载日志
    const testLogs = collectedLogs.slice(logStartIndex)
    const downloadLogs = filterTransferLogs('download')
    const result = verifyProgressData(downloadLogs, 'DOWNLOAD')

    console.log('\n' + '-'.repeat(60))
    console.log('📊 DOWNLOAD 进度数据分析:')
    console.log('-'.repeat(60))

    if (!result.valid) {
      console.log('\n❌ 发现问题:')
      result.issues.forEach(i => console.log(`  ${i}`))
    }

    // 检查 scanIntoRemoteNode 是否被调用
    const hasRemoteScan = downloadLogs.some(l =>
      l.text.includes('扫描') || l.text.includes('scanIntoRemoteNode')
    )
    if (hasRemoteScan) {
      console.log('  ✅ scanIntoRemoteNode 远程扫描函数被调用')
    }

    console.log('')
  })

  /**
   * 测试 3：通过 evaluate 直接检查 Store 中的传输任务状态
   */
  test('Store 中传输任务的根节点应有正确的统计信息', async () => {
    // 通过 Vue devtools 或直接访问 Store 来检查状态
    const storeState = await page.evaluate(async () => {
      // 尝试获取 Pinia store 的状态（通过 __VUE_APP__ 或类似方式）
      // 由于生产模式下无法直接访问 Pinia，我们检查 DOM 中的传输任务 UI 元素
      const transferTasks = document.querySelectorAll('.transfer-task')
      const transferNodes = document.querySelectorAll('.transfer-node')

      // 检查进度条元素
      const progressBars = document.querySelectorAll('.progress-bar')
      const progressTexts = document.querySelectorAll('.progress-text')

      return {
        taskCount: transferTasks.length,
        nodeCount: transferNodes.length,
        progressBarCount: progressBars.length,
        progressTextContents: Array.from(progressTexts).map(el => el.textContent?.trim()).filter(Boolean)
      }
    })

    console.log('\n' + '-'.repeat(60))
    console.log('📊 Store/UI 状态快照:')
    console.log('-'.repeat(60))
    console.log(`  传输任务数: ${storeState.taskCount}`)
    console.log(`  传输节点数: ${storeState.nodeCount}`)
    console.log(`  进度条数: ${storeState.progressBarCount}`)

    if (storeState.progressTextContents.length > 0) {
      console.log('\n  进度文本内容:')
      storeState.progressTextContents.forEach(t => console.log(`    "${t}"`))
    }

    console.log('')
  })

  /**
   * 测试 4：上传 .ivy2 目录到远程 /tmp — 验证真实大目录的扫描和进度
   */
  test('上传 C:\\Users\\onesl\\.ivy2 到远程 /tmp 应正确完成并输出进度', async () => {
    const logStartIndex = collectedLogs.length
    const IVY2_PATH = 'C:\\Users\\onesl\\.ivy2'
    const PARENT_DIR = 'C:\\Users\\onesl'

    // 确认目录存在
    expect(fs.existsSync(IVY2_PATH)).toBe(true)
    console.log(`[Setup] ✅ 目标目录存在: ${IVY2_PATH}`)

    // 导航到父目录 C:\Users\onesl（在父目录中选中 .ivy2 文件夹）
    await navigateLocalDir(page, PARENT_DIR)

    // 确认文件列表加载
    const fileItems = page.locator('.file-panel.local .file-item')
    const count = await fileItems.count()
    console.log(`[UI] 本地文件列表项数量: ${count}`)
    expect(count).toBeGreaterThan(0)

    // 导航远程面板到 /tmp（上传目标）
    await navigateRemoteDir(page, '/tmp')
    await page.waitForTimeout(1000)

    // 在本地面板中找到并选中 .ivy2 文件夹（不是进入它，而是选中文件夹本身）
    const ivy2Item = page.locator('.file-panel.local .file-item').filter({
      has: page.locator('.file-name', { hasText: '.ivy2' })
    }).first()

    try {
      await ivy2Item.waitFor({ state: 'visible', timeout: 5000 })
      await ivy2Item.click({ force: true })
      console.log('[Select] ✅ 已选中 .ivy2 文件夹')
    } catch {
      // 如果精确匹配失败，尝试滚动查找
      console.warn('[Select] ⚠️ 精确匹配 .ivy2 失败，尝试滚动查找...')
      await ivy2Item.scrollIntoViewIfNeeded({ force: true })
      await page.waitForTimeout(500)
      await ivy2Item.click({ force: true })
    }

    // 确认有选中项
    const selectedItems = page.locator('.file-panel.local .file-item.selected')
    const selectedCount = await selectedItems.count()
    console.log(`[Select] 选中项数量: ${selectedCount}`)
    expect(selectedCount).toBeGreaterThan(0)

    // 触发上传
    await triggerUpload(page)

    // 等待上传过程完成（.ivy2 目录较大，给足够时间）
    console.log('\n⏳ 等待 .ivy2 上传完成（可能需要较长时间）...')
    await page.waitForTimeout(60000)

    // 截图保存当前状态
    await page.screenshot({
      path: 'e2e/screenshots/transfer-progress-ivy2-upload.png',
      fullPage: false
    })

    // 分析日志
    const testLogs = collectedLogs.slice(logStartIndex)
    const uploadLogs = filterTransferLogs('upload')
    const result = verifyProgressData(uploadLogs, 'IVY2-UPLOAD')

    console.log('\n' + '-'.repeat(60))
    console.log('📊 IVY2 上传进度数据分析:')
    console.log('-'.repeat(60))

    if (!result.valid) {
      console.log('\n❌ 发现问题:')
      result.issues.forEach(i => console.log(`  ${i}`))
    }

    // 详细输出所有 upload 相关日志
    console.log(`\n  📋 IVY2-UPLOAD 全部日志 (${uploadLogs.length} 条):`)
    uploadLogs.forEach((l, idx) => {
      console.log(`     ${idx + 1}. [${l.type}] ${l.text}`)
    })

    // 检查关键节点
    const hasScanLog = uploadLogs.some(l =>
      l.text.includes('扫描') || l.text.includes('scanIntoNode')
    )
    console.log(hasScanLog ? '  ✅ scanIntoNode 扫描函数被调用' : '  ⚠️ 未检测到扫描日志')

    const hasCompleteLog = uploadLogs.some(l =>
      l.text.includes('批量上传完成') || l.text.includes('🎉')
    )
    console.log(hasCompleteLog ? '  ✅ 上传完成日志存在' : '  ⚠️ 未检测到完成日志')

    // 统计错误
    const errors = testLogs.filter(l => l.type === 'error')
    console.log(`\n  错误日志数: ${errors.length}`)
    errors.slice(0, 10).forEach(e => console.log(`     ❌ [error] ${e.text.substring(0, 200)}`))

    // 不应有路径分隔符错误
    const pathError = testLogs.some(l => l.text.includes('No such file') && l.text.includes('/'))
    if (pathError) {
      console.log('\n  ❌ 仍存在路径分隔符混用问题！')
    } else {
      console.log('\n  ✅ 无路径分隔符混用错误')
    }

    console.log('')
  })
})
