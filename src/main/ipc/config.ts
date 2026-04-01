/**
 * 配置相关IPC处理
 * 处理渲染进程的配置管理请求
 * @module ipc/config
 */

import { ipcMain } from 'electron'
import { StoreService } from '../services/store'
import { IPC_CHANNELS } from '@shared/constants/ipc-channels'
import type { AppConfig } from '@shared/types'

/**
 * 注册配置相关IPC处理器
 */
export function registerConfigHandlers(): void {
  /**
   * 获取应用配置
   */
  ipcMain.handle(IPC_CHANNELS.CONFIG.GET, () => {
    return StoreService.getConfig()
  })

  /**
   * 保存应用配置
   */
  ipcMain.handle(IPC_CHANNELS.CONFIG.SET, (_event, config: Partial<AppConfig>) => {
    StoreService.setConfig(config)
    return StoreService.getConfig()
  })

  /**
   * 重置应用配置
   */
  ipcMain.handle(IPC_CHANNELS.CONFIG.RESET, () => {
    StoreService.resetConfig()
    return StoreService.getConfig()
  })
}
