/**
 * SFTP 状态头组件
 * 显示文件传输状态的表头
 * @module components/session/sftp/SftpStatusHeader
 */

<template>
  <div class="sftp-transfer-tree">
    <!-- 表头 -->
    <div class="tree-header">
      <div class="header-column name-column">名称</div>
      <div class="header-column status-column">状态</div>
      <div class="header-column progress-column">进度</div>
      <div class="header-column size-column">大小</div>
      <div class="header-column local-path-column">本地路径</div>
      <div class="header-column arrow-column">↔</div>
      <div class="header-column remote-path-column">远程路径</div>
      <div class="header-column speed-column">速度</div>
      <div class="header-column remaining-column">估计剩余</div>
      <div class="header-column elapsed-column">经过时间</div>
    </div>


  </div>
</template>

<script setup lang="ts">



</script>

<style scoped>
/* 传输树容器 */
.sftp-transfer-tree {
  display: flex;
  flex-direction: column;
  background: var(--bg-color, #1e1e1e);
  border-top: 1px solid var(--border-color, #333);
  font-size: 12px;
  overflow: hidden;
}

/* 表头 - 使用 --header-bg 变量以支持主题切换 */
.tree-header {
  display: flex;
  background: var(--header-bg, var(--sidebar-bg, var(--bg-color, #252526)));
  border-bottom: 1px solid var(--border-color, #333);
  font-weight: 500;
  user-select: none;
}

.header-column {
  padding: 6px 12px;
  text-align: left;
  color: var(--text-secondary, var(--text-color, #888));
  border-right: 1px solid var(--border-color, #333);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.name-column {
  width: 400px;
  min-width: 400px;
  flex-shrink: 0;
}

.status-column {
  width: 100px;
  min-width: 100px;
  flex-shrink: 0;
}

.progress-column {
  width: 150px;
  min-width: 150px;
  flex-shrink: 0;
}

.size-column {
  width: 120px;
  min-width: 120px;
  flex-shrink: 0;
}

.local-path-column {
  flex: 1;
  min-width: 200px;
}

.arrow-column {
  width: 40px;
  min-width: 40px;
  flex-shrink: 0;
  text-align: center;
  color: var(--primary-color, #409eff);
}

.remote-path-column {
  flex: 1;
  min-width: 200px;
}

.speed-column {
  width: 100px;
  min-width: 100px;
  flex-shrink: 0;
}

.remaining-column {
  width: 80px;
  min-width: 80px;
  flex-shrink: 0;
}

.elapsed-column {
  width: 80px;
  min-width: 80px;
  flex-shrink: 0;
}

/* 树形内容 */
.tree-content {
  flex: 1;
  overflow-y: auto;
  max-height: 400px;
}

/* 滚动条样式 */
.tree-content::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.tree-content::-webkit-scrollbar-track {
  background: var(--bg-color, #1e1e1e);
}

.tree-content::-webkit-scrollbar-thumb {
  background: var(--border-color, #333);
  border-radius: 4px;
}

.tree-content::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary, var(--text-color, #888));
}
</style>
