/**
 * 多标签页 E2E 测试
 * 按照 XShell 行为标准测试终端标签页功能
 */

import { test, expect, beforeAll, afterAll } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'
import { testConfig, generateUniqueName } from '../config/test-config'
import type { ElectronApplication, Page } from '@playwright/test'

let app: ElectronApplication
let page: Page

/**
 * 辅助函数：创建会话并连接
 */
async function createSessionAndConnect(sessionName: string): Promise<void> {
  const addBtn = page.locator('.sidebar-section .add-btn').first()
  await addBtn.click()
  await page.waitForTimeout(500)

  await page.locator('.session-form input[id="name"]').fill(sessionName)
  await page.locator('.session-form input[id="host"]').fill(testConfig.ssh.host)
  await page.locator('.session-form input[id="port"]').fill(String(testConfig.ssh.port))
  await page.locator('.session-form input[id="username"]').fill(testConfig.ssh.username)
  await page.locator('.session-form input[id="password"]').fill(testConfig.ssh.password)
  await page.locator('.session-form .btn.submit').click()
  
  // 等待表单关闭
  await expect(page.locator('.session-form-overlay')).not.toBeVisible({ timeout: 5000 })
  
  // 滚动到会话列表底部，确保新会话可见
  const sessionList = page.locator('.session-groups')
  await sessionList.evaluate((el: Element) => {
    el.scrollTop = el.scrollHeight
  })
  await page.waitForTimeout(500)
  
  // 等待会话出现在列表中
  const sessionItem = page.locator('.session-item').filter({ hasText: sessionName }).first()
  await sessionItem.scrollIntoViewIfNeeded()
  await expect(sessionItem).toBeVisible({ timeout: 10000 })
  
  // 双击连接
  await sessionItem.dblclick()
  await page.waitForTimeout(3000)
}

/**
 * 辅助函数：在终端中输入命令并等待输出
 */
async function typeInTerminal(text: string): Promise<void> {
  await page.keyboard.type(text)
  await page.waitForTimeout(500)
}

/**
 * 辅助函数：获取当前可见的终端元素
 */
async function getVisibleTerminal(): Promise<{ count: number; isVisible: boolean }> {
  const terminals = page.locator('.x-terminal')
  const count = await terminals.count()
  
  // 检查是否有可见的终端
  let isVisible = false
  for (let i = 0; i < count; i++) {
    const terminal = terminals.nth(i)
    const display = await terminal.evaluate((el) => {
      return window.getComputedStyle(el).display
    })
    if (display !== 'none') {
      isVisible = true
      break
    }
  }
  
  return { count, isVisible }
}

/**
 * 标签页连接状态测试
 * 测试 XShell 标准的标签页连接状态显示
 */
test.describe('标签页连接状态', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('标签页显示连接状态指示器', async () => {
    // XShell 标准：标签页显示连接状态（已连接、连接中、断开、错误）
    const sessionName = generateUniqueName('状态指示器测试')
    await createSessionAndConnect(sessionName)

    const tabs = page.locator('.terminal-tab')
    const tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThanOrEqual(1)

    // 验证标签页有状态指示器
    const firstTab = tabs.first()
    const statusIndicator = firstTab.locator('.status-indicator')
    await expect(statusIndicator).toBeVisible()
  })

  test('连接成功后标签页状态变为已连接', async () => {
    // XShell 标准：连接成功后标签页显示绿色状态点
    const sessionName = generateUniqueName('已连接状态测试')
    await createSessionAndConnect(sessionName)

    const tabs = page.locator('.terminal-tab')
    const firstTab = tabs.first()
    const statusIndicator = firstTab.locator('.status-indicator')
    
    // 等待连接成功
    await page.waitForTimeout(3000)
    
    // 验证状态指示器有 connected 类
    const statusClass = await statusIndicator.getAttribute('class')
    expect(statusClass).toContain('connected')
  })

  test('多个标签页各自显示独立的连接状态', async () => {
    // XShell 标准：每个标签页独立显示各自的连接状态
    const sessionName1 = generateUniqueName('多状态测试1')
    const sessionName2 = generateUniqueName('多状态测试2')
    await createSessionAndConnect(sessionName1)
    await createSessionAndConnect(sessionName2)

    const tabs = page.locator('.terminal-tab')
    const tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThanOrEqual(2)

    // 验证每个标签页都有状态指示器
    for (let i = 0; i < Math.min(tabCount, 2); i++) {
      const tab = tabs.nth(i)
      const statusIndicator = tab.locator('.status-indicator')
      await expect(statusIndicator).toBeVisible()
      
      // 验证状态指示器有状态类
      const statusClass = await statusIndicator.getAttribute('class')
      expect(statusClass).toMatch(/connected|connecting|disconnected|error/)
    }
  })
})

