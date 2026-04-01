import { expect, Page } from '@playwright/test'

/**
 * 自定义断言辅助函数
 */

/**
 * 断言元素可见
 */
export async function assertElementVisible(page: Page, selector: string): Promise<void> {
  await expect(page.locator(selector)).toBeVisible()
}

/**
 * 断言元素包含文本
 */
export async function assertElementContainsText(
  page: Page,
  selector: string,
  text: string
): Promise<void> {
  await expect(page.locator(selector)).toContainText(text)
}

/**
 * 断言元素具有特定属性值
 */
export async function assertElementHasAttribute(
  page: Page,
  selector: string,
  attribute: string,
  value: string
): Promise<void> {
  await expect(page.locator(selector)).toHaveAttribute(attribute, value)
}

/**
 * 断言元素数量
 */
export async function assertElementCount(
  page: Page,
  selector: string,
  count: number
): Promise<void> {
  await expect(page.locator(selector)).toHaveCount(count)
}

/**
 * 断言终端包含文本
 */
export async function assertTerminalContainsText(
  page: Page,
  text: string,
  timeout: number = 5000
): Promise<void> {
  const terminal = page.locator('.terminal-container')
  await expect(terminal).toContainText(text, { timeout })
}

/**
 * 断言会话状态
 */
export async function assertSessionStatus(
  page: Page,
  sessionId: string,
  status: 'connected' | 'connecting' | 'disconnected'
): Promise<void> {
  const sessionItem = page.locator(`[data-session-id="${sessionId}"]`)
  const statusIndicator = sessionItem.locator('.session-status')
  await expect(statusIndicator).toHaveClass(new RegExp(status))
}

/**
 * 断言标签页数量
 */
export async function assertTabCount(page: Page, count: number): Promise<void> {
  const tabs = page.locator('.tab')
  await expect(tabs).toHaveCount(count)
}

/**
 * 断言当前激活标签页
 */
export async function assertActiveTab(page: Page, tabTitle: string): Promise<void> {
  const activeTab = page.locator('.tab.active')
  await expect(activeTab.locator('.tab-title')).toContainText(tabTitle)
}

/**
 * 断言窗口最大化状态
 */
export async function assertWindowMaximized(page: Page, maximized: boolean): Promise<void> {
  const container = page.locator('.app-container')
  if (maximized) {
    await expect(container).toHaveClass(/is-maximized/)
  } else {
    await expect(container).not.toHaveClass(/is-maximized/)
  }
}

/**
 * 等待终端就绪
 */
export async function waitForTerminalReady(page: Page, timeout: number = 10000): Promise<void> {
  await page.waitForSelector('.xterm', { timeout })
  await page.waitForTimeout(500) // 额外等待终端初始化
}

/**
 * 等待连接建立
 */
export async function waitForConnection(
  page: Page,
  sessionId: string,
  timeout: number = 30000
): Promise<void> {
  const statusIndicator = page
    .locator(`[data-session-id="${sessionId}"]`)
    .locator('.session-status')
  await expect(statusIndicator).toHaveClass(/connected/, { timeout })
}
