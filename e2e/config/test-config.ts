/**
 * E2E 测试环境配置
 * 用于存储真实的 SSH 连接信息
 */

export const testConfig = {
  ssh: {
    host: '192.168.10.24',
    port: 22,
    username: 'root',
    password: 'One.00000'
  }
} as const

/**
 * 生成唯一的会话名称
 * 用于避免测试用例之间的名称冲突
 */
export function generateUniqueName(prefix: string): string {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 1000)
  return `${prefix}_${timestamp}_${random}`
}

export type TestConfig = typeof testConfig
