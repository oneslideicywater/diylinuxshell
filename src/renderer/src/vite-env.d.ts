/**
 * Vite 环境类型声明文件
 * 
 * 作用：为 TypeScript 编译器提供 Vue 组件和 Vite 资源的类型定义
 * 位置：必须放在 src 目录下，以便 TypeScript 能够自动识别
 * 
 * 解决的问题：
 * 1. 让 TypeScript 能够识别 *.vue 文件的导入
 * 2. 提供 Vite 特有的资源导入类型支持（如 .css, .png 等）
 * 3. 避免 "Cannot find module" 的类型错误
 */

/// <reference types="vite/client" />

/**
 * Vue 组件模块类型声明
 * 
 * 告诉 TypeScript：
 * - 所有以 .vue 结尾的文件都是 Vue 组件模块
 * - 导入的默认导出是一个 DefineComponent 类型的组件
 * 
 * 这样在 .ts 文件中导入 .vue 文件时就不会报类型错误了
 * 例如：import App from './App.vue' ✅
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