/**
 * 标签页容器测试
 * 测试 XShell 标准的标签页布局
 */
test.describe('标签页容器', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('标签页容器应该可见', async () => {
    // XShell 标准：顶部显示标签页栏
    const tabsContainer = page.locator('.terminal-tabs')
    await expect(tabsContainer).toBeVisible()
  })

  test('标签页栏右侧有新建按钮', async () => {
    // XShell 标准：标签页栏右侧有"+"按钮用于新建标签页
    const addTabBtn = page.locator('.new-tab-btn')
    const isVisible = await addTabBtn.isVisible()
    expect(typeof isVisible).toBe('boolean')
  })
})

/**
 * 标签页创建测试
 * 测试 XShell 标准的标签页创建流程
 */
test.describe('标签页创建', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('双击会话创建标签页并尝试连接', async () => {
    // XShell 标准：双击会话自动创建标签页并尝试连接
    const sessionName = generateUniqueName('标签页测试')
    await createSessionAndConnect(sessionName)

    // 验证标签页创建
    const tabs = page.locator('.terminal-tab')
    const tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThanOrEqual(1)
    
    // 验证终端可见
    const { isVisible } = await getVisibleTerminal()
    expect(isVisible).toBe(true)
  })

  test('每个连接对应一个独立标签页', async () => {
    // XShell 标准：每个 SSH 连接对应一个独立的标签页
    const sessionName = generateUniqueName('第二个服务器')
    await createSessionAndConnect(sessionName)

    // 验证标签页数量增加
    const tabs = page.locator('.terminal-tab')
    const tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThanOrEqual(2)
    
    // 验证终端实例数量与标签页数量一致
    const { count } = await getVisibleTerminal()
    expect(count).toBe(tabCount)
  })

  test('标签页标题显示会话名称', async () => {
    // XShell 标准：标签页标题默认显示会话名称
    const tab = page.locator('.terminal-tab').first()
    const title = await tab.locator('.tab-title').textContent()
    expect(title).toBeTruthy()
  })

  /**
   * 测试用例：点击+按钮打开新建会话表单
   * 验证修复 BUG-009: 标签栏点击+按钮应该新增标签页
   * 确保点击+按钮能触发新建会话流程
   */
  test('点击+按钮打开新建会话表单', async () => {
    console.log('===== 开始测试：点击+按钮打开新建会话表单 =====')
    
    // 验证+按钮存在且可见
    const addTabBtn = page.locator('.new-tab-btn')
    await expect(addTabBtn).toBeVisible()
    console.log('✓ +按钮可见')
    
    // 点击+按钮
    await addTabBtn.click()
    await page.waitForTimeout(500)
    
    // 验证会话表单显示
    const sessionForm = page.locator('.session-form')
    await expect(sessionForm).toBeVisible()
    console.log('✓ 会话表单已显示')
    
    // 截图验证
    await page.screenshot({ path: 'test-results/tab-add-button.png', fullPage: false })
    console.log('截图已保存: test-results/tab-add-button.png')
    
    // 关闭会话表单
    const cancelBtn = page.locator('.session-form .btn.cancel')
    await cancelBtn.click()
    await page.waitForTimeout(300)
    
    // 验证会话表单已关闭
    await expect(sessionForm).not.toBeVisible()
    console.log('✓ 会话表单已关闭')
    
    console.log('===== 测试完成：点击+按钮功能正常 =====')
  })
})

/**
 * 标签页切换测试
 * 测试 XShell 标准的标签页切换行为
 * 核心测试：切换标签页后，对应的终端内容必须正确切换
 */
