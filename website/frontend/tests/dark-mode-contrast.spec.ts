import { test, expect } from "@playwright/test"

/* 暗色主题文字对比度测试
   验证关键文字元素在暗色背景下的可见性
   WCAG AA 标准：正文对比度 >= 4.5:1，大字标题 >= 3:1
*/

test.describe("暗色主题 - 文字对比度", () => {
  test.beforeEach(async ({ page }) => {
    /* 在页面加载前设置 localStorage 模拟用户选择过暗色模式 */
    await page.addInitScript(() => {
      window.localStorage.setItem("theme", "dark")
    })
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    /* 额外等待 next-themes 完成初始化 */
    await page.waitForTimeout(1000)
  })

  test("主标题 DIY-Linux-Shell 应该足够亮", async ({ page }) => {
    const h1 = page.locator("h1").first()
    await expect(h1).toBeVisible()

    const color = await h1.evaluate((el) =>
      getComputedStyle(el).color
    )
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (match) {
      const [, r, g, b] = match.map(Number)
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      console.log(`[主标题] color=${color}, brightness=${brightness.toFixed(0)}`)
      expect(brightness).toBeGreaterThanOrEqual(180)
    }
  })

  test("副标题 '现代化的 SSH 终端管理工具' 应该清晰可见", async ({ page }) => {
    const subtitle = page.getByText("现代化的 SSH 终端管理工具", { exact: true })
    await expect(subtitle).toBeVisible()

    const color = await subtitle.evaluate((el) =>
      getComputedStyle(el).color
    )
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (match) {
      const [, r, g, b] = match.map(Number)
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      console.log(`[副标题] color=${color}, brightness=${brightness.toFixed(0)}`)
      expect(brightness).toBeGreaterThanOrEqual(140)
    }
  })

  test("描述段落文字应该可读", async ({ page }) => {
    const desc = page.locator("p").filter({ hasText: /Electron.*Vue.*TypeScript/ }).first()
    await expect(desc).toBeVisible()

    const color = await desc.evaluate((el) =>
      getComputedStyle(el).color
    )
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (match) {
      const [, r, g, b] = match.map(Number)
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      console.log(`[描述段] color=${color}, brightness=${brightness.toFixed(0)}`)
      expect(brightness).toBeGreaterThanOrEqual(120)
    }
  })

  test("Tech Stack 标题 '成熟稳定的技术生态' 应该清晰", async ({ page }) => {
    const heading = page.getByText("成熟稳定的技术生态")
    await expect(heading).toBeVisible({ timeout: 5000 })

    const color = await heading.evaluate((el) =>
      getComputedStyle(el).color
    )
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (match) {
      const [, r, g, b] = match.map(Number)
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      console.log(`[TechStack标题] color=${color}, brightness=${brightness.toFixed(0)}`)
      expect(brightness).toBeGreaterThanOrEqual(180)
    }
  })

  test("CTA 标题应该可见", async ({ page }) => {
    const ctaTitle = page.getByText("准备好提升你的终端效率了吗？")
    await expect(ctaTitle).toBeVisible({ timeout: 5000 })

    const color = await ctaTitle.evaluate((el) =>
      getComputedStyle(el).color
    )
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (match) {
      const [, r, g, b] = match.map(Number)
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      console.log(`[CTA标题] color=${color}, brightness=${brightness.toFixed(0)}`)
      expect(brightness).toBeGreaterThanOrEqual(180)
    }
  })

  test("功能卡片标题应该可读", async ({ page }) => {
    const cardTitle = page.getByRole("heading", { name: /多会话|SFTP|分组|主题切换|快捷命令|历史记录/ }).first()
    await expect(cardTitle).toBeVisible({ timeout: 5000 })

    const color = await cardTitle.evaluate((el) =>
      getComputedStyle(el).color
    )
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (match) {
      const [, r, g, b] = match.map(Number)
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      console.log(`[卡片标题] color=${color}, brightness=${brightness.toFixed(0)}`)
      expect(brightness).toBeGreaterThanOrEqual(140)
    }
  })
})
