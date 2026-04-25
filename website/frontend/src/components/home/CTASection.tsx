"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Download, GitBranch, ArrowRight } from "lucide-react"

/* 底部 CTA 行动召唤区域 - 浅色主题设计（使用 cta-light-section 防止暗色模式覆盖） */
export function CTASection() {
  return (
    <section className="cta-light-section py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* 背景层 - 浅色渐变背景 */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100 -z-10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                    w-[600px] h-[300px] rounded-full bg-emerald-100/30 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" as const }}
        className="max-w-3xl mx-auto text-center relative z-10"
      >
        {/* 主标题 - cta-light-text 类强制深色（优先级高于 .dark h2 规则）*/}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6 cta-light-text">
          准备好提升你的终端效率了吗？
        </h2>

        {/* 描述文字 - 继承父容器颜色 */}
        <p className="text-lg mb-10 max-w-lg mx-auto leading-relaxed font-medium text-slate-700">
          免费开源，开箱即用。立即下载，体验现代化的 SSH 终端管理。
        </p>

        {/* 按钮组 */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/download"
            className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl
                       bg-emerald-500 text-white font-semibold text-base
                       hover:bg-emerald-600 hover:-translate-y-0.5
                       hover:shadow-[0_12px_40px_rgba(16,185,129,0.35)]
                       focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2
                       cursor-pointer transition-all duration-300"
            aria-label="免费下载 DIY-Linux-Shell"
          >
            <Download className="w-5 h-5" aria-hidden="true" />
            免费下载
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" aria-hidden="true" />
          </Link>

          <a
            href="https://github.com/oneslideicywater/diylinuxshell"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl
                       bg-white text-slate-800 font-semibold text-base
                       border-2 border-slate-200 shadow-lg
                       hover:border-emerald-400 hover:-translate-y-0.5
                       hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]
                       focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2
                       cursor-pointer transition-all duration-300"
            aria-label="在 GitHub 上 Star DIY-Linux-Shell"
          >
            <GitBranch className="w-5 h-5" aria-hidden="true" />
            GitHub Star
          </a>
        </div>

        {/* 平台支持提示 */}
        <p className="mt-8 text-sm font-medium text-slate-600">
          支持 Windows · macOS · Linux · 开源免费 (Apache 2.0)
        </p>
      </motion.div>
    </section>
  )
}
