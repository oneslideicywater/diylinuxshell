/**
 * 终端相关API
 * 封装终端操作的 IPC 调用
 * @module renderer/api/terminal
 */

import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/ipc-channels'
import type { TerminalSize } from '@shared/types'

/**
 * 终端数据事件回调类型
 */
export type TerminalDataCallback = (event: { sessionId: string; data: string }) => void

/**
 * 终端关闭事件回调类型
 */
export type TerminalCloseCallback = (event: { sessionId: string }) => void

/**
 * 终端错误事件回调类型
 */
export type TerminalErrorCallback = (event: { sessionId: string; error: string }) => void

/**
 * 终端API接口
 */
export const terminalAPI = {
  /**
   * 向终端写入数据
   * @param sessionId - 会话ID
   * @param data - 数据内容
   */
  write: (sessionId: string, data: string): void => {
    ipcRenderer.send(IPC_CHANNELS.TERMINAL.WRITE, sessionId, data)
  },

  /**
   * 调整终端大小
   * @param sessionId - 会话ID
   * @param size - 终端尺寸
   */
  resize: (sessionId: string, size: TerminalSize): void => {
    ipcRenderer.send(IPC_CHANNELS.TERMINAL.RESIZE, sessionId, size)
  },

  /**
   * 监听终端数据事件
   * @param callback - 回调函数
   * @returns 取消监听函数
   */
  onData: (callback: TerminalDataCallback): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => {
      callback(data as { sessionId: string; data: string })
    }
    ipcRenderer.on(IPC_CHANNELS.TERMINAL.DATA, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL.DATA, handler)
    }
  },

  /**
   * 监听终端关闭事件
   * @param callback - 回调函数
   * @returns 取消监听函数
   */
  onClose: (callback: TerminalCloseCallback): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => {
      callback(data as { sessionId: string })
    }
    ipcRenderer.on(IPC_CHANNELS.TERMINAL.CLOSE, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL.CLOSE, handler)
    }
  },

  /**
   * 监听终端错误事件
   * @param callback - 回调函数
   * @returns 取消监听函数
   */
  onError: (callback: TerminalErrorCallback): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => {
      callback(data as { sessionId: string; error: string })
    }
    ipcRenderer.on(IPC_CHANNELS.TERMINAL.ERROR, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL.ERROR, handler)
    }
  }
}
