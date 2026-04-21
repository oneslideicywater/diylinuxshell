/**
 * SFTP 文件浏览器状态管理单元测试（Pinia Store）
 * 
 * 测试场景：
 * 1. 状态初始化：新 connectionId 自动创建默认 local + remote 状态
 * 2. 本地文件操作：路径/文件列表的读写、默认目录初始化
 * 3. 远程文件操作：路径/文件列表的读写、默认目录初始化
 * 4. 连接隔离：不同 connectionId 状态完全独立
 * 5. 清理方法：removeConnection 和 clearAll
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSftpBrowserStore } from '@/stores/sftpBrowser'

/**
 * Mock window.api.sftp 对象（用于测试 API 调用）
 */
const mockSftpApi = {
  getHomeDir: vi.fn().mockResolvedValue({ success: true, data: 'C:\\Users\\test' }),
  getDrives: vi.fn().mockResolvedValue({ success: true, data: [{ name: 'C:', path: 'C:\\', isDirectory: true }] }),
  getLocalFiles: vi.fn().mockResolvedValue({ success: true, data: [] }),
  ensureDir: vi.fn().mockResolvedValue({ success: true }),
  listDir: vi.fn().mockResolvedValue({ success: true, data: [] }),
  mkdir: vi.fn().mockResolvedValue({ success: true }),
  dirname: vi.fn().mockImplementation((path: string) => {
    const result = { success: true, data: require('path').dirname(path) }
    return Promise.resolve(result)
  })
}

// 设置全局 mock
Object.defineProperty(globalThis, 'window', {
  value: {
    api: {
      sftp: mockSftpApi
    }
  },
  writable: true
})