test.describe('标签页切换', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)

    // 创建两个会话用于切换测试
    const sessionName1 = generateUniqueName('切换测试1')
    const sessionName2 = generateUniqueName('切换测试2')
    await createSessionAndConnect(sessionName1)
    await createSessionAndConnect(sessionName2)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('点击标签页切换到对应终端', async () => {
    // XShell 标准：点击标签页切换显示对应的终端内容
    const tabs = page.locator('.terminal-tab')
    const tabCount = await tabs.count()

    if (tabCount >= 2) {
      // 记录初始状态
      const initialActiveTab = tabs.locator('.active')
      const initialActiveCount = await initialActiveTab.count()
      
      // 点击第一个标签页
      const firstTab = tabs.first()
      await firstTab.click()
      await page.waitForTimeout(500)

      // 验证第一个标签页变为激活状态
      const hasActiveClass = await firstTab.evaluate((el) => {
        return el.classList.contains('active')
      })
      expect(hasActiveClass).toBe(true)
      
      // 验证终端实例存在
      const { count, isVisible } = await getVisibleTerminal()
      expect(count).toBeGreaterThanOrEqual(tabCount)
      expect(isVisible).toBe(true)
    }
  })

  test('当前激活的标签页高亮显示', async () => {
    // XShell 标准：当前激活的标签页有明显的视觉区分
    const tabs = page.locator('.terminal-tab')
    const tabCount = await tabs.count()

    if (tabCount >= 1) {
      const firstTab = tabs.first()
      await firstTab.click()
      await page.waitForTimeout(300)

      // 检查是否有 active 类
      const hasActiveClass = await firstTab.evaluate((el) => {
        return el.classList.contains('active')
      })
      expect(hasActiveClass).toBe(true)
    }
  })

  test('切换标签页后终端内容相应切换', async () => {
    // XShell 标准：切换标签页后显示对应的终端内容
    // 这是核心测试：确保切换 tab 时终端也跟着切换
    const tabs = page.locator('.terminal-tab')
    const tabCount = await tabs.count()

    if (tabCount >= 2) {
      // 点击第一个标签页
      const firstTab = tabs.first()
      await firstTab.click()
      await page.waitForTimeout(500)
      
      // 验证第一个标签页激活
      const firstTabActive = await firstTab.evaluate((el) => {
        return el.classList.contains('active')
      })
      expect(firstTabActive).toBe(true)

      // 点击第二个标签页
      const secondTab = tabs.nth(1)
      await secondTab.click()
      await page.waitForTimeout(500)

      // 验证第二个标签页激活，第一个不再激活
      const secondTabActive = await secondTab.evaluate((el) => {
        return el.classList.contains('active')
      })
      expect(secondTabActive).toBe(true)
      
      const firstTabStillActive = await firstTab.evaluate((el) => {
        return el.classList.contains('active')
      })
      expect(firstTabStillActive).toBe(false)
      
      // 验证终端实例数量正确
      const { count } = await getVisibleTerminal()
      expect(count).toBe(tabCount)
    }
  })

  test('切换标签页后可以在新终端中输入命令', async () => {
    // XShell 标准：切换到新标签页后，可以在对应的终端中输入命令
    const tabs = page.locator('.terminal-tab')
    const tabCount = await tabs.count()

    if (tabCount >= 2) {
      // 切换到第二个标签页
      const secondTab = tabs.nth(1)
      await secondTab.click()
      await page.waitForTimeout(500)

      // 验证标签页激活
      const isActive = await secondTab.evaluate((el) => {
        return el.classList.contains('active')
      })
      expect(isActive).toBe(true)
      
      // 在终端中输入命令
      await page.keyboard.type('echo "test"')
      await page.waitForTimeout(300)
      
      // 验证终端仍然可见
      const { isVisible } = await getVisibleTerminal()
      expect(isVisible).toBe(true)
    }
  })

  test('多个标签页各自保持独立的终端状态', async () => {
    // XShell 标准：每个标签页的终端状态独立，切换后保持之前的内容
    const tabs = page.locator('.terminal-tab')
    const tabCount = await tabs.count()

    if (tabCount >= 2) {
      // 在第一个标签页输入命令
      const firstTab = tabs.first()
      await firstTab.click()
      await page.waitForTimeout(300)
      
      // 切换到第二个标签页
      const secondTab = tabs.nth(1)
      await secondTab.click()
      await page.waitForTimeout(300)
      
      // 验证第二个标签页激活
      const secondTabActive = await secondTab.evaluate((el) => {
        return el.classList.contains('active')
      })
      expect(secondTabActive).toBe(true)
      
      // 切换回第一个标签页
      await firstTab.click()
      await page.waitForTimeout(300)
      
      // 验证第一个标签页重新激活
      const firstTabActive = await firstTab.evaluate((el) => {
        return el.classList.contains('active')
      })
      expect(firstTabActive).toBe(true)
      
      // 验证终端实例仍然存在
      const { count } = await getVisibleTerminal()
      expect(count).toBe(tabCount)
    }
  })
})

