# Session Form 测试用例摘要

## 测试职责

测试会话表单和分组表单的 UI、交互、验证、树形选择器功能。

## 测试文件清单

| 文件 | 描述 |
|------|------|
| [clear-all-data.e2e.spec.ts](./clear-all-data.e2e.spec.ts) | 清除所有会话数据功能 |
| [clear-and-create.e2e.spec.ts](./clear-and-create.e2e.spec.ts) | 清除后重新创建会话 |
| [debug-group-depth.e2e.spec.ts](./debug-group-depth.e2e.spec.ts) | 分组深度选择调试 |
| [debug-tree-select-display.e2e.spec.ts](./debug-tree-select-display.e2e.spec.ts) | 树形选择器显示调试 |
| [default-group.e2e.spec.ts](./default-group.e2e.spec.ts) | 默认分组功能 |
| [group-form-overlay.e2e.spec.ts](./group-form-overlay.e2e.spec.ts) | 分组表单覆盖层交互 |
| [session-form-enhancement.e2e.spec.ts](./session-form-enhancement.e2e.spec.ts) | 会话表单美化和密码可见性 |
| [session-form-modal.e2e.spec.ts](./session-form-modal.e2e.spec.ts) | 会话表单模态行为 |
| [tree-group-expand.e2e.spec.ts](./tree-group-expand.e2e.spec.ts) | 树形分组展开功能 |
| [tree-group-select-console-error.e2e.spec.ts](./tree-group-select-console-error.e2e.spec.ts) | 树形分组选择控制台错误捕获 |

## 测试覆盖范围

- 会话表单字段验证（名称/主机/端口/用户名/密码）
- 表单提交和取消
- 密码可见性切换
- 分组表单（名称/图标选择）
- 树形选择器展开/折叠/选择
- 默认分组显示和选择
- 表单模态行为（遮罩/关闭）
- 数据清除功能
