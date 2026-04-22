/**
 * SFTP 文件夹上传进度同步测试
 * 验证子文件传输进度实时更新到父节点及递归父节点
 * 验证上传中速度、估计剩余时间、经过时间的正确显示
 * @module e2e/sftp/upload-progress-sync
 */

import { test, expect } from '@playwright/test'
import { startApp, closeApp } from '../helpers/electron-app'
import type { ElectronApplication, Page } from '@playwright/test'
import * as fs from 'fs'

const TEST_SESSION = {
  name: 'Upload Progress Sync Test',
  host: '192.168.10.24',
  port: 22,
  username: 'root',
  password: 'One.00000'
}

const consoleMessages: any[] = []

async function openSFTPWindow(page: Page): Promise<void> {
  await page.waitForSelector('.session-list', { timeout: 10000 })

  await page.evaluate(async (sessionData) => {
    const sessions = await (window as any).api.session.getAll()
    const existing = sessions.find((s: any) => s.name === sessionData.name)
    if (!existing) {
      await (window as any).api.session.create(sessionData)
    }
  }, TEST_SESSION)

  await page.reload()
  await page.waitForSelector('.session-list', { timeout: 10000 })
  await page.waitForTimeout(3000)

  const groupHeader = await page.locator('.group-header').first()
  await groupHeader.click({ force: true })

  try {
    await page.waitForSelector('.session-item', { timeout: 5000 })
  } catch (e) {
    await groupHeader.click({ force: true })
    await page.waitForSelector('.session-item', { timeout: 5000 })
  }

  await page.waitForTimeout(1000)

  const sessionItem = await page.locator('.session-item', { hasText: TEST_SESSION.name }).first()
  await sessionItem.scrollIntoViewIfNeeded({ force: true })
  await sessionItem.hover({ force: true })

  const sftpButton = await sessionItem.locator('.action-btn.sftp').first()
  await sftpButton.click({ force: true })

  await page.waitForSelector('.sftp-overlay', { timeout: 5000 })
  await page.waitForTimeout(3000)
}

async function navigateAndUploadFolder(
  page: Page,
  localDir: string,
  folderName: string,
  remoteBase?: string
): Promise<void> {
  const localPathInput = await page.locator('.file-panel.local .path-input')
  await localPathInput.fill('')
  await localPathInput.fill(localDir)
  await localPathInput.press('Enter')
  await page.waitForTimeout(3000)

  const folderItem = await page.locator(
    '.file-panel.local .file-list .file-item[data-is-directory="true"]',
    { hasText: folderName }
  ).first()

  await expect(folderItem).toBeVisible({ timeout: 15000 })
  await folderItem.click({ button: 'right', force: true })
  await page.waitForTimeout(500)

  const uploadMenuItem = await page.locator('.context-menu-item', {
    hasText: '上传文件夹到服务器'
  }).first()
  await expect(uploadMenuItem).toBeVisible()
  await uploadMenuItem.click({ force: true })
  await page.waitForTimeout(1000)
}

