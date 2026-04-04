/**
 * 主进程入口文件
 * 负责 Electron 应用的生命周期管理、窗口创建和 IPC 通信处理
 * @module main
 */

import { app, BrowserWindow, shell, ipcMain, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllHandlers } from './ipc'
import { SSHManager } from './services/ssh-manager'

/**
 * 创建主窗口
 * 初始化应用主窗口，配置窗口属性和事件监听
 * @returns {void}
 */
function createWindow(): void {
  // 创建浏览器窗口实例
  const mainWindow = new BrowserWindow({
    width: 1200, // 窗口默认宽度
    height: 800, // 窗口默认高度
    minWidth: 800, // 窗口最小宽度
    minHeight: 600, // 窗口最小高度
    show: false, // 初始隐藏，等待内容加载完成后显示
    autoHideMenuBar: true, // 自动隐藏菜单栏
    frame: false, // 无边框窗口（自定义标题栏）
    titleBarStyle: 'hidden', // 隐藏标题栏样式
    trafficLightPosition: { x: 15, y: 10 }, // macOS 红绿灯按钮位置
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'), // 预加载脚本路径
      sandbox: false, // 禁用沙箱（需要使用 Node.js API）
      contextIsolation: true, // 启用上下文隔离（安全）
      nodeIntegration: false // 禁用 Node.js 集成（安全）
    }
  })

  // 窗口准备好后显示，避免白屏闪烁
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 处理新窗口打开请求，在外部浏览器中打开
  mainWindow.webContents.setWindowOpenHandler(details => {
    shell.openExternal(details.url)
    return { action: 'deny' } // 阻止 Electron 创建新窗口
  })

  // 根据环境加载不同的入口文件
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    // 开发环境：加载 Vite 开发服务器
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    // 生产环境：加载构建后的 HTML 文件
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 右键菜单
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menu = Menu.buildFromTemplate([
      {
        label: '检查元素',
        click: () => {
          mainWindow.webContents.inspectElement(params.x, params.y)
        }
      },
      { type: 'separator' },
      {
        label: '重新加载',
        click: () => {
          mainWindow.webContents.reload()
        }
      },
      {
        label: '强制重新加载',
        click: () => {
          mainWindow.webContents.reloadIgnoringCache()
        }
      },
      { type: 'separator' },
      {
        label: '后退',
        enabled: mainWindow.webContents.canGoBack(),
        click: () => {
          mainWindow.webContents.goBack()
        }
      },
      {
        label: '前进',
        enabled: mainWindow.webContents.canGoForward(),
        click: () => {
          mainWindow.webContents.goForward()
        }
      }
    ])
    menu.popup()
  })
}

/**
 * 应用程序入口
 * 当 Electron 完成初始化时创建窗口
 */
app.whenReady().then(() => {
  // 设置应用用户模型 ID（Windows 平台任务栏显示）
  electronApp.setAppUserModelId('com.diy-linux-shell')

  // 注册所有 IPC 处理器
  registerAllHandlers()

  // 监听新窗口创建，注册快捷键优化
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 创建主窗口
  createWindow()

  // macOS 特性：点击 Dock 图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

/**
 * 监听所有窗口关闭事件
 * macOS 应用通常不会退出，除非用户按 Cmd+Q
 */
app.on('window-all-closed', () => {
  // 断开所有 SSH 连接
  SSHManager.disconnectAll()
  
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

/**
 * IPC处理：窗口最小化
 * 接收渲染进程的最小化请求，将窗口最小化到任务栏
 * @param event - IPC 事件对象
 */
ipcMain.on('window-minimize', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.minimize()
})

/**
 * IPC处理：窗口最大化/还原
 * 切换窗口的最大化状态
 * - 已最大化：还原到正常大小
 * - 正常大小：最大化窗口
 * @param event - IPC 事件对象
 */
ipcMain.on('window-maximize', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win?.isMaximized()) {
    win.unmaximize()
  } else {
    win?.maximize()
  }
})

/**
 * IPC处理：窗口关闭
 * 关闭当前窗口，如果所有窗口都关闭则退出应用
 * @param event - IPC 事件对象
 */
ipcMain.on('window-close', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.close()
})

/**
 * IPC处理：获取窗口最大化状态
 * 返回当前窗口是否处于最大化状态
 * @param event - IPC 事件对象
 * @returns {boolean} 窗口是否已最大化
 */
ipcMain.handle('window-is-maximized', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  return win?.isMaximized() ?? false
})

/**
 * IPC处理：打开开发者工具
 * 打开当前窗口的开发者工具，用于审查元素
 * 如果提供了坐标参数，则定位到指定位置的元素
 * @param event - IPC 事件对象
 * @param data - 可选的坐标数据 { x: number, y: number }
 */
ipcMain.on('open-devtools', (event, data?: { x: number; y: number }) => {
  console.log('[Main] open-devtools called with data:', data)
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    console.log('[Main] Opening devtools...')
    // 打开开发者工具
    win.webContents.openDevTools()
    
    // 如果提供了坐标，则检查指定位置的元素
    if (data && typeof data.x === 'number' && typeof data.y === 'number') {
      console.log('[Main] Will inspect element at:', data.x, data.y)
      // 延迟一点时间，等待开发者工具打开
      setTimeout(() => {
        console.log('[Main] Calling inspectElement...')
        win.webContents.inspectElement(data.x, data.y)
      }, 100)
    }
  } else {
    console.error('[Main] Failed to get BrowserWindow')
  }
})
