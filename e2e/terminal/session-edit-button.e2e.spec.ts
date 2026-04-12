/**
 * SessionItem 编辑按钮 E2E 测试
 * 验证: 点击编辑按钮 → 弹出 SessionForm
 */

import { test, expect, beforeAll, afterAll } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'
import { testConfig, generateUniqueName } from '../config/test-config'
import type { ElectronApplication, Page } from '@playwright/test'

let app: ElectronApplication
let page: Page
let testSessionName: string = ''

test.describe('SessionItem - 编辑按钮', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)

    /* 捕获关键控制台消息 */
    page.on('console', (msg) => {
      const text = msg.text()
      if (text.includes('handleEdit') || text.includes('SessionForm') ||
          text.includes('showSession') || msg.type() === 'error') {
        console.log(`[${msg.type().toUpperCase()}]`, text)
      }
    })

    /* 创建测试会话 */
    testSessionName = await createTestSession(page)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  /**
   * 核心测试: 点击编辑按钮弹出 SessionForm
   */
  test('点击编辑按钮弹出 SessionForm', async () => {
    console.log(`[TEST] 开始测试编辑按钮, 会话: ${testSessionName}`)

    const formOverlay = page.locator('.session-form-overlay')

    /* 步骤1: 确保之前的表单已关闭 */
    try {
      await expect(formOverlay).toBeHidden({ timeout: 2000 })
    } catch {
      await formOverlay.locator('.btn.cancel').click().catch(() => {})
      await page.waitForTimeout(300)
    }

    /* 步骤2: 展开会话分组 */
    /* 点击展开图标（箭头）来展开分组 */
    const expandIcon = page.locator('.expand-icon').first()
    if (await expandIcon.count() > 0) {
      await expandIcon.click()
      await page.waitForTimeout(500)
    }

    /* 如果还是折叠的，尝试点击 group-header 的文字区域 */
    const sessionItemCheck = page.locator('.session-item').first()
    if (!(await sessionItemCheck.isVisible().catch(() => false))) {
      const groupName = page.locator('.group-name').first()
      if (await groupName.count() > 0) {
        await groupName.click({ force: true })
        await page.waitForTimeout(500)
      }
    }

    /* 步骤3: 定位并 hover 会话项 */
    /* 注意: 当前已知 bug - 所有 session.name 为 undefined, 无法通过名称匹配 */
    const sessionItem = page.locator('.session-item').first()
    await expect(sessionItem).toBeVisible({ timeout: 10000 })
    await sessionItem.hover()
    await page.waitForTimeout(500)

    /* 步骤4: 确认表单初始关闭 */
    expect(await formOverlay.isVisible().catch(() => false)).toBe(false)

    /* 步骤5: 定位编辑按钮并点击 */
    const editBtn = sessionItem.locator('.action-btn.edit')
    await expect(editBtn).toBeVisible({ timeout: 3000 })
    
    console.log('[TEST] 点击编辑按钮...')
    await editBtn.click()
    await page.waitForTimeout(1000)

    /* 步骤6: 验证表单弹出 */
    const formVisible = await formOverlay.isVisible().catch(() => false)
    console.log(`[RESULT] SessionForm 弹出: ${formVisible}`)
    expect(formVisible).toBe(true)
  })
})

/**
 * 创建测试会话辅助函数
 */
async function createTestSession(p: Page): Promise<string> {
  const name = generateUniqueName('EditTest')

  /* 打开新建会话表单 */
  await p.locator('.add-session-btn').first().click()
  await p.waitForTimeout(500)

  /* 填写表单 */
  await p.locator('.session-form input[id="name"]').fill(name)
  await p.locator('.session-form input[id="host"]').fill(testConfig.ssh.host)
  await p.locator('.session-form input[id="port"]').fill(String(testConfig.ssh.port))
  await p.locator('.session-form input[id="username"]').fill(testConfig.ssh.username)
  await p.locator('.session-form input[id="password"]').fill(testConfig.ssh.password)

  /* 提交保存 */
  await p.locator('.session-form .btn.submit').click()
  await p.waitForTimeout(1000)

  /* 关闭表单（如果还开着） */
  const formOverlay = p.locator('.session-form-overlay')
  try {
    await expect(formOverlay).toBeHidden({ timeout: 2000 })
  } catch {
    await formOverlay.locator('.btn.cancel').click().catch(() => {})
    await p.waitForTimeout(300)
  }

  console.log(`[SETUP] 测试会话 "${name}" 已创建`)
  return name
}
