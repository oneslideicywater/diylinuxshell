import type { Metadata } from "next"
import Link from "next/link"
import { Monitor, Apple, Cpu, CheckCircle2, ExternalLink } from "lucide-react"

export const metadata: Metadata = {
  title: "下载安装",
  description:
    "免费下载 DIY-Linux-Shell，支持 Windows (NSIS/Portable)、macOS (DMG)、Linux (AppImage/deb/rpm) 全平台。",
}

/* 下载平台数据 — 精确对齐 README 打包格式 */
const platforms = [
  {
    name: "Windows",
    icon: Monitor,
    formats: [".exe NSIS 安装包（含安装向导）", ".exe Portable 便携版（免安装）"],
    requirements: "Windows 10+ · x64",
    outputDir: "release/",
    color: "from-blue-500 to-blue-600 hover:shadow-blue-500/25",
  },
  {
    name: "macOS",
    icon: Apple,
    formats: [".dmg 磁盘映像（x64 + Apple Silicon）"],
    requirements: "macOS 10.15+ · Universal Binary",
    outputDir: "release/",
    color: "from-gray-700 to-gray-900 hover:shadow-gray-500/25",
  },
  {
    name: "Linux",
    icon: Cpu,
    formats: [".AppImage 通用包", ".deb Debian/Ubuntu 系列", ".rpm RHEL/Fedora 系列"],
    requirements: "主流发行版 · x64",
    outputDir: "release/",
    color: "from-orange-500 to-orange-600 hover:shadow-orange-500/25",
  },
]

/* 下载页面 */
export default function DownloadPage() {
  return (
    <div className="light-content pt-24 pb-20 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-primary-500 font-mono uppercase tracking-wider mb-3">
            Download
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
              style={{ color: '#0f172a' }}>
            免费下载
          </h1>
          <p className="text-lg text-ink-secondary max-w-lg mx-auto"
             style={{ color: '#475569' }}>
            Apache 2.0 开源协议，全平台支持。
            选择适合你操作系统的版本即可开始使用。
          </p>
        </div>

        {/* 下载卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {platforms.map((platform) => (
            <div
              key={platform.name}
              className="group relative rounded-xl border border-border-default bg-surface p-6
                        shadow-card hover:shadow-card-hover hover:-translate-y-1
                        transition-all duration-250"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-lg bg-primary-50 flex items-center justify-center">
                  <platform.icon className="w-5 h-5 text-primary-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-ink">{platform.name}</h3>
                  <p className="text-xs text-ink-tertiary">{platform.requirements}</p>
                </div>
              </div>

              <ul className="space-y-2 mb-6">
                {platform.formats.map((fmt) => (
                  <li key={fmt} className="flex items-center gap-2 text-sm text-ink-secondary">
                    <CheckCircle2 className="w-4 h-4 text-success-500 flex-shrink-0" />
                    {fmt}
                  </li>
                ))}
              </ul>

              <a
                href="https://gitee.com/oneslideicywater/diy-linux-shell/releases"
                target="_blank"
                rel="noopener noreferrer"
                className={`block w-full text-center py-2.5 rounded-lg font-semibold text-sm text-white
                           bg-gradient-to-r ${platform.color} shadow-md
                           transition-all duration-200 cursor-pointer`}
              >
                下载 {platform.name} 版本
              </a>
            </div>
          ))}
        </div>

        {/* 系统要求 — 对齐 README 环境要求 */}
        <div className="rounded-xl border border-border-default bg-surface-subtle p-8">
          <h2 className="text-xl font-bold text-ink mb-6">环境要求</h2>
          <div className="grid sm:grid-cols-2 gap-6 text-sm">
            <div>
              <h3 className="font-semibold text-ink mb-2">运行环境</h3>
              <ul className="space-y-1.5 text-ink-secondary">
                <li>· 操作系统：Windows 10+ / macOS 10.15+ / 主流 Linux 发行版</li>
                <li>· 架构：x64（ARM64 部分支持）</li>
                <li>· 磁盘空间：约 200 MB 可用空间</li>
                <li>· 内存：建议 4 GB 以上</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-ink mb-2">快速上手</h3>
              <ol className="space-y-1.5 text-ink-secondary list-decimal pl-4">
                <li>从 Gitee / GitHub Releases 下载对应平台的安装包</li>
                <li>运行安装程序（Windows 可直接打开 Portable 便携版）</li>
                <li>启动应用，添加你的第一个 SSH 连接</li>
                <li>开始享受高效的远程服务器管理体验 ✨</li>
              </ol>
            </div>
          </div>
        </div>

        {/* 其他获取方式 — 对齐 README 克隆地址 */}
        <div className="mt-10 space-y-4">
          <div className="text-center">
            <p className="text-sm text-ink-tertiary mb-3">其他获取方式</p>
            <div className="flex justify-center gap-4 flex-wrap">
              <a
                href="https://gitee.com/oneslideicywater/diy-linux-shell"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary-500
                           hover:text-primary-600 cursor-pointer transition-colors duration-200"
              >
                Gitee 仓库 <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <span className="text-ink-tertiary">|</span>
              <a
                href="https://github.com/oneslideicywater/diy-linux-shell"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary-500
                           hover:text-primary-600 cursor-pointer transition-colors duration-200"
              >
                GitHub 仓库 <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <span className="text-ink-tertiary">|</span>
              <Link href="/docs" className="text-sm text-primary-500 hover:text-primary-600
                                         cursor-pointer transition-colors duration-200">
                查看文档
              </Link>
            </div>
          </div>

          {/* 开发者模式提示 */}
          <div className="rounded-xl border border-dashed border-border-default p-5 text-center">
            <p className="text-sm text-ink-secondary">
              🛠 开发者？可以克隆源码自行构建：
            </p>
            <code className="mt-2 inline-block px-4 py-2 rounded-lg bg-surface text-xs font-mono text-ink-secondary
                           border border-border-default">
              git clone https://gitee.com/oneslideicywater/diy-linux-shell.git &amp;&amp; cd diy-linux-shell &amp;&amp; npm install &amp;&amp; npm run dev
            </code>
          </div>
        </div>
      </div>
    </div>
  )
}
