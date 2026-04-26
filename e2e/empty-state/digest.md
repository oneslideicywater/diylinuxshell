# Empty State 测试用例摘要

## 测试职责

测试应用在没有会话数据时的空状态显示。

## 测试文件清单

| 文件 | 描述 |
|------|------|
| [test-empty-state-full.e2e.spec.ts](./test-empty-state-full.e2e.spec.ts) | 完整空状态页面显示测试 |
| [test-sessionlist-empty-state.e2e.spec.ts](./test-sessionlist-empty-state.e2e.spec.ts) | 会话列表区域空状态测试 |

## 测试覆盖范围

- 无会话时主内容区显示"请选择或创建一个会话"
- 会话列表空状态 UI
- 空状态下的引导操作按钮
