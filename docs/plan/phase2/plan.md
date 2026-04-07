# Phase 2 实施计划

## 当前状态

### ✅ 已完成
1. **密钥认证** - 完全实现
2. **主题配置** - 完全实现
3. **设置页面** - 完全实现
4. **会话分组功能** - 完全实现
5. **菜单项高亮效果** - 完全实现
   - ✅ 鼠标悬停时菜单项有明显高亮背景
   - ✅ 高亮效果使用过渡动画
   - ✅ 危险操作有特殊高亮颜色
   - ✅ 子菜单在父菜单项 hover 时同时高亮
6. **会话分组功能** - 完全实现
   - ✅ 类型定义完整（Session, SessionGroup）
   - ✅ 主进程 StoreService 支持分组 CRUD
   - ✅ IPC 通道已定义（SESSION_GROUP）
   - ✅ 主进程 IPC 处理器已创建（session-group.ts）
   - ✅ 渲染进程 API 已封装（sessionGroupAPI）
   - ✅ SessionStore 已添加分组管理方法
   - ✅ SessionList UI 已支持分组显示
   - ✅ SessionList 已加载分组数据
   - ✅ 分组管理 UI 已完成（创建、编辑、删除分组）
   - ✅ SessionForm 已添加分组选择功能
   - ✅ 会话侧边栏右键菜单（新建分组、删除分组、编辑分组、添加会话到分组）
   - ✅ 会话移动到分组功能
   - ✅ 分组图标选择（6 种图标）
   - ✅ 测试用例编写完成
   - ✅ 构建测试通过
   - ✅ E2E 测试全部通过（7 个测试用例）
   - ✅ 树形分组选择器实现
   - ✅ SessionForm 集成树形分组选择器
   - ✅ 默认分组功能
     - ✅ 应用启动时创建默认分组（如果不存在）
     - ✅ 未指定分组时自动添加到默认分组
     - ✅ 默认分组不可删除
     - ✅ 删除分组时级联删除会话
5. **测试连接功能** - 完全实现
   - ✅ 测试连接按钮 UI
   - ✅ 字段验证逻辑
   - ✅ IPC 通道定义（session:test-connection）
   - ✅ 主进程 IPC 处理器
   - ✅ 测试结果展示 UI
   - ✅ 加载状态处理
   - ✅ 错误处理
   - ✅ CSS 样式
   - ✅ E2E 测试用例
6. **嵌套分组层级限制** - 完全实现
   - ✅ 最多支持 5 级嵌套分组
   - ✅ 创建子分组时检查层级限制
   - ✅ 拖拽分组时检查层级限制
   - ✅ 超限提示文案已定义
   - ✅ UI 禁用状态设计已定义
   - ✅ 类型定义（parentId, depth, MAX_GROUP_DEPTH）
   - ✅ 工具函数（calculateGroupDepth, canCreateSubGroup 等）
   - ✅ StoreService 层级验证
   - ✅ IPC 处理器支持
   - ✅ SessionGroupTree 递归组件
   - ✅ 缩进优化（8px/层，共 40px）
   - ✅ 侧边栏滚动支持
   - ✅ E2E 测试用例
   - ✅ Bug 修复（BUG-015-缩进过大）
7. **侧边栏宽度调整** - 完全实现 ✅
   - ✅ PRD 已更新
   - ✅ 功能已实现
     - ✅ 拖拽手柄 UI
     - ✅ 宽度调整逻辑（handleResizeStart）
     - ✅ 宽度范围限制（200px-500px）
     - ✅ localStorage 记忆功能
     - ✅ 拖拽视觉反馈
   - ✅ 测试用例已编写
     - ✅ 7 个 E2E 测试全部通过
   - ✅ Bug 修复（BUG-016-拖拽失效）
8. **L 型连接线** - 完全实现 ✅
   - ✅ PRD 已更新（L 型连接线设计）
   - ✅ 功能已实现
     - ✅ 垂直线段（从父分组底部延伸至子分组底部）
     - ✅ 水平线段（从垂直线段延伸至子分组头部）
     - ✅ 线条颜色（var(--el-border-color-light)）
     - ✅ 线条粗细（1px）
     - ✅ 使用 ::before 和 ::after 伪元素
   - ✅ 实现文件：SessionGroupTree.vue
