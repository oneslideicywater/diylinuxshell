/**
 * SFTP 右键菜单全局唯一性测试
 * 
 * 验证 PRD 要求：
 * 场景1：SftpLocal 和 SftpRemote 右键菜单全局互斥，同时只能显示一个
 * 场景2：同组件内点击不同文件，菜单位置跟随鼠标更新
 * 场景3：任意位置点击左键，右键菜单应该关闭
 * 
 * Bug 修复验证：
 * - BUG-029: 修复前菜单位置固定（用 rect.bottom），修复后跟随鼠标
 * - BUG-030: 修复前两个菜单同时出现，修复后通过 Store isOwner 保证唯一
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp } from '../helpers/electron-app'
import * as fs from 'fs'
import * as path from 'path'

/* 测试会话配置 */
const TEST_SESSION = {
  name: 'SFTP ContextMenu Unique Test',
  host: '192.168.10.24',
  port: 22,
  username: 'root',
  password: 'One.00000'
}

/**
 * 辅助函数：打开 SFTP 窗口
 */
async function openSFTPWindow(page: Page): Promise<void> {
  await page.waitForSelector('.session-list', { timeout: 20000 })

  /* 创建测试会话（如果不存在） */
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

  /* 展开分组 */
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

  /* 找到测试会话并点击 SFTP 按钮 */
  const sessionItem = page.locator('.session-item', {
    hasText: TEST_SESSION.name
  }).first()

  const count = await sessionItem.count()
  if (count === 0) throw new Error('找不到测试会话')

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

/**
 * 辅助函数：在指定面板创建测试文件（用于右键菜单测试）
 */
async function createTestFiles(): Promise<string> {
  const testDir = `D:\\test_ctxmenu_${Date.now()}`
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true })
  }
  /* 创建多个文件用于场景2测试 */
  for (let i = 1; i <= 3; i++) {
    fs.writeFileSync(path.join(testDir, `file${i}.txt`), `content ${i}`)
  }
  return testDir
}

