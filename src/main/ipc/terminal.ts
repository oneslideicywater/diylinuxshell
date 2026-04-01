/**
 * 终端相关IPC处理
 * 处理渲染进程的终端操作请求
 * @module ipc/terminal
 */

import { ipcMain } from 'electron'
import { SSHManager } from '../services/ssh-manager'
import { IPC_CHANNELS } from '@shared/constants/ipc-channels'
import type { TerminalSize } from '@shared/types'

/**
 * 注册终端相关IPC处理器
 */
export function registerTerminalHandlers(): void {
  /**
   * 向终端写入数据
   * 渲染进程发送用户输入到主进程
   */
  ipcMain.on(IPC_CHANNELS.TERMINAL.WRITE, (_event, sessionId: string, data: string) => {
    SSHManager.write(sessionId, data)
  })

  /**
   * 调整终端大小
   * 渲染进程通知主进程终端尺寸变化
   */
  ipcMain.on(IPC_CHANNELS.TERMINAL.RESIZE, (_event, sessionId: string, size: TerminalSize) => {
    SSHManager.resize(sessionId, size.rows, size.cols)
  })
}

/**
 * 终端数据事件接口
 */
export interface TerminalDataEvent {
  /** 会话ID */
  sessionId: string
  /** 数据内容 */
  data: string
}

/**
 * 终端关闭事件接口
 */
export interface TerminalCloseEvent {
  /** 会话ID */
  sessionId: string
}

/**
 * 终端错误事件接口
 */
export interface TerminalErrorEvent {
  /** 会话ID */
  sessionId: string
  /** 错误信息 */
  error: string
}