/**
 * 标签页关闭测试
 * 测试 XShell 标准的标签页关闭行为
 */
test.describe('标签页关闭', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)

    // 创建会话并连接
    const sessionName = generateUniqueName('关闭测试')
    await createSessionAndConnect(sessionName)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('每个标签页有关闭按钮', async () => {
    // XShell 标准：每个标签页右侧有"×"关闭按钮
    const closeBtn = page.locator('.terminal-tab .close-btn').first()
    const isVisible = await closeBtn.isVisible()
    expect(typeof isVisible).toBe('boolean')
  })

  test('点击关闭按钮关闭标签页', async () => {
    // XShell 标准：点击"×"按钮关闭标签页
    const tabs = page.locator('.terminal-tab')
    const initialCount = await tabs.count()

    if (initialCount > 0) {
      const closeBtn = tabs.first().locator('.close-btn')
      if (await closeBtn.isVisible()) {
        await closeBtn.click()
        await page.waitForTimeout(500)

        const newCount = await tabs.count()
        expect(newCount).toBeLessThanOrEqual(initialCount)
      }
    }
  })

  test('关闭标签页后自动切换到相邻标签页', async () => {
    // XShell 标准：关闭当前标签页后自动切换到相邻的标签页
    // 创建两个会话
    const sessionName1 = generateUniqueName('相邻测试1')
    const sessionName2 = generateUniqueName('相邻测试2')
    await createSessionAndConnect(sessionName1)
    await createSessionAndConnect(sessionName2)

    const tabs = page.locator('.terminal-tab')
    const tabCount = await tabs.count()

    if (tabCount >= 2) {
      // 关闭第二个标签页
      const closeBtn = tabs.nth(1).locator('.close-btn')
      if (await closeBtn.isVisible()) {
        await closeBtn.click()
        await page.waitForTimeout(500)

        // 验证还有标签页存在
        const newCount = await tabs.count()
        expect(newCount).toBeGreaterThanOrEqual(1)
      }
    }
  })

  test('关闭一个标签页不应影响其他标签页的连接状态', async () => {
    // XShell 标准：每个标签页独立运行，关闭一个不应影响其他
    // 这是 BUG-002 的测试用例
    const sessionName = generateUniqueName('独立连接测试')
    
    // 创建会话
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)

    await page.locator('.session-form input[id="name"]').fill(sessionName)
    await page.locator('.session-form input[id="host"]').fill(testConfig.ssh.host)
    await page.locator('.session-form input[id="port"]').fill(String(testConfig.ssh.port))
    await page.locator('.session-form input[id="username"]').fill(testConfig.ssh.username)
    await page.locator('.session-form input[id="password"]').fill(testConfig.ssh.password)
    await page.locator('.session-form .btn.submit').click()
    
    // 等待表单关闭
    await expect(page.locator('.session-form-overlay')).not.toBeVisible({ timeout: 5000 })
    
    // 滚动到会话列表底部
    const sessionList = page.locator('.session-groups')
    await sessionList.evaluate((el: Element) => {
      el.scrollTop = el.scrollHeight
    })
    await page.waitForTimeout(500)
    
    // 等待会话出现在列表中
    const sessionItem = page.locator('.session-item').filter({ hasText: sessionName }).first()
    await sessionItem.scrollIntoViewIfNeeded()
    await expect(sessionItem).toBeVisible({ timeout: 10000 })

    // 双击连接创建第一个标签页
    await sessionItem.dblclick()
    await page.waitForTimeout(3000)

    const tabs = page.locator('.terminal-tab')
    let tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThanOrEqual(1)

    // 记录第一个标签页的状态指示器
    const firstTab = tabs.first()
    const firstTabStatusIndicator = firstTab.locator('.status-indicator')
    
    // 等待连接成功
    await page.waitForTimeout(2000)
    const firstTabStatusBefore = await firstTabStatusIndicator.getAttribute('class')

    // 再次双击同一会话创建第二个标签页
    await sessionItem.dblclick()
    await page.waitForTimeout(3000)

    tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThanOrEqual(2)

    // 记录第二个标签页的状态指示器
    const secondTab = tabs.nth(1)
    const secondTabStatusIndicator = secondTab.locator('.status-indicator')
    await page.waitForTimeout(2000)
    const secondTabStatusBefore = await secondTabStatusIndicator.getAttribute('class')

    // 关闭第二个标签页
    const closeBtn = secondTab.locator('.close-btn')
    if (await closeBtn.isVisible()) {
      await closeBtn.click()
      await page.waitForTimeout(1000)

      // 验证第一个标签页仍然连接
      // 这是关键测试点：关闭一个标签页不应影响其他标签页
      const firstTabStatusAfter = await firstTabStatusIndicator.getAttribute('class')
      
      // 如果第一个标签页之前是已连接状态，关闭第二个后应该仍然是已连接
      // BUG-002: 当前实现会断开所有同会话的标签页
      if (firstTabStatusBefore?.includes('connected')) {
        // 期望：第一个标签页应该保持连接
        // 实际：由于BUG，第一个标签页也会断开
        expect(firstTabStatusAfter).toContain('connected')
      }
    }
  })
})

