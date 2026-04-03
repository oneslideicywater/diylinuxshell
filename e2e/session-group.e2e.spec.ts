/**
 * 会话分组功能测试
 * 测试分组的创建、编辑、删除以及会话移动功能
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from './helpers/electron-app'
import { testConfig } from './config/test-config'

let electronApp: ElectronApplication
let page: Page

test.describe('会话分组功能', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('应该在会话列表右键菜单中显示"新建分组"选项', async () => {
    // 等待会话列表加载
    await page.waitForSelector('.session-list', { timeout: 10000 })
    
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
    
    // 获取会话组容器的边界
    const sessionGroups = page.locator('.session-groups')
    const box = await sessionGroups.boundingBox()
    
    if (!box) {
      throw new Error('无法获取 session-groups 边界')
    }
    
    // 点击容器底部的空白区域（使用 page.mouse 精确点击）
    const clickX = box.x + box.width / 2
    const clickY = box.y + box.height - 10  // 点击底部，避开所有会话项
    
    console.log(`右键点击位置：(${clickX}, ${clickY})`)
    
    await page.mouse.move(clickX, clickY)
    await page.mouse.click(clickX, clickY, { button: 'right' })
    
    // 等待右键菜单出现（使用 :visible 选择器选中可见的菜单）
    const contextMenu = page.locator('.context-menu:visible').first()
    await contextMenu.waitFor({ state: 'visible', timeout: 10000 })
    
    // 验证菜单中包含"新建分组"选项
    await expect(contextMenu).toContainText('新建分组')
  })

  test('应该能够创建新分组', async () => {
    // 获取会话组容器的边界
    const sessionGroups = page.locator('.session-groups')
    const box = await sessionGroups.boundingBox()
    
    if (!box) {
      throw new Error('无法获取 session-groups 边界')
    }
    
    // 点击容器底部的空白区域
    const clickX = box.x + box.width / 2
    const clickY = box.y + box.height - 10
    
    await page.mouse.move(clickX, clickY)
    await page.mouse.click(clickX, clickY, { button: 'right' })
    
    // 等待右键菜单出现（使用 :visible 选择器选中可见的菜单）
    const contextMenu = page.locator('.context-menu:visible').first()
    await contextMenu.waitFor({ state: 'visible', timeout: 10000 })
    
    // 点击"新建分组"
    await contextMenu.locator('.menu-item:has-text("新建分组")').click()
    
    // 等待分组表单对话框出现
    await page.waitForSelector('.group-form', { timeout: 10000 })
    
    // 输入分组名称
    await page.fill('#groupName', '测试分组')
    
    // 选择一个图标
    await page.click('.icon-option:first-child')
    
    // 提交表单
    await page.click('.group-form .btn-primary')
    
    // 等待对话框关闭
    await page.waitForSelector('.group-form', { state: 'hidden', timeout: 10000 })
    
    // 验证分组已创建
    const groupHeader = page.locator('.group-header:has-text("测试分组")')
    await expect(groupHeader).toBeVisible({ timeout: 10000 })
  })

  test('应该能够在分组头部右键显示分组管理菜单', async () => {
    // 确保至少有一个分组
    const groupHeader = page.locator('.group-header').first()
    await expect(groupHeader).toBeVisible({ timeout: 10000 })
    
    // 右键点击分组头部
    await groupHeader.click({ button: 'right' })
    
    // 等待右键菜单出现（使用 :visible 选择器选中可见的菜单）
    const contextMenu = page.locator('.context-menu:visible').first()
    await contextMenu.waitFor({ state: 'visible', timeout: 10000 })
    
    // 验证菜单项
    await expect(contextMenu).toContainText('添加会话到此分组')
    await expect(contextMenu).toContainText('编辑分组')
    await expect(contextMenu).toContainText('删除分组')
  })

  test('应该能够编辑分组', async () => {
    // 右键点击第一个分组
    const groupHeader = page.locator('.group-header').first()
    await groupHeader.click({ button: 'right' })
    
    // 等待右键菜单出现（使用 :visible 选择器选中可见的菜单）
    const contextMenu = page.locator('.context-menu:visible').first()
    await contextMenu.waitFor({ state: 'visible', timeout: 10000 })
    
    // 点击"编辑分组"
    await contextMenu.locator('.menu-item:has-text("编辑分组")').click()
    
    // 等待分组表单对话框出现
    await page.waitForSelector('.group-form', { timeout: 10000 })
    
    // 验证表单标题是"编辑分组"
    await expect(page.locator('.group-form h3:has-text("编辑分组")')).toBeVisible()
    
    // 修改分组名称
    const nameInput = page.locator('#groupName')
    await nameInput.fill('编辑后的分组名')
    
    // 提交表单
    await page.click('.group-form .btn-primary')
    
    // 等待对话框关闭
    await page.waitForSelector('.group-form', { state: 'hidden', timeout: 10000 })
    
    // 验证分组名称已更新
    await expect(page.locator('.group-header:has-text("编辑后的分组名")')).toBeVisible({ timeout: 10000 })
  })

  test('应该在分组表单中显示所有可用图标', async () => {
    // 获取会话组容器的边界
    const sessionGroups = page.locator('.session-groups')
    const box = await sessionGroups.boundingBox()
    
    if (!box) {
      throw new Error('无法获取 session-groups 边界')
    }
    
    // 点击容器底部的空白区域
    const clickX = box.x + box.width / 2
    const clickY = box.y + box.height - 10
    
    await page.mouse.move(clickX, clickY)
    await page.mouse.click(clickX, clickY, { button: 'right' })
    
    // 等待右键菜单出现（使用 :visible 选择器选中可见的菜单）
    const contextMenu = page.locator('.context-menu:visible').first()
    await contextMenu.waitFor({ state: 'visible', timeout: 10000 })
    
    // 点击"新建分组"
    await contextMenu.locator('.menu-item:has-text("新建分组")').click()
    
    // 等待分组表单对话框出现
    await page.waitForSelector('.group-form', { timeout: 10000 })
    
    // 验证图标选择器存在
    const iconSelector = page.locator('.icon-selector')
    await expect(iconSelector).toBeVisible()
    
    // 验证至少有 6 个图标选项
    const iconOptions = page.locator('.icon-option')
    const count = await iconOptions.count()
    expect(count).toBeGreaterThanOrEqual(6)
    
    // 关闭对话框
    await page.click('.group-form .btn-secondary')
  })

  test('应该在深色主题下正常显示分组功能', async () => {
    // 确保是深色主题
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark')
    })
    
    // 获取会话组容器的边界
    const sessionGroups = page.locator('.session-groups')
    const box = await sessionGroups.boundingBox()
    
    if (!box) {
      throw new Error('无法获取 session-groups 边界')
    }
    
    // 点击容器底部的空白区域
    const clickX = box.x + box.width / 2
    const clickY = box.y + box.height - 10
    
    await page.mouse.move(clickX, clickY)
    await page.mouse.click(clickX, clickY, { button: 'right' })
    
    // 等待右键菜单出现（使用 :visible 选择器选中可见的菜单）
    const contextMenu = page.locator('.context-menu:visible').first()
    await contextMenu.waitFor({ state: 'visible', timeout: 10000 })
    
    // 验证菜单样式
    await expect(contextMenu).toBeVisible()
    
    // 验证菜单项可见
    await expect(contextMenu.locator('.menu-item:has-text("新建分组")')).toBeVisible()
  })

  test('应该在浅色主题下正常显示分组功能', async () => {
    // 切换到浅色主题
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light')
    })
    
    // 获取会话组容器的边界
    const sessionGroups = page.locator('.session-groups')
    const box = await sessionGroups.boundingBox()
    
    if (!box) {
      throw new Error('无法获取 session-groups 边界')
    }
    
    // 点击容器底部的空白区域
    const clickX = box.x + box.width / 2
    const clickY = box.y + box.height - 10
    
    await page.mouse.move(clickX, clickY)
    await page.mouse.click(clickX, clickY, { button: 'right' })
    
    // 等待右键菜单出现（使用 :visible 选择器选中可见的菜单）
    const contextMenu = page.locator('.context-menu:visible').first()
    await contextMenu.waitFor({ state: 'visible', timeout: 10000 })
    
    // 验证菜单样式
    await expect(contextMenu).toBeVisible()
    
    // 验证菜单项可见
    await expect(contextMenu.locator('.menu-item:has-text("新建分组")')).toBeVisible()
  })
})
