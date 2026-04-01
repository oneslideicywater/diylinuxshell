/**
 * SSH连接管理器
 * 管理 SSH 连接的创建、维护和销毁
 * @module services/ssh-manager
 */

import { Client, ClientChannel } from 'ssh2'
import type { Session } from '@shared/types'
import { CryptoService } from './crypto'

/**
 * SSH连接信息
 */
interface SSHConnection {
  /** 会话ID */
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
 */
export class SSHManager {
  /** 连接映射表 */
  private static connections: Map<string, SSHConnection> = new Map()

  /**
   * 创建SSH连接
   * @param session - 会话配置
   * @returns 连接ID
   */
  static async connect(session: Session): Promise<string> {
    // 如果已存在连接，先断开
    if (this.connections.has(session.id)) {
      await this.disconnect(session.id)
    }

    const client = new Client()
    const connection: SSHConnection = {
      sessionId: session.id,
      client,
      stream: null,
      status: 'connecting'
    }

    this.connections.set(session.id, connection)

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
      connectOptions.password = CryptoService.decrypt(session.password)
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
        client.shell((err, stream) => {
          if (err) {
            connection.status = 'error'
            connection.error = err.message
            reject(err)
            return
          }

          connection.stream = stream
          resolve(session.id)
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
   * @param sessionId - 会话ID
   */
  static async disconnect(sessionId: string): Promise<void> {
    const connection = this.connections.get(sessionId)
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
    this.connections.delete(sessionId)
  }

  /**
   * 获取连接状态
   * @param sessionId - 会话ID
   * @returns 连接状态
   */
  static getStatus(sessionId: string): SSHConnection['status'] | null {
    const connection = this.connections.get(sessionId)
    return connection?.status || null
  }

  /**
   * 获取连接信息
   * @param sessionId - 会话ID
   * @returns 连接信息
   */
  static getConnection(sessionId: string): SSHConnection | undefined {
    return this.connections.get(sessionId)
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
   * @param sessionId - 会话ID
   * @param data - 数据内容
   */
  static write(sessionId: string, data: string): void {
    const connection = this.connections.get(sessionId)
    if (connection?.stream) {
      connection.stream.write(data)
    }
  }

  /**
   * 调整终端大小
   * @param sessionId - 会话ID
   * @param rows - 行数
   * @param cols - 列数
   */
  static resize(sessionId: string, rows: number, cols: number): void {
    const connection = this.connections.get(sessionId)
    if (connection?.stream) {
      // setWindow 需要 4 个参数: rows, cols, height, width
      // height 和 width 是像素值，暂时使用默认值
      connection.stream.setWindow(rows, cols, 480, 640)
    }
  }

  /**
   * 注册数据监听器
   * @param sessionId - 会话ID
   * @param callback - 数据回调函数
   * @returns 取消监听函数
   */
  static onData(sessionId: string, callback: (data: string) => void): () => void {
    const connection = this.connections.get(sessionId)
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
   * @param sessionId - 会话ID
   * @param callback - 关闭回调函数
   * @returns 取消监听函数
   */
  static onClose(sessionId: string, callback: () => void): () => void {
    const connection = this.connections.get(sessionId)
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
   * @param sessionId - 会话ID
   * @param callback - 错误回调函数
   * @returns 取消监听函数
   */
  static onError(sessionId: string, callback: (error: Error) => void): () => void {
    const connection = this.connections.get(sessionId)
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
    const disconnectPromises = Array.from(this.connections.keys()).map(sessionId =>
      this.disconnect(sessionId)
    )
    await Promise.all(disconnectPromises)
  }

  /**
   * 检查连接是否存在
   * @param sessionId - 会话ID
   * @returns 是否存在
   */
  static hasConnection(sessionId: string): boolean {
    return this.connections.has(sessionId)
  }

  /**
   * 获取连接数量
   * @returns 连接数量
   */
  static getConnectionCount(): number {
    return this.connections.size
  }
}
