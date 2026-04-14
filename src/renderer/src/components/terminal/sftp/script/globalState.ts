/**
 * SFTP 组件全局状态管理
 * 
 * 用于协调 SftpLocal 和 SftpRemote 组件之间的右键菜单显示
 */

/**
 * 全局右键菜单所有者
 * 用于确保同一时间只有一个组件的右键菜单显示
 */
let globalContextMenuOwner: 'local' | 'remote' | null = null

/**
 * 右键菜单关闭回调
 */
const closeMenuCallbacks: Map<'local' | 'remote', () => void> = new Map()

/**
 * 获取当前右键菜单所有者
 */
export function getContextMenuOwner(): 'local' | 'remote' | null {
  return globalContextMenuOwner
}

/**
 * 设置右键菜单所有者
 * @param owner 组件标识
 * @param closeCallback 关闭菜单的回调函数
 */
export function setContextMenuOwner(
  owner: 'local' | 'remote',
  closeCallback: () => void
): void {
  // 注册关闭回调
  closeMenuCallbacks.set(owner, closeCallback)
  
  // 更新所有者
  globalContextMenuOwner = owner
}

/**
 * 清除右键菜单所有者
 * @param owner 组件标识
 */
export function clearContextMenuOwner(owner: 'local' | 'remote'): void {
  if (globalContextMenuOwner === owner) {
    globalContextMenuOwner = null
  }
  closeMenuCallbacks.delete(owner)
}

/**
 * 请求显示右键菜单
 * @param owner 请求的组件标识
 * @param closeCallback 关闭菜单的回调函数
 * @returns 是否成功获取显示权限
 */
export function requestContextMenu(
  owner: 'local' | 'remote',
  closeCallback: () => void
): boolean {
  // 如果当前所有者就是自己，直接返回 true
  if (globalContextMenuOwner === owner) {
    return true
  }
  
  // 如果当前有其他组件在显示菜单，通知它关闭
  if (globalContextMenuOwner && globalContextMenuOwner !== owner) {
    const otherCloseCallback = closeMenuCallbacks.get(globalContextMenuOwner)
    if (otherCloseCallback) {
      otherCloseCallback()
    }
  }
  
  // 设置自己为当前所有者
  setContextMenuOwner(owner, closeCallback)
  return true
}

/**
 * 关闭当前显示的右键菜单
 */
export function closeCurrentContextMenu(): void {
  if (globalContextMenuOwner) {
    const closeCallback = closeMenuCallbacks.get(globalContextMenuOwner)
    if (closeCallback) {
      closeCallback()
    }
  }
}
