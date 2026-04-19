/**
 * 右键菜单全局状态管理测试（Pinia Store）
 * 
 * 测试场景：
 * 1. 初始状态：无任何菜单打开
 * 2. 菜单打开/关闭基本操作
 * 3. SFTP Local/Remote 菜单互斥（PRD 场景1）
 * 4. 同组件内切换文件，菜单位置更新（PRD 场景2）
 * 5. 动态菜单项内容（PRD 要求4）
 * 6. 菜单项点击回调（handleSelect）
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useContextMenuStore } from '@/stores/contextMenu'
import type { ContextMenuItem } from '@/stores/contextMenu'

describe('contextMenuStore 全局右键菜单状态管理', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始状态应该无任何菜单打开', () => {
    const store = useContextMenuStore()
    expect(store.visible).toBe(false)
    expect(store.ownerId).toBeNull()
    expect(store.items).toEqual([])
    expect(store.position).toEqual({ x: 0, y: 0 })
  })

  it('showContextMenu 可以打开菜单并设置位置和内容', () => {
    const store = useContextMenuStore()
    const menuItems: ContextMenuItem[] = [
      { action: 'refresh', title: '刷新' },
      { action: 'delete', title: '删除', visible: true }
    ]

    store.showContextMenu('session-abc', { x: 100, y: 200 }, menuItems)

    expect(store.visible).toBe(true)
    expect(store.ownerId).toBe('session-abc')
    expect(store.position).toEqual({ x: 100, y: 200 })
    expect(store.items).toEqual(menuItems)
    expect(store.items.length).toBe(2)
  })

  it('新菜单打开时自动关闭旧菜单（互斥）', () => {
    const store = useContextMenuStore()
    const itemsA: ContextMenuItem[] = [{ action: 'a', title: 'A' }]
    const itemsB: ContextMenuItem[] = [{ action: 'b', title: 'B' }]

    store.showContextMenu('session-abc', { x: 10, y: 20 }, itemsA)
    expect(store.isOwner('session-abc')).toBe(true)

    store.showContextMenu('group-xyz', { x: 50, y: 60 }, itemsB)

    expect(store.ownerId).toBe('group-xyz')
    expect(store.isOwner('session-abc')).toBe(false)
    expect(store.isOwner('group-xyz')).toBe(true)
    expect(store.items).toEqual(itemsB)
  })

  /**
   * PRD 场景1：
   * 点击 SftpLocal 文件 → 右键菜单显示
   * 点击 SftpRemote 文件夹 → SftpLocal 菜单关闭，SftpRemote 菜单显示
   */
  it('PRD场景1: SFTP Local 和 Remote 菜单互斥', () => {
    const store = useContextMenuStore()
    const localItems: ContextMenuItem[] = [
      { action: 'upload', title: '上传' },
      { action: 'deleteLocal', title: '删除' }
    ]
    const remoteItems: ContextMenuItem[] = [
      { action: 'download', title: '下载' },
      { action: 'deleteRemote', title: '删除' }
    ]

    /* 点击 SftpLocal 文件 → 显示 local 菜单 */
    store.showContextMenu('sftp-local', { x: 120, y: 300 }, localItems)
    expect(store.isOwner('sftp-local')).toBe(true)
    expect(store.position).toEqual({ x: 120, y: 300 })
    expect(store.items).toEqual(localItems)

    /* 点击 SftpRemote 文件夹 → local 关闭，remote 显示 */
    store.showContextMenu('sftp-remote', { x: 400, y: 150 }, remoteItems)
    expect(store.isOwner('sftp-local')).toBe(false)
    expect(store.isOwner('sftp-remote')).toBe(true)
    expect(store.position).toEqual({ x: 400, y: 150 })
    expect(store.items).toEqual(remoteItems)
  })

  /**
   * PRD 场景2：
   * 点击 SftpLocal 文件1 → 右键菜单在鼠标位置显示
   * 再点击文件2 → 右键菜单在文件2位置更新
   */
  it('PRD场景2: 同组件内点击不同文件，菜单位置和内容更新', () => {
    const store = useContextMenuStore()

    /* 点击文件1 → 菜单在 (100, 200) 显示 */
    store.showContextMenu('sftp-local', { x: 100, y: 200 }, [{ action: 'refresh', title: '刷新' }])
    expect(store.isOwner('sftp-local')).toBe(true)
    expect(store.position).toEqual({ x: 100, y: 200 })

    /* 点击文件2 → 菜单位置更新到 (200, 350)，菜单仍属于 sftp-local */
    store.showContextMenu('sftp-local', { x: 200, y: 350 }, [{ action: 'delete', title: '删除' }])
    expect(store.isOwner('sftp-local')).toBe(true)
    expect(store.position).toEqual({ x: 200, y: 350 })
  })

  it('hideContextMenu 可以关闭菜单并清除状态', () => {
    const store = useContextMenuStore()
    const items: ContextMenuItem[] = [{ action: 'test', title: 'Test' }]

    store.showContextMenu('session-abc', { x: 0, y: 0 }, items)
    store.hideContextMenu()

    expect(store.visible).toBe(false)
    expect(store.ownerId).toBeNull()
    expect(store.items).toEqual([])
  })

  it('hideContextMenu 在未打开时不会报错', () => {
    const store = useContextMenuStore()
    expect(() => store.hideContextMenu()).not.toThrow()
  })

  it('isOwner 返回 false 当菜单未打开时', () => {
    const store = useContextMenuStore()
    expect(store.isOwner('any-id')).toBe(false)
  })

  it('isOwner 返回 false 当 ID 不匹配时', () => {
    const store = useContextMenuStore()
    store.showContextMenu('owner-a', { x: 0, y: 0 }, [])
    expect(store.isOwner('owner-b')).toBe(false)
  })

  it('updatePosition 可以更新菜单位置', () => {
    const store = useContextMenuStore()

    store.showContextMenu('session-abc', { x: 10, y: 20 }, [])
    store.updatePosition({ x: 300, y: 400 })

    expect(store.position).toEqual({ x: 300, y: 400 })
  })

  it('handleSelect 调用回调并关闭菜单', () => {
    const store = useContextMenuStore()
    let receivedAction: string | null = null

    const callback = (action: string) => {
      receivedAction = action
    }

    const items: ContextMenuItem[] = [
      { action: 'delete', title: '删除' },
      { action: 'refresh', title: '刷新' }
    ]
    store.showContextMenu('test-owner', { x: 0, y: 0 }, items, callback)

    store.handleSelect('delete')

    expect(receivedAction).toBe('delete')
    expect(store.visible).toBe(false)
    expect(store.ownerId).toBeNull()
  })

  it('handleSelect 无回调时不报错', () => {
    const store = useContextMenuStore()
    store.showContextMenu('test-owner', { x: 0, y: 0 }, [])
    expect(() => store.handleSelect('test')).not.toThrow()
    expect(store.visible).toBe(false)
  })
})
