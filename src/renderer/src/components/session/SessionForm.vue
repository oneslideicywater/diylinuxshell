/**
 * 会话表单组件
 * 用于创建和编辑会话
 * @module components/session/SessionForm
 */

<template>
  <div v-if="visible" class="session-form-overlay" @click="handleOverlayClick">
    <div ref="formRef" class="session-form" :class="{ shaking: isShaking }" @click.stop>
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
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="header-text">
            <h3>{{ isEdit ? '编辑会话' : '新建会话' }}</h3>
            <p class="header-subtitle">{{ isEdit ? '修改会话配置信息' : '创建新的SSH连接会话' }}</p>
          </div>
        </div>
        <button class="close-btn" @click="$emit('close')" title="关闭">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- 表单主体 -->
      <form @submit.prevent="handleSubmit">
        <div class="form-body">
          <!-- 会话名称 -->
          <div class="form-group">
            <label for="name">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 7C8.65685 7 10 5.65685 10 4C10 2.34315 8.65685 1 7 1C5.34315 1 4 2.34315 4 4C4 5.65685 5.34315 7 7 7Z" stroke="currentColor" stroke-width="1.5"/>
                <path d="M1 13C1 10.7909 3.79086 9 7 9C10.2091 9 13 10.7909 13 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <span>会话名称</span>
            </label>
            <div class="input-wrapper">
              <input
                id="name"
                v-model="formData.name"
                type="text"
                placeholder="例如：Web Server"
                required
                autocomplete="off"
              />
            </div>
          </div>

          <!-- 主机地址和端口 -->
          <div class="form-row">
            <div class="form-group flex-2">
              <label for="host">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="3" width="12" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
                  <circle cx="7" cy="7" r="1.5" fill="currentColor"/>
                  <path d="M4 11V13M10 11V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <span>主机地址</span>
              </label>
              <div class="input-wrapper">
                <input
                  id="host"
                  v-model="formData.host"
                  type="text"
                  placeholder="例如：192.168.1.100"
                  required
                  autocomplete="off"
                />
              </div>
            </div>

            <div class="form-group flex-1">
              <label for="port">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="2" y="1" width="10" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M5 4H9M5 7H9M5 10H7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <span>端口</span>
              </label>
              <div class="input-wrapper">
                <input
                  id="port"
                  v-model.number="formData.port"
                  type="number"
                  min="1"
                  max="65535"
                  required
                />
              </div>
            </div>
          </div>

          <!-- 用户名 -->
          <div class="form-group">
            <label for="username">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="4" r="3" stroke="currentColor" stroke-width="1.5"/>
                <path d="M1 13C1 10.2386 3.68629 8 7 8C10.3137 8 13 10.2386 13 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <span>用户名</span>
            </label>
            <div class="input-wrapper">
              <input
                id="username"
                v-model="formData.username"
                type="text"
                placeholder="例如：root"
                required
                autocomplete="off"
              />
            </div>
          </div>

          <!-- 会话分组 -->
          <div class="form-group">
            <label>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M12 11C12 11.8284 11.3284 12.5 10.5 12.5H3.5C2.67157 12.5 2 11.8284 2 10.5V3.5C2 2.67157 2.67157 2 3.5 2H6L7 3.5H10.5C11.3284 3.5 12 4.17157 12 5V11Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>会话分组（可选）</span>
            </label>
            <div class="group-tree-container">
              <GroupTreeSelect
                v-model="formData.groupId"
                :all-groups="sessionGroups"
                :expanded-groups="expandedGroups"
                @toggle="handleToggleGroup"
              />
            </div>
          </div>

          <!-- 认证方式 -->
          <div class="form-group">
            <label>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M11 6V3C11 1.89543 10.1046 1 9 1H5C3.89543 1 3 1.89543 3 3V6" stroke="currentColor" stroke-width="1.5"/>
                <rect x="1" y="6" width="12" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
                <circle cx="7" cy="9.5" r="1" fill="currentColor"/>
              </svg>
              <span>认证方式</span>
            </label>
            <div class="radio-group">
              <label class="radio-label" :class="{ active: formData.authType === 'password' }">
                <input v-model="formData.authType" type="radio" value="password" />
                <div class="radio-indicator">
                  <svg v-if="formData.authType === 'password'" width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="3" fill="currentColor"/>
                  </svg>
                </div>
                <span>密码认证</span>
              </label>
              <label class="radio-label" :class="{ active: formData.authType === 'key' }">
                <input v-model="formData.authType" type="radio" value="key" />
                <div class="radio-indicator">
                  <svg v-if="formData.authType === 'key'" width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="3" fill="currentColor"/>
                  </svg>
                </div>
                <span>密钥认证</span>
              </label>
            </div>
          </div>

          <!-- 密码认证 -->
          <transition name="slide-fade">
            <div v-if="formData.authType === 'password'" class="form-group">
              <label for="password">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 6V4C3 2.34315 4.34315 1 6 1H8C9.65685 1 11 2.34315 11 4V6" stroke="currentColor" stroke-width="1.5"/>
                  <rect x="1" y="6" width="12" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
                  <circle cx="7" cy="9.5" r="1" fill="currentColor"/>
                </svg>
                <span>密码</span>
              </label>
              <div class="input-wrapper">
                <input
                  id="password"
                  v-model="formData.password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="输入密码"
                  :required="formData.authType === 'password'"
                  autocomplete="new-password"
                />
                <button
                  type="button"
                  class="password-toggle"
                  @click="showPassword = !showPassword"
                  :title="showPassword ? '隐藏密码' : '显示密码'"
                >
                  <!-- 显示密码图标 - 眼睛 -->
                  <svg v-if="showPassword" viewBox="0 0 24 24" fill="none" class="password-icon">
                    <path d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="2.5"/>
                  </svg>
                  <!-- 隐藏密码图标 - 眼睛被划掉 -->
                  <svg v-else viewBox="0 0 24 24" fill="none" class="password-icon">
                    <path d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="2.5"/>
                    <path d="M4 4L20 20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </transition>

          <!-- 密钥认证 -->
          <transition name="slide-fade">
            <div v-if="formData.authType === 'key'" class="key-auth-section">
              <div class="form-group">
                <label for="keyPath">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M9 1H3C2.44772 1 2 1.44772 2 2V12C2 12.5523 2.44772 13 3 13H11C11.5523 13 12 12.5523 12 12V4L9 1Z" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M9 1V4H12" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M5 7H9M5 9H7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                  <span>密钥路径</span>
                </label>
                <div class="input-wrapper">
                  <input
                    id="keyPath"
                    v-model="formData.keyPath"
                    type="text"
                    placeholder="选择密钥文件"
                    required
                    autocomplete="off"
                  />
                  <button type="button" class="browse-btn" @click="browseKeyFile">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 7H11M7 3V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    <span>浏览</span>
                  </button>
                </div>
              </div>

              <div class="form-group">
                <label for="keyPassphrase">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 6V4C3 2.34315 4.34315 1 6 1H8C9.65685 1 11 2.34315 11 4V6" stroke="currentColor" stroke-width="1.5"/>
                    <rect x="1" y="6" width="12" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
                    <circle cx="7" cy="9.5" r="1" fill="currentColor"/>
                  </svg>
                  <span>密钥密码（可选）</span>
                </label>
                <div class="input-wrapper">
                  <input
                    id="keyPassphrase"
                    v-model="formData.keyPassphrase"
                    :type="showKeyPassphrase ? 'text' : 'password'"
                    placeholder="输入密钥密码"
                    autocomplete="new-password"
                  />
                  <button
                    type="button"
                    class="password-toggle"
                    @click="showKeyPassphrase = !showKeyPassphrase"
                    :title="showKeyPassphrase ? '隐藏密码' : '显示密码'"
                  >
                    <!-- 显示密码图标 - 眼睛 -->
                    <svg v-if="showKeyPassphrase" viewBox="0 0 24 24" fill="none" class="password-icon">
                      <path d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                      <circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="2.5"/>
                    </svg>
                    <!-- 隐藏密码图标 - 眼睛被划掉 -->
                    <svg v-else viewBox="0 0 24 24" fill="none" class="password-icon">
                      <path d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                      <circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="2.5"/>
                      <path d="M4 4L20 20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </transition>
        </div>

        <!-- 测试连接结果 -->
        <div v-if="testResult" class="test-result" :class="testResult.type">
          <svg v-if="testResult.type === 'success'" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
            <path d="M5 8L7 10L11 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 4V9M8 11.5V12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>{{ testResult.message }}</span>
          <button class="close-result" @click="testResult = null" title="关闭">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- 表单底部 -->
        <div class="form-footer">
          <button type="button" class="btn test" @click="handleTestConnection" :disabled="testing">
            <svg v-if="!testing" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1V7M7 1V13M1 7H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <div v-else class="spinner"></div>
            <span>{{ testing ? '连接中...' : '测试连接' }}</span>
          </button>
          <button type="button" class="btn cancel" @click="$emit('close')">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>取消</span>
          </button>
          <button type="submit" class="btn submit" :disabled="submitting">
            <svg v-if="!submitting" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7L5 10L12 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div v-else class="spinner"></div>
            <span>{{ submitting ? '保存中...' : '保存' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSessionStore } from '@/stores/session'
import type { Session } from '@shared/types'
import GroupTreeSelect from './GroupTreeSelect.vue'

/**
 * Props 定义
 */
interface Props {
  /** 是否显示表单 */
  visible?: boolean
  /** 会话数据，用于编辑模式 */
  session?: Session | null
  /** 默认分组 ID */
  defaultGroupId?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  session: null,
  defaultGroupId: null
})

