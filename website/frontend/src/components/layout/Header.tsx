"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, Terminal, GitBranch, Download } from "lucide-react"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { motion, AnimatePresence } from "framer-motion"

/* 导航链接配置 */
const navLinks = [
  { href: "/", label: "首页" },
  { href: "/features", label: "功能" },
  { href: "/download", label: "下载" },
  { href: "/docs", label: "文档" },
]

/* 导航栏组件 - 固定顶部，滚动后添加毛玻璃背景 */
export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  /* 监听滚动事件，超过 50px 后显示背景 */
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-surface/80 backdrop-blur-xl border-b border-border-default shadow-sm"
            : "bg-transparent"
        }`}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group cursor-pointer">
              <Terminal className="w-6 h-6 text-primary-500 transition-transform duration-200 group-hover:scale-110" />
              <span className="font-mono font-bold text-lg tracking-tight text-ink">
                DIY-Linux-Shell
              </span>
            </Link>

            {/* 桌面端导航链接 */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer ${
                    pathname === link.href
                      ? "text-primary-500 bg-primary-50"
                      : "text-ink-secondary hover:text-ink hover:bg-surface-subtle"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* 右侧操作区 */}
            <div className="hidden md:flex items-center gap-2">
              <a
                href="https://github.com/oneslideicywater/diy-linux-shell"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                           text-ink-secondary hover:text-ink hover:bg-surface-subtle transition-colors duration-200 cursor-pointer"
              >
                <GitBranch className="w-4 h-4" />
                GitHub
              </a>
              <Link
                href="/download"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold
                           bg-primary-500 text-white hover:bg-primary-600
                           transition-all duration-200 cursor-pointer hover:-translate-y-0.5"
              >
                <Download className="w-4 h-4" />
                下载
              </Link>
              <ThemeToggle />
            </div>

            {/* 移动端汉堡菜单按钮 */}
            <button
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg
                         text-ink-secondary hover:text-ink hover:bg-surface-subtle
                         transition-colors duration-200 cursor-pointer"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="打开菜单"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>
      </header>

      {/* 移动端菜单抽屉 */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 md:hidden"
          >
            {/* 遮罩层 */}
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />

            {/* 菜单面板 */}
            <div className="absolute top-16 left-4 right-4 bg-surface rounded-xl border border-border-default
                        shadow-card-hover p-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer ${
                    pathname === link.href
                      ? "text-primary-500 bg-primary-50"
                      : "text-ink-secondary hover:text-ink hover:bg-surface-subtle"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <hr className="border-border-default my-2" />
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-sm text-ink-tertiary">主题</span>
                <ThemeToggle />
              </div>
              <Link
                href="/download"
                onClick={() => setMobileOpen(false)}
                className="block text-center px-4 py-2.5 rounded-lg text-sm font-semibold
                           bg-primary-500 text-white hover:bg-primary-600
                           transition-colors duration-200 cursor-pointer mt-2"
              >
                立即下载
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
