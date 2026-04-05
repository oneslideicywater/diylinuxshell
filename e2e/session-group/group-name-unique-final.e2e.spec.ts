/**
 * 分组名字唯一性测试
 * 验证同级分组名字不可重复
 * 
 * 运行方式：npx playwright test group-name-unique-final.e2e.spec.ts --project=electron
 */

import { test, expect, _electron as electron } from '@playwright/test'
import { join } from 'path'

test.describe('分组名字唯一性', () => {
  test('同级分组名字唯一性验证', async () => {
    // 启动 Electron 应用
    const electronApp = await electron.launch({
      args: [join(__dirname, '../../out/main/index.js')],
      env: { NODE_ENV: 'development' }
    })

    try {
      const window = await electronApp.firstWindow()
      await window.waitForLoadState('domcontentloaded')
      await window.waitForTimeout(2000)
      
      // === 测试 1: 创建分组时同级名字不可重复 ===
      console.log('\n=== 测试 1: 创建分组时同级名字不可重复 ===')
      const test1GroupName = `测试分组-${Date.now()}`
      const createdGroup1 = await window.evaluate(async (groupName) => {
        return await (window as any).api.sessionGroup.create({
          name: groupName,
          icon: 'folder'
        })
      }, test1GroupName)
      
      expect(createdGroup1).toBeDefined()
      console.log('✓ 创建分组成功:', createdGroup1.name)
      
      // 尝试创建同级的同名分组，应该失败
      let errorMessage = ''
      try {
        await window.evaluate(async (groupName) => {
          await (window as any).api.sessionGroup.create({
            name: groupName,
            icon: 'folder'
          })
        }, test1GroupName)
      } catch (error: any) {
        errorMessage = error.message
      }
      
      expect(errorMessage).toContain('同级分组中已存在名为')
      expect(errorMessage).toContain(test1GroupName)
      expect(errorMessage).toContain('请使用不同的名称')
      console.log('✓ 创建同名分组被正确拒绝:', errorMessage)
      
      // 验证可以创建不同名的分组
      const differentGroupName = `不同名分组-${Date.now()}`
      const createdGroup2 = await window.evaluate(async (groupName) => {
        return await (window as any).api.sessionGroup.create({
          name: groupName,
          icon: 'folder'
        })
      }, differentGroupName)
      
      expect(createdGroup2).toBeDefined()
      console.log('✓ 创建不同名分组成功:', createdGroup2.name)
      
      // === 测试 2: 创建子分组时同级名字不可重复 ===
      console.log('\n=== 测试 2: 创建子分组时同级名字不可重复 ===')
      const parentGroup = await window.evaluate(async () => {
        return await (window as any).api.sessionGroup.create({
          name: `父分组-${Date.now()}`,
          icon: 'folder'
        })
      })
      console.log('✓ 创建父分组成功:', parentGroup.name)
      
      const childGroupName = `子分组-${Date.now()}`
      const createdChild = await window.evaluate(async ({ parentId, name }) => {
        return await (window as any).api.sessionGroup.create(
          { name, icon: 'folder' },
          parentId
        )
      }, { parentId: parentGroup.id, name: childGroupName })
      
      expect(createdChild).toBeDefined()
      console.log('✓ 创建子分组成功:', createdChild.name)
      
      // 尝试在同一个父分组下创建同名的子分组，应该失败
      errorMessage = ''
      try {
        await window.evaluate(async ({ parentId, name }) => {
          await (window as any).api.sessionGroup.create(
            { name, icon: 'folder' },
            parentId
          )
        }, { parentId: parentGroup.id, name: childGroupName })
      } catch (error: any) {
        errorMessage = error.message
      }
      
      expect(errorMessage).toContain('同级分组中已存在名为')
      expect(errorMessage).toContain(childGroupName)
      console.log('✓ 创建同名子分组被正确拒绝:', errorMessage)
      
      // 验证可以在同一个父分组下创建不同名的子分组
      const differentChildName = `不同名子分组-${Date.now()}`
      const createdChild2 = await window.evaluate(async ({ parentId, name }) => {
        return await (window as any).api.sessionGroup.create(
          { name, icon: 'folder' },
          parentId
        )
      }, { parentId: parentGroup.id, name: differentChildName })
      
      expect(createdChild2).toBeDefined()
      console.log('✓ 创建不同名子分组成功:', createdChild2.name)
      
      // 验证可以在不同的父分组下创建同名的子分组
      const parentGroup2 = await window.evaluate(async () => {
        return await (window as any).api.sessionGroup.create({
          name: `父分组 2-${Date.now()}`,
          icon: 'folder'
        })
      })
      
      const sameChildNameInDifferentParent = await window.evaluate(async ({ parentId, name }) => {
        return await (window as any).api.sessionGroup.create(
          { name, icon: 'folder' },
          parentId
        )
      }, { parentId: parentGroup2.id, name: childGroupName })
      
      expect(sameChildNameInDifferentParent).toBeDefined()
      expect(sameChildNameInDifferentParent.name).toBe(childGroupName)
      console.log('✓ 在不同父分组下创建同名子分组成功:', sameChildNameInDifferentParent.name)
      
      // === 测试 3: 更新分组名字时同级名字不可重复 ===
      console.log('\n=== 测试 3: 更新分组名字时同级名字不可重复 ===')
      const group1 = await window.evaluate(async () => {
        return await (window as any).api.sessionGroup.create({
          name: `分组 1-${Date.now()}`,
          icon: 'folder'
        })
      })
      
      const group2 = await window.evaluate(async () => {
        return await (window as any).api.sessionGroup.create({
          name: `分组 2-${Date.now()}`,
          icon: 'folder'
        })
      })
      console.log('✓ 创建两个分组成功:', group1.name, group2.name)
      
      // 尝试将 group2 重命名为 group1 的名字，应该失败
      errorMessage = ''
      try {
        await window.evaluate(async ({ id, newName }) => {
          await (window as any).api.sessionGroup.update(id, { name: newName })
        }, { id: group2.id, newName: group1.name })
      } catch (error: any) {
        errorMessage = error.message
      }
      
      expect(errorMessage).toContain('同级分组中已存在名为')
      expect(errorMessage).toContain(group1.name)
      console.log('✓ 更新为同名分组被正确拒绝:', errorMessage)
      
      // 验证可以更新为不同的名字
      const newName = `新名字-${Date.now()}`
      const updatedGroup = await window.evaluate(async ({ id, name }) => {
        return await (window as any).api.sessionGroup.update(id, { name })
      }, { id: group2.id, name: newName })
      
      expect(updatedGroup).toBeDefined()
      expect(updatedGroup.name).toBe(newName)
      console.log('✓ 更新分组名字成功:', updatedGroup.name)
      
      // === 测试 4: 移动分组到目标位置时同级名字不可重复 ===
      console.log('\n=== 测试 4: 移动分组到目标位置时同级名字不可重复 ===')
      const parentGroup3 = await window.evaluate(async () => {
        return await (window as any).api.sessionGroup.create({
          name: `父分组 3-${Date.now()}`,
          icon: 'folder'
        })
      })
      
      const parentGroup4 = await window.evaluate(async () => {
        return await (window as any).api.sessionGroup.create({
          name: `父分组 4-${Date.now()}`,
          icon: 'folder'
        })
      })
      
      // 在 parentGroup3 下创建一个子分组
      const childGroupToMove = await window.evaluate(async (parentId: string) => {
        return await (window as any).api.sessionGroup.create(
          { name: `子分组-${Date.now()}`, icon: 'folder' },
          parentId
        )
      }, parentGroup3.id)
      console.log('✓ 创建待移动子分组成功:', childGroupToMove.name)
      
      // 在 parentGroup4 下创建一个同名的子分组
      const sameNameChild = await window.evaluate(async ({ parentId, name }) => {
        return await (window as any).api.sessionGroup.create(
          { name, icon: 'folder' },
          parentId
        )
      }, { parentId: parentGroup4.id, name: childGroupToMove.name })
      
      expect(sameNameChild).toBeDefined()
      console.log('✓ 在不同父分组下创建同名子分组成功:', sameNameChild.name)
      
      // 尝试将 childGroupToMove 移动到 parentGroup4 下（与 sameNameChild 同级），应该失败
      errorMessage = ''
      try {
        await window.evaluate(async ({ id, targetParentId }) => {
          await (window as any).api.sessionGroup.update(id, { parentId: targetParentId })
        }, { id: childGroupToMove.id, targetParentId: parentGroup4.id })
      } catch (error: any) {
        errorMessage = error.message
      }
      
      expect(errorMessage).toContain('同级分组中已存在名为')
      expect(errorMessage).toContain(childGroupToMove.name)
      console.log('✓ 移动到同名分组位置被正确拒绝:', errorMessage)
      
      // 验证可以移动到没有同名分组的父分组下
      const parentGroup5 = await window.evaluate(async () => {
        return await (window as any).api.sessionGroup.create({
          name: `父分组 5-${Date.now()}`,
          icon: 'folder'
        })
      })
      
      const movedGroup = await window.evaluate(async ({ id, targetParentId }) => {
        return await (window as any).api.sessionGroup.update(id, { parentId: targetParentId })
      }, { id: childGroupToMove.id, targetParentId: parentGroup5.id })
      
      expect(movedGroup).toBeDefined()
      console.log('✓ 移动分组成功:', movedGroup.name, '到', parentGroup5.name)
      
      console.log('\n=== 所有测试通过 ===')
      
    } finally {
      await electronApp.close()
    }
  })
})
