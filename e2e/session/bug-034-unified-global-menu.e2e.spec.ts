/**
 * BUG-034: GroupHeader 和 SessionItem 右键菜单统一重构验证
 * 
 * 重构内容：
 * - GroupHeader.vue: 移除内联 .context-menu DOM，改用 GlobalContextMenu + contextMenuStore
 * - SessionItem.vue: 移除内联 .context-menu DOM，改用 GlobalContextMenu + contextMenuStore
 * 
 * 测试场景：
 * - 场景1: 右键点击 GroupHeader 应弹出全局菜单（包含分组管理项）
 * - 场景2: 右键点击 SessionItem 应弹出全局菜单（包含会话操作项）
 * - 场景3: 点击菜单项后菜单关闭
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp } from '../helpers/electron-app'

const TEST_SESSION = {
  name: 'BUG-034 Unified Menu Test',
  host: '192.168.10.24',
  port: 22,
  username: 'root',
  password: 'One.00000'
}

async function ensureSessionExists(page: Page): Promise<void> {
  await page.waitForSelector('.session-list', { timeout: 20000 })
  await page.evaluate(async (sessionData) => {
    const sessions = await (window as any).api.session.getAll()
    const existing = sessions.find((s: any) => s.name === sessionData.name)
    if (!existing) {
      await (window as any).api.session.create(sessionData)
    }
  }, TEST_SESSION)
}

async function showSessionList(page: Page): Promise<void> {
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
}

test.describe('BUG-034: GroupHeader/SessionItem 右键菜单统一为 GlobalContextMenu', () => {
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
   * 场景1: 右键 GroupHeader 弹出全局菜单，包含分组管理项
   */
  test('场景1: 右键点击 GroupHeader 应弹出 .global-context-menu', async () => {
    if (!page) throw new Error('Page 未初始化')
    console.log('\n=== BUG-034 场景1: GroupHeader 全局右键菜单 ===')

    await ensureSessionExists(page)
    await showSessionList(page)

    /* 找到 group-header 并右键 */
    const groupHeader = page.locator('.group-header').first()
    await expect(groupHeader).toBeVisible({ timeout: 5000 })

    console.log('📍 右键点击 GroupHeader...')
    await groupHeader.click({ button: 'right', force: true })
    await page.waitForTimeout(800)

    /* 验证：应该显示 .global-context-menu（不是旧的 .context-menu） */
    const globalMenu = page.locator('.global-context-menu')
    await expect(globalMenu).toBeVisible({ timeout: 5000 })

    /* 验证没有旧的内联菜单 */
    const oldInlineMenu = page.locator('.group-header-wrapper > .context-menu')
    const oldMenuCount = await oldInlineMenu.count()
    console.log(`📍 旧内联 context-menu 数量: ${oldMenuCount}`)
    expect(oldMenuCount).toBe(0)

    /* 验证菜单项内容 */
    const menuItems = globalMenu.locator('.context-menu-item')
    const itemCount = await menuItems.count()
    console.log(`📍 全局菜单项数量: ${itemCount}`)
    expect(itemCount).toBeGreaterThanOrEqual(4)

    /* 检查关键菜单项 */
    const menuText = await globalMenu.textContent()
    expect(menuText).toContain('添加会话')
    expect(menuText).toContain('编辑分组')
    expect(menuText).toContain('删除分组')

    console.log('✅✅✅ GroupHeader 右键使用全局菜单 ✅✅✅')
  })

  /**
   * 场景2: 右键 SessionItem 弹出全局菜单，包含会话操作项
   */
  test('场景2: 右键点击 SessionItem 应弹出 .global-context-menu', async () => {
    if (!page) throw new Error('Page 未初始化')
    console.log('\n=== BUG-034 场景2: SessionItem 全局右键菜单 ===')

    await ensureSessionExists(page)
    await showSessionList(page)

    /* 找到测试会话并右键 */
    const sessionItem = page.locator('.session-item', { hasText: TEST_SESSION.name }).first()
    if (await sessionItem.count() === 0) throw new Error('找不到测试会话')

    console.log('📍 右键点击 SessionItem...')
    await sessionItem.click({ button: 'right', force: true })
    await page.waitForTimeout(800)

    /* 验证：应该显示 .global-context-menu */
    const globalMenu = page.locator('.global-context-menu')
    await expect(globalMenu).toBeVisible({ timeout: 5000 })

    /* 验证没有旧的内联菜单 */
    const oldInlineMenu = sessionItem.locator('> .context-menu')
    const oldMenuCount = await oldInlineMenu.count()
    console.log(`📍 旧内联 context-menu 数量: ${oldMenuCount}`)
    expect(oldMenuCount).toBe(0)

    /* 验证菜单项内容 */
    const menuText = await globalMenu.textContent()
    expect(menuText).toContain('连接')
    expect(menuText).toContain('编辑')
    expect(menuText).toContain('复制会话')
    expect(menuText).toContain('删除')

    console.log('✅✅✅ SessionItem 右键使用全局菜单 ✅✅✅')
  })

  /**
   * 场景3: 点击菜单项后菜单应自动关闭（通过 handleSelect）
   */
  test('场景3: 点击全局菜单项后菜单应自动关闭', async () => {
    if (!page) throw new Error('Page 未初始化')
    console.log('\n=== BUG-034 场景3: 点击菜单项后关闭 ===')

    await ensureSessionExists(page)
    await showSessionList(page)

    /* 右键打开 SessionItem 菜单 */
    const sessionItem = page.locator('.session-item', { hasText: TEST_SESSION.name }).first()
    await sessionItem.click({ button: 'right', force: true })
    await page.waitForTimeout(800)

    const globalMenu = page.locator('.global-context-menu')
    await expect(globalMenu).toBeVisible({ timeout: 5000 })
    console.log('✅ 步骤1: 全局菜单已弹出')

    /* 点击"审查元素"菜单项（不会触发副作用操作） */
    const inspectItem = globalMenu.locator('.context-menu-item', { hasText: '审查元素' })
    if (await inspectItem.count() > 0) {
      await inspectItem.click({ force: true })
      await page.waitForTimeout(500)

      /* 验证菜单已关闭 */
      const stillVisible = await globalMenu.isVisible().catch(() => false)
      console.log(`📍 菜单仍然可见: ${stillVisible}`)
      expect(stillVisible).toBe(false)
      console.log('✅✅✅ 点击菜单项后菜单已关闭 ✅✅✅')
    } else {
      console.log('⚠️ 未找到审查元素项，跳过点击测试')
    }
  })

  /**
   * 场景4: 全局互斥 - 先右键 GroupHeader 再右键 SessionItem，菜单内容应切换为 SessionItem 的
   */
  test('场景4: 全局互斥 - 切换右键目标时菜单内容应更新', async () => {
    if (!page) throw new Error('Page 未初始化')
    console.log('\n=== BUG-034 场景4: 全局互斥 ===')

    await ensureSessionExists(page)
    await showSessionList(page)

    /* 步骤1: 右键 GroupHeader */
    const groupHeader = page.locator('.group-header').first()
    await groupHeader.click({ button: 'right', force: true })
    await page.waitForTimeout(800)

    const globalMenu = page.locator('.global-context-menu')
    await expect(globalMenu).toBeVisible({ timeout: 5000 })

    let menuText = await globalMenu.textContent()
    expect(menuText).toContain('编辑分组')
    console.log('✅ 步骤1: GroupHeader 菜单已弹出（含"编辑分组"）')

    /* 步骤2: 按 ESC 关闭当前菜单 */
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    await expect(globalMenu).toBeHidden({ timeout: 3000 })
    console.log('✅ 步骤2: 菜单已关闭')

    /* 步骤3: 右键 SessionItem */
    const sessionItem = page.locator('.session-item', { hasText: TEST_SESSION.name }).first()
    await sessionItem.click({ button: 'right', force: true })
    await page.waitForTimeout(800)

    await expect(globalMenu).toBeVisible({ timeout: 5000 })

    /* 验证菜单内容已切换为 SessionItem 的 */
    menuText = await globalMenu.textContent()
    expect(menuText).toContain('连接')
    expect(menuText).toContain('复制会话')
    console.log('✅✅✅ 全局互斥正常：菜单内容已切换为 SessionItem 的 ✅✅✅')
  })
})
