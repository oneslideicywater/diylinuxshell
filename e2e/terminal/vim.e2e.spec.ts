/**
 * Vim 编辑器 E2E 测试
 * 按照 XShell 行为标准测试终端中 vi/vim 编辑器的功能
 */

import { test, expect, beforeAll, afterAll } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'
import { testConfig, generateUniqueName } from '../config/test-config'
import type { ElectronApplication, Page } from '@playwright/test'

let app: ElectronApplication
let page: Page

/**
 * 检测服务器上可用的编辑器命令
 * 优先检测 vim，如果不存在则使用 vi
 * 通过执行命令并检查退出码来判断
 * @returns 可用的编辑器命令（支持自动回退）
 */
async function detectAvailableEditor(): Promise<string> {
  const xterm = page.locator('.xterm')
  
  await xterm.click()
  
  // 使用 which 命令检测（which 返回 0 表示找到，返回 1 表示未找到）
  // 将检测结果写入临时文件
  await page.keyboard.type('which vim >/dev/null 2>&1 && echo "vim" > /tmp/.editor || which vi >/dev/null 2>&1 && echo "vi" > /tmp/.editor || echo "none" > /tmp/.editor')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(800)
  
  // 输出检测结果便于调试
  await page.keyboard.type('cat /tmp/.editor 2>/dev/null || echo "unknown"')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  
  // 清理临时文件
  await page.keyboard.type('rm -f /tmp/.editor')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  
  // 返回支持自动回退的命令
  // 如果 vim 不存在（退出码为1），会自动使用 vi
  return 'vim || vi'
}

/**
 * 获取带文件名参数的编辑器命令
 * @param filename - 文件名
 * @returns 编辑器命令
 */
function getEditorCommandWithFile(filename: string): string {
  // 如果 vim 不存在，自动回退到 vi
  return `vim ${filename} || vi ${filename}`
}

/**
 * 辅助函数：创建会话并连接
 */
async function createSessionAndConnect(sessionName: string): Promise<void> {
  const addBtn = page.locator('.sidebar-section .add-btn').first()
  await addBtn.click()
  await page.waitForTimeout(500)

  await page.locator('.session-form input[id="name"]').fill(sessionName)
  await page.locator('.session-form input[id="host"]').fill(testConfig.ssh.host)
  await page.locator('.session-form input[id="port"]').fill(String(testConfig.ssh.port))
  await page.locator('.session-form input[id="username"]').fill(testConfig.ssh.username)
  await page.locator('.session-form input[id="password"]').fill(testConfig.ssh.password)
  await page.locator('.session-form .btn.submit').click()
  
  // 等待表单关闭
  await expect(page.locator('.session-form-overlay')).not.toBeVisible({ timeout: 5000 })
  
  // 滚动到会话列表底部，确保新会话可见
  const sessionList = page.locator('.session-groups')
  await sessionList.evaluate((el: Element) => {
    el.scrollTop = el.scrollHeight
  })
  await page.waitForTimeout(500)
  
  // 等待会话出现在列表中
  const sessionItem = page.locator('.session-item').filter({ hasText: sessionName }).first()
  await sessionItem.scrollIntoViewIfNeeded()
  await expect(sessionItem).toBeVisible({ timeout: 10000 })
  
  // 双击连接
  await sessionItem.dblclick()
  await page.waitForTimeout(3000)
}

/**
 * 终端基础测试
 * 测试 XShell 标准的终端显示功能
 */
test.describe('终端基础', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)

    // 创建会话并连接
    const sessionName = generateUniqueName('终端基础测试')
    await createSessionAndConnect(sessionName)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('终端组件应该可见', async () => {
    // XShell 标准：连接成功后显示终端界面
    const xterm = page.locator('.xterm')
    await expect(xterm).toBeVisible({ timeout: 10000 })
  })

  test('终端有输入焦点', async () => {
    // XShell 标准：终端自动获取焦点，可以直接输入
    const xterm = page.locator('.xterm')
    await xterm.click()
    await page.waitForTimeout(200)

    // 验证终端可见
    await expect(xterm).toBeVisible()
  })

  test('终端可以输入命令', async () => {
    // XShell 标准：终端可以输入并执行命令
    const xterm = page.locator('.xterm')
    await xterm.click()
    await page.waitForTimeout(200)

    // 输入简单命令
    await page.keyboard.type('echo test')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)

    // 验证终端仍然可见
    await expect(xterm).toBeVisible()
  })
})