// 状态管理
const sessionStore = useSessionStore()

// 定义事件
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', data: Partial<Session>): void
}>()

// 是否为编辑模式
const isEdit = computed(() => !!props.session)

// 会话分组列表
const sessionGroups = computed(() => sessionStore.sessionGroups)

// 表单数据
const formData = ref({
  name: '',
  host: '',
  port: 22,
  username: '',
  groupId: '',
  authType: 'password' as 'password' | 'key',
  password: '',
  keyPath: '',
  keyPassphrase: ''
})

// 提交状态
const submitting = ref(false)

// 测试连接状态
const testing = ref(false)

// 测试结果
const testResult = ref<{ type: 'success' | 'error'; message: string } | null>(null)

// 表单引用
const formRef = ref<HTMLDivElement | null>(null)

// 是否正在闪烁
const isShaking = ref(false)

// 密码可见性
const showPassword = ref(false)
const showKeyPassphrase = ref(false)

// 展开的分组 ID 集合
const expandedGroups = ref<Set<string>>(new Set())

/**
 * 处理分组展开/折叠
 */
const handleToggleGroup = (groupId: string): void => {
  console.log('[SessionForm] handleToggleGroup:', groupId)
  console.log('[SessionForm] 当前 expandedGroups:', Array.from(expandedGroups.value))
  
  if (expandedGroups.value.has(groupId)) {
    console.log('[SessionForm] 折叠分组')
    expandedGroups.value.delete(groupId)
  } else {
    console.log('[SessionForm] 展开分组')
    expandedGroups.value.add(groupId)
  }
  // 创建新的 Set 以触发响应式更新
  expandedGroups.value = new Set(expandedGroups.value)
  console.log('[SessionForm] 更新后 expandedGroups:', Array.from(expandedGroups.value))
}

