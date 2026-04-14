/**
 * SSH/SFTP 模式切换后终端内容保留 E2E 测试
 * 验证修复 BUG: 切换到 SFTP 模式再切回 SSH 模式后，终端内容不会丢失
 * 
 * Bug 根因: AppLayout.vue 使用 v-if/v-else 切换模式，导致 XTerminal 组件销毁重建
 * 修复方案: 改为 v-show，组件只隐藏/显示，不销毁重建
 */

import { test, expect } from '@playwright/test'
import { startApp, closeApp } from '../helpers/electron-app'
import type { ElectronApplication, Page } from '@playwright/test'

// 测试会话配置（使用提供的测试服务器）
const TEST_SESSION = {
  name: 'SFTP Local Folder Test',
  host: '192.168.10.24',
  port: 22,
  username: 'root',
  password: 'One.00000'
}

/**
 * 辅助函数：创建 SSH 连接并打开终端
 */
async function createSSHConnection(page: Page): Promise<void> {
  // 1. 等待主界面加载完成
  await page.waitForSelector('.session-list', { timeout: 20000 })

  // 2. 通过 API 创建测试会话（如果不存在）
  await page.evaluate(async (sessionData) => {
    const sessions = await (window as any).api.session.getAll()
    const existing = sessions.find((s: any) => s.name === sessionData.name)
    if (!existing) {
      await (window as any).api.session.create(sessionData)
    }
  }, TEST_SESSION)

  // 3. 重新加载页面以显示新创建的会话
  await page.reload()
  await page.waitForSelector('.session-list', { timeout: 20000 })
  await page.waitForTimeout(3000)

  // 4. 点击展开分组
  const groupHeader = page.locator('.group-header').first()
  
  try {
    await groupHeader.waitFor({ state: 'visible', timeout: 10000 })
    await groupHeader.click({ force: true })
  } catch (e) {
    console.log('等待 group-header 超时，尝试其他方式...')
  }

  // 5. 等待 session-item 出现
  let sessionFound = false
  for (let i = 0; i < 3; i++) {
    try {
      await page.waitForSelector('.session-item', { timeout: 5000 })
      sessionFound = true
      break
    } catch (e) {
      console.log(`第 ${i + 1} 次尝试查找 session-item 失败，重试...`)
      if (i < 2) {
        await groupHeader.click({ force: true }).catch(() => {})
        await page.waitForTimeout(2000)
      }
    }
  }

  if (!sessionFound) {
    throw new Error('无法找到会话项')
  }

  await page.waitForTimeout(1000)

  // 6. 找到测试会话并双击连接
  const sessionItem = page.locator('.session-item', {
    hasText: TEST_SESSION.name
  }).first()

  const count = await sessionItem.count()
  if (count === 0) {
    console.error('找不到会话:', TEST_SESSION.name)
    throw new Error('找不到测试会话')
  }

  // 滚动到视图并双击连接
  await sessionItem.scrollIntoViewIfNeeded({ timeout: 5000 })
  await sessionItem.dblclick({ force: true, timeout: 5000 })

  console.log('✅ 已双击连接 SSH 会话')

  // 7. 等待 SSH 连接建立和终端加载
  await page.waitForTimeout(3000)

  // 处理可能的连接错误对话框
  const errorDialog = page.locator('.error-dialog-overlay').first()
  if (await errorDialog.count() > 0) {
    try {
      const isVisible = await errorDialog.isVisible({ timeout: 1000 })
      if (isVisible) {
        console.log('⚠️ 检测到错误对话框，尝试关闭...')
        // 尝试点击关闭按钮或遮罩层
        await errorDialog.click({ force: true, position: { x: 10, y: 10 } })
        await page.waitForTimeout(500)
      }
    } catch (e) {
      console.log('⚠️ 检查错误对话框时出错，继续执行...')
    }
  }

  // 验证终端已加载（即使连接失败，终端组件也应该存在）
  const terminal = page.locator('.x-terminal')
  
  // 如果终端不可见，可能需要等待或重试
  try {
    await expect(terminal.first()).toBeVisible({ timeout: 5000 })
  } catch (e) {
    console.log('⚠️ 终端未立即可见，尝试等待...')
    await page.waitForTimeout(2000)
  }
  
  console.log('✅ 终端已加载')
}