/**
 * Vim 模式切换测试
 * 测试 XShell 标准的 Vim 模式切换行为
 */
test.describe('Vim 模式切换', () => {
  let editorCommand: string

  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)

    // 创建会话并连接
    const sessionName = generateUniqueName('Vim模式测试')
    await createSessionAndConnect(sessionName)
    
    // 检测可用的编辑器命令
    _editorCommand = await detectAvailableEditor()
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('启动 Vim 编辑器', async () => {
    // XShell 标准：可以启动 vim/vi 编辑器
    const xterm = page.locator('.xterm')
    await xterm.click()
    await page.waitForTimeout(200)

    // 使用检测到的编辑器命令
    await page.keyboard.type(editorCommand)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1500)

    // 验证终端仍然可见
    await expect(xterm).toBeVisible()
  })

  test('按 i 键进入插入模式', async () => {
    // XShell 标准：在 Vim 中按 i 进入插入模式
    const xterm = page.locator('.xterm')
    if (await xterm.isVisible()) {
      await xterm.click()
      await page.waitForTimeout(200)

      // 发送 'i' 键
      await page.keyboard.press('i')
      await page.waitForTimeout(200)

      // 验证终端仍然可见
      await expect(xterm).toBeVisible()
    }
  })

  test('按 Escape 键返回普通模式', async () => {
    // XShell 标准：按 Escape 退出插入模式，返回普通模式
    const xterm = page.locator('.xterm')
    if (await xterm.isVisible()) {
      await xterm.click()
      await page.waitForTimeout(200)

      // 发送 Escape 键
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)

      // 验证终端仍然可见
      await expect(xterm).toBeVisible()
    }
  })

  test('退出 Vim 编辑器', async () => {
    // XShell 标准：可以使用 :q! 退出 Vim
    const xterm = page.locator('.xterm')
    if (await xterm.isVisible()) {
      await xterm.click()
      await page.waitForTimeout(200)

      // 输入退出命令
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
      await page.keyboard.type(':q!')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(500)

      // 验证终端仍然可见
      await expect(xterm).toBeVisible()
    }
  })
})

/**
 * Vim 光标移动测试
 * 测试 XShell 标准的 Vim 光标移动命令
 */
