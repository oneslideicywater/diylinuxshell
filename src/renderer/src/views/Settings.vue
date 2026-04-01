<template>
  <div class="settings-container">
    <div class="settings-header">
      <button class="back-btn" @click="handleBack" title="返回">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" fill="none" />
        </svg>
      </button>
      <h2>设置</h2>
    </div>
    <div class="settings-content">
      <el-tabs v-model="activeTab" tab-position="left">
        <el-tab-pane label="外观" name="appearance">
          <div class="settings-section">
            <h3>主题设置</h3>
            <el-form label-width="100px">
              <el-form-item label="主题模式">
                <el-radio-group v-model="settings.theme">
                  <el-radio value="dark">深色</el-radio>
                  <el-radio value="light">浅色</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="字体大小">
                <el-slider v-model="settings.fontSize" :min="12" :max="24" :step="1" show-input />
              </el-form-item>
              <el-form-item label="字体类型">
                <el-select v-model="settings.fontFamily" placeholder="选择字体">
                  <el-option label="Cascadia Code" value="Cascadia Code" />
                  <el-option label="Fira Code" value="Fira Code" />
                  <el-option label="Consolas" value="Consolas" />
                  <el-option label="Monaco" value="Monaco" />
                </el-select>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <el-tab-pane label="终端" name="terminal">
          <div class="settings-section">
            <h3>终端设置</h3>
            <el-form label-width="120px">
              <el-form-item label="终端类型">
                <el-select v-model="settings.terminalType" placeholder="选择终端类型">
                  <el-option label="xterm-256color" value="xterm-256color" />
                  <el-option label="xterm" value="xterm" />
                  <el-option label="linux" value="linux" />
                </el-select>
              </el-form-item>
              <el-form-item label="光标样式">
                <el-select v-model="settings.cursorStyle" placeholder="选择光标样式">
                  <el-option label="块状" value="block" />
                  <el-option label="下划线" value="underline" />
                  <el-option label="竖线" value="bar" />
                </el-select>
              </el-form-item>
              <el-form-item label="光标闪烁">
                <el-switch v-model="settings.cursorBlink" />
              </el-form-item>
              <el-form-item label="滚动缓冲区">
                <el-input-number v-model="settings.scrollback" :min="1000" :max="100000" :step="1000" />
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <el-tab-pane label="连接" name="connection">
          <div class="settings-section">
            <h3>连接设置</h3>
            <el-form label-width="120px">
              <el-form-item label="连接超时">
                <el-input-number v-model="settings.connectionTimeout" :min="5000" :max="60000" :step="1000" />
                <span class="unit">毫秒</span>
              </el-form-item>
              <el-form-item label="心跳间隔">
                <el-input-number v-model="settings.keepaliveInterval" :min="0" :max="60000" :step="1000" />
                <span class="unit">毫秒 (0为禁用)</span>
              </el-form-item>
              <el-form-item label="自动重连">
                <el-switch v-model="settings.autoReconnect" />
              </el-form-item>
              <el-form-item v-if="settings.autoReconnect" label="重连次数">
                <el-input-number v-model="settings.reconnectAttempts" :min="1" :max="10" />
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <el-tab-pane label="数据" name="data">
          <div class="settings-section">
            <h3>数据管理</h3>
            <el-form label-width="120px">
              <el-form-item label="导出配置">
                <el-button type="primary" @click="handleExportConfig">导出会话配置</el-button>
              </el-form-item>
              <el-form-item label="导入配置">
                <el-button @click="handleImportConfig">导入会话配置</el-button>
              </el-form-item>
              <el-form-item label="清除数据">
                <el-button type="danger" @click="handleClearData">清除所有数据</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()

// 当前激活的标签页
const activeTab = ref('appearance')

/**
 * 设置后返回主页
 */
const handleBack = (): void => {
  router.push('/')
}

// 设置数据
const settings = reactive({
  // 外观设置
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'Cascadia Code',

  // 终端设置
  terminalType: 'xterm-256color',
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 10000,

  // 连接设置
  connectionTimeout: 30000,
  keepaliveInterval: 30000,
  autoReconnect: true,
  reconnectAttempts: 3
})

