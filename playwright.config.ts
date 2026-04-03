import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 测试配置
 * 
 * 测试用例按功能分类存放在 e2e 目录下的子目录中：
 * - app/: 应用基础功能测试
 * - connection/: 连接功能测试
 * - context-menu/: 右键菜单测试
 * - debug/: 调试和测试工具
 * - empty-state/: 空状态测试
 * - layout/: 应用布局测试
 * - session/: 会话管理测试
 * - session-form/: 会话表单测试
 * - settings/: 设置功能测试
 * - terminal/: 终端功能测试
 * 
 * 运行测试：
 * - npm run test:e2e - 运行所有测试（自动关闭）
 * - npx playwright test - 运行所有测试
 * - npx playwright test <目录> - 运行指定目录测试
 * - npx playwright test --debug - 调试模式
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list']
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // 设置浏览器关闭超时，防止卡死
    launchOptions: {
      timeout: 30000
    }
  },
  projects: [
    {
      name: 'electron',
      use: {
        ...devices['Desktop Chrome']
      }
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome']
      }
    }
  ],
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  outputDir: 'test-results',
  // 全局超时设置，防止测试卡死
  globalTimeout: 300000
})
