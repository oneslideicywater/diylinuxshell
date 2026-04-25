"use client"

import { useState } from "react"
import Image from "next/image"
import { motion } from "framer-motion"

/* 产品截图数据 — 对齐 README 截图章节 */
const screenshots = [
  {
    src: "/images/main-dark.png",
    alt: "主界面（深色主题）",
    caption: "深色主题 — 多 Tab 终端 + SFTP 文件传输",
  },
  {
    src: "/images/main-light.png",
    alt: "主界面（浅色主题）",
    caption: "浅色主题 — 清爽护眼的视觉体验",
  },
  {
    src: "/images/multi-group.png",
    alt: "多分组支持",
    caption: "会话分组 — 多级嵌套，灵活组织连接",
  },
  {
    src: "/images/sftp-dark.png",
    alt: "SFTP 文件传输（深色主题）",
    caption: "SFTP 传输 — 双栏浏览器 + 树形进度展示",
  },
]

/* 图片加载失败时的降级展示 */
function SafeImage({ src, alt, sizes, priority }: { src: string; alt: string; sizes?: string; priority?: boolean }) {
  const [errored, setErrored] = useState(false)

  if (errored) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-surface-muted">
        <div className="text-center p-6">
          <p className="text-sm text-ink-tertiary font-mono">{alt}</p>
          <p className="text-xs text-ink-tertiary mt-1 opacity-60">截图加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className="object-contain"
      sizes={sizes}
      priority={priority}
      onError={() => setErrored(true)}
    />
  )
}

/* 产品截图展示区域 */
export function ProductShowcase() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-surface-subtle">
      <div className="max-w-6xl mx-auto">
        {/* 标题区 */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-primary-500 font-mono uppercase tracking-wider mb-3">
            Preview
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-ink tracking-tight">
            一眼即会的界面设计
          </h2>
          <p className="mt-4 text-ink-secondary text-lg max-w-xl mx-auto">
            深色 / 浅色双主题支持，简洁直观的操作界面，
            让你专注于服务器管理本身
          </p>
        </motion.div>

        {/* 主截图展示 — 首张大图 */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: "easeOut" as const }}
          className="relative mb-8"
        >
          <div className="rounded-2xl overflow-hidden border border-border-default shadow-card-hover
                      bg-surface">
            {/* 浏览器顶栏模拟 */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border-default bg-surface-subtle">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                <div className="w-3 h-3 rounded-full bg-[#28C840]" />
              </div>
              <div className="flex-1 ml-4">
                <div className="max-w-md mx-auto px-4 py-1.5 rounded-lg bg-surface-muted
                              text-xs text-ink-tertiary font-mono text-center">
                  DIY-Linux-Shell — 主界面
                </div>
              </div>
            </div>

            {/* 截图内容 — 带容错处理 */}
            <div className="relative aspect-[16/9] sm:aspect-[16/10] bg-surface-muted">
              <SafeImage
                src={screenshots[0].src}
                alt={screenshots[0].alt}
                sizes="(max-width: 1024px) 100vw, 900px"
                priority
              />
            </div>

            {/* 图片说明 */}
            <div className="px-5 py-3 border-t border-border-default bg-surface-subtle">
              <p className="text-xs text-center text-ink-tertiary">{screenshots[0].caption}</p>
            </div>
          </div>
        </motion.div>

        {/* 副截图网格 — 2x2 展示其余截图 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-5"
        >
          {screenshots.slice(1).map((shot) => (
            <div
              key={shot.src}
              className="group rounded-xl overflow-hidden border border-border-default
                          shadow-card hover:shadow-card-hover hover:-translate-y-1
                          transition-all duration-200 cursor-pointer bg-surface"
            >
              <div className="relative aspect-[16/10] bg-surface-muted">
                <SafeImage
                  src={shot.src}
                  alt={shot.alt}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
                />
              </div>
              <div className="px-4 py-2.5 border-t border-border-default bg-surface-subtle">
                <p className="text-xs text-center text-ink-tertiary group-hover:text-ink-secondary
                            transition-colors duration-200">
                  {shot.caption}
                </p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* 查看更多链接 */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.35 }}
          className="text-center mt-8"
        >
          <a
            href="/screenshots"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-500
                       hover:text-primary-600 transition-colors duration-200 cursor-pointer"
          >
            查看全部截图 →
          </a>
        </motion.div>
      </div>
    </section>
  )
}
