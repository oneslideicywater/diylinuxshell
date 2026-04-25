"use client"

import { useState } from "react"
import Image from "next/image"
import { motion } from "framer-motion"
import { Terminal, FolderUp, FolderTree, Settings } from "lucide-react"

const iconMap = {
  terminal: Terminal,
  folder: FolderUp,
  tree: FolderTree,
  settings: Settings,
}

type IconName = keyof typeof iconMap

interface FeatureSectionProps {
  title: string
  description: string
  highlights: string[]
  icon: IconName
  align: "left" | "right"
  imageSrc?: string
}

/* 单个功能展示区块 - 左图右文 / 右图左文交替 */
export function FeatureSection({ title, description, highlights, icon, align, imageSrc }: FeatureSectionProps) {
  const IconComponent = iconMap[icon]
  const [imgErrored, setImgErrored] = useState(false)

  /* 图片区域 — 有真实截图则渲染，否则降级为图标占位 */
  const imageBlock = (
    <motion.div
      initial={{ opacity: 0, x: align === "left" ? -30 : 30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className={`flex-shrink-0 ${align === "right" ? "order-2" : ""}`}
    >
      <div className="w-full sm:w-[480px] aspect-[4/3] rounded-xl overflow-hidden border border-border-default
                  shadow-card bg-surface-subtle relative">
        {/* 有图片且未报错 → 渲染真实截图 */}
        {imageSrc && !imgErrored ? (
          <Image
            src={imageSrc}
            alt={title}
            fill
            className="object-contain"
            sizes="(max-width: 640px) 100vw, 480px"
            onError={() => setImgErrored(true)}
          />
        ) : (
          /* 无图片或加载失败 → 图标占位 */
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center p-8 space-y-3">
              <div className="w-14 h-14 rounded-xl bg-primary-50 flex items-center justify-center mx-auto">
                <IconComponent className="w-7 h-7 text-primary-500" />
              </div>
              <p className="text-sm text-ink-tertiary font-mono">{title}</p>
              <p className="text-xs text-ink-tertiary/60">产品截图区域</p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )

  const textBlock = (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: 0.15 }}
      className={`${align === "left" ? "" : "order-1"}`}
    >
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full
                  bg-primary-50 text-primary-600 text-xs font-semibold mb-4">
        <IconComponent className="w-3.5 h-3.5" />
        {title.split(" ")[0]}
      </div>

      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">{title}</h2>

      <p className="text-ink-secondary leading-relaxed mb-6">{description}</p>

      <ul className="space-y-2.5">
        {highlights.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-ink-secondary">
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-success-500 flex-shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </motion.div>
  )

  return (
    <div className={`flex flex-col ${align === "left" ? "lg:flex-row" : "lg:flex-row-reverse"}
                        items-center gap-12 lg:gap-16`}>
      {imageBlock}
      {textBlock}
    </div>
  )
}
