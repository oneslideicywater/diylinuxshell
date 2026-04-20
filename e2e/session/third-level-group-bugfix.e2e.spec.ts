/**
 * 第三层分组创建会话 Bug 修复验证测试（UI 层面）
 * 
 * Bug 描述：
 * - 在第三层分组中创建会话时，会话被错误地保存到第一层或"默认分组"
 * 
 * 修复内容：
 * 1. SessionForm.vue: 将 `groupId: formData.value.groupId || undefined` 改为 `??`
 * 2. session.ts (主进程): 将 `if (!groupId)` 改为 `if (groupId === null || groupId === undefined)`
 * 
 * 测试路径：
 * 路径1: 通过 GroupHeader 右键菜单"添加会话" → handleAddSessionToGroup → editingSession.groupId = group.id → SessionForm(session prop)
 * 路径2: 通过 SessionItem 右键菜单"添加会话" → emit('add-session', groupId) → Home.handleAddSession(groupId) → defaultGroupId → SessionForm(defaultGroupId prop)
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'
import { testConfig } from '../config/test-config'

let electronApp: ElectronApplication
let page: Page

test.describe('第三层分组 Bug 修复验证（UI）', () => {
  test.beforeAll(async () => {
    console.log('\n========== 启动应用 ==========')
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
    console.log('✓ 应用启动完成')
  })

  test.afterAll(async () => {
    console.log('\n========== 关闭应用 ==========')
    await closeApp(electronApp)
  })

  /**
   * 清理测试数据
   */
  async function cleanupTestData(): Promise<void> {
    console.log('\n--- 清理测试数据 ---')
    await page.evaluate(async () => {
      // 删除测试会话
      const sessions = await window.api.session.getAll()
      for (const s of sessions) {
        if (s && s.name && s.name.startsWith('BugFixTest')) {
          try {
            await window.api.session.delete(s.id)
            console.log(`  删除会话: ${s.name}`)
          } catch (e) {
            console.warn(`  删除会话失败: ${s.name}`, e)
          }
        }
      }

      // 删除测试分组（保留"默认分组"）
      const groups = await window.api.sessionGroup.getAll()
      for (const g of groups) {
        if (g && g.name && g.name.startsWith('BugFixTest') && g.name !== '默认分组') {
          try {
            await window.api.sessionGroup.delete(g.id)
            console.log(`  删除分组: ${g.name}`)
          } catch (e) {
            console.warn(`  删除分组失败: ${g.name}`, e)
          }
        }
      }
    })
    await page.waitForTimeout(300)
  }

  /**
   * 通过 API 创建三层嵌套分组
   */
  async function createThreeLevelGroups(): Promise<{
    level1: { id: string; name: string }
    level2: { id: string; name: string }
    level3: { id: string; name: string }
  }> {
    return await page.evaluate(async () => {
      const group1 = await window.api.sessionGroup.create({ name: 'BugFixTest-层级1' })
      const group2 = await window.api.sessionGroup.create({ name: 'BugFixTest-层级2' }, group1.id)
      const group3 = await window.api.sessionGroup.create({ name: 'BugFixTest-层级3' }, group2.id)

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
    console.log('  刷新页面...')
    await page.reload()
    await waitForAppReady(page)
    await page.waitForTimeout(500)
    console.log('  ✓ 页面刷新完成')
  }

  /**
   * 展开指定名称的分组
   */
  async function expandGroupByName(groupName: string): Promise<void> {
    const groupHeader = page.locator('.group-header').filter({ hasText: groupName })
    await expect(groupHeader).toBeVisible({ timeout: 5000 })
    
    const expandIcon = groupHeader.locator('.expand-icon:not(.expanded)')
    if (await expandIcon.count() > 0) {
      await expandIcon.first().click()
      await page.waitForTimeout(300)
      console.log(`  ✓ 展开分组: ${groupName}`)
    } else {
      console.log(`  分组已展开: ${groupName}`)
    }
  }

  /**
   * 验证会话的 groupId 是否正确
   */
  async function verifySessionGroupId(
    sessionName: string,
    expectedGroupId: string,
    pathName: string
  ): Promise<boolean> {
    console.log(`\n${pathName} 验证 - 查找会话: ${sessionName}`)

    const result = await page.evaluate(async (params) => {
      try {
        const sessions = await window.api.session.getAll()
        console.log(`[API] 共找到 ${sessions.length} 个会话`)
        
        // 打印所有会话的详细信息
        console.log(`[API] 所有会话详情:`)
        sessions.forEach((s, idx) => {
          console.log(`  [${idx}] name="${s.name}", groupId=${s.groupId}, id=${s.id}, host=${s.host}`)
        })

        const session = sessions.find(s => s.name === params.sessionName)

        if (!session) {
          return { 
            found: false, 
            error: `未找到会话: ${params.sessionName}`, 
            allSessions: sessions.map(s => ({ name: s.name, groupId: s.groupId, host: s.host })),
            totalCount: sessions.length
          }
        }

        return {
          found: true,
          sessionId: session.id,
          actualGroupId: session.groupId,
          expectedGroupId: params.expectedGroupId,
          isCorrect: session.groupId === params.expectedGroupId
        }
      } catch (error) {
        return { found: false, error: error.message }
      }
    }, { sessionName, expectedGroupId })

    console.log(`${pathName} 验证结果:`)
    console.log(`  会话名: ${sessionName}`)
    console.log(`  总会话数: ${result.totalCount}`)
    console.log(`  是否找到: ${result.found}`)

    if (!result.found) {
      console.log(`  ❌ 错误: ${result.error}`)
      if (result.allSessions) {
        console.log(`  现有会话详情:`)
        result.allSessions.forEach((s: any, idx: number) => {
          console.log(`    [${idx}] name="${s.name}", groupId=${s.groupId}, host=${s.host}`)
        })
      }
      return false
    }

    console.log(`  实际 groupId: ${result.actualGroupId}`)
    console.log(`  期望 groupId: ${expectedGroupId}`)
    console.log(`  结果: ${result.isCorrect ? '✅ 正确' : '❌ 错误!'}`)

    return result.isCorrect
  }

  test('路径1: 通过 GroupHeader 右键菜单在第三层分组创建会话', async () => {
    console.log('\n========== 测试路径1: GroupHeader 右键菜单添加会话 ==========')

    // 步骤 1: 准备测试数据
    console.log('\n=== 步骤1: 准备测试数据 ===')
    await cleanupTestData()
    
    const groupIds = await createThreeLevelGroups()
    console.log(`✓ 创建三层分组: ${groupIds.level1.name} → ${groupIds.level2.name} → ${groupIds.level3.name}`)

    await refreshAndWait()

    // 展开所有分组以显示第三层
    await expandGroupByName(groupIds.level1.name)
    await expandGroupByName(groupIds.level2.name)
    await expandGroupByName(groupIds.level3.name)
    await page.waitForTimeout(500)

    // 步骤 2: 通过 GroupHeader 右键菜单创建会话
    console.log('\n=== 步骤2: 通过 GroupHeader 右键菜单创建会话 ===')

    const thirdLevelGroupHeader = page.locator('.group-header').filter({ hasText: groupIds.level3.name })
    await expect(thirdLevelGroupHeader).toBeVisible({ timeout: 5000 })
    console.log(`✓ 找到第三层分组: ${groupIds.level3.name}`)

    await thirdLevelGroupHeader.click({ button: 'right' })
    await page.waitForTimeout(300)
    console.log('✓ 右键点击了第三层分组头部')

    const contextMenu = page.locator('.global-context-menu').first()
    await expect(contextMenu).toBeVisible({ timeout: 2000 })
    console.log('✅ 右键菜单出现')

    const addSessionMenuItem = contextMenu.locator('.context-menu-item').filter({ hasText: '添加会话' })
    await expect(addSessionMenuItem).toBeVisible({ timeout: 2000 })
    await addSessionMenuItem.click()
    await page.waitForTimeout(500)
    console.log('✓ 点击了"添加会话"菜单项')

    // 步骤 3: 填写表单并提交
    console.log('\n=== 步骤3: 填写会话表单 ===')

    const formOverlay = page.locator('.session-form-overlay')
    await expect(formOverlay).toBeVisible({ timeout: 3000 })
    console.log('✓ 会话表单已打开')
    
    await page.waitForTimeout(500)

    const nameInput = page.locator('#name')
    await expect(nameInput).toBeVisible({ timeout: 2000 })
    await nameInput.click()
    await nameInput.fill('BugFixTest-路径1-会话')
    const nameValue = await nameInput.inputValue()
    console.log(`✓ 填写会话名称: ${nameValue}`)

    await page.fill('#host', testConfig.ssh.host)
    await page.fill('#port', String(testConfig.ssh.port))
    await page.fill('#username', testConfig.ssh.username)
    await page.fill('#password', testConfig.ssh.password)
    console.log('✓ 填写了其他表单字段')

    const submitButton = page.locator('.btn.submit')
    await expect(submitButton).toBeVisible({ timeout: 2000 })
    
    console.log('📊 提交前检查所有输入框的值:')
    const nameValueBefore = await page.locator('#name').inputValue()
    const hostValueBefore = await page.locator('#host').inputValue()
    console.log(`  name: "${nameValueBefore}"`)
    console.log(`  host: "${hostValueBefore}"`)
    
    await submitButton.click()
    await page.waitForTimeout(1500)
    console.log('✓ 点击了保存按钮')
    
    // 等待表单关闭（表示保存成功）
    try {
      await expect(formOverlay).not.toBeVisible({ timeout: 3000 })
      console.log('✓ 表单已关闭（保存成功）')
    } catch (e) {
      console.log('⚠️ 表单仍未关闭，可能保存失败')
      // 截图查看当前状态
      await page.screenshot({ path: 'debug-form-still-open.png', fullPage: true })
    }

    // 步骤 4: 验证结果
    console.log('\n=== 步骤4: 验证会话 groupId ===')

    const isCorrect = await verifySessionGroupId(
      'BugFixTest-路径1-会话',
      groupIds.level3.id,
      '路径1'
    )

    expect(isCorrect).toBe(true)

    if (!isCorrect) {
      throw new Error(`❌ 路径1 BUG！会话未被保存到第三层分组！`)
    }

    console.log('\n🎉 路径1 测试通过！会话正确保存到第三层分组。')
  })

  test('路径2: 通过 SessionItem 右键菜单在第三层分组创建会话', async () => {
    console.log('\n========== 测试路径2: SessionItem 右键菜单添加会话 ==========')

    // 步骤 1: 准备测试数据
    console.log('\n=== 步骤1: 准备测试数据 ===')
    await cleanupTestData()

    const groupIds = await createThreeLevelGroups()
    console.log(`✓ 创建三层分组: ${groupIds.level1.name} → ${groupIds.level2.name} → ${groupIds.level3.name}`)

    await refreshAndWait()

    // 展开所有分组
    await expandGroupByName(groupIds.level1.name)
    await expandGroupByName(groupIds.level2.name)
    await expandGroupByName(groupIds.level3.name)
    await page.waitForTimeout(500)

    // 步骤 2: 在第三层分组中先创建一个种子会话（用于触发 SessionItem 右键菜单）
    console.log('\n=== 步骤2: 创建种子会话 ===')

    const seedSessionResult = await page.evaluate(async (params) => {
      const session = await window.api.session.create({
        name: 'BugFixTest-种子会话',
        host: params.config.host,
        port: params.config.port,
        username: params.config.username,
        password: params.config.password,
        authType: 'password',
        groupId: params.targetGroupId
      })
      return { id: session.id, name: session.name, groupId: session.groupId }
    }, {
      config: {
        host: testConfig.ssh.host,
        port: testConfig.ssh.port,
        username: testConfig.ssh.username,
        password: testConfig.ssh.password
      },
      targetGroupId: groupIds.level3.id
    })

    console.log(`✓ 种子会话已创建: ${seedSessionResult.name} (groupId: ${seedSessionResult.groupId})`)

    await refreshAndWait()

    // 再次展开分组以显示种子会话
    await expandGroupByName(groupIds.level1.name)
    await expandGroupByName(groupIds.level2.name)
    await expandGroupByName(groupIds.level3.name)
    await page.waitForTimeout(500)

    // 步骤 3: 右键点击种子会话并选择"添加会话"
    console.log('\n=== 步骤3: 通过 SessionItem 右键菜单添加会话 ===')

    const seedSessionItem = page.locator('.session-item').filter({ hasText: 'BugFixTest-种子会话' })
    await expect(seedSessionItem).toBeVisible({ timeout: 5000 })
    console.log('✓ 找到种子会话项')

    await seedSessionItem.click({ button: 'right' })
    await page.waitForTimeout(300)
    console.log('✓ 右键点击了种子会话')

    const contextMenu = page.locator('.global-context-menu').first()
    await expect(contextMenu).toBeVisible({ timeout: 2000 })
    console.log('✅ 右键菜单出现')

    const addSessionMenuItem = contextMenu.locator('.context-menu-item').filter({ hasText: '添加会话' })
    await expect(addSessionMenuItem).toBeVisible({ timeout: 2000 })
    await addSessionMenuItem.click()
    await page.waitForTimeout(500)
    console.log('✓ 点击了"添加会话"菜单项')

    // 步骤 4: 填写表单并提交
    console.log('\n=== 步骤4: 填写会话表单 ===')

    const formOverlay = page.locator('.session-form-overlay')
    await expect(formOverlay).toBeVisible({ timeout: 3000 })
    console.log('✓ 会话表单已打开')

    await page.fill('#name', 'BugFixTest-路径2-会话')
    await page.fill('#host', testConfig.ssh.host)
    await page.fill('#port', String(testConfig.ssh.port))
    await page.fill('#username', testConfig.ssh.username)
    await page.fill('#password', testConfig.ssh.password)
    console.log('✓ 填写了表单字段')

    const submitButton = page.locator('.btn.submit')
    await submitButton.click()
    await page.waitForTimeout(1000)
    console.log('✓ 点击了保存按钮')

    // 步骤 5: 验证结果
    console.log('\n=== 步骤5: 验证会话 groupId ===')

    const isCorrect = await verifySessionGroupId(
      'BugFixTest-路径2-会话',
      groupIds.level3.id,
      '路径2'
    )

    expect(isCorrect).toBe(true)

    if (!isCorrect) {
      throw new Error(`❌ 路径2 BUG！会话未被保存到第三层分组！`)
    }

    console.log('\n🎉 路径2 测试通过！会话正确保存到第三层分组。')
  })

  test('清理测试数据', async () => {
    console.log('\n========== 清理测试数据 ==========')
    await cleanupTestData()
    console.log('✓ 测试数据清理完成')
  })
})
