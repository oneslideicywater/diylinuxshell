# 分组功能潜在问题分析

## 1. 递归渲染性能问题

**文件**: [SessionGroupTree.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionGroupTree.vue)

**问题**: `SessionGroupTree` 是递归组件，每次父组件状态变化（如 `expandedGroups`、`sessions`）都会触发整棵子树重新渲染。

**影响**: 当分组层级深、会话数量多时，展开/折叠操作会有明显卡顿。

**建议**:
- 对 `SessionGroupTree` 使用 `defineAsyncComponent` 懒加载
- 对 `subGroups`、`getDirectGroupSessions` 等计算属性加缓存
- 考虑用扁平化列表 + `depth` 缩进替代递归组件

---

## 2. 删除分组不处理子分组

**文件**: [SessionSidebarContainer.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionSidebarContainer.vue) — `handleDeleteGroupFromGroupHeader`

**问题**: 删除分组时只调用 `window.api.sessionGroup.delete(group.id)` 和 `sessionStore.removeSessionGroup(group.id)`，没有递归删除子分组。

**影响**: 删除父分组后，子分组成为孤儿节点（`parentId` 指向不存在的分组），数据不一致。

**建议**: 删除时应先递归收集所有子分组 ID，一并删除。

---

## 3. 删除分组不迁移会话

**文件**: [SessionSidebarContainer.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionSidebarContainer.vue) — `handleDeleteGroupFromGroupHeader`

**问题**: 删除分组后，属于该分组的会话的 `groupId` 字段没有被清空或迁移。

**影响**: 会话指向已删除的分组，成为孤儿会话，无法在 UI 中正确显示。

**建议**: 删除分组前，将该分组及其子分组下的所有会话 `groupId` 置为 `null`。

---

## 4. 编辑分组功能未实现

**文件**: [SessionGroupTree.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionGroupTree.vue) — `handleEditGroupFromGroupHeader`

**问题**: 编辑分组事件处理只打印了 `console.log`，没有实际触发编辑表单。

```ts
const handleEditGroupFromGroupHeader = (group: SessionGroup) => {
  console.log('[SessionGroupTree] 编辑分组:', group.name)
}
```

**影响**: 在子分组上右键选择"编辑分组"无任何反应。

**建议**: 应该像 [SessionSidebarContainer.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionSidebarContainer.vue) 中的 `handleEditGroupFromGroupHeader` 一样，设置 `editingGroup` 并打开表单。

---

## 5. 事件冒泡丢失 `deleteGroup` emit

**文件**: [SessionGroupTree.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionGroupTree.vue)

**问题**: `SessionGroupTree` 定义了 `deleteGroup` emit，但 `SessionSidebarContainer` 中监听的是 `@delete-group="handleDeleteGroupFromGroupHeader"`，事件名不匹配（驼峰 vs 短横线）。

**影响**: Vue 会自动转换，但需确认所有层级的事件传递一致性。

---

## 6. `useSessionGroup` 中 `getAllSubGroupIds` 无循环引用保护

**文件**: [useSessionGroup.ts](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/script/useSessionGroup.ts) — `getAllSubGroupIds`

**问题**: 如果数据异常导致分组 A 的 `parentId` 指向 B，B 的 `parentId` 又指向 A（循环引用），`getAllSubGroupIds` 会无限递归导致栈溢出。

**影响**: 极端情况下页面崩溃。

**建议**: 加入 `visited` Set 防止循环引用。

---

## 7. `SessionGroupForm` 提交时 `parentId` 和 `depth` 传递逻辑混乱

**文件**: [SessionGroupForm.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionGroupForm.vue) — `handleSubmit`

**问题**: 提交时使用 `props.group?.parentId` 和 `props.group?.depth`，但 `props.group` 在创建模式下为 `null`，在编辑模式下是已有分组。创建子分组时，`editingGroup` 被构造为一个临时对象传入，依赖外部正确设置 `parentId` 和 `depth`。

**影响**: 如果外部构造的临时对象字段不完整，创建的子分组层级信息错误。

**建议**: 表单提交时应明确区分"创建"和"编辑"模式，创建模式由外部传入 `parentId` 和 `depth` 作为独立 prop。

---

## 8. `GroupTreeSelect` 去重逻辑掩盖数据问题

**文件**: [GroupTreeSelect.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/GroupTreeSelect.vue) — `rootGroups`

**问题**: `rootGroups` 计算属性中包含去重逻辑（`Map` 去重），说明数据源可能存在重复 ID 的分组。去重只是掩盖了问题，没有解决根源。

