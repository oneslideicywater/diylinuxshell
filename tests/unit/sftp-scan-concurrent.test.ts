/**
 * 并发扫描单元测试
 * 验证 scanLocalTree 和 scanRemoteTree 的并发扫描逻辑正确性
 * 
 * 测试覆盖：
 * 1. 基础扫描：纯文件目录
 * 2. 嵌套目录：多层级结构
 * 3. 统计准确性：totalFiles / size 聚集
 * 4. 错误隔离：子目录失败不影响其他
 * 5. 空目录处理
 * 6. 混合内容：文件 + 目录同层
 * 7. 排序稳定性：children 按名称排序
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { SFTPService } from '@main/services/sftp'
import type { TransferNode } from '@shared/types/sftp'

describe('SFTPService 并发扫描测试', () => {
  let service: SFTPService

  beforeEach(() => {
    service = new SFTPService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ──────────────────── 辅助函数 ────────────────────

  /**
   * 在临时目录创建测试用的本地目录结构
   * 返回创建的根目录路径，调用者负责清理
   */
  async function createTestDir(
    baseDir: string,
    structure: Record<string, string | Record<string, any>>
  ): Promise<string> {
    const rootPath = path.join(baseDir, `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    await fs.promises.mkdir(rootPath, { recursive: true })

    async function build(currentPath: string, obj: Record<string, any>) {
      for (const [name, content] of Object.entries(obj)) {
        const fullPath = path.join(currentPath, name)
        if (typeof content === 'string') {
          // 文件：content 为内容
          await fs.promises.writeFile(fullPath, content)
        } else if (typeof content === 'object' && content !== null) {
          // 目录：递归构建
          await fs.promises.mkdir(fullPath, { recursive: true })
          await build(fullPath, content as Record<string, any>)
        }
      }
    }

    await build(rootPath, structure)
    return rootPath
  }

  /**
   * 清理测试目录
   */
  async function cleanupDir(dirPath: string): Promise<void> {
    try {
      await fs.promises.rm(dirPath, { recursive: true, force: true })
    } catch {
      // 忽略清理错误
    }
  }

  /**
   * 递归统计树中所有文件节点数量（用于验证 totalFiles）
   */
  function countFiles(node: TransferNode): number {
    if (!node.isDirectory) return 1
    let count = 0
    if (node.children) {
      for (const child of node.children) {
        count += countFiles(child)
      }
    }
    return count
  }

  /**
   * 递归统计树中所有文件总大小（用于验证 size）
   */
  function countBytes(node: TransferNode): number {
    if (!node.isDirectory) return node.size || 0
    let bytes = 0
    if (node.children) {
      for (const child of node.children) {
        bytes += countBytes(child)
      }
    }
    return bytes
  }

  /**
   * 检查 children 是否按 name 字典序排列
   */
  function isSortedByName(node: TransferNode): boolean {
    if (!node.children || node.children.length <= 1) return true
    for (let i = 1; i < node.children.length; i++) {
      if (node.children[i - 1].name.localeCompare(node.children[i].name) > 0) {
        return false
      }
    }
    // 递归检查子节点
    return node.children.every(child => isSortedByName(child))
  }

  // ──────────────────── scanLocalTree 测试 ────────────────────

  describe('scanLocalTree 本地并发扫描', () => {
    let tmpBase: string

    beforeAll(async () => {
      tmpBase = path.join('D:\\', 'test-sftp-scan-tmp')
      await fs.promises.mkdir(tmpBase, { recursive: true })
    })

    afterAll(async () => {
      await cleanupDir(tmpBase)
    })

    it('应正确扫描纯文件目录', async () => {
      const dirPath = await createTestDir(tmpBase, {
        'alpha.txt': 'hello',
        'beta.txt': 'world',
        'gamma.txt': 'foo'
      })

      try {
        const result = await service.scanLocalTree(dirPath, '/remote')

        expect(result.success).toBe(true)
        expect(result.root).toBeDefined()
        expect(result.root!.isDirectory).toBe(true)
        expect(result.root!.name).toContain('test-')

        // 根节点应有3个文件子节点
        expect(result.root!.children).toHaveLength(3)

        // 所有子节点都应该是文件
        for (const child of result.root!.children!) {
          expect(child.isDirectory).toBe(false)
          expect(child.type).toBe('upload')
        }

        // 统计信息验证
        expect(result.root!.totalFiles).toBe(3)
        expect(countFiles(result.root!)).toBe(3)

      } finally {
        await cleanupDir(dirPath)
      }
    })

    it('应正确扫描嵌套目录结构', async () => {
      const dirPath = await createTestDir(tmpBase, {
        'folder-a': {
          'file1.txt': 'aaa',
          'file2.txt': 'bbb',
          'deep-folder': {
            'deep-file.txt': 'deep'
          }
        },
        'folder-b': {
          'file3.txt': 'ccc'
        },
        'root-file.txt': 'root'
      })

      try {
        const result = await service.scanLocalTree(dirPath, '/remote')

        expect(result.success).toBe(true)
        const root = result.root!

        // 根节点应有3个子项：folder-a, folder-b, root-file.txt
        expect(root.children).toHaveLength(3)

        // 找到文件夹和文件
        const folders = root.children!.filter(c => c.isDirectory)
        const files = root.children!.filter(c => !c.isDirectory)

        expect(folders).toHaveLength(2)
        expect(files).toHaveLength(1)

        // folder-a 应有3个子项：file1, file2, deep-folder
        const folderA = folders.find(f => f.name === 'folder-a')!
        expect(folderA.children).toHaveLength(3)

        // deep-folder 应有1个文件
        const deepFolder = folderA.children!.find(c => c.name === 'deep-folder')!
        expect(deepFolder.isDirectory).toBe(true)
        expect(deepFolder.children).toHaveLength(1)

        // 总文件数验证：5个文件 (root-file + folder-a的2个 + folder-b的1个 + deep-folder的1个)
        expect(root.totalFiles).toBe(5)
        expect(countFiles(root)).toBe(5)

      } finally {
        await cleanupDir(dirPath)
      }
    })

    it('统计信息 totalFiles 和 size 应准确', async () => {
      const dirPath = await createTestDir(tmpBase, {
        'a.txt': 'x'.repeat(100),
        'b.txt': 'y'.repeat(200),
        'sub': {
          'c.txt': 'z'.repeat(300)
        }
      })

      try {
        const result = await service.scanLocalTree(dirPath, '/remote')
        const root = result.root!

        // totalFiles 应为 3
        expect(root.totalFiles).toBe(3)
        expect(countFiles(root)).toBe(3)

        // size 应为 600 (100+200+300)
        expect(root.size).toBe(600)
        expect(countBytes(root)).toBe(600)

      } finally {
        await cleanupDir(dirPath)
      }
    })

    it('children 应按名称字典序排序（确定性顺序）', async () => {
      const dirPath = await createTestDir(tmpBase, {
        'zebra.txt': 'z',
        'apple.txt': 'a',
        'middle.txt': 'm',
        'delta-dir': {
          'inner.txt': 'i'
        }
      })

      try {
        const result = await service.scanLocalTree(dirPath, '/remote')
        const root = result.root!

        // 验证排序
        expect(isSortedByName(root)).toBe(true)

        // 具体顺序应为：apple, delta-dir, middle, zebra
        const names = root.children!.map(c => c.name)
        expect(names).toEqual(['apple.txt', 'delta-dir', 'middle.txt', 'zebra.txt'])

      } finally {
        await cleanupDir(dirPath)
      }
    })

    it('空目录应返回只有目录节点的结果', async () => {
      const dirPath = await createTestDir(tmpBase, {})

      try {
        const result = await service.scanLocalTree(dirPath, '/remote')

        expect(result.success).toBe(true)
        expect(result.root!.isDirectory).toBe(true)
        expect(result.root!.children).toHaveLength(0)
        expect(result.root!.totalFiles).toBe(0)
        expect(result.root!.size).toBe(0)

      } finally {
        await cleanupDir(dirPath)
      }
    })

    it('单文件路径应直接返回文件节点', async () => {
      const dirPath = await createTestDir(tmpBase, {
        'solo.txt': 'single file content here'
      })
      const filePath = path.join(dirPath, 'solo.txt')

      try {
        const result = await service.scanLocalTree(filePath, '/remote')

        expect(result.success).toBe(true)
        expect(result.root!.isDirectory).toBe(false)
        expect(result.root!.name).toBe('solo.txt')
        expect(result.root!.size).toBe(24)
        expect(result.totalFiles).toBe(1)

      } finally {
        await cleanupDir(dirPath)
      }
    })

    it('部分子目录不可访问时，其他目录正常扫描并生成错误节点', async () => {
      const dirPath = await createTestDir(tmpBase, {
        'good-dir': {
          'ok.txt': 'fine'
        },
        'another-good': {
          'also-ok.txt': 'works'
        }
      })

      try {
        // 删除一个子目录的权限来模拟访问失败（Windows 下用只读模拟）
        const badDirPath = path.join(dirPath, 'bad-dir')
        await fs.promises.mkdir(badDirPath, { recursive: true })
        // 在 Windows 上删除后立即尝试扫描可能成功，用特殊方式模拟
        // 这里通过 spy on readdir 来模拟权限错误

        const originalReaddir = fs.promises.readdir
        const mockReaddir = vi.fn().mockImplementation((dirPathArg: string, opts?: any) => {
          if (String(dirPathArg).includes('bad-dir')) {
            return Promise.reject(new Error('EACCES: permission denied'))
          }
          return originalReaddir(dirPathArg, opts)
        })
        vi.spyOn(fs.promises, 'readdir').mockImplementation(mockReaddir as any)

        // 手动在文件系统上创建 bad-dir 条目（让 listDir 能看到它）
        // 由于我们 mock 了 readdir，需要让初始的 readdir 返回包含 bad-dir 的列表
        // 更好的方式：直接构造一个有 bad-dir 子目录的真实场景

        // 恢复原始实现，改用真实目录 + 删除 bad-dir 来触发错误
        vi.restoreAllMocks()

        // 真实场景：创建一个目录然后删掉它（模拟竞态条件）
        const realBadDir = path.join(dirPath, 'bad-permission-dir')
        await fs.promises.mkdir(realBadDir, { recursive: true })
        await fs.promises.rmdir(realBadDir)

        // 此时 dirPath 的 children 包含 good-dir, another-good
        // 但 bad-permission-dir 已不存在，readdir 不会列出它
        // 所以我们需要另一种方式来测试错误处理

        // 改用 mock 方式：先获取真实的 readdir 结果，注入一个坏目录
        const realEntries = await originalReaddir(dirPath, { withFileTypes: true })
        
        const injectedReaddir = vi.fn().mockImplementation((dirPathArg: string, opts?: any) => {
          if (dirPathArg === dirPath) {
            // 注入一个虚假的坏目录条目
            return Promise.resolve([
              ...realEntries,
              {
                name: 'bad-injected-dir',
                isDirectory: () => true,
                isFile: () => false,
                isSymbolicLink: () => false,
              } as any
            ])
          }
          if (String(dirPathArg).includes('bad-injected-dir')) {
            return Promise.reject(new Error('EACCES: permission denied'))
          }
          return originalReaddir(dirPathArg, opts)
        })
        vi.spyOn(fs.promises, 'readdir').mockImplementation(injectedReaddir as any)

        const result = await service.scanLocalTree(dirPath, '/remote')
        const root = result.root!

        // 应该有 3 个子目录：good-dir, another-good, bad-injected-dir(error)
        expect(root.children).toBeDefined()
        expect(root.children!.length).toBeGreaterThanOrEqual(3)

        // 找到错误节点
        const errorNode = root.children!.find(c => c.status === 'error')
        expect(errorNode).toBeDefined()
        expect(errorNode!.name).toBe('bad-injected-dir')
        expect(errorNode!.error).toContain('无法访问')

        // 正常目录应该被正确扫描
        const goodNode = root.children!.find(c => c.name === 'good-dir')
        expect(goodNode).toBeDefined()
        expect(goodNode!.status).toBe('pending')
        expect(goodNode!.children?.length).toBeGreaterThan(0)

      } finally {
        vi.restoreAllMocks()
        await cleanupDir(dirPath)
      }
    })

    it('深层嵌套目录（10层）应正确扫描且不丢失节点', async () => {
      // 动态构建10层嵌套结构
      const deepStructure: Record<string, any> = {}
      let current = deepStructure
      for (let i = 1; i <= 10; i++) {
        current[`level${i}`] = {}
        current = current[`level${i}`]
      }
      current['leaf.txt'] = 'deep file'

      const dirPath = await createTestDir(tmpBase, { 'root-deep': deepStructure })

      try {
        const result = await service.scanLocalTree(dirPath, '/remote')
        const root = result.root!

        // 从 root-deep 开始逐层深入验证
        let currentLevel: TransferNode = root.children!.find(c => c.name === 'root-deep')!
        expect(currentLevel.isDirectory).toBe(true)

        for (let i = 1; i <= 10; i++) {
          const nextLevel = currentLevel.children!.find(c => c.name === `level${i}`)
          expect(nextLevel).toBeDefined()
          expect(nextLevel!.isDirectory).toBe(true)
          currentLevel = nextLevel!
        }

        // 最深层应有 leaf.txt
        expect(currentLevel.children!.length).toBe(1)
        expect(currentLevel.children![0].name).toBe('leaf.txt')
        expect(currentLevel.children![0].isDirectory).toBe(false)

        // 总文件数 = 1
        expect(root.totalFiles).toBe(1)

      } finally {
        await cleanupDir(dirPath)
      }
    })

    it('大量子目录（20个）应全部扫描完成', async () => {
      const structure: Record<string, any> = {}
      for (let i = 0; i < 20; i++) {
        structure[`dir-${String(i).padStart(2, '0')}`] = {
          [`file-${i}.txt`]: `content of file ${i}`
        }
      }

      const dirPath = await createTestDir(tmpBase, structure)

      try {
        const result = await service.scanLocalTree(dirPath, '/remote')
        const root = result.root!

        // 20个子目录
        expect(root.children).toHaveLength(20)

        // 每个子目录应有1个文件
        for (const child of root.children!) {
          expect(child.isDirectory).toBe(true)
          expect(child.children).toHaveLength(1)
          expect(child.children![0].isDirectory).toBe(false)
        }

        // 总文件数 = 20
        expect(root.totalFiles).toBe(20)
        expect(countFiles(root)).toBe(20)

        // 排序检查
        expect(isSortedByName(root)).toBe(true)

      } finally {
        await cleanupDir(dirPath)
      }
    })
  })

  // ──────────────────── scanRemoteTree 测试 ────────────────────

  describe('scanRemoteTree 远程并发扫描', () => {

    /**
     * 设置远程扫描所需的 mock 环境
     * 1. 注入 sftpHandle（绕过连接检查）
     * 2. 配置 stat() 返回值（判断文件/目录类型）
     * 3. 配置 listDir() 返回值（目录内容列表）
     */
    function setupRemoteScanMocks(
      serviceInstance: SFTPService,
      basePath: string,
      structure: Record<string, { type: 'file' | 'dir'; size?: number; children?: Record<string, any> }>,
      isDir: boolean = true
    ) {
      // 注入 sftpHandle：stat() 对 basePath 返回 isDir，其他路径根据 structure 判断
      (serviceInstance as any).sftpHandle = {
        stat: (p: string, cb: (err: Error | null, stats?: any) => void) => {
          if (p === basePath) {
            cb(null, { isDirectory: () => isDir })
            return
          }
          // 根据路径在 structure 中查找
          const relativePath = p.startsWith(basePath) ? p.slice(basePath.length + 1) : p
          const parts = relativePath.split('/').filter(Boolean)

          let current: Record<string, any> = structure
          for (const part of parts.slice(0, -1)) {
            if (!current[part]?.children) {
              cb(new Error(`Not found: ${p}`))
              return
            }
            current = current[part].children
          }
          const lastPart = parts[parts.length - 1]
          if (!current[lastPart]) {
            cb(new Error(`Not found: ${p}`))
            return
          }
          cb(null, { isDirectory: () => current[lastPart].type === 'dir', size: current[lastPart].size || 0 })
        }
      }

      // Mock listDir：根据 structure 构建返回值
      vi.spyOn(serviceInstance, 'listDir').mockImplementation(async (p: string) => {
        if (p === basePath) {
          return Object.entries(structure).map(([name, info]) => ({
            name,
            path: `${p}/${name}`,
            isDirectory: info.type === 'dir',
            size: info.size || (info.type === 'dir' ? 0 : 1024),
            modifyTime: new Date(),
            isSymbolicLink: false
          }))
        }

        // 递归查找子路径对应的结构
        const relativePath = p.startsWith(basePath) ? p.slice(basePath.length + 1) : p
        const parts = relativePath.split('/').filter(Boolean)

        let current: Record<string, any> = structure
        for (const part of parts.slice(0, -1)) {
          if (!current[part]?.children) throw new Error(`Unexpected listDir path: ${p}`)
          current = current[part].children
        }
        const lastPart = parts[parts.length - 1]
        if (!current[lastPart]?.children) throw new Error(`Unexpected listDir path: ${p}`)

        const subStructure = current[lastPart].children
        return Object.entries(subStructure).map(([name, info]) => ({
          name,
          path: `${p}/${name}`,
          isDirectory: info.type === 'dir',
          size: info.size || (info.type === 'dir' ? 0 : 1024),
          modifyTime: new Date(),
          isSymbolicLink: false
        }))
      })
    }

    it('应正确扫描远程纯文件目录', async () => {
      const remotePath = '/home/user/test-files'
      const testStructure = {
        'readme.md': { type: 'file', size: 2048 },
        'config.json': { type: 'file', size: 512 },
        'data.csv': { type: 'file', size: 4096 }
      }

      setupRemoteScanMocks(service, remotePath, testStructure)

      const result = await service.scanRemoteTree(remotePath, '/local/download')

      expect(result.success).toBe(true)
      const root = result.root!

      expect(root.isDirectory).toBe(true)
      expect(root.name).toBe('test-files')
      expect(root.children).toHaveLength(3)

      for (const child of root.children!) {
        expect(child.isDirectory).toBe(false)
        expect(child.type).toBe('download')
      }

      expect(root.totalFiles).toBe(3)
      expect(root.size).toBe(2048 + 512 + 4096)
    })

    it('应正确扫描远程嵌套目录', async () => {
      const remotePath = '/home/user/project'
      const testStructure = {
        'src': {
          type: 'dir',
          children: {
            'index.ts': { type: 'file', size: 1024 },
            'utils.ts': { type: 'file', size: 2048 }
          }
        },
        'dist': {
          type: 'dir',
          children: {
            'bundle.js': { type: 'file', size: 50000 }
          }
        },
        'package.json': { type: 'file', size: 800 }
      }

      setupRemoteScanMocks(service, remotePath, testStructure)

      const result = await service.scanRemoteTree(remotePath, '/local/download')
      const root = result.root!

      expect(root.children).toHaveLength(3)

      const srcDir = root.children!.find(c => c.name === 'src')!
      expect(srcDir.children).toHaveLength(2)

      const distDir = root.children!.find(c => c.name === 'dist')!
      expect(distDir.children).toHaveLength(1)

      expect(root.totalFiles).toBe(4)
      expect(countFiles(root)).toBe(4)
    })

    it('远程子目录扫描失败时应生成错误节点且不影响其他目录', async () => {
      const remotePath = '/home/user/mixed'

      // 注入 sftpHandle
      ;(service as any).sftpHandle = {
        stat: (_p: string, cb: (err: Error | null, stats?: any) => void) => {
          cb(null, { isDirectory: () => true })
        }
      }

      // Mock listDir：对 fail-dir 的子路径抛出异常
      vi.spyOn(service, 'listDir').mockImplementation(async (p: string) => {
        if (p === remotePath) {
          return [
            { name: 'ok-dir', path: `${p}/ok-dir`, isDirectory: true, size: 0, modifyTime: new Date() },
            { name: 'fail-dir', path: `${p}/fail-dir`, isDirectory: true, size: 0, modifyTime: new Date() },
            { name: 'normal.txt', path: `${p}/normal.txt`, isDirectory: false, size: 100, modifyTime: new Date() }
          ]
        }
        if (p === `${remotePath}/ok-dir`) {
          return [
            { name: 'inner.txt', path: `${p}/inner.txt`, isDirectory: false, size: 50, modifyTime: new Date() }
          ]
        }
        if (p.includes('fail-dir')) {
          throw new Error('Permission denied')
        }
        throw new Error(`Unexpected path: ${p}`)
      })

      const result = await service.scanRemoteTree(remotePath, '/local/download')
      const root = result.root!

      expect(root.children).toHaveLength(3)

      const okDir = root.children!.find(c => c.name === 'ok-dir')!
      expect(okDir.status).toBe('pending')
      expect(okDir.children).toHaveLength(1)

      const failDir = root.children!.find(c => c.name === 'fail-dir')!
      expect(failDir.status).toBe('error')
      expect(failDir.error).toContain('无法访问目录')

      const normalFile = root.children!.find(c => c.name === 'normal.txt')!
      expect(normalFile.isDirectory).toBe(false)
      expect(normalFile.status).toBe('pending')

      expect(root.totalFiles).toBe(2)
    })

    it('远程空目录应返回空 children 且 totalFiles=0', async () => {
      const remotePath = '/home/user/empty-folder'

      ;(service as any).sftpHandle = {
        stat: (_p: string, cb: (err: Error | null, stats?: any) => void) => {
          cb(null, { isDirectory: () => true })
        }
      }

      vi.spyOn(service, 'listDir').mockResolvedValue([])

      const result = await service.scanRemoteTree(remotePath, '/local/download')

      expect(result.success).toBe(true)
      expect(result.root!.children).toHaveLength(0)
      expect(result.root!.totalFiles).toBe(0)
      expect(result.root!.size).toBe(0)
    })

    it('远程单文件应直接返回文件节点', async () => {
      const remotePath = '/home/user/readme.txt'

      ;(service as any).sftpHandle = {
        stat: (_p: string, cb: (err: Error | null, stats?: any) => void) => {
          cb(null, { isDirectory: () => false, size: 9999 })
        }
      }

      const result = await service.scanRemoteTree(remotePath, '/local/download')

      expect(result.success).toBe(true)
      expect(result.root!.isDirectory).toBe(false)
      expect(result.root!.name).toBe('readme.txt')
      expect(result.root!.size).toBe(9999)
      expect(result.totalFiles).toBe(1)
    })

    it('远程扫描 children 应按名称字典序排序', async () => {
      const remotePath = '/home/user/sort-test'
      const testStructure = {
        'z-last': { type: 'dir', children: { 'item.txt': { type: 'file', size: 50 } } },
        'a-first': { type: 'dir', children: { 'item.txt': { type: 'file', size: 50 } } },
        'm-middle': { type: 'file', size: 100 }
      }

      setupRemoteScanMocks(service, remotePath, testStructure)

      const result = await service.scanRemoteTree(remotePath, '/local/download')
      const root = result.root!

      expect(isSortedByName(root)).toBe(true)

      const names = root.children!.map(c => c.name)
      expect(names).toEqual(['a-first', 'm-middle', 'z-last'])
    })
  })
})
