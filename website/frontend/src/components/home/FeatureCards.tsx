"use client"

import { motion } from "framer-motion"
import { Terminal, FolderUp, FolderTree, Monitor, ArrowRight } from "lucide-react"
import Link from "next/link"

/* Bento Grid 功能卡片数据 — 对齐 README 功能特性章节 */
const features = [
  {
    icon: Terminal,
    title: "多会话终端",
    description: "多 Tab 同时连接多台服务器，xterm.js 高性能渲染，支持自定义字体与光标样式，SSH/SFTP 一键切换",
    color: "from-blue-500/10 to-blue-500/5",
    iconColor: "text-blue-500",
    borderColor: "hover:border-blue-300",
  },
  {
    icon: FolderUp,
    title: "SFTP 文件传输",
    description: "双栏浏览器并排浏览本地与远程文件，批量上传下载，树形进度可视化展示每个文件传输状态",
    color: "from-emerald-500/10 to-emerald-500/5",
    iconColor: "text-emerald-500",
    borderColor: "hover:border-emerald-300",
  },
  {
    icon: FolderTree,
    title: "会话分组管理",
    description: "多级嵌套分组（最多 5 级），按项目或环境灵活组织连接，默认分组置顶，侧边栏可拖拽调整宽度",
    color: "from-violet-500/10 to-violet-500/5",
    iconColor: "text-violet-500",
    borderColor: "hover:border-violet-300",
  },
  {
    icon: Monitor,
    title: "跨平台 + 体验优化",
    description: "Windows / Linux / macOS 全覆盖，深色浅色主题切换，electron-store 数据持久化，可配置自动重连策略",
    color: "from-orange-500/10 to-orange-500/5",
    iconColor: "text-orange-500",
    borderColor: "hover:border-orange-300",
  },
]

/* 容器动画配置 */
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
}

/* Bento Grid 功能亮点区域 */
export function FeatureCards() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      >
        {features.map((feature) => (
          <motion.div
            key={feature.title}
            variants={itemVariants}
            className={`group relative p-6 rounded-xl bg-surface border border-border-default
                        shadow-card hover:shadow-card-hover hover:-translate-y-1
                        transition-all duration-200 cursor-pointer ${feature.borderColor}`}
          >
            {/* 图标背景光晕 */}
            <div
              className={`absolute inset-0 rounded-xl bg-gradient-to-br ${feature.color} opacity-0
                          group-hover:opacity-100 transition-opacity duration-300`}
            />

            {/* 内容 */}
            <div className="relative z-10">
              <div
                className={`w-11 h-11 rounded-lg flex items-center justify-center mb-4
                            bg-surface-subtle group-hover:bg-white transition-colors duration-200`}
              >
                <feature.icon className={`w-5 h-5 ${feature.iconColor}`} />
              </div>

              <h3 className="font-semibold text-base text-ink mb-2 group-hover:text-primary-600
                          transition-colors duration-200">
                {feature.title}
              </h3>

              <p className="text-sm text-ink-secondary leading-relaxed">
                {feature.description}
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* 底部链接 */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.4 }}
        className="text-center mt-12"
      >
        <Link
          href="/features"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-500
                     hover:text-primary-600 transition-colors duration-200 cursor-pointer group"
        >
          了解全部功能详情
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
        </Link>
      </motion.div>
    </section>
  )
}