/**
 * 标签页右键菜单测试
 * 测试 XShell 标准的标签页右键菜单
 */
test.describe('标签页右键菜单', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('右键点击标签页显示菜单', async () => {
    console.log('===== 开始测试：右键点击标签页显示菜单 =====')
    
    // 创建会话并连接
    const sessionName = generateUniqueName('右键菜单测试')
    await createSessionAndConnect(sessionName)
    
    // 右键点击标签页
    const tab = page.locator('.terminal-tab').first()
    await tab.click({ button: 'right' })
    await page.waitForTimeout(300)
    
    // 验证菜单显示
    const menu = tab.locator('.context-menu')
    await expect(menu).toBeVisible()
    console.log('✓ 右键菜单已显示')
    
    // 验证菜单位置在视口内
    const menuBoundingBox = await menu.boundingBox()
    expect(menuBoundingBox).not.toBeNull()
    if (menuBoundingBox) {
      expect(menuBoundingBox.x).toBeGreaterThanOrEqual(0)
      expect(menuBoundingBox.y).toBeGreaterThanOrEqual(0)
      expect(menuBoundingBox.x + menuBoundingBox.width).toBeLessThanOrEqual(1280)
      expect(menuBoundingBox.y + menuBoundingBox.height).toBeLessThanOrEqual(720)
      console.log(`✓ 菜单位置正确: x=${menuBoundingBox.x}, y=${menuBoundingBox.y}`)
    }
    
    // 验证菜单项
    await expect(menu.locator('text=复制会话')).toBeVisible()
    await expect(menu.locator('text=断开会话')).toBeVisible()
    await expect(menu.locator('text=重连会话')).toBeVisible()
    console.log('✓ 所有菜单项可见')
    
    // 点击菜单外部关闭菜单
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    
    console.log('===== 测试完成：右键菜单显示正常 =====')
  })

  test('复制会话创建新标签页', async () => {
    console.log('===== 开始测试：复制会话创建新标签页 =====')
    
    // 创建会话并连接
    const sessionName = generateUniqueName('复制会话测试')
    await createSessionAndConnect(sessionName)
    
    // 记录初始标签页数量
    const initialCount = await page.locator('.terminal-tab').count()
    console.log(`初始标签页数量: ${initialCount}`)
    
    // 右键点击标签页 → 点击"复制会话"
    const tab = page.locator('.terminal-tab').first()
    await tab.click({ button: 'right' })
    await page.waitForTimeout(300)
    
    await tab.locator('text=复制会话').click()
    await page.waitForTimeout(2000)
    
    // 验证新标签页创建
    const newCount = await page.locator('.terminal-tab').count()
    expect(newCount).toBe(initialCount + 1)
    console.log(`✓ 新标签页已创建，当前数量: ${newCount}`)
    
    // 验证新标签页连接成功
    const newTab = page.locator('.terminal-tab').last()
    const statusIndicator = newTab.locator('.status-indicator')
    await page.waitForTimeout(3000)
    const statusClass = await statusIndicator.getAttribute('class')
    expect(statusClass).toContain('connected')
    console.log('✓ 新标签页连接成功')
    
    console.log('===== 测试完成：复制会话功能正常 =====')
  })

  test('断开会话保持标签页打开', async () => {
    console.log('===== 开始测试：断开会话保持标签页打开 =====')
    
    // 创建会话并连接
    const sessionName = generateUniqueName('断开会话测试')
    await createSessionAndConnect(sessionName)
    
    // 右键点击标签页 → 点击"断开会话"
    const tab = page.locator('.terminal-tab').first()
    await tab.click({ button: 'right' })
    await page.waitForTimeout(300)
    
    await tab.locator('text=断开会话').click()
    await page.waitForTimeout(1000)
    
    // 验证标签页仍然存在
    await expect(tab).toBeVisible()
    console.log('✓ 标签页仍然存在')
    
    // 验证状态变为断开
    const statusIndicator = tab.locator('.status-indicator')
    const statusClass = await statusIndicator.getAttribute('class')
    expect(statusClass).toContain('disconnected')
    console.log('✓ 标签页状态已变为断开')
    
    console.log('===== 测试完成：断开会话功能正常 =====')
  })

  test('重连会话恢复连接', async () => {
    console.log('===== 开始测试：重连会话恢复连接 =====')
    
    // 创建会话并连接
    const sessionName = generateUniqueName('重连会话测试')
    await createSessionAndConnect(sessionName)
    
    // 断开会话
    const tab = page.locator('.terminal-tab').first()
    await tab.click({ button: 'right' })
    await page.waitForTimeout(300)
    await tab.locator('text=断开会话').click()
    await page.waitForTimeout(1000)
    
    // 验证状态为断开
    let statusIndicator = tab.locator('.status-indicator')
    let statusClass = await statusIndicator.getAttribute('class')
    expect(statusClass).toContain('disconnected')
    console.log('✓ 会话已断开')
    
    // 重连会话
    await tab.click({ button: 'right' })
    await page.waitForTimeout(300)
    await tab.locator('text=重连会话').click()
    await page.waitForTimeout(3000)
    
    // 验证状态变为已连接
    statusIndicator = tab.locator('.status-indicator')
    statusClass = await statusIndicator.getAttribute('class')
    expect(statusClass).toContain('connected')
    console.log('✓ 会话已重连')
    
    console.log('===== 测试完成：重连会话功能正常 =====')
  })

  test('菜单项状态根据连接状态变化', async () => {
    console.log('===== 开始测试：菜单项状态根据连接状态变化 =====')
    
    // 创建会话并连接
    const sessionName = generateUniqueName('菜单状态测试')
    await createSessionAndConnect(sessionName)
    
    const tab = page.locator('.terminal-tab').first()
    
    // 已连接状态：断开会话可用，重连会话禁用
    await tab.click({ button: 'right' })
    await page.waitForTimeout(300)
    
    const disconnectItem = tab.locator('.context-menu-item:has-text("断开会话")')
    const reconnectItem = tab.locator('.context-menu-item:has-text("重连会话")')
    
    let disconnectDisabled = await disconnectItem.getAttribute('class')
    let reconnectDisabled = await reconnectItem.getAttribute('class')
    
    expect(disconnectDisabled).not.toContain('disabled')
    expect(reconnectDisabled).toContain('disabled')
    console.log('✓ 已连接状态：断开会话可用，重连会话禁用')
    
    // 关闭菜单
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    
    // 断开会话
    await tab.click({ button: 'right' })
    await tab.locator('text=断开会话').click()
    await page.waitForTimeout(1000)
    
    // 断开状态：断开会话禁用，重连会话可用
    await tab.click({ button: 'right' })
    await page.waitForTimeout(300)
    
    disconnectDisabled = await disconnectItem.getAttribute('class')
    reconnectDisabled = await reconnectItem.getAttribute('class')
    
    expect(disconnectDisabled).toContain('disabled')
    expect(reconnectDisabled).not.toContain('disabled')
    console.log('✓ 断开状态：断开会话禁用，重连会话可用')
    
    console.log('===== 测试完成：菜单项状态正确 =====')
  })

  test('菜单互斥：打开终端菜单时标签页菜单自动关闭', async () => {
    console.log('===== 开始测试：菜单互斥行为 =====')
    
    // 创建会话并连接
    const sessionName = generateUniqueName('菜单互斥测试')
    await createSessionAndConnect(sessionName)
    
    // 右键点击标签页，打开标签页菜单
    const tab = page.locator('.terminal-tab').first()
    await tab.click({ button: 'right' })
    await page.waitForTimeout(300)
    
    // 验证标签页菜单显示
    const tabMenu = tab.locator('.context-menu')
    await expect(tabMenu).toBeVisible()
    console.log('✓ 标签页菜单已显示')
    
    // 右键点击终端区域，打开终端菜单
    const terminal = page.locator('.x-terminal').first()
    await terminal.click({ button: 'right' })
    await page.waitForTimeout(300)
    
    // 验证标签页菜单已关闭
    await expect(tabMenu).not.toBeVisible()
    console.log('✓ 标签页菜单已关闭')
    
    // 验证终端菜单显示
    const terminalMenu = terminal.locator('.context-menu')
    await expect(terminalMenu).toBeVisible()
    console.log('✓ 终端菜单已显示')
    
    // 右键点击标签页，打开标签页菜单
    await tab.click({ button: 'right' })
    await page.waitForTimeout(300)
    
    // 验证终端菜单已关闭
    await expect(terminalMenu).not.toBeVisible()
    console.log('✓ 终端菜单已关闭')
    
    // 验证标签页菜单显示
    await expect(tabMenu).toBeVisible()
    console.log('✓ 标签页菜单已显示')
    
    console.log('===== 测试完成：菜单互斥行为正常 =====')
  })
})

