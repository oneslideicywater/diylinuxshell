# Phase 4: V1.3 命令片段功能 - 实现计划

## 1. 概述

Phase 4 是 DIY-Linux-Shell 项目的命令片段功能阶段，目标是实现命令片段的管理和快速插入功能，提升用户执行重复命令的效率。

**核心功能范围**：
- ✅ 命令片段管理（创建、编辑、删除）
- ✅ 命令片段分组管理
- ✅ 命令片段搜索和过滤
- ✅ 快速插入命令片段到终端
- ✅ 命令片段标签管理

**预计工期**：2-3 天

**前置依赖**：Phase 1、Phase 2、Phase 3 已完成

---

## 2. 任务清单

### 2.1 类型定义

| 序号 | 任务 | 产出物 | 依赖 | 优先级 |
|------|------|--------|------|--------|
| 4.1 | 定义命令片段类型 | src/shared/types/index.ts | - | P0 |
| 4.2 | 定义命令片段分组类型 | src/shared/types/index.ts | - | P0 |

### 2.2 主进程服务层

| 序号 | 任务 | 产出物 | 依赖 | 优先级 |
|------|------|--------|------|--------|
| 4.3 | 实现命令片段存储服务 | src/main/services/store.ts 扩展 | 4.1 | P0 |
| 4.4 | 实现命令片段 IPC 处理 | src/main/ipc/command.ts | 4.3 | P0 |

### 2.3 渲染进程状态管理层

| 序号 | 任务 | 产出物 | 依赖 | 优先级 |
|------|------|--------|------|--------|
| 4.5 | 实现 CommandStore | src/renderer/src/stores/command.ts | 4.4 | P0 |

### 2.4 UI 组件层

| 序号 | 任务 | 产出物 | 依赖 | 优先级 |
|------|------|--------|------|--------|
| 4.6 | 实现命令片段列表组件 | CommandSnippetList.vue | 4.5 | P0 |
| 4.7 | 实现命令片段表单组件 | CommandSnippetForm.vue | 4.5 | P0 |
| 4.8 | 实现命令片段分组组件 | CommandSnippetGroupTree.vue | 4.5 | P0 |
| 4.9 | 集成终端插入功能 | XTerminal.vue 扩展 | 4.6 | P0 |

### 2.5 测试

| 序号 | 任务 | 产出物 | 依赖 | 优先级 |
|------|------|--------|------|--------|
| 4.10 | 编写 CommandStore 单元测试 | command.test.ts | 4.5 | P1 |
| 4.11 | 编写命令片段 IPC 集成测试 | command.integration.test.ts | 4.4 | P1 |
| 4.12 | 编写命令片段 E2E 测试 | command.e2e.spec.ts | 4.9 | P1 |

---

## 3. 模块实现顺序

