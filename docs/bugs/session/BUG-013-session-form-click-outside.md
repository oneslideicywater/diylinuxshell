# BUG-013: 点击编辑会话框外部时表单直接关闭

## 问题描述

### 现象
当用户打开编辑会话表单后，点击表单外部的遮罩层，表单会直接关闭，用户输入的内容丢失。

### 预期行为
点击表单外部时，应该：
1. 不关闭表单
2. 闪烁表单框，提醒用户需要先关闭或完成编辑
3. 用户可以选择继续编辑或点击关闭按钮关闭表单

## 问题原因

### 根本原因
表单的遮罩层绑定了 `@click.self="$emit('close')"` 事件，导致点击遮罩层时直接关闭表单。

### 技术分析
1. **事件绑定**: `<div class="session-form-overlay" @click.self="$emit('close')">`
2. **缺乏保护**: 没有确认机制，用户可能误点击导致数据丢失
3. **用户体验差**: 不符合模态对话框的标准行为

### 代码位置
- `src/renderer/src/components/session/SessionForm.vue` - 会话表单组件

## 解决方案

### 方案选择
移除遮罩层的关闭事件，改为闪烁表单框提醒用户。

### 方案优势
1. ✅ 防止用户误操作导致数据丢失
2. ✅ 提供视觉反馈，提醒用户需要先关闭或完成编辑
3. ✅ 符合模态对话框的标准行为
4. ✅ 用户体验更好

## 实现步骤

### 修改 SessionForm.vue

**修改点**:
1. 移除遮罩层的 `@click.self="$emit('close')"` 事件
2. 添加 `handleOverlayClick` 方法处理点击外部事件
3. 添加 `isShaking` 状态控制闪烁效果
4. 添加 CSS 动画实现闪烁效果

#### 1. 修改模板

```vue
<template>
  <div class="session-form-overlay" @click="handleOverlayClick">
    <div ref="formRef" class="session-form" :class="{ shaking: isShaking }" @click.stop>
      <!-- 表单内容 -->
    </div>
  </div>
</template>
```

**关键点**:
- 遮罩层绑定 `@click="handleOverlayClick"` 而不是直接关闭
- 表单添加 `@click.stop` 阻止事件冒泡
- 表单添加 `:class="{ shaking: isShaking }"` 控制闪烁效果

#### 2. 添加状态和方法

```typescript
// 表单引用
const formRef = ref<HTMLDivElement | null>(null)

// 是否正在闪烁
const isShaking = ref(false)

/**
 * 处理遮罩层点击
 * 点击外部时闪烁表单框，提醒用户需要先关闭或完成编辑
 */
const handleOverlayClick = (): void => {
  // 如果已经在闪烁，不重复触发
  if (isShaking.value) return
  
  // 开始闪烁
  isShaking.value = true
  
  // 500ms 后停止闪烁
  setTimeout(() => {
    isShaking.value = false
  }, 500)
}
```

#### 3. 添加 CSS 动画

```css
.session-form {
  width: 400px;
  background-color: var(--bg-color, #1e1e1e);
  border: 1px solid var(--border-color, #3c3c3c);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  transition: transform 0.1s ease-in-out;
}

/* 闪烁动画效果 */
.session-form.shaking {
  animation: shake 0.5s ease-in-out;
}

/* 定义闪烁动画 */
@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: translateX(-5px);
  }
  20%, 40%, 60%, 80% {
    transform: translateX(5px);
  }
}
```

## 工作原理

1. **点击遮罩层**: 用户点击表单外部的遮罩层
2. **触发事件**: 调用 `handleOverlayClick()` 方法
3. **检查状态**: 如果已经在闪烁，不重复触发
4. **开始闪烁**: 设置 `isShaking.value = true`，触发 CSS 动画
5. **动画效果**: 表单左右晃动，提醒用户
6. **停止闪烁**: 500ms 后设置 `isShaking.value = false`
7. **表单保持**: 表单保持打开状态，用户可以继续编辑

## 测试计划

### 测试用例
1. 打开编辑会话表单，点击外部遮罩层，验证表单闪烁且不关闭
2. 连续点击外部遮罩层，验证闪烁动画不会重复触发
3. 点击表单内部，验证表单不闪烁
4. 点击关闭按钮，验证表单正常关闭
5. 编辑表单内容后点击外部，验证内容不丢失

### 测试文件
- `e2e/session-form-modal.e2e.spec.ts` - 会话表单模态行为测试用例

## 修复验证

### 验证步骤
1. 启动应用
2. 创建或编辑一个会话
3. 点击表单外部的遮罩层
4. 观察表单闪烁效果
5. 验证表单保持打开状态
6. 继续编辑或点击关闭按钮

### 预期结果
✅ 点击外部时表单闪烁  
✅ 表单保持打开状态  
✅ 用户输入的内容不丢失  
✅ 连续点击不会重复闪烁  
✅ 点击关闭按钮可以正常关闭  

## 相关文档

- [PRD - 会话管理](../PRD.md#会话管理)
- [Phase1 PRD - 会话管理](../plan/phase1/prd.md#功能列表)

## 备注

### 设计考虑
- **动画时长**: 500ms 是一个合适的时长，既能引起用户注意，又不会太长影响体验
- **动画幅度**: 左右各 5px 的晃动幅度，既能看清，又不会太夸张
- **防抖处理**: 如果已经在闪烁，不重复触发，避免动画叠加

### 改进建议
1. 可以考虑添加声音提示
2. 可以考虑在闪烁时显示提示文字
3. 可以考虑添加键盘快捷键（如 ESC 关闭）