// 监听 session 变化，填充表单
watch(
  () => props.session,
  (session) => {
    if (session) {
      formData.value = {
        name: session.name,
        host: session.host,
        port: session.port,
        username: session.username,
        groupId: session.groupId || '',
        authType: session.authType,
        password: session.password || '',
        keyPath: session.keyPath || '',
        keyPassphrase: session.keyPassphrase || ''
      }
    } else if (props.defaultGroupId) {
      // 新增会话且有默认分组 ID，使用默认分组
      formData.value.groupId = props.defaultGroupId
    } else {
      // 新增会话且未指定分组，清空 groupId（后端会自动分配到默认分组）
      formData.value.groupId = ''
    }
  },
  { immediate: true }
)

/**
 * 浏览密钥文件
 */
const browseKeyFile = () => {
  // TODO: 调用文件选择对话框
  console.log('Browse key file')
}

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

/**
 * 提交表单
 * 确保 groupId 不为空：如果未选择分组，自动使用"默认分组"
 */
const handleSubmit = async () => {
  submitting.value = true
  try {
    let finalGroupId = formData.value.groupId
    
    // 如果 groupId 为空，自动获取"默认分组"ID
    if (!finalGroupId) {
      const groups = sessionStore.sessionGroups
      const defaultGroup = groups.find(g => g.name === '默认分组')
      if (defaultGroup) {
        finalGroupId = defaultGroup.id
        console.log('[SessionForm] groupId 为空，使用默认分组:', defaultGroup.id)
      } else if (groups.length > 0) {
        // 如果没有"默认分组"，使用第一个可用分组
        finalGroupId = groups[0].id
        console.log('[SessionForm] 使用第一个可用分组:', finalGroupId)
      }
    }

    emit('save', {
      name: formData.value.name,
      host: formData.value.host,
      port: formData.value.port,
      username: formData.value.username,
      groupId: finalGroupId,  // ✅ 确保 groupId 永远不为空
      authType: formData.value.authType,
      password: formData.value.authType === 'password' ? formData.value.password : undefined,
      keyPath: formData.value.authType === 'key' ? formData.value.keyPath : undefined,
      keyPassphrase:
        formData.value.authType === 'key' && formData.value.keyPassphrase
          ? formData.value.keyPassphrase
          : undefined
    })
  } finally {
    submitting.value = false
  }
}

