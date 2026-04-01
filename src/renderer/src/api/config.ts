/**
 * 配置相关API
 * 封装配置管理的 IPC 调用
 * @module renderer/api/config
 */

import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/ipc-channels'
import type { AppConfig } from '@shared/types'

/**
 * 配置API接口
 */
export const configAPI = {
  /**
   * 获取应用配置
   * @returns 应用配置
   */
  get: (): Promise<AppConfig> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CONFIG.GET)
  },

  /**
   * 保存应用配置
   * @param config - 配置内容
   * @returns 更新后的配置
   */
  set: (config: Partial<AppConfig>): Promise<AppConfig> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CONFIG.SET, config)
  },

  /**
   * 重置应用配置
   * @returns 默认配置
   */
  reset: (): Promise<AppConfig> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CONFIG.RESET)
  }
}
