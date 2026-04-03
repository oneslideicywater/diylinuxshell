/**
 * 设置页面组件
 * 管理应用设置，包括外观、终端、连接等配置
 * @module views/Settings
 */

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
                <el-radio-group v-model="settingsStore.theme" @change="handleThemeChange">
                  <el-radio value="dark">深色</el-radio>
                  <el-radio value="light">浅色</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="字体大小">
                <el-slider
                  v-model="settingsStore.terminal.fontSize"
                  :min="12"
                  :max="24"
                  :step="1"
                  show-input
                  @change="handleFontSizeChange"
                />
              </el-form-item>
              <el-form-item label="字体类型">
                <el-select
                  v-model="settingsStore.terminal.fontFamily"
                  placeholder="选择字体"
                  @change="handleFontFamilyChange"
                >
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
                <el-select
                  v-model="settingsStore.terminal.terminalType"
                  placeholder="选择终端类型"
                  @change="handleTerminalTypeChange"
                >
                  <el-option label="xterm-256color" value="xterm-256color" />
                  <el-option label="xterm" value="xterm" />
                  <el-option label="linux" value="linux" />
                </el-select>
              </el-form-item>
              <el-form-item label="光标样式">
                <el-select
                  v-model="settingsStore.terminal.cursorStyle"
                  placeholder="选择光标样式"
                  @change="handleCursorStyleChange"
                >
                  <el-option label="块状" value="block" />
                  <el-option label="下划线" value="underline" />
                  <el-option label="竖线" value="bar" />
                </el-select>
              </el-form-item>
              <el-form-item label="光标闪烁">
                <el-switch
                  v-model="settingsStore.terminal.cursorBlink"
                  @change="handleCursorBlinkChange"
                />
              </el-form-item>
              <el-form-item label="滚动缓冲区">
                <el-input-number
                  v-model="settingsStore.terminal.scrollback"
                  :min="1000"
                  :max="100000"
                  :step="1000"
                  @change="handleScrollbackChange"
                />
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <el-tab-pane label="连接" name="connection">
          <div class="settings-section">
            <h3>连接设置</h3>
            <el-form label-width="120px">
              <el-form-item label="连接超时">
                <el-input-number
                  v-model="settingsStore.connectionTimeout"
                  :min="5000"
                  :max="60000"
                  :step="1000"
                  @change="handleConnectionTimeoutChange"
                />
                <span class="unit">毫秒</span>
              </el-form-item>
              <el-form-item label="心跳间隔">
                <el-input-number
                  v-model="settingsStore.keepaliveInterval"
                  :min="0"
                  :max="60000"
                  :step="1000"
                  @change="handleKeepaliveIntervalChange"
                />
                <span class="unit">毫秒 (0为禁用)</span>
              </el-form-item>
              <el-form-item label="自动重连">
                <el-switch
                  v-model="settingsStore.autoReconnect"
                  @change="handleAutoReconnectChange"
                />
              </el-form-item>
              <el-form-item v-if="settingsStore.autoReconnect" label="重连次数">
                <el-input-number
                  v-model="settingsStore.reconnectAttempts"
                  :min="1"
                  :max="10"
                  @change="handleReconnectAttemptsChange"
                />
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
              <el-form-item label="重置设置">
                <el-button type="warning" @click="handleResetSettings">重置为默认设置</el-button>
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
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const settingsStore = useSettingsStore()

// 当前激活的标签页
const activeTab = ref('appearance')

/**
 * 设置后返回主页
 */
const handleBack = (): void => {
  router.push('/')
}

/**
 * 主题切换处理
 */
const handleThemeChange = (theme: 'dark' | 'light'): void => {
  settingsStore.setTheme(theme)
  ElMessage.success(`已切换到${theme === 'dark' ? '深色' : '浅色'}主题`)
}

/**
 * 字体大小变化处理
 */
const handleFontSizeChange = (size: number): void => {
  settingsStore.setFontSize(size)
  ElMessage.success(`字体大小已设置为 ${size}px`)
}

/**
 * 字体类型变化处理
 */
const handleFontFamilyChange = (font: string): void => {
  settingsStore.setFontFamily(font)
  ElMessage.success(`字体已设置为 ${font}`)
}

/**
 * 终端类型变化处理
 */
const handleTerminalTypeChange = (type: string): void => {
  settingsStore.setTerminalType(type)
  ElMessage.success(`终端类型已设置为 ${type}`)
}

/**
 * 光标样式变化处理
 */
const handleCursorStyleChange = (style: string): void => {
  settingsStore.setCursorStyle(style as 'block' | 'underline' | 'bar')
  ElMessage.success(`光标样式已设置`)
}

/**
 * 光标闪烁变化处理
 */
const handleCursorBlinkChange = (blink: boolean): void => {
  settingsStore.setCursorBlink(blink)
}

/**
 * 滚动缓冲区变化处理
 */
const handleScrollbackChange = (size: number): void => {
  settingsStore.setScrollback(size)
  ElMessage.success(`滚动缓冲区已设置为 ${size}`)
}

/**
 * 连接超时变化处理
 */
const handleConnectionTimeoutChange = (timeout: number): void => {
  settingsStore.setConnectionTimeout(timeout)
}

/**
 * 心跳间隔变化处理
 */
