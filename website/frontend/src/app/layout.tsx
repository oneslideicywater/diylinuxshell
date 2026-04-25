import type { Metadata } from "next"
import { jetbrainsMono, ibmPlexSans } from "@/lib/fonts"
import { ThemeProvider } from "@/components/ui/ThemeProvider"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "DIY-Linux-Shell - 现代化 SSH 终端管理工具",
    template: "%s | DIY-Linux-Shell",
  },
  description:
    "一款基于 Electron + Vue 3 的现代化 SSH 终端管理工具，提供多会话管理、SFTP 文件传输、终端分屏等核心功能。",
  keywords: ["SSH", "终端", "Terminal", "SFTP", "Linux", "Electron", "Vue"],
  authors: [{ name: "DIY-Linux-Shell Team" }],
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "DIY-Linux-Shell",
    images: ["/images/og-image.png"],
  },
}

/* 根布局 - 包含字体、主题、Header、Footer */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${jetbrainsMono.variable} ${ibmPlexSans.variable}`}
    >
      <body className="min-h-screen flex flex-col font-sans bg-surface text-ink antialiased">
        <ThemeProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  )
}
