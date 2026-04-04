/**
 * 子分组缩进验证测试
 * 验证所有层级子分组的 paddingLeft 值都是 12px
 * 
 * padding 计算规则：所有 sub-group 都使用 paddingLeft: 12px
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'
import { testConfig } from '../config/test-config'

let electronApp: ElectronApplication
let page: Page

test.describe('子分组缩进验证', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('应该验证所有层级子分组的 paddingLeft 值都是 12px', async () => {
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
    
    // 步骤 1: 创建根分组（第一层，depth=1）
    console.log('=== 开始创建第一层分组 (depth=1) ===')
    await createGroupFromList('第一层分组')
    
    // 步骤 2: 在第一层分组下创建第二层分组（depth=2）
    console.log('=== 开始创建第二层分组 (depth=2) ===')
    await createSubGroup('第一层分组', '第二层分组')
    
    // 步骤 3: 在第二层分组下创建第三层分组（depth=3）
    console.log('=== 开始创建第三层分组 (depth=3) ===')
    await createSubGroup('第二层分组', '第三层分组')
    
    // 步骤 4: 在第三层分组下创建第四层分组（depth=4）
    console.log('=== 开始创建第四层分组 (depth=4) ===')
    await createSubGroup('第三层分组', '第四层分组')
    
    // 步骤 5: 在第四层分组下创建第五层分组（depth=5）
    console.log('=== 开始创建第五层分组 (depth=5) ===')
    await createSubGroup('第四层分组', '第五层分组')
    
    // 验证 paddingLeft 值都是 12px
    console.log('=== 验证各层分组的 paddingLeft 值 ===')
    
    // 使用 data-group-depth 属性来获取各层分组
    // 第一层分组（depth=1）不在 sub-group 中，它是根分组
    // 第二层分组（depth=2）
    const group2 = page.locator('.session-group.sub-group[data-group-depth="2"]')
    const padding2 = await group2.evaluate(el => getComputedStyle(el).paddingLeft)
    console.log(`第二层分组 (depth=2) paddingLeft: ${padding2}`)
    expect(padding2).toBe('12px')
    
    // 第三层分组（depth=3）
    const group3 = page.locator('.session-group.sub-group[data-group-depth="3"]')
    const padding3 = await group3.evaluate(el => getComputedStyle(el).paddingLeft)
    console.log(`第三层分组 (depth=3) paddingLeft: ${padding3}`)
    expect(padding3).toBe('12px')
    
    // 第四层分组（depth=4）
    const group4 = page.locator('.session-group.sub-group[data-group-depth="4"]')
    const padding4 = await group4.evaluate(el => getComputedStyle(el).paddingLeft)
    console.log(`第四层分组 (depth=4) paddingLeft: ${padding4}`)
    expect(padding4).toBe('12px')
    
    // 第五层分组（depth=5）
    const group5 = page.locator('.session-group.sub-group[data-group-depth="5"]')
    const padding5 = await group5.evaluate(el => getComputedStyle(el).paddingLeft)
    console.log(`第五层分组 (depth=5) paddingLeft: ${padding5}`)
    expect(padding5).toBe('12px')
    
    console.log('✅ 所有分组的 paddingLeft 值验证通过！')
  })

  /**
   * 从列表空白区域创建分组
   */
  async function createGroupFromList(groupName: string) {
    const spacer = page.locator('.session-list-spacer')
    await expect(spacer).toBeVisible({ timeout: 10000 })
    await spacer.click({ button: 'right' })
    
    const contextMenu = page.locator('.context-menu').filter({ hasText: '新建分组' })
    await contextMenu.waitFor({ state: 'visible', timeout: 10000 })
    await contextMenu.locator('.menu-item:has-text("新建分组")').click()
    
    await page.waitForSelector('.group-form', { timeout: 10000 })
    await page.fill('#groupName', groupName)
    await page.click('.icon-option:first-child')
    await page.click('.group-form .btn-primary')
    await page.waitForSelector('.group-form', { state: 'hidden', timeout: 10000 })
    
    const groupHeader = page.locator('.group-header').filter({ hasText: groupName })
    await expect(groupHeader).toBeVisible({ timeout: 10000 })
    console.log(`✅ 创建分组: ${groupName}`)
  }

  /**
   * 在父分组下创建子分组
   */
  async function createSubGroup(parentGroupName: string, subGroupName: string) {
    const parentGroupHeader = page.locator('.group-header').filter({ hasText: parentGroupName }).first()
    await expect(parentGroupHeader).toBeVisible({ timeout: 10000 })
    
    const expandIcon = parentGroupHeader.locator('.expand-icon')
    const isExpanded = await expandIcon.getAttribute('class')
    if (!isExpanded?.includes('expanded')) {
      await parentGroupHeader.click()
      await page.waitForTimeout(500)
    }
    
    await parentGroupHeader.click({ button: 'right' })
    
    const contextMenu = page.locator('.context-menu:visible').first()
    await contextMenu.waitFor({ state: 'visible', timeout: 10000 })
    
    const createSubGroupItem = contextMenu.locator('.menu-item:has-text("新建子分组")')
    await expect(createSubGroupItem).toBeVisible()
    await createSubGroupItem.click()
    
    await page.waitForSelector('.group-form', { timeout: 10000 })
    await page.fill('#groupName', subGroupName)
    await page.click('.icon-option:first-child')
    await page.click('.group-form .btn-primary')
    await page.waitForSelector('.group-form', { state: 'hidden', timeout: 10000 })
    
    const subGroupHeader = page.locator('.group-header').filter({ hasText: subGroupName })
    await expect(subGroupHeader).toBeVisible({ timeout: 10000 })
    console.log(`✅ 在 "${parentGroupName}" 下创建子分组: ${subGroupName}`)
  }
})
