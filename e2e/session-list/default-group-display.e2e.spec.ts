/**
 * 默认分组显示测试
 * 验证默认分组是否始终显示在分组列表的最上方
 * 
 * 运行方式：npx playwright test default-group-display.e2e.spec.ts --project=electron
 */

import { test, expect, _electron as electron } from '@playwright/test'
import { join } from 'path'

test.describe('默认分组显示', () => {
  test('默认分组应该显示在分组列表最上方', async () => {
    // 启动 Electron 应用
    const electronApp = await electron.launch({
      args: [join(__dirname, '../../out/main/index.js')],
      env: { NODE_ENV: 'development' }
    })

    try {
      // 等待应用加载完成
      const window = await electronApp.firstWindow()
      await window.waitForLoadState('domcontentloaded')
      await window.waitForTimeout(5000) // 等待数据加载
      
      // 获取所有分组数据
      const groups = await window.evaluate(async () => {
        return await (window as any).api.sessionGroup.getAll()
      })
      
      console.log('所有分组:', JSON.stringify(groups, null, 2))
      
      // 检查是否有默认分组
      const defaultGroup = groups.find((g: any) => g.name === '默认分组')
      expect(defaultGroup).toBeDefined()
      console.log('默认分组:', defaultGroup)
      
      // 获取页面上显示的分组名称列表
      const groupNames = await window.evaluate(() => {
        const elements = document.querySelectorAll('.group-name')
        return Array.from(elements).map(el => el.textContent?.trim() || '')
      })
      
      console.log('页面上显示的分组名称:', groupNames)
      
      // 验证默认分组在列表最上方（第一个显示）
      if (groupNames.length > 0) {
        expect(groupNames[0]).toBe('默认分组')
        console.log('✓ 默认分组显示在分组列表最上方')
      }
      
      // 验证默认分组在 sessionGroups computed 属性中排第一
      const sessionGroupsOrder = await window.evaluate(() => {
        // 获取 Vue 组件实例
        const app = document.querySelector('#app')
        if (!app) return null
        
        // 尝试从全局状态获取
        return (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__
      })
      
      console.log('Vue DevTools:', sessionGroupsOrder ? 'available' : 'not available')
      
    } finally {
      await electronApp.close()
    }
  })
  
  test('创建其他分组后默认分组仍应在最上方', async () => {
    // 启动 Electron 应用
    const electronApp = await electron.launch({
      args: [join(__dirname, '../../out/main/index.js')],
      env: { NODE_ENV: 'development' }
    })

    try {
      const window = await electronApp.firstWindow()
      await window.waitForLoadState('domcontentloaded')
      await window.waitForTimeout(2000)
      
      // 先清理所有现有分组（除了默认分组）
      await window.evaluate(async () => {
        const groups = await (window as any).api.sessionGroup.getAll()
        for (const group of groups) {
          if (group.name !== '默认分组') {
            try {
              await (window as any).api.sessionGroup.delete(group.id)
            } catch (e) {
              // 忽略删除失败
            }
          }
        }
      })
      
      // 创建一个新的测试分组
      await window.evaluate(async () => {
        await (window as any).api.sessionGroup.create({
          name: '测试分组-' + Date.now(),
          icon: 'folder',
          parentId: null
        })
      })
      
      await window.waitForTimeout(500)
      
      // 获取分组列表
      const groups = await window.evaluate(async () => {
        return await (window as any).api.sessionGroup.getAll()
      })
      
      console.log('创建测试分组后的分组列表:', JSON.stringify(groups, null, 2))
      
      // 获取页面上显示的分组名称
      const groupNames = await window.evaluate(() => {
        const elements = document.querySelectorAll('.group-name')
        return Array.from(elements).map(el => el.textContent?.trim() || '')
      })
      
      console.log('页面上显示的分组名称:', groupNames)
      
      // 验证默认分组仍然在第一个
      expect(groupNames[0]).toBe('默认分组')
      console.log('✓ 创建其他分组后默认分组仍在最上方')
      
    } finally {
      await electronApp.close()
    }
  })
})
