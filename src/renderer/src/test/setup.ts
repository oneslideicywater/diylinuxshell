/**
 * Vitest测试设置文件
 * 配置测试环境和全局mock
 */
import { config } from '@vue/test-utils'
import { vi } from 'vitest'

// Mock Electron API
const mockElectronAPI = {
  ipcRenderer: {
    send: vi.fn(),
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn()
  }
}

// Mock自定义API
const mockCustomAPI = {
  windowMinimize: vi.fn(),
  windowMaximize: vi.fn(),
  windowClose: vi.fn(),
  windowIsMaximized: vi.fn().mockResolvedValue(false),
  onWindowMaximize: vi.fn().mockReturnValue(() => {}),
  onWindowUnmaximize: vi.fn().mockReturnValue(() => {})
}

// 全局挂载mock
config.global.mocks = {
  $electron: mockElectronAPI
}

// 设置全局window对象
if (typeof window !== 'undefined') {
  (window as any).electron = mockElectronAPI
  ;(window as any).api = mockCustomAPI
}

// 导出mock供测试使用
export { mockElectronAPI, mockCustomAPI }