**影响**: 重复分组被静默丢弃，用户可能困惑为什么某个分组"消失"了。

**建议**: 在主进程或 Store 层保证数据唯一性，组件层不应做去重。

---

## 9. `localStorage` 存储展开状态可能过期

**文件**: [SessionSidebarContainer.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionSidebarContainer.vue) — `loadExpandedGroups` / `saveExpandedGroups`

**问题**: 分组被删除后，`localStorage` 中仍然保留其 ID 在 `expandedGroups` 中，造成脏数据累积。

**影响**: 长期运行后 `localStorage` 中积累大量无效分组 ID。

**建议**: 加载展开状态时，用当前存在的分组 ID 做一次过滤。

---

## 10. 右键菜单位置边界检测不准确

**文件**: [GroupHeader.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/GroupHeader.vue) — `handleContextMenu`

**问题**: 边界检测使用 `window.innerWidth` / `window.innerHeight`，但在 Electron 渲染进程中，窗口大小可能动态变化，且菜单高度 260px 是硬编码的。

**影响**: 在窗口较小时，菜单可能被裁剪或超出可视区域。

**建议**: 使用 `getBoundingClientRect()` 动态计算菜单尺寸，或使用 floating-ui 等定位库。

---

## 11. `SessionGroupTree` 中 `paddingLeft` 硬编码

**文件**: [SessionGroupTree.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionGroupTree.vue)

**问题**: `:style="{ paddingLeft: '12px' }"` 硬编码了缩进值，没有根据 `subGroup.depth` 动态计算。

**影响**: 所有子分组缩进相同，无法体现层级深度差异。

**建议**: 使用 `:style="{ paddingLeft: `${subGroup.depth * 12}px` }"` 或类似动态计算。

---

## 12. `GroupHeader` tooltip 中 `MAX_GROUP_DEPTH` 依赖

**文件**: [GroupHeader.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/GroupHeader.vue) — `tooltip`

**问题**: tooltip 直接引用 `MAX_GROUP_DEPTH` 常量，如果常量值变更，tooltip 文案需要同步审查。

**影响**: 维护成本增加。

**建议**: 将层级信息封装为 computed 属性，集中管理。

---

## 13. 分组排序依赖 `order` 字段为时间戳

**文件**: [SessionSidebarContainer.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionSidebarContainer.vue) — `sessionGroups`

**问题**: `order` 字段使用 `Date.now()` 赋值，如果两个分组在同一毫秒内创建，`order` 值相同，排序不稳定。

**影响**: 分组顺序可能出现随机跳变。

**建议**: 使用递增计数器或 `Date.now() + 索引` 保证唯一性。

---

## 14. `closeAllContextMenus` 在 `onMounted` 中重复注册事件监听

**文件**: [SessionSidebarContainer.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionSidebarContainer.vue)

**问题**: `onMounted` 被调用了两次（一次加载会话，一次注册 `click` 事件），但 `handleClickOutside` 会关闭所有右键菜单，包括用户正在操作的菜单。

**影响**: 用户点击遮罩层外的任何地方都会关闭菜单，体验可能过于敏感。

**建议**: 考虑只在菜单打开时注册一次性点击外部关闭监听。

---

# 功能 Bug 分析

## BUG-01: 删除父分组后子分组成为孤儿（数据不一致）

**严重程度**: 🔴 致命

