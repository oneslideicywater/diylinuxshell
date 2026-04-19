/**
 * BUG-032: 全局右键菜单重构后，右键点击 file-item 无法弹出菜单
 * 
 * Bug 根因分析：
 * AppLayout.vue 的 @contextmenu="handleGlobalClick" 事件处理器
 * 会在子组件 contextmenu 事件冒泡后立即关闭刚打开的菜单
 * 
 * 事件流程：
 * 1. 用户在 .file-item 上右键点击
 * 2. .file-list 的 @contextmenu.prevent → handleContextMenu() → visible = true
 * 3. 事件冒泡到 .app-layout
 * 4. .app-layout 的 @contextmenu → handleGlobalClick() → hideContextMenu()
 * 5. 菜单打开后立刻被关闭，用户看不到任何效果
 * 
 * 测试场景：
 * - 场景1: 右键点击 SftpLocal file-item 后全局菜单应显示（验证 bug）
 * - 场景2: 右键点击 SftpRemote file-item 后全局菜单应显示（验证 bug）
 * - 场景3: 修复后回归验证：左键点击空白区域应关闭菜单
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp } from '../helpers/electron-app'
import * as fs from 'fs'
import * as path from 'path'

const TEST_SESSION = {
  name: 'BUG-032 FileItem ContextMenu Test',
  host: '192.168.10.24',
  port: 22,
  username: 'root',
  password: 'One.00000'
}

async function openSFTPWindow(page: Page): Promise<void> {
  await page.waitForSelector('.session-list', { timeout: 20000 })

  await page.evaluate(async (sessionData) => {
    const sessions = await (window as any).api.session.getAll()
    const existing = sessions.find((s: any) => s.name === sessionData.name)
    if (!existing) {
      await (window as any).api.session.create(sessionData)
    }
  }, TEST_SESSION)

  await page.reload()
  await page.waitForSelector('.session-list', { timeout: 20000 })
  await page.waitForTimeout(3000)

  const groupHeader = page.locator('.group-header').first()
  try {
    await groupHeader.waitFor({ state: 'visible', timeout: 10000 })
    await groupHeader.click({ force: true })
  } catch {
    console.log('等待 group-header 超时')
  }

  let sessionFound = false
  for (let i = 0; i < 3; i++) {
    try {
      await page.waitForSelector('.session-item', { timeout: 5000 })
      sessionFound = true
      break
    } catch {
      if (i < 2) {
        await groupHeader.click({ force: true }).catch(() => {})
        await page.waitForTimeout(2000)
      }
    }
  }

  if (!sessionFound) throw new Error('无法找到会话项')
  await page.waitForTimeout(1000)

  const sessionItem = page.locator('.session-item', { hasText: TEST_SESSION.name }).first()
  if (await sessionItem.count() === 0) throw new Error('找不到测试会话')

  try {
    await sessionItem.hover({ force: true, timeout: 5000 })
  } catch {
    console.log('hover 失败，继续...')
  }

  const sftpButton = await sessionItem.locator('.action-btn.sftp').first()
  await sftpButton.click({ force: true })

  await page.waitForSelector('.sftp-overlay', { timeout: 10000 })
  await page.waitForTimeout(3000)
}

function createTestDir(): string {
  const testDir = `D:\\test_bug032_${Date.now()}`
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true })
  }
  for (let i = 1; i <= 3; i++) {
    fs.writeFileSync(path.join(testDir, `test_file_${i}.txt`), `content ${i}`)
  }
  return testDir
}

test.describe('BUG-032: 右键点击 file-item 无法弹出全局菜单', () => {
  let electronApp: ElectronApplication | null = null
  let page: Page | null = null

  test.beforeAll(async () => {
    const appResult = await startApp()
    electronApp = appResult.app
    page = appResult.page

    if (page) {
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.error('[Console Error]', msg.text())
        }
      })
      await page.waitForTimeout(3000)
    }
  })

  test.afterAll(async () => {
    if (electronApp && page) {
      await closeApp(electronApp, page)
    }
  })

  /**
   * 核心场景：右键点击 SftpLocal file-item 应弹出 .global-context-menu
   */
  test('场景1: 右键点击 SftpLocal file-item 应弹出全局菜单', async () => {
    if (!page) throw new Error('Page 未初始化')
    console.log('\n=== 场景1: SftpLocal file-item 右键菜单 ===')

    await openSFTPWindow(page)

    const localTestDir = createTestDir()
    try {
      /* 导航到本地测试目录 */
      const localPathInput = page.locator('.file-panel.local .path-input').first()
      await localPathInput.fill(localTestDir)
      await localPathInput.press('Enter')
      await page.waitForTimeout(2000)

      /* 等待文件列表加载 */
      const localFileItems = page.locator('.file-panel.local .file-item')
      const fileCount = await localFileItems.count()
      expect(fileCount).toBeGreaterThan(0)
      console.log(`📍 本地文件数量: ${fileCount}`)

      /* 右键点击第一个 file-item */
      const firstFile = localFileItems.first()
      console.log('📍 右键点击第一个 file-item...')

      /* 使用 Playwright 原生 right-click */
      await firstFile.click({ button: 'right', force: true })
      await page.waitForTimeout(800)

      /* 验证：.global-context-menu 应该可见 */
      const globalMenu = page.locator('.global-context-menu')
      const isVisible = await globalMenu.isVisible().catch(() => false)

      console.log(`📍 global-context-menu 可见: ${isVisible}`)

      /* 如果不可见，收集 Store 状态用于调试 */
      if (!isVisible) {
        const storeState = await page.evaluate(() => {
          try {
            const pinia = (window as any).__PINIA__
            return {
              hasPinia: !!pinia,
              message: '无法直接访问 Pinia store（需通过 Vue 组件）'
            }
          } catch (e: any) {
            return { error: e.message }
          }
        })
        console.log('📍 Debug info:', JSON.stringify(storeState))

        /* 截图辅助调试 */
        await page.screenshot({
          path: 'e2e/sftp/debug-bug032-local-menu-not-visible.png',
          fullPage: false
        })
        console.log('📍 已保存截图: debug-bug032-local-menu-not-visible.png')
      }

      expect(isVisible).toBe(true)
      console.log('✅✅✅ global-context-menu 已显示 ✅✅✅')

      /* 验证菜单项内容 */
      const menuItems = globalMenu.locator('.context-menu-item')
      const itemCount = await menuItems.count()
      console.log(`📍 菜单项数量: ${itemCount}`)
      expect(itemCount).toBeGreaterThan(0)

    } finally {
      if (fs.existsSync(localTestDir)) {
        fs.rmSync(localTestDir, { recursive: true, force: true })
      }
    }
  })

  /**
   * 场景2：右键点击 SftpRemote file-item 应弹出全局菜单
   */
  test('场景2: 右键点击 SftpRemote file-item 应弹出全局菜单', async () => {
    if (!page) throw new Error('Page 未初始化')
    console.log('\n=== 场景2: SftpRemote file-item 右键菜单 ===')

    await openSFTPWindow(page)

    /* 等待远程文件列表加载 */
    const remoteFileItems = page.locator('.file-panel.remote .file-item')
    let remoteCount = await remoteFileItems.count()

    /* 如果远程没有文件，先等待连接完成 */
    for (let i = 0; i < 5 && remoteCount === 0; i++) {
      await page.waitForTimeout(2000)
      remoteCount = await remoteFileItems.count()
    }

    console.log(`📍 远程文件数量: ${remoteCount}`)

    if (remoteCount > 0) {
      const firstRemoteFile = remoteFileItems.first()
      console.log('📍 右键点击第一个远程 file-item...')

      await firstRemoteFile.click({ button: 'right', force: true })
      await page.waitForTimeout(800)

      const globalMenu = page.locator('.global-context-menu')
      const isVisible = await globalMenu.isVisible().catch(() => false)
      console.log(`📍 global-context-menu 可见: ${isVisible}`)

      if (!isVisible) {
        await page.screenshot({
          path: 'e2e/sftp/debug-bug032-remote-menu-not-visible.png',
          fullPage: false
        })
      }

      expect(isVisible).toBe(true)
      console.log('✅✅✅ Remote global-context-menu 已显示 ✅✅✅')
    } else {
      /* 远程无文件时，右键点击空白区域也应弹出菜单 */
      console.log('📍 远程无文件，测试右键点击 file-list 空白区域...')
      const remoteFileList = page.locator('.file-panel.remote .file-list').first()
      await remoteFileList.click({ button: 'right', force: true })
      await page.waitForTimeout(800)

      const globalMenu = page.locator('.global-context-menu')
      const isVisible = await globalMenu.isVisible().catch(() => false)
      console.log(`📍 global-context-menu 可见: ${isVisible}`)
      expect(isVisible).toBe(true)
      console.log('✅✅✅ Remote blank area menu 已显示 ✅✅✅')
    }
  })

  /**
   * 场景3：修复后回归验证 - 左键点击空白区域应关闭菜单
   */
  test('场景3: 左键点击空白区域应关闭已打开的全局菜单', async () => {
    if (!page) throw new Error('Page 未初始化')
    console.log('\n=== 场景3: 左键点击关闭菜单（回归验证）===')

    await openSFTPWindow(page)

    const localTestDir = createTestDir()
    try {
      const localPathInput = page.locator('.file-panel.local .path-input').first()
      await localPathInput.fill(localTestDir)
      await localPathInput.press('Enter')
      await page.waitForTimeout(2000)

      const localFileItems = page.locator('.file-panel.local .file-item')
      const fileCount = await localFileItems.count()
      expect(fileCount).toBeGreaterThan(0)

      /* 先右键打开菜单 */
      const firstFile = localFileItems.first()
      await firstFile.click({ button: 'right', force: true })
      await page.waitForTimeout(800)

      const globalMenu = page.locator('.global-context-menu')
      await expect(globalMenu).toBeVisible({ timeout: 5000 })
      console.log('✅ 步骤1: 全局菜单已显示')

      /* 左键点击空白区域 */
      const fileList = page.locator('.file-panel.local .file-list')
      const box = await fileList.boundingBox()
      if (!box) throw new Error('无法获取 file-list 边界框')

      const blankX = box.x + box.width * 0.5
      const blankY = box.y + box.height - 15

      console.log(`📍 步骤2: 左键点击 (${Math.round(blankX)}, ${Math.round(blankY)})`)
      await page.mouse.click(blankX, blankY)
      await page.waitForTimeout(500)

      /* 验证菜单已关闭 */
      await expect(globalMenu).toBeHidden({ timeout: 3000 })
      console.log('✅✅✅ 左键点击后菜单已关闭 ✅✅✅')

    } finally {
      if (fs.existsSync(localTestDir)) {
        fs.rmSync(localTestDir, { recursive: true, force: true })
      }
    }
  })

  /**
   * 场景4：ESC 键应关闭菜单
   */
  test('场景4: 按 ESC 键应关闭已打开的全局菜单', async () => {
    if (!page) throw new Error('Page 未初始化')
    console.log('\n=== 场景4: ESC 关闭菜单 ===')

    await openSFTPWindow(page)

    const localTestDir = createTestDir()
    try {
      const localPathInput = page.locator('.file-panel.local .path-input').first()
      await localPathInput.fill(localTestDir)
      await localPathInput.press('Enter')
      await page.waitForTimeout(2000)

      const localFileItems = page.locator('.file-panel.local .file-item')
      expect(await localFileItems.count()).toBeGreaterThan(0)

      /* 右键打开菜单 */
      await localFileItems.first().click({ button: 'right', force: true })
      await page.waitForTimeout(800)

      const globalMenu = page.locator('.global-context-menu')
      await expect(globalMenu).toBeVisible({ timeout: 5000 })
      console.log('✅ 步骤1: 全局菜单已显示')

      /* 按 ESC 键 */
      console.log('📍 步骤2: 按 ESC 键...')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)

      /* 验证菜单已关闭 */
      await expect(globalMenu).toBeHidden({ timeout: 3000 })
      console.log('✅✅✅ ESC 键后菜单已关闭 ✅✅✅')

    } finally {
      if (fs.existsSync(localTestDir)) {
        fs.rmSync(localTestDir, { recursive: true, force: true })
      }
    }
  })
})