9. **SFTP 文件传输功能** - 完全实现 ✅
   - ✅ SFTP 窗口 UI（双面板布局）
   - ✅ 本地文件列表显示
   - ✅ 远程文件列表显示
   - ✅ 文件上传功能
   - ✅ 文件下载功能
   - ✅ 新建文件夹功能
   - ✅ 删除文件功能
   - ✅ 主题适配（深色/浅色）
   - ✅ 工具栏右键菜单
   - ✅ 文件夹下载（递归下载）
   - ✅ 下载优化（直接传输到左侧当前文件夹）
   - ✅ 测试用例编写完成
   - ✅ E2E 测试全部通过（8 个测试用例）

### ❌ 未开始
**命令片段功能**
- 需要完整实现

### ✅ 已完成
**SFTP 增强功能**
- ✅ 文件夹上传功能（递归上传）
- ✅ 进度状态栏（实时显示上传/下载进度）
- ✅ 文件夹下载功能（已实现）

## 实施步骤

### 步骤 1：完成会话分组功能

#### 1.1 主进程 IPC 处理器
创建 `src/main/ipc/session-group.ts`：

```typescript
import { ipcMain } from 'electron'
import { StoreService } from '../services/store'
import { IPC_CHANNELS } from '@shared/constants/ipc-channels'
import type { SessionGroup } from '@shared/types'

export function registerSessionGroupHandlers(): void {
  // 获取所有分组
  ipcMain.handle(IPC_CHANNELS.SESSION_GROUP.GET_ALL, () => {
    return StoreService.getSessionGroups()
  })

  // 创建分组
  ipcMain.handle(IPC_CHANNELS.SESSION_GROUP.CREATE, (_event, groupData: Omit<SessionGroup, 'id' | 'createdAt' | 'updatedAt'>) => {
    const group: SessionGroup = {
      ...groupData,
      id: CryptoService.generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    StoreService.addSessionGroup(group)
    return group
  })

  // 更新分组
  ipcMain.handle(IPC_CHANNELS.SESSION_GROUP.UPDATE, (_event, id: string, updates: Partial<SessionGroup>) => {
    StoreService.updateSessionGroup(id, updates)
    return StoreService.getSessionGroups().find(g => g.id === id)
  })

  // 删除分组
  ipcMain.handle(IPC_CHANNELS.SESSION_GROUP.DELETE, (_event, id: string) => {
    StoreService.deleteSessionGroup(id)
    return true
  })
}
```

#### 1.2 渲染进程 API 封装
更新 `src/renderer/src/api/session.ts`：

```typescript
// 添加分组相关方法
export const sessionGroupApi = {
  getAll: () => window.api.invoke(IPC_CHANNELS.SESSION_GROUP.GET_ALL),
  create: (group: Omit<SessionGroup, 'id' | 'createdAt' | 'updatedAt'>) => 
    window.api.invoke(IPC_CHANNELS.SESSION_GROUP.CREATE, group),
  update: (id: string, updates: Partial<SessionGroup>) => 
    window.api.invoke(IPC_CHANNELS.SESSION_GROUP.UPDATE, id, updates),
  delete: (id: string) => 
    window.api.invoke(IPC_CHANNELS.SESSION_GROUP.DELETE, id)
}
```

#### 1.3 更新 SessionList 组件
在 `SessionList.vue` 中添加：
- 加载分组数据
- 添加分组管理按钮（新建、编辑、删除）
- 添加分组管理对话框

#### 1.4 更新 SessionForm 组件
在 `SessionForm.vue` 中添加：
- 分组选择下拉框
- 将会话分配到分组的功能

### 步骤 2：实现命令片段功能

#### 2.1 类型定义
检查 `src/shared/types/index.ts`，确保有以下类型：

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