/**
 * 测试连接
 */
const handleTestConnection = async () => {
  // 验证必填字段
  if (!formData.value.host || !formData.value.port || !formData.value.username) {
    testResult.value = {
      type: 'error',
      message: '请填写完整的主机地址、端口和用户名'
    }
    return
  }

  // 密码认证需要密码
  if (formData.value.authType === 'password' && !formData.value.password) {
    testResult.value = {
      type: 'error',
      message: '密码认证需要输入密码'
    }
    return
  }

  // 密钥认证需要密钥路径
  if (formData.value.authType === 'key' && !formData.value.keyPath) {
    testResult.value = {
      type: 'error',
      message: '密钥认证需要选择密钥文件'
    }
    return
  }

  testing.value = true
  testResult.value = null

  try {
    // 构造测试会话
    const testSession: Partial<Session> = {
      name: formData.value.name || 'Test',
      host: formData.value.host,
      port: formData.value.port,
      username: formData.value.username,
      authType: formData.value.authType,
      password: formData.value.authType === 'password' ? formData.value.password : undefined,
      keyPath: formData.value.authType === 'key' ? formData.value.keyPath : undefined,
      keyPassphrase:
        formData.value.authType === 'key' && formData.value.keyPassphrase
          ? formData.value.keyPassphrase
          : undefined
    }

    // 调用测试连接 API
    const success = await window.api.session.testConnection(testSession)

    if (success) {
      testResult.value = {
        type: 'success',
        message: `成功连接到 ${formData.value.host}:${formData.value.port}`
      }
    } else {
      testResult.value = {
        type: 'error',
        message: '连接失败，请检查主机地址、端口、用户名和密码'
      }
    }
  } catch (error) {
    console.error('Test connection failed:', error)
    testResult.value = {
      type: 'error',
      message: error instanceof Error ? error.message : '连接失败，请稍后重试'
    }
  } finally {
    testing.value = false
  }
}
</script>

