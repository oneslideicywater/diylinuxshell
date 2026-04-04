/**
 * 清空所有数据
 * 
 * 运行方式：npx playwright test clear-all-data.e2e.spec.ts --project=electron
 */

import { test, ElectronApplication } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'

let electronApp: ElectronApplication
let page: any

test.describe('Clear All Data - 清空所有数据', () => {
  test.beforeAll(async () => {
    const result = await startApp()
    electronApp = result.app
    page = result.page
    await waitForAppReady(page)
  })

  test.afterAll(async () => {
    await closeApp(electronApp)
  })

  test('清空所有会话和分组', async () => {
    console.log('=== 清空所有数据 ===')
    
    // 通过 IPC 清空所有分组
    await page.evaluate(async () => {
      if (window.api && window.api.sessionGroup) {
        const groups = await window.api.sessionGroup.getAll()
        console.log(`找到 ${groups.length} 个分组，开始删除...`)
        
        for (const group of groups) {
          await window.api.sessionGroup.delete(group.id)
          console.log(`删除分组：${group.name}`)
        }
      }
      
      // 清空所有会话
      if (window.api && window.api.session) {
        const sessions = await window.api.session.getAll()
        console.log(`找到 ${sessions.length} 个会话，开始删除...`)
        
        for (const session of sessions) {
          await window.api.session.delete(session.id)
          console.log(`删除会话：${session.name}`)
        }
      }
    })
    
    await page.waitForTimeout(500)
    
    // 验证数据已清空
    const remainingGroups = await page.evaluate(async () => {
      if (window.api && window.api.sessionGroup) {
        return await window.api.sessionGroup.getAll()
      }
      return []
    })
    
    const remainingSessions = await page.evaluate(async () => {
      if (window.api && window.api.session) {
        return await window.api.session.getAll()
      }
      return []
    })
    
    console.log(`=== 清空完成 ===`)
    console.log(`剩余分组：${remainingGroups.length}`)
    console.log(`剩余会话：${remainingSessions.length}`)
  })
})