const handleKeepaliveIntervalChange = (interval: number): void => {
  settingsStore.setKeepaliveInterval(interval)
}

/**
 * 自动重连变化处理
 */
const handleAutoReconnectChange = (enabled: boolean): void => {
  settingsStore.setAutoReconnect(enabled)
}

/**
 * 重连次数变化处理
 */
const handleReconnectAttemptsChange = (attempts: number): void => {
  settingsStore.setReconnectAttempts(attempts)
}

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
 * 重置设置为默认值
 */
const handleResetSettings = async (): Promise<void> => {
  try {
    await ElMessageBox.confirm('确定要重置所有设置为默认值吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    settingsStore.resetSettings()
    ElMessage.success('设置已重置为默认值')
  } catch {
    // 用户取消
  }
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
  background-color: var(--bg-color, #000000);
  color: var(--text-color, #ffffff);
  transition: background-color 0.3s, color 0.3s;
}

.settings-header {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #333333);
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
  color: var(--text-color, #ffffff);
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.back-btn:hover {
  background-color: var(--hover-bg, #333333);
}

.settings-header h2 {
  font-size: 18px;
  font-weight: 500;
  color: var(--text-color, #ffffff);
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
  background-color: var(--hover-bg, #1a1a1a);
}

.settings-content :deep(.el-tabs__nav-wrap) {
  background-color: var(--hover-bg, #1a1a1a);
}

.settings-content :deep(.el-tabs__item) {
  color: var(--text-color, #cccccc);
  background-color: var(--hover-bg, #1a1a1a);
  border-right: 2px solid transparent;
}

.settings-content :deep(.el-tabs__item:hover) {
  color: var(--text-color, #ffffff);
}

.settings-content :deep(.el-tabs__item.is-active) {
  color: var(--text-color, #ffffff);
  background-color: var(--bg-color, #000000);
  border-right-color: #0e639c;
}

.settings-content :deep(.el-tabs__content) {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background-color: var(--bg-color, #000000);
}

.settings-section {
  max-width: 600px;
}

.settings-section h3 {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-color, #ffffff);
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color, #333333);
}

/* 表单样式 */
.settings-content :deep(.el-form-item__label) {
  color: var(--text-color, #ffffff);
}

.settings-content :deep(.el-radio__label) {
  color: var(--text-color, #ffffff);
}

.settings-content :deep(.el-radio__input.is-checked .el-radio__inner) {
  border-color: #0e639c;
  background-color: #0e639c;
}

.settings-content :deep(.el-radio__input.is-checked + .el-radio__label) {
  color: var(--text-color, #ffffff);
}

.settings-content :deep(.el-select .el-input__wrapper) {
  background-color: var(--hover-bg, #1a1a1a);
  box-shadow: none;
  border: 1px solid var(--border-color, #333333);
}

.settings-content :deep(.el-select .el-input__inner) {
  color: var(--text-color, #ffffff);
}

.settings-content :deep(.el-input-number) {
  background-color: var(--hover-bg, #1a1a1a);
}

.settings-content :deep(.el-input-number .el-input__wrapper) {
  background-color: var(--hover-bg, #1a1a1a);
  box-shadow: none;
}

.settings-content :deep(.el-input-number .el-input__inner) {
  color: var(--text-color, #ffffff);
}

.settings-content :deep(.el-slider__runway) {
  background-color: var(--border-color, #333333);
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
  background-color: var(--border-color, #333333);
  border-color: var(--border-color, #333333);
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

.settings-content :deep(.el-button--warning) {
  background-color: #ca7b17;
  border-color: #ca7b17;
}

.settings-content :deep(.el-button--warning:hover) {
  background-color: #e9a017;
  border-color: #e9a017;
}

.unit {
  margin-left: 8px;
  color: var(--text-color, #808080);
  font-size: 12px;
}

/* 浅色主题样式 */
[data-theme="light"] .settings-container {
  background-color: #ffffff;
}

[data-theme="light"] .settings-container .settings-header {
  border-bottom-color: #e0e0e0;
}

[data-theme="light"] .settings-container .back-btn:hover {
  background-color: #f0f0f0;
}

[data-theme="light"] .settings-container .settings-content :deep(.el-tabs__header),
[data-theme="light"] .settings-container .settings-content :deep(.el-tabs__nav-wrap),
[data-theme="light"] .settings-container .settings-content :deep(.el-tabs__item) {
  background-color: #f5f5f5;
}

[data-theme="light"] .settings-container .settings-content :deep(.el-tabs__item.is-active) {
  background-color: #ffffff;
}

[data-theme="light"] .settings-container .settings-content :deep(.el-tabs__content) {
  background-color: #ffffff;
}

[data-theme="light"] .settings-container .settings-content :deep(.el-select .el-input__wrapper),
[data-theme="light"] .settings-container .settings-content :deep(.el-input-number .el-input__wrapper) {
  background-color: #ffffff;
  border-color: #d0d0d0;
}

[data-theme="light"] .settings-container .settings-content :deep(.el-slider__runway) {
  background-color: #e0e0e0;
}

[data-theme="light"] .settings-container .settings-content :deep(.el-switch .el-switch__core) {
  background-color: #d0d0d0;
  border-color: #d0d0d0;
}
</style>