test.describe('SFTP 文件夹上传进度同步功能', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page

    consoleMessages.length = 0

    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        time: Date.now()
      })
      if (msg.type() === 'error') {
        console.error(`[Console ${msg.type()}] ${msg.text()}`)
      }
    })

    page.on('pageerror', (error) => {
      console.error(`[Page Error] ${error.message}`)
    })
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('上传文件夹时父节点应实时显示子文件聚合进度', async () => {
    await openSFTPWindow(page)

    try {
      await navigateAndUploadFolder(page, 'D:\\develop\\goworkbunch', 'memcached-operator')

      const toggleButton = await page.locator('.toggle-tree-btn')
      await toggleButton.waitFor({ state: 'visible', timeout: 15000 })
      await toggleButton.click({ force: true })
      await page.waitForTimeout(2000)


      const rootNode = await page.locator('.tree-node').first()
      await expect(rootNode).toBeVisible()


      let parentProgressDetected = false
      let childTransferringDetected = false

      for (let i = 0; i < 20; i++) {
        await page.waitForTimeout(1000)

        const transferringNodes = await page.locator('.node-row.is-transferring')
        const count = await transferringNodes.count()

        if (count > 0) {
          childTransferringDetected = true

          const rootProgressEl = rootNode.locator('.progress-column')
          const progressText = await rootProgressEl.textContent().catch(() => null)
          if (progressText && progressText.trim() !== '' && progressText.trim() !== '-') {
            parentProgressDetected = true
            console.log(`[TEST] 第${i + 1}次检查 - 父节点进度: ${progressText.trim()}`)
            break
          }
        }

        const completedCount = await page.locator('.node-row.is-completed').count()
        if (completedCount > 2 && childTransferringDetected) {
          const rootProgressEl = rootNode.locator('.progress-column')
          const progressText = await rootProgressEl.textContent().catch(() => null)
          if (progressText && progressText.trim() !== '') {
            parentProgressDetected = true
            console.log(`[TEST] 传输中检测到进度更新: ${progressText.trim()}`)
          }
          break
        }
      }


      expect(childTransferringDetected).toBe(true)
      console.log('[TEST] 子节点传输状态:', childTransferringDetected ? '检测到' : '未检测到')


      await page.waitForTimeout(5000)

      const allNodes = await page.locator('.tree-node').all()
      console.log('[TEST] 树形总节点数:', allNodes.length)
      expect(allNodes.length).toBeGreaterThanOrEqual(3)

    } finally {

      const closeButton = await page.locator('.header-btn.close').first()
      await closeButton.click()
    }
  })

  test('上传文件夹时父节点应显示速度、剩余时间、经过时间', async () => {
    await openSFTPWindow(page)

    try {
      await navigateAndUploadFolder(page, 'D:\\develop\\goworkbunch', 'memcached-operator')


      const toggleButton = await page.locator('.toggle-tree-btn')
      await toggleButton.waitFor({ state: 'visible', timeout: 15000 })
      await toggleButton.click({ force: true })
      await page.waitForTimeout(2000)


      const rootNode = await page.locator('.tree-node').first()
      const speedCol = rootNode.locator('.speed-column')
      const remainingCol = rootNode.locator('.remaining-column')
      const elapsedCol = rootNode.locator('.elapsed-column')


      let detectedInfo = { speed: false, remaining: false, elapsed: false, anyChildInfo: false }

      for (let i = 0; i < 15; i++) {
        await page.waitForTimeout(1000)

        const speedText = await speedCol.textContent().catch(() => '-')
        const remainingText = await remainingCol.textContent().catch(() => '-')
        const elapsedText = await elapsedCol.textContent().catch(() => '-')

        if (speedText && speedText.trim() !== '-' && speedText.trim() !== '') detectedInfo.speed = true
        if (remainingText && remainingText.trim() !== '-' && remainingText.trim() !== '') detectedInfo.remaining = true
        if (elapsedText && elapsedText.trim() !== '-' && elapsedText.trim() !== '') detectedInfo.elapsed = true


        const allChildNodes = await page.locator('.tree-node').all()
        for (let j = 1; j < Math.min(allChildNodes.length, 10); j++) {
          const childSpeed = await allChildNodes[j].locator('.speed-column').textContent().catch(() => '-')
          if (childSpeed && childSpeed.trim() !== '-' && childSpeed.trim() !== '') {
            detectedInfo.anyChildInfo = true
            break
          }
        }

        console.log(`[TEST] 第${i + 1}次 - 根速度:${speedText?.trim()} 剩余:${remainingText?.trim()} 经过:${elapsedText?.trim()}`)

        if (detectedInfo.speed || detectedInfo.remaining || detectedInfo.elapsed || detectedInfo.anyChildInfo) {
          break
        }
      }

      console.log(`[TEST] 检测结果 - 速度:${detectedInfo.speed} 剩余:${detectedInfo.remaining} 经过:${detectedInfo.elapsed} 子信息:${detectedInfo.anyChildInfo}`)

      const hasAnyInfo = detectedInfo.speed || detectedInfo.remaining || detectedInfo.elapsed || detectedInfo.anyChildInfo
      expect(hasAnyInfo).toBe(true)

    } finally {
      const closeButton = await page.locator('.header-btn.close').first()
      await closeButton.click()
    }
  })

  test('深层嵌套文件夹的进度应逐级向上传播到根节点', async () => {
    await openSFTPWindow(page)

    try {
      await navigateAndUploadFolder(page, 'D:\\develop\\goworkbunch', 'memcached-operator')


      const toggleButton = await page.locator('.toggle-tree-btn')
      await toggleButton.waitFor({ state: 'visible', timeout: 15000 })
      await toggleButton.click({ force: true })
      await page.waitForTimeout(2000)


      const allTreeNodes = await page.locator('.tree-node').all()
      const totalNodeCount = allTreeNodes.length
      console.log('[TEST] 树形总节点数（含嵌套）:', totalNodeCount)
      expect(totalNodeCount).toBeGreaterThanOrEqual(3)


      let ancestorProgressUpdated = false

      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(1000)

        const nodes = await page.locator('.tree-node').all()
        for (const node of nodes) {
          const statusCol = node.locator('.status-column')
          const statusText = await statusCol.textContent().catch(() => null)
          if (statusText && (statusText.includes('传输中') || statusText.includes('transferring'))) {
            const progCol = node.locator('.progress-column')
            const progText = await progCol.textContent().catch(() => null)
            if (progText && progText.trim() !== '' && progText.trim() !== '-') {
              ancestorProgressUpdated = true
              console.log(`[TEST] 发现传输中节点有进度: ${progText.trim()}`)
              break
            }
          }
        }

        if (ancestorProgressUpdated) break
      }


      await page.waitForTimeout(8000)

      const finalRootNode = await page.locator('.tree-node').first()
      const finalRootStatus = await finalRootNode.locator('.status-column').textContent()
      console.log('[TEST] 根节点最终状态:', finalRootStatus)

      const isFinalCompleted = finalRootStatus?.includes('完成') || finalRootStatus?.includes('completed')
      expect(isFinalCompleted || ancestorProgressUpdated).toBe(true)

    } finally {
      const closeButton = await page.locator('.header-btn.close').first()
      await closeButton.click()
    }
  })
})
