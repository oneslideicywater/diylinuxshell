import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

/**
 * Vitest单元测试配置
 */
export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['src/main/**/*', 'node_modules', 'out', 'e2e/**/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/main/',
        'src/preload/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/renderer/src/main.ts'
      ],
      lines: 75,
      functions: 70,
      branches: 70,
      statements: 75
    },
    setupFiles: ['./src/renderer/src/test/setup.ts']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer/src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@main': path.resolve(__dirname, './src/main')
    }
  }
})
