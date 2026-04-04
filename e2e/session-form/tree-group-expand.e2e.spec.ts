/**
 * 树形分组选择器展开功能测试
 * 
 * 测试目的：
 * 1. 创建多层嵌套分组
 * 2. 打开会话表单
 * 3. 验证点击第一层子分组能够展开它的子分组
 * 4. 验证能够看到所有层级的分组
 * 
 * 运行方式：npx playwright test tree-group-expand.e2e.spec.ts --project=electron
 */

import { test, expect, ElectronApplication } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: any

test.describe('Tree Group Expand - 树形分组选择器展开功能', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
    
    // 清理现有数据
    console.log('=== 清理现有数据 ===')
    await page.evaluate(() => {
      const sessionStore = (window as any).api?.store
      if (sessionStore) {
        // 清空所有会话和分组
        sessionStore.sessions = []
        sessionStore.sessionGroups = []
      }
    })
    await page.waitForTimeout(500)
    
    // 创建测试会话
    console.log('创建测试会话...')
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)
    
    const sessionForm = page.locator('.session-form')
    await sessionForm.locator('#name').fill('测试会话')
    await sessionForm.locator('#host').fill('192.168.1.100')
    await sessionForm.locator('#port').fill('22')
    await sessionForm.locator('#username').fill('root')
    await sessionForm.locator('#password').fill('password123')
    
    const submitBtn = sessionForm.locator('button[type="submit"]')
    await submitBtn.click()
    await page.waitForTimeout(500)
    
    // 创建五层嵌套分组
    console.log('=== 创建五层嵌套分组 ===')
    await createGroupFromList('第一层分组')
    await createSubGroup('第一层分组', '第二层分组')
    await createSubGroup('第二层分组', '第三层分组')
    await createSubGroup('第三层分组', '第四层分组')
    await createSubGroup('第四层分组', '第五层分组')
    
    console.log('✅ 五层嵌套分组创建完成')
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('验证树形选择器能够展开所有层级', async () => {
    console.log('=== 开始测试：树形选择器展开功能 ===')
    
    // 打开新建会话表单
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)
    
    const sessionForm = page.locator('.session-form')
    await expect(sessionForm).toBeVisible()
    console.log('✓ 会话表单已显示')
    
    // 检查树形选择器容器
    const treeContainer = sessionForm.locator('.group-tree-container')
    await expect(treeContainer).toBeVisible()
    console.log('✓ 树形选择器容器可见')
    
    // 查找"第一层分组"
    const firstLevelGroup = sessionForm.getByText('第一层分组').first()
    await expect(firstLevelGroup).toBeVisible()
    console.log('✓ 第一层分组可见')
    
    // 点击第一层分组本身来选中它（会触发展开）
    await firstLevelGroup.click()
    await page.waitForTimeout(800)
    console.log('✓ 点击第一层分组')
    
    // 验证第二层分组是否可见
    const secondLevelGroup = sessionForm.getByText('第二层分组').first()
    await expect(secondLevelGroup).toBeVisible({ timeout: 5000 })
    console.log('✓ 第二层分组可见')
    
    // 点击第二层分组
    await secondLevelGroup.click()
    await page.waitForTimeout(800)
    console.log('✓ 点击第二层分组')
    
    // 验证第三层分组是否可见
    const thirdLevelGroup = sessionForm.getByText('第三层分组').first()
    await expect(thirdLevelGroup).toBeVisible({ timeout: 5000 })
    console.log('✓ 第三层分组可见')
    
    // 点击第三层分组
    await thirdLevelGroup.click()
    await page.waitForTimeout(800)
    console.log('✓ 点击第三层分组')
    
    // 验证第四层分组是否可见
    const fourthLevelGroup = sessionForm.getByText('第四层分组').first()
    await expect(fourthLevelGroup).toBeVisible({ timeout: 5000 })
    console.log('✓ 第四层分组可见')
    
    // 点击第四层分组
    await fourthLevelGroup.click()
    await page.waitForTimeout(800)
    console.log('✓ 点击第四层分组')
    
    // 验证第五层分组是否可见
    const fifthLevelGroup = sessionForm.getByText('第五层分组').first()
    await expect(fifthLevelGroup).toBeVisible({ timeout: 5000 })
    console.log('✓ 第五层分组可见')
    
    // 关闭表单
    const closeButton = sessionForm.locator('.close-btn')
    await closeButton.click()
    await page.waitForTimeout(300)
    
    console.log('✅ 测试通过：树形选择器能够正确展开所有层级！')
  })
})

/**
 * 从列表空白区域创建分组
 */
async function createGroupFromList(groupName: string) {
  const spacer = page.locator('.session-list-spacer')
  await expect(spacer).toBeVisible({ timeout: 10000 })
  await spacer.click({ button: 'right' })
  
  const contextMenu = page.locator('.context-menu').filter({ hasText: '新建分组' })
  await expect(contextMenu).toBeVisible()
  await contextMenu.click()
  
  await page.waitForTimeout(300)
  
  const groupForm = page.locator('.group-form')
  await expect(groupForm).toBeVisible()
  
  const nameInput = groupForm.locator('#groupName')
  await nameInput.fill(groupName)
  
  const submitBtn = groupForm.locator('button[type="submit"]')
  await submitBtn.click()
  
  await page.waitForTimeout(500)
}

/**
 * 在指定分组下创建子分组
 */
async function createSubGroup(parentGroupName: string, subGroupName: string) {
  // 直接查找包含指定分组名称的 group-header 元素
  const groupHeader = page.locator('.group-header').filter({ hasText: parentGroupName }).first()
  await expect(groupHeader).toBeVisible({ timeout: 10000 })
  
  // 右键点击分组头部
  await groupHeader.click({ button: 'right' })
  
  const contextMenu = page.locator('.context-menu').filter({ hasText: '新建子分组' })
  await expect(contextMenu).toBeVisible()
  await contextMenu.click()
  
  await page.waitForTimeout(300)
  
  const groupForm = page.locator('.group-form')
  await expect(groupForm).toBeVisible()
  
  const nameInput = groupForm.locator('#groupName')
  await nameInput.fill(subGroupName)
  
  const submitBtn = groupForm.locator('button[type="submit"]')
  await submitBtn.click()
  
  await page.waitForTimeout(500)
}