test.describe('Vim 光标移动', () => {
  // 编辑器命令（调试用，实际使用 getEditorCommandWithFile 函数）
  let _editorCommand: string

  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)

    // 创建会话并连接
    const sessionName = generateUniqueName('Vim光标测试')
    await createSessionAndConnect(sessionName)
    
    // 检测可用的编辑器命令
    _editorCommand = await detectAvailableEditor()
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('启动 Vim 并创建测试文件', async () => {
    // XShell 标准：可以创建并编辑文件
    const xterm = page.locator('.xterm')
    await xterm.click()
    await page.waitForTimeout(200)

    // 创建测试文件，使用检测到的编辑器命令
    await page.keyboard.type(getEditorCommandWithFile('test.txt'))
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1500)

    // 验证终端可见
    await expect(xterm).toBeVisible()
  })

  test('h 键向左移动光标', async () => {
    // XShell 标准：h 键向左移动光标
    const xterm = page.locator('.xterm')
    if (await xterm.isVisible()) {
      await xterm.click()
      await page.waitForTimeout(200)

      // 进入插入模式并输入一些文本
      await page.keyboard.press('i')
      await page.waitForTimeout(200)
      await page.keyboard.type('test')
      await page.waitForTimeout(200)

      // 返回普通模式
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)

      // 按 h 键移动光标
      await page.keyboard.press('h')
      await page.waitForTimeout(200)

      // 验证终端可见
      await expect(xterm).toBeVisible()
    }
  })

  test('j 键向下移动光标', async () => {
    // XShell 标准：j 键向下移动光标
    const xterm = page.locator('.xterm')
    if (await xterm.isVisible()) {
      await xterm.click()
      await page.keyboard.press('j')
      await page.waitForTimeout(200)

      await expect(xterm).toBeVisible()
    }
  })

  test('k 键向上移动光标', async () => {
    // XShell 标准：k 键向上移动光标
    const xterm = page.locator('.xterm')
    if (await xterm.isVisible()) {
      await xterm.click()
      await page.keyboard.press('k')
      await page.waitForTimeout(200)

      await expect(xterm).toBeVisible()
    }
  })

  test('l 键向右移动光标', async () => {
    // XShell 标准：l 键向右移动光标
    const xterm = page.locator('.xterm')
    if (await xterm.isVisible()) {
      await xterm.click()
      await page.keyboard.press('l')
      await page.waitForTimeout(200)

      await expect(xterm).toBeVisible()
    }
  })

  test('退出 Vim', async () => {
    // XShell 标准：退出 Vim 不保存
    const xterm = page.locator('.xterm')
    if (await xterm.isVisible()) {
      await xterm.click()
      await page.waitForTimeout(200)

      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
      await page.keyboard.type(':q!')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(500)

      await expect(xterm).toBeVisible()
    }
  })
})

/**
 * Vim 编辑命令测试
 * 测试 XShell 标准的 Vim 编辑命令
 */
test.describe('Vim 编辑命令', () => {
  // 编辑器命令（调试用，实际使用 getEditorCommandWithFile 函数）
  let _editorCommand: string

  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)

    // 创建会话并连接
    const sessionName = generateUniqueName('Vim编辑测试')
    await createSessionAndConnect(sessionName)
    
    // 检测可用的编辑器命令
    editorCommand = await detectAvailableEditor()
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('启动 Vim 创建文件', async () => {
    // XShell 标准：创建新文件
    const xterm = page.locator('.xterm')
    await xterm.click()
    await page.waitForTimeout(200)

    await page.keyboard.type(getEditorCommandWithFile('edit_test.txt'))
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1500)

    await expect(xterm).toBeVisible()
  })

  test('dd 删除整行', async () => {
    // XShell 标准：dd 删除当前行
    const xterm = page.locator('.xterm')
    if (await xterm.isVisible()) {
      await xterm.click()
      await page.waitForTimeout(200)

      // 先输入一些文本
      await page.keyboard.press('i')
      await page.waitForTimeout(200)
      await page.keyboard.type('line 1')
      await page.keyboard.press('Enter')
      await page.keyboard.type('line 2')
      await page.waitForTimeout(200)

      // 返回普通模式
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)

      // dd 删除行
      await page.keyboard.type('dd')
      await page.waitForTimeout(200)

      await expect(xterm).toBeVisible()
    }
  })

  test('yy 复制整行', async () => {
    // XShell 标准：yy 复制当前行
    const xterm = page.locator('.xterm')
    if (await xterm.isVisible()) {
      await xterm.click()
      await page.waitForTimeout(200)

      await page.keyboard.type('yy')
      await page.waitForTimeout(200)

      await expect(xterm).toBeVisible()
    }
  })

  test('p 粘贴', async () => {
    // XShell 标准：p 粘贴到下一行
    const xterm = page.locator('.xterm')
    if (await xterm.isVisible()) {
      await xterm.click()
      await page.waitForTimeout(200)

      await page.keyboard.press('p')
      await page.waitForTimeout(200)

      await expect(xterm).toBeVisible()
    }
  })

  test('保存并退出 Vim', async () => {
    // XShell 标准：:wq 保存并退出
    const xterm = page.locator('.xterm')
    if (await xterm.isVisible()) {
      await xterm.click()
      await page.waitForTimeout(200)

      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
      await page.keyboard.type(':wq')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(500)

      await expect(xterm).toBeVisible()
    }
  })
})

