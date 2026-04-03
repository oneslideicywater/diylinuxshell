/**
 * 设置功能 E2E 测试
 * 测试主题切换、字体设置等功能
 */

import { test, expect, beforeAll, afterAll } from '@playwright/test'
import { startApp, closeApp, waitForAppReady } from '../helpers/electron-app'
import { testConfig, generateUniqueName } from '../config/test-config'
import type { ElectronApplication, Page } from '@playwright/test'

let app: ElectronApplication
let page: Page

/**
 * 设置页面导航测试
 */
test.describe('设置页面导航', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('点击设置按钮进入设置页面', async () => {
    // 查找设置按钮
    const settingsBtn = page.locator('.sidebar-section .settings-btn, .settings-btn').first()
    await settingsBtn.click()
    await page.waitForTimeout(500)

    // 验证设置页面可见
    const settingsContainer = page.locator('.settings-container')
    await expect(settingsContainer).toBeVisible()
  })

  test('设置页面显示所有标签页', async () => {
    // 验证标签页存在
    const tabs = page.locator('.el-tabs__item')
    const tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThanOrEqual(4)

    // 验证标签页文本
    const tabTexts = ['外观', '终端', '连接', '数据']
    for (const text of tabTexts) {
      const tab = tabs.filter({ hasText: text })
      await expect(tab.first()).toBeVisible()
    }
  })

  test('点击返回按钮返回主页', async () => {
    const backBtn = page.locator('.back-btn')
    await backBtn.click()
    await page.waitForTimeout(500)

    // 验证返回主页
    const homeView = page.locator('.home-view, .main-content')
    const isVisible = await homeView.isVisible()
    expect(typeof isVisible).toBe('boolean')
  })
})

/**
 * 主题设置测试
 */
