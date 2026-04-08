/**
 * SFTP 传输树展开/折叠功能测试
 * 测试树形传输列表的展开/折叠功能
 * @module e2e/sftp/sftp-tree-expand-collapse
 */

import { test, expect } from '@playwright/test'
import { startApp, closeApp } from '../helpers/electron-app'
import type { ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// 测试会话配置（使用提供的测试服务器）
const TEST_SESSION = {
  name: 'SFTP Expand Collapse Test',
  host: '192.168.10.24',
  port: 22,
  username: 'root',
  password: 'One.00000'
}

// 本地测试文件夹
const TEST_FOLDER_PATH = 'D:\\sftp-test\\expand-collapse-test'

/**
 * 辅助函数：打开 SFTP 窗口
 */
async function openSFTPWindow(page: Page): Promise<void> {
  // 等待主界面加载完成
  await page.waitForSelector('.session-list', { timeout: 10000 })

  // 创建测试会话（如果不存在）
  await page.evaluate(async (sessionData) => {
    const sessions = await (window as any).api.session.getAll()
    const existing = sessions.find((s: any) => s.name === sessionData.name)
    if (!existing) {
      await (window as any).api.session.create(sessionData)
    }
  }, TEST_SESSION)

  await page.reload()
  await page.waitForSelector('.session-list', { timeout: 10000 })
  
  // 等待会话列表渲染
  await page.waitForTimeout(3000)

  // 点击展开分组
  const groupHeader = await page.locator('.group-header').first()
  await groupHeader.click({ force: true })
  
  // 等待分组展开
  try {
    await page.waitForSelector('.session-item', { timeout: 5000 })
  } catch (e) {
    await groupHeader.click({ force: true })
    await page.waitForSelector('.session-item', { timeout: 5000 })
  }
  
  await page.waitForTimeout(1000)

  // 找到测试会话
  const sessionItem = await page.locator('.session-item', {
    hasText: TEST_SESSION.name
  }).first()
  
  // 鼠标悬停显示操作按钮
  await sessionItem.scrollIntoViewIfNeeded({ force: true })
  await sessionItem.hover({ force: true })

  // 点击 SFTP 按钮
  const sftpButton = await sessionItem.locator('.action-btn.sftp').first()
  await sftpButton.click({ force: true })

  // 等待 SFTP 窗口打开
  await page.waitForSelector('.sftp-overlay', { timeout: 5000 })
  await page.waitForTimeout(3000)
}

/**
 * 辅助函数：创建测试文件夹和文件
 */
function createTestFolder(): void {
  // 创建多级文件夹结构
  const folders = [
    TEST_FOLDER_PATH,
    path.join(TEST_FOLDER_PATH, 'level1'),
    path.join(TEST_FOLDER_PATH, 'level1', 'level2'),
    path.join(TEST_FOLDER_PATH, 'another-folder')
  ]
  
  folders.forEach(folder => {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true })
    }
  })
  
  // 创建测试文件
  const files = [
    { path: path.join(TEST_FOLDER_PATH, 'file1.txt'), content: 'File 1' },
    { path: path.join(TEST_FOLDER_PATH, 'file2.txt'), content: 'File 2' },
    { path: path.join(TEST_FOLDER_PATH, 'level1', 'file3.txt'), content: 'File 3' },
    { path: path.join(TEST_FOLDER_PATH, 'level1', 'level2', 'file4.txt'), content: 'File 4' },
    { path: path.join(TEST_FOLDER_PATH, 'another-folder', 'file5.txt'), content: 'File 5' }
  ]
  
  files.forEach(file => {
    fs.writeFileSync(file.path, file.content)
  })
}

/**
 * 辅助函数：清理测试文件夹
 */
function cleanupTestFolder(): void {
  if (fs.existsSync(TEST_FOLDER_PATH)) {
    fs.rmSync(TEST_FOLDER_PATH, { recursive: true, force: true })
  }
}

