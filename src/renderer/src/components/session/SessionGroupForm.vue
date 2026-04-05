/**
 * 会话分组表单组件
 * 用于创建和编辑会话分组
 * @module components/session/SessionGroupForm
 */

<template>
  <div v-if="visible" class="group-form-overlay" @click="handleOverlayClick">
    <div ref="formRef" class="group-form" :class="{ shaking: isShaking }" @click.stop>
      <!-- 装饰性背景 -->
      <div class="form-decoration">
        <div class="decoration-circle"></div>
        <div class="decoration-circle"></div>
      </div>

      <!-- 表单头部 -->
      <div class="form-header">
        <div class="header-content">
          <div class="header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M22 19C22 20.1046 21.1046 21 20 21H4C2.89543 21 2 20.1046 2 19V5C2 3.89543 2.89543 3 4 3H9L11 6H20C21.1046 6 22 6.89543 22 8V19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="header-text">
            <h3>{{ isEdit ? '编辑分组' : '新建分组' }}</h3>
            <p class="header-subtitle">{{ isEdit ? '修改分组信息' : '创建新的会话分组' }}</p>
          </div>
        </div>
        <button class="close-btn" @click="handleClose" title="关闭">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- 表单主体 -->
      <form @submit.prevent="handleSubmit">
        <div class="form-body">
          <!-- 分组名称 -->
          <div class="form-group">
            <label for="groupName">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 7C8.65685 7 10 5.65685 10 4C10 2.34315 8.65685 1 7 1C5.34315 1 4 2.34315 4 4C4 5.65685 5.34315 7 7 7Z" stroke="currentColor" stroke-width="1.5"/>
                <path d="M1 13C1 10.7909 3.79086 9 7 9C10.2091 9 13 10.7909 13 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <span>分组名称</span>
            </label>
            <div class="input-wrapper">
              <input
                id="groupName"
                v-model="formData.name"
                type="text"
                placeholder="例如：生产环境"
                required
                autocomplete="off"
                ref="nameInputRef"
              />
            </div>
          </div>

          <!-- 分组图标 -->
          <div class="form-group">
            <label>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5"/>
                <path d="M7 4V7L9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <span>分组图标（可选）</span>
            </label>
            <div class="icon-selector">
              <div
                v-for="icon in availableIcons"
                :key="icon.value"
                class="icon-option"
                :class="{ active: formData.icon === icon.value }"
                @click="formData.icon = icon.value"
                :title="icon.label"
              >
                <component :is="icon.component" />
              </div>
            </div>
          </div>
        </div>

        <!-- 表单底部 -->
        <div class="form-footer">
          <button type="button" class="btn btn-secondary" @click="handleClose">
            取消
          </button>
          <button type="submit" class="btn btn-primary">
            {{ isEdit ? '保存' : '创建' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, nextTick, defineComponent, h } from 'vue'
import type { SessionGroup } from '@shared/types'

/**
 * Props 定义
 */
interface Props {
  visible: boolean
  group?: SessionGroup | null
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  group: null
})

/**
 * Emits 定义
 */
const emit = defineEmits<{
  close: []
  submit: [data: { name: string; icon?: string }]
}>()

/**
 * 可用图标列表
 */
