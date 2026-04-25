import Link from "next/link"
import { Terminal, Heart } from "lucide-react"

/* 页脚组件 */
export function Footer() {
  const currentYear = new Date().getFullYear()

  const footerLinks = {
    product: [
      { href: "/features", label: "功能介绍" },
      { href: "/download", label: "下载安装" },
      { href: "/screenshots", label: "产品截图" },
    ],
    resources: [
      { href: "/docs", label: "文档中心" },
      { href: "https://github.com/oneslideicywater/diy-linux-shell/releases", label: "更新日志" },
      { href: "https://github.com/oneslideicywater/diy-linux-shell/issues", label: "问题反馈" },
    ],
    community: [
      { href: "https://github.com/oneslideicywater/diy-linux-shell", label: "GitHub" },
      { href: "https://github.com/oneslideicywater/diy-linux-shell/discussions", label: "讨论区" },
    ],
  }

  return (
    <footer className="bg-ink text-white/[0.9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* 品牌信息 */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4 cursor-pointer">
              <Terminal className="w-5 h-5 text-primary-400" />
              <span className="font-mono font-bold text-base tracking-tight">DIY-Linux-Shell</span>
            </Link>
            <p className="text-sm text-white/[0.6] leading-relaxed max-w-xs">
              现代化的 SSH 终端管理工具，为开发者和运维人员打造的高效远程管理体验。
            </p>
          </div>

          {/* 产品链接 */}
          <div>
            <h3 className="font-semibold text-sm mb-3 text-white/[0.8]">产品</h3>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/[0.55] hover:text-white/[0.85] transition-colors duration-200 cursor-pointer"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 资源链接 */}
          <div>
            <h3 className="font-semibold text-sm mb-3 text-white/[0.8]">资源</h3>
            <ul className="space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white/[0.55] hover:text-white/[0.85] transition-colors duration-200 cursor-pointer"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* 社区链接 */}
          <div>
            <h3 className="font-semibold text-sm mb-3 text-white/[0.8]">社区</h3>
            <ul className="space-y-2">
              {footerLinks.community.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white/[0.55] hover:text-white/[0.85] transition-colors duration-200 cursor-pointer"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 底部版权 */}
        <div className="mt-12 pt-6 border-t border-white/[0.15] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/[0.5]">
            &copy; {currentYear} DIY-Linux-Shell. 基于 Apache 2.0 协议开源.
          </p>
          <p className="text-xs text-white/[0.5] flex items-center gap-1">
            用 <Heart className="w-3 h-3 text-red-400 inline" /> 和代码构建
          </p>
        </div>
      </div>
    </footer>
  )
}
