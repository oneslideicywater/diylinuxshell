"use client"

import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { useEffect, useState } from "react"

/* 主题切换按钮 - 支持亮色/暗色切换 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  /* 避免 SSR 水合不匹配 */
  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="w-9 h-9" />

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="relative w-9 h-9 flex items-center justify-center rounded-lg
                 text-ink-tertiary hover:text-primary-500 hover:bg-surface-subtle
                 transition-colors duration-200 cursor-pointer"
      aria-label={theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
    >
      {theme === "dark" ? (
        <Sun className="w-[18px] h-[18px]" />
      ) : (
        <Moon className="w-[18px] h-[18px]" />
      )}
    </button>
  )
}
