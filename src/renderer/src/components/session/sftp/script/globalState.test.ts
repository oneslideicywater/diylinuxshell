/**
 * SFTP 右键菜单分布式管理测试
 * 
 * 测试场景：
 * 1. 右击本地文件，显示本地菜单
 * 2. 右击远程文件，本地菜单关闭，远程菜单显示
 * 3. 再次右击本地文件，远程菜单关闭，本地菜单显示
 * 4. 点击其他地方，菜单关闭
 */

import { test, expect, describe } from 'vitest'
import {
  getContextMenuOwner,
  setContextMenuOwner,
  clearContextMenuOwner,
  requestContextMenu,
  closeCurrentContextMenu
} from './globalState'

describe('SFTP 右键菜单全局状态管理', () => {
  beforeEach(() => {
    // 重置状态
    clearContextMenuOwner('local')
    clearContextMenuOwner('remote')
  })

  test('初始状态应该为 null', () => {
    expect(getContextMenuOwner()).toBeNull()
  })

  test('本地组件可以获取菜单显示权限', () => {
    const closeCallback = vi.fn()
    const result = requestContextMenu('local', closeCallback)
    
    expect(result).toBe(true)
    expect(getContextMenuOwner()).toBe('local')
  })

  test('远程组件可以获取菜单显示权限', () => {
    const closeCallback = vi.fn()
    const result = requestContextMenu('remote', closeCallback)
    
    expect(result).toBe(true)
    expect(getContextMenuOwner()).toBe('remote')
  })

  test('当远程菜单显示时，本地组件请求菜单会关闭远程菜单', () => {
    const remoteCloseCallback = vi.fn()
    const localCloseCallback = vi.fn()
    
    // 远程菜单先显示
    requestContextMenu('remote', remoteCloseCallback)
    expect(getContextMenuOwner()).toBe('remote')
    
    // 本地组件请求菜单
    requestContextMenu('local', localCloseCallback)
    
    // 远程菜单应该被关闭
    expect(remoteCloseCallback).toHaveBeenCalled()
    expect(getContextMenuOwner()).toBe('local')
  })

  test('当本地菜单显示时，远程组件请求菜单会关闭本地菜单', () => {
    const localCloseCallback = vi.fn()
    const remoteCloseCallback = vi.fn()
    
    // 本地菜单先显示
    requestContextMenu('local', localCloseCallback)
    expect(getContextMenuOwner()).toBe('local')
    
    // 远程组件请求菜单
    requestContextMenu('remote', remoteCloseCallback)
    
    // 本地菜单应该被关闭
    expect(localCloseCallback).toHaveBeenCalled()
    expect(getContextMenuOwner()).toBe('remote')
  })

  test('同一个组件重复请求不会触发关闭回调', () => {
    const closeCallback = vi.fn()
    
    // 第一次请求
    requestContextMenu('local', closeCallback)
    expect(getContextMenuOwner()).toBe('local')
    
    // 第二次请求同一个组件
    requestContextMenu('local', closeCallback)
    
    // 不应该触发关闭回调
    expect(closeCallback).not.toHaveBeenCalled()
  })

  test('清除所有者后状态应该为 null', () => {
    const closeCallback = vi.fn()
    
    requestContextMenu('local', closeCallback)
    expect(getContextMenuOwner()).toBe('local')
    
    clearContextMenuOwner('local')
    expect(getContextMenuOwner()).toBeNull()
  })

  test('关闭当前菜单应该调用回调', () => {
    const closeCallback = vi.fn()
    
    requestContextMenu('local', closeCallback)
    closeCurrentContextMenu()
    
    expect(closeCallback).toHaveBeenCalled()
    expect(getContextMenuOwner()).toBeNull()
  })
})