export interface CommandSnippetGroup {
  id: string
  name: string
  icon?: string
  order: number
  createdAt: number
  updatedAt: number
}
```

#### 2.2 主进程 IPC 处理器
创建 `src/main/ipc/command.ts`

#### 2.3 渲染进程 Store
创建 `src/renderer/src/stores/command.ts`

#### 2.4 UI 组件
- `CommandSnippetList.vue` - 命令片段列表
- `CommandSnippetForm.vue` - 命令片段表单
- 在终端组件中添加快速插入按钮

### 步骤 3：测试

#### 3.1 单元测试
- `session-group.test.ts` - 会话分组 Store 测试
- `command.test.ts` - 命令片段 Store 测试

#### 3.2 集成测试
- `session-group.integration.test.ts` - 会话分组 IPC 测试
- `command.integration.test.ts` - 命令片段 IPC 测试

#### 3.3 E2E 测试
- `session-group.e2e.spec.ts` - 会话分组功能测试
- `command.e2e.spec.ts` - 命令片段功能测试

### 步骤 4：侧边栏宽度调整功能

#### 4.1 功能实现
- 在 SessionList 组件中添加拖拽手柄
- 实现宽度调整逻辑
- 添加宽度记忆功能（localStorage）
- 添加鼠标滚轮滚动支持

#### 4.2 测试
- 拖拽功能测试
- 宽度范围限制测试
- 记忆功能测试
- 滚轮滚动测试

## 验收标准

### 会话分组（已完成 ✅）
- [x] 能够创建、编辑、删除会话分组
- [x] 删除分组时，若分组包含会话，弹出二次确认
- [x] 能够将会话移动到指定分组（右键菜单）
- [x] 支持拖拽会话到分组内
- [x] 支持批量选择会话并移动到分组
- [x] 分组支持展开/折叠
- [x] 分组头部显示会话数量
- [x] 支持为分组选择不同图标
- [x] 右键菜单层级正确（空白区域、分组、会话）
- [x] 删除分组后，级联删除分组内所有会话
- [x] 所有分组操作有 Tooltip 提示
- [x] 界面轻量化，无冗余操作
- [x] 会话侧边栏右键菜单支持新建分组
- [x] 分组头部右键菜单支持编辑、删除分组
- [x] 会话项右键菜单支持移动到分组
- [x] 分组图标选择功能
- [x] 分组功能在深色和浅色主题下正常显示
- [x] **嵌套分组层级限制（最多 5 级）**
  - [x] 创建子分组时检查当前层级，达到 5 级时禁止创建并提示
  - [x] 拖拽分组时检查目标位置层级，超出限制时禁止移入并提示
  - [x] 提示文案明确："子分组嵌套层级已达上限（最多 5 级），无法继续创建下级分组。"
  - [x] 提示文案明确："目标位置嵌套层级超限，无法移入该子分组下。"
  - [x] 嵌套层级达到上限时，目标分组显示禁用状态（灰色、不可拖入）
- [x] **菜单项高亮效果**
  - [x] 鼠标悬停在菜单项上时，菜单项有明显的高亮背景色
  - [x] 高亮效果使用过渡动画，提升视觉体验
  - [x] 危险操作（如删除）有特殊的高亮颜色
  - [x] 子菜单（移动到分组）在父菜单项 hover 时同时高亮
- [x] **树形分组选择器**
  - [x] 在编辑会话表单中使用树形结构显示分组
  - [x] 支持展开/折叠分组查看子分组
  - [x] 显示分组层级缩进
  - [x] 支持选择任意层级的分组
  - [x] 默认分组选项始终显示在顶部
  - [x] 深色和浅色主题下正常显示
  - [x] 滚动支持（分组过多时）

### 命令片段
- [ ] 能够创建、编辑、删除命令片段
- [ ] 命令片段支持分组管理
- [ ] 能够在终端中快速插入命令片段
- [ ] 命令片段支持搜索和过滤
- [ ] 命令片段功能在深色和浅色主题下正常显示

### 侧边栏宽度调整（已完成 ✅）
- [x] 支持拖拽侧边栏右边界调整宽度
- [x] 支持鼠标滚轮滚动查看内容
- [x] 宽度范围限制（200px-500px）
- [x] 宽度记忆功能
- [x] 拖拽时光标变为 ↔ 形状
- [x] 宽度调整平滑流畅
- [x] 拖拽手柄视觉反馈（hover 和 resizing 状态）
- [x] E2E 测试全部通过（7 个测试用例）

## 下一步行动

### 会话分组功能（已完成 ✅）
1. ✅ 创建 `src/main/ipc/session-group.ts` 文件
2. ✅ 在 `src/main/ipc/index.ts` 中注册分组处理器
3. ✅ 更新 `src/renderer/src/api/session.ts` 添加分组 API
4. ✅ 更新 `SessionList.vue` 加载分组数据
5. ✅ 创建分组管理 UI
6. ✅ 更新 `SessionForm.vue` 添加分组选择
7. ✅ 添加会话侧边栏右键菜单
8. ✅ 实现会话移动到分组功能
9. ✅ 编写测试用例
10. ✅ 实现空白区域右键菜单（包括空状态和有会话时的空白处）
11. ✅ 实现分组展开/折叠功能
12. ✅ 实现分组会话计数
13. ✅ 实现分组图标选择（6 种图标）
14. ✅ 实现删除分组二次确认
15. ✅ 实现 Tooltip 提示功能
16. ✅ 修复浅色主题下菜单文字显示问题
17. ✅ **实现嵌套分组层级限制（最多 5 级）**
    - ✅ 添加层级深度字段到 SessionGroup 类型
    - ✅ 实现计算分组层级的工具函数
    - ✅ 创建子分组时检查层级限制
    - ✅ 拖拽分组时检查层级限制
    - ✅ 实现超限提示对话框
    - ✅ 实现目标分组禁用状态 UI
    - ✅ 添加所有相关 Tooltip 提示文案

### 侧边栏宽度调整功能（已完成 ✅）
1. ✅ 更新 PRD 文档添加需求
2. ✅ 在 SessionList 组件中添加 container 容器
3. ✅ 实现拖拽手柄 UI（.resize-handle）
4. ✅ 实现宽度调整逻辑（handleResizeStart）
5. ✅ 添加宽度范围限制（200px-500px）
6. ✅ 实现 localStorage 记忆功能
7. ✅ 添加拖拽视觉反馈（cursor、background-color）
8. ✅ 编写 E2E 测试用例
9. ✅ 7 个测试用例全部通过

### 命令片段功能（待开始）
1. ❌ 创建类型定义
2. ❌ 创建主进程 IPC 处理器
3. ❌ 创建渲染进程 Store
4. ❌ 创建 UI 组件
5. ❌ 编写测试用例

## 预计工期

- 会话分组功能：2-3 天
- 命令片段功能：2-3 天
- 测试编写：1-2 天
- **总计：5-8 天**

## 技术实现细节

### 会话分组数据结构

```typescript
// SessionGroup.ts
export interface SessionGroup {
  id: string
  name: string
  icon?: string
  expanded?: boolean  // 展开/折叠状态
  order: number
  createdAt: number
  updatedAt: number
}