**文件**: [SessionSidebarContainer.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionSidebarContainer.vue#L549-L578) — `handleDeleteGroupFromGroupHeader`

**复现步骤**:
1. 创建分组 A
2. 在 A 下创建子分组 A-1
3. 右键删除分组 A

**实际结果**: 分组 A 被删除，但 A-1 仍然存在于 `sessionGroups` 数组中，`parentId` 指向已不存在的 A.id。

**根因**: `handleDeleteGroupFromGroupHeader` 只删除了目标分组本身：
```ts
await window.api.sessionGroup.delete(group.id)
sessionStore.removeSessionGroup(group.id)
```
没有递归收集并删除所有子分组。

**预期结果**: 删除 A 时，应同时删除 A-1、A-1-1 等所有子孙分组。

---

## BUG-02: 删除分组后，子分组下的会话成为孤儿

**严重程度**: 🔴 致命

**文件**: [SessionSidebarContainer.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionSidebarContainer.vue#L549-L578) + [session.ts](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/stores/session.ts#L99-L110)

**复现步骤**:
1. 创建分组 A，在 A 下创建子分组 A-1
2. 在 A-1 下创建会话 S
3. 右键删除分组 A

**实际结果**: 
- 分组 A 被删除
- `sessionStore.removeSessionGroup(A.id)` 只清理了 `groupId === A.id` 的会话
- 会话 S 的 `groupId` 仍然是 A-1.id（A-1 本身已成为孤儿分组）
- 会话 S 在 UI 中不可见（因为 A-1 不在根分组列表中渲染）

**根因**: `sessionStore.removeSessionGroup` 只处理直接属于被删除分组的会话：
```ts
sessions.value.forEach(s => {
  if (s.groupId === id) {
    s.groupId = undefined
  }
})
```
没有处理子分组下的会话。

**预期结果**: 删除分组时，该分组及其所有子孙分组下的会话都应被移至未分组（`groupId = undefined`）。

---

## BUG-03: 子分组右键"编辑分组"无响应

**严重程度**: 🟠 严重

**文件**: [SessionGroupTree.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionGroupTree.vue#L206-L209) — `handleEditGroupFromGroupHeader`

**复现步骤**:
1. 创建分组 A，在 A 下创建子分组 A-1
2. 右键点击 A-1，选择"编辑分组"

**实际结果**: 无任何反应，控制台输出 `[SessionGroupTree] 编辑分组: A-1`

**根因**: `SessionGroupTree` 中的 `handleEditGroupFromGroupHeader` 只打印了日志，没有 `emit` 事件给父组件：
```ts
const handleEditGroupFromGroupHeader = (group: SessionGroup) => {
  console.log('[SessionGroupTree] 编辑分组:', group.name)
}
```
而根分组（在 `SessionSidebarContainer` 中直接渲染的）的编辑功能是正常的。

**预期结果**: 弹出编辑表单，预填 A-1 的名称，保存后更新分组。

---

## BUG-04: `SessionGroupTree` 递归组件缺少 `@delete-group` 事件监听

**严重程度**: 🟠 严重

**文件**: [SessionGroupTree.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionGroupTree.vue#L36-L51)

**复现步骤**:
1. 创建分组 A，在 A 下创建子分组 A-1
2. 在 A-1 下创建子分组 A-1-1
3. 右键点击 A-1-1，选择"删除分组"

**实际结果**: 
- `SessionGroupTree` 的 `GroupHeader` 触发 `@delete-group` → `handleDeleteGroupFromGroupHeader`
- `handleDeleteGroupFromGroupHeader` 执行 `emit('deleteGroup', group)`
- 但递归的 `SessionGroupTree` 组件（第 36-51 行）**没有监听** `@delete-group` 事件
- 事件在递归组件层丢失，无法传递到 `SessionSidebarContainer`

**根因**: 递归组件实例缺少事件绑定：
```html
<SessionGroupTree
  ...
  @delete-group="handleDeleteGroupFromGroupHeader"  <!-- ❌ 缺失 -->
/>
```

**预期结果**: 删除事件应能正确冒泡到 `SessionSidebarContainer` 执行删除逻辑。

---

## BUG-05: `handleSubmitGroupForm` 创建子分组时 `parentId` 可能丢失

**严重程度**: 🟡 中等

**文件**: [SessionSidebarContainer.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionSidebarContainer.vue#L624-L644) — `handleSubmitGroupForm`

**复现步骤**:
1. 右键分组 A，选择"新建子分组"
2. 输入名称，点击"创建"

**实际结果**: 在特定情况下，创建的子分组 `parentId` 可能为 `undefined`，成为根分组。

**根因**: `handleSubmitGroupForm` 中的 `parentId` 取值逻辑：
```ts
const parentId = data.parentId || editingGroup.value?.parentId
```
- `data.parentId` 来自 `SessionGroupForm` 的 `handleSubmit`，提交的是 `props.group?.parentId`
- 但创建子分组时，`editingGroup` 是由 `handleCreateSubGroupFromGroupHeader` 构造的临时对象，其中 `parentId` 被正确设置
- 问题在于 `SessionGroupForm` 的 `handleSubmit` 提交的是 `props.group?.parentId`，而 `props.group` 就是这个临时对象，所以 `data.parentId` 有值
- **但如果 `data.parentId` 为空字符串 `""`，`||` 会将其视为 falsy，转而使用 `editingGroup.value?.parentId`**

**预期结果**: 应使用 `??` 代替 `||` 来区分 `null/undefined` 和空字符串。

---

## BUG-06: `SessionGroupForm` 编辑模式下不校验重名

**严重程度**: 🟡 中等

**文件**: [SessionGroupForm.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionGroupForm.vue#L200-L230) — `validateGroupName`

**复现步骤**:
1. 创建分组 A 和分组 B
2. 编辑分组 A，将其名称改为 "B"

**实际结果**: 校验逻辑虽然排除了自己（`g.id === props.group.id`），但防抖 500ms 期间用户可以快速提交表单绕过校验。

**根因**: `handleSubmit` 中没有在服务端提交前做最终的同步重名检查：
```ts
function handleSubmit(): void {
  if (validationError.value) {
    triggerShake()
    return
  }
  // 直接提交，没有再次校验
  emit('submit', submitData)
}
```

**预期结果**: 提交时应做最终的同步重名检查，防止竞态条件。

---

## BUG-07: 删除"默认分组"会导致数据异常

**严重程度**: 🟠 严重

**文件**: [SessionSidebarContainer.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionSidebarContainer.vue#L549-L578)

**复现步骤**:
1. 右键"默认分组"，选择"删除分组"
2. 确认删除

**实际结果**: 
- 默认分组被删除
- `sessionGroups` computed 中查找默认分组的逻辑 `groups.find(g => g.name === '默认分组')` 返回 `undefined`
- 所有分组不再按"默认分组优先"排序
- 新建会话时如果没有指定分组，无法归入默认分组

**根因**: 没有对"默认分组"做删除保护。虽然 `GroupHeader` 右键菜单中"新建子分组"对默认分组做了限制，但"删除分组"没有限制。

**预期结果**: 默认分组不应被删除，右键菜单中"删除分组"应对默认分组禁用或点击时提示不可删除。

---

## BUG-08: `toggleGroup` 操作 `Set` 可能不触发响应式更新

**严重程度**: 🟡 中等

**文件**: [SessionSidebarContainer.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionSidebarContainer.vue#L386-L393) — `toggleGroup`

**复现步骤**:
1. 展开分组 A
2. 折叠分组 A

**实际结果**: 在某些 Vue 版本中，直接对 `Set` 调用 `add`/`delete` 可能不触发响应式更新，导致 UI 不刷新。

**根因**: 
```ts
const toggleGroup = (groupId: string) => {
  if (expandedGroups.value.has(groupId)) {
    expandedGroups.value.delete(groupId)  // Set.delete 不触发 Vue 响应式
  } else {
    expandedGroups.value.add(groupId)     // Set.add 不触发 Vue 响应式
  }
}
```
Vue 3 的 `ref<Set>` 对 `Set` 的 `add`/`delete` 操作有响应式支持，但前提是必须通过 `.value` 访问。代码中确实使用了 `.value`，所以这个 bug **可能不存在**，取决于 Vue 版本。

**建议**: 如果发现有展开/折叠不生效的情况，改为创建新 Set：
```ts
const newSet = new Set(expandedGroups.value)
newSet.delete(groupId)
expandedGroups.value = newSet
```

---

## BUG-09: `SessionGroupTree` 中 `@edit-group` 事件未向上传递

**严重程度**: 🟠 严重

**文件**: [SessionGroupTree.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionGroupTree.vue#L26) + [SessionGroupTree.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionGroupTree.vue#L36-L51)

**复现步骤**:
1. 创建分组 A，在 A 下创建子分组 A-1
2. 在 A-1 下创建子分组 A-1-1
3. 右键 A-1-1，选择"编辑分组"

**实际结果**: 
- `GroupHeader` 触发 `@edit-group` → `handleEditGroupFromGroupHeader`
- `handleEditGroupFromGroupHeader` 只打印了 console.log，没有 emit
- 即使修改为 emit，递归的 `SessionGroupTree` 也没有监听 `@edit-group` 事件

**根因**: 与 BUG-04 类似，递归组件缺少事件绑定，且处理函数未实现。

---

## BUG-10: `handleCreateSubGroup` 和 `handleCreateSubGroupFromGroupHeader` 逻辑重复

**严重程度**: 🟢 轻微

**文件**: [SessionSidebarContainer.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionSidebarContainer.vue#L405-L422) + [SessionSidebarContainer.vue](file:///f:/tech-docs/diy-linux-shell/src/renderer/src/components/session/SessionSidebarContainer.vue#L514-L536)

**问题**: 两个函数都做了相同的事情：
1. 调用 `window.api.sessionGroup.checkCanCreateSubGroup`
2. 检查 `canCreate` 结果
3. 构造临时 `editingGroup` 对象
4. 打开 `groupFormVisible`

**差异**: `handleCreateSubGroup` 接收 `parentGroup` 参数，`handleCreateSubGroupFromGroupHeader` 也接收 `group` 参数，但命名不同。

**影响**: 维护成本高，修改逻辑时需要改两处。

**建议**: 合并为一个函数 `handleCreateSubGroup(parentGroup: SessionGroup)`。
