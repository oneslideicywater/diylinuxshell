/**
 * 调试：检查树形选择器的显示内容
 * 
 * 运行方式：npx playwright test debug-tree-select-display.e2e.spec.ts --project=electron
 */

import { test, expect, ElectronApplication } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: any

test.describe('Debug Tree Select Display - 调试树形选择器显示', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('创建五层分组并检查树形选择器显示', async () => {
    // 设置更长的超时
    test.setTimeout(120000)
    
    // 捕获控制台消息
    const consoleMessages: any[] = []
    page.on('console', msg => {
      const text = msg.text()
      if (text.includes('GroupTreeSelect')) {
        consoleMessages.push({
          type: msg.type(),
          text: text
        })
      }
    })
    
    console.log('=== 清空现有数据 ===')
    
    // 通过 IPC 清空所有分组和会话
    await page.evaluate(async () => {
      if (window.api && window.api.sessionGroup) {
        const groups = await window.api.sessionGroup.getAll()
        for (const group of groups) {
          await window.api.sessionGroup.delete(group.id)
        }
      }
      
      if (window.api && window.api.session) {
        const sessions = await window.api.session.getAll()
        for (const session of sessions) {
          await window.api.session.delete(session.id)
        }
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
    
    console.log('✅ 测试会话创建完成')
    
    // 创建五层嵌套分组
    console.log('=== 创建五层嵌套分组 ===')
    await createGroupFromList('第一层分组')
    await createSubGroup('第一层分组', '第二层分组')
    await createSubGroup('第二层分组', '第三层分组')
    await createSubGroup('第三层分组', '第四层分组')
    await createSubGroup('第四层分组', '第五层分组')
    
    console.log('✅ 五层嵌套分组创建完成')
    
    // 获取所有分组数据
    const groups = await page.evaluate(async () => {
      if (window.api && window.api.sessionGroup) {
        return await window.api.sessionGroup.getAll()
      }
      return []
    })
    
    console.log('\n=== 分组数据 ===')
    groups.forEach((group: any, index: number) => {
      console.log(`${index + 1}. ${group.name} - depth: ${group.depth}, parentId: ${group.parentId || 'null'}, id: ${group.id}`)
    })
    
    // 检查是否有重复的分组 ID
    const ids = groups.map((g: any) => g.id)
    const uniqueIds = new Set(ids)
    if (ids.length !== uniqueIds.size) {
      console.error('❌ 检测到重复的分组 ID!')
      const duplicates = ids.filter((id: string, index: number) => ids.indexOf(id) !== index)
      console.error('重复的 ID:', duplicates)
    } else {
      console.log('✅ 没有重复的分组 ID')
    }
    
    // 检查根分组数量
    const rootGroups = groups.filter((g: any) => !g.parentId || g.parentId === '')
    console.log(`根分组数量：${rootGroups.length}`)
    rootGroups.forEach((g: any) => {
      console.log(`  - ${g.name} (id: ${g.id})`)
    })
    
    // 打开会话编辑界面
    console.log('\n=== 打开会话编辑界面 ===')
    const sessionItem = page.locator('.session-item').first()
    await sessionItem.click({ button: 'right' })
    await page.waitForTimeout(300)
    
    const editMenuItem = page.locator('.context-menu .menu-item').filter({ hasText: '编辑' }).first()
    await editMenuItem.click()
    await page.waitForTimeout(1000)
    
    // 检查树形选择器初始状态
    console.log('=== 检查树形选择器初始状态 ===')
    
    // 检查有多少个 group-tree-select 容器
    const containerCount = await page.evaluate(() => {
      const containers = document.querySelectorAll('.group-tree-select')
      return containers.length
    })
    console.log(`group-tree-select 容器数量：${containerCount}`)
    
    const initialOptions = await page.evaluate(() => {
      const options = document.querySelectorAll('.group-tree-select .tree-option')
      return Array.from(options).map((el, index) => {
        const groupName = el.querySelector('.group-name')
        return {
          index: index + 1,
          text: groupName?.textContent || 'N/A',
          paddingLeft: window.getComputedStyle(el).paddingLeft,
          active: el.classList.contains('active')
        }
      })
    })
    
    console.log(`\n初始状态，树形选择器中显示了 ${initialOptions.length} 个选项`)
    initialOptions.forEach((opt: any) => {
      console.log(`  ${opt.index}. "${opt.text}" - paddingLeft: ${opt.paddingLeft}, active: ${opt.active}`)
    })
    
    // 手动点击展开第一层分组
    console.log('\n=== 点击展开第一层分组 ===')
    const firstLevelExpandIcon = page.locator('.group-tree-select .tree-option').filter({ hasText: '第一层分组' }).locator('.expand-icon').first()
    await firstLevelExpandIcon.click()
    await page.waitForTimeout(1000)
    
    // 检查展开后的选项
    const expandedOptions = await page.evaluate(() => {
      const options = document.querySelectorAll('.group-tree-select .tree-option')
      return Array.from(options).map((el, index) => {
        const groupName = el.querySelector('.group-name')
        return {
          index: index + 1,
          text: groupName?.textContent || 'N/A',
          paddingLeft: window.getComputedStyle(el).paddingLeft,
          active: el.classList.contains('active')
        }
      })
    })
    
    console.log(`\n展开第一层分组后，显示了 ${expandedOptions.length} 个选项`)
    expandedOptions.forEach((opt: any) => {
      console.log(`  ${opt.index}. "${opt.text}" - paddingLeft: ${opt.paddingLeft}, active: ${opt.active}`)
    })
    
    // 验证是否只显示了子分组
    const hasSecondLevel = expandedOptions.some((opt: any) => opt.text === '第二层分组')
    const hasThirdLevel = expandedOptions.some((opt: any) => opt.text === '第三层分组')
    const naCount = expandedOptions.filter((opt: any) => opt.text === 'N/A').length
    
    console.log('\n=== 验证展开内容 ===')
    console.log(`是否包含"第二层分组": ${hasSecondLevel}`)
    console.log(`是否包含"第三层分组": ${hasThirdLevel}`)
    console.log(`"N/A"选项数量：${naCount}（期望：1）`)
    
    if (hasSecondLevel && !hasThirdLevel && naCount === 1) {
      console.log('✅ 展开内容完全正确：只显示了直接子分组，且"未分组"只出现一次')
    } else if (hasSecondLevel && hasThirdLevel) {
      console.log('❌ 展开内容错误：显示了所有后代分组，而不仅仅是直接子分组')
    } else if (naCount > 1) {
      console.log('❌ 展开内容错误："未分组"选项重复显示')
    } else {
      console.log('❌ 展开内容错误：没有显示子分组')
    }
    
    console.log('\n✅ 测试完成！')
    
    // 打印捕获的控制台消息（如果有的话）
    console.log('\n=== GroupTreeSelect 组件日志 ===')
    if (typeof consoleMessages !== 'undefined') {
      consoleMessages.forEach(msg => {
        console.log(`  [${msg.type}] ${msg.text}`)
      })
    } else {
      console.log('  无日志消息')
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
  
  // 首先点击展开所有分组，确保能看到目标父分组
  const groupHeaders = page.locator('.group-header')
  const count = await groupHeaders.count()
  for (let i = 0; i < count; i++) {
    const header = groupHeaders.nth(i)
    const expandIcon = header.locator('.expand-icon').first()
    const isExpanded = await expandIcon.evaluate((el) => el.classList.contains('expanded'))
    if (!isExpanded) {
      await expandIcon.click()
    }
  }
  await page.waitForTimeout(300)
  
  // 查找包含指定分组名称的 group-header 元素
  const groupHeader = page.locator('.group-header').filter({ hasText: parentGroupName }).first()
  await expect(groupHeader).toBeVisible({ timeout: 10000 })
  
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