// Session.ts
export interface Session {
  id: string
  name: string
  host: string
  port: number
  username: string
  groupId?: string  // 所属分组 ID，默认为默认分组
  createdAt: number
  updatedAt: number
}
```

### IPC 通道定义

```typescript
// ipc-channels.ts
export const IPC_CHANNELS = {
  SESSION_GROUP: {
    GET_ALL: 'session-group:get-all',
    CREATE: 'session-group:create',
    UPDATE: 'session-group:update',
    DELETE: 'session-group:delete'
  }
}
```

### 主进程 IPC 处理器

```typescript
// session-group.ts
import { ipcMain } from 'electron'
import { StoreService } from '../services/store'
import { IPC_CHANNELS } from '@shared/constants/ipc-channels'
import type { SessionGroup } from '@shared/types'

export function registerSessionGroupHandlers(): void {
  // 获取所有分组
  ipcMain.handle(IPC_CHANNELS.SESSION_GROUP.GET_ALL, () => {
    return StoreService.getSessionGroups()
  })

  // 创建分组
  ipcMain.handle(
    IPC_CHANNELS.SESSION_GROUP.CREATE,
    (_event, groupData: Omit<SessionGroup, 'id' | 'createdAt' | 'updatedAt'>) => {
      const group: SessionGroup = {
        ...groupData,
        id: CryptoService.generateId(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      StoreService.addSessionGroup(group)
      return group
    }
  )

  // 更新分组
  ipcMain.handle(
    IPC_CHANNELS.SESSION_GROUP.UPDATE,
    (_event, id: string, updates: Partial<SessionGroup>) => {
      StoreService.updateSessionGroup(id, updates)
      return StoreService.getSessionGroups().find(g => g.id === id)
    }
  )

  // 删除分组（级联删除会话）
  ipcMain.handle(IPC_CHANNELS.SESSION_GROUP.DELETE, (_event, id: string) => {
    // 级联删除该分组下的所有会话
    StoreService.deleteSessionGroup(id, true)
    return true
  })
}
```

### 渲染进程 API 封装

```typescript
// session.ts
export const sessionGroupApi = {
  getAll: () => window.api.invoke(IPC_CHANNELS.SESSION_GROUP.GET_ALL),
  create: (group: Omit<SessionGroup, 'id' | 'createdAt' | 'updatedAt'>) => 
    window.api.invoke(IPC_CHANNELS.SESSION_GROUP.CREATE, group),
  update: (id: string, updates: Partial<SessionGroup>) => 
    window.api.invoke(IPC_CHANNELS.SESSION_GROUP.UPDATE, id, updates),
  delete: (id: string) => 
    window.api.invoke(IPC_CHANNELS.SESSION_GROUP.DELETE, id)
}
```

### SessionStore 状态管理

```typescript
// session.ts (store)
const sessionGroups = ref<SessionGroup[]>([])

// 加载分组数据
async function loadSessionGroups() {
  sessionGroups.value = await sessionGroupApi.getAll()
}

// 创建分组
async function createSessionGroup(groupData: Omit<SessionGroup, 'id' | 'createdAt' | 'updatedAt'>) {
  const group = await sessionGroupApi.create(groupData)
  sessionGroups.value.push(group)
}

// 删除分组（带二次确认）
async function deleteSessionGroup(id: string) {
  const groupSessions = sessions.value.filter(s => s.groupId === id)
  
  if (groupSessions.length > 0) {
    const confirmed = await showConfirmDialog(
      `该分组包含 ${groupSessions.length} 个会话，删除分组将会话全部删除，确定继续？`
    )
    if (!confirmed) return
  }
  
  await sessionGroupApi.delete(id)
  sessionGroups.value = sessionGroups.value.filter(g => g.id !== id)
  
  // 级联删除该分组下的会话（已在主进程中处理）
  sessions.value = sessions.value.filter(s => s.groupId !== id)
}

// 按分组获取会话
function getGroupSessions(groupId: string): Session[] {
  return sessions.value.filter(s => s.groupId === groupId)
}

// 获取默认分组会话
function getUngroupedSessions(): Session[] {
  return sessions.value.filter(s => !s.groupId)
}
```

### Tooltip 组件实现

```vue
<!-- Tooltip.vue -->
<template>
  <div class="tooltip-wrapper">
    <slot></slot>
    <div v-if="visible" class="tooltip" :style="tooltipStyle">
      {{ content }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

const props = withDefaults(defineProps<Props>(), {
  position: 'top'
})

const visible = ref(false)
const tooltipStyle = computed(() => ({
  // 根据 position 计算位置
}))
</script>
```

### 右键菜单组件

```vue
<!-- ContextMenu.vue -->
<template>
  <Teleport to="body">
    <div v-if="visible" class="context-menu" :style="menuStyle" @click.stop>
      <slot></slot>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Props {
  visible: boolean
  x: number
  y: number
}

const props = defineProps<Props>()

const menuStyle = computed(() => ({
  position: 'fixed',
  left: `${props.x}px`,
  top: `${props.y}px`,
  zIndex: 1000
}))

// 点击其他地方关闭菜单
onMounted(() => {
  document.addEventListener('click', closeMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenu)
})
</script>
```

### 拖拽功能实现

```vue
<!-- SessionItem.vue -->
<template>
  <div
    class="session-item"
    draggable
    @dragstart="handleDragStart"
    @dragover="handleDragOver"
    @drop="handleDrop"
  >
    {{ session.name }}
  </div>
</template>

<script setup lang="ts">
const handleDragStart = (event: DragEvent) => {
  event.dataTransfer?.setData('application/json', JSON.stringify({
    type: 'session',
    sessionId: session.id
  }))
}

const handleDrop = async (event: DragEvent) => {
  const data = JSON.parse(event.dataTransfer?.getData('application/json') || '{}')
  if (data.type === 'session') {
    await sessionApi.update(data.sessionId, { groupId: group.id })
  }
}
</script>
```

### 分组表单样式实现

**背景不透明处理**

问题：CSS 变量 `var(--bg-secondary)` 在某些情况下计算为 `rgba(0, 0, 0, 0)`（完全透明），导致弹出框透出底层内容。

解决方案：
```css
/* SessionGroupForm.vue */
.group-form {
  position: relative;
  width: 420px;
  background: #2d2d30; /* 使用明确的不透明背景色 */
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  opacity: 1; /* 弹出框不透明 */
  overflow: hidden;
  animation: slideUp 0.3s ease-out;
}

.group-form-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: transparent; /* 透明遮罩 */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}
```

### 默认分组显示顺序实现

**需求**：默认分组始终显示在分组列表最上方（无论创建时间）

**问题**：分组按 `order` 字段（创建时间）排序，导致默认分组可能不在最上方

**解决方案**：在 `SessionList.vue` 的 `sessionGroups` computed 属性中特殊处理默认分组

```typescript
// SessionList.vue
const sessionGroups = computed(() => {
  const groups = sessionStore.sessionGroups
  
  // 找到默认分组
  const defaultGroup = groups.find(g => g.name === '默认分组')
  
  if (!defaultGroup) {
    // 没有默认分组，直接返回所有分组（按 order 排序）
    return [...groups].sort((a, b) => a.order - b.order)
  }
  
  // 过滤出非默认分组
  const otherGroups = groups.filter(g => g.name !== '默认分组')
  
  // 默认分组排在最前面，其他分组按 order 排序
  return [defaultGroup, ...otherGroups.sort((a, b) => a.order - b.order)]
})
```

**效果**：
- 默认分组始终显示在分组列表顶部
- 其他分组按创建时间排序
- 即使创建了新分组，默认分组仍然在最上方

**空状态显示修复**

问题：当没有会话但有分组时，页面显示"暂无会话"的空状态，导致分组列表不渲染。

原因：空状态条件为 `v-else-if="sessions.length === 0"`，当会话列表为空时，即使有分组也会显示空状态。

解决方案：修改空状态条件为 `v-else-if="sessions.length === 0 && sessionGroups.length === 0"`，确保只有在既没有会话也没有分组时才显示空状态。

```vue
<!-- 修复前 -->
<div v-else-if="sessions.length === 0" class="empty-state">
  <p>暂无会话</p>
</div>

<!-- 修复后 -->
<div v-else-if="sessions.length === 0 && sessionGroups.length === 0" class="empty-state">
  <p>暂无会话</p>
</div>
```

效果：
- 即使没有会话，分组列表也会正常显示
- 默认分组和其他分组在没有会话时仍然可见
- 用户可以在空会话状态下创建和查看分组

**子元素不透明处理**

确保所有子元素都不透明：
```css
.form-body { opacity: 1; }
.form-group { opacity: 1; }
.input-wrapper { opacity: 1; }
.input-wrapper input { opacity: 1; }
.icon-option { opacity: 1; }
.form-footer { opacity: 1; }
```
  }
}
</script>
```
