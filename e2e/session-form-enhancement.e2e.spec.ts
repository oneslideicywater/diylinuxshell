/**
 * 会话表单美化和密码可见性测试
 * 测试会话表单的UI改进和密码切换功能
 */

import { test, expect, describe, beforeAll, afterAll } from '@playwright/test'
import { ElectronApplication, Page } from 'playwright'
import { startApp, closeApp, waitForAppReady } from './helpers/electron-app'

let app: ElectronApplication
let page: Page

/**
 * 会话表单美化和密码可见性测试
 */
describe('会话表单美化和密码可见性', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  /**
   * 测试1：密码可见性切换功能
   */
  test('密码可见性切换功能', async () => {
    console.log('===== 开始测试：密码可见性切换功能 =====')

    // 点击新建按钮
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)

    // 验证表单显示
    const sessionForm = page.locator('.session-form')
    await expect(sessionForm).toBeVisible()
    console.log('✓ 会话表单已显示')

    // 查找密码输入框
    const passwordInput = sessionForm.locator('input[id="password"]')
    await expect(passwordInput).toBeVisible()
    
    // 验证初始状态为密码类型（隐藏）
    const initialType = await passwordInput.getAttribute('type')
    expect(initialType).toBe('password')
    console.log('✓ 密码初始状态为隐藏')

    // 查找密码切换按钮
    const passwordToggle = sessionForm.locator('.password-toggle').first()
    await expect(passwordToggle).toBeVisible()
    console.log('✓ 密码切换按钮已找到')

    // 点击切换按钮显示密码
    await passwordToggle.click()
    await page.waitForTimeout(300)

    // 验证密码类型变为 text（显示）
    const visibleType = await passwordInput.getAttribute('type')
    expect(visibleType).toBe('text')
    console.log('✓ 密码已显示')

    // 再次点击切换按钮隐藏密码
    await passwordToggle.click()
    await page.waitForTimeout(300)

    // 验证密码类型恢复为 password（隐藏）
    const hiddenType = await passwordInput.getAttribute('type')
    expect(hiddenType).toBe('password')
    console.log('✓ 密码已隐藏')

    // 关闭表单
    await sessionForm.locator('.close-btn').click()
    await page.waitForTimeout(300)

    console.log('===== 测试完成：密码可见性切换功能 =====')
  })

  /**
   * 测试2：密码图标显示和居中
   */
  test('密码图标显示和居中', async () => {
    console.log('===== 开始测试：密码图标显示和居中 =====')

    // 点击新建按钮
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)

    // 验证表单显示
    const sessionForm = page.locator('.session-form')
    await expect(sessionForm).toBeVisible()

    // 查找密码切换按钮
    const passwordToggle = sessionForm.locator('.password-toggle').first()
    await expect(passwordToggle).toBeVisible()

    // 检查按钮内的 SVG 图标
    const svgIcon = passwordToggle.locator('svg')
    
    // 获取 SVG 的实际渲染信息
    const svgInfo = await svgIcon.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      const buttonRect = el.closest('button')!.getBoundingClientRect()
      return {
        svgWidth: rect.width,
        svgHeight: rect.height,
        buttonWidth: buttonRect.width,
        buttonHeight: buttonRect.height,
        // 计算图标在按钮中的位置
        offsetX: rect.left - buttonRect.left,
        offsetY: rect.top - buttonRect.top
      }
    })
    console.log('✓ SVG 渲染信息：', svgInfo)
    
    // 验证 SVG 有正确的尺寸
    expect(svgInfo.svgWidth).toBeGreaterThan(0)
    expect(svgInfo.svgHeight).toBeGreaterThan(0)
    console.log('✓ SVG 图标尺寸正确')

    // 验证图标在按钮中居中（允许 2px 误差）
    const expectedOffsetX = (svgInfo.buttonWidth - svgInfo.svgWidth) / 2
    const expectedOffsetY = (svgInfo.buttonHeight - svgInfo.svgHeight) / 2
    expect(Math.abs(svgInfo.offsetX - expectedOffsetX)).toBeLessThan(3)
    expect(Math.abs(svgInfo.offsetY - expectedOffsetY)).toBeLessThan(3)
    console.log('✓ 图标在按钮中居中')

    // 关闭表单
    await sessionForm.locator('.close-btn').click()
    await page.waitForTimeout(300)

    console.log('===== 测试完成：密码图标显示和居中 =====')
  })

  /**
   * 测试3：密钥认证的密码可见性
   */
  test('密钥认证的密码可见性', async () => {
    console.log('===== 开始测试：密钥认证的密码可见性 =====')

    // 点击新建按钮
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)

    // 验证表单显示
    const sessionForm = page.locator('.session-form')
    await expect(sessionForm).toBeVisible()

    // 选择密钥认证（点击密钥认证标签）
    const keyAuthLabel = sessionForm.locator('.radio-label:has-text("密钥认证")')
    await keyAuthLabel.click()
    await page.waitForTimeout(500)

    // 验证密钥密码字段显示
    const keyPassphraseInput = sessionForm.locator('input[id="keyPassphrase"]')
    await expect(keyPassphraseInput).toBeVisible()
    console.log('✓ 密钥密码字段已显示')

    // 验证初始状态为密码类型（隐藏）
    const initialType = await keyPassphraseInput.getAttribute('type')
    expect(initialType).toBe('password')
    console.log('✓ 密钥密码初始状态为隐藏')

    // 查找密钥密码切换按钮（最后一个）
    const keyPasswordToggle = sessionForm.locator('.password-toggle').last()
    await expect(keyPasswordToggle).toBeVisible()
    console.log('✓ 密钥密码切换按钮已找到')

    // 点击切换按钮显示密码
    await keyPasswordToggle.click()
    await page.waitForTimeout(300)

    // 验证密码类型变为 text（显示）
    const visibleType = await keyPassphraseInput.getAttribute('type')
    expect(visibleType).toBe('text')
    console.log('✓ 密钥密码已显示')

    // 关闭表单
    await sessionForm.locator('.close-btn').click()
    await page.waitForTimeout(300)

    console.log('===== 测试完成：密钥认证的密码可见性 =====')
  })

  /**
   * 测试4：浅色主题下的表单样式
   */
  test('浅色主题下的表单样式', async () => {
    console.log('===== 开始测试：浅色主题下的表单样式 =====')

    // 打开设置
    const settingsBtn = page.locator('.sidebar-footer .settings-btn')
    await settingsBtn.click()
    await page.waitForTimeout(500)

    // 切换到浅色主题
    const lightThemeOption = page.locator('text=浅色').first()
    await lightThemeOption.click()
    await page.waitForTimeout(500)

    // 返回主界面
    const backBtn = page.locator('.settings-header .back-btn')
    await backBtn.click()
    await page.waitForTimeout(500)

    // 点击新建按钮
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)

    // 验证表单显示
    const sessionForm = page.locator('.session-form')
    await expect(sessionForm).toBeVisible()
    console.log('✓ 会话表单已显示（浅色主题）')

    // 验证表单背景色
    const formBg = await sessionForm.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    console.log('✓ 表单背景色：', formBg)

    // 验证密码切换按钮可见
    const passwordToggle = sessionForm.locator('.password-toggle').first()
    await expect(passwordToggle).toBeVisible()
    
    // 验证按钮颜色对比度
    const buttonColor = await passwordToggle.evaluate((el) => {
      return window.getComputedStyle(el).color
    })
    console.log('✓ 按钮颜色：', buttonColor)

    // 关闭表单
    await sessionForm.locator('.close-btn').click()
    await page.waitForTimeout(300)

    // 恢复深色主题
    await settingsBtn.click()
    await page.waitForTimeout(500)
    const darkThemeOption = page.locator('text=深色').first()
    await darkThemeOption.click()
    await page.waitForTimeout(500)
    await backBtn.click()
    await page.waitForTimeout(300)

    console.log('===== 测试完成：浅色主题下的表单样式 =====')
  })

  /**
   * 测试5：表单无滚动条
   */
  test('表单无滚动条', async () => {
    console.log('===== 开始测试：表单无滚动条 =====')

    // 点击新建按钮
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)

    // 验证表单显示
    const sessionForm = page.locator('.session-form')
    await expect(sessionForm).toBeVisible()

    // 检查表单主体是否有滚动条
    const formBody = sessionForm.locator('.form-body')
    const hasScrollbar = await formBody.evaluate((el) => {
      return el.scrollHeight > el.clientHeight
    })
    expect(hasScrollbar).toBe(false)
    console.log('✓ 表单无滚动条')

    // 验证所有表单项都可见
    const nameInput = sessionForm.locator('input[id="name"]')
    await expect(nameInput).toBeVisible()
    
    const hostInput = sessionForm.locator('input[id="host"]')
    await expect(hostInput).toBeVisible()
    
    const portInput = sessionForm.locator('input[id="port"]')
    await expect(portInput).toBeVisible()
    
    const usernameInput = sessionForm.locator('input[id="username"]')
    await expect(usernameInput).toBeVisible()
    
    const passwordInput = sessionForm.locator('input[id="password"]')
    await expect(passwordInput).toBeVisible()
    console.log('✓ 所有表单项都可见')

    // 关闭表单
    await sessionForm.locator('.close-btn').click()
    await page.waitForTimeout(300)

    console.log('===== 测试完成：表单无滚动条 =====')
  })

  /**
   * 测试6：遮罩层透明
   */
  test('遮罩层透明', async () => {
    console.log('===== 开始测试：遮罩层透明 =====')

    // 点击新建按钮
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)

    // 验证表单显示
    const sessionForm = page.locator('.session-form')
    await expect(sessionForm).toBeVisible()

    // 检查遮罩层背景色
    const overlay = page.locator('.session-form-overlay')
    const overlayBg = await overlay.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    console.log('✓ 遮罩层背景色：', overlayBg)

    // 验证背景色为透明（rgba(0, 0, 0, 0) 或 transparent）
    expect(overlayBg).toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)|transparent/)
    console.log('✓ 遮罩层透明')

    // 关闭表单
    await sessionForm.locator('.close-btn').click()
    await page.waitForTimeout(300)

    console.log('===== 测试完成：遮罩层透明 =====')
  })

  /**
   * 测试7：表单装饰元素
   */
  test('表单装饰元素', async () => {
    console.log('===== 开始测试：表单装饰元素 =====')

    // 点击新建按钮
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)

    // 验证表单显示
    const sessionForm = page.locator('.session-form')
    await expect(sessionForm).toBeVisible()

    // 检查装饰圆圈
    const decorationCircles = sessionForm.locator('.decoration-circle')
    const circleCount = await decorationCircles.count()
    expect(circleCount).toBe(2)
    console.log('✓ 装饰圆圈数量：', circleCount)

    // 检查表单头部图标
    const headerIcon = sessionForm.locator('.header-icon svg')
    await expect(headerIcon).toBeVisible()
    console.log('✓ 表单头部图标可见')

    // 检查所有标签图标
    const labelIcons = sessionForm.locator('.form-group label svg')
    const iconCount = await labelIcons.count()
    expect(iconCount).toBeGreaterThan(0)
    console.log('✓ 标签图标数量：', iconCount)

    // 关闭表单
    await sessionForm.locator('.close-btn').click()
    await page.waitForTimeout(300)

    console.log('===== 测试完成：表单装饰元素 =====')
  })
})
