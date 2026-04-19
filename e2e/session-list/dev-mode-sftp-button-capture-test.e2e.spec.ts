/**
 * Dev 模式测试：点击 SessionItem#L32-41 的 SFTP 按钮捕获控制台报错
 * 目标：捕获 SFTP 传输按钮点击时可能产生的错误
 * 
 * 关键：使用 electron-vite dev 启动完整开发环境（包括路径别名）
 *       通过 CDP 调试端口连接到已运行的 Electron 应用
 */

import { test, _electron as electron, ElectronApplication, BrowserContext } from '@playwright/test'
import { chromium } from 'playwright'
import path from 'path'
import { spawn, ChildProcess, execSync } from 'child_process'

let app: ElectronApplication | null = null
let page: any
let devProcess: ChildProcess | null = null

test.describe('Dev 模式 - SessionItem SFTP 按钮报错捕获', () => {
  test.beforeAll(async () => {
    console.log('\n' + '='.repeat(80))
    console.log('🚀 以 Dev 模式启动应用 (electron-vite dev) - 测试 SFTP 按钮')
    console.log('='.repeat(80))

    const projectRoot = path.join(__dirname, '../..')

    // 先清理残留的 5173/5174 端口占用
    try {
      execSync('for /f "tokens=5" %a in (\'netstat -ano ^| findstr :5173 ^| findstr LISTENING\') do taskkill /PID %a /F', { stdio: 'pipe' })
      execSync('for /f "tokens=5" %a in (\'netstat -ano ^| findstr :5174 ^| findstr LISTENING\') do taskkill /PID %a /F', { stdio: 'pipe' })
      console.log('[CLEAN] 清理端口占用')
    } catch (e) {
      // 忽略错误
    }

    // 等待一下确保端口释放
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 使用 electron-vite dev 启动完整的开发环境
    console.log('\n📦 启动 electron-vite dev...')
    
    return new Promise<void>((resolve, reject) => {
      devProcess = spawn('npx', ['electron-vite', 'dev'], {
        cwd: projectRoot,
        env: {
          ...process.env,
          NODE_ENV: 'development',
          REMOTE_DEBUGGING_PORT: '9222'  // 强制指定调试端口
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        detached: false
      })

      let outputBuffer = ''
      let errorBuffer = ''
      let resolved = false
      let vitePort: string | null = null

      // 监听 stdout
      if (devProcess.stdout) {
        devProcess.stdout.on('data', (data: Buffer) => {
          const output = data.toString()
          outputBuffer += output
          
          // 过滤掉非关键信息
          const lines = output.split('\n').filter((l: string) => l.trim())
          lines.forEach((line: string) => {
            if (
              line.includes('dev server running') ||
              line.includes('All IPC handlers registered') ||
              line.includes('start electron app') ||
              line.includes('localhost:')
            ) {
              console.log('[DEV]', line.trim())
              
              // 提取 Vite 端口
              const portMatch = line.match(/localhost:(\d+)/)
              if (portMatch && !vitePort) {
                vitePort = portMatch[1]
                console.log(`[DEV] 📍 Vite 端口: ${vitePort}`)
              }
            }
          })

          // 检测到 Electron 应用启动成功的关键标志
          if (!resolved && output.includes('All IPC handlers registered')) {
            // 延迟等待 Electron 完全初始化
            setTimeout(async () => {
              try {
                await connectToElectron(vitePort || '5173')
                resolved = true
                resolve()
              } catch (e) {
                console.log('⚠️  首次连接失败，继续等待...')
              }
            }, 5000)
          }
        })
      }

      // 监听 stderr
      if (devProcess.stderr) {
        devProcess.stderr.on('data', (data: Buffer) => {
          const errorOutput = data.toString()
          errorBuffer += errorOutput
          
          // 只输出真正的错误信息
          const importantErrors = errorOutput.split('\n').filter((line: string) => 
            line.trim() && 
            !line.includes('DeprecationWarning') &&
            !line.includes('cache_util_win') &&
            !line.includes('disk_cache.cc') &&
            !line.includes('gpu_disk_cache')
          )
          
          importantErrors.forEach((errLine: string) => {
            console.error('[DEV ERR]', errLine.trim())
          })
        })
      }

      // 超时处理：如果 90 秒内未成功，强制尝试连接
      setTimeout(async () => {
        if (!resolved) {
          console.log('⏰ 超时等待标准信号，尝试强制连接...')
          try {
            await connectToElectron(vitePort || '5173')
            resolved = true
            resolve()
          } catch (e) {
            reject(new Error(`无法连接到应用: ${(e as Error).message}\n\n输出:\n${outputBuffer}\n\n错误:\n${errorBuffer}`))
          }
        }
      }, 90000)

      // 进程退出处理
      devProcess.on('exit', (code) => {
        console.log(`[DEV] 进程退出，代码: ${code}`)
        if (!resolved && code !== null && code !== 0) {
          reject(new Error(`electron-vite dev 异常退出，代码: ${code}\n\n错误:\n${errorBuffer}`))
        }
      })
    })
  })

  /**
   * 通过 CDP 连接到已运行的 Electron 应用
   */
  async function connectToElectron(vitePort: string): Promise<void> {
    console.log(`\n⚡ 尝试通过 CDP 连接到 Electron...`)
    
    // 使用 chromium.connectOverCDP() 连接到 electron-vite dev 启动的 Electron 实例
    // electron-vite dev 默认会在调试端口 9222 上监听
    try {
      const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
      
      // 获取已有的上下文
      const contexts = browser.contexts()
      console.log(`   找到 ${contexts.length} 个浏览器上下文`)
      
      if (contexts.length > 0) {
        // 获取第一个上下文的页面
        const context = contexts[0]
        page = context.pages()[0]
        
        if (!page) {
          throw new Error('未找到页面')
        }
        
        console.log('✅ 成功通过 CDP 连接到 Electron!')
      } else {
        throw new Error('未找到浏览器上下文')
      }
    } catch (e) {
      // 如果 CDP 连接失败，fallback 到 launch 方式（但设置环境变量指向 Vite server）
      console.log(`⚠️  CDP 连接失败: ${(e as Error).message}`)
      console.log('🔄 Fallback: 使用 launch 方式...')
      
      app = await electron.launch({
        args: [path.join(__dirname, '../../out/main/index.js')],
        env: {
          ...process.env,
          NODE_ENV: 'development',
          ELECTRON_RENDERER_URL: `http://localhost:${vitePort}`
        },
        stdio: 'pipe'
      })
      
      // 监听主进程日志
      const proc = app.process()
      if (proc.stdout) {
        proc.stdout.on('data', (d: Buffer) => {
          const log = d.toString().trim()
          if (log && !log.includes('Debugger ending')) {
            console.log('[Main]', log)
          }
        })
      }
      if (proc.stderr) {
        proc.stderr.on('data', (d: Buffer) => {
          const errLog = d.toString().trim()
          if (errLog && !errLog.includes('cache_util_win') && !errLog.includes('disk_cache')) {
            console.error('[Main Err]', errLog)
          }
        })
      }

      page = await app.firstWindow()
      
      console.log('✅ 使用 launch 方式成功启动 Electron')
    }

    // 等待页面加载完成
    await page.waitForLoadState('domcontentloaded')
    
    // 等待 Vue 应用挂载
    await page.waitForSelector('#app', { timeout: 15000 })
    await page.waitForTimeout(3000)

    console.log('✅ 页面加载完成')

    // 注入错误拦截器
    await injectErrorCapturers()
  }

  /**
   * 注入多层级错误拦截器
   */
  async function injectErrorCapturers(): Promise<void> {
    await page.evaluate(() => {
      ;(window as any).__CAPTURED_ERRORS__ = []

      // 拦截 console.error
      const origError = console.error.bind(console)
      console.error = function(...args: any[]) {
        const msg = args.map(a =>
          a instanceof Error ? `[Error] ${a.message}\n${a.stack}` :
          typeof a === 'object' ? JSON.stringify(a) : String(a)
        ).join(' ')
        ;(window as any).__CAPTURED_ERRORS__.push({ type: 'ERROR', message: msg, time: Date.now() })
        origError.apply(console, args)
      }

      // 拦截 console.warn（Vue warn）
      const origWarn = console.warn.bind(console)
      console.warn = function(...args: any[]) {
        const msg = args.map(a =>
          typeof a === 'object' ? JSON.stringify(a) : String(a)
        ).join(' ')
        ;(window as any).__CAPTURED_ERRORS__.push({ type: 'WARN', message: msg, time: Date.now() })
        origWarn.apply(console, args)
      }

      // 拦截 window.onerror（ReferenceError）
      window.onerror = function(msg, src, line, col, err) {
        ;(window as any).__CAPTURED_ERRORS__.push({
          type: 'WINDOW_ERROR',
          message: String(msg),
          details: err ? `${err.name}: ${err.message}` : '',
          source: `${src}:${line}:${col}`,
          time: Date.now()
        })
        return false
      }
    })
    
    console.log('[CAPTURE] ✅ 错误拦截器已安装')
  }

  test.afterAll(async () => {
    if (app) {
      try {
        await app.close()
      } catch (e) {
        console.log('[CLEAN] 关闭应用时出错:', (e as Error).message)
      }
    }
    if (devProcess) {
      try {
        devProcess.kill()
      } catch (e) {
        // 忽略
      }
    }
  })

  test('点击 .sftp 按钮并收集控制台报错', async () => {
    console.log('\n' + '='.repeat(80))
    console.log('🎯 点击 SessionItem#L32-41 SFTP 按钮')
    console.log('='.repeat(80))

    // 清空记录
    await page.evaluate(() => { ;(window as any).__CAPTURED_ERRORS__ = [] })

    // 步骤1：检查并展开分组
    console.log('\n📂 步骤1：检查并展开分组...')
    
    const groupHeaders = page.locator('.group-header')
    const groupCount = await groupHeaders.count()
    console.log(`   找到 ${groupCount} 个分组`)

    if (groupCount > 0) {
      const firstGroup = groupHeaders.first()
      const groupText = await firstGroup.textContent()
      console.log(`   分组名称: "${groupText?.trim()}"`)
      
      // 点击展开分组
      console.log('   📂 点击分组展开...')
      await firstGroup.click({ timeout: 5000 })
      await page.waitForTimeout(2000)
    }

    // 步骤2：查找会话项（多次重试）
    console.log('\n📋 步骤2：查找会话项...')
    
    let sessionItems = page.locator('.session-item')
    let sessionCount = 0
    
    // 重试最多 5 次，每次间隔 1 秒
    for (let i = 0; i < 5; i++) {
      sessionCount = await sessionItems.count()
      console.log(`   第 ${i + 1} 次查找: 找到 ${sessionCount} 个会话`)
      
      if (sessionCount > 0) break
      
      await page.waitForTimeout(1000)
    }

    if (sessionCount === 0) {
      console.log('❌ 未找到任何会话')
      
      // 输出页面快照辅助调试
      const bodyHTML = await page.locator('#app').innerHTML()
      console.log('\n📸 页面内容预览:', bodyHTML.substring(0, 800))
      return
    }

    // 获取第一个会话信息
    const firstSession = sessionItems.first()
    const sessionName = await firstSession.locator('.session-name').textContent()
    console.log(`   ✅ 目标会话: "${sessionName?.trim()}"`)

    // 步骤3：Hover 显示操作按钮
    console.log('\n🖱️  步骤3：Hover 会话项显示操作按钮...')
    
    // 先滚动到视口内
    await firstSession.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    
    // 使用 force: true 强制 hover（即使不可见）
    await firstSession.hover({ force: true })
    await page.waitForTimeout(1500)

    // 步骤4：查找并点击 SFTP 按钮
    console.log('\n🔘 步骤4：查找 SFTP 按钮...')
    
    // 尝试多种选择器
    const selectors = [
      '.action-btn.sftp',
      'button.sftp',
      '.session-actions .sftp',
      '[title="SFTP 传输"]'
    ]

    let sftpBtn = null
    for (const selector of selectors) {
      const btn = page.locator(selector).first()
      const count = await btn.count()
      if (count > 0) {
        sftpBtn = btn
        console.log(`   ✅ 找到 SFTP 按钮 (选择器: ${selector})`)
        break
      }
    }

    if (sftpBtn) {
      console.log('   🖱️  点击 SFTP 按钮...')
      await sftpBtn.click({ force: true, timeout: 5000 })
      console.log('   ✅ 点击完成')
    } else {
      console.log('❌ 未找到 SFTP 按钮')
      
      // 输出 session-actions 的 HTML 辅助调试
      const actionsHTML = await firstSession.locator('.session-actions').innerHTML().catch(() => '无法获取')
      console.log('   session-actions 内容:', actionsHTML?.substring(0, 300))
      return
    }

    // 等待错误传播
    console.log('\n⏳ 等待 3 秒收集错误...')
    await page.waitForTimeout(3000)

    // 收集结果
    const data = await page.evaluate(() => (window as any).__CAPTURED_ERRORS__ || [])

    console.log('\n' + '='.repeat(80))
    console.log('📊 SFTP 按钮点击 - 捕获报告')
    console.log('='.repeat(80))

    const errors = data.filter((d: any) => d.type === 'ERROR')
    const warnings = data.filter((d: any) => d.type === 'WARN')
    const winErrors = data.filter((d: any) => d.type === 'WINDOW_ERROR')

    console.log(`\n❌ Errors: ${errors.length}`)
    errors.forEach((e: any, i: number) => {
      console.log(`  ${i + 1}. ${e.message}`)
      if (e.message.includes('SFTP')) console.log('     👆 SFTP 相关!')
      if (e.message.includes('is not defined')) console.log('     👆 is not defined!')
      if (e.message.includes('Unhandled error')) console.log('     👆 Unhandled error!')
      if (e.message.includes('SessionItem')) console.log('     👆 SessionItem!')
    })

    console.log(`\n⚠️  Warnings (${warnings.length}):`)
    warnings.forEach((w: any, i: number) => {
      console.log(`  ${i + 1}. ${w.message}`)
      if (w.message.includes('[Vue warn]')) console.log('     👆 [Vue warn]!')
      if (w.message.includes('SFTP')) console.log('     👆 SFTP 相关!')
      if (w.message.includes('SessionItem')) console.log('     👆 SessionItem!')
    })

    console.log(`\n💥 Window Errors (${winErrors.length}):`)
    winErrors.forEach((we: any, i: number) => {
      console.log(`  ${i + 1}. ${we.message} | ${we.details}`)
      if (we.source) console.log(`     来源: ${we.source}`)
    })

    console.log('\n' + '='.repeat(80))
    const total = data.length
    console.log(`🎯 总计: ${total} 条`)

    if (total > 0) {
      console.log('\n✅ 捕获到输出! 原始数据:')
      console.log(JSON.stringify(data, null, 2))
    } else {
      console.log('\nℹ️  未捕获到任何输出（SFTP 按钮点击正常）')
    }
    console.log('='.repeat(80))
  })
})
