/**
 * BUG-033: 右键菜单弹出后，左键点击 file-item 或空白区域菜单不消失
 * 
 * Bug 根因分析：
 * SftpTransfer.vue 的 .sftp-window 有 @click.stop，
 * 导致内部所有 click 事件无法冒泡到 .app-layout，
 * 使 AppLayout 的 handleGlobalClick 无法触发 → 菜单不关闭
 * 
 * 测试场景：
 * - 场景1: 右键弹出菜单 → 左键点击另一个 file-item → 菜单应关闭
 * - 场景2: 右键弹出菜单 → 左键点击空白区域 → 菜单应关闭
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp } from '../helpers/electron-app'
import * as fs from 'fs'
import * as path from 'path'

const TEST_SESSION = {
  name: 'BUG-033 Click Close Menu Test',
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
  const testDir = `D:\\test_bug033_${Date.now()}`
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true })
  }
  for (let i = 1; i <= 5; i++) {
    fs.writeFileSync(path.join(testDir, `test_file_${i}.txt`), `content ${i}`)
  }
  return testDir
}

test.describe('BUG-033: 左键点击 file-item 后右键菜单不消失', () => {
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
   * 核心场景：右键弹出菜单 → 左键点击另一个 file-item → 菜单应关闭
   */
  test('场景1: 右键弹出菜单后左键点击另一个 file-item 应关闭菜单', async () => {
    if (!page) throw new Error('Page 未初始化')
    console.log('\n=== BUG-033 场景1: 左键点击另一个 file-item 关闭菜单 ===')

    await openSFTPWindow(page)

    const localTestDir = createTestDir()
    try {
      /* 导航到本地测试目录 */
      const localPathInput = page.locator('.file-panel.local .path-input').first()
      await localPathInput.fill(localTestDir)
      await localPathInput.press('Enter')
      await page.waitForTimeout(2000)

      const localFileItems = page.locator('.file-panel.local .file-item')
      const fileCount = await localFileItems.count()
      expect(fileCount).toBeGreaterThanOrEqual(2)
      console.log(`📍 本地文件数量: ${fileCount}（需要 >= 2 个）`)

      /* 步骤1: 右键点击第一个 file-item 弹出菜单 */
      const file1 = localFileItems.nth(0)
      await file1.click({ button: 'right', force: true })
      await page.waitForTimeout(800)

      const globalMenu = page.locator('.global-context-menu')
      await expect(globalMenu).toBeVisible({ timeout: 5000 })
      console.log('✅ 步骤1: 右键菜单已弹出')

      /* 步骤2: 左键点击第二个 file-item（不是同一个） */
      const file2 = localFileItems.nth(1)
      console.log(`📍 步骤2: 左键点击第二个 file-item...`)
      await file2.click({ force: true })
      await page.waitForTimeout(500)

      /* 验证：菜单应该已关闭 */
      const menuStillVisible = await globalMenu.isVisible().catch(() => false)
      console.log(`📍 菜单仍然可见: ${menuStillVisible}`)

      if (menuStillVisible) {
        /* 截图记录 bug */
        await page.screenshot({
          path: 'e2e/sftp/debug-bug033-menu-still-visible-after-click-fileitem.png',
          fullPage: false
        })
        console.log('📍 已保存截图: debug-bug033-menu-still-visible-after-click-fileitem.png')
      }

      expect(menuStillVisible).toBe(false)
      console.log('✅✅✅ 左键点击另一个 file-item 后菜单已关闭 ✅✅✅')

    } finally {
      if (fs.existsSync(localTestDir)) {
        fs.rmSync(localTestDir, { recursive: true, force: true })
      }
    }
  })

  /**
   * 场景2：右键弹出菜单 → 左键点击空白区域 → 菜单应关闭
   */
  test('场景2: 右键弹出菜单后左键点击空白区域应关闭菜单', async () => {
    if (!page) throw new Error('Page 未初始化')
    console.log('\n=== BUG-033 场景2: 左键点击空白区域关闭菜单 ===')

    await openSFTPWindow(page)

    const localTestDir = createTestDir()
    try {
      const localPathInput = page.locator('.file-panel.local .path-input').first()
      await localPathInput.fill(localTestDir)
      await localPathInput.press('Enter')
      await page.waitForTimeout(2000)

      const localFileItems = page.locator('.file-panel.local .file-item')
      expect(await localFileItems.count()).toBeGreaterThan(0)

      /* 步骤1: 右键打开菜单 */
      await localFileItems.first().click({ button: 'right', force: true })
      await page.waitForTimeout(800)

      const globalMenu = page.locator('.global-context-menu')
      await expect(globalMenu).toBeVisible({ timeout: 5000 })
      console.log('✅ 步骤1: 右键菜单已弹出')

      /* 步骤2: 左键点击 file-list 内的空白区域（文件列表底部） */
      const fileList = page.locator('.file-panel.local .file-list')
      const box = await fileList.boundingBox()
      if (!box) throw new Error('无法获取 file-list 边界框')

      /* 点击文件列表底部空白处 */
      const blankX = box.x + box.width * 0.5
      const blankY = box.y + box.height - 15

      console.log(`📍 步骤2: 左键点击空白区域 (${Math.round(blankX)}, ${Math.round(blankY)})`)
      await page.mouse.click(blankX, blankY)
      await page.waitForTimeout(500)

      /* 验证菜单已关闭 */
      const menuStillVisible = await globalMenu.isVisible().catch(() => false)
      console.log(`📍 菜单仍然可见: ${menuStillVisible}`)

      if (menuStillVisible) {
        await page.screenshot({
          path: 'e2e/sftp/debug-bug033-menu-still-visible-after-click-blank.png',
          fullPage: false
        })
      }

      expect(menuStillVisible).toBe(false)
      console.log('✅✅✅ 左键点击空白区域后菜单已关闭 ✅✅✅')

    } finally {
      if (fs.existsSync(localTestDir)) {
        fs.rmSync(localTestDir, { recursive: true, force: true })
      }
    }
  })

  /**
   * 场景3：远程面板同样的问题验证
   */
  test('场景3: 远程面板右键菜单后左键点击 file-item 也应关闭', async () => {
    if (!page) throw new Error('Page 未初始化')
    console.log('\n=== BUG-033 场景3: 远程面板左键关闭菜单 ===')

    await openSFTPWindow(page)

    /* 等待远程文件加载 */
    const remoteFileItems = page.locator('.file-panel.remote .file-item')
    let remoteCount = await remoteFileItems.count()

    for (let i = 0; i < 5 && remoteCount < 2; i++) {
      await page.waitForTimeout(2000)
      remoteCount = await remoteFileItems.count()
    }

    console.log(`📍 远程文件数量: ${remoteCount}`)

    if (remoteCount >= 2) {
      /* 右键第一个远程文件 */
      await remoteFileItems.nth(0).click({ button: 'right', force: true })
      await page.waitForTimeout(800)

      const globalMenu = page.locator('.global-context-menu')
      await expect(globalMenu).toBeVisible({ timeout: 5000 })
      console.log('✅ 步骤1: 远程面板右键菜单已弹出')

      /* 左键点击第二个远程文件 */
      await remoteFileItems.nth(1).click({ force: true })
      await page.waitForTimeout(500)

      const menuStillVisible = await globalMenu.isVisible().catch(() => false)
      console.log(`📍 菜单仍然可见: ${menuStillVisible}`)

      if (menuStillVisible) {
        await page.screenshot({
          path: 'e2e/sftp/debug-bug033-remote-menu-still-visible.png',
          fullPage: false
        })
      }

      expect(menuStillVisible).toBe(false)
      console.log('✅✅✅ 远程面板左键点击后菜单已关闭 ✅✅✅')
    } else {
      console.log('⚠️ 远程文件不足 2 个，跳过此场景')
    }
  })
})
