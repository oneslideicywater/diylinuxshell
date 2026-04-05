/**
 * 分组表单背景遮罩测试
 * 验证新建分组弹出框的背景遮罩是否足够不透明
 * 
 * 运行方式：npx playwright test group-form-overlay.e2e.spec.ts --project=electron
 */

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'

test.describe('分组表单背景遮罩', () => {
  test('分组表单遮罩层应该有透明背景，弹出框应该有不透明背景', async () => {
    // 读取 SessionGroupForm.vue 文件内容
    const componentPath = join(__dirname, '../../src/renderer/src/components/session/SessionGroupForm.vue')
    const componentContent = readFileSync(componentPath, 'utf-8')
    
    // 验证遮罩层是透明背景
    expect(componentContent).toContain('.group-form-overlay')
    expect(componentContent).toMatch(/background:\s*transparent/)
    
    // 验证弹出框使用明确的不透明背景色 #2d2d30
    expect(componentContent).toMatch(/\.group-form[\s\S]*?background:\s*#2d2d30/)
    
    // 验证弹出框不透明
    expect(componentContent).toMatch(/\.group-form[\s\S]*?opacity:\s*1;/)
    
    // 验证表单主体、表单组、输入框等子元素都不透明
    expect(componentContent).toMatch(/\.form-body[\s\S]*?opacity:\s*1;/)
    expect(componentContent).toMatch(/\.form-group[\s\S]*?opacity:\s*1;/)
    expect(componentContent).toMatch(/\.input-wrapper[\s\S]*?opacity:\s*1;/)
    expect(componentContent).toMatch(/\.input-wrapper input[\s\S]*?opacity:\s*1;/)
    
    console.log('✓ 分组表单遮罩层和弹出框透明度样式正确')
  })
})
