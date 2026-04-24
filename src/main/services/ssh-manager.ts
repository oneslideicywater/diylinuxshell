/**
 * SSH连接管理器
 * 管理 SSH 连接的创建、维护和销毁
 * @module services/ssh-manager
 */

import { Client, ClientChannel } from 'ssh2'
import type { Session } from '@shared/types'
import { CryptoService } from './crypto'
import { StoreService } from './store'

/**
 * SSH连接信息
 */
interface SSHConnection {
  /** 标签页ID（连接的唯一标识） */
  tabId: string
  /** 会话ID（用于获取会话配置） */
  sessionId: string
  /** SSH客户端实例 */
  client: Client
  /** Shell通道 */
  stream: ClientChannel | null
  /** 连接状态 */
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  /** 错误信息 */
  error?: string
  /** 连接时间 */
  connectedAt?: number
}

/**
 * SSH连接选项
 */
interface SSHConnectOptions {
  /** 主机地址 */
  host: string
  /** 端口号 */
  port: number
  /** 用户名 */
  username: string
  /** 密码 */
  password?: string
  /** 私钥路径 */
  privateKeyPath?: string
  /** 私钥内容（Buffer） */
  privateKey?: Buffer
  /** 私钥密码 */
  passphrase?: string
  /** 连接超时 */
  timeout?: number
  /** 心跳间隔 */
  keepaliveInterval?: number
}

/**
 * SSH管理器类
 * 管理所有SSH连接的生命周期
 * 每个标签页拥有独立的SSH连接
 */
export class SSHManager {
  /** 连接映射表（以tabId为键） */
  private static connections: Map<string, SSHConnection> = new Map()

  /**
   * 创建 SSH 连接
   * @param tabId - 标签页 ID（连接的唯一标识）
   * @param session - 会话配置
   * @param isTestConnection - 是否为测试连接（测试连接时密码是明文，不需要解密）
   * @param initialSize - 初始终端尺寸（从 XTerminal 组件动态获取，替代硬编码 80x24）
   * @returns 连接 ID（tabId）
   */
  static async connect(
    tabId: string,
    session: Session,
    isTestConnection: boolean = false,
    initialSize?: { cols: number; rows: number }
  ): Promise<string> {
    // 如果已存在连接，先断开
    if (this.connections.has(tabId)) {
      await this.disconnect(tabId)
    }

    const client = new Client()
    const connection: SSHConnection = {
      tabId,
      sessionId: session.id,
      client,
      stream: null,
      status: 'connecting'
    }

    this.connections.set(tabId, connection)

    // 构建连接配置
    const connectOptions: SSHConnectOptions = {
      host: session.host,
      port: session.port,
      username: session.username,
      timeout: 30000,
      keepaliveInterval: 30000
    }

    // 设置认证方式
    if (session.authType === 'password' && session.password) {
      // 测试连接时使用明文密码，正常连接时需要解密
      connectOptions.password = isTestConnection ? session.password : CryptoService.decrypt(session.password)
    } else if (session.authType === 'key' && session.keyPath) {
      const fs = await import('fs')
      try {
        connectOptions.privateKeyPath = session.keyPath
        connectOptions.privateKey = fs.readFileSync(session.keyPath)
        if (session.keyPassphrase) {
          connectOptions.passphrase = CryptoService.decrypt(session.keyPassphrase)
        }
      } catch (error) {
        connection.status = 'error'
        connection.error = `Failed to read private key: ${error}`
        throw new Error(connection.error)
      }
    }

    return new Promise((resolve, reject) => {
      // 连接超时处理
      const timeout = setTimeout(() => {
        client.destroy()
        connection.status = 'error'
        connection.error = 'Connection timeout'
        reject(new Error('Connection timeout'))
      }, connectOptions.timeout)

      // 连接就绪
      client.on('ready', () => {
        clearTimeout(timeout)
        connection.status = 'connected'
        connection.connectedAt = Date.now()
        connection.error = undefined

        // 创建Shell通道
        // 传入 TERM 环境变量以支持 256 色和 vim 等工具的语法高亮
        // cols/rows 从 XTerminal 组件动态获取，确保远程 PTY 尺寸与前端终端一致
        const terminalConfig = StoreService.getConfig().terminal
        const cols = initialSize?.cols || 80
        const rows = initialSize?.rows || 24
        client.shell(
          {
            term: terminalConfig.terminalType,
            cols,
            rows
          },
          (err, stream) => {
          if (err) {
            connection.status = 'error'
            connection.error = err.message
            reject(err)
            return
          }

          connection.stream = stream
          resolve(tabId)
        })
      })

      // 连接错误
      client.on('error', (err) => {
        clearTimeout(timeout)
        connection.status = 'error'
        connection.error = err.message
        reject(err)
      })

      // 连接关闭
      client.on('close', () => {
        connection.status = 'disconnected'
        connection.stream = null
      })

      // 发起连接
      client.connect(connectOptions)
    })
  }