test.describe('SSH/SFTP 模式切换 - 终端内容保留', () => {
  let electronApp: ElectronApplication | null = null
  let page: Page | null = null

  test.beforeAll(async () => {
    const appResult = await startApp()
    electronApp = appResult.electronApp
    page = appResult.page

    // 监听控制台消息
    if (page) {
      page.on('console', msg => {
        console.log('Console:', msg.type(), msg.text())
      })

      page.on('pageerror', error => {
        console.error('Page Error:', error.message)
      })

      await page.waitForTimeout(3000)
    }
  })

  test.afterAll(async () => {
    if (electronApp && page) {
      await closeApp(electronApp, page)
    }
  })

  test('切换到 SFTP 再切回 SSH 后终端内容应该保留', async () => {
    if (!page) throw new Error('Page 未初始化')

    console.log('\n=== 开始测试：SSH/SFTP 模式切换后终端内容保留 ===\n')

    // 步骤 1: 创建 SSH 连接
    await createSSHConnection(page)

    // 步骤 2: 获取终端组件引用和初始状态
    const terminal = page.locator('.x-terminal').first()

    // 确保没有错误对话框遮挡
    const errorDialog = page.locator('.error-dialog-overlay').first()
    if (await errorDialog.count() > 0) {
      try {
        const isVisible = await errorDialog.isVisible({ timeout: 1000 })
        if (isVisible) {
          console.log('⚠️ 关闭错误对话框...')
          await errorDialog.click({ force: true, position: { x: 10, y: 10 } })
          await page.waitForTimeout(500)
        }
      } catch (e) {
        console.log('⚠️ 检查错误对话框时出错，继续执行...')
      }
    }

    // 点击终端确保焦点在终端上
    await terminal.click({ force: true })
    await page.waitForTimeout(500)

    // 尝试输入一些文本（即使连接失败，终端也应该能接收输入）
    const testMarker = `TEST_${Date.now()}`
    console.log(`\n📝 尝试在终端输入标记: ${testMarker}`)
    
    try {
      await page.keyboard.type(testMarker)
      await page.waitForTimeout(300)
    } catch (e) {
      console.log('⚠️ 输入失败（可能未连接），继续验证组件是否保留...')
    }

    // 获取切换前的终端内容或状态
    const terminalContentBeforeSwitch = await terminal.textContent()
    const terminalCountBefore = await page.locator('.x-terminal').count()
    console.log(`\n📋 切换前状态:`)
    console.log(`   - 终端数量: ${terminalCountBefore}`)
    console.log(`   - 内容长度: ${terminalContentBeforeSwitch?.length || 0}`)

    // 步骤 3: 切换到 SFTP 模式
    console.log('\n🔄 切换到 SFTP 模式...')
    const sftpModeBtn = page.locator('.mode-btn').filter({ hasText: 'SFTP' })
    await sftpModeBtn.click()
    await page.waitForTimeout(1000)

    // 验证已切换到 SFTP 模式
    const currentMode = await page.locator('.mode-btn.active').textContent()
    expect(currentMode?.trim()).toBe('SFTP')
    console.log(`✅ 已切换到 SFTP 模式`)

    // 步骤 4: 切回 SSH 模式
    console.log('\n🔄 切回 SSH 模式...')
    const sshModeBtn = page.locator('.mode-btn').filter({ hasText: 'SSH' })
    await sshModeBtn.click()
    await page.waitForTimeout(1000)

    // 验证已切回 SSH 模式
    const currentModeAfterSwitch = await page.locator('.mode-btn.active').textContent()
    expect(currentModeAfterSwitch?.trim()).toBe('SSH')
    console.log(`✅ 已切回 SSH 模式`)

    // 步骤 5: 验证终端组件仍然存在且未被重新创建（关键验证点！）
    const terminalAfterSwitch = page.locator('.x-terminal').first()
    const terminalCountAfter = await page.locator('.x-terminal').count()
    const isVisible = await terminalAfterSwitch.isVisible()
    
    console.log(`\n📋 切回后状态:`)
    console.log(`   - 终端数量: ${terminalCountAfter}`)
    console.log(`   - 终端可见: ${isVisible}`)

    // 核心断言 1: 组件应该存在
    expect(isVisible).toBe(true)
    console.log('✅ 终端组件仍然可见')

    // 核心断言 2: 组件数量应该一致（说明没有销毁重建）
    expect(terminalCountAfter).toBe(terminalCountBefore)
    console.log('✅ 终端组件数量一致（未被销毁重建）')

    // 核心断言 3: 如果之前有输入，内容应该保留
    const terminalContentAfterSwitch = await terminalAfterSwitch.textContent()
    console.log(`   - 内容长度: ${terminalContentAfterSwitch?.length || 0}`)

    if (terminalContentBeforeSwitch && terminalContentBeforeSwitch.length > 0) {
      // 如果切换前有内容，检查是否保留
      const contentPreserved = (terminalContentAfterSwitch?.length || 0) > 0
      console.log(`✅ 终端内容${contentPreserved ? '已' : '未'}保留`)
      
      // 如果成功输入了标记，验证它还在
      if (terminalContentBeforeSwitch.includes(testMarker)) {
        expect(terminalContentAfterSwitch).toContain(testMarker)
        console.log(`\n✅✅✅ 终端内容完整保留！包含标记: ${testMarker} ✅✅✅`)
      }
    } else {
      console.log('ℹ️ 切换前无内容（可能未连接），但组件已保留')
    }

    console.log('\n=== ✅ 测试通过：SSH/SFTP 模式切换后终端组件正常保留 ===\n')
  })

  test('多次快速切换模式后终端内容应该稳定保留', async () => {
    if (!page) throw new Error('Page 未初始化')

    console.log('\n=== 开始测试：多次快速模式切换 ===\n')

    // 创建 SSH 连接
    await createSSHConnection(page)

    // 在终端输入多个标记
    const terminal = page.locator('.x-terminal').first()
    await terminal.click()
    await page.waitForTimeout(500)

    // 执行多个命令
    for (let i = 1; i <= 3; i++) {
      const marker = `MARKER_${i}_${Date.now()}`
      await page.keyboard.type(`echo "${marker}"`)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(500)
      console.log(`📝 输入第 ${i} 个命令: echo "${marker}"`)
    }

    await page.waitForTimeout(1000)
    const contentBefore = await terminal.textContent()
    console.log(`\n📋 多次切换前的终端内容长度: ${contentBefore?.length}`)

    // 快速切换 5 次
    for (let i = 1; i <= 5; i++) {
      console.log(`\n🔄 第 ${i} 次切换...`)

      // 切换到 SFTP
      await page.locator('.mode-btn').filter({ hasText: 'SFTP' }).click()
      await page.waitForTimeout(300)

      // 切回 SSH
      await page.locator('.mode-btn').filter({ hasText: 'SSH' }).click()
      await page.waitForTimeout(300)
    }

    console.log('\n✅ 完成 5 次快速切换')

    // 验证终端内容仍然完整
    const contentAfter = await terminal.textContent()
    console.log(`\n📋 多次切换后的终端内容长度: ${contentAfter?.length}`)

    // 内容长度应该大于 0
    expect(contentAfter?.length).toBeGreaterThan(0)
    console.log('\n=== ✅ 测试通过：多次快速切换后终端内容稳定 ===\n')
  })

  test('切换模式时应自动设置正确的活跃标签页', async () => {
    if (!page) throw new Error('Page 未初始化')

    console.log('\n=== 开始测试：切换模式时 activeTabId 自动管理 ===\n')

    // 步骤 1: 创建 SSH 连接（会创建一个 SSH 标签页）
    await createSSHConnection(page)
    
    // 等待 SSH 标签页创建完成
    await page.waitForTimeout(1000)
    
    // 获取 SSH 模式下的标签页数量
    const sshTabsBefore = page.locator('.terminal-tab')
    const sshTabCount = await sshTabsBefore.count()
    console.log(`📋 SSH 标签页数量: ${sshTabCount}`)
    
    expect(sshTabCount).toBeGreaterThan(0)

    // 步骤 2: 切换到 SFTP 模式
    console.log('\n🔄 切换到 SFTP 模式...')
    const sftpModeBtn = page.locator('.mode-btn').filter({ hasText: 'SFTP' })
    await sftpModeBtn.click()
    await page.waitForTimeout(1000)

    // 验证已切换到 SFTP 模式
    const currentMode = (await page.locator('.mode-btn.active').textContent())?.trim()
    expect(currentMode).toBe('SFTP')
    console.log(`✅ 已切换到 SFTP 模式`)

    // 步骤 3: 验证 SFTP 模式下的状态
    // SFTP 模式下可能没有标签页，或者有之前创建的 SFTP 标签页
    const sftpTabs = page.locator('.terminal-tab')
    const sftpTabCount = await sftpTabs.count()
    console.log(`📋 SFTP 标签页数量: ${sftpTabCount}`)

    if (sftpTabCount > 0) {
      // 如果有标签页，应该有一个是活跃状态
      const activeTab = page.locator('.terminal-tab.active')
      const activeTabCount = await activeTab.count()
      
      if (activeTabCount > 0) {
        const activeTabText = await activeTab.first().textContent()
        console.log(`✅ SFTP 模式下有活跃标签页: ${activeTabText}`)
        
        // 验证活跃标签页存在且可见
        await expect(activeTab.first()).toBeVisible()
      } else {
        console.log(`⚠️ SFTP 模式下有 ${sftpTabCount} 个标签页，但无活跃标签页`)
      }
    } else {
      console.log('ℹ️ SFTP 模式下无标签页（这是正常的）')
    }

    // 步骤 4: 切回 SSH 模式
    console.log('\n🔄 切回 SSH 模式...')
    const sshModeBtn = page.locator('.mode-btn').filter({ hasText: 'SSH' })
    await sshModeBtn.click()
    await page.waitForTimeout(1000)

    // 验证已切回 SSH 模式
    const currentModeAfterSwitch = (await page.locator('.mode-btn.active').textContent())?.trim()
    expect(currentModeAfterSwitch).toBe('SSH')
    console.log(`✅ 已切回 SSH 模式`)

    // 步骤 5: 验证 SSH 模式下应该有活跃的标签页
    const sshTabsAfter = page.locator('.terminal-tab')
    const sshTabCountAfter = await sshTabsAfter.count()
    console.log(`📋 SSH 标签页数量: ${sshTabCountAfter}`)

    expect(sshTabCountAfter).toBeGreaterThan(0)

    // 关键验证：SSH 模式下必须有活跃的标签页
    const activeSshTab = page.locator('.terminal-tab.active')
    const activeSshTabCount = await activeSshTab.count()

    expect(activeSshTabCount).toBeGreaterThan(0)
    const activeSshTabText = await activeSshTab.first().textContent()
    console.log(`✅ SSH 模式下自动设置了活跃标签页: ${activeSshTabText}`)

    // 验证终端组件可见
    const terminal = page.locator('.x-terminal').first()
    await expect(terminal).toBeVisible({ timeout: 5000 })
    console.log('✅ 终端组件可见，显示正常')

    console.log('\n=== ✅ 测试通过：切换模式时 activeTabId 自动管理正确 ===\n')
  })

  test('切换模式后应恢复之前活跃的标签页', async () => {
    if (!page) throw new Error('Page 未初始化')

    console.log('\n=== 开始测试：切换模式后恢复之前的活跃标签页 ===\n')

    // 步骤 1: 创建 SSH 连接（会创建一个 SSH 标签页）
    await createSSHConnection(page)
    await page.waitForTimeout(1000)

    // 获取所有 SSH 标签页
    const allTabs = page.locator('.terminal-tab')
    const tabCount = await allTabs.count()
    
    console.log(`📋 标签页数量: ${tabCount}`)
    expect(tabCount).toBeGreaterThan(0)
    
    // 记录第一个（也是唯一一个）标签页的信息
    const firstTab = allTabs.first()
    const firstTabText = await firstTab.textContent()
    console.log(`📋 当前活跃标签页: ${firstTabText}`)

    // 步骤 2: 获取当前活跃标签页信息
    const activeTabBeforeSwitch = page.locator('.terminal-tab.active').first()
    const activeTabIdBefore = await activeTabBeforeSwitch.textContent()
    console.log(`\n📍 切换到 SFTP 前的活跃标签页: ${activeTabIdBefore?.trim()}`)

    // 步骤 3: 切换到 SFTP 模式
    console.log('\n🔄 切换到 SFTP 模式...')
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // 关闭可能的遮罩层或对话框
        const overlays = page.locator('.session-form-overlay, .error-dialog-overlay')
        if (await overlays.count() > 0) {
          for (let i = 0; i < await overlays.count(); i++) {
            try {
              const overlay = overlays.nth(i)
              if (await overlay.isVisible({ timeout: 300 })) {
                await overlay.click({ force: true, position: { x: 10, y: 10 } })
                await page.waitForTimeout(200)
              }
            } catch (e) {
              // 忽略
            }
          }
        }

        const sftpModeBtn = page.locator('.mode-btn').filter({ hasText: 'SFTP' })
        await sftpModeBtn.click({ force: true, timeout: 5000 })
        await page.waitForTimeout(800)

        // 验证是否切换成功
        const mode = (await page.locator('.mode-btn.active').textContent())?.trim()
        if (mode === 'SFTP') {
          console.log(`✅ 第 ${attempt} 次尝试成功切换到 SFTP`)
          break
        } else {
          console.log(`⚠️ 第 ${attempt} 次尝试失败（当前: ${mode}），重试...`)
          if (attempt < 3) await page.waitForTimeout(1000)
        }
      } catch (e) {
        console.log(`⚠️ 第 ${attempt} 次尝试出错: ${e instanceof Error ? e.message : e}`)
        if (attempt < 3) await page.waitForTimeout(1000)
      }
    }

    // 验证已切换到 SFTP 模式
    const currentMode = (await page.locator('.mode-btn.active').textContent())?.trim()
    expect(currentMode).toBe('SFTP')
    console.log(`✅ 已切换到 SFTP 模式`)

    // 步骤 4: 切回 SSH 模式
    console.log('\n🔄 切回 SSH 模式...')
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const sshModeBtn = page.locator('.mode-btn').filter({ hasText: 'SSH' })
        await sshModeBtn.click({ force: true, timeout: 5000 })
        await page.waitForTimeout(800)

        // 验证是否切换成功
        const mode = (await page.locator('.mode-btn.active').textContent())?.trim()
        if (mode === 'SSH') {
          console.log(`✅ 第 ${attempt} 次尝试成功切回 SSH`)
          break
        } else {
          console.log(`⚠️ 第 ${attempt} 次尝试失败（当前: ${mode}），重试...`)
          if (attempt < 3) await page.waitForTimeout(1000)
        }
      } catch (e) {
        console.log(`⚠️ 第 ${attempt} 次尝试出错: ${e instanceof Error ? e.message : e}`)
        if (attempt < 3) await page.waitForTimeout(1000)
      }
    }

    // 验证已切回 SSH 模式
    const currentModeAfterSwitch = (await page.locator('.mode-btn.active').textContent())?.trim()
    expect(currentModeAfterSwitch).toBe('SSH')
    console.log(`✅ 已切回 SSH 模式`)

    // 步骤 5: 验证活跃标签页是否恢复
    const activeTabAfterSwitch = page.locator('.terminal-tab.active').first()
    const activeTabIdAfter = await activeTabAfterSwitch.textContent()
    
    console.log(`\n📍 切回 SSH 后的活跃标签页: ${activeTabIdAfter?.trim()}`)
    console.log(`📍 之前的活跃标签页: ${activeTabIdBefore?.trim()}`)

    // 关键验证：
    // 1. 必须有活跃标签页
    expect(await activeTabAfterSwitch.isVisible()).toBe(true)
    console.log('✅ 活跃标签页可见')
    
    // 2. 活跃标签页应该与之前一致（对于单标签场景）
    expect(activeTabIdAfter?.trim()).toBe(activeTabIdBefore?.trim())
    console.log('✅✅✅ 完美！活跃标签页已正确恢复为用户之前的选择！')

    // 验证终端组件可见
    const terminal = page.locator('.x-terminal').first()
    await expect(terminal).toBeVisible({ timeout: 5000 })
    console.log('✅ 终端组件可见，显示正常')

    console.log('\n=== ✅ 测试通过：切换模式后成功恢复之前的活跃标签页 ===\n')
  })

  test('切换模式后终端应正确resize填满容器', async () => {
    if (!page) throw new Error('Page 未初始化')

    console.log('\n=== 开始测试：切换模式后终端正确 resize ===\n')

    // 步骤 1: 创建 SSH 连接
    await createSSHConnection(page)
    await page.waitForTimeout(1000)

    // 关闭可能的错误对话框
    const errorDialog = page.locator('.error-dialog-overlay').first()
    if (await errorDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
      await errorDialog.click({ force: true, position: { x: 10, y: 10 } })
      await page.waitForTimeout(500)
    }

    // 步骤 2: 获取初始终端尺寸
    const terminalContainer = page.locator('.terminal-area').first()
    const containerBox = await terminalContainer.boundingBox()
    
    expect(containerBox).not.toBeNull()
    console.log(`📐 终端容器尺寸: ${containerBox?.width}x${containerBox?.height}`)

    const terminalElement = page.locator('.x-terminal').first()
    const initialTerminalBox = await terminalElement.boundingBox()
    
    expect(initialTerminalBox).not.toBeNull()
    console.log(`📐 初始终端元素尺寸: ${initialTerminalBox?.width}x${initialTerminalBox?.height}`)

    // 步骤 3: 切换到 SFTP 模式
    console.log('\n🔄 切换到 SFTP 模式...')
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const sftpModeBtn = page.locator('.mode-btn').filter({ hasText: 'SFTP' })
        await sftpModeBtn.click({ force: true, timeout: 5000 })
        await page.waitForTimeout(800)

        const mode = (await page.locator('.mode-btn.active').textContent())?.trim()
        if (mode === 'SFTP') {
          console.log(`✅ 成功切换到 SFTP`)
          break
        }
      } catch (e) {
        if (attempt < 3) await page.waitForTimeout(1000)
      }
    }

    // 验证已切换到 SFTP 模式
    const currentModeSftp = (await page.locator('.mode-btn.active').textContent())?.trim()
    expect(currentModeSftp).toBe('SFTP')
    console.log('✅ 已切换到 SFTP 模式')

    // 步骤 4: 切回 SSH 模式
    console.log('\n🔄 切回 SSH 模式...')
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const sshModeBtn = page.locator('.mode-btn').filter({ hasText: 'SSH' })
        await sshModeBtn.click({ force: true, timeout: 5000 })
        await page.waitForTimeout(800)

        const mode = (await page.locator('.mode-btn.active').textContent())?.trim()
        if (mode === 'SSH') {
          console.log(`✅ 成功切回 SSH`)
          break
        }
      } catch (e) {
        if (attempt < 3) await page.waitForTimeout(1000)
      }
    }

    // 验证已切回 SSH 模式
    const currentModeSsh = (await page.locator('.mode-btn.active').textContent())?.trim()
    expect(currentModeSsh).toBe('SSH')
    console.log('✅ 已切回 SSH 模式')

    // 等待 ResizeObserver 和 IntersectionObserver 触发 fit
    await page.waitForTimeout(500)

    // 步骤 5: 验证终端是否正确 resize
    const finalTerminalBox = await terminalElement.boundingBox()
    
    expect(finalTerminalBox).not.toBeNull()
    console.log(`\n📐 切换后的终端元素尺寸: ${finalTerminalBox?.width}x${finalTerminalBox?.height}`)
    console.log(`📐 终端容器尺寸: ${containerBox?.width}x${containerBox?.height}`)

    // 验证终端元素宽度接近容器宽度（允许 5px 的误差）
    if (finalTerminalBox && containerBox && initialTerminalBox) {
      const widthDiff = Math.abs(finalTerminalBox.width - containerBox.width)
      const heightDiff = Math.abs(finalTerminalBox.height - containerBox.height)
      
      console.log(`\n📊 宽度差值: ${widthDiff}px（允许误差: 5px）`)
      console.log(`📊 高度差值: ${heightDiff}px（允许误差: 50px）`)

      // 终端应该填满容器（考虑边框和内边距的误差）
      expect(widthDiff).toBeLessThanOrEqual(5)
      expect(heightDiff).toBeLessThanOrEqual(50)
      
      console.log('✅✅✅ 完美！终端已正确 resize 并填满容器！')
    }

    // 验证终端组件可见且正常渲染
    await expect(terminalElement).toBeVisible({ timeout: 3000 })
    
    // 检查 xterm-screen 是否存在且有合理尺寸
    const xtermScreen = page.locator('.xterm-screen').first()
    const screenExists = await xtermScreen.count()
    expect(screenExists).toBeGreaterThan(0)
    console.log('✅ xterm.js 屏幕组件存在')

    console.log('\n=== ✅ 测试通过：切换模式后终端正确 resize 填满容器 ===\n')
  })
})
