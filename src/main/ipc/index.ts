/**
 * IPC处理器注册入口
 * 统一注册所有IPC处理器
 * @module ipc/index
 */

import { registerSessionHandlers, registerSessionGroupHandlers } from './session'
import { registerTerminalHandlers } from './terminal'
import { registerConfigHandlers } from './config'

/**
 * 注册所有IPC处理器
 */
export function registerAllHandlers(): void {
  // 注册会话相关处理器
  registerSessionHandlers()
  registerSessionGroupHandlers()

  // 注册终端相关处理器
  registerTerminalHandlers()

  // 注册配置相关处理器
  registerConfigHandlers()

  console.log('All IPC handlers registered')
}

// 导出各个处理器，方便单独使用
export { registerSessionHandlers, registerSessionGroupHandlers } from './session'
export { registerTerminalHandlers } from './terminal'
export { registerConfigHandlers } from './config'