test.describe('SFTP 传输树展开/折叠功能', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async () => {
    // 创建测试数据
    createTestFolder()
    
    const result = await startApp()
    app = result.app
    page = result.page
  })

  test.afterAll(async () => {
    // 清理测试数据
    cleanupTestFolder()
    await closeApp(app)
  })

  test('传输树应该默认折叠', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)

    // 选择本地文件面板
    const localPanel = page.locator('.file-panel.local')
    
    // 右键点击测试文件夹
    const testFolderItem = localPanel.locator('.file-item.directory', {
      hasText: 'expand-collapse-test'
    }).first()
    
    await testFolderItem.scrollIntoViewIfNeeded()
    await testFolderItem.click({ button: 'right', force: true })
    await page.waitForTimeout(500)

    // 点击上传菜单项
    const uploadMenuItem = page.locator('.context-menu-item', {
      hasText: '上传'
    }).first()
    await expect(uploadMenuItem).toBeVisible()
    await uploadMenuItem.click({ force: true })

    // 等待传输开始
    await page.waitForTimeout(2000)

    // 展开传输详情树
    const toggleButton = page.locator('.toggle-tree-btn')
    await toggleButton.click()
    await page.waitForTimeout(1000)

    // 验证树形面板显示
    const treePanel = page.locator('.tree-panel')
    await expect(treePanel).toBeVisible()

    // 验证节点默认是折叠的（子节点不可见）
    const treeNodes = page.locator('.tree-node')
    const firstNode = treeNodes.first()
    
    // 检查第一个节点是否有子节点但在折叠状态
    const childNodes = firstNode.locator('.children .tree-node')
    const childCount = await childNodes.count()
    
    // 默认折叠时，子节点不应该显示
    expect(childCount).toBe(0)
    
    // 关闭 SFTP 窗口
    const closeButton = page.locator('.header-btn.close').first()
    await closeButton.click()
    await page.waitForTimeout(1000)
  })

  test('点击展开图标应该只展开直接子节点', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)

    // 展开传输详情树（如果未展开）
    const toggleButton = page.locator('.toggle-tree-btn')
    const isExpanded = await toggleButton.isVisible()
    if (isExpanded) {
      await toggleButton.click()
      await page.waitForTimeout(1000)
    }

    // 找到第一个文件夹节点
    const folderNode = page.locator('.tree-node .node-row.is-folder').first()
    await folderNode.scrollIntoViewIfNeeded()
    
    // 点击展开图标
    const expandIcon = folderNode.locator('.expand-icon')
    await expandIcon.click()
    await page.waitForTimeout(500)

    // 验证直接子节点可见
    const parentElement = folderNode.locator('xpath=..')
    const directChildren = parentElement.locator('.children .tree-node > .node-row')
    const directChildrenCount = await directChildren.count()
    
    // 应该有直接子节点
    expect(directChildrenCount).toBeGreaterThan(0)
    
    // 验证孙子节点不可见（只展开一层）
    const grandChildren = parentElement.locator('.children .children .tree-node')
    const grandChildrenCount = await grandChildren.count()
    
    // 孙子节点不应该显示（因为只展开直接子节点）
    // 注意：如果直接子节点中有文件夹，它们的子节点（孙子）应该保持折叠
    const folderChildren = parentElement.locator('.children .tree-node .node-row.is-folder')
    const folderChildrenCount = await folderChildren.count()
    
    if (folderChildrenCount > 0) {
      // 如果有子文件夹，验证它们的子节点不可见
      const firstFolderChild = folderChildren.first()
      const firstFolderChildParent = firstFolderChild.locator('xpath=..')
      const subChildren = firstFolderChildParent.locator('.children .tree-node')
      const subChildrenCount = await subChildren.count()
      expect(subChildrenCount).toBe(0)
    }
    
    // 关闭 SFTP 窗口
    const closeButton = page.locator('.header-btn.close').first()
    await closeButton.click()
    await page.waitForTimeout(1000)
  })

  test('全部展开按钮应该展开所有层级', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)

    // 展开传输详情树
    const toggleButton = page.locator('.toggle-tree-btn')
    await toggleButton.click()
    await page.waitForTimeout(1000)

    // 点击全部展开按钮
    const expandAllButton = page.locator('.toolbar-btn', {
      hasText: '全部展开'
    })
    await expandAllButton.click()
    await page.waitForTimeout(500)

    // 验证所有层级都展开了
    // 检查是否有深层级的节点显示
    const allTreeNodes = page.locator('.tree-node')
    const nodeCount = await allTreeNodes.count()
    
    // 全部展开后，节点数量应该大于默认状态
    expect(nodeCount).toBeGreaterThan(1)
    
    // 验证有缩进层级较深的节点
    const deepNodes = page.locator('.tree-node[style*="padding-left: 40px"]')
    const deepNodeCount = await deepNodes.count()
    
    // 应该有深层级的节点（至少有一层子节点）
    expect(deepNodeCount).toBeGreaterThan(0)
    
    // 关闭 SFTP 窗口
    const closeButton = page.locator('.header-btn.close').first()
    await closeButton.click()
    await page.waitForTimeout(1000)
  })

  test('全部折叠按钮应该折叠所有节点', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)

    // 展开传输详情树
    const toggleButton = page.locator('.toggle-tree-btn')
    await toggleButton.click()
    await page.waitForTimeout(1000)

    // 先全部展开
    const expandAllButton = page.locator('.toolbar-btn', {
      hasText: '全部展开'
    })
    await expandAllButton.click()
    await page.waitForTimeout(500)

    // 点击全部折叠按钮
    const collapseAllButton = page.locator('.toolbar-btn', {
      hasText: '全部折叠'
    })
    await collapseAllButton.click()
    await page.waitForTimeout(500)

    // 验证所有节点都折叠了
    const allTreeNodes = page.locator('.tree-node')
    const nodeCount = await allTreeNodes.count()
    
    // 验证没有展开的子节点容器
    const expandedChildren = page.locator('.children .tree-node')
    const expandedChildrenCount = await expandedChildren.count()
    
    // 全部折叠后，不应该有可见的子节点
    expect(expandedChildrenCount).toBe(0)
    
    // 关闭 SFTP 窗口
    const closeButton = page.locator('.header-btn.close').first()
    await closeButton.click()
    await page.waitForTimeout(1000)
  })

  test('点击折叠图标应该折叠节点', async () => {
    // 打开 SFTP 窗口
    await openSFTPWindow(page)

    // 展开传输详情树
    const toggleButton = page.locator('.toggle-tree-btn')
    await toggleButton.click()
    await page.waitForTimeout(1000)

    // 找到第一个文件夹节点并展开
    const folderNode = page.locator('.tree-node .node-row.is-folder').first()
    await folderNode.scrollIntoViewIfNeeded()
    
    const expandIcon = folderNode.locator('.expand-icon')
    await expandIcon.click()
    await page.waitForTimeout(500)

    // 验证子节点可见
    const parentElement = folderNode.locator('xpath=..')
    let directChildren = parentElement.locator('.children .tree-node > .node-row')
    let directChildrenCount = await directChildren.count()
    expect(directChildrenCount).toBeGreaterThan(0)

    // 再次点击折叠图标
    await expandIcon.click()
    await page.waitForTimeout(500)

    // 验证子节点不可见
    directChildren = parentElement.locator('.children .tree-node > .node-row')
    directChildrenCount = await directChildren.count()
    expect(directChildrenCount).toBe(0)
    
    // 关闭 SFTP 窗口
    const closeButton = page.locator('.header-btn.close').first()
    await closeButton.click()
    await page.waitForTimeout(1000)
  })
})
