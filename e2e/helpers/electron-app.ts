import { _electron as electron, ElectronApplication, Page } from '@playwright/test'
import path from 'path'

/**
 * Electron应用启动模式
 */
export type AppMode = 'test' | 'dev'

/**
 * 启动Electron应用
 * @param mode 启动模式: 'test' 生产模式(默认) | 'dev' 开发模式(连接Vite dev server)
 */
export async function startApp(mode: AppMode = 'test'): Promise<{ app: ElectronApplication; page: Page }> {
  const isDevMode = mode === 'dev'

  const launchOptions: Parameters<typeof electron.launch>[0] = {
    args: [path.join(__dirname, '../../out/main/index.js')],
    env: {
      ...process.env,
      NODE_ENV: isDevMode ? 'development' : 'test',
      ...(isDevMode ? { ELECTRON_RENDERER_URL: 'http://localhost:5173' } : {})
    },
    stdio: 'pipe'
  }

  const electronApp = await electron.launch(launchOptions)

  // 监听主进程标准输出
  if (electronApp.process().stdout) {
    electronApp.process().stdout?.on('data', (data) => {
      console.log('[Main stdout]', data.toString())
    })
  }

  // 监听主进程错误输出
  if (electronApp.process().stderr) {
    electronApp.process().stderr?.on('data', (data) => {
      console.error('[Main stderr]', data.toString())
    })
  }

  const page = await electronApp.firstWindow()

  // 监听渲染进程日志
  page.on('console', (msg) => {
    const type = msg.type()
    const text = msg.text()
    if (type === 'error') {
      console.error('[Renderer error]', text)
    } else {
      console.log('[Renderer]', type, text)
    }
  })

  // 监听页面错误
  page.on('pageerror', (error) => {
    console.error('[Renderer pageerror]', error.message)
  })

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