/**
 * 导出配置
 */
const handleExportConfig = (): void => {
  // TODO: 实现导出配置
  ElMessage.success('配置导出成功')
}

/**
 * 导入配置
 */
const handleImportConfig = (): void => {
  // TODO: 实现导入配置
  ElMessage.success('配置导入成功')
}

/**
 * 清除所有数据
 */
const handleClearData = async (): Promise<void> => {
  try {
    await ElMessageBox.confirm('确定要清除所有数据吗？此操作不可恢复。', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    // TODO: 实现清除数据
    ElMessage.success('数据清除成功')
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
.settings-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #000000;
  color: #ffffff;
}

.settings-header {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #333333;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-right: 12px;
  border: none;
  background: transparent;
  color: #ffffff;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.back-btn:hover {
  background-color: #333333;
}

.settings-header h2 {
  font-size: 18px;
  font-weight: 500;
  color: #ffffff;
  margin: 0;
}

.settings-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.settings-content :deep(.el-tabs) {
  width: 100%;
  display: flex;
}

.settings-content :deep(.el-tabs__header) {
  width: 200px;
  margin-right: 0;
  background-color: #1a1a1a;
}

.settings-content :deep(.el-tabs__nav-wrap) {
  background-color: #1a1a1a;
}

.settings-content :deep(.el-tabs__item) {
  color: #cccccc;
  background-color: #1a1a1a;
  border-right: 2px solid transparent;
}

.settings-content :deep(.el-tabs__item:hover) {
  color: #ffffff;
}

.settings-content :deep(.el-tabs__item.is-active) {
  color: #ffffff;
  background-color: #000000;
  border-right-color: #0e639c;
}

.settings-content :deep(.el-tabs__content) {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background-color: #000000;
}

.settings-section {
  max-width: 600px;
}

.settings-section h3 {
  font-size: 16px;
  font-weight: 500;
  color: #ffffff;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #333333;
}

/* 表单样式 */
.settings-content :deep(.el-form-item__label) {
  color: #ffffff;
}

.settings-content :deep(.el-radio__label) {
  color: #ffffff;
}

.settings-content :deep(.el-radio__input.is-checked .el-radio__inner) {
  border-color: #0e639c;
  background-color: #0e639c;
}

.settings-content :deep(.el-radio__input.is-checked + .el-radio__label) {
  color: #ffffff;
}

.settings-content :deep(.el-select .el-input__wrapper) {
  background-color: #1a1a1a;
  box-shadow: none;
  border: 1px solid #333333;
}

.settings-content :deep(.el-select .el-input__inner) {
  color: #ffffff;
}

.settings-content :deep(.el-input-number) {
  background-color: #1a1a1a;
}

.settings-content :deep(.el-input-number .el-input__wrapper) {
  background-color: #1a1a1a;
  box-shadow: none;
}

.settings-content :deep(.el-input-number .el-input__inner) {
  color: #ffffff;
}

.settings-content :deep(.el-slider__runway) {
  background-color: #333333;
}

.settings-content :deep(.el-slider__bar) {
  background-color: #0e639c;
}

.settings-content :deep(.el-slider__button) {
  border-color: #0e639c;
}

.settings-content :deep(.el-switch.is-checked .el-switch__core) {
  border-color: #0e639c;
  background-color: #0e639c;
}

.settings-content :deep(.el-switch .el-switch__core) {
  background-color: #333333;
  border-color: #333333;
}

.settings-content :deep(.el-button--primary) {
  background-color: #0e639c;
  border-color: #0e639c;
}

.settings-content :deep(.el-button--primary:hover) {
  background-color: #1177bb;
  border-color: #1177bb;
}

.settings-content :deep(.el-button--danger) {
  background-color: #c42b1c;
  border-color: #c42b1c;
}

.settings-content :deep(.el-button--danger:hover) {
  background-color: #e81123;
  border-color: #e81123;
}

.unit {
  margin-left: 8px;
  color: #808080;
  font-size: 12px;
}
</style>
