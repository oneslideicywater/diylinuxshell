/**
 * 第三层分组创建会话 Bug 诊断测试
 * 直接通过 API 操作，验证 groupId 传递是否正确
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'
import { testConfig } from '../config/test-config'

let electronApp: ElectronApplication
let page: Page

test.describe('第三层分组 Bug 诊断', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('诊断: 通过 API 创建三层分组并验证 groupId 传递', async () => {
    console.log('\n========== 开始 Bug 诊断 ==========')

    // 步骤 1: 清理旧数据
    console.log('\n=== 步骤1: 清理旧数据 ===')
    await page.evaluate(async () => {
      // 删除旧的测试会话
      const sessions = await window.api.session.getAll()
      for (const s of sessions) {
        if (s.name.startsWith('DiagTest')) {
          try { await window.api.session.delete(s.id) } catch (e) { console.warn('删除会话失败', e) }
        }
      }
      
      // 删除旧的测试分组
      const groups = await window.api.sessionGroup.getAll()
      for (const g of groups) {
        if (g.name.startsWith('DiagTest') && g.name !== '默认分组') {
          try { await window.api.sessionGroup.delete(g.id) } catch (e) { console.warn('删除分组失败', e) }
        }
      }
    })
    
    await page.waitForTimeout(500)

    // 步骤 2: 创建三层嵌套分组
    console.log('\n=== 步骤2: 创建三层嵌套分组 ===')
    
    const groupIds = await page.evaluate(async () => {
      // 第一层
      const group1 = await window.api.sessionGroup.create({ name: 'DiagTest-层级1' })
      console.log(`✓ 第一层分组: ${group1.name} (id: ${group1.id}, depth: ${group1.depth})`)
      
      // 第二层
      const group2 = await window.api.sessionGroup.create({ name: 'DiagTest-层级2' }, group1.id)
      console.log(`✓ 第二层分组: ${group2.name} (id: ${group2.id}, depth: ${group2.depth}, parentId: ${group2.parentId})`)
      
      // 第三层
      const group3 = await window.api.sessionGroup.create({ name: 'DiagTest-层级3' }, group2.id)
      console.log(`✓ 第三层分组: ${group3.name} (id: ${group3.id}, depth: ${group3.depth}, parentId: ${group3.parentId})`)
      
      return {
        level1: { id: group1.id, name: group1.name, depth: group1.depth },
        level2: { id: group2.id, name: group2.name, depth: group2.depth, parentId: group2.parentId },
        level3: { id: group3.id, name: group3.name, depth: group3.depth, parentId: group3.parentId }
      }
    })
    
    console.log('\n分组信息:')
    console.log(JSON.stringify(groupIds, null, 2))

    // 步骤 3: 模拟路径1 - handleAddSessionToGroup 的逻辑
    console.log('\n=== 步骤3: 模拟路径1 - handleAddSessionToGroup ===')
    console.log('模拟代码: editingSession = { ..., groupId: group3.id }')
    
    // 直接在第三层分组中创建会话
    const path1Result = await page.evaluate(async (params) => {
      const session = await window.api.session.create({
        name: 'DiagTest-路径1',
        host: params.config.host,
        port: params.config.port,
        username: params.config.username,
        password: params.config.password,
        authType: 'password',
        groupId: params.targetGroupId  // 明确指定第三层分组的 ID
      })
      
      return {
        sessionId: session.id,
        sessionName: session.name,
        actualGroupId: session.groupId,
        expectedGroupId: params.targetGroupId
      }
    }, {
      config: {
        host: testConfig.ssh.host,
        port: testConfig.ssh.port,
        username: testConfig.ssh.username,
        password: testConfig.ssh.password
      },
      targetGroupId: groupIds.level3.id
    })
    
    console.log('\n路径1结果:')
    console.log(JSON.stringify(path1Result, null, 2))
    console.log(`\n路径1验证: groupId (${path1Result.actualGroupId}) == 第三层ID (${path1Result.expectedGroupId}) ? ${path1Result.actualGroupId === path1Result.expectedGroupId}`)

    // 步骤 4: 模拟路径2 - handleAddSessionFromItem 的逻辑
    console.log('\n=== 步骤4: 模拟路径2 - handleAddSessionFromItem ===')
    console.log('模拟代码: emit("add-session", seedSession.groupId), 然后设置 defaultGroupId')
    
    const path2Result = await page.evaluate(async (params) => {
      // 先在第三层创建一个种子会话
      const seedSession = await window.api.session.create({
        name: 'DiagTest-种子会话',
        host: params.config.host,
        port: params.config.port,
        username: params.config.username,
        password: params.config.password,
        authType: 'password',
        groupId: params.targetGroupId
      })
      
      console.log(`种子会话: ${seedSession.name} (groupId: ${seedSession.groupId})`)
      
      // 模拟从 SessionItem 获取 groupId 并传递给 defaultGroupId
      const defaultGroupId = seedSession.groupId
      
      // 使用 defaultGroupId 创建新会话
      const newSession = await window.api.session.create({
        name: 'DiagTest-路径2',
        host: params.config.host,
        port: params.config.port,
        username: params.config.username,
        password: params.config.password,
        authType: 'password',
        groupId: defaultGroupId  // 使用从种子会话获取的 groupId
      })
      
      return {
        seedSessionGroupId: seedSession.groupId,
        newSessionId: newSession.id,
        newSessionName: newSession.name,
        actualGroupId: newSession.groupId,
        expectedGroupId: params.targetGroupId,
        isCorrect: newSession.groupId === params.targetGroupId
      }
    }, {
      config: {
        host: testConfig.ssh.host,
        port: testConfig.ssh.port,
        username: testConfig.ssh.username,
        password: testConfig.ssh.password
      },
      targetGroupId: groupIds.level3.id
    })
    
    console.log('\n路径2结果:')
    console.log(JSON.stringify(path2Result, null, 2))
    console.log(`\n路径2验证: groupId (${path2Result.actualGroupId}) == 第三层ID (${path2Result.expectedGroupId}) ? ${path2Result.isCorrect}`)

    // 步骤 5: 断言
    console.log('\n=== 步骤5: 最终断言 ===')
    
    expect(path1Result.actualGroupId).toBe(path1Result.expectedGroupId)
    expect(path2Result.actualGroupId).toBe(path2Result.expectedGroupId)
    
    if (path1Result.actualGroupId !== path1Result.expectedGroupId) {
      throw new Error(`❌ 路径1 BUG！期望 groupId=${path1Result.expectedGroupId}, 实际=${path1Result.actualGroupId}`)
    }
    
    if (path2Result.actualGroupId !== path2Result.expectedGroupId) {
      throw new Error(`❌ 路径2 BUG！期望 groupId=${path2Result.expectedGroupId}, 实际=${path2Result.actualGroupId}`)
    }
    
    console.log('\n🎉 两个路径都正确！API 层面没有问题。')

    // 清理
    console.log('\n=== 清理数据 ===')
    await page.evaluate(async () => {
      const sessions = await window.api.session.getAll()
      for (const s of sessions) {
        if (s.name.startsWith('DiagTest')) {
          try { await window.api.session.delete(s.id) } catch (e) {}
        }
      }
      const groups = await window.api.sessionGroup.getAll()
      for (const g of groups) {
        if (g.name.startsWith('DiagTest') && g.name !== '默认分组') {
          try { await window.api.sessionGroup.delete(g.id) } catch (e) {}
        }
      }
    })
  })
})
