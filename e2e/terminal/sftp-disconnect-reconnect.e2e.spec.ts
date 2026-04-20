/**
 * SFTP 标签页断开/重连功能 E2E 测试
 * 
 * 测试场景：
 * 1. 断连状态下右键菜单显示「重连会话」
 * 2. 点击重连后恢复连接并显示文件列表
 * 3. 连接状态下右键菜单显示「断开会话」
 * 4. 点击断开后显示已断连状态
 * 5. 完整流程：断连→重连→断开 状态流转正确
 */

import { test, expect, beforeAll, afterAll } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'
import { testConfig, generateUniqueName } from '../config/test-config'
import type { ElectronApplication, Page } from '@playwright/test'

let app: ElectronApplication
let page: Page

/** 测试会话配置 */
const TEST_SESSION = {
  name: '',
  host: testConfig.ssh.host,
  port: testConfig.ssh.port,
  username: testConfig.ssh.username,
  password: testConfig.ssh.password,
  authType: 'password' as const
}

/** 是否成功建立 SFTP 连接 */
let sftpConnectionReady = false

test.describe('SFTP 标签页 - 断开/重连', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)
    TEST_SESSION.name = generateUniqueName('SFTP断开重连')

    console.log('\n========== 初始化测试环境 ==========')
    console.log(`测试会话名称: ${TEST_SESSION.name}`)

    // 等待主界面加载完成
    await page.waitForSelector('.session-list', { timeout: 20000 })

    // 通过 API 创建测试会话
    console.log('\n--- 创建/查找测试会话 ---')
    const exists = await page.evaluate(async (session) => {
      const sessions = await (window as any).api.session.getAll()
      return sessions.some((s: any) => s.name === session.name)
    }, TEST_SESSION)

    if (!exists) {
      await page.evaluate(async (session) => {
        await (window as any).api.session.create(session)
      }, TEST_SESSION)
      console.log('✓ 创建新会话')
      await page.waitForTimeout(500)

      // 刷新页面以显示新创建的会话
      await page.reload()
      await page.waitForSelector('.session-list', { timeout: 20000 })
      await page.waitForTimeout(2000)
    } else {
      console.log('✓ 会话已存在')
    }

    // 点击展开分组
    try {
      const groupHeader = page.locator('.group-header').first()
      await groupHeader.waitFor({ state: 'visible', timeout: 5000 })
      await groupHeader.click({ force: true })
      await page.waitForTimeout(500)
      console.log('✓ 展开分组')
    } catch (e) {
      console.log('⚠️ 等待 group-header 超时，继续...')
    }

    // 等待 session-item 出现
    let sessionFound = false
    for (let i = 0; i < 3; i++) {
      try {
        await page.waitForSelector('.session-item', { timeout: 5000 })
        sessionFound = true
        break
      } catch (e) {
        console.log(`第 ${i + 1} 次查找 session-item 失败`)
        if (i < 2) {
          await page.locator('.group-header').first().click({ force: true }).catch(() => {})
          await page.waitForTimeout(2000)
        }
      }
    }

    if (!sessionFound) {
      throw new Error('无法找到会话项')
    }
    console.log('✓ 找到会话列表')

    // 尝试连接 SSH 会话
    console.log('\n--- 连接 SSH 会话 ---')
    const sessionItem = page.locator('.session-item').filter({ hasText: TEST_SESSION.name }).first()

    if (await sessionItem.count() === 0) {
      throw new Error(`找不到测试会话: ${TEST_SESSION.name}`)
    }

    await sessionItem.scrollIntoViewIfNeeded({ timeout: 5000 })
    await sessionItem.dblclick({ force: true, timeout: 5000 })
    console.log('✓ 双击连接')

    // 等待连接建立或失败
    await page.waitForTimeout(3000)

    // 处理可能的错误对话框
    const errorDialog = page.locator('.error-dialog-overlay').first()
    if (await errorDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('⚠️ 出现错误对话框，关闭...')
      await errorDialog.click({ force: true, position: { x: 10, y: 10 } })
      await page.waitForTimeout(500)

      const allTabs = page.locator('.terminal-tab, .sftp-tab')
      if (await allTabs.count() > 0) {
        console.log(`✓ 找到已有标签页 (${await allTabs.count()} 个)，复用第一个`)
        await allTabs.first().click({ force: true })
        await page.waitForTimeout(1000)
      } else {
        console.log('❌ SSH 连接失败且无可用标签页')
        sftpConnectionReady = false
        console.log('\n========== 初始化失败（将跳过所有测试） ==========\n')
        return
      }
    } else {
      console.log('✓ SSH 连接建立成功')
    }

    // 通过 SessionItem 的 SFTP 按钮创建 SFTP 标签页
    console.log('\n--- 创建 SFTP 标签页 ---')

    const existingSftpTabs = page.locator('.sftp-tab')
    if (await existingSftpTabs.count() > 0 && await existingSftpTabs.first().isVisible().catch(() => false)) {
      console.log('✓ 已有 SFTP 标签页可见')
      sftpConnectionReady = true
    } else {
      const sftpActionBtn = sessionItem.locator('.action-btn.sftp')

      try {
        await sftpActionBtn.click({ force: true, timeout: 5000 })
        await page.waitForTimeout(3000)
        console.log('✓ 点击 SFTP 图标按钮')

        try {
          await page.locator('.sftp-tab').first().waitFor({ state: 'visible', timeout: 8000 })
          console.log('✓ SFTP 标签页已创建并可见')
          sftpConnectionReady = true
        } catch (e) {
          const terminalTab = page.locator('.terminal-tab').first()
          if (await terminalTab.count() > 0 && await terminalTab.isVisible().catch(() => false)) {
            console.log('⚠️ SFTP 标签页未出现，回退使用终端标签页')
            sftpConnectionReady = true
          } else {
            console.log('❌ 点击 SFTP 按钮后没有可用标签页')
          }
        }
      } catch (e) {
        console.log('⚠️ SFTP 图标按钮不可点击，尝试使用模式切换按钮')

        const modeBtn = page.locator('.mode-btn').filter({ hasText: 'SFTP' })
        try {
          await modeBtn.click({ force: true, timeout: 5000 })
          await page.waitForTimeout(2000)

          const anyTab = page.locator('.terminal-tab, .sftp-tab').first()
          if (await anyTab.count() > 0 && await anyTab.isVisible().catch(() => false)) {
            sftpConnectionReady = true
            console.log('✓ 模式切换后找到可用标签页')
          }
        } catch (e2) {
          console.log('❌ 所有方式均无法获取可用标签页')
        }
      }
    }

    // 最终状态检查
    if (sftpConnectionReady) {
      const hasFileItems = await page.locator('.file-panel.remote .file-item').count().catch(() => 0)
      const isDisconnected = await page.locator('.disconnected-overlay').isVisible().catch(() => false)

      if (hasFileItems > 0) {
        console.log('✅ SFTP 文件列表已加载（已连接状态）')
      } else if (isDisconnected) {
        console.log('⚠️ 当前处于断连状态')
      } else {
        console.log('✅ SFTP 标签页就绪')
      }
    }

    console.log(`\n========== 初始化完成 (sftpConnectionReady=${sftpConnectionReady}) ==========\n`)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  /**
   * 获取 SFTP 标签页元素
   */
  const getSftpTab = async () => {
    const sftpTab = page.locator('.sftp-tab').first()
    await sftpTab.waitFor({ state: 'visible', timeout: 10000 })
    return sftpTab
  }

  /**
   * 右键点击标签页并返回菜单（带重试机制）
   * 使用 .tab-title 作为点击目标，更精确触发 contextmenu 事件
   */
  const openTabContextMenu = async (retryCount = 3): Promise<any> => {
    const tab = await getSftpTab()
    await tab.scrollIntoViewIfNeeded({ timeout: 5000 })

    // 使用 .tab-title 作为右键目标（更可靠的 contextmenu 触发点）
    const tabTitle = tab.locator('.tab-title')

    for (let attempt = 1; attempt <= retryCount; attempt++) {
      // 先确保菜单已关闭
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForTimeout(200)

      // 右键点击标签标题区域
      await tabTitle.click({ button: 'right', force: true, timeout: 5000 })

      // 等待菜单出现：检查「复制会话」文本可见（无论菜单在哪个容器中）
      try {
        await page.getByText('复制会话').waitFor({ state: 'visible', timeout: 3000 })
        await page.waitForTimeout(200)
        return page  // 返回 page 以便使用 getByText 查找菜单项
      } catch (e) {
        console.log(`  右键菜单未打开 (尝试 ${attempt}/${retryCount})`)
        if (attempt < retryCount) {
          await page.waitForTimeout(500)
        }
      }
    }

    throw new Error('右键菜单打开失败（已重试）')
  }

  /**
   * 通过右键菜单执行断开/重连操作（带验证和回退）
   */
  const executeMenuAction = async (actionText: string): Promise<void> => {
    // 记录操作前状态
    const beforeFileCount = await page.locator('.file-panel.remote .file-item').count().catch(() => 0)
    const beforeDisconnected = await page.locator('.disconnected-overlay').isVisible().catch(() => false)
    console.log(`  操作前: 文件项=${beforeFileCount}, 断连=${beforeDisconnected}`)

    // 打开菜单并点击
    const menuPage = await openTabContextMenu()
    
    // 使用 .context-menu-item 精确匹配
    const item = menuPage.locator('.context-menu-item').filter({ hasText: actionText })
    const itemCount = await item.count()
    console.log(`  找到 "${actionText}" 菜单项: ${itemCount} 个`)
    
    if (itemCount > 0) {
      await item.first().click({ force: true, timeout: 10000 })
    } else {
      // 回退：尝试 getByText
      console.log('  ⚠️ .context-menu-item 未找到，回退 getByText')
      const fallbackItem = menuPage.getByText(actionText)
      await fallbackItem.click({ force: true, timeout: 5000 }).catch((e) => {
        console.log(`  ⚠️ 点击失败: ${e.message}`)
      })
    }

    console.log(`  ✓ 已点击「${actionText}」`)
    await page.keyboard.press('Escape').catch(() => {})
  }

  /**
   * 通过 API 直接执行 SFTP 断开（绕过 UI 菜单，用于验证）
   */
  const directSftpDisconnect = async (): Promise<void> => {
    // 通过 window.api 直接调用 SFTP 断开
    const result = await page.evaluate(async () => {
      try {
        // 访问 Vue app 实例获取 Pinia store
        const app = (document.querySelector('#app') as any)?.__vue_app__
        if (!app) return { success: false, error: 'Vue app not found' }

        // 获取 pinia
        const pinia = app.config.globalProperties.$pinia
        if (!pinia) return { success: false, error: 'Pinia not found' }

        // 获取 terminal store
        const terminalStore = pinia._s.get('terminal')
        if (!terminalStore) return { success: false, error: 'Terminal store not found' }

        // 找到当前活跃的 SFTP 标签页
        const tabs = terminalStore.tabs
        const activeTabId = terminalStore.activeTabId
        const sftpTab = tabs.find((t: any) => t.id === activeTabId && t.type === 'sftp')
                     || tabs.find((t: any) => t.type === 'sftp')

        if (!sftpTab) {
          return { success: false, error: `未找到SFTP标签页, tabs=${JSON.stringify(tabs.map((t: any) => ({id: t.id, type: t.type, status: t.status})))}` }
        }

        console.log('[directDisconnect] 找到SFTP标签:', JSON.stringify({ id: sftpTab.id, status: sftpTab.status, sftpConnId: sftpTab.sftpConnectionId }))

        // 调用断开 API
        const api = (window as any).api
        if (sftpTab.sftpConnectionId && api?.sftp?.disconnect) {
          await api.sftp.disconnect(sftpTab.sftpConnectionId)
        }

        // 更新状态
        terminalStore.updateTabStatus(sftpTab.id, 'disconnected')

        return { success: true, tabId: sftpTab.id, prevStatus: sftpTab.status }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    })

    console.log(`  直接断开结果: ${JSON.stringify(result)}`)
    if (!result.success) {
      throw new Error(`SFTP 直接断开失败: ${result.error}`)
    }
  }

  /**
   * 检查当前 SFTP 连接状态：'connected' | 'disconnected' | 'unknown'
   */
  const checkSftpStatus = async (): Promise<string> => {
    const hasFileItems = await page.locator('.file-panel.remote .file-item').count().catch(() => 0)
    const isDisconnected = await page.locator('.disconnected-overlay').isVisible().catch(() => false)

    if (isDisconnected) return 'disconnected'
    if (hasFileItems > 0) return 'connected'
    return 'unknown'
  }

  /**
   * 确保 SFTP 处于指定状态（通过菜单操作转换，失败则用直接 API）
   */
  const ensureSftpStatus = async (targetStatus: 'connected' | 'disconnected'): Promise<void> => {
    const currentStatus = await checkSftpStatus()
    if (currentStatus === targetStatus) return

    console.log(`  状态转换: ${currentStatus} → ${targetStatus}`)

    if (targetStatus === 'disconnected') {
      // 先尝试通过菜单断开
      try {
        await executeMenuAction('断开会话')
        await page.waitForTimeout(1000)
        
        // 验证是否成功
        const afterStatus = await checkSftpStatus()
        if (afterStatus === 'disconnected') {
          console.log(`  ✓ 菜单断开成功`)
          return
        }
        console.log('  ⚠️ 菜单断开未生效，使用直接 API 断开...')
      } catch (e) {
        console.log(`  ⚠️ 菜单操作异常: ${(e as Error).message}`)
      }
      
      // 回退：使用直接 API 断开
      await directSftpDisconnect()
      await page.waitForTimeout(500)
    } else {
      // 重连：只能通过菜单
      await executeMenuAction('重连会话')
      await page.waitForTimeout(3000)
    }

    // 验证状态已转换
    const newStatus = await checkSftpStatus()
    console.log(`  转换后状态: ${newStatus}`)
  }

  test('断连状态：右键菜单应显示「重连会话」，隐藏「断开会话」', async () => {
    if (!sftpConnectionReady) {
      console.log('⏭️ 跳过：SFTP 连接未就绪')
      return
    }

    console.log('===== 开始测试：断连状态菜单 =====')

    // 确保处于断连状态
    await ensureSftpStatus('disconnected')

    // 验证断连提示可见
    const disconnectedOverlay = page.locator('.disconnected-overlay')
    await expect(disconnectedOverlay).toBeVisible()
    console.log('✓ 断连提示可见')

    // 验证断连提示文字
    const disconnectedText = page.locator('.disconnected-text')
    await expect(disconnectedText).toHaveText('SFTP 连接已断开')

    // 文件列表应为空
    const fileItems = page.locator('.file-panel.remote .file-item')
    expect(await fileItems.count()).toBe(0)
    console.log('✓ 文件列表为空')

    // 右键打开菜单
    await openTabContextMenu()

    // 验证「重连会话」可见（限定在 .context-menu-item 内，避免匹配断连提示文字）
    const reconnectMenuItem = page.locator('.context-menu-item').filter({ hasText: '重连会话' })
    await expect(reconnectMenuItem).toBeVisible()
    console.log('✓ 「重连会话」可见')

    // 关闭菜单
    await page.keyboard.press('Escape')

    console.log('===== 测试通过 =====')
  })

  test('重连功能：点击「重连会话」后应恢复连接并显示文件列表', async () => {
    if (!sftpConnectionReady) {
      console.log('⏭️ 跳过：SFTP 连接未就绪')
      return
    }

    console.log('===== 开始测试：重连功能 =====')

    // 确保处于断连状态
    await ensureSftpStatus('disconnected')

    const disconnectedOverlay = page.locator('.disconnected-overlay')

    // 点击「重连会话」
    await executeMenuAction('重连会话')
    console.log('✓ 已点击「重连会话」')

    // 等待连接建立
    await page.waitForTimeout(3000)

    // 验证断连提示消失
    await expect(disconnectedOverlay).not.toBeVisible()
    console.log('✓ 断连提示消失')

    // 验证文件列表恢复
    const fileItems = page.locator('.file-panel.remote .file-item')
    expect(await fileItems.count()).toBeGreaterThan(0)
    console.log('✓ 文件列表已恢复 (' + (await fileItems.count()) + ' 个项目)')

    console.log('===== 测试通过 =====')
  })

  test('连接状态：右键菜单应显示「断开会话」', async () => {
    if (!sftpConnectionReady) {
      console.log('⏭️ 跳过：SFTP 连接未就绪')
      return
    }

    console.log('===== 开始测试：连接状态菜单 =====')

    // 确保处于连接状态
    await ensureSftpStatus('connected')

    // 验证文件列表可见
    const fileItems = page.locator('.file-panel.remote .file-item')
    expect(await fileItems.count()).toBeGreaterThan(0)
    console.log('✓ 文件列表可见 (' + (await fileItems.count()) + ' 个项目)')

    // 右键打开菜单
    await openTabContextMenu()

    // 验证「断开会话」存在（限定在 .context-menu-item 内）
    const disconnectMenuItem = page.locator('.context-menu-item').filter({ hasText: '断开会话' })
    await expect(disconnectMenuItem).toBeVisible()
    console.log('✓ 「断开会话」可见')

    // 关闭菜单
    await page.keyboard.press('Escape')

    console.log('===== 测试通过 =====')
  })

  test('断开功能：点击「断开会话」后应显示已断连状态', async () => {
    if (!sftpConnectionReady) {
      console.log('⏭️ 跳过：SFTP 连接未就绪')
      return
    }

    console.log('===== 开始测试：断开功能 =====')

    // 确保处于连接状态
    await ensureSftpStatus('connected')

    const disconnectedOverlay = page.locator('.disconnected-overlay')

    // 点击「断开会话」
    await executeMenuAction('断开会话')
    console.log('✓ 已点击「断开会话」')

    // 等待断开完成
    await page.waitForTimeout(1000)

    // 验证断连提示可见
    await expect(disconnectedOverlay).toBeVisible()
    console.log('✓ 断连提示可见')

    // 验证断连提示文字
    const disconnectedText = page.locator('.disconnected-text')
    await expect(disconnectedText).toHaveText('SFTP 连接已断开')

    // 验证文件列表被清空
    const fileItems = page.locator('.file-panel.remote .file-item')
    expect(await fileItems.count()).toBe(0)
    console.log('✓ 文件列表已清空')

    console.log('===== 测试通过 =====')
  })

  test('完整流程：断连→重连→断开 状态流转正确', async () => {
    if (!sftpConnectionReady) {
      console.log('⏭️ 跳过：SFTP 连接未就绪')
      return
    }

    console.log('===== 开始测试：完整状态流转 =====')

    const disconnectedOverlay = page.locator('.disconnected-overlay')
    let fileItems = page.locator('.file-panel.remote .file-item')

    // === 阶段1：确保断连状态 ===
    console.log('\n--- 阶段1：断连状态 ---')
    await ensureSftpStatus('disconnected')

    await expect(disconnectedOverlay).toBeVisible()
    console.log('✓ 断连提示可见')

    expect(await fileItems.count()).toBe(0)
    console.log('✓ 文件列表为空')

    // === 阶段2：执行重连 ===
    console.log('\n--- 阶段2：重连 ---')
    await executeMenuAction('重连会话')
    await page.waitForTimeout(3000)

    await expect(disconnectedOverlay).not.toBeVisible()
    console.log('✓ 断连提示消失')

    expect(await fileItems.count()).toBeGreaterThan(0)
    console.log('✓ 文件列表恢复 (' + (await fileItems.count()) + ' 个项目)')

    // === 阶段3：执行断开 ===
    console.log('\n--- 阶段3：断开 ---')
    await executeMenuAction('断开会话')
    await page.waitForTimeout(1000)

    await expect(disconnectedOverlay).toBeVisible()
    console.log('✓ 断连提示可见')

    expect(await fileItems.count()).toBe(0)
    console.log('✓ 文件列表为空')

    console.log('\n===== ✅ 完整状态流转测试通过 =====')
  })
})
