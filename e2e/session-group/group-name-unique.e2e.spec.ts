/**
 * 分组名字唯一性测试
 * 验证同级分组名字不可重复
 * 使用 Element Plus 的 ElMessage 弹出框显示错误消息
 * 
 * 运行方式：npx playwright test group-name-unique.e2e.spec.ts --project=electron
 */

import { test, expect, _electron as electron } from '@playwright/test'
import { join } from 'path'

/**
 * 清理所有非默认分组
 */
async function cleanupGroups(electronApp: any): Promise<void> {
  try {
    const window = await electronApp.firstWindow()
    const groups = await window.evaluate(async () => {
      return await (window as any).api.sessionGroup.getAll()
    })
    
    console.log(`清理前分组数量：${groups.length}`)
    
    for (const group of groups) {
      if (group.name !== '默认分组') {
        try {
          await window.evaluate(async (groupId: string) => {
            await (window as any).api.sessionGroup.delete(groupId)
          }, group.id)
          console.log(`删除分组：${group.name}`)
        } catch (e: any) {
          console.log(`删除分组失败 ${group.name}:`, e.message)
        }
      }
    }
    
    // 验证清理结果
    const remainingGroups = await window.evaluate(async () => {
      return await (window as any).api.sessionGroup.getAll()
    })
    console.log(`清理后分组数量：${remainingGroups.length}`)
  } catch (e: any) {
    console.log('清理分组失败:', e.message)
  }
}

