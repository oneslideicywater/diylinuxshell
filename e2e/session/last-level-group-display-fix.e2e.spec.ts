/**
 * 最后一层分组文字显示效果修复验证测试
 * 验证修复后最后一层分组的文字显示效果与其他层相同
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'
import { testConfig } from '../config/test-config'

let electronApp: ElectronApplication
let page: Page

test.describe('最后一层分组文字显示效果修复验证', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('验证最后一层分组的文字显示效果与其他层相同', async () => {
    // 等待会话列表加载
    await page.waitForSelector('.session-list', { timeout: 10000 })
    
    // 清理所有现有数据
    console.log('=== 清理现有数据 ===')
    await page.evaluate(async () => {
      const sessions = await window.api.session.getAll()
      for (const session of sessions) {
        await window.api.session.delete(session.id)
      }
      
      const groups = await window.api.sessionGroup.getAll()
      for (const group of groups) {
        await window.api.sessionGroup.delete(group.id)
      }
    })
    
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
      
      const saveBtn = page.locator('.session-form .btn.submit')
      await saveBtn.click()
      await page.waitForTimeout(1000)
    }
    
    // 创建五层嵌套分组
    console.log('=== 创建五层嵌套分组 ===')
    await createGroupFromList('第一层分组')
    await createSubGroup('第一层分组', '第二层分组')
    await createSubGroup('第二层分组', '第三层分组')
    await createSubGroup('第三层分组', '第四层分组')
    await createSubGroup('第四层分组', '第五层分组')
    
    // 验证各层分组的样式
    console.log('=== 验证修复后各层分组的样式 ===')
    
    const groupInfo = await page.evaluate(() => {
      const results: Array<{
        depth: number
        opacity: string
        color: string
        hasDepthLimitClass: boolean
        paddingLeft: string
      }> = []
      
      const allSubGroups = document.querySelectorAll('.session-group.sub-group')
      
      allSubGroups.forEach((group) => {
        const depthAttr = group.getAttribute('data-group-depth')
        const depth = depthAttr ? parseInt(depthAttr) : 0
        const header = group.querySelector('.group-header')
        const groupStyle = getComputedStyle(group as HTMLElement)
        
        if (header) {
          const headerStyle = getComputedStyle(header as HTMLElement)
          const hasDepthLimitClass = (header as HTMLElement).classList.contains('depth-limit-reached')
          
          results.push({
            depth,
            opacity: headerStyle.opacity,
            color: headerStyle.color,
            hasDepthLimitClass,
            paddingLeft: groupStyle.paddingLeft
          })
        }
      })
      
      return results
    })
    
    groupInfo.forEach(info => {
      console.log(`depth=${info.depth} - opacity: ${info.opacity}, color: ${info.color}, has depth-limit-reached: ${info.hasDepthLimitClass}, paddingLeft: ${info.paddingLeft}`)
    })
    
    // 验证所有分组的 opacity 都是 1
    groupInfo.forEach(info => {
      expect(parseFloat(info.opacity)).toBeCloseTo(1, 1)
    })
    
    // 验证 padding 值都是 12px
    const depth2Group = groupInfo.find(g => g.depth === 2)
    const depth3Group = groupInfo.find(g => g.depth === 3)
    const depth4Group = groupInfo.find(g => g.depth === 4)
    const depth5Group = groupInfo.find(g => g.depth === 5)
    
    if (depth2Group) expect(depth2Group.paddingLeft).toBe('12px')
    if (depth3Group) expect(depth3Group.paddingLeft).toBe('12px')
    if (depth4Group) expect(depth4Group.paddingLeft).toBe('12px')
    if (depth5Group) expect(depth5Group.paddingLeft).toBe('12px')
    
    // 验证第五层分组应该有 depth-limit-reached 类
    if (depth5Group) expect(depth5Group.hasDepthLimitClass).toBe(true)
    
    console.log('\n✅ 修复验证通过！最后一层分组的文字显示效果与其他层相同！')
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