<style scoped>
/* ===== 遮罩层 ===== */
.session-form-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: transparent;
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

/* ===== 表单容器 ===== */
.session-form {
  position: relative;
  width: 480px;
  background: linear-gradient(145deg, rgba(30, 30, 30, 0.98) 0%, rgba(20, 20, 20, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset,
    0 1px 0 rgba(255, 255, 255, 0.1) inset;
  overflow: hidden;
  transition: transform 0.1s ease-in-out;
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

/* ===== 装饰性背景 ===== */
.form-decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 200px;
  pointer-events: none;
  overflow: hidden;
}

.decoration-circle {
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(14, 99, 156, 0.15) 0%, transparent 70%);
  animation: float 6s ease-in-out infinite;
}

.decoration-circle:first-child {
  top: -150px;
  right: -100px;
  animation-delay: 0s;
}

.decoration-circle:last-child {
  top: -100px;
  left: -150px;
  animation-delay: 3s;
}

@keyframes float {
  0%, 100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(20px, 20px);
  }
}

/* ===== 闪烁动画 ===== */
.session-form.shaking {
  animation: shake 0.5s ease-in-out, slideUp 0.3s ease-out;
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: translateX(-8px);
  }
  20%, 40%, 60%, 80% {
    transform: translateX(8px);
  }
}

/* ===== 表单头部 ===== */
.form-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 28px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, rgba(14, 99, 156, 0.2) 0%, rgba(14, 99, 156, 0.1) 100%);
  border: 1px solid rgba(14, 99, 156, 0.3);
  border-radius: 12px;
  color: var(--primary-color, #0e639c);
}

.header-text h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color, #e0e0e0);
  letter-spacing: -0.02em;
}

.header-subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-secondary, #808080);
  letter-spacing: 0.01em;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #808080);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-color, #e0e0e0);
  transform: scale(1.05);
}

/* ===== 表单主体 ===== */
.form-body {
  position: relative;
  padding: 24px 28px;
}

/* ===== 表单组 ===== */
.form-group {
  margin-bottom: 20px;
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
  color: var(--text-secondary, #a0a0a0);
  letter-spacing: 0.01em;
}

.form-group label svg {
  flex-shrink: 0;
  opacity: 0.7;
}

.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.flex-1 {
  flex: 1;
}

.flex-2 {
  flex: 2;
}

/* ===== 输入框包装器 ===== */
.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-wrapper input {
  flex: 1;
  width: 100%;
  padding: 10px 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-color, #e0e0e0);
  font-size: 14px;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  letter-spacing: 0.02em;
  outline: none;
  transition: all 0.2s ease;
}

.input-wrapper input:hover {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.07);
}

