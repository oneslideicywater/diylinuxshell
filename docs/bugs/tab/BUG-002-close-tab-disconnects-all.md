# BUG-002: 关闭标签页导致同会话标签页全部断开

## 问题描述

**发现时间**: 2026-04-01

**严重程度**: 高 (P0)

**问题描述**: 
点击关闭一个标签页时，其他属于同一会话的标签页全部断开连接。这导致用户无法为同一个会话创建多个独立的终端标签页。

## 复现步骤

1. 创建一个会话并连接
2. 双击同一会话多次，创建多个标签页（例如3个）
3. 关闭其中一个标签页
4. 观察其他标签页的状态

## 预期行为

- 关闭一个标签页应该只断开该标签页的连接
- 其他标签页应该保持连接状态
- 每个标签页应该有独立的SSH连接

## 实际行为

- 关闭一个标签页后，所有属于同一会话的标签页都断开连接
- 标签页状态指示器变为断开状态（灰色）
- 终端显示"[连接已关闭]"

## 根因分析

### 问题代码位置

`src/main/services/ssh-manager.ts`

### 问题原因

当前实现中，SSH连接是以会话ID为键存储的，一个会话ID对应一个SSH连接。当关闭标签页时，会调用 `session.disconnect(sessionId)`，这会断开该会话ID对应的SSH连接，导致所有使用该会话ID的标签页都断开。

```typescript
// 问题代码逻辑
// 一个 sessionId 对应一个 SSH 连接
connections.set(sessionId, connection)

// 关闭标签页时调用
await window.api.session.disconnect(sessionId)
// 这会断开该 sessionId 的所有标签页
```

### 设计缺陷

当前架构设计假设一个会话只有一个连接，但实际上用户可能需要为同一会话创建多个标签页（例如同时查看不同目录或执行不同命令）。

## 解决方案

### 方案一：每个标签页独立SSH连接（推荐）

为每个标签页创建独立的SSH连接，而不是共享会话的连接。

**修改点**:
1. `ssh-manager.ts`: 以标签页ID为键存储连接
2. `terminal.ts` Store: 在创建标签页时初始化连接
3. IPC通信: 修改连接/断开的参数为标签页ID

**优点**:
- 每个标签页完全独立
- 关闭一个不影响其他
- 符合XShell行为标准

**缺点**:
- 需要更多服务器连接资源

### 方案二：连接引用计数

使用引用计数管理共享连接，只有当引用计数为0时才真正断开。

**修改点**:
1. `ssh-manager.ts`: 添加引用计数
2. 标签页创建时增加计数
3. 标签页关闭时减少计数

**优点**:
- 节省连接资源
- 改动较小

**缺点**:
- 标签页之间仍然共享连接状态
- 可能存在状态同步问题

## 影响范围

- 标签页管理功能
- SSH连接管理
- 会话状态管理

## 临时解决方案

暂无

## 修复状态

- [x] 已修复 (2026-04-01)

## 修复方案

采用方案一：每个标签页独立SSH连接。

### 修改的文件

1. `src/main/services/ssh-manager.ts` - 使用 tabId 作为连接键
2. `src/main/ipc/session.ts` - 更新 IPC 处理程序
3. `src/main/ipc/terminal.ts` - 更新终端 IPC 处理
4. `src/preload/index.ts` - 更新 API 接口
5. `src/shared/types/global.d.ts` - 更新类型定义
6. `src/renderer/src/components/session/SessionList.vue` - 更新连接逻辑
7. `src/renderer/src/components/terminal/TerminalTabs.vue` - 更新关闭逻辑
8. `src/renderer/src/components/terminal/XTerminal.vue` - 更新数据监听

## 相关测试用例

- `e2e/tabs.e2e.spec.ts`: 标签页关闭测试
- 新增测试: 关闭一个标签页不影响其他标签页

## 相关文档

- [PRD.md](../PRD.md): 多标签页功能需求
- [plan/phase1/prd.md](../plan/phase1/prd.md): 标签页管理验收标准