test.describe('SFTP 右键菜单全局唯一性', () => {
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
   * PRD 场景1：
   * 点击 SftpLocal 文件 → 右键菜单显示
   * 点击 SftpRemote 文件夹 → SftpLocal 菜单关闭，只有 SftpRemote 菜单显示
   * 全局同时只能有一个右键菜单
   */
  test('PRD场景1: SFTP Local和Remote右键菜单全局互斥', async () => {
    if (!page) throw new Error('Page 未初始化')

    console.log('\n=== PRD场景1: 验证全局互斥 ===')

    /* 1. 打开 SFTP 窗口 */
    await openSFTPWindow(page)

    /* 2. 在本地面板导航到测试目录（有文件可右键） */
    const localTestDir = await createTestFiles()
    try {
      const localPathInput = page.locator('.file-panel.local .path-input').first()
      await localPathInput.fill(localTestDir)
      await localPathInput.press('Enter')
      await page.waitForTimeout(2000)

      /* 等待本地文件列表加载 */
      const localFileItems = page.locator('.file-panel.local .file-item')
      const localCount = await localFileItems.count()
      expect(localCount).toBeGreaterThan(0)
      console.log(`📍 本地文件数量: ${localCount}`)

      /* 3. 右键点击本地文件1 → 显示 Local 右键菜单 */
      const firstLocalFile = page.locator('.file-panel.local .file-item').first()
      await firstLocalFile.click({ force: true })
      await firstLocalFile.evaluate((el) => {
        el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window }))
      })
      await page.waitForTimeout(800)

      /* 验证：Local 右键菜单出现 */
      const localContextMenu = page.locator('.file-panel.local .file-context-menu')
      await expect(localContextMenu).toBeVisible({ timeout: 5000 })
      console.log('✅ Local 右键菜单已显示')

      /* 统计当前所有可见的右键菜单数量 */
      const allMenusBefore = page.locator('.file-context-menu')
      const menuCountBefore = await allMenusBefore.count()
      console.log(`📍 当前可见右键菜单数量: ${menuCountBefore}`)

      /* 4. 右键点击远程文件列表区域 → 应该关闭 Local 菜单，只显示 Remote 菜单 */
      const remoteFileList = page.locator('.file-panel.remote .file-list').first()
      
      /* 先确保远程文件列表有内容（连接后应该有根目录文件） */
      const remoteFileItems = page.locator('.file-panel.remote .file-item')
      const remoteCount = await remoteFileItems.count()
      console.log(`📍 远程文件数量: ${remoteCount}`)

      if (remoteCount > 0) {
        /* 右键点击第一个远程文件 */
        const firstRemoteFile = page.locator('.file-panel.remote .file-item').first()
        await firstRemoteFile.click({ force: true })
        await firstRemoteFile.evaluate((el) => {
          el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window }))
        })
      } else {
        /* 远程无文件则右键点击空白区域 */
        await remoteFileList.evaluate((el) => {
          el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window }))
        })
      }
      await page.waitForTimeout(800)

      /* 5. 核心验证：同时只能有一个右键菜单可见！ */
      const allMenusAfter = page.locator('.file-context-menu')
      const menuCountAfter = await allMenusAfter.count()
      console.log(`📍 Remote 右键后可见菜单数量: ${menuCountAfter}`)

      /* 关键断言：全局只能有 1 个右键菜单 */
      expect(menuCountAfter).toBe(1)
      console.log('✅✅✅ 全局唯一性验证通过：同时只有 1 个右键菜单 ✅✅✅')

      /* 6. 进一步验证：Local 的菜单已不可见，Remote 的菜单可见 */
      const localMenuStillVisible = await localContextMenu.isVisible().catch(() => false)
      expect(localMenuStillVisible).toBe(false)
      console.log('✅ Local 右键菜单已自动关闭')

      const remoteContextMenu = page.locator('.file-panel.remote .file-context-menu')
      const remoteMenuVisible = await remoteContextMenu.isVisible().catch(() => false)
      expect(remoteMenuVisible).toBe(true)
      console.log('✅ Remote 右键菜单正在显示')

      console.log('\n=== ✅ PRD场景1 通过：全局互斥正常 ===\n')

    } finally {
      /* 清理测试目录 */
      if (fs.existsSync(localTestDir)) {
        fs.rmSync(localTestDir, { recursive: true, force: true })
      }
    }
  })

  /**
   * PRD 场景2：
   * 点击 SftpLocal 文件1 → 右键菜单在鼠标位置显示
   * 再点击文件2 → 右键菜单跟随到文件2位置
   */
  test('PRD场景2: 同组件内切换文件时菜单位置跟随鼠标', async () => {
    if (!page) throw new Error('Page 未初始化')

    console.log('\n=== PRD场景2: 验证位置跟随 ===')

    /* 1. 打开 SFTP 窗口 */
    await openSFTPWindow(page)

    /* 2. 导航到有多个文件的测试目录 */
    const localTestDir = await createTestFiles()
    try {
      const localPathInput = page.locator('.file-panel.local .path-input').first()
      await localPathInput.fill(localTestDir)
      await localPathInput.press('Enter')
      await page.waitForTimeout(2000)

      const localFileItems = page.locator('.file-panel.local .file-item')
      const fileCount = await localFileItems.count()
      expect(fileCount).toBeGreaterThanOrEqual(2)
      console.log(`📍 本地文件数量: ${fileCount}（需要 >= 2 个用于位置对比）`)

      /* 3. 右键点击文件1 → 记录菜单位置 */
      const file1 = localFileItems.nth(0)
      await file1.click({ force: true })
      await file1.evaluate((el) => {
        el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window }))
      })
      await page.waitForTimeout(800)

      const contextMenu = page.locator('.file-panel.local .file-context-menu')
      await expect(contextMenu).toBeVisible({ timeout: 5000 })

      /* 获取第一次菜单的位置（读取内联 style） */
      const pos1 = await contextMenu.evaluate((el) => ({
        top: (el as HTMLElement).style.top,
        left: (el as HTMLElement).style.left
      }))
      console.log(`📍 文件1 右键菜单位置: top=${pos1.top}, left=${pos1.left}`)

      /* 4. 右键点击文件2 → 菜单位置应该改变 */
      const file2 = localFileItems.nth(1)
      await file2.click({ force: true })
      await file2.evaluate((el) => {
        el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window }))
      })
      await page.waitForTimeout(800)

      /* 菜单仍然可见（同一组件） */
      await expect(contextMenu).toBeVisible({ timeout: 5000 })

      /* 获取第二次菜单的位置 */
      const pos2 = await contextMenu.evaluate((el) => ({
        top: (el as HTMLElement).style.top,
        left: (el as HTMLElement).style.left
      }))
      console.log(`📍 文件2 右键菜单位置: top=${pos2.top}, left=${pos2.left}`)

      /* 5. 验证位置发生了变化（不同文件的 y 坐标应不同） */
      /* 文件垂直排列，点击不同文件后 top 值必然不同 */
      const positionChanged = pos1.top !== pos2.top || pos1.left !== pos2.left
      
      console.log(`📍 位置变化: top(${pos1.top} → ${pos2.top}), left(${pos1.left} → ${pos2.left})`)
      
      expect(positionChanged).toBe(true)
      console.log('✅✅✅ 菜单位置已跟随鼠标更新 ✅✅✅')

      /* 6. 额外验证：全局仍然只有 1 个菜单 */
      const allMenus = page.locator('.file-context-menu')
      const totalMenus = await allMenus.count()
      expect(totalMenus).toBe(1)
      console.log('✅ 切换文件后全局仍只有 1 个菜单')

      console.log('\n=== ✅ PRD场景2 通过：位置跟随正常 ===\n')

    } finally {
      if (fs.existsSync(localTestDir)) {
        fs.rmSync(localTestDir, { recursive: true, force: true })
      }
    }
  })

  /**
   * PRD 场景3：任意位置点击左键，右键菜单应该关闭
   */
  test('PRD场景3: 左键点击菜单外部区域关闭右键菜单', async () => {
    if (!page) throw new Error('Page 未初始化')

    console.log('\n=== PRD场景3: 点击文件列表空白区域关闭菜单 ===\n')

    /* 打开 SFTP 窗口 */
    await openSFTPWindow(page)

    /* 等待文件列表加载 */
    const localFileItems = page.locator('.file-panel.local .file-item')
    await localFileItems.first().waitFor({ state: 'visible', timeout: 15000 })
    const fileCount = await localFileItems.count()
    expect(fileCount).toBeGreaterThan(0)

    /* 1. 右键点击第一个文件 → 显示右键菜单 */
    const file1 = localFileItems.first()
    await file1.click({ force: true })
    await file1.evaluate((el) => {
      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window }))
    })
    await page.waitForTimeout(800)

    const contextMenu = page.locator('.file-panel.local .file-context-menu')
    await expect(contextMenu).toBeVisible({ timeout: 5000 })
    console.log('✅ 步骤1: 右键菜单已显示')

    /* 2. 左键点击 file-list 空白区域（文件列表内、文件项外的空白处） */
    const fileList = page.locator('.file-panel.local .file-list')
    const box = await fileList.boundingBox()
    if (!box) throw new Error('无法获取 file-list 边界框')

    /* 点击 file-list 底部空白处（文件项下方的空白区域） */
    const blankX = box.x + box.width * 0.3
    const blankY = box.y + box.height - 20

    console.log(`📍 步骤2: 点击 file-list 空白区域 (${Math.round(blankX)}, ${Math.round(blankY)})`)
    await page.mouse.click(blankX, blankY)
    await page.waitForTimeout(500)

    /* 验证菜单已关闭 */
    await expect(contextMenu).toBeHidden({ timeout: 3000 })
    console.log('✅✅✅ 步骤2: 点击空白区域后右键菜单已关闭 ✅✅✅')

    /* 3. 全局无任何可见菜单 */
    const allMenus = page.locator('.file-context-menu')
    const visibleMenus = await allMenus.filter({ visible: true }).count()
    expect(visibleMenus).toBe(0)
    console.log('✅ 全局无可见右键菜单')

    console.log('\n=== ✅ PRD场景3 通过 ===\n')
  })
})
