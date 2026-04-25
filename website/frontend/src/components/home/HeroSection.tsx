"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Download, GitBranch, Sparkles } from "lucide-react"

/* Hero 区域 - 首屏核心展示 */
export function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 -z-10">
        {/* 渐变光晕 - 适度透明度保持视觉层次 */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full
                      bg-primary-100/25 blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[350px] h-[350px] rounded-full
                      bg-success-400/10 blur-[80px]" />

        {/* 网格图案 */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-primary-500) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary-500) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-20">
        {/* 标签 — 技术栈徽章风格 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex flex-wrap items-center justify-center gap-2 mb-8"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                       bg-primary-50 text-primary-600 text-xs font-medium border border-primary-200/50">
            <Sparkles className="w-3 h-3" aria-hidden="true" />
            Apache 2.0 开源
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full
                       bg-surface-subtle text-xs font-mono border border-border-default"
                       style={{ color: '#475569 !important' }}>
            Electron 29 · Vue 3.4 · TS 5.3
          </span>
        </motion.div>

        {/* 主标题 */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight"
        >
          <span className="font-mono">DIY-Linux-Shell</span>
          <br />
          <span className="text-ink-secondary">现代化的 SSH 终端管理工具</span>
        </motion.h1>

        {/* 副标题描述 — 对齐 README 产品简介 */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg sm:text-xl text-ink-secondary max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          基于 <span className="font-mono font-semibold text-primary-500">Electron + Vue 3 + TypeScript</span> 构建。
          多会话终端管理、SFTP 文件传输、灵活分组管理，
          <br className="hidden sm:block" />
          为开发者和运维人员打造的<span className="font-semibold text-primary-500">高效远程服务器管理</span>方案。
        </motion.p>

        {/* CTA 按钮组 - 统一过渡效果 */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/download"
            className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-xl
                       bg-primary-500 text-white font-semibold text-base
                       hover:bg-primary-600 hover:-translate-y-0.5 hover:shadow-card-hover
                       focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2
                       cursor-pointer"
            aria-label="免费下载 DIY-Linux-Shell"
          >
            <Download className="w-5 h-5" aria-hidden="true" />
            免费下载
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>

          <a
            href="https://gitee.com/oneslideicywater/diy-linux-shell"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl
                       bg-surface text-ink font-semibold text-base
                       border border-border-default
                       hover:border-primary-400 hover:text-primary-600 hover:-translate-y-0.5
                       focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2
                       cursor-pointer"
            aria-label="访问 Gitee 仓库"
          >
            <GitBranch className="w-5 h-5" aria-hidden="true" />
            Gitee
          </a>

          <a
            href="https://github.com/oneslideicywater/diylinuxshell"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl
                       bg-surface text-ink font-semibold text-base
                       border border-border-default
                       hover:border-primary-400 hover:text-primary-600 hover:-translate-y-0.5
                       focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2
                       cursor-pointer"
            aria-label="访问 GitHub 仓库"
          >
            <GitBranch className="w-5 h-5" aria-hidden="true" />
            GitHub
          </a>
        </motion.div>

        {/* 终端命令预览 — 对齐 README 快速开始 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-14 max-w-lg mx-auto"
        >
          <div className="rounded-xl overflow-hidden border border-border-default shadow-card
                      bg-surface-subtle">
            {/* 终端标题栏 */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border-default bg-surface-subtle">
              <div className="w-3 h-3 rounded-full bg-red-400" aria-hidden="true" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" aria-hidden="true" />
              <div className="w-3 h-3 rounded-full bg-green-400" aria-hidden="true" />
              <span className="ml-2 text-xs text-ink-tertiary font-mono">terminal</span>
            </div>
            {/* 命令内容 — 对齐 README 克隆步骤 */}
            <div className="p-5 font-mono text-sm leading-relaxed space-y-1.5">
              <p className="text-ink-secondary">
                <span className="text-success-500">$</span>{" "}
                <span className="text-ink">git clone https://gitee.com/oneslideicywater/diy-linux-shell.git</span>
              </p>
              <p className="text-ink-secondary">
                <span className="text-success-500">$</span>{" "}
                <span className="text-ink">cd diy-linux-shell &amp;&amp; npm install</span>
              </p>
              <p className="text-ink-tertiary mt-2">
                ✓ 安装完成，运行 <span className="text-primary-500">npm run dev</span> 启动开发模式
              </p>
            </div>
          </div>
        </motion.div>

        {/* 状态提示 — 对齐 README "产品动态" */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-6 text-xs text-success-500 font-medium"
        >
          ✅ 目前已通过全部基础测试，各平台安装包相继上传中…
        </motion.p>
      </div>
    </section>
  )
}
