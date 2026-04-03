<template>
  <div class="app-container">
    <!-- 修复 BUG-008: 使用 keep-alive 保持路由组件状态，防止标签页消失 -->
    <router-view v-slot="{ Component }">
      <keep-alive>
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </div>
</template>

<script setup lang="ts">
// 应用根组件，路由视图容器
</script>

<style scoped>
.app-container {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
</style>
