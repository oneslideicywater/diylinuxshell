/**
 * 右键菜单图标加载测试
 * 
 * 测试场景：
 * 1. SFTP Remote 右键菜单图标是否正常显示
 * 2. 图标 .menu-item-icon 内是否包含 SVG 元素
 * 3. SVG 是否有有效的 path/circle 等图形内容（非空）
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: Page

test.describe('右键菜单图标加载测试', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  /**
   * 前置操作：创建测试会话并连接，进入 SFTP 模式
   */
  async function setupSftpSession(): Promise<void> {
    await page.evaluate(async () => {
      const sessions = await window.api.session.getAll()
      for (const session of sessions) {
        await window.api.session.delete(session.id)
      }
      await window.api.session.create({
        name: 'Icon-Test-Session',
        host: '192.168.10.24',
        port: 22,
        username: 'root',
        password: 'One.00000'
      })
    })
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    /* 双击会话建立 SSH 连接 */
    const sessionItem = page.locator('.session-item').first()
    await sessionItem.dblclick()
    await page.waitForTimeout(3000)

    /* 点击 SFTP 标签页进入 SFTP 模式 */
    const sftpTab = page.locator('text=SFTP').first()
    if (await sftpTab.isVisible()) {
      await sftpTab.click()
      await page.waitForTimeout(2000)
    }
  }

  test('SFTP Remote 右键菜单应显示图标并正确渲染', async () => {
    await setupSftpSession()

    console.log('=== 右键点击 Remote 文件列表空白区域 ===')
    const remoteFileList = page.locator('.sftp-file-list.remote').first()
    if (await remoteFileList.isVisible()) {
      await remoteFileList.click({ button: 'right', position: { x: 100, y: 50 } })
    } else {
      throw new Error('Remote 文件列表不可见')
    }

    await page.waitForTimeout(500)

    console.log('=== 检查右键菜单是否显示 ===')
    const contextMenu = page.locator('.global-context-menu')
    await expect(contextMenu).toBeVisible({ timeout: 3000 })

    console.log('=== 检查菜单项图标元素 ===')

    /* 获取所有菜单项 */
    const menuItems = page.locator('.context-menu-item')
    const count = await menuItems.count()
    console.log(`菜单项数量: ${count}`)
    expect(count).toBeGreaterThan(0)

    let iconRenderedCount = 0
    let failedIcons: string[] = []

    /* 检查每个菜单项的图标 */
    for (let i = 0; i < count; i++) {
      const item = menuItems.nth(i)
      const titleElement = item.locator('.menu-item-title')
      const titleText = await titleElement.textContent().catch(() => '')
      console.log(`\n--- 菜单项 ${i + 1}: "${titleText}" ---`)

      /* 检查是否存在图标容器元素 */
      const iconContainer = item.locator('.menu-item-icon')
      const hasIcon = await iconContainer.count().then(c => c > 0)
      console.log(`  是否有图标元素: ${hasIcon}`)

      if (hasIcon) {
        /* 检查内部是否有 SVG 元素 */
        const svgElement = iconContainer.locator('svg')
        const hasSvg = await svgElement.count().then(c => c > 0)
        console.log(`  是否包含 SVG: ${hasSvg}`)

        if (!hasSvg) {
          failedIcons.push(`${titleText} (.menu-item-icon 内无 SVG)`)
          continue
        }

        /* 检查 SVG 是否有实际的图形内容（path / circle / rect 等） */
        const hasGraphicContent = await svgElement.evaluate((svgEl: SVGSVGElement): boolean => {
          const children = svgEl.children
          if (children.length === 0) return false
          for (const child of Array.from(children)) {
            if (['path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'ellipse'].includes(child.tagName.toLowerCase())) {
              return true
            }
          }
          return false
        }).catch(() => false)
        console.log(`  SVG 有图形内容: ${hasGraphicContent}`)

        if (hasGraphicContent) {
          iconRenderedCount++
        } else {
          failedIcons.push(`${titleText} (SVG 无有效图形内容)`)
        }
      }
    }

    console.log(`\n=== 图标渲染统计 ===`)
    console.log(`  成功渲染: ${iconRenderedCount}/${count}`)
    console.log(`  失败: ${failedIcons.length}`)

    if (failedIcons.length > 0) {
      console.error(`  失败项:`)
      failedIcons.forEach(f => console.error(`    - ${f}`))
    }

    /* 至少应有部分图标成功渲染 */
    expect(iconRenderedCount, `期望至少部分图标渲染成功，但全部失败: ${failedIcons.join(', ')}`).toBeGreaterThan(0)

    /* 截图保存测试结果 */
    await page.screenshot({
      path: 'test-results/context-menu-icons-test.png',
      fullPage: true
    })

    console.log('\n=== 测试完成 ===')
  })

  test('SessionItem 右键菜单应显示图标并正确渲染', async () => {
    await setupSftpSession()

    console.log('=== 右键点击 SessionItem ===')
    const sessionItem = page.locator('.session-item').first()
    await sessionItem.click({ button: 'right' })
    await page.waitForTimeout(500)

    const contextMenu = page.locator('.global-context-menu')
    await expect(contextMenu).toBeVisible({ timeout: 3000 })

    const menuItems = page.locator('.context-menu-item')
    const count = await menuItems.count()
    console.log(`SessionItem 菜单项数量: ${count}`)

    let iconRenderedCount = 0
    let failedIcons: string[] = []

    for (let i = 0; i < count; i++) {
      const item = menuItems.nth(i)
      const iconContainer = item.locator('.menu-item-icon')
      const hasIcon = await iconContainer.count().then(c => c > 0)

      if (hasIcon) {
        const svgElement = iconContainer.locator('svg')
        const hasSvg = await svgElement.count().then(c => c > 0)

        if (hasSvg) {
          const hasContent = await svgElement.evaluate((el: SVGSVGElement) => el.children.length > 0).catch(() => false)
          if (hasContent) {
            iconRenderedCount++
          } else {
            const titleText = await item.locator('.menu-item-title').textContent().catch(() => '')
            failedIcons.push(`${titleText} (SVG 无子元素)`)
          }
        }
      }
    }

    console.log(`\nSessionItem 图标渲染统计:`)
    console.log(`  成功: ${iconRenderedCount}/${count}`)
    console.log(`  失败: ${failedIcons.length}`)

    if (failedIcons.length > 0) {
      console.error(`  失败项:`)
      failedIcons.forEach(f => console.error(`    - ${f}`))
    }

    expect(iconRenderedCount).toBeGreaterThan(0)

    await page.screenshot({
      path: 'test-results/session-context-menu-icons-test.png',
      fullPage: true
    })
  })
})
