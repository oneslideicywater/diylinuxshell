/**
 * Dev 模式测试：验证 handleSessionContextMenu Vue warn 修复
 * 目标：确认移除 @session-contextmenu 后不再有 Vue warn
 */

import { test, expect, _electron as electron } from '@playwright/test'
import { chromium } from 'playwright'
import path from 'path'
import { spawn, ChildProcess, execSync } from 'child_process'

let page: any
let devProcess: ChildProcess | null = null

test.describe('Dev 模式 - 验证 handleSessionContextMenu 修复', () => {
  test.beforeAll(async () => {
    console.log('\n' + '='.repeat(80))
    console.log('🚀 启动应用 - 验证 Vue warn 修复')
    console.log('='.repeat(80))

    const projectRoot = path.join(__dirname, '../..')

    // 清理端口占用
    try {
      execSync('for /f "tokens=5" %a in (\'netstat -ano ^| findstr :5173 ^| findstr LISTENING\') do taskkill /PID %a /F', { stdio: 'pipe' })
      execSync('for /f "tokens=5" %a in (\'netstat -ano ^| findstr :5174 ^| findstr LISTENING\') do taskkill /PID %a /F', { stdio: 'pipe' })
    } catch (e) {
      // 忽略
    }

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
                    })
                    
                    resolved = true
                    resolve()
                  }
                }
              } catch (e) {
                console.log('⚠️  连接失败:', (e as Error).message)
              }
            }, 5000)
          }
        })
      }

      if (devProcess.stderr) {
        devProcess.stderr.on('data', (data: Buffer) => {
          const errorOutput = data.toString()
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

      setTimeout(() => {
        if (!resolved) {
          reject(new Error('超时'))
        }
      }, 90000)

      devProcess.on('exit', (code) => {
        if (!resolved && code !== null && code !== 0) {
          reject(new Error(`进程退出: ${code}`))
        }
      })
    })
  })

  test.afterAll(async () => {
    if (devProcess) {
      try {
        devProcess.kill()
      } catch (e) {
        // 忽略
      }
    }
  })

  test('验证无 handleSessionContextMenu Vue warn', async () => {
    console.log('\n' + '='.repeat(80))
    console.log('🔍 检查控制台输出')
    console.log('='.repeat(80))

    // 收集错误数据
    const data = await page.evaluate(() => (window as any).__CAPTURED_ERRORS__ || [])

    console.log(`\n📊 总共捕获到 ${data.length} 条警告/错误\n`)

    // 筛选 handleSessionContextMenu 相关的警告
    const sessionContextMenuWarnings = data.filter((d: any) => 
      d.message.includes('handleSessionContextMenu')
    )

    console.log('🎯 handleSessionContextMenu 相关警告:')
    
    if (sessionContextMenuWarnings.length > 0) {
      sessionContextMenuWarnings.forEach((w: any, i: number) => {
        console.log(`  ❌ ${i + 1}. ${w.message}`)
      })
      
      console.log('\n❌ 测试失败! 仍然存在 handleSessionContextMenu Vue warn')
      
      // 输出完整原始数据辅助调试
      console.log('\n📋 完整捕获数据:')
      console.log(JSON.stringify(data, null, 2))
    } else {
      console.log('  ✅ 未找到 handleSessionContextMenu 相关警告!')
      console.log('\n✅ 测试通过! Vue warn 已修复')
    }

    // 如果有其他警告也显示出来（方便排查）
    const otherWarnings = data.filter((d: any) => 
      !d.message.includes('handleSessionContextMenu')
    )
    
    if (otherWarnings.length > 0) {
      console.log(`\nℹ️  其他警告 (${otherWarnings.length} 条):`)
      otherWarnings.forEach((w: any, i: number) => {
        console.log(`  ${i + 1}. ${w.message.substring(0, 150)}...`)
      })
    }

    console.log('\n' + '='.repeat(80))

    // 断言：不应该有 handleSessionContextMenu 相关警告
    expect(sessionContextMenuWarnings.length).toBe(0)
  })
})
