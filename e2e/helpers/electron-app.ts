import { _electron as electron, ElectronApplication, Page } from '@playwright/test'
import path from 'path'

/**
 * 启动Electron应用
 */
export async function startApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../out/main/index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  })

  const page = await electronApp.firstWindow()

  // 等待应用加载完成
  await page.waitForLoadState('domcontentloaded')

  return { app: electronApp, page }
}

/**
 * 关闭Electron应用
 */
export async function closeApp(app: ElectronApplication): Promise<void> {
  await app.close()
}

/**
 * 等待应用就绪
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForSelector('.app-container', { timeout: 10000 })
}

/**
 * 获取主窗口
 */
export async function getMainWindow(app: ElectronApplication): Promise<Page> {
  const windows = app.windows()
  return windows[0] || app.firstWindow()
}
