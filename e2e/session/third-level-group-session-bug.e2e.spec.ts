/**
 * 第三层分组创建会话 Bug 修复验证测试（UI 层面）
 * 
 * 测试策略：
 * - 使用 API 创建三层嵌套分组结构（避免右键菜单稳定性问题）
 * - 通过 UI 操作触发"添加会话"功能
 * - 验证会话保存到正确的分组
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'
import { testConfig } from '../config/test-config'

let electronApp: ElectronApplication
let page: Page

test.describe('第三层分组创建会话 Bug 修复验证（UI）', () => {
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
   * 清理所有测试数据
   */
  async function cleanupTestData(): Promise<void> {
    await page.evaluate(async () => {
      // 清理会话
      const sessions = await window.api.session.getAll()
      for (const session of sessions) {
        if (session.name.startsWith('UITest')) {
          try {
            await window.api.session.delete(session.id)
          } catch (error) {
            console.warn(`删除会话失败: ${session.name}`, error)
          }
        }
      }
      
      // 清理分组（跳过默认分组）
      const groups = await window.api.sessionGroup.getAll()
      for (const group of groups) {
        if (group.name.startsWith('UITest') && group.name !== '默认分组') {
          try {
            await window.api.sessionGroup.delete(group.id)
          } catch (error) {
            console.warn(`删除分组失败: ${group.name}`, error)
          }
        }
      }
    })
  }

  /**
   * 通过 API 创建三层嵌套分组
   */
  async function createThreeLevelGroups(): Promise<{ level1: any; level2: any; level3: any }> {
    return await page.evaluate(async () => {
      // 第一层
      const group1 = await window.api.sessionGroup.create({ name: 'UITest-层级1' })
      
      // 第二层
      const group2 = await window.api.sessionGroup.create({ name: 'UITest-层级2' }, group1.id)
      
      // 第三层
      const group3 = await window.api.sessionGroup.create({ name: 'UITest-层级3' }, group2.id)
      
      return {
        level1: { id: group1.id, name: group1.name },
        level2: { id: group2.id, name: group2.name },
        level3: { id: group3.id, name: group3.name }
      }
    })
  }

  /**
   * 刷新页面并等待加载完成
   */
  async function refreshAndWait(): Promise<void> {
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)
  }

  /**
   * 展开指定名称的分组
   */
  async function expandGroupByName(groupName: string): Promise<void> {
    const groupHeader = page.locator('.group-header').filter({ hasText: groupName }).first()
    await expect(groupHeader).toBeVisible({ timeout: 5000 })
    
    const expandIcon = groupHeader.locator('.expand-icon')
    const isExpanded = await expandIcon.getAttribute('class')
    
    if (!isExpanded?.includes('expanded')) {
      await groupHeader.click()
      await page.waitForTimeout(300)
    }
    
    console.log(`✓ 已展开分组: ${groupName}`)
  }

  test('路径1: 通过 GroupHeader 右键菜单"添加会话"在第三层分组创建会话', async () => {
    console.log('\n========== 测试路径1: GroupHeader 右键菜单添加会话 ==========')

    // 步骤 1: 清理并准备数据
    console.log('\n=== 步骤1: 准备测试数据 ===')
    await cleanupTestData()
    
    // 通过 API 创建三层嵌套分组
    const groupIds = await createThreeLevelGroups()
    console.log(`✓ 创建了三层分组: ${groupIds.level1.name} → ${groupIds.level2.name} → ${groupIds.level3.name}`)
    
    // 刷新页面以显示新创建的分组
    await refreshAndWait()

    // 展开所有分组以显示第三层
    await expandGroupByName(groupIds.level1.name)
    await expandGroupByName(groupIds.level2.name)
    await expandGroupByName(groupIds.level3.name)
    await page.waitForTimeout(500)

    // 步骤 2: 通过 GroupHeader 右键菜单创建会话
    console.log('\n=== 步骤2: 通过 GroupHeader 右键菜单创建会话 ===')
    
    // 找到第三层分组的 GroupHeader
    const thirdLevelGroupHeader = page.locator('.group-header').filter({ hasText: groupIds.level3.name })
    await expect(thirdLevelGroupHeader).toBeVisible({ timeout: 5000 })
    console.log(`✓ 找到第三层分组: ${groupIds.level3.name}`)
    
    // 右键点击第三层分组的 GroupHeader
    await thirdLevelGroupHeader.click({ button: 'right' })
    await page.waitForTimeout(300)
    console.log('✓ 右键点击了第三层分组头部')
    
    // 等待右键菜单出现
    const contextMenu = page.locator('.context-menu:visible').first()
    await expect(contextMenu).toBeVisible({ timeout: 2000 })
    console.log('✅ 右键菜单出现')
    
    // 点击"添加会话"菜单项
    const addSessionMenuItem = contextMenu.locator('.menu-item').filter({ hasText: '添加会话' })
    await expect(addSessionMenuItem).toBeVisible({ timeout: 2000 })
    await addSessionMenuItem.click()
    await page.waitForTimeout(500)
    console.log('✓ 点击了"添加会话"菜单项')

    // 等待会话表单出现（SessionSidebarContainer 内的 SessionForm）
    const sessionForm = page.locator('.session-form')
    await expect(sessionForm).toBeVisible({ timeout: 5000 })
    console.log('✅ 会话表单已打开')

    // 填写会话信息
    const nameInput = sessionForm.locator('#name')
    const hostInput = sessionForm.locator('#host')
    const portInput = sessionForm.locator('#port')
    const usernameInput = sessionForm.locator('#username')
    const passwordInput = sessionForm.locator('#password')
    
    await nameInput.fill('UITest-路径1-第三层会话')
    await hostInput.fill(testConfig.ssh.host)
    await portInput.fill(String(testConfig.ssh.port))
    await usernameInput.fill(testConfig.ssh.username)
    await passwordInput.fill(testConfig.ssh.password)
    console.log('✓ 填写了会话信息')
    
    // 提交表单
    const saveBtn = sessionForm.locator('.btn.submit')
    await saveBtn.click()
    await page.waitForTimeout(1000)
    console.log('✓ 提交了会话表单')
    
    // 步骤 3: 验证会话保存到了正确的分组（第三层）
    console.log('\n=== 步骤3: 验证会话的 groupId ===')
    
    const verificationResult = await page.evaluate(async (expectedGroupId) => {
      const sessions = await window.api.session.getAll()
      const session = sessions.find(s => s.name === 'UITest-路径1-第三层会话')
      
      if (!session) {
        return { success: false, error: '未找到刚创建的会话' }
      }
      
      return {
        success: true,
        sessionName: session.name,
        actualGroupId: session.groupId,
        expectedGroupId: expectedGroupId,
        isCorrectGroup: session.groupId === expectedGroupId,
        message: `groupId (${session.groupId}) == 期望值 (${expectedGroupId}) ? ${session.groupId === expectedGroupId}`
      }
    }, groupIds.level3.id)
    
    console.log('\n验证结果:')
    console.log(JSON.stringify(verificationResult, null, 2))
    
    // 断言：会话必须保存在第三层分组
    expect(verificationResult.success).toBe(true)
    expect(verificationResult.isCorrectGroup).toBe(true)
    
    if (!verificationResult.isCorrectGroup) {
      throw new Error(`❌ BUG！会话错误地保存到了其他分组！实际 groupId: ${verificationResult.actualGroupId}`)
    }
    
    console.log(`\n🎉 路径1测试通过！会话正确地保存在第三层分组中`)
    
    // 清理测试数据
    console.log('\n=== 清理测试数据 ===')
    await cleanupTestData()
  })

  test('路径2: 通过 SessionItem 右键菜单"添加会话"在第三层分组创建会话', async () => {
    console.log('\n========== 测试路径2: SessionItem 右键菜单添加会话 ==========')

    // 步骤 1: 准备测试数据
    console.log('\n=== 步骤1: 准备测试数据和种子会话 ===')
    await cleanupTestData()
    
    // 通过 API 创建三层嵌套分组
    const groupIds = await createThreeLevelGroups()
    console.log(`✓ 创建了三层分组: ${groupIds.level1.name} → ${groupIds.level2.name} → ${groupIds.level3.name}`)
    
    // 在第三层分组中创建一个种子会话（通过 API）
    await page.evaluate(async (params) => {
      await window.api.session.create({
        name: 'UITest-种子会话',
        host: params.host,
        port: params.port,
        username: params.username,
        password: params.password,
        authType: 'password',
        groupId: params.targetGroupId
      })
    }, {
      host: testConfig.ssh.host,
      port: testConfig.ssh.port,
      username: testConfig.ssh.username,
      password: testConfig.ssh.password,
      targetGroupId: groupIds.level3.id
    })
    console.log('✓ 在第三层分组创建了种子会话')
    
    // 刷新页面以显示新创建的数据
    await refreshAndWait()

    // 展开所有分组以显示种子会话
    await expandGroupByName(groupIds.level1.name)
    await expandGroupByName(groupIds.level2.name)
    await expandGroupByName(groupIds.level3.name)
    await page.waitForTimeout(500)

    // 验证种子会话在第三层分组中可见
    const seedSessionItem = page.locator('.session-item').filter({ hasText: 'UITest-种子会话' })
    await expect(seedSessionItem).toBeVisible({ timeout: 5000 })
    console.log('✅ 种子会话在第三层分组中可见')

    // 步骤 2: 右键点击种子会话，选择"添加会话"
    console.log('\n=== 步骤2: 右键点击种子会话并选择"添加会话" ===')
    
    await seedSessionItem.click({ button: 'right' })
    await page.waitForTimeout(300)
    console.log('✓ 右键点击了种子会话')
    
    // 等待右键菜单出现
    const contextMenu = page.locator('.context-menu:visible').first()
    await expect(contextMenu).toBeVisible({ timeout: 2000 })
    console.log('✅ 右键菜单出现')
    
    // 点击"添加会话"菜单项
    const addSessionMenuItem = contextMenu.locator('.menu-item').filter({ hasText: '添加会话' })
    await expect(addSessionMenuItem).toBeVisible({ timeout: 2000 })
    await addSessionMenuItem.click()
    await page.waitForTimeout(500)
    console.log('✓ 点击了"添加会话"菜单项')

    // 等待会话表单出现（Home.vue 内的 SessionForm）
    const sessionForm = page.locator('.session-form')
    await expect(sessionForm).toBeVisible({ timeout: 5000 })
    console.log('✅ 会话表单已打开')

    // 填写会话信息
    const nameInput = sessionForm.locator('#name')
    const hostInput = sessionForm.locator('#host')
    const portInput = sessionForm.locator('#port')
    const usernameInput = sessionForm.locator('#username')
    const passwordInput = sessionForm.locator('#password')
    
    await nameInput.fill('UITest-路径2-第三层会话')
    await hostInput.fill(testConfig.ssh.host)
    await portInput.fill(String(testConfig.ssh.port))
    await usernameInput.fill(testConfig.ssh.username)
    await passwordInput.fill(testConfig.ssh.password)
    console.log('✓ 填写了会话信息')
    
    // 提交表单
    const saveBtn = sessionForm.locator('.btn.submit')
    await saveBtn.click()
    await page.waitForTimeout(1000)
    console.log('✓ 提交了会话表单')
    
    // 步骤 3: 验证会话保存到了正确的分组（第三层）
    console.log('\n=== 步骤3: 验证会话的 groupId ===')
    
    const verificationResult = await page.evaluate(async (expectedGroupId) => {
      const sessions = await window.api.session.getAll()
      const session = sessions.find(s => s.name === 'UITest-路径2-第三层会话')
      
      if (!session) {
        return { success: false, error: '未找到刚创建的会话' }
      }
      
      return {
        success: true,
        sessionName: session.name,
        actualGroupId: session.groupId,
        expectedGroupId: expectedGroupId,
        isCorrectGroup: session.groupId === expectedGroupId,
        message: `groupId (${session.groupId}) == 期望值 (${expectedGroupId}) ? ${session.groupId === expectedGroupId}`
      }
    }, groupIds.level3.id)
    
    console.log('\n验证结果:')
    console.log(JSON.stringify(verificationResult, null, 2))
    
    // 断言：会话必须保存在第三层分组
    expect(verificationResult.success).toBe(true)
    expect(verificationResult.isCorrectGroup).toBe(true)
    
    if (!verificationResult.isCorrectGroup) {
      throw new Error(`❌ BUG！会话错误地保存到了其他分组！实际 groupId: ${verificationResult.actualGroupId}`)
    }
    
    console.log(`\n🎉 路径2测试通过！会话正确地保存在第三层分组中`)
    
    // 清理测试数据
    console.log('\n=== 清理测试数据 ===')
    await cleanupTestData()
  })
})
