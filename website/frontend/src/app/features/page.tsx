import type { Metadata } from "next"
import { FeatureSection } from "@/components/features/FeatureSection"

export const metadata: Metadata = {
  title: "功能介绍",
  description:
    "了解 DIY-Linux-Shell 的全部功能特性：多会话终端管理、SFTP 文件传输、会话分组管理、主题切换与自动重连。",
}

/* 功能模块数据 — 精确对齐 README 功能特性章节，每项配真实截图 */
const features = [
  {
    title: "终端管理",
    imageSrc: "/images/feature-terminal.png",
    description:
      "同时管理多个 SSH 连接，标签页高效切换。基于 xterm.js 的高性能终端模拟器，支持自定义字体、光标样式和滚动缓冲区大小。完美兼容 vi/vim、top、htop 等交互式终端应用。SSH 与 SFTP 一键无缝切换，共享同一套标签栏体系。",
    highlights: [
      "多 Tab 会话，同时连接并管理多台服务器",
      "xterm.js 高性能渲染，流畅无延迟",
      "自定义字体、光标样式、颜色主题",
      "自适应窗口尺寸，自动同步 PTY 大小",
      "SSH/SFTP 一键切换，统一标签栏管理",
    ],
    icon: "terminal" as const,
    align: "left" as const,
  },
  {
    title: "SFTP 文件传输",
    imageSrc: "/images/feature-sftp.png",
    description:
      "内置 SFTP 文件传输功能，双栏浏览器并排展示本地与远程文件系统。支持文件和文件夹的批量上传下载，实时进度可视化，以树形结构展示文件夹内每个文件的传输状态。SFTP 会话同样支持多标签页，与 SSH 终端无缝协作。",
    highlights: [
      "双栏文件浏览器（本地 / 远程并排浏览）",
      "批量上传下载文件和文件夹",
      "树形进度可视化展示每个文件的传输状态",
      "多 Tab 管理 SFTP 会话，独立传输队列",
      "与 SSH 终端共享标签栏，一键切换",
    ],
    icon: "folder" as const,
    align: "right" as const,
  },
  {
    title: "会话分组管理",
    imageSrc: "/images/feature-group.png",
    description:
      "支持多级嵌套分组（最多 5 级），按项目、环境或团队灵活组织你的 SSH 连接。默认分组始终置顶显示，方便快速访问常用连接。侧边栏可拖拽调整宽度，右键快捷菜单操作，让大量会话也能井井有条。",
    highlights: [
      "多级嵌套分组（最多 5 级）",
      "默认分组始终置顶显示",
      "右键快捷菜单操作（编辑/删除/复制等）",
      "侧边栏可拖拽调整宽度",
      "按项目或环境灵活组织连接",
    ],
    icon: "tree" as const,
    align: "left" as const,
  },
  {
    title: "体验优化 & 跨平台",
    imageSrc: "/images/feature-theme.png",
    description:
      "深色/浅色主题一键切换，可选择跟随系统偏好或手动设置。基于 electron-store 的数据持久化存储方案，会话配置、分组信息加密保存不丢失。可配置的断线自动重连策略，网络恢复后自动重新连接。一次开发，完美支持 Windows、Linux、macOS 三大主流操作系统。",
    highlights: [
      "深色 / 浅色主题切换（跟随系统或手动）",
      "electron-store 数据持久化存储",
      "可配置的断线自动重连策略",
      "Windows 10+ / macOS / Linux 全平台覆盖",
      "NSIS 安装包 + Portable 便携版（Windows）",
    ],
    icon: "settings" as const,
    align: "right" as const,
  },
]

/* 功能介绍页面 */
export default function FeaturesPage() {
  return (
    <div className="pt-24 pb-20">
      {/* 页面标题 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16 text-center">
        <p className="text-sm font-medium text-primary-500 font-mono uppercase tracking-wider mb-3">
          Features
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          强大而简洁的功能设计
        </h1>
        <p className="text-lg text-ink-secondary max-w-2xl mx-auto">
          从终端管理到文件传输，每一个功能都经过精心打磨，
          <br className="hidden sm:block" />
          只为让你更高效地管理远程服务器
        </p>
      </div>

      {/* 功能详情列表 — 每项配真实产品截图 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-32">
        {features.map((feature) => (
          <FeatureSection key={feature.title} {...feature} />
        ))}
      </div>
    </div>
  )
}
