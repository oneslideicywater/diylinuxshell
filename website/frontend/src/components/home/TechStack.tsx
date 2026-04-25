"use client"

import { motion } from "framer-motion"

/* 技术栈数据 — 对齐 README 徽章版本号 */
const techStack = [
  { name: "Electron 29.x", description: "跨平台桌面应用框架" },
  { name: "Vue 3.4", description: "渐进式前端框架 (Composition API)" },
  { name: "TypeScript 5.3", description: "类型安全的 JavaScript 超集" },
  { name: "xterm.js", description: "高性能终端模拟器" },
  { name: "Element Plus", description: "企业级 UI 组件库" },
  { name: "Pinia", description: "Vue 官方状态管理方案" },
  { name: "SSH2", description: "SSH 协议客户端库 (ssh2)" },
  { name: "electron-store", description: "JSON 数据持久化存储" },
]

/* 技术栈展示区域 */
export function TechStack() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-center mb-14"
      >
        <p className="text-sm font-medium text-primary-500 font-mono uppercase tracking-wider mb-3">
          Tech Stack
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold text-ink tracking-tight">
          成熟稳定的技术生态
        </h2>
        <p className="mt-4 text-ink-secondary max-w-lg mx-auto">
          基于 Node.js 20+ / Electron 29 / Vue 3.4 / TypeScript 5.3 构建，
          确保性能与开发体验的平衡
        </p>
      </motion.div>

      {/* 技术标签网格 */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex flex-wrap justify-center gap-3"
      >
        {techStack.map((tech, index) => (
          <motion.div
            key={tech.name}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: index * 0.06 }}
            whileHover={{ scale: 1.05, y: -2 }}
            className="group relative px-6 py-3 rounded-xl bg-surface border border-border-default
                        shadow-card hover:shadow-card-hover hover:border-primary-200
                        focus-within:ring-2 focus-within:ring-primary-400
                        cursor-pointer"
            role="listitem"
            aria-label={`技术：${tech.name} - ${tech.description}`}
          >
            {/* 悬停光效 */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary-500/5 to-transparent
                        opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        aria-hidden="true" />

            <div className="relative z-10">
              <span className="font-mono font-semibold text-sm text-ink group-hover:text-primary-600">
                {tech.name}
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs text-ink-tertiary
                               group-hover:text-ink-secondary">
                {tech.description}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}