```
┌─────────────────────────────────────────────────────────────────┐
│                        Phase 4 实现顺序                          │
│                                                                  │
│  1. 类型定义                                                     │
│     ├── 4.1 CommandSnippet 类型                                 │
│     └── 4.2 CommandSnippetGroup 类型                            │
│              │                                                   │
│              ▼                                                   │
│  2. 主进程服务层                                                 │
│     ├── 4.3 StoreService 扩展（命令片段 CRUD）                   │
│     └── 4.4 Command IPC (命令片段管理)                          │
│              │                                                   │
│              ▼                                                   │
│  3. 渲染进程状态管理层                                           │
│     └── 4.5 CommandStore                                        │
│              │                                                   │
│              ▼                                                   │
│  4. UI 组件层                                                    │
│     ├── 4.6 命令片段列表                                         │
│     ├── 4.7 命令片段表单                                         │
│     ├── 4.8 命令片段分组树                                       │
│     └── 4.9 终端集成                                             │
│              │                                                   │
│              ▼                                                   │
│  5. 测试                                                         │
│     └── 4.10-4.12 单元测试/集成测试/E2E 测试                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. 详细实现步骤

### 4.1 类型定义

#### 4.1.1 CommandSnippet (命令片段)

**文件**：`src/shared/types/index.ts`

```typescript
export interface CommandSnippet {
  id: string
  name: string
  description?: string
  command: string
  groupId?: string
  tags?: string[]
  createdAt: number
  updatedAt: number
}
```

#### 4.1.2 CommandSnippetGroup (命令片段分组)

```typescript
export interface CommandSnippetGroup {
  id: string
  name: string
  icon?: string
  order: number
  createdAt: number
  updatedAt: number
}
```

### 4.2 主进程 IPC 处理

#### 4.2.1 Command IPC (命令片段相关)

**文件**：`src/main/ipc/command.ts`

**通道列表**：
| 通道 | 方法 | 说明 |
|------|------|------|
| `command:get-all` | handle | 获取所有命令片段 |
| `command:get-by-id` | handle | 获取单个命令片段 |
| `command:create` | handle | 创建命令片段 |
| `command:update` | handle | 更新命令片段 |
| `command:delete` | handle | 删除命令片段 |
| `command-group:get-all` | handle | 获取所有分组 |
| `command-group:create` | handle | 创建分组 |
| `command-group:update` | handle | 更新分组 |
| `command-group:delete` | handle | 删除分组 |

### 4.3 状态管理层

#### 4.3.1 CommandStore

**文件**：`src/renderer/src/stores/command.ts`

**状态**：
```typescript
{
  snippets: CommandSnippet[]     // 所有命令片段
  groups: CommandSnippetGroup[]  // 所有分组
  activeGroupId?: string         // 当前激活的分组
}
```

**方法**：
- `addSnippet(snippet)` - 添加命令片段
- `removeSnippet(id)` - 移除命令片段
- `updateSnippet(id, updates)` - 更新命令片段
- `addGroup(group)` - 添加分组
- `removeGroup(id)` - 移除分组
- `updateGroup(id, updates)` - 更新分组
- `setActiveGroup(id)` - 设置激活分组

### 4.4 UI 组件层

#### 4.4.1 命令片段列表组件

**文件**：`CommandSnippetList.vue`

**功能**：
- 显示命令片段列表
- 支持按分组过滤
- 支持搜索
- 支持拖拽排序

#### 4.4.2 命令片段表单组件

**文件**：`CommandSnippetForm.vue`

**功能**：
- 创建/编辑命令片段
- 分组选择
- 标签管理
- 命令预览

#### 4.4.3 命令片段分组树组件

**文件**：`CommandSnippetGroupTree.vue`

**功能**：
- 树形显示分组
- 支持展开/折叠
- 支持拖拽移动

#### 4.4.4 终端集成

**文件**：`XTerminal.vue`

**功能**：
- 添加命令片段面板按钮
- 快速插入命令到终端
- 支持命令片段搜索

---

## 5. 文件产出清单

### 5.1 主进程文件

| 文件路径 | 功能描述 |
|----------|----------|
| `src/main/ipc/command.ts` | 命令片段 IPC 处理 |

### 5.2 渲染进程文件

| 文件路径 | 功能描述 |
|----------|----------|
| `src/renderer/src/stores/command.ts` | 命令片段状态管理 |
| `src/renderer/src/components/command/CommandSnippetList.vue` | 命令片段列表 |
| `src/renderer/src/components/command/CommandSnippetForm.vue` | 命令片段表单 |
| `src/renderer/src/components/command/CommandSnippetGroupTree.vue` | 命令片段分组树 |

### 5.3 测试文件

| 文件路径 | 功能描述 |
|----------|----------|
| `src/renderer/src/stores/__tests__/command.test.ts` | 命令片段 Store 单元测试 |
| `src/main/ipc/__tests__/command.integration.test.ts` | 命令片段 IPC 集成测试 |
| `e2e/command.e2e.spec.ts` | 命令片段功能 E2E 测试 |

---

## 6. 验收标准

### 6.1 功能验收

- [ ] 能够创建、编辑、删除命令片段
- [ ] 能够创建、编辑、删除命令片段分组
- [ ] 命令片段支持分组管理
- [ ] 命令片段支持标签管理
- [ ] 命令片段支持搜索和过滤
- [ ] 能够在终端中快速插入命令片段
- [ ] 命令片段分组支持树形结构
- [ ] 命令片段支持拖拽排序

### 6.2 技术验收

- [ ] 所有单元测试通过
- [ ] 所有集成测试通过
- [ ] 所有 E2E 测试通过
- [ ] TypeScript 类型检查无错误
- [ ] ESLint 检查无错误

### 6.3 安全验收

- [ ] 命令片段执行前需要用户确认
- [ ] 危险命令有明确提示
- [ ] 无命令注入风险

---

## 7. 风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 命令片段执行风险 | 用户误操作 | 执行前确认、危险命令提示 |
| 命令片段管理复杂 | 用户体验差 | 简化操作流程、提供搜索过滤 |

---

## 8. 相关文档

- [Phase 4 PRD](./prd.md)
- [项目总计划](../../plan.md)
- [项目 PRD](../../PRD.md)
- [Phase 1 计划](../phase1/plan.md)
- [Phase 2 计划](../phase2/plan.md)