.input-wrapper input:focus {
  border-color: var(--primary-color, #0e639c);
  background: rgba(14, 99, 156, 0.05);
  box-shadow: 0 0 0 3px rgba(14, 99, 156, 0.1);
}

.input-wrapper input::placeholder {
  color: var(--text-tertiary, #606060);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* 分组树形选择器容器 */
.group-tree-container {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  padding: 8px;
  max-height: 200px;
  overflow-y: auto;
  transition: all 0.2s ease;
}

.group-tree-container:hover {
  border-color: rgba(255, 255, 255, 0.2);
  background-color: rgba(255, 255, 255, 0.07);
}

.group-tree-container:focus-within {
  border-color: var(--primary-color, #0e639c);
  background-color: rgba(14, 99, 156, 0.05);
  box-shadow: 0 0 0 3px rgba(14, 99, 156, 0.1);
}


/* ===== 密码切换按钮 ===== */
.password-toggle {
  position: absolute;
  right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--text-color, #c0c0c0);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.password-toggle:hover {
  background: rgba(255, 255, 255, 0.15);
  color: var(--text-color, #e0e0e0);
}

.password-toggle:active {
  transform: scale(0.95);
}

/* 密码图标样式 */
.password-icon {
  width: 20px;
  height: 20px;
  display: block;
  flex-shrink: 0;
  margin: auto;
}

/* 有密码切换按钮的输入框需要右侧留出空间 */
.input-wrapper:has(.password-toggle) input {
  padding-right: 44px;
}

/* ===== 浏览按钮 ===== */
.browse-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border: 1px solid rgba(14, 99, 156, 0.5);
  border-radius: 8px;
  background: rgba(14, 99, 156, 0.1);
  color: var(--primary-color, #0e639c);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.browse-btn:hover {
  background: rgba(14, 99, 156, 0.2);
  border-color: var(--primary-color, #0e639c);
  transform: translateY(-1px);
}

.browse-btn:active {
  transform: translateY(0);
}

/* ===== 单选按钮组 ===== */
.radio-group {
  display: flex;
  gap: 12px;
}

.radio-label {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
}

.radio-label:hover {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
}

.radio-label.active {
  border-color: var(--primary-color, #0e639c);
  background: rgba(14, 99, 156, 0.1);
}

.radio-label input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.radio-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.radio-label.active .radio-indicator {
  border-color: var(--primary-color, #0e639c);
}

.radio-indicator svg {
  color: var(--primary-color, #0e639c);
}

.radio-label span {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color, #e0e0e0);
}

/* ===== 密钥认证区域 ===== */
.key-auth-section {
  padding-top: 4px;
}

/* ===== 过渡动画 ===== */
.slide-fade-enter-active {
  transition: all 0.3s ease;
}

.slide-fade-leave-active {
  transition: all 0.2s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* ===== 表单底部 ===== */
.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 28px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.2);
}

/* ===== 测试连接结果 ===== */
.test-result {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  margin: 0 28px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.test-result.success {
  background: rgba(34, 139, 34, 0.15);
  border: 1px solid rgba(34, 139, 34, 0.3);
  color: #4caf50;
}

.test-result.error {
  background: rgba(220, 53, 69, 0.15);
  border: 1px solid rgba(220, 53, 69, 0.3);
  color: #dc3545;
}

.test-result .close-result {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-left: auto;
  border: none;
  background: transparent;
  color: currentColor;
  cursor: pointer;
  border-radius: 4px;
  opacity: 0.7;
  transition: all 0.2s ease;
}

.test-result .close-result:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

/* ===== 测试连接按钮 ===== */
.btn.test {
  background: rgba(14, 99, 156, 0.15);
  color: var(--primary-color, #0e639c);
  border: 1px solid rgba(14, 99, 156, 0.3);
}

.btn.test:hover:not(:disabled) {
  background: rgba(14, 99, 156, 0.25);
  border-color: rgba(14, 99, 156, 0.5);
  transform: translateY(-1px);
}

.btn.test:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.01em;
}

.btn.cancel {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary, #a0a0a0);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.btn.cancel:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-color, #e0e0e0);
  border-color: rgba(255, 255, 255, 0.2);
}

.btn.submit {
  background: linear-gradient(135deg, var(--primary-color, #0e639c) 0%, var(--primary-hover, #1177bb) 100%);
  color: white;
  border: 1px solid rgba(14, 99, 156, 0.5);
  box-shadow: 0 4px 12px rgba(14, 99, 156, 0.3);
}

.btn.submit:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(14, 99, 156, 0.4);
}

.btn.submit:active {
  transform: translateY(0);
}

.btn.submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* ===== 加载动画 ===== */
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ===== 响应式设计 ===== */
@media (max-width: 520px) {
  .session-form {
    width: calc(100vw - 40px);
    margin: 20px;
  }

  .form-row {
    flex-direction: column;
  }
}

/* ===== 浅色主题 ===== */
[data-theme="light"] .session-form {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.98) 0%, rgba(245, 245, 245, 0.98) 100%);
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(0, 0, 0, 0.05) inset,
    0 1px 0 rgba(255, 255, 255, 0.8) inset;
}

[data-theme="light"] .decoration-circle {
  background: radial-gradient(circle, rgba(14, 99, 156, 0.08) 0%, transparent 70%);
}

[data-theme="light"] .form-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

[data-theme="light"] .header-icon {
  background: linear-gradient(135deg, rgba(14, 99, 156, 0.1) 0%, rgba(14, 99, 156, 0.05) 100%);
  border: 1px solid rgba(14, 99, 156, 0.2);
}

[data-theme="light"] .close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

[data-theme="light"] .input-wrapper input {
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: rgba(0, 0, 0, 0.02);
}

[data-theme="light"] .input-wrapper input:hover {
  border-color: rgba(0, 0, 0, 0.25);
  background: rgba(0, 0, 0, 0.03);
}

[data-theme="light"] .input-wrapper input:focus {
  border-color: var(--primary-color, #0e639c);
  background: rgba(14, 99, 156, 0.03);
  box-shadow: 0 0 0 3px rgba(14, 99, 156, 0.08);
}

[data-theme="light"] .group-select {
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: rgba(0, 0, 0, 0.02);
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5L6 8L9 5' stroke='%23606060' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}

[data-theme="light"] .group-select:hover {
  border-color: rgba(0, 0, 0, 0.25);
  background-color: rgba(0, 0, 0, 0.03);
}

/* 浅色主题下的分组树形选择器容器 */
[data-theme="light"] .group-tree-container {
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: rgba(255, 255, 255, 0.95);
}

[data-theme="light"] .group-tree-container:hover {
  border-color: rgba(0, 0, 0, 0.2);
  background-color: rgba(255, 255, 255, 1);
}

[data-theme="light"] .group-tree-container:focus-within {
  border-color: var(--primary-color, #0e639c);
  background-color: rgba(14, 99, 156, 0.03);
  box-shadow: 0 0 0 3px rgba(14, 99, 156, 0.08);
}

[data-theme="light"] .password-toggle {
  color: var(--text-color, #444444);
}

[data-theme="light"] .password-toggle:hover {
  background: rgba(0, 0, 0, 0.08);
  color: var(--text-color, #222222);
}

[data-theme="light"] .password-toggle:active {
  transform: scale(0.95);
}

[data-theme="light"] .browse-btn {
  border: 1px solid rgba(14, 99, 156, 0.3);
  background: rgba(14, 99, 156, 0.05);
}

[data-theme="light"] .browse-btn:hover {
  background: rgba(14, 99, 156, 0.1);
  border-color: rgba(14, 99, 156, 0.5);
}

[data-theme="light"] .radio-label {
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(0, 0, 0, 0.02);
}

[data-theme="light"] .radio-label:hover {
  border-color: rgba(0, 0, 0, 0.2);
  background: rgba(0, 0, 0, 0.03);
}

[data-theme="light"] .radio-label.active {
  border-color: var(--primary-color, #0e639c);
  background: rgba(14, 99, 156, 0.05);
}

[data-theme="light"] .radio-indicator {
  border: 2px solid rgba(0, 0, 0, 0.2);
  background: white;
}

[data-theme="light"] .radio-label.active .radio-indicator {
  border-color: var(--primary-color, #0e639c);
  background: white;
}

[data-theme="light"] .btn.cancel {
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(0, 0, 0, 0.03);
  color: var(--text-color, #333333);
}

[data-theme="light"] .btn.cancel:hover {
  background: rgba(0, 0, 0, 0.06);
  border-color: rgba(0, 0, 0, 0.2);
}

[data-theme="light"] .btn.submit {
  border: 1px solid rgba(14, 99, 156, 0.3);
  box-shadow: 0 2px 8px rgba(14, 99, 156, 0.2);
}

[data-theme="light"] .btn.submit:hover {
  box-shadow: 0 4px 12px rgba(14, 99, 156, 0.3);
}

[data-theme="light"] .spinner {
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
}
</style>
