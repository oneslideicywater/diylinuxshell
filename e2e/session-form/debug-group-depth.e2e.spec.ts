/**
 * 调试：检查分组数据的 depth 属性
 * 
 * 运行方式：npx playwright test debug-group-depth.e2e.spec.ts --project=electron
 */

import { test, expect, ElectronApplication } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: any

test.describe('Debug Group Depth - 调试分组深度', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('创建五层分组并检查 depth 属性', async () => {
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
    
    // 检查分组数据
    console.log('=== 检查分组数据 ===')
    
    // 通过 IPC 获取分组数据
    const groups = await page.evaluate(async () => {
      if (window.api && window.api.sessionGroup) {
        return await window.api.sessionGroup.getAll()
      }
      return []
    })
    
    console.log('分组数据:')
    groups.forEach((group: any, index: number) => {
      console.log(`${index + 1}. ${group.name} - depth: ${group.depth}, parentId: ${group.parentId || 'null'}`)
    })
    
    // 验证 depth 属性
    expect(groups.length).toBe(5)
    expect(groups[0].name).toBe('第一层分组')
    expect(groups[0].depth).toBe(1)
    expect(groups[0].parentId).toBeUndefined()
    
    expect(groups[1].name).toBe('第二层分组')
    expect(groups[1].depth).toBe(2)
    expect(groups[1].parentId).toBe(groups[0].id)
    
    expect(groups[2].name).toBe('第三层分组')
    expect(groups[2].depth).toBe(3)
    expect(groups[2].parentId).toBe(groups[1].id)
    
    expect(groups[3].name).toBe('第四层分组')
    expect(groups[3].depth).toBe(4)
    expect(groups[3].parentId).toBe(groups[2].id)
    
    expect(groups[4].name).toBe('第五层分组')
    expect(groups[4].depth).toBe(5)
    expect(groups[4].parentId).toBe(groups[3].id)
    
    console.log('✅ 所有分组的 depth 属性正确！')
    
    // 打开会话表单，检查树形选择器
    console.log('=== 打开会话表单检查树形选择器 ===')
    await addBtn.click()
    await page.waitForTimeout(500)
    
    // 获取树形选择器中的分组显示
    const treeOptions = await page.locator('.group-tree-select .tree-option').all()
    console.log(`树形选择器中显示了 ${treeOptions.length} 个选项`)
    
    for (let i = 0; i < treeOptions.length; i++) {
      try {
        const text = await treeOptions[i].locator('.group-name').textContent()
        const paddingLeft = await treeOptions[i].evaluate((el) => 
          window.getComputedStyle(el).paddingLeft
        )
        console.log(`  ${i + 1}. ${text} - paddingLeft: ${paddingLeft}`)
      } catch (e) {
        console.log(`  ${i + 1}. 无法获取文本 - 错误：${e}`)
      }
    }
  })
})

/**
 * 从列表空白区域创建分组
 */
async function createGroupFromList(groupName: string) {
  console.log(`创建根分组：${groupName}`)
  
  const spacer = page.locator('.session-list-spacer')
  await expect(spacer).toBeVisible({ timeout: 10000 })
  console.log('  右键点击空白区域...')
  await spacer.click({ button: 'right' })
  await page.waitForTimeout(200)
  
  // 查找右键菜单中的"新建分组"菜单项
  const menuItems = page.locator('.context-menu .menu-item')
  const itemCount = await menuItems.count()
  console.log(`  菜单项数量：${itemCount}`)
  
  // 查找包含"新建分组"文本的菜单项
  let newGroupMenuItem = null
  for (let i = 0; i < itemCount; i++) {
    const item = menuItems.nth(i)
    const text = await item.textContent()
    console.log(`    菜单项 ${i}: ${text}`)
    if (text && text.includes('新建分组')) {
      newGroupMenuItem = item
      break
    }
  }
  
  if (!newGroupMenuItem) {
    throw new Error('未找到"新建分组"菜单项')
  }
  
  console.log('  点击"新建分组"菜单项...')
  await newGroupMenuItem.click()
  
  await page.waitForTimeout(300)
  
  const groupForm = page.locator('.group-form')
  await expect(groupForm).toBeVisible()
  
  const nameInput = groupForm.locator('#groupName')
  console.log(`  填写分组名称：${groupName}`)
  await nameInput.fill(groupName)
  
  const submitBtn = groupForm.locator('button[type="submit"]')
  console.log('  提交表单...')
  await submitBtn.click()
  
  await page.waitForTimeout(500)
  console.log(`  ✅ 根分组 "${groupName}" 创建完成`)
}

/**
 * 在指定分组下创建子分组
 */
async function createSubGroup(parentGroupName: string, subGroupName: string) {
  console.log(`  在 "${parentGroupName}" 下创建子分组 "${subGroupName}"`)
  
  // 直接查找包含指定分组名称的 group-header 元素
  const groupHeader = page.locator('.group-header').filter({ hasText: parentGroupName }).first()
  await expect(groupHeader).toBeVisible({ timeout: 10000 })
  
  // 检查分组是否展开，如果未展开则点击展开
  const isExpanded = await groupHeader.evaluate((el) => {
    const svg = el.parentElement?.querySelector('.expand-icon')
    return svg?.classList.contains('expanded')
  })
  
  if (!isExpanded) {
    console.log('  分组未展开，点击展开...')
    await groupHeader.click()
    await page.waitForTimeout(300)
  }
  
  // 右键点击分组头部
  console.log('  右键点击分组头部...')
  await groupHeader.click({ button: 'right' })
  await page.waitForTimeout(200)
  
  // 查找右键菜单中的"新建子分组"菜单项
  const menuItems = page.locator('.context-menu .menu-item')
  const itemCount = await menuItems.count()
  console.log(`  菜单项数量：${itemCount}`)
  
  // 查找包含"新建子分组"文本的菜单项
  let subGroupMenuItem = null
  for (let i = 0; i < itemCount; i++) {
    const item = menuItems.nth(i)
    const text = await item.textContent()
    console.log(`    菜单项 ${i}: ${text}`)
    if (text && text.includes('新建子分组')) {
      subGroupMenuItem = item
      break
    }
  }
  
  if (!subGroupMenuItem) {
    throw new Error(`未找到"新建子分组"菜单项，父分组：${parentGroupName}`)
  }
  
  console.log('  点击"新建子分组"菜单项...')
  await subGroupMenuItem.click()
  
  await page.waitForTimeout(300)
  
  const groupForm = page.locator('.group-form')
  await expect(groupForm).toBeVisible()
  
  const nameInput = groupForm.locator('#groupName')
  console.log(`  填写分组名称：${subGroupName}`)
  await nameInput.fill(subGroupName)
  
  const submitBtn = groupForm.locator('button[type="submit"]')
  console.log('  提交表单...')
  await submitBtn.click()
  
  await page.waitForTimeout(500)
  console.log(`  ✅ 子分组 "${subGroupName}" 创建完成`)
}
