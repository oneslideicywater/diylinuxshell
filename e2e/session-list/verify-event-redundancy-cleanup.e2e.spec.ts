/**
 * Dev 模式测试：验证 SessionSidebarContainer 事件冗余代码清理
 * 目标：确认移除 @group-contextmenu 后不再有 Vue warn
 */

import { test, expect, _electron as electron } from '@playwright/test'
import { chromium } from 'playwright'
import path from 'path'
import { spawn, ChildProcess, execSync } from 'child_process'

let page: any
let devProcess: ChildProcess | null = null

test.describe('Dev 模式 - 验证事件冗余清理', () => {
  test.beforeAll(async () => {
    console.log('\n' + '='.repeat(80))
    console.log('🚀 启动应用 - 验证事件冗余清理')
    console.log('='.repeat(80))

    const projectRoot = path.join(__dirname, '../..')

    // 清理端口占用
    try {
      execSync('for /f "tokens=5" %a in (\'netstat -ano ^| findstr :5173 ^| findstr LISTENING\') do taskkill /PID %a /F', { stdio: 'pipe' })
      execSync('for /f "tokens=5" %a in (\'netstat -ano ^| findstr :5174 ^| findstr LISTENING\') do taskkill /PID %a /F', { stdio: 'pipe' })
    } catch (e) {}

    await new Promise(resolve => setTimeout(resolve, 1000))

    console.log('\n📦 启动 electron-vite dev...')
    
    return new Promise<void>((resolve, reject) => {
      devProcess = spawn('npx', ['electron-vite', 'dev'], {
        cwd: projectRoot,
        env: {
          ...process.env,
          NODE_ENV: 'development',
          REMOTE_DEBUGGING_PORT: '9222'
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        detached: false
      })

      let resolved = false

      if (devProcess.stdout) {
        devProcess.stdout.on('data', (data: Buffer) => {
          const output = data.toString()
          
          if (output.includes('All IPC handlers registered') && !resolved) {
            setTimeout(async () => {
              try {
                const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
                const contexts = browser.contexts()
                
                if (contexts.length > 0) {
                  const context = contexts[0]
                  page = context.pages()[0]
                  
                  if (page) {
                    await page.waitForLoadState('domcontentloaded')
                    await page.waitForSelector('#app', { timeout: 15000 })
                    await page.waitForTimeout(3000)
                    
                    console.log('✅ 成功连接到应用')
                    
                    // 注入错误拦截器
                    await page.evaluate(() => {
                      ;(window as any).__CAPTURED_ERRORS__ = []
                      
                      const origWarn = console.warn.bind(console)
                      console.warn = function(...args: any[]) {
                        const msg = args.map(a =>
                          typeof a === 'object' ? JSON.stringify(a) : String(a)
                        ).join(' ')
                        ;(window as any).__CAPTURED_ERRORS__.push({ type: 'WARN', message: msg, time: Date.now() })
                        origWarn.apply(console, args)
                      }

                      const origError = console.error.bind(console)
                      console.error = function(...args: any[]) {
                        const msg = args.map(a =>
                          typeof a === 'object' ? JSON.stringify(a) : String(a)
                        ).join(' ')
                        ;(window as any).__CAPTURED_ERRORS__.push({ type: 'ERROR', message: msg, time: Date.now() })
                        origError.apply(console, args)
                      }
                      
                      console.log('✅ 错误拦截器已注入')
                    })

                    resolved = true
                    resolve()
                  }
                }
              } catch (e) {
                console.error('连接失败:', e)
                reject(e)
              }
            }, 2000)
          }
        })
      }

      // 错误处理
      if (devProcess.stderr) {
        devProcess.stderr.on('data', (data: Buffer) => {
          const output = data.toString()
          if (!output.includes('Warning') && !output.includes('DeprecationWarning')) {
            console.error('[STDERR]', output.trim())
          }
        })
      }

      // 超时处理
      setTimeout(() => {
        if (!resolved) {
          reject(new Error('启动超时'))
        }
      }, 60000)
    })
  })

  test.afterAll(async () => {
    if (devProcess) {
      devProcess.kill()
      console.log('✅ 开发进程已关闭')
    }
    
    // 清理残留进程
    try {
      execSync('taskkill /F /IM electron.exe', { stdio: 'pipe' })
    } catch (e) {}
  })

  test('验证无 handleGroupContextMenu Vue warn', async () => {
    expect(page).toBeTruthy()

    // 右键点击分组头部
    console.log('\n🖱️  右键点击分组头部...')
    const groupHeader = page.locator('.group-header').first()
    await groupHeader.waitFor({ state: 'visible', timeout: 10000 })
    await groupHeader.scrollIntoViewIfNeeded()
    await new Promise(resolve => setTimeout(resolve, 500))
    await groupHeader.click({ button: 'right' })
    
    // 等待菜单出现和可能的警告输出
    await page.waitForTimeout(1000)

    // 收集错误数据
    const data = await page.evaluate(() => (window as any).__CAPTURED_ERRORS__ || [])
    
    console.log(`\n📊 总共捕获到 ${data.length} 条警告/错误\n`)

    // 筛选冗余事件相关警告
    const redundantWarnings = data.filter((d: any) => 
      d.message.includes('handleGroupContextMenu') ||
      d.message.includes('currentRightClickGroupId') ||
      d.message.includes('contextMenuPosition') ||
      d.message.includes('handleSessionContextMenu')
    )

    console.log('🎯 冗余事件相关警告:')
    
    if (redundantWarnings.length > 0) {
      redundantWarnings.forEach((w: any, i: number) => {
        console.log(`  ❌ ${i + 1}. [${w.type}] ${w.message}`)
      })
      
      console.log('\n❌ 测试失败! 仍然存在冗余事件相关警告')
      
      console.log('\n📋 完整捕获数据:')
      data.forEach((d: any, i: number) => {
        console.log(`  [${i}] ${d.type}: ${d.message}`)
      })
    } else {
      console.log('  ✅ 未找到冗余事件相关警告!')
      console.log('\n✅ 测试通过! 冗余代码已完全清理')
    }

    expect(redundantWarnings.length).toBe(0)
  })

  test('验证 GroupHeader 右键菜单正常工作', async () => {
    expect(page).toBeTruthy()

    console.log('\n🖱️  验证 GroupHeader 右键菜单功能...')

    // 找到分组头部
    const groupHeader = page.locator('.group-header').first()
    await groupHeader.waitFor({ state: 'visible', timeout: 10000 })
    await groupHeader.scrollIntoViewIfNeeded()
    await new Promise(resolve => setTimeout(resolve, 500))

    // 右键点击
    await groupHeader.click({ button: 'right' })
    await page.waitForTimeout(800)

    // 验证右键菜单是否显示
    const hasContextMenu = await page.locator('.context-menu:visible').count() > 0
    
    if (hasContextMenu) {
      console.log('✅ GroupHeader 右键菜单正常显示!')
    } else {
      console.log('⚠️ 检查菜单状态...')
      const menuCount = await page.locator('.context-menu').count()
      console.log(`   找到 ${menuCount} 个 .context-menu 元素`)
    }

    expect(hasContextMenu).toBe(true)
  })

  test('验证 SessionItem 右键菜单正常工作', async () => {
    expect(page).toBeTruthy()

    console.log('\n🖱️  验证 SessionItem 右键菜单功能...')

    // 找到第一个会话项
    const sessionItem = page.locator('.session-item').first()
    const count = await sessionItem.count()
    
    if (count === 0) {
      console.log('⚠️ 未找到会话项，跳过测试')
      return
    }
    
    await sessionItem.scrollIntoViewIfNeeded()
    await new Promise(resolve => setTimeout(resolve, 500))

    // 右键点击
    await sessionItem.click({ button: 'right' })
    await page.waitForTimeout(800)

    // 验证右键菜单是否显示
    const hasContextMenu = await page.locator('.context-menu:visible').count() > 0
    
    if (hasContextMenu) {
      console.log('✅ SessionItem 右键菜单正常显示!')
    } else {
      console.log('⚠️ SessionItem 右键菜单未显示')
    }

    expect(hasContextMenu).toBe(true)
  })
})