const availableIcons = [
  {
    value: 'folder',
    label: '文件夹',
    component: defineComponent({
      render() {
        return h('svg', { width: 20, height: 20, viewBox: '0 0 20 20', fill: 'none' }, [
          h('path', {
            d: 'M18 16C18 17.1046 17.1046 18 16 18H4C2.89543 18 2 17.1046 2 16V4C2 2.89543 2.89543 2 4 2H8L10 5H16C17.1046 5 18 5.89543 18 7V16Z',
            stroke: 'currentColor',
            'stroke-width': '1.5',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
          })
        ])
      }
    })
  },
  {
    value: 'server',
    label: '服务器',
    component: defineComponent({
      render() {
        return h('svg', { width: 20, height: 20, viewBox: '0 0 20 20', fill: 'none' }, [
          h('rect', { x: 2, y: 3, width: 16, height: 5, rx: 1, stroke: 'currentColor', 'stroke-width': '1.5' }),
          h('rect', { x: 2, y: 12, width: 16, height: 5, rx: 1, stroke: 'currentColor', 'stroke-width': '1.5' }),
          h('circle', { cx: 5.5, cy: 5.5, r: 0.75, fill: 'currentColor' }),
          h('circle', { cx: 5.5, cy: 14.5, r: 0.75, fill: 'currentColor' })
        ])
      }
    })
  },
  {
    value: 'cloud',
    label: '云',
    component: defineComponent({
      render() {
        return h('svg', { width: 20, height: 20, viewBox: '0 0 20 20', fill: 'none' }, [
          h('path', {
            d: 'M16 14H5C3.34315 14 2 12.6569 2 11C2 9.34315 3.34315 8 5 8C5.07862 8 5.15647 8.003 5.23347 8.00888C5.73184 6.25282 7.35189 5 9.25 5C11.5972 5 13.5 6.90279 13.5 9.25C13.5 9.33434 13.4984 9.41828 13.4952 9.50179C14.9582 9.78204 16 11.0823 16 12.625V14Z',
            stroke: 'currentColor',
            'stroke-width': '1.5',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
          })
        ])
      }
    })
  },
  {
    value: 'database',
    label: '数据库',
    component: defineComponent({
      render() {
        return h('svg', { width: 20, height: 20, viewBox: '0 0 20 20', fill: 'none' }, [
          h('ellipse', { cx: 10, cy: 5, rx: 7, ry: 3, stroke: 'currentColor', 'stroke-width': '1.5' }),
          h('path', { d: 'M3 5V15C3 16.6569 6.13401 18 10 18C13.866 18 17 16.6569 17 15V5', stroke: 'currentColor', 'stroke-width': '1.5' }),
          h('path', { d: 'M3 10C3 11.6569 6.13401 13 10 13C13.866 13 17 11.6569 17 10', stroke: 'currentColor', 'stroke-width': '1.5' })
        ])
      }
    })
  },
  {
    value: 'code',
    label: '代码',
    component: defineComponent({
      render() {
        return h('svg', { width: 20, height: 20, viewBox: '0 0 20 20', fill: 'none' }, [
          h('path', { d: 'M7 14L3 10L7 6', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
          h('path', { d: 'M13 6L17 10L13 14', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
        ])
      }
    })
  },
  {
    value: 'star',
    label: '星标',
    component: defineComponent({
      render() {
        return h('svg', { width: 20, height: 20, viewBox: '0 0 20 20', fill: 'none' }, [
          h('path', {
            d: 'M10 2L12.39 6.88L17.78 7.54L13.89 11.28L14.78 16.64L10 14.1L5.22 16.64L6.11 11.28L2.22 7.54L7.61 6.88L10 2Z',
            stroke: 'currentColor',
            'stroke-width': '1.5',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
          })
        ])
      }
    })
  }
]

/**
 * 表单数据
 */
const formData = reactive({
  name: '',
  icon: 'folder'
})

/**
 * 是否为编辑模式
 */
const isEdit = ref(false)

/**
 * 表单引用
 */
const formRef = ref<HTMLElement | null>(null)
const nameInputRef = ref<HTMLInputElement | null>(null)

/**
 * 抖动状态
 */
const isShaking = ref(false)

/**
 * 监听 visible 变化
 */
watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      // 重置表单
      if (props.group) {
        isEdit.value = true
        formData.name = props.group.name
        formData.icon = props.group.icon || 'folder'
      } else {
        isEdit.value = false
        formData.name = ''
        formData.icon = 'folder'
      }

      // 聚焦输入框
      await nextTick()
      nameInputRef.value?.focus()
    }
  }
)

/**
 * 处理遮罩层点击
 */
function handleOverlayClick(): void {
  triggerShake()
}

/**
 * 触发表单抖动
 */
function triggerShake(): void {
  isShaking.value = true
  setTimeout(() => {
    isShaking.value = false
  }, 500)
}

/**
 * 处理关闭
 */
function handleClose(): void {
  emit('close')
}

/**
 * 处理提交
 */
function handleSubmit(): void {
  if (!formData.name.trim()) {
    triggerShake()
    nameInputRef.value?.focus()
    return
  }

  emit('submit', {
    name: formData.name.trim(),
    icon: formData.icon
  })
}
</script>

<style scoped>
/* 遮罩层 */
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

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 表单容器 */
.group-form {
  position: relative;
  width: 420px;
  background: #2d2d30; /* 使用明确的不透明背景色，避免 CSS 变量计算为透明 */
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  opacity: 1; /* 弹出框不透明 */
  overflow: hidden;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 抖动动画 */
.group-form.shaking {
  animation: slideUp 0.3s ease-out, shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: translateX(-4px);
  }
  20%, 40%, 60%, 80% {
    transform: translateX(4px);
  }
}

/* 装饰性背景 */
.form-decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 120px;
  overflow: hidden;
  pointer-events: none;
}

.decoration-circle {
  position: absolute;
  border-radius: 50%;
  opacity: 1; /* 装饰性背景圆圈透明度设置为 1 */
}

.decoration-circle:first-child {
  width: 200px;
  height: 200px;
  top: -80px;
  right: -60px;
  background: var(--primary-color);
}

.decoration-circle:last-child {
  width: 150px;
  height: 150px;
  top: -40px;
  left: -40px;
  background: var(--accent-color);
}

/* 表单头部 */
.form-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  border-radius: 10px;
  color: white;
}

.header-text h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-subtitle {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* 表单主体 */
.form-body {
  position: relative;
  padding: 24px 28px;
  opacity: 1; /* 表单主体不透明 */
}

/* 表单组 */
.form-group {
  margin-bottom: 20px;
  opacity: 1; /* 表单组不透明 */
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-group label svg {
  flex-shrink: 0;
  color: var(--text-secondary);
}

/* 输入框包装器 */
.input-wrapper {
  position: relative;
  opacity: 1; /* 输入框包装器不透明 */
}

.input-wrapper input {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-primary);
  opacity: 1; /* 输入框不透明 */
  transition: all 0.2s;
}

.input-wrapper input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.input-wrapper input::placeholder {
  color: var(--text-placeholder);
}

/* 图标选择器 */
.icon-selector {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

.icon-option {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  opacity: 1; /* 图标选项不透明 */
  cursor: pointer;
  transition: all 0.2s;
}

.icon-option:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
  transform: translateY(-2px);
}

.icon-option.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

/* 表单底部 */
.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-primary);
  opacity: 1; /* 表单底部不透明 */
}

/* 按钮样式 */
.btn {
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--bg-hover);
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
}

/* 深色主题 */
[data-theme='dark'] .group-form {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

/* 浅色主题 */
[data-theme='light'] .group-form {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

[data-theme='light'] .header-icon {
  color: white;
}
</style>
