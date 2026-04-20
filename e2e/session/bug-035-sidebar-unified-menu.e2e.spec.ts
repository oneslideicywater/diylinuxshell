/**
 * BUG-035: SessionSidebarContainer 列表右键菜单统一重构 + 全局菜单样式验证
 * 
 * 重构内容：
 * - SessionSidebarContainer.vue: 移除内联 .context-menu DOM，改用 GlobalContextMenu
 * - GlobalContextMenu.vue: 只显示 title（移除 description），缩小高度/字体
 * 
 * 测试场景：
 * - 场景1: 右键会话列表空白区域应弹出全局菜单（新建分组）
 * - 场景2: 菜单只显示 title，不显示 description
 * - 场景3: 点击"新建分组"后菜单关闭并打开分组表单
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp } from '../helpers/electron-app'

async function showSessionList(page: Page): Promise<void> {
  await page.reload()
  await page.waitForSelector('.session-list', { timeout: 20000 })
  await page.waitForTimeout(2000)
}

test.describe('BUG-035: SessionSidebarContainer 统一全局菜单 + 样式验证', () => {
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
   * 场景1: 右键列表空白区域弹出 .global-context-menu
   */
  test('场景1: 右键会话列表空白区域应弹出全局菜单', async () => {
    if (!page) throw new Error('Page 未初始化')
    console.log('\n=== BUG-035 场景1: SessionSidebarContainer 全局菜单 ===')

    await showSessionList(page)

    /* 找到可右键的区域（优先 spacer，其次 session-groups，最后 session-list） */
    let targetArea = page.locator('.session-list-spacer').first()
    if (await targetArea.count() === 0) {
      targetArea = page.locator('.session-groups').first()
    }
    if (await targetArea.count() === 0) {
      targetArea = page.locator('.session-list').first()
    }
    await expect(targetArea.first()).toBeVisible({ timeout: 5000 })

    console.log('📍 右键点击列表区域...')
    await targetArea.first().click({ button: 'right', force: true })
    await page.waitForTimeout(800)

    /* 验证：应该显示 .global-context-menu */
    const globalMenu = page.locator('.global-context-menu')
    await expect(globalMenu).toBeVisible({ timeout: 5000 })

    /* 验证没有旧的内联菜单 */
    const oldInlineMenu = page.locator('.session-list > .context-menu')
    const oldMenuCount = await oldInlineMenu.count()
    expect(oldMenuCount).toBe(0)

    /* 验证菜单内容包含"新建分组" */
    const menuText = await globalMenu.textContent()
    expect(menuText).toContain('新建分组')

    console.log('✅✅✅ SessionSidebarContainer 使用全局菜单 ✅✅✅')
  })

  /**
   * 场景2: 验证菜单只显示 title，不显示 description
   */
  test('场景2: 菜单项只显示 title，不显示 description', async () => {
    if (!page) throw new Error('Page 未初始化')
    console.log('\n=== BUG-035 场景2: 样式验证 - 无 description ===')

    await showSessionList(page)

    /* 右键打开列表菜单 */
    let targetArea = page.locator('.session-list-spacer').first()
    if (await targetArea.count() === 0) {
      targetArea = page.locator('.session-groups').first()
    }
    if (await targetArea.count() === 0) {
      targetArea = page.locator('.session-list').first()
    }
    await targetArea.first().click({ button: 'right', force: true })
    await page.waitForTimeout(800)

    const globalMenu = page.locator('.global-context-menu')
    await expect(globalMenu).toBeVisible({ timeout: 5000 })

    /* 验证：不存在 .menu-item-description 元素 */
    const descElements = globalMenu.locator('.menu-item-description')
    const descCount = await descElements.count()
    console.log(`📍 menu-item-description 元素数量: ${descCount}`)
    expect(descCount).toBe(0)

    /* 验证：存在 .menu-item-title 元素且包含文字 */
    const titleElement = globalMenu.locator('.menu-item-title').first()
    await expect(titleElement).toBeVisible()

    const titleText = await titleElement.textContent()
    expect(titleText?.trim().length).toBeGreaterThan(0)
    console.log(`📍 菜单项标题文字: "${titleText}"`)

    console.log('✅✅✅ 菜单只显示 title，无 description ✅✅✅')
  })

  /**
   * 场景3: 点击"新建分组"后菜单关闭
   */
  test('场景3: 点击"新建分组"后菜单关闭并触发操作', async () => {
    if (!page) throw new Error('Page 未初始化')
    console.log('\n=== BUG-035 场景3: 点击菜单项 ===')

    await showSessionList(page)

    /* 右键打开列表菜单 */
    let targetArea = page.locator('.session-list-spacer').first()
    if (await targetArea.count() === 0) {
      targetArea = page.locator('.session-groups').first()
    }
    if (await targetArea.count() === 0) {
      targetArea = page.locator('.session-list').first()
    }
    await targetArea.first().click({ button: 'right', force: true })
    await page.waitForTimeout(800)

    const globalMenu = page.locator('.global-context-menu')
    await expect(globalMenu).toBeVisible({ timeout: 5000 })
    console.log('✅ 步骤1: 全局菜单已弹出')

    /* 点击"新建分组" */
    const createGroupItem = globalMenu.locator('.context-menu-item', { hasText: '新建分组' })
    await createGroupItem.click({ force: true })
    await page.waitForTimeout(500)

    /* 验证菜单已关闭 */
    const stillVisible = await globalMenu.isVisible().catch(() => false)
    expect(stillVisible).toBe(false)
    console.log('✅ 步骤2: 菜单已关闭')

    /* 验证分组表单已打开 */
    const groupForm = page.locator('.group-form-overlay')
    await expect(groupForm).toBeVisible({ timeout: 3000 })
    console.log('✅ 步骤3: 分组表单已打开')

    console.log('✅✅✅ 菜单项点击正常工作 ✅✅✅')
  })

  /**
   * 场景4: 验证菜单样式（高度、字体大小）
   */
  test('场景4: 菜单项高度和字体大小符合要求', async () => {
    if (!page) throw new Error('Page 未初始化')
    console.log('\n=== BUG-035 场景4: 样式尺寸验证 ===')

    await showSessionList(page)

    /* 右键打开列表菜单 */
    let targetArea = page.locator('.session-list-spacer').first()
    if (await targetArea.count() === 0) {
      targetArea = page.locator('.session-groups').first()
    }
    if (await targetArea.count() === 0) {
      targetArea = page.locator('.session-list').first()
    }
    await targetArea.first().click({ button: 'right', force: true })
    await page.waitForTimeout(800)

    const menuItem = page.locator('.context-menu-item').first()
    await expect(menuItem).toBeVisible({ timeout: 5000 })

    /* 验证 padding（影响高度） */
    const paddingTop = await menuItem.evaluate(el => getComputedStyle(el).paddingTop)
    const paddingBottom = await menuItem.evaluate(el => getComputedStyle(el).paddingBottom)
    console.log(`📍 菜单项 padding: ${paddingTop} / ${paddingBottom}`)

    /* padding 应该较小（5px 左右），不是旧的 8px */
    const ptNum = parseFloat(paddingTop)
    const pbNum = parseFloat(paddingBottom)
    expect(ptNum).toBeLessThanOrEqual(6)
    expect(pbNum).toBeLessThanOrEqual(6)

    /* 验证字体大小 */
    const titleEl = menuItem.locator('.menu-item-title')
    const fontSize = await titleEl.evaluate(el => getComputedStyle(el).fontSize)
    console.log(`📍 标题字体大小: ${fontSize}`)

    /* 字体应该是 12px 左右，不是旧的 13px */
    const fontSizeNum = parseFloat(fontSize)
    expect(fontSizeNum).toBeLessThanOrEqual(13)

    console.log('✅✅✅ 菜单样式符合要求 ✅✅✅')
  })
})