describe('useSftpBrowserStore SFTP 文件浏览器状态管理', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    
    // 重置所有 mock 函数
    vi.clearAllMocks()
  })

  // ==================== 1. 状态初始化测试 ====================

  describe('状态初始化', () => {
    it('新 connectionId 应该自动创建默认的 local 和 remote 状态', () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-001'

      const state = store.getState(connectionId)

      expect(state).toBeDefined()
      expect(state.local.localPath).toBe('')
      expect(state.local.localFiles).toEqual([])
      expect(state.local.localFileCount).toBe(0)
      
      expect(state.remote.remotePath).toBe('/')
      expect(state.remote.remoteFiles).toEqual([])
      expect(state.remote.remoteFileCount).toBe(0)
      expect(state.remote.connectionId).toBe(connectionId)
    })

    it('多次调用 getState 应该返回同一个状态对象（缓存）', () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-002'

      const state1 = store.getState(connectionId)
      const state2 = store.getState(connectionId)

      expect(state1).toBe(state2)
    })

    it('stateMap 应该包含新创建的连接状态', () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-003'

      store.getState(connectionId)

      expect(store.stateMap.has(connectionId)).toBe(true)
    })
  })

  // ==================== 2. 本地文件操作测试 ====================

  describe('本地文件操作', () => {
    it('getLocalPath 应返回当前本地路径', () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-local-001'
      
      store.setLocalPath(connectionId, 'D:\\projects')
      
      expect(store.getLocalPath(connectionId).value).toBe('D:\\projects')
    })

    it('getLocalFiles 应返回当前本地文件列表', () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-local-002'
      const files = [
        { name: 'file1.txt', path: 'D:\\file1.txt', isDirectory: false },
        { name: 'folder1', path: 'D:\\folder1', isDirectory: true }
      ]
      
      store.setLocalFiles(connectionId, files)
      
      expect(store.getLocalFiles(connectionId).value).toEqual(files)
      expect(store.getLocalFileCount(connectionId).value).toBe(2)
    })

    it('setLocalPath 应正确更新本地路径', () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-local-003'

      store.setLocalPath(connectionId, 'C:\\Users')
      
      expect(store.getState(connectionId).local.localPath).toBe('C:\\Users')
    })

    it('setLocalFiles 应正确更新文件列表和计数', () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-local-004'
      const files = [{ name: 'test.ts', path: '/test.ts', isDirectory: false }]

      store.setLocalFiles(connectionId, files)

      expect(store.getState(connectionId).local.localFiles).toEqual(files)
      expect(store.getState(connectionId).local.localFileCount).toBe(1)
    })

    it('initDefaultDir 应调用 API 并设置 home 目录', async () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-local-005'

      await store.initLocalDefaultDir(connectionId)

      expect(mockSftpApi.getHomeDir).toHaveBeenCalledOnce()
      expect(store.getState(connectionId).local.localPath).toBe('C:\\Users\\test')
    })

    it('loadLocalFiles 应加载普通目录文件', async () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-local-006'
      const drivesPath = '此电脑'
      const testFiles = [
        { name: 'document.txt', path: 'D:\\doc\\document.txt', isDirectory: false }
      ]

      mockSftpApi.getLocalFiles.mockResolvedValueOnce({ success: true, data: testFiles })
      
      store.setLocalPath(connectionId, 'D:\\doc')
      await store.loadLocalFiles(connectionId, drivesPath)

      expect(mockSftpApi.getLocalFiles).toHaveBeenCalledWith('D:\\doc')
      expect(store.getState(connectionId).local.localFiles).toEqual(testFiles)
      expect(store.getState(connectionId).local.localFileCount).toBe(1)
    })

    it('loadLocalFiles 应加载盘符列表视图', async () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-local-007'
      const drivesPath = '此电脑'
      const drives = [
        { name: 'C:', path: 'C:\\', isDirectory: true },
        { name: 'D:', path: 'D:\\', isDirectory: true }
      ]

      mockSftpApi.getDrives.mockResolvedValueOnce({ success: true, data: drives })

      store.setLocalPath(connectionId, drivesPath)
      await store.loadLocalFiles(connectionId, drivesPath)

      expect(mockSftpApi.getDrives).toHaveBeenCalledOnce()
      expect(store.getState(connectionId).local.localFiles).toEqual(drives)
      expect(store.getState(connectionId).local.localPath).toBe(drivesPath)
    })
  })

  // ==================== 3. 远程文件操作测试 ====================

  describe('远程文件操作', () => {
    it('getRemotePath 应返回当前远程路径', () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-remote-001'
      
      store.setRemotePath(connectionId, '/home/user')
      
      expect(store.getRemotePath(connectionId).value).toBe('/home/user')
    })

    it('getRemoteFiles 应返回当前远程文件列表', () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-remote-002'
      const files = [
        { name: '.bashrc', path: '/home/user/.bashrc', isDirectory: false },
        { name: 'documents', path: '/home/user/documents', isDirectory: true }
      ]
      
      store.setRemoteFiles(connectionId, files)
      
      expect(store.getRemoteFiles(connectionId).value).toEqual(files)
      expect(store.getRemoteFileCount(connectionId).value).toBe(2)
    })

    it('setRemotePath 应正确更新远程路径', () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-remote-003'

      store.setRemotePath(connectionId, '/var/log')

      expect(store.getState(connectionId).remote.remotePath).toBe('/var/log')
    })

    it('setRemoteFiles 应正确更新远程文件列表和计数', () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-remote-004'
      const files = [{ name: 'config.json', path: '/etc/config.json', isDirectory: false }]

      store.setRemoteFiles(connectionId, files)

      expect(store.getState(connectionId).remote.remoteFiles).toEqual(files)
      expect(store.getState(connectionId).remote.remoteFileCount).toBe(1)
    })

    it('initRemoteDefaultDir 应将远程路径设置为 /', () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-remote-005'

      store.initRemoteDefaultDir(connectionId)

      expect(store.getState(connectionId).remote.remotePath).toBe('/')
    })

    it('loadRemoteFiles 应调用 API 并加载远程文件列表', async () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-remote-006'
      const remoteFiles = [
        { name: 'bin', path: '/bin', isDirectory: true },
        { name: 'etc', path: '/etc', isDirectory: true }
      ]

      mockSftpApi.listDir.mockResolvedValueOnce({ success: true, data: remoteFiles })

      await store.loadRemoteFiles(connectionId)

      expect(mockSftpApi.listDir).toHaveBeenCalledWith(connectionId, '/')
      expect(store.getState(connectionId).remote.remoteFiles).toEqual(remoteFiles)
      expect(store.getState(connectionId).remote.remoteFileCount).toBe(2)
    })

    it('loadRemoteFiles 在 connectionId 为空时应跳过', async () => {
      const store = useSftpBrowserStore()

      await store.loadRemoteFiles('')

      expect(mockSftpApi.listDir).not.toHaveBeenCalled()
    })

    it('createRemoteFolder 应调用 API 并刷新文件列表', async () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-remote-007'
      const refreshedFiles = [{ name: 'newFolder', path: '/newFolder', isDirectory: true }]

      mockSftpApi.mkdir.mockResolvedValueOnce({ success: true })
      mockSftpApi.listDir.mockResolvedValueOnce({ success: true, data: refreshedFiles })

      await store.createRemoteFolder(connectionId, 'newFolder')

      expect(mockSftpApi.mkdir).toHaveBeenCalledWith(connectionId, '/newFolder')
      expect(store.getState(connectionId).remote.remoteFiles).toEqual(refreshedFiles)
    })
  })

  // ==================== 4. 连接隔离测试 ====================

  describe('连接隔离', () => {
    it('不同 connectionId 的本地状态应该完全独立', () => {
      const store = useSftpBrowserStore()
      const connA = 'conn-isolate-A'
      const connB = 'conn-isolate-B'

      store.setLocalPath(connA, '/path/A')
      store.setLocalPath(connB, '/path/B')

      expect(store.getLocalPath(connA).value).toBe('/path/A')
      expect(store.getLocalPath(connB).value).toBe('/path/B')
    })

    it('不同 connectionId 的远程状态应该完全独立', () => {
      const store = useSftpBrowserStore()
      const connA = 'conn-isolate-C'
      const connB = 'conn-isolate-D'

      store.setRemotePath(connA, '/home/user1')
      store.setRemotePath(connB, '/home/user2')

      expect(store.getRemotePath(connA).value).toBe('/home/user1')
      expect(store.getRemotePath(connB).value).toBe('/home/user2')
    })

    it('一个连接的状态变更不应影响另一个连接', () => {
      const store = useSftpBrowserStore()
      const conn1 = 'conn-isolate-E'
      const conn2 = 'conn-isolate-F'

      const files1 = [{ name: 'file1.txt', path: '/file1.txt', isDirectory: false }]
      const files2 = [{ name: 'file2.txt', path: '/file2.txt', isDirectory: false }]

      store.setLocalFiles(conn1, files1)
      store.setLocalFiles(conn2, files2)

      expect(store.getLocalFiles(conn1).value).toEqual(files1)
      expect(store.getLocalFiles(conn2).value).toEqual(files2)

      store.setLocalPath(conn1, '/new/path')

      expect(store.getLocalPath(conn1).value).toBe('/new/path')
      expect(store.getLocalPath(conn2).value).toBe('')
    })
  })

  // ==================== 5. 清理方法测试 ====================

  describe('清理方法', () => {
    it('removeConnection 应删除指定连接的状态', () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-remove-001'

      store.getState(connectionId)
      expect(store.stateMap.has(connectionId)).toBe(true)

      store.removeConnection(connectionId)

      expect(store.stateMap.has(connectionId)).toBe(false)
    })

    it('removeConnection 不应影响其他连接', () => {
      const store = useSftpBrowserStore()
      const connKeep = 'conn-remove-002'
      const connRemove = 'conn-remove-003'

      store.getState(connKeep)
      store.getState(connRemove)

      store.removeConnection(connRemove)

      expect(store.stateMap.has(connKeep)).toBe(true)
      expect(store.stateMap.has(connRemove)).toBe(false)
    })

    it('clearAll 应清除所有连接状态', () => {
      const store = useSftpBrowserStore()

      store.getState('conn-clear-001')
      store.getState('conn-clear-002')
      store.getState('conn-clear-003')

      expect(store.stateMap.size).toBe(3)

      store.clearAll()

      expect(store.stateMap.size).toBe(0)
    })
  })

  // ==================== 6. 边界情况测试 ====================

  describe('边界情况', () => {
    it('空 connectionId 也应能创建状态', () => {
      const store = useSftpBrowserStore()

      const state = store.getState('')

      expect(state).toBeDefined()
      expect(state.remote.connectionId).toBe('')
    })

    it('设置空文件列表应将计数归零', () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-edge-001'

      store.setLocalFiles(connectionId, [{ name: 'f', path: '/f', isDirectory: false }])
      expect(store.getLocalFileCount(connectionId).value).toBe(1)

      store.setLocalFiles(connectionId, [])
      expect(store.getLocalFileCount(connectionId).value).toBe(0)
    })

    it('特殊字符路径应正常存储', () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-edge-002'
      const specialPath = 'D:\\中文文件夹\\special@#$%.txt'

      store.setLocalPath(connectionId, specialPath)

      expect(store.getLocalPath(connectionId).value).toBe(specialPath)
    })
  })

  // ==================== 7. 导航功能测试 ====================

  describe('navigateLocalUp 导航到上级目录', () => {
    const DRIVES_PATH = '此电脑'

    it('普通目录应返回父目录（如 D:\\doc\\test → D:\\doc）', async () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-nav-001'
      
      store.setLocalPath(connectionId, 'D:\\doc\\test')
      
      await store.navigateLocalUp(connectionId, DRIVES_PATH)
      
      expect(store.getLocalPath(connectionId).value).toBe('D:\\doc')
    })

    it('Windows 盘符根目录（C:\\）应跳转到"此电脑"', async () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-nav-002'
      
      store.setLocalPath(connectionId, 'C:\\')
      
      await store.navigateLocalUp(connectionId, DRIVES_PATH)
      
      expect(store.getLocalPath(connectionId).value).toBe(DRIVES_PATH)
    })

    it('Linux 根目录 / 应跳转到"此电脑"', async () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-nav-003'
      
      store.setLocalPath(connectionId, '/')
      
      await store.navigateLocalUp(connectionId, DRIVES_PATH)
      
      expect(store.getLocalPath(connectionId).value).toBe(DRIVES_PATH)
    })

    it('"此电脑"视图应保持不变（已是最顶层）', async () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-nav-004'
      
      store.setLocalPath(connectionId, DRIVES_PATH)
      
      await store.navigateLocalUp(connectionId, DRIVES_PATH)
      
      expect(store.getLocalPath(connectionId).value).toBe(DRIVES_PATH)
    })

    it('空路径应保持不变', async () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-nav-005'
      
      store.setLocalPath(connectionId, '')
      
      await store.navigateLocalUp(connectionId, DRIVES_PATH)
      
      expect(store.getLocalPath(connectionId).value).toBe('')
    })

    it('API 调用失败时应保持原路径不变', async () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-nav-006'
      const originalPath = 'D:\\projects\\test'
      
      store.setLocalPath(connectionId, originalPath)
      
      mockSftpApi.dirname.mockResolvedValueOnce({ success: false, error: '测试错误' })
      
      await store.navigateLocalUp(connectionId, DRIVES_PATH)
      
      expect(store.getLocalPath(connectionId).value).toBe(originalPath)
    })

    it('连续点击应逐级返回（D:\\a\\b\\c → D:\\a\\b → D:\\a → D:\\ → 此电脑）', async () => {
      const store = useSftpBrowserStore()
      const connectionId = 'conn-nav-007'
      
      store.setLocalPath(connectionId, 'D:\\a\\b\\c')
      
      await store.navigateLocalUp(connectionId, DRIVES_PATH)
      expect(store.getLocalPath(connectionId).value).toBe('D:\\a\\b')
      
      await store.navigateLocalUp(connectionId, DRIVES_PATH)
      expect(store.getLocalPath(connectionId).value).toBe('D:\\a')
      
      await store.navigateLocalUp(connectionId, DRIVES_PATH)
      expect(store.getLocalPath(connectionId).value).toBe('D:\\')
      
      await store.navigateLocalUp(connectionId, DRIVES_PATH)
      expect(store.getLocalPath(connectionId).value).toBe(DRIVES_PATH)
      
      await store.navigateLocalUp(connectionId, DRIVES_PATH)
      expect(store.getLocalPath(connectionId).value).toBe(DRIVES_PATH)
    })
  })
})