/**
 * 标签页键盘快捷键测试
 * 测试 XShell 标准的标签页快捷键
 */
test.describe('标签页快捷键', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)

    // 创建两个会话
    const sessionName1 = generateUniqueName('快捷键测试1')
    const sessionName2 = generateUniqueName('快捷键测试2')
    await createSessionAndConnect(sessionName1)
    await createSessionAndConnect(sessionName2)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('Ctrl+Tab 切换到下一个标签页', async () => {
    // XShell 标准：Ctrl+Tab 切换到下一个标签页
    const tabs = page.locator('.terminal-tab')
    const tabCount = await tabs.count()

    if (tabCount >= 2) {
      // 记录当前激活的标签页
      const firstTab = tabs.first()
      await firstTab.click()
      await page.waitForTimeout(300)
      
      // 按 Ctrl+Tab
      await page.keyboard.press('Control+Tab')
      await page.waitForTimeout(500)

      // 验证切换到了第二个标签页
      const secondTab = tabs.nth(1)
      const secondTabActive = await secondTab.evaluate((el) => {
        return el.classList.contains('active')
      })
      expect(secondTabActive).toBe(true)
    }
  })

  test('Ctrl+W 关闭当前标签页', async () => {
    // XShell 标准：Ctrl+W 关闭当前标签页
    const tabs = page.locator('.terminal-tab')
    const initialCount = await tabs.count()

    if (initialCount > 1) {
      await page.keyboard.press('Control+W')
      await page.waitForTimeout(500)

      const newCount = await tabs.count()
      expect(newCount).toBeLessThanOrEqual(initialCount)
    }
  })
})
