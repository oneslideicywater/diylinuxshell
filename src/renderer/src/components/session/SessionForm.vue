/**
 * 会话表单组件
 * 用于创建和编辑会话
 * @module components/session/SessionForm
 */

<template>
  <div class="session-form-overlay" @click.self="$emit('close')">
    <div class="session-form">
      <div class="form-header">
        <h3>{{ isEdit ? '编辑会话' : '新建会话' }}</h3>
        <button class="close-btn" @click="$emit('close')">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
      </div>

      <form @submit.prevent="handleSubmit">
        <div class="form-body">
          <!-- 会话名称 -->
          <div class="form-group">
            <label for="name">会话名称</label>
            <input
              id="name"
              v-model="formData.name"
              type="text"
              placeholder="例如：Web Server"
              required
            />
          </div>

          <!-- 主机地址 -->
          <div class="form-group">
            <label for="host">主机地址</label>
            <input
              id="host"
              v-model="formData.host"
              type="text"
              placeholder="例如：192.168.1.100"
              required
            />
          </div>

          <!-- 端口号 -->
          <div class="form-group">
            <label for="port">端口</label>
            <input id="port" v-model.number="formData.port" type="number" min="1" max="65535" required />
          </div>

          <!-- 用户名 -->
          <div class="form-group">
            <label for="username">用户名</label>
            <input
              id="username"
              v-model="formData.username"
              type="text"
              placeholder="例如：root"
              required
            />
          </div>

          <!-- 认证方式 -->
          <div class="form-group">
            <label>认证方式</label>
            <div class="radio-group">
              <label class="radio-label">
                <input v-model="formData.authType" type="radio" value="password" />
                <span>密码</span>
              </label>
              <label class="radio-label">
                <input v-model="formData.authType" type="radio" value="key" />
                <span>密钥</span>
              </label>
            </div>
          </div>

          <!-- 密码认证 -->
          <div v-if="formData.authType === 'password'" class="form-group">
            <label for="password">密码</label>
            <input
              id="password"
              v-model="formData.password"
              type="password"
              placeholder="输入密码"
              :required="formData.authType === 'password'"
            />
          </div>

          <!-- 密钥认证 -->
          <template v-if="formData.authType === 'key'">
            <div class="form-group">
              <label for="keyPath">密钥路径</label>
              <div class="input-with-btn">
                <input
                  id="keyPath"
                  v-model="formData.keyPath"
                  type="text"
                  placeholder="选择密钥文件"
                  required
                />
                <button type="button" class="browse-btn" @click="browseKeyFile">浏览</button>
              </div>
            </div>
            <div class="form-group">
              <label for="keyPassphrase">密钥密码（可选）</label>
              <input
                id="keyPassphrase"
                v-model="formData.keyPassphrase"
                type="password"
                placeholder="输入密钥密码"
              />
            </div>
          </template>
        </div>

        <div class="form-footer">
          <button type="button" class="btn cancel" @click="$emit('close')">取消</button>
          <button type="submit" class="btn submit" :disabled="submitting">
            {{ submitting ? '保存中...' : '保存' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Session } from '@shared/types'

// 定义属性
const props = defineProps<{
  session?: Session
}>()

// 定义事件
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', data: Partial<Session>): void
}>()

// 是否为编辑模式
const isEdit = computed(() => !!props.session)

// 表单数据
const formData = ref({
  name: '',
  host: '',
  port: 22,
  username: '',
  authType: 'password' as 'password' | 'key',
  password: '',
  keyPath: '',
  keyPassphrase: ''
})

// 提交状态
const submitting = ref(false)

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
        authType: session.authType,
        password: '',
        keyPath: session.keyPath || '',
        keyPassphrase: ''
      }
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
 * 提交表单
 */
const handleSubmit = async () => {
  submitting.value = true
  try {
    emit('save', {
      name: formData.value.name,
      host: formData.value.host,
      port: formData.value.port,
      username: formData.value.username,
      authType: formData.value.authType,
      password: formData.value.authType === 'password' ? formData.value.password : undefined,
      keyPath: formData.value.authType === 'key' ? formData.value.keyPath : undefined,
      keyPassphrase:
        formData.value.authType === 'key' && formData.value.keyPassphrase
          ? formData.value.keyPassphrase
          : undefined,
      status: 'disconnected'
    })
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.session-form-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.session-form {
  width: 400px;
  background-color: var(--bg-color, #1e1e1e);
  border: 1px solid var(--border-color, #3c3c3c);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #3c3c3c);
}

.form-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-color, #cccccc);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #808080);
  cursor: pointer;
  border-radius: 4px;
}

.close-btn:hover {
  background-color: var(--hover-bg, #3c3c3c);
  color: var(--text-color, #cccccc);
}

.form-body {
  padding: 20px;
  max-height: 400px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--text-secondary, #808080);
}

.form-group input[type='text'],
.form-group input[type='password'],
.form-group input[type='number'] {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color, #3c3c3c);
  border-radius: 4px;
  background-color: var(--input-bg, #3c3c3c);
  color: var(--text-color, #cccccc);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

.form-group input:focus {
  border-color: var(--primary-color, #007acc);
}

.radio-group {
  display: flex;
  gap: 16px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-color, #cccccc);
}

.input-with-btn {
  display: flex;
  gap: 8px;
}

.input-with-btn input {
  flex: 1;
}

.browse-btn {
  padding: 8px 12px;
  border: 1px solid var(--border-color, #3c3c3c);
  border-radius: 4px;
  background-color: var(--button-bg, #0e639c);
  color: white;
  font-size: 13px;
  cursor: pointer;
}

.browse-btn:hover {
  background-color: var(--button-hover-bg, #1177bb);
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color, #3c3c3c);
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.btn.cancel {
  background-color: transparent;
  color: var(--text-secondary, #808080);
}

.btn.cancel:hover {
  background-color: var(--hover-bg, #3c3c3c);
  color: var(--text-color, #cccccc);
}

.btn.submit {
  background-color: var(--primary-color, #0e639c);
  color: white;
}

.btn.submit:hover {
  background-color: var(--primary-hover, #1177bb);
}

.btn.submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