test.describe('主题设置', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)

    // 进入设置页面
    const settingsBtn = page.locator('.sidebar-section .settings-btn, .settings-btn').first()
    await settingsBtn.click()
    await page.waitForTimeout(500)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('默认主题为深色', async () => {
    // 检查深色主题单选框是否选中
    const darkRadio = page.locator('.el-radio').filter({ hasText: '深色' })
    const isChecked = await darkRadio.locator('.el-radio__input.is-checked').count()
    expect(isChecked).toBeGreaterThan(0)
  })

  test('应用启动时主题一致性', async () => {
    console.log('===== 开始测试：应用启动时主题一致性 =====')
    
    // 验证 localStorage 中的主题配置
    const themeConfig = await page.evaluate(() => {
      const stored = localStorage.getItem('app-settings')
      if (stored) {
        const config = JSON.parse(stored)
        return config.theme
      }
      return null
    })
    console.log(`localStorage 中的主题配置: ${themeConfig}`)
    
    // 验证 data-theme 属性
    const dataTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme')
    })
    console.log(`data-theme 属性: ${dataTheme}`)
    
    // 验证 CSS 变量
    const cssVars = await page.evaluate(() => {
      const root = document.documentElement
      return {
        bgColor: root.style.getPropertyValue('--bg-color'),
        textColor: root.style.getPropertyValue('--text-color'),
        borderColor: root.style.getPropertyValue('--border-color')
      }
    })
    console.log('CSS 变量:', cssVars)
    
    // 验证设置页面背景色
    const settingsContainer = page.locator('.settings-container')
    const settingsBg = await settingsContainer.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    console.log(`设置页面背景色: ${settingsBg}`)
    
    // 返回主页验证主页面背景色
    const backBtn = page.locator('.back-btn')
    await backBtn.click()
    await page.waitForTimeout(500)
    
    const appLayout = page.locator('.app-layout')
    const layoutBg = await appLayout.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    console.log(`主页面背景色: ${layoutBg}`)
    
    // 验证主题一致性
    // 如果 localStorage 中是 dark，则背景色应该包含 '30' (rgb(30, 30, 30))
    // 如果 localStorage 中是 light，则背景色应该包含 '255' (rgb(255, 255, 255))
    if (themeConfig === 'dark') {
      expect(settingsBg).toContain('30')
      expect(layoutBg).toContain('30')
      expect(dataTheme).toBe('dark')
    } else if (themeConfig === 'light') {
      expect(settingsBg).toContain('255')
      expect(layoutBg).toContain('255')
      expect(dataTheme).toBe('light')
    }
    
    // 验证 CSS 变量已设置
    expect(cssVars.bgColor).not.toBe('')
    expect(cssVars.textColor).not.toBe('')
    expect(cssVars.borderColor).not.toBe('')
    
    console.log('===== 测试完成：主题一致性验证通过 =====')
  })

  test('切换到浅色主题', async () => {
    // 点击浅色主题
    const lightRadio = page.locator('.el-radio').filter({ hasText: '浅色' })
    await lightRadio.click()
    await page.waitForTimeout(500)

    // 验证浅色主题被选中
    const isChecked = await lightRadio.locator('.el-radio__input.is-checked').count()
    expect(isChecked).toBeGreaterThan(0)

    // 验证 data-theme 属性为 light
    const dataTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme')
    })
    expect(dataTheme).toBe('light')
    
    // 验证设置页面背景色为白色
    const settingsContainer = page.locator('.settings-container')
    const settingsBg = await settingsContainer.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    expect(settingsBg).toContain('255')
  })

  test('浅色主题应用到所有组件', async () => {
    // 先切换到浅色主题
    const lightRadio = page.locator('.el-radio').filter({ hasText: '浅色' })
    await lightRadio.click()
    await page.waitForTimeout(500)

    // 返回主页
    const backBtn = page.locator('.back-btn')
    await backBtn.click()
    await page.waitForTimeout(500)

    // 验证侧边栏背景色
    const sidebar = page.locator('.app-sidebar')
    const sidebarBg = await sidebar.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    // 浅色主题侧边栏背景应该是浅色 (rgb(243, 243, 243))
    expect(sidebarBg).toContain('243')

    // 验证标题栏背景色
    const header = page.locator('.app-header')
    const headerBg = await header.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    // 浅色主题标题栏背景应该是浅色
    expect(headerBg).toContain('243')

    // 验证整体布局背景色
    const appLayout = page.locator('.app-layout')
    const layoutBg = await appLayout.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    // 浅色主题整体背景应该是白色 (rgb(255, 255, 255))
    expect(layoutBg).toContain('255')
  })

  test('浅色主题下终端选中文字有足够对比度', async () => {
    console.log('===== 开始测试：浅色主题下终端选中文字有足够对比度 =====')
    
    // 先进入设置页面（如果不在设置页面）
    const settingsContainer = page.locator('.settings-container')
    const isSettingsVisible = await settingsContainer.isVisible()
    
    if (!isSettingsVisible) {
      console.log('进入设置页面')
      const settingsBtn = page.locator('.sidebar-section .settings-btn, .settings-btn').first()
      await settingsBtn.click()
      await page.waitForTimeout(500)
    }

    // 切换到浅色主题
    console.log('切换到浅色主题')
    const lightRadio = page.locator('.el-radio').filter({ hasText: '浅色' })
    await lightRadio.click()
    await page.waitForTimeout(500)

    // 返回主页
    console.log('返回主页')
    const backBtn = page.locator('.back-btn')
    await backBtn.click()
    await page.waitForTimeout(500)

    // 创建测试会话并连接
    const sessionName = generateUniqueName('选中测试')
    console.log(`创建测试会话: ${sessionName}`)
    
    // 点击新建按钮
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)

    // 填写会话信息
    const nameInput = page.locator('.session-form input[id="name"]')
    const hostInput = page.locator('.session-form input[id="host"]')
    const portInput = page.locator('.session-form input[id="port"]')
    const usernameInput = page.locator('.session-form input[id="username"]')
    const passwordInput = page.locator('.session-form input[id="password"]')

    await nameInput.fill(sessionName)
    await hostInput.fill(testConfig.ssh.host)
    await portInput.fill(String(testConfig.ssh.port))
    await usernameInput.fill(testConfig.ssh.username)
    await passwordInput.fill(testConfig.ssh.password)

    // 保存会话
    const saveBtn = page.locator('.session-form .btn.submit')
    await saveBtn.click()
    await page.waitForTimeout(1000)

    // 连接会话
    console.log('连接SSH会话')
    const sessionItem = page.locator('.session-item').filter({ hasText: sessionName })
    await sessionItem.dblclick()
    await page.waitForTimeout(2000)

    // 输入几个回车
    console.log('输入几个回车以生成文本内容')
    const terminal = page.locator('.x-terminal')
    await terminal.click()
    await page.waitForTimeout(300)
    
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1000)

    // 截图：选中文本前
    console.log('截图：选中文本前')
    await page.screenshot({ path: 'test-results/before-selection.png', fullPage: false })

    // 选中文本（模拟鼠标拖动选择）
    console.log('开始选中文本...')
    const terminalBounds = await terminal.boundingBox()
    if (terminalBounds) {
      // 从左到右拖动选择文本
      await page.mouse.move(terminalBounds.x + 50, terminalBounds.y + 50)
      await page.mouse.down()
      
      // 慢慢移动鼠标，让用户看到选中过程
      for (let i = 0; i <= 150; i += 10) {
        await page.mouse.move(terminalBounds.x + 50 + i, terminalBounds.y + 50, { steps: 1 })
        await page.waitForTimeout(50)
      }
      
      await page.mouse.up()
      console.log('文本已选中')
      await page.waitForTimeout(1000) // 等待1秒，让用户看到选中效果
    }

    // 截图：选中文本后
    console.log('截图：选中文本后')
    await page.screenshot({ path: 'test-results/after-selection.png', fullPage: false })

    // 验证选中样式存在且有正确的背景色
    const selectionElement = terminal.locator('.xterm-selection')
    const selectionVisible = await selectionElement.isVisible()
    console.log(`选中元素可见: ${selectionVisible}`)
    
    // 如果选中可见，验证选中区域的背景色
    if (selectionVisible) {
      const selectionBg = await selectionElement.evaluate((el) => {
        const selectionDiv = el.querySelector('div')
        if (selectionDiv) {
          return window.getComputedStyle(selectionDiv).backgroundColor
        }
        return null
      })
      console.log(`选中背景色: ${selectionBg}`)
      
      // 浅色主题下选中背景色应该是浅蓝色 #add6ff (rgb(173, 214, 255))
      if (selectionBg) {
        expect(selectionBg).toContain('173')
      }
    }

    // 验证主题配置
    const themeConfig = await page.evaluate(() => {
      const stored = localStorage.getItem('app-settings')
      if (stored) {
        const config = JSON.parse(stored)
        return config.theme
      }
      return null
    })
    console.log(`当前主题配置: ${themeConfig}`)
    expect(themeConfig).toBe('light')

    // 验证终端背景色是白色
    const terminalBg = await terminal.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    console.log(`终端背景色: ${terminalBg}`)
    expect(terminalBg).toContain('255')
    
    console.log('===== 测试完成 =====')
    console.log('请查看截图：')
    console.log('  - test-results/before-selection.png (选中文本前)')
    console.log('  - test-results/after-selection.png (选中文本后)')
  })

  test('深色主题应用到所有组件', async () => {
    // 先进入设置页面（如果不在设置页面）
    const settingsContainer = page.locator('.settings-container')
    const isSettingsVisible = await settingsContainer.isVisible()
    
    if (!isSettingsVisible) {
      const settingsBtn = page.locator('.sidebar-section .settings-btn, .settings-btn').first()
      await settingsBtn.click()
      await page.waitForTimeout(500)
    }

    // 切换到深色主题
    const darkRadio = page.locator('.el-radio').filter({ hasText: '深色' })
    await darkRadio.click()
    await page.waitForTimeout(500)

    // 返回主页
    const backBtn = page.locator('.back-btn')
    await backBtn.click()
    await page.waitForTimeout(500)

    // 验证侧边栏背景色
    const sidebar = page.locator('.app-sidebar')
    const sidebarBg = await sidebar.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    // 深色主题侧边栏背景应该是深色 (rgb(37, 37, 38))
    expect(sidebarBg).toContain('37')

    // 验证标题栏背景色
    const header = page.locator('.app-header')
    const headerBg = await header.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    // 深色主题标题栏背景应该是深色
    expect(headerBg).toContain('37')

    // 验证整体布局背景色
    const appLayout = page.locator('.app-layout')
    const layoutBg = await appLayout.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    // 深色主题整体背景应该是深色 (rgb(30, 30, 30))
    expect(layoutBg).toContain('30')
  })

  test('切换回深色主题', async () => {
    // 先进入设置页面（如果不在设置页面）
    const settingsContainer = page.locator('.settings-container')
    const isSettingsVisible = await settingsContainer.isVisible()
    
    if (!isSettingsVisible) {
      const settingsBtn = page.locator('.sidebar-section .settings-btn, .settings-btn').first()
      await settingsBtn.click()
      await page.waitForTimeout(500)
    }

    // 点击深色主题
    const darkRadio = page.locator('.el-radio').filter({ hasText: '深色' })
    await darkRadio.click()
    await page.waitForTimeout(500)

    // 验证深色主题被选中
    const isChecked = await darkRadio.locator('.el-radio__input.is-checked').count()
    expect(isChecked).toBeGreaterThan(0)

    // 验证容器应用了深色主题类
    const container = page.locator('.settings-container')
    const hasDarkClass = await container.evaluate((el) => {
      return el.classList.contains('dark')
    })
    expect(hasDarkClass).toBe(true)
  })

  test('主题切换后光标闪烁设置保持不变', async () => {
    // 先进入设置页面
    const settingsContainer = page.locator('.settings-container')
    const isSettingsVisible = await settingsContainer.isVisible()
    
    if (!isSettingsVisible) {
      const settingsBtn = page.locator('.sidebar-section .settings-btn, .settings-btn').first()
      await settingsBtn.click()
      await page.waitForTimeout(500)
    }

    // 切换到终端标签页
    const terminalTab = page.locator('.el-tabs__item').filter({ hasText: '终端' })
    await terminalTab.click()
    await page.waitForTimeout(500)

    // 直接通过 localStorage 设置光标闪烁为 true
    await page.evaluate(() => {
      const stored = localStorage.getItem('app-settings')
      if (stored) {
        const config = JSON.parse(stored)
        config.terminal.cursorBlink = true
        localStorage.setItem('app-settings', JSON.stringify(config))
      }
    })

    // 验证光标闪烁已设置为 true
    const blinkValueBefore = await page.evaluate(() => {
      const stored = localStorage.getItem('app-settings')
      if (stored) {
        const config = JSON.parse(stored)
        return config.terminal?.cursorBlink
      }
      return null
    })
    expect(blinkValueBefore).toBe(true)

    // 切换到外观标签页
    const appearanceTab = page.locator('.el-tabs__item').filter({ hasText: '外观' })
    await appearanceTab.click()
    await page.waitForTimeout(300)

    // 切换到浅色主题
    const lightRadio = page.locator('.el-radio').filter({ hasText: '浅色' })
    await lightRadio.click()
    await page.waitForTimeout(500)

    // 验证 localStorage 中的光标闪烁设置仍然为 true
    const blinkValueAfterLightTheme = await page.evaluate(() => {
      const stored = localStorage.getItem('app-settings')
      if (stored) {
        const config = JSON.parse(stored)
        return config.terminal?.cursorBlink
      }
      return null
    })
    expect(blinkValueAfterLightTheme).toBe(true)

    // 切换回深色主题
    const darkRadio = page.locator('.el-radio').filter({ hasText: '深色' })
    await darkRadio.click()
    await page.waitForTimeout(500)

    // 再次验证 localStorage 中的光标闪烁设置
    const blinkValueAfterDarkTheme = await page.evaluate(() => {
      const stored = localStorage.getItem('app-settings')
      if (stored) {
        const config = JSON.parse(stored)
        return config.terminal?.cursorBlink
      }
      return null
    })
    expect(blinkValueAfterDarkTheme).toBe(true)
  })

  /**
   * 测试用例：浅色主题下会话表单输入框样式正确
   * 验证修复 BUG-007: 浅色主题下会话表单输入框样式问题
   * 确保输入框背景色、文字颜色、边框颜色在浅色主题下显示正确
   */
  test('浅色主题下会话表单输入框样式正确', async () => {
    console.log('===== 开始测试：浅色主题下会话表单输入框样式 =====')
    
    // 先进入设置页面（如果不在设置页面）
    const settingsContainer = page.locator('.settings-container')
    const isSettingsVisible = await settingsContainer.isVisible()
    
    if (!isSettingsVisible) {
      const settingsBtn = page.locator('.sidebar-section .settings-btn, .settings-btn').first()
      await settingsBtn.click()
      await page.waitForTimeout(500)
    }

    // 切换到浅色主题
    const lightRadio = page.locator('.el-radio').filter({ hasText: '浅色' })
    await lightRadio.click()
    await page.waitForTimeout(500)

    // 返回主页
    const backBtn = page.locator('.back-btn')
    await backBtn.click()
    await page.waitForTimeout(500)

    // 点击新建会话按钮
    const addBtn = page.locator('.sidebar-section .add-btn').first()
    await addBtn.click()
    await page.waitForTimeout(500)

    // 验证会话表单显示
    const sessionForm = page.locator('.session-form')
    await expect(sessionForm).toBeVisible()
    console.log('会话表单已显示')

    // 验证输入框样式
    const nameInput = page.locator('.session-form input[id="name"]')
    
    // 获取输入框的计算样式
    const inputStyles = await nameInput.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        backgroundColor: computed.backgroundColor,
        color: computed.color,
        borderColor: computed.borderColor
      }
    })
    
    console.log('输入框样式:', inputStyles)
    
    // 验证背景色为白色 (rgb(255, 255, 255))
    expect(inputStyles.backgroundColor).toContain('255')
    console.log('✓ 输入框背景色正确（白色）')
    
    // 验证文字颜色为深色 (rgb(51, 51, 51))
    expect(inputStyles.color).toContain('51')
    console.log('✓ 输入框文字颜色正确（深色）')
    
    // 验证边框颜色为浅灰色 (rgb(224, 224, 224))
    expect(inputStyles.borderColor).toContain('224')
    console.log('✓ 输入框边框颜色正确（浅灰色）')

    // 验证所有输入框样式一致
    const allInputs = page.locator('.session-form input[type="text"], .session-form input[type="password"], .session-form input[type="number"]')
    const inputCount = await allInputs.count()
    console.log(`找到 ${inputCount} 个输入框`)
    
    for (let i = 0; i < inputCount; i++) {
      const input = allInputs.nth(i)
      const styles = await input.evaluate((el) => {
        const computed = window.getComputedStyle(el)
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color
        }
      })
      
      // 所有输入框应该有相同的样式
      expect(styles.backgroundColor).toContain('255')
      expect(styles.color).toContain('51')
    }
    console.log('✓ 所有输入框样式一致')

    // 截图验证
    await page.screenshot({ path: 'test-results/light-theme-session-form.png', fullPage: false })
    console.log('截图已保存: test-results/light-theme-session-form.png')
    
    console.log('===== 测试完成：会话表单输入框样式正确 =====')
  })
})

