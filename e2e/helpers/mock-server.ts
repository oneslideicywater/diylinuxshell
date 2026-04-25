import { Server } from 'net'
import { EventEmitter } from 'events'

/**
 * Mock SSH服务器配置
 */
interface MockSSHServerConfig {
  port: number
  host?: string
}

/**
 * Mock SSH服务器
 * 用于E2E测试，模拟SSH服务器响应
 */
export class MockSSHServer extends EventEmitter {
  private server: Server | null = null
  private config: MockSSHServerConfig
  private connections: Set<import('net').Socket> = new Set()

  constructor(config: MockSSHServerConfig) {
    super()
    this.config = config
  }

  /**
   * 启动Mock服务器
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = new Server(socket => {
        this.connections.add(socket)

        socket.on('data', data => {
          // 模拟SSH协议响应
          this.emit('data', data)
          socket.write(this.createMockResponse(data))
        })

        socket.on('close', () => {
          this.connections.delete(socket)
        })

        socket.on('error', err => {
          this.emit('error', err)
        })
      })

      this.server.listen(this.config.port, this.config.host || 'localhost', () => {
        resolve()
      })

      this.server.on('error', reject)
    })
  }

  /**
   * 停止Mock服务器
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve()
        return
      }

      // 关闭所有连接
      for (const conn of this.connections) {
        conn.destroy()
      }
      this.connections.clear()

      this.server.close(err => {
        if (err) {
          reject(err)
        } else {
          this.server = null
          resolve()
        }
      })
    })
  }

  /**
   * 创建Mock响应
   */
  private createMockResponse(data: Buffer): Buffer {
    // 简单的echo响应
    return Buffer.concat([Buffer.from('Mock: '), data])
  }

  /**
   * 获取服务器地址
   */
  get address(): { host: string; port: number } {
    return {
      host: this.config.host || 'localhost',
      port: this.config.port
    }
  }
}

/**
 * 创建Mock SSH服务器实例
 */
export function createMockSSHServer(port: number = 2222): MockSSHServer {
  return new MockSSHServer({ port })
}
