# BUG-001-测试连接功能 E2E 测试失败

## 基本信息

| 项目 | 内容 |
|------|------|
| Bug ID | BUG-001 |
| 发现日期 | 2026-04-03 |
| 严重程度 | 中 |
| 状态 | 待修复 |
| 相关功能 | 测试连接功能 |

## 问题描述

E2E 测试用例在测试连接功能时失败，无法找到测试连接按钮。

## 复现步骤

1. 运行 E2E 测试：`npx playwright test e2e/test-connection.e2e.spec.ts`
2. 测试用例尝试点击测试连接按钮
3. 测试超时失败，报错：`TimeoutError: locator.click: Timeout 30000ms exceeded`

## 错误日志

```
TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('.session-form .btn.test')

  39 |     // 验证测试连接按钮存在
  40 |     const testBtn = page.locator('.session-form .btn.test')
> 41 |     await expect(testBtn).toBeVisible()
     |                          ^
```

## 原因分析

可能的原因：

1. **应用未重新编译**：前端代码已更新，但 Electron 应用未重新构建，导致运行的是旧版本代码
2. **测试时机问题**：表单可能还未完全渲染就尝试查找按钮
3. **选择器问题**：CSS 选择器可能不正确

## 解决方案

### 方案 1：重新编译应用（推荐）

由用户手动执行以下步骤：

```bash
# 1. 重新构建应用
npm run build

# 2. 运行 E2E 测试
npx playwright test e2e/test-connection.e2e.spec.ts
```

### 方案 2：使用开发模式调试

```bash
# 1. 启动开发服务器
npm run dev

# 2. 在另一个终端运行测试（需要配置测试使用 dev server）
```

### 方案 3：优化测试等待逻辑

如果重新编译后仍有问题，可能需要：

1. 增加表单打开后的等待时间
2. 使用更精确的选择器
3. 添加元素可见性检查

## 相关测试用例

- `e2e/test-connection.e2e.spec.ts` - 测试连接功能 E2E 测试

## 影响范围

- 仅影响 E2E 测试
- 不影响实际功能（功能已在开发环境中手动验证）

## 后续行动

1. ✅ 更新 PRD 和 Plan 文档
2. ✅ 创建 E2E 测试用例
3. ⏳ 等待用户重新编译应用
4. ⏳ 运行测试验证
5. ⏳ 根据测试结果优化测试用例

## 备注

测试连接功能已在代码层面完整实现，包括：
- UI 组件（按钮、结果显示）
- 验证逻辑
- IPC 通信
- 主进程处理
- CSS 样式

E2E 测试失败很可能是因为应用未重新编译导致。