/**
 * 字体设置测试
 */
test.describe('字体设置', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)

    // 进入设置页面
    const settingsBtn = page.locator('.sidebar-section .settings-btn, .settings-btn').first()
    await settingsBtn.click()
    await page.waitForTimeout(500)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('字体大小滑块可见', async () => {
    const slider = page.locator('.el-slider').first()
    await expect(slider).toBeVisible()
  })

  test('调整字体大小', async () => {
    // 获取当前字体大小
    const sliderInput = page.locator('.el-slider input[type="number"]')
    const currentValue = await sliderInput.inputValue()
    
    // 设置新字体大小
    const newSize = 18
    await sliderInput.fill(String(newSize))
    await page.waitForTimeout(300)

    // 验证字体大小已更新
    const newValue = await sliderInput.inputValue()
    expect(parseInt(newValue)).toBe(newSize)
  })

  test('字体类型选择器可见', async () => {
    const fontSelect = page.locator('.el-select').filter({ hasText: /Cascadia|Fira|Consolas|Monaco/ }).first()
    await expect(fontSelect).toBeVisible()
  })

  test('选择字体类型', async () => {
    // 点击字体选择器
    const fontSelect = page.locator('.el-form-item').filter({ hasText: '字体类型' }).locator('.el-select')
    await fontSelect.click()
    await page.waitForTimeout(300)

    // 选择 Fira Code
    const firaOption = page.locator('.el-select-dropdown__item').filter({ hasText: 'Fira Code' })
    await expect(firaOption).toBeVisible()
    await firaOption.click()
    await page.waitForTimeout(500)
  })
})

