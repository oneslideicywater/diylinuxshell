/**
 * CryptoService 单元测试
 * 测试加密服务的核心功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock electron safeStorage
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((text: string) => Buffer.from(`encrypted:${text}`)),
    decryptString: vi.fn((buffer: Buffer) => {
      const str = buffer.toString()
      if (str.startsWith('encrypted:')) {
        return str.replace('encrypted:', '')
      }
      return str
    })
  }
}))

import { CryptoService } from '../crypto'

describe('CryptoService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('isEncryptionAvailable', () => {
    it('should return true when encryption is available', () => {
      const result = CryptoService.isEncryptionAvailable()
      expect(result).toBe(true)
    })
  })

  describe('encrypt', () => {
    it('should encrypt plain text', () => {
      const plainText = 'my-password-123'
      const encrypted = CryptoService.encrypt(plainText)
      
      expect(encrypted).toBeDefined()
      expect(typeof encrypted).toBe('string')
      expect(encrypted).not.toBe(plainText)
    })

    it('should return empty string for empty input', () => {
      const result = CryptoService.encrypt('')
      expect(result).toBe('')
    })

    it('should return empty string for null/undefined input', () => {
      const result1 = CryptoService.encrypt(null as unknown as string)
      const result2 = CryptoService.encrypt(undefined as unknown as string)
      expect(result1).toBe('')
      expect(result2).toBe('')
    })
  })

  describe('decrypt', () => {
    it('should decrypt encrypted text', () => {
      const plainText = 'my-password-123'
      const encrypted = CryptoService.encrypt(plainText)
      const decrypted = CryptoService.decrypt(encrypted)
      
      expect(decrypted).toBe(plainText)
    })

    it('should return empty string for empty input', () => {
      const result = CryptoService.decrypt('')
      expect(result).toBe('')
    })
  })

  describe('generateId', () => {
    it('should generate unique ID', () => {
      const id1 = CryptoService.generateId()
      const id2 = CryptoService.generateId()
      
      expect(id1).toBeDefined()
      expect(id2).toBeDefined()
      expect(id1).not.toBe(id2)
    })

    it('should generate ID with prefix', () => {
      const id = CryptoService.generateId('session')
      expect(id).toMatch(/^session-/)
    })

    it('should generate ID without prefix', () => {
      const id = CryptoService.generateId()
      expect(id).not.toMatch(/^-/)
    })
  })

  describe('generateSessionId', () => {
    it('should generate session ID with correct prefix', () => {
      const id = CryptoService.generateSessionId()
      expect(id).toMatch(/^session-/)
    })

    it('should generate unique session IDs', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(CryptoService.generateSessionId())
      }
      expect(ids.size).toBe(100)
    })
  })

  describe('generateTabId', () => {
    it('should generate tab ID with correct prefix', () => {
      const id = CryptoService.generateTabId()
      expect(id).toMatch(/^tab-/)
    })
  })

  describe('generateTerminalId', () => {
    it('should generate terminal ID with correct prefix', () => {
      const id = CryptoService.generateTerminalId()
      expect(id).toMatch(/^terminal-/)
    })
  })

  describe('generateGroupId', () => {
    it('should generate group ID with correct prefix', () => {
      const id = CryptoService.generateGroupId()
      expect(id).toMatch(/^group-/)
    })
  })

  describe('generateSnippetId', () => {
    it('should generate snippet ID with correct prefix', () => {
      const id = CryptoService.generateSnippetId()
      expect(id).toMatch(/^snippet-/)
    })
  })

  describe('maskPassword', () => {
    it('should return empty string for empty password', () => {
      const result = CryptoService.maskPassword('')
      expect(result).toBe('')
    })

    it('should return masked string for password', () => {
      const result = CryptoService.maskPassword('password123')
      expect(result).toBe('••••••••')
    })

    it('should show first N characters when visibleChars is set', () => {
      const result = CryptoService.maskPassword('password123', 3)
      expect(result).toBe('pas•••••••')
    })

    it('should return full password when visibleChars >= password length', () => {
      const result = CryptoService.maskPassword('pass', 10)
      expect(result).toBe('pass')
    })
  })

  describe('checkPasswordStrength', () => {
    it('should return weak for empty password', () => {
      const result = CryptoService.checkPasswordStrength('')
      expect(result).toBe('weak')
    })

    it('should return weak for short password', () => {
      const result = CryptoService.checkPasswordStrength('abc')
      expect(result).toBe('weak')
    })

    it('should return weak for password less than 6 characters', () => {
      const result = CryptoService.checkPasswordStrength('abc12')
      expect(result).toBe('weak')
    })

    it('should return medium for moderate password', () => {
      const result = CryptoService.checkPasswordStrength('password123')
      expect(result).toBe('medium')
    })

    it('should return strong for complex password', () => {
      const result = CryptoService.checkPasswordStrength('P@ssw0rd!234')
      expect(result).toBe('strong')
    })

    it('should return strong for long password with mixed characters', () => {
      const result = CryptoService.checkPasswordStrength('MySecureP@ss2024!')
      expect(result).toBe('strong')
    })
  })
})