  /**
   * 断开SSH连接
   * @param tabId - 标签页ID
   */
  static async disconnect(tabId: string): Promise<void> {
    const connection = this.connections.get(tabId)
    if (!connection) {
      return
    }

    // 关闭Shell通道
    if (connection.stream) {
      connection.stream.end()
      connection.stream = null
    }

    // 关闭SSH客户端
    connection.client.destroy()
    connection.status = 'disconnected'

    // 移除连接记录
    this.connections.delete(tabId)
  }

  /**
   * 获取连接状态
   * @param tabId - 标签页ID
   * @returns 连接状态
   */
  static getStatus(tabId: string): SSHConnection['status'] | null {
    const connection = this.connections.get(tabId)
    return connection?.status || null
  }

  /**
   * 获取连接信息
   * @param tabId - 标签页ID
   * @returns 连接信息
   */
  static getConnection(tabId: string): SSHConnection | undefined {
    return this.connections.get(tabId)
  }

  /**
   * 获取所有连接
   * @returns 所有连接信息
   */
  static getAllConnections(): SSHConnection[] {
    return Array.from(this.connections.values())
  }

  /**
   * 向终端写入数据
   * @param tabId - 标签页ID
   * @param data - 数据内容
   */
  static write(tabId: string, data: string): void {
    const connection = this.connections.get(tabId)
    if (connection?.stream) {
      connection.stream.write(data)
    }
  }

  /**
   * 调整终端大小
   * @param tabId - 标签页ID
   * @param rows - 行数
   * @param cols - 列数
   */
  static resize(tabId: string, rows: number, cols: number): void {
    const connection = this.connections.get(tabId)
    if (connection?.stream) {
      // setWindow 需要 4 个参数: rows, cols, height, width
      // height 和 width 是像素值，暂时使用默认值
      connection.stream.setWindow(rows, cols, 480, 640)
    }
  }

  /**
   * 注册数据监听器
   * @param tabId - 标签页ID
   * @param callback - 数据回调函数
   * @returns 取消监听函数
   */
  static onData(tabId: string, callback: (data: string) => void): () => void {
    const connection = this.connections.get(tabId)
    if (!connection?.stream) {
      return () => {}
    }

    const handler = (data: Buffer) => {
      callback(data.toString('utf-8'))
    }

    connection.stream.on('data', handler)

    return () => {
      connection.stream?.removeListener('data', handler)
    }
  }

  /**
   * 注册关闭监听器
   * @param tabId - 标签页ID
   * @param callback - 关闭回调函数
   * @returns 取消监听函数
   */
  static onClose(tabId: string, callback: () => void): () => void {
    const connection = this.connections.get(tabId)
    if (!connection?.stream) {
      return () => {}
    }

    connection.stream.on('close', callback)

    return () => {
      connection.stream?.removeListener('close', callback)
    }
  }

  /**
   * 注册错误监听器
   * @param tabId - 标签页ID
   * @param callback - 错误回调函数
   * @returns 取消监听函数
   */
  static onError(tabId: string, callback: (error: Error) => void): () => void {
    const connection = this.connections.get(tabId)
    if (!connection?.client) {
      return () => {}
    }

    connection.client.on('error', callback)

    return () => {
      connection.client?.removeListener('error', callback)
    }
  }

  /**
   * 断开所有连接
   */
  static async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.keys()).map(tabId =>
      this.disconnect(tabId)
    )
    await Promise.all(disconnectPromises)
  }

  /**
   * 检查连接是否存在
   * @param tabId - 标签页ID
   * @returns 是否存在
   */
  static hasConnection(tabId: string): boolean {
    return this.connections.has(tabId)
  }

  /**
   * 断开所有使用指定会话ID的连接
   * @param sessionId - 会话ID
   */
  static async disconnectBySessionId(sessionId: string): Promise<void> {
    const tabIds: string[] = []
    this.connections.forEach((connection, tabId) => {
      if (connection.sessionId === sessionId) {
        tabIds.push(tabId)
      }
    })
    await Promise.all(tabIds.map(tabId => this.disconnect(tabId)))
  }

  /**
   * 获取连接数量
   * @returns 连接数量
   */
  static getConnectionCount(): number {
    return this.connections.size
  }
}