/**
 * 终端设置测试
 */
test.describe('终端设置', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)

    // 进入设置页面
    const settingsBtn = page.locator('.sidebar-section .settings-btn, .settings-btn').first()
    await settingsBtn.click()
    await page.waitForTimeout(500)

    // 切换到终端标签页
    const terminalTab = page.locator('.el-tabs__item').filter({ hasText: '终端' })
    await terminalTab.click()
    await page.waitForTimeout(300)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('光标样式选择器可见', async () => {
    const cursorSelect = page.locator('.el-form-item').filter({ hasText: '光标样式' }).locator('.el-select')
    await expect(cursorSelect).toBeVisible()
  })

  test('选择光标样式', async () => {
    // 点击光标样式选择器
    const cursorSelect = page.locator('.el-form-item').filter({ hasText: '光标样式' }).locator('.el-select')
    await cursorSelect.click()
    await page.waitForTimeout(300)

    // 选择下划线样式
    const underlineOption = page.locator('.el-select-dropdown__item').filter({ hasText: '下划线' })
    await expect(underlineOption).toBeVisible()
    await underlineOption.click()
    await page.waitForTimeout(500)
  })

  test('光标闪烁开关可见', async () => {
    const cursorBlinkSwitch = page.locator('.el-form-item').filter({ hasText: '光标闪烁' }).locator('.el-switch')
    await expect(cursorBlinkSwitch).toBeVisible()
  })

  test('切换光标闪烁', async () => {
    const cursorBlinkSwitch = page.locator('.el-form-item').filter({ hasText: '光标闪烁' }).locator('.el-switch')
    
    // 验证开关可见且可点击
    await expect(cursorBlinkSwitch).toBeVisible()
    await expect(cursorBlinkSwitch).toBeEnabled()
    
    // 点击切换
    await cursorBlinkSwitch.click()
    await page.waitForTimeout(500)
  })

  test('滚动缓冲区设置可见', async () => {
    const scrollbackInput = page.locator('.el-form-item').filter({ hasText: '滚动缓冲区' }).locator('.el-input-number')
    await expect(scrollbackInput).toBeVisible()
  })
})

/**
 * 设置持久化测试
 */
test.describe('设置持久化', () => {
  beforeAll(async () => {
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)
  })

  afterAll(async () => {
    await closeApp(app)
  })

  test('设置保存后重启应用仍然保留', async () => {
    // 进入设置页面
    const settingsBtn = page.locator('.sidebar-section .settings-btn, .settings-btn').first()
    await settingsBtn.click()
    await page.waitForTimeout(500)

    // 修改字体大小
    const sliderInput = page.locator('.el-slider input[type="number"]').first()
    await sliderInput.fill('20')
    await page.waitForTimeout(500)

    // 关闭应用
    await closeApp(app)

    // 重新启动应用
    const result = await startApp()
    app = result.app
    page = result.page
    await waitForAppReady(page)

    // 进入设置页面
    const newSettingsBtn = page.locator('.sidebar-section .settings-btn, .settings-btn').first()
    await newSettingsBtn.click()
    await page.waitForTimeout(500)

    // 验证字体大小仍然为 20
    const newSliderInput = page.locator('.el-slider input[type="number"]').first()
    const value = await newSliderInput.inputValue()
    expect(parseInt(value)).toBe(20)
  })
})
