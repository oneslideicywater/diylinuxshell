# BUG-009 - SessionList currentWidth 未定义

**日期：** 2026-04-04  
**状态：** ✅ 已修复

---

## 复现步骤

1. 打开应用
2. 查看控制台

**预期结果：** 无控制台报错  
**实际结果：** 控制台报错 "Property "currentWidth" was accessed during render but is not defined on instance."

---

## 原因

根据 BUG-016，侧边栏拖拽拉伸功能已经从 SessionList.vue 中移除，移到了 AppLayout.vue 中！但是 SessionList.vue 的模板中还保留了 `:style="{ width: `${currentWidth}px` }"`，而 `currentWidth` 已经没有在 script 中定义了！

---

## 解决方法

移除 SessionList.vue 中不再需要的 width 样式绑定！

---

## 修复文件

**文件：** `src/renderer/src/components/session/SessionList.vue:9`

---

### 更改前

```vue
<div class="session-list" :style="{ width: `${currentWidth}px` }">
```

### 更改后

```vue
<div class="session-list">
```

---

## 相关测试用例

待创建
