"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Download, GitBranch, ArrowRight } from "lucide-react"

/* 底部 CTA 行动召唤区域 */
export function CTASection() {
  return (
    <section className="py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* 背景渐变 */}
      <div className="absolute inset-0 bg-surface-subtle -z-10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                    w-[600px] h-[300px] rounded-full bg-primary-100/30 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-3xl mx-auto text-center"
      >
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6 dark:text-dark-ink">
          准备好提升你的终端效率了吗？
        </h2>

        <p className="text-lg text-ink-secondary dark:text-dark-ink-secondary mb-10 max-w-lg mx-auto leading-relaxed">
          免费开源，开箱即用。立即下载，体验现代化的 SSH 终端管理。
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/download"
            className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl
                       bg-primary-500 text-white font-semibold text-base
                       hover:bg-primary-600 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(51,112,255,0.25)]
                       transition-all duration-250 cursor-pointer"
          >
            <Download className="w-5 h-5" />
            免费下载
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
          </Link>

          <a
            href="https://github.com/oneslideicywater/diylinuxshell"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl
                       bg-surface text-ink font-semibold text-base
                       border border-border-default shadow-card
                       hover:border-primary-300 hover:-translate-y-0.5 hover:shadow-card-hover
                       transition-all duration-200 cursor-pointer"
          >
            <GitBranch className="w-5 h-5" />
            GitHub Star
          </a>
        </div>

        {/* 平台支持提示 */}
        <p className="mt-8 text-xs text-ink-tertiary">
          支持 Windows · macOS · Linux · 开源免费 (MIT)
        </p>
      </motion.div>
    </section>
  )
}
