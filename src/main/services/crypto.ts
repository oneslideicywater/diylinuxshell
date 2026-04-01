/**
 * 加密服务
 * 使用 Node.js crypto 模块实现密码加密解密
 * @module services/crypto
 */

import { safeStorage } from 'electron'

/**
 * 加密服务类
 * 使用 Electron 的 safeStorage API 进行安全的加密解密
 */
export class CryptoService {
  /**
   * 检查加密功能是否可用
   * @returns 是否可用
   */
  static isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  /**
   * 加密文本
   * @param plainText - 明文
   * @returns 加密后的字符串（Base64编码）
   */
  static encrypt(plainText: string): string {
    if (!plainText) {
      return ''
    }

    if (!this.isEncryptionAvailable()) {
      console.warn('Encryption not available, storing as plain text (not recommended)')
      return Buffer.from(plainText).toString('base64')
    }

    const encrypted = safeStorage.encryptString(plainText)
    return encrypted.toString('base64')
  }

  /**
   * 解密文本
   * @param encryptedText - 加密文本（Base64编码）
   * @returns 解密后的明文
   */
  static decrypt(encryptedText: string): string {
    if (!encryptedText) {
      return ''
    }

    if (!this.isEncryptionAvailable()) {
      console.warn('Encryption not available, returning decoded base64')
      return Buffer.from(encryptedText, 'base64').toString('utf-8')
    }

    try {
      const buffer = Buffer.from(encryptedText, 'base64')
      return safeStorage.decryptString(buffer)
    } catch (error) {
      console.error('Failed to decrypt:', error)
      return ''
    }
  }

  /**
   * 生成随机ID
   * @param prefix - ID前缀
   * @returns 唯一ID
   */
  static generateId(prefix: string = ''): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 11)
    return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`
  }

  /**
   * 生成会话ID
   * @returns 会话ID
   */
  static generateSessionId(): string {
    return this.generateId('session')
  }

  /**
   * 生成标签页ID
   * @returns 标签页ID
   */
  static generateTabId(): string {
    return this.generateId('tab')
  }

  /**
   * 生成终端ID
   * @returns 终端ID
   */
  static generateTerminalId(): string {
    return this.generateId('terminal')
  }

  /**
   * 生成分组ID
   * @returns 分组ID
   */
  static generateGroupId(): string {
    return this.generateId('group')
  }

  /**
   * 生成命令片段ID
   * @returns 命令片段ID
   */
  static generateSnippetId(): string {
    return this.generateId('snippet')
  }

  /**
   * 掩码密码（用于显示）
   * @param password - 密码
   * @param visibleChars - 可见字符数
   * @returns 掩码后的密码
   */
  static maskPassword(password: string, visibleChars: number = 0): string {
    if (!password) return ''
    if (visibleChars <= 0) return '••••••••'
    if (visibleChars >= password.length) return password
    
    const visible = password.substring(0, visibleChars)
    const masked = '•'.repeat(Math.min(password.length - visibleChars, 8))
    return visible + masked
  }

  /**
   * 验证密码强度
   * @param password - 密码
   * @returns 强度等级 (weak, medium, strong)
   */
  static checkPasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
    if (!password || password.length < 6) {
      return 'weak'
    }

    let strength = 0
    
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^a-zA-Z0-9]/.test(password)) strength++

    if (strength <= 2) return 'weak'
    if (strength <= 4) return 'medium'
    return 'strong'
  }
}
