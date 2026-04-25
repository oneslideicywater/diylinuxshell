/**
 * Dev 模式测试：右击 GroupHeader#L11-19 捕获控制台报错
 * 策略：直接用 _electron.launch + 开发模式环境变量启动
 */

import { test, _electron as electron, ElectronApplication } from '@playwright/test'
import path from 'path'

let electronApp: ElectronApplication
let page: any

test.describe('Dev 模式 - GroupHeader 右键菜单报错捕获', () => {
  test.beforeAll(async () => {
    console.log('\n' + '='.repeat(80))
    console.log('🚀 以 Dev 模式启动 Electron 应用...')
    console.log('='.repeat(80))

    // 直接用 _electron.launch 启动，传入开发模式参数
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../out/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'development',
        // 关键：模拟 electron-vite dev 设置的环境变量
        ELECTRON_RENDERER_URL: 'http://localhost:5173'
      },
      stdio: 'pipe'
    })

    // 监听主进程输出
    const proc = electronApp.process()
    if (proc.stdout) {
      proc.stdout.on('data', (d: Buffer) => console.log('[Main]', d.toString().trim()))
    }
    if (proc.stderr) {
      proc.stderr.on('data', (d: Buffer) => console.error('[Main Err]', d.toString().trim()))
    }

    page = await electronApp.firstWindow()

    // 等待页面加载
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(3000)

    console.log('✅ 应用已启动')

    // 注入错误拦截器
    await page.evaluate(() => {
      (window as any).__DEV_ERRORS__ = []

      const origErr = console.error.bind(console)
      console.error = function(...args: any[]) {
        const msg = args.map(a =>
          a instanceof Error ? `[Error] ${a.message}\n${a.stack}` :
          typeof a === 'object' ? JSON.stringify(a) : String(a)
        ).join(' ')
        ;(window as any).__DEV_ERRORS__.push({ type: 'ERROR', msg, time: Date.now() })
        origErr.apply(console, args)
      }

      const origWarn = console.warn.bind(console)
      console.warn = function(...args: any[]) {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
        ;(window as any).__DEV_ERRORS__.push({ type: 'WARN', msg, time: Date.now() })
        origWarn.apply(console, args)
      }

      window.onerror = function(msg, src, line, col, err) {
        (window as any).__DEV_ERRORS__.push({
          type: 'WINDOW_ERROR',
          message: String(msg),
          details: err ? `${err.name}: ${err.message}` : '',
          source: `${src}:${line}:${col}`,
          time: Date.now()
        })
        return false
      }

      console.log('[CAPTURE] ✅ 拦截器已安装')
    })
  })

  test.afterAll(async () => {
    if (electronApp) await electronApp.close()
  })

  test('右击 .group-header 并收集控制台输出', async () => {
    console.log('\n' + '='.repeat(80))
    console.log('🎯 右击 GroupHeader#L11-19')
    console.log('='.repeat(80))

    // 清空记录
    await page.evaluate(() => { (window as any).__DEV_ERRORS__ = [] })

    // 查找元素
    const headers = page.locator('.group-header')
    const count = await headers.count()
    console.log(`\n🔍 找到 ${count} 个 .group-header`)

    if (count === 0) {
      console.log('❌ 未找到元素')
      return
    }

    const first = headers.first()
    const text = await first.textContent()
    console.log(`✅ 目标: "${text?.trim()}"`)

    // 右键点击
    console.log('🖱️  右键点击...')
    await first.click({ button: 'right', force: true, timeout: 5000 })
    console.log('✅ 点击完成')

    // 等待错误传播
    console.log('⏳ 等待 5 秒...')
    await page.waitForTimeout(5000)

    // 收集结果
    const data = await page.evaluate(() => (window as any).__DEV_ERRORS__ || [])

    console.log('\n' + '='.repeat(80))
    console.log('📊 捕获报告')
    console.log('='.repeat(80))

    const errors = data.filter((d: any) => d.type === 'ERROR')
    const warns = data.filter((d: any) => d.type === 'WARN')
    const winErrors = data.filter((d: any) => d.type === 'WINDOW_ERROR')

    console.log(`\n❌ Errors: ${errors.length}`)
    errors.forEach((e: any, i: number) => {
      console.log(`  ${i + 1}. ${e.msg}`)
      if (e.msg.includes('closeAllContextMenus')) console.log('     👆 closeAllContextMenus!')
      if (e.msg.includes('is not defined')) console.log('     👆 is not defined!')
      if (e.msg.includes('Unhandled error')) console.log('     👆 Unhandled error!')
      if (e.msg.includes('GroupHeader')) console.log('     👆 GroupHeader!')
    })

    console.log(`\n⚠️  Warnings (${warns.length}):`)
    warns.forEach((w: any, i: number) => {
      console.log(`  ${i + 1}. ${w.msg}`)
      if (w.msg.includes('[Vue warn]')) console.log('     👆 [Vue warn]!')
      if (w.msg.includes('Unhandled error')) console.log('     👆 Unhandled!')
      if (w.msg.includes('GroupHeader')) console.log('     👆 GroupHeader!')
    })

    console.log(`\n� Window Errors (${winErrors.length}):`)
    winErrors.forEach((we: any, i: number) => {
      console.log(`  ${i + 1}. ${we.message} | ${we.details}`)
    })

    console.log('\n' + '='.repeat(80))
    const total = data.length
    console.log(`🎯 总计: ${total} 条`)

    if (total > 0) {
      console.log('\n✅ 捕获到输出! 原始数据:')
      console.log(JSON.stringify(data, null, 2))
    } else {
      console.log('\nℹ️  未捕获到任何输出')
    }
    console.log('='.repeat(80))
  })
})
