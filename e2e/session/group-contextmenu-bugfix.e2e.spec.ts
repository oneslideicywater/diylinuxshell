/**
 * 分组右键菜单 Bug 修复验证测试
 * 验证：
 * 1. Bug 1: 新建子分组在正确的父分组下创建（而不是永远在第一级）
 * 2. Bug 2: 右键菜单在 GroupHeader 组件中正确显示和操作
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'
import { testConfig } from '../config/test-config'

let electronApp: ElectronApplication
let page: Page

test.describe('分组右键菜单 Bug 修复验证', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('Bug 1 修复验证：在子分组上右键新建子分组，应该在子分组下创建（而非第一级）', async () => {
    // 等待会话列表加载
    await page.waitForSelector('.session-list', { timeout: 10000 })
    
    // 清理所有现有数据（保留默认分组）
    console.log('\n=== 清理现有数据 ===')
    await page.evaluate(async () => {
      const sessions = await window.api.session.getAll()
      for (const session of sessions) {
        try {
          await window.api.session.delete(session.id)
        } catch (error) {
          console.warn(`删除会话失败: ${session.name}`, error)
        }
      }
      
      const groups = await window.api.sessionGroup.getAll()
      for (const group of groups) {
        if (group.name !== '默认分组') {
          try {
            await window.api.sessionGroup.delete(group.id)
          } catch (error) {
            console.warn(`删除分组失败: ${group.name}`, error)
          }
        }
      }
    })
    
    console.log('✅ 清理完成')
    
    // ========== 步骤1: 创建顶级分组 A ==========
    console.log('\n=== 步骤1: 创建顶级分组 A 和子分组 B ===')
    // 分组 ID 已存储到 window 对象，供后续测试使用
    
    await page.evaluate(async () => {
      // 创建顶级分组 A（无父分组）
      const groupA = await window.api.sessionGroup.create({
        name: 'Bug修复-顶级分组A',
        order: Date.now()
      })
      console.log(`✓ 创建顶级分组A: ${groupA.name} (id: ${groupA.id}, depth: ${groupA.depth})`)
      
      // 将 ID 存储到 window 对象以便后续使用
      ;(window as any).__test_groupA_id = groupA.id
      
      // 在 A 下创建子分组 B（使用正确的 API 调用方式：第二个参数是 parentId）
      const groupB = await window.api.sessionGroup.create(
        { name: 'Bug修复-子分组B', order: Date.now() },
        groupA.id  // ✅ 第二个参数：parentId
      )
      console.log(`✓ 在 A 下创建子分组B: ${groupB.name} (parentId: ${groupB.parentId}, depth: ${groupB.depth})`)
      
      ;(window as any).__test_groupB_id = groupB.id
    })

    // 获取存储的 ID（调试日志用，void 标记有意忽略）
    void (await page.evaluate(() => (window as any).__test_groupA_id))
    void (await page.evaluate(() => (window as any).__test_groupB_id))
    
    await page.waitForTimeout(500)
    
    // ========== 步骤2: 右键点击子分组 B，新建子分组 C ==========
    console.log('\n=== 步骤2: 右键点击子分组 B，新建子分组 C ===')
    
    // 找到子分组 B 的 GroupHeader
    const groupBHeader = page.locator('.group-header').filter({ hasText: 'Bug修复-子分组B' })
    await expect(groupBHeader).toBeVisible({ timeout: 5000 })
    console.log('✅ 找到子分组 B 的 GroupHeader')
    
    // 右键点击子分组 B
    await groupBHeader.click({ button: 'right' })
    await page.waitForTimeout(300)
    
    // 验证右键菜单出现
    const contextMenu = page.locator('.context-menu').first()
    await expect(contextMenu).toBeVisible({ timeout: 2000 })
    console.log('✅ 右键菜单出现')
    
    // 点击"新建子分组"菜单项
    const createSubGroupMenuItem = contextMenu.locator('.menu-item').filter({ hasText: '新建子分组' })
    await expect(createSubGroupMenuItem).toBeVisible({ timeout: 2000 })
    await createSubGroupMenuItem.click()
    await page.waitForTimeout(300)
    console.log('✓ 点击"新建子分组"菜单项')
    
    // 填写表单，创建子分组 C
    const groupForm = page.locator('.group-form')
    await expect(groupForm).toBeVisible({ timeout: 5000 })
    
    const nameInput = groupForm.locator('#groupName')
    await nameInput.fill('Bug修复-孙分组C')
    
    const submitBtn = groupForm.locator('button[type="submit"]')
    await submitBtn.click()
    await page.waitForTimeout(500)
    console.log('✓ 填写表单并提交，创建子分组 C')
    
    // ========== 步骤3: 验证子分组 C 的父分组是 B（而非 A）==========
    console.log('\n=== 步骤3: 验证子分组 C 的父分组 ===')
    
    const verificationResult = await page.evaluate(async () => {
      const groups = await window.api.sessionGroup.getAll()
      
      const groupC = groups.find(g => g.name === 'Bug修复-孙分组C')
      if (!groupC) {
        return { success: false, error: '未找到子分组 C' }
      }
      
      const groupB = groups.find(g => g.name === 'Bug修复-子分组B')
      if (!groupB) {
        return { success: false, error: '未找到父分组 B' }
      }
      
      return {
        success: true,
        groupC: {
          id: groupC.id,
          name: groupC.name,
          parentId: groupC.parentId,
          depth: groupC.depth
        },
        expectedParentId: groupB.id,
        actualParentId: groupC.parentId,
        isCorrectParent: groupC.parentId === groupB.id,
        message: `子分组 C 的 parentId (${groupC.parentId}) == 父分组 B 的 id (${groupB.id}) ? ${groupC.parentId === groupB.id}`
      }
    })
    
    console.log('验证结果:', JSON.stringify(verificationResult, null, 2))
    
    expect(verificationResult.success).toBe(true)
    expect(verificationResult.isCorrectParent).toBe(true)
    console.log(`✅ Bug 1 已修复！子分组 C 正确地创建在子分组 B 下（parentId: ${verificationResult.actualParentId}）`)
    
    // ========== 步骤4: 验证层级深度也正确 ==========
    expect(verificationResult.groupC.depth).toBe(3)  // B 是 depth=2, C 应该是 depth=3
    console.log(`✅ 层级深度也正确: 子分组 C 的 depth = ${verificationResult.groupC.depth}`)
    
    // ========== 清理测试数据 ==========
    console.log('\n=== 清理测试数据 ===')
    await page.evaluate(async () => {
      const groups = await window.api.sessionGroup.getAll()
      for (const group of groups) {
        if (group.name.startsWith('Bug修复')) {
          try {
            await window.api.sessionGroup.delete(group.id)
            console.log(`✓ 删除测试分组: ${group.name}`)
          } catch (error) {
            console.warn(`删除失败: ${group.name}`, error)
          }
        }
      }
    })
    
    console.log('\n🎉 Bug 1 修复验证通过！新建子分组现在会在正确的父分组下创建。')
  })

  test('Bug 2 验证：右键菜单在 GroupHeader 组件中正确显示', async () => {
    // 等待会话列表加载
    await page.waitForSelector('.session-list', { timeout: 10000 })
    
    // 创建一个测试分组
    console.log('\n=== 创建测试分组 ===')
    await page.evaluate(async () => {
      await window.api.sessionGroup.create({
        name: 'MenuTest-测试分组',
        order: Date.now()
      })
    })
    
    await page.waitForTimeout(500)
    
    // 找到分组的 GroupHeader
    const groupHeader = page.locator('.group-header').filter({ hasText: 'MenuTest-测试分组' })
    await expect(groupHeader).toBeVisible({ timeout: 5000 })
    
    // 右键点击
    await groupHeader.click({ button: 'right' })
    await page.waitForTimeout(300)
    
    // 验证右键菜单在 GroupHeader 组件内部显示
    const headerWrapper = page.locator('.group-header-wrapper').first()
    const contextMenu = headerWrapper.locator('.context-menu')
    await expect(contextMenu).toBeVisible({ timeout: 2000 })
    console.log('✅ 右键菜单在 .group-header-wrapper 内部显示')
    
    // 验证菜单包含正确的项目
    const menuItems = contextMenu.locator('.menu-item')
    const itemCount = await menuItems.count()
    console.log(`菜单项目数量: ${itemCount}`)
    
    expect(itemCount).toBeGreaterThanOrEqual(5)  // 至少有5个基本菜单项
    
    // 验证特定菜单项存在
    const addSessionItem = menuItems.filter({ hasText: '添加会话' })
    await expect(addSessionItem).toHaveCount(1)
    console.log('✅ "添加会话" 菜单项存在')
    
    const createSubGroupItem = menuItems.filter({ hasText: '新建子分组' })
    await expect(createSubGroupItem).toHaveCount(1)
    console.log('✅ "新建子分组" 菜单项存在')
    
    const editGroupItem = menuItems.filter({ hasText: '编辑分组' })
    await expect(editGroupItem).toHaveCount(1)
    console.log('✅ "编辑分组" 菜单项存在')
    
    const deleteGroupItem = menuItems.filter({ hasText: '删除分组' })
    await expect(deleteGroupItem).toHaveCount(1)
    console.log('✅ "删除分组" 菜单项存在')
    
    // 点击外部关闭菜单
    await page.mouse.click(10, 10)
    await page.waitForTimeout(200)
    await expect(contextMenu).not.toBeVisible()
    console.log('✅ 点击外部可关闭菜单')
    
    // 清理测试数据
    console.log('\n=== 清理测试数据 ===')
    await page.evaluate(async () => {
      const groups = await window.api.sessionGroup.getAll()
      for (const group of groups) {
        if (group.name.startsWith('MenuTest')) {
          try {
            await window.api.sessionGroup.delete(group.id)
          } catch (error) {
            console.warn('删除失败:', error)
          }
        }
      }
    })
    
    console.log('\n🎉 Bug 2 验证通过！右键菜单正确地在 GroupHeader 组件中显示。')
  })
})

/**
 * 辅助函数：创建子分组（通过 UI 操作）
 */