test.describe('分组名字唯一性', () => {
  test('创建分组时同级名字不可重复', async () => {
    // 启动 Electron 应用
    const electronApp = await electron.launch({
      args: [join(__dirname, '../../out/main/index.js')],
      env: { NODE_ENV: 'development' }
    })

    try {
      const window = await electronApp.firstWindow()
      await window.waitForLoadState('domcontentloaded')
      await window.waitForTimeout(2000)
      
      // 清理所有现有分组（除了默认分组）
      await cleanupGroups(electronApp)
      
      // 创建一个测试分组
      const testGroupName = `测试分组-${Date.now()}`
      const createdGroup = await window.evaluate(async (groupName) => {
        return await (window as any).api.sessionGroup.create({
          name: groupName,
          icon: 'folder',
          parentId: null
        })
      }, testGroupName)
      
      expect(createdGroup).toBeDefined()
      expect(createdGroup.name).toBe(testGroupName)
      console.log('创建分组成功:', createdGroup.name)
      
      // 尝试创建同级的同名分组，应该失败
      let errorMessage = ''
      try {
        await window.evaluate(async (groupName) => {
          await (window as any).api.sessionGroup.create({
            name: groupName,
            icon: 'folder',
            parentId: null
          })
        }, testGroupName)
      } catch (error: any) {
        errorMessage = error.message
        console.log('创建同名分组失败，错误信息:', errorMessage)
      }
      
      // 验证错误信息
      expect(errorMessage).toContain('同级分组中已存在名为')
      expect(errorMessage).toContain(testGroupName)
      expect(errorMessage).toContain('请使用不同的名称')
      
      // 验证可以创建不同名的分组
      const differentGroupName = `不同名分组-${Date.now()}`
      const createdGroup2 = await window.evaluate(async (groupName) => {
        return await (window as any).api.sessionGroup.create({
          name: groupName,
          icon: 'folder',
          parentId: null
        })
      }, differentGroupName)
      
      expect(createdGroup2).toBeDefined()
      expect(createdGroup2.name).toBe(differentGroupName)
      console.log('创建不同名分组成功:', createdGroup2.name)
      
    } finally {
      // 清理数据
      await cleanupGroups(electronApp)
      await electronApp.close()
    }
  })
  
  test('创建子分组时同级名字不可重复', async () => {
    // 启动 Electron 应用
    const electronApp = await electron.launch({
      args: [join(__dirname, '../../out/main/index.js')],
      env: { NODE_ENV: 'development' }
    })

    try {
      const window = await electronApp.firstWindow()
      await window.waitForLoadState('domcontentloaded')
      await window.waitForTimeout(2000)
      
      // 清理所有现有分组（除了默认分组）
      await cleanupGroups(electronApp)
      
      // 创建一个父分组
      const parentGroup = await window.evaluate(async () => {
        return await (window as any).api.sessionGroup.create({
          name: `父分组-${Date.now()}`,
          icon: 'folder',
          parentId: null
        })
      })
      
      console.log('创建父分组成功:', parentGroup.name)
      
      // 在父分组下创建一个子分组
      const childGroupName = `子分组-${Date.now()}`
      const createdChild = await window.evaluate(async ({ parentId, name }) => {
        return await (window as any).api.sessionGroup.create({
          name,
          icon: 'folder',
          parentId
        })
      }, { parentId: parentGroup.id, name: childGroupName })
      
      expect(createdChild).toBeDefined()
      console.log('创建子分组成功:', createdChild.name)
      
      // 尝试在同一个父分组下创建同名的子分组，应该失败
      let errorMessage = ''
      try {
        await window.evaluate(async ({ parentId, name }) => {
          await (window as any).api.sessionGroup.create({
            name,
            icon: 'folder',
            parentId
          })
        }, { parentId: parentGroup.id, name: childGroupName })
      } catch (error: any) {
        errorMessage = error.message
        console.log('创建同名子分组失败，错误信息:', errorMessage)
      }
      
      // 验证错误信息
      expect(errorMessage).toContain('同级分组中已存在名为')
      expect(errorMessage).toContain(childGroupName)
      
      // 验证可以在同一个父分组下创建不同名的子分组
      const differentChildName = `不同名子分组-${Date.now()}`
      const createdChild2 = await window.evaluate(async ({ parentId, name }) => {
        return await (window as any).api.sessionGroup.create({
          name,
          icon: 'folder',
          parentId
        })
      }, { parentId: parentGroup.id, name: differentChildName })
      
      expect(createdChild2).toBeDefined()
      console.log('创建不同名子分组成功:', createdChild2.name)
      
      // 验证可以在不同的父分组下创建同名的子分组
      const parentGroup2 = await window.evaluate(async () => {
        return await (window as any).api.sessionGroup.create({
          name: `父分组 2-${Date.now()}`,
          icon: 'folder',
          parentId: null
        })
      })
      
      const sameChildNameInDifferentParent = await window.evaluate(async ({ parentId, name }) => {
        return await (window as any).api.sessionGroup.create({
          name,
          icon: 'folder',
          parentId
        })
      }, { parentId: parentGroup2.id, name: childGroupName })
      
      expect(sameChildNameInDifferentParent).toBeDefined()
      expect(sameChildNameInDifferentParent.name).toBe(childGroupName)
      console.log('在不同父分组下创建同名子分组成功:', sameChildNameInDifferentParent.name)
      
    } finally {
      // 清理数据
      await cleanupGroups(electronApp)
      await electronApp.close()
    }
  })
  
  test('更新分组名字时同级名字不可重复', async () => {
    // 启动 Electron 应用
    const electronApp = await electron.launch({
      args: [join(__dirname, '../../out/main/index.js')],
      env: { NODE_ENV: 'development' }
    })

    try {
      const window = await electronApp.firstWindow()
      await window.waitForLoadState('domcontentloaded')
      await window.waitForTimeout(2000)
      
      // 清理所有现有分组（除了默认分组）
      await cleanupGroups(electronApp)
      
      // 创建两个同级分组
      const group1 = await window.evaluate(async () => {
        return await (window as any).api.sessionGroup.create({
          name: `分组 1-${Date.now()}`,
          icon: 'folder',
          parentId: null
        })
      })
      
      const group2 = await window.evaluate(async () => {
        return await (window as any).api.sessionGroup.create({
          name: `分组 2-${Date.now()}`,
          icon: 'folder',
          parentId: null
        })
      })
      
      console.log('创建两个分组成功:', group1.name, group2.name)
      
      // 尝试将 group2 重命名为 group1 的名字，应该失败
      let errorMessage = ''
      try {
        await window.evaluate(async (id: string, newName: string) => {
          await (window as any).api.sessionGroup.update(id, { name: newName })
        }, group2.id, group1.name)
      } catch (error: any) {
        errorMessage = error.message
        console.log('更新为同名分组失败，错误信息:', errorMessage)
      }
      
      // 验证错误信息
      expect(errorMessage).toContain('同级分组中已存在名为')
      expect(errorMessage).toContain(group1.name)
      
      // 验证可以更新为不同的名字
      const newName = `新名字-${Date.now()}`
      const updatedGroup = await window.evaluate(async (id: string, name: string) => {
        return await (window as any).api.sessionGroup.update(id, { name })
      }, group2.id, newName)
      
      expect(updatedGroup).toBeDefined()
      expect(updatedGroup.name).toBe(newName)
      console.log('更新分组名字成功:', updatedGroup.name)
      
    } finally {
      // 清理数据
      await cleanupGroups(electronApp)
      await electronApp.close()
    }
  })
  
  test('移动分组到目标位置时同级名字不可重复', async () => {
    // 启动 Electron 应用
    const electronApp = await electron.launch({
      args: [join(__dirname, '../../out/main/index.js')],
      env: { NODE_ENV: 'development' }
    })

    try {
      const window = await electronApp.firstWindow()
      await window.waitForLoadState('domcontentloaded')
      await window.waitForTimeout(2000)
      
      // 清理所有现有分组（除了默认分组）
      await cleanupGroups(electronApp)
      
      // 创建两个父分组
      const parentGroup1 = await window.evaluate(async () => {
        return await (window as any).api.sessionGroup.create({
          name: `父分组 1-${Date.now()}`,
          icon: 'folder',
          parentId: null
        })
      })
      
      const parentGroup2 = await window.evaluate(async () => {
        return await (window as any).api.sessionGroup.create({
          name: `父分组 2-${Date.now()}`,
          icon: 'folder',
          parentId: null
        })
      })
      
      // 在 parentGroup1 下创建一个子分组
      const childGroup = await window.evaluate(async (parentId: string) => {
        return await (window as any).api.sessionGroup.create({
          name: `子分组-${Date.now()}`,
          icon: 'folder',
          parentId
        })
      }, parentGroup1.id)
      
      console.log('创建子分组成功:', childGroup.name)
      
      // 在 parentGroup2 下创建一个同名的子分组
      const sameNameChild = await window.evaluate(async ({ parentId, name }) => {
        return await (window as any).api.sessionGroup.create({
          name,
          icon: 'folder',
          parentId
        })
      }, { parentId: parentGroup2.id, name: childGroup.name })
      
      expect(sameNameChild).toBeDefined()
      console.log('在不同父分组下创建同名子分组成功:', sameNameChild.name)
      
      // 尝试将 childGroup 移动到 parentGroup2 下（与 sameNameChild 同级），应该失败
      let errorMessage = ''
      try {
        await window.evaluate(async ({ id, targetParentId }) => {
          await (window as any).api.sessionGroup.update(id, { parentId: targetParentId })
        }, { id: childGroup.id, targetParentId: parentGroup2.id })
      } catch (error: any) {
        errorMessage = error.message
        console.log('移动分组到目标位置失败，错误信息:', errorMessage)
      }
      
      // 验证错误信息
      expect(errorMessage).toContain('同级分组中已存在名为')
      expect(errorMessage).toContain(childGroup.name)
      
      // 验证可以移动到没有同名分组的父分组下
      const parentGroup3 = await window.evaluate(async () => {
        return await (window as any).api.sessionGroup.create({
          name: `父分组 3-${Date.now()}`,
          icon: 'folder',
          parentId: null
        })
      })
      
      const movedGroup = await window.evaluate(async ({ id, targetParentId }) => {
        return await (window as any).api.sessionGroup.update(id, { parentId: targetParentId })
      }, { id: childGroup.id, targetParentId: parentGroup3.id })
      
      expect(movedGroup).toBeDefined()
      console.log('移动分组成功:', movedGroup.name, '到', parentGroup3.name)
      
    } finally {
      // 清理数据
      await cleanupGroups(electronApp)
      await electronApp.close()
    }
  })
})