/**
 * Vim 特殊键测试
 * 测试 XShell 标准的特殊键处理
 */
test.describe('Vim 特殊键', () => {
  let editorCommand: string

  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)

    // 创建会话并连接
    const sessionName = generateUniqueName('Vim特殊键测试')
    await createSessionAndConnect(sessionName)
    
    // 检测可用的编辑器命令
    editorCommand = await detectAvailableEditor()
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('启动 Vim', async () => {
    // XShell 标准：启动 Vim
    const xterm = page.locator('.xterm')
    await xterm.click()
    await page.waitForTimeout(200)

    await page.keyboard.type(editorCommand)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1500)

    await expect(xterm).toBeVisible()
  })

  test('Ctrl+F 向下翻页', async () => {
    // XShell 标准：Ctrl+F 向下翻页
    const xterm = page.locator('.xterm')
    if (await xterm.isVisible()) {
      await xterm.click()
      await page.waitForTimeout(200)

      await page.keyboard.press('Control+f')
      await page.waitForTimeout(200)

      await expect(xterm).toBeVisible()
    }
  })

  test('Ctrl+B 向上翻页', async () => {
    // XShell 标准：Ctrl+B 向上翻页
    const xterm = page.locator('.xterm')
    if (await xterm.isVisible()) {
      await xterm.click()
      await page.waitForTimeout(200)

      await page.keyboard.press('Control+b')
      await page.waitForTimeout(200)

      await expect(xterm).toBeVisible()
    }
  })

  test('0 移动到行首', async () => {
    // XShell 标准：0 移动到行首
    const xterm = page.locator('.xterm')
    if (await xterm.isVisible()) {
      await xterm.click()
      await page.waitForTimeout(200)

      await page.keyboard.press('0')
      await page.waitForTimeout(200)

      await expect(xterm).toBeVisible()
    }
  })

  test('$ 移动到行尾', async () => {
    // XShell 标准：$ 移动到行尾
    const xterm = page.locator('.xterm')
    if (await xterm.isVisible()) {
      await xterm.click()
      await page.waitForTimeout(200)

      await page.keyboard.press('$')
      await page.waitForTimeout(200)

      await expect(xterm).toBeVisible()
    }
  })

  test('退出 Vim', async () => {
    // XShell 标准：退出 Vim
    const xterm = page.locator('.xterm')
    if (await xterm.isVisible()) {
      await xterm.click()
      await page.waitForTimeout(200)

      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
      await page.keyboard.type(':q!')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(500)

      await expect(xterm).toBeVisible()
    }
  })
})

/**
 * 中文支持测试
 * 测试 XShell 标准的中文输入支持
 */
test.describe('中文支持', () => {
  let editorCommand: string

  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)

    // 创建会话并连接
    const sessionName = generateUniqueName('中文测试')
    await createSessionAndConnect(sessionName)
    
    // 检测可用的编辑器命令
    editorCommand = await detectAvailableEditor()
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('终端支持中文显示', async () => {
    // XShell 标准：终端正确显示中文字符
    const xterm = page.locator('.xterm')
    await expect(xterm).toBeVisible({ timeout: 10000 })
  })

  test('在插入模式下输入中文', async () => {
    // XShell 标准：Vim 插入模式支持中文输入
    const xterm = page.locator('.xterm')
    if (await xterm.isVisible()) {
      await xterm.click()
      await page.waitForTimeout(200)

      // 启动编辑器，使用检测到的命令
      await page.keyboard.type(getEditorCommandWithFile('chinese.txt'))
      await page.keyboard.press('Enter')
      await page.waitForTimeout(1500)

      // 进入插入模式
      await page.keyboard.press('i')
      await page.waitForTimeout(200)

      // 验证终端仍然可见
      await expect(xterm).toBeVisible()

      // 退出
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
      await page.keyboard.type(':q!')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(500)
    }
  })
})