async function createSubGroup(parentGroupName: string, subGroupName: string) {
  // 找到父分组的 GroupHeader
  const parentHeader = page.locator('.group-header').filter({ hasText: parentGroupName })
  
  if (!(await parentHeader.isVisible())) {
    console.warn(`⚠ 未找到父分组: ${parentGroupName}`)
    return
  }
  
  // 右键点击父分组
  await parentHeader.click({ button: 'right' })
  await page.waitForTimeout(300)
  
  // 点击"新建子分组"
  const contextMenu = page.locator('.context-menu').first()
  const createSubGroupMenuItem = contextMenu.locator('.menu-item').filter({ hasText: '新建子分组' })
  
  if (!(await createSubGroupMenuItem.isVisible())) {
    console.warn(`⚠ 未找到"新建子分组"菜单项，可能已达到层级限制`)
    await page.mouse.click(10, 10)  // 关闭菜单
    return
  }
  
  await createSubGroupMenuItem.click()
  await page.waitForTimeout(300)
  
  // 填写表单
  const groupForm = page.locator('.group-form')
  await expect(groupForm).toBeVisible({ timeout: 5000 })
  
  const nameInput = groupForm.locator('#groupName')
  await nameInput.fill(subGroupName)
  
  const submitBtn = groupForm.locator('button[type="submit"]')
  await submitBtn.click()
  await page.waitForTimeout(500)
  
  console.log(`✓ 在 [${parentGroupName}] 下创建子分组: ${subGroupName}`)
}
