/**
 * IPC通道常量定义
 * 定义主进程和渲染进程之间的通信通道名称
 * @module shared/constants/ipc-channels
 */

/**
 * IPC通道名称常量
 */
export const IPC_CHANNELS = {
  /**
   * 会话相关通道
   */
  SESSION: {
    /** 获取所有会话 */
    GET_ALL: 'session:get-all',
    /** 获取单个会话 */
    GET_BY_ID: 'session:get-by-id',
    /** 创建会话 */
    CREATE: 'session:create',
    /** 更新会话 */
    UPDATE: 'session:update',
    /** 删除会话 */
    DELETE: 'session:delete',
    /** 连接会话 */
    CONNECT: 'session:connect',
    /** 断开会话 */
    DISCONNECT: 'session:disconnect',
    /** 获取连接状态 */
    GET_STATUS: 'session:get-status',
    /** 测试连接 */
    TEST_CONNECTION: 'session:test-connection'
  },

  /**
   * 会话分组相关通道
   */
  SESSION_GROUP: {
    /** 获取所有分组 */
    GET_ALL: 'session-group:get-all',
    /** 创建分组 */
    CREATE: 'session-group:create',
    /** 更新分组 */
    UPDATE: 'session-group:update',
    /** 删除分组 */
    DELETE: 'session-group:delete'
  },

  /**
   * 终端相关通道
   */
  TERMINAL: {
    /** 写入数据 */
    WRITE: 'terminal:write',
    /** 调整大小 */
    RESIZE: 'terminal:resize',
    /** 接收数据（主进程推送） */
    DATA: 'terminal:data',
    /** 连接关闭（主进程推送） */
    CLOSE: 'terminal:close',
    /** 连接错误（主进程推送） */
    ERROR: 'terminal:error'
  },

  /**
   * 命令片段相关通道
   */
  COMMAND_SNIPPET: {
    /** 获取所有片段 */
    GET_ALL: 'command-snippet:get-all',
    /** 创建片段 */
    CREATE: 'command-snippet:create',
    /** 更新片段 */
    UPDATE: 'command-snippet:update',
    /** 删除片段 */
    DELETE: 'command-snippet:delete'
  },

  /**
   * 配置相关通道
   */
  CONFIG: {
    /** 获取配置 */
    GET: 'config:get',
    /** 保存配置 */
    SET: 'config:set',
    /** 重置配置 */
    RESET: 'config:reset'
  },

  /**
   * 窗口控制相关通道
   */
  WINDOW: {
    /** 最小化窗口 */
    MINIMIZE: 'window-minimize',
    /** 最大化窗口 */
    MAXIMIZE: 'window-maximize',
    /** 关闭窗口 */
    CLOSE: 'window-close',
    /** 获取最大化状态 */
    IS_MAXIMIZED: 'window-is-maximized',
    /** 窗口已最大化事件 */
    MAXIMIZED: 'window-maximized',
    /** 窗口取消最大化事件 */
    UNMAXIMIZED: 'window-unmaximized'
  }
} as const

/**
 * IPC通道名称类型
 */
export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS]
