/**
 * 清空测试数据并创建五层嵌套分组
 * 
 * 运行方式：npx playwright test clear-and-create.e2e.spec.ts --project=electron
 */

import { test, expect, ElectronApplication } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: any

test.describe('Clear and Create - 清空数据并创建五层嵌套分组', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('清空数据并创建五层嵌套分组', async () => {
    console.log('=== 清空现有数据 ===')
    
    // 清空所有会话和分组
    await page.evaluate(() => {
      const sessionStore = (window as any).api?.store
      if (sessionStore) {
        sessionStore.sessions = []
        sessionStore.sessionGroups = []
      }
    })
    await page.waitForTimeout(500)
    
    // 创建一个测试会话
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
    
    console.log('✅ 测试会话创建完成')
    
    // 创建五层嵌套分组
    console.log('=== 创建五层嵌套分组 ===')
    await createGroupFromList('第一层分组')
    await createSubGroup('第一层分组', '第二层分组')
    await createSubGroup('第二层分组', '第三层分组')
    await createSubGroup('第三层分组', '第四层分组')
    await createSubGroup('第四层分组', '第五层分组')
    
    console.log('✅ 五层嵌套分组创建完成')
    
    // 验证分组显示
    console.log('=== 验证分组显示 ===')
    const firstLevel = page.getByText('第一层分组').first()
    await expect(firstLevel).toBeVisible()
    console.log('✓ 第一层分组可见')
    
    const secondLevel = page.getByText('第二层分组').first()
    await expect(secondLevel).toBeVisible()
    console.log('✓ 第二层分组可见')
    
    const thirdLevel = page.getByText('第三层分组').first()
    await expect(thirdLevel).toBeVisible()
    console.log('✓ 第三层分组可见')
    
    const fourthLevel = page.getByText('第四层分组').first()
    await expect(fourthLevel).toBeVisible()
    console.log('✓ 第四层分组可见')
    
    const fifthLevel = page.getByText('第五层分组').first()
    await expect(fifthLevel).toBeVisible()
    console.log('✓ 第五层分组可见')
    
    console.log('✅ 所有分组都正确显示！')
    
    // 保持应用打开，让用户查看
    await page.waitForTimeout(2000)
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
