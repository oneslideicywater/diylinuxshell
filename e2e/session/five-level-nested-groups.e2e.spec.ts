/**
 * 五层嵌套子分组测试
 * 测试创建从第一层到第五层的嵌套子分组功能
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'
import { testConfig } from '../config/test-config'

let electronApp: ElectronApplication
let page: Page

test.describe('五层嵌套子分组', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('应该能够创建五层嵌套的子分组', async () => {
    // 等待会话列表加载
    await page.waitForSelector('.session-list', { timeout: 10000 })
    
    // 清理所有现有数据
    console.log('=== 清理现有数据 ===')
    await page.evaluate(async () => {
      // 清理会话
      const sessions = await window.api.session.getAll()
      for (const session of sessions) {
        await window.api.session.delete(session.id)
      }
      
      // 清理分组
      const groups = await window.api.sessionGroup.getAll()
      for (const group of groups) {
        await window.api.sessionGroup.delete(group.id)
      }
    })
    
    // 刷新页面
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)
    
    // 检查是否有会话，如果没有，先创建一个
    const sessionCount = await page.locator('.session-item').count()
    if (sessionCount === 0) {
      console.log('没有会话，先创建一个测试会话')
      const addBtn = page.locator('.sidebar-section .add-btn').first()
      await addBtn.click()
      await page.waitForTimeout(500)
      
      // 填写会话信息
      const nameInput = page.locator('.session-form input[id="name"]')
      const hostInput = page.locator('.session-form input[id="host"]')
      const portInput = page.locator('.session-form input[id="port"]')
      const usernameInput = page.locator('.session-form input[id="username"]')
      const passwordInput = page.locator('.session-form input[id="password"]')
      
      await nameInput.fill('测试会话')
      await hostInput.fill(testConfig.ssh.host)
      await portInput.fill(String(testConfig.ssh.port))
      await usernameInput.fill(testConfig.ssh.username)
      await passwordInput.fill(testConfig.ssh.password)
      
      // 保存会话
      const saveBtn = page.locator('.session-form .btn.submit')
      await saveBtn.click()
      await page.waitForTimeout(1000)
    }
    
    // 步骤 1: 创建根分组（第一层）
    console.log('=== 开始创建第一层分组 ===')
    await createGroupFromList('第一层分组')
    
    // 步骤 2: 在第一层分组下创建第二层分组
    console.log('=== 开始创建第二层分组 ===')
    await createSubGroup('第一层分组', '第二层分组')
    
    // 步骤 3: 在第二层分组下创建第三层分组
    console.log('=== 开始创建第三层分组 ===')
    await createSubGroup('第二层分组', '第三层分组')
    
    // 步骤 4: 在第三层分组下创建第四层分组
    console.log('=== 开始创建第四层分组 ===')
    await createSubGroup('第三层分组', '第四层分组')
    
    // 步骤 5: 在第四层分组下创建第五层分组
    console.log('=== 开始创建第五层分组 ===')
    await createSubGroup('第四层分组', '第五层分组')
    
    // 验证所有五层分组都存在 - 使用更精确的文本匹配
    console.log('=== 验证所有分组 ===')
    await expect(page.locator('.group-header').filter({ hasText: '第一层分组' })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.group-header').filter({ hasText: '第二层分组' })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.group-header').filter({ hasText: '第三层分组' })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.group-header').filter({ hasText: '第四层分组' })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.group-header').filter({ hasText: '第五层分组' })).toBeVisible({ timeout: 10000 })
    
    console.log('✅ 五层嵌套子分组创建成功！')
  })

  /**
   * 从列表空白区域创建分组
   */
  async function createGroupFromList(groupName: string) {
    // 找到 session-list-spacer 元素
    const spacer = page.locator('.session-list-spacer')
    await expect(spacer).toBeVisible({ timeout: 10000 })
    
    // 右键点击 spacer 元素
    await spacer.click({ button: 'right' })
    
    // 等待右键菜单出现（使用 v-show 显示的菜单）
    const contextMenu = page.locator('.context-menu').filter({ hasText: '新建分组' })
    await contextMenu.waitFor({ state: 'visible', timeout: 10000 })
    
    // 点击"新建分组"
    await contextMenu.locator('.menu-item:has-text("新建分组")').click()
    
    // 等待分组表单对话框出现
    await page.waitForSelector('.group-form', { timeout: 10000 })
    
    // 输入分组名称
    await page.fill('#groupName', groupName)
    
    // 选择一个图标
    await page.click('.icon-option:first-child')
    
    // 提交表单
    await page.click('.group-form .btn-primary')
    
    // 等待对话框关闭
    await page.waitForSelector('.group-form', { state: 'hidden', timeout: 10000 })
    
    // 验证分组已创建 - 使用更精确的文本匹配
    const groupHeader = page.locator('.group-header').filter({ hasText: groupName })
    await expect(groupHeader).toBeVisible({ timeout: 10000 })
    
    console.log(`✅ 创建分组: ${groupName}`)
  }

  /**
   * 在父分组下创建子分组
   */
  async function createSubGroup(parentGroupName: string, subGroupName: string) {
    // 找到父分组 - 使用更精确的文本匹配
    const parentGroupHeader = page.locator('.group-header').filter({ hasText: parentGroupName }).first()
    await expect(parentGroupHeader).toBeVisible({ timeout: 10000 })
    
    // 检查父分组是否已展开，如果没有则展开
    const expandIcon = parentGroupHeader.locator('.expand-icon')
    const isExpanded = await expandIcon.getAttribute('class')
    if (!isExpanded?.includes('expanded')) {
      await parentGroupHeader.click()
      await page.waitForTimeout(500)
    }
    
    // 右键点击父分组
    await parentGroupHeader.click({ button: 'right' })
    
    // 等待右键菜单出现
    const contextMenu = page.locator('.context-menu:visible').first()
    await contextMenu.waitFor({ state: 'visible', timeout: 10000 })
    
    // 点击"新建子分组"
    const createSubGroupItem = contextMenu.locator('.menu-item:has-text("新建子分组")')
    await expect(createSubGroupItem).toBeVisible()
    await createSubGroupItem.click()
    
    // 等待分组表单对话框出现
    await page.waitForSelector('.group-form', { timeout: 10000 })
    
    // 输入子分组名称
    await page.fill('#groupName', subGroupName)
    
    // 选择一个图标
    await page.click('.icon-option:first-child')
    
    // 提交表单
    await page.click('.group-form .btn-primary')
    
    // 等待对话框关闭
    await page.waitForSelector('.group-form', { state: 'hidden', timeout: 10000 })
    
    // 验证子分组已创建 - 使用更精确的文本匹配
    const subGroupHeader = page.locator('.group-header').filter({ hasText: subGroupName })
    await expect(subGroupHeader).toBeVisible({ timeout: 10000 })
    
    console.log(`✅ 在 "${parentGroupName}" 下创建子分组: ${subGroupName}`)
  }
})
