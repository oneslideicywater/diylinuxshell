import type { Metadata } from "next"
import Link from "next/link"
import { BookOpen, GitBranch, FileText, MessageCircle, HelpCircle, ExternalLink } from "lucide-react"

export const metadata: Metadata = {
  title: "文档中心",
  description: "DIY-Linux-Shell 文档中心，包含快速开始指南、API 文档和常见问题。",
}

/* 文档链接数据 */
const docLinks = [
  {
    title: "快速开始指南",
    description: "从安装到第一次连接，5 分钟上手 DIY-Linux-Shell",
    href: "https://github.com/oneslideicywater/diy-linux-shell#readme",
    icon: BookOpen,
    color: "from-blue-500 to-blue-600",
    external: true,
  },
  {
    title: "更新日志 (Changelog)",
    description: "查看每个版本的更新内容和新特性",
    href: "https://github.com/oneslideicywater/diy-linux-shell/releases",
    icon: FileText,
    color: "from-green-500 to-green-600",
    external: true,
  },
  {
    title: "问题反馈",
    description: "提交 Bug 报告或功能请求，帮助项目变得更好",
    href: "https://github.com/oneslideicywater/diy-linux-shell/issues",
    icon: MessageCircle,
    color: "from-purple-500 to-purple-600",
    external: true,
  },
  {
    title: "常见问题 FAQ",
    description: "查阅常见问题的解答，快速找到你需要的答案",
    href: "https://github.com/oneslideicywater/diy-linux-shell/discussions",
    icon: HelpCircle,
    color: "from-orange-500 to-orange-600",
    external: true,
  },
]

/* 文档导航页面 */
export default function DocsPage() {
  return (
    <div className="pt-24 pb-20 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-primary-500 font-mono uppercase tracking-wider mb-3">
            Documentation
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">文档中心</h1>
          <p className="text-lg text-ink-secondary max-w-lg mx-auto">
            从入门到精通，找到你需要的一切文档资源
          </p>
        </div>

        {/* 文档卡片 */}
        <div className="space-y-4">
          {docLinks.map((doc) => (
            <a
              key={doc.title}
              href={doc.href}
              target={doc.external ? "_blank" : undefined}
              rel={doc.external ? "noopener noreferrer" : undefined}
              className="group flex items-start gap-5 p-6 rounded-xl border border-border-default
                         bg-surface shadow-card hover:shadow-card-hover hover:border-primary-200
                         transition-all duration-200 cursor-pointer hover:-translate-y-0.5"
            >
              {/* 图标 */}
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${doc.color}
                          flex items-center justify-center flex-shrink-0`}>
                <doc.icon className="w-6 h-6 text-white" />
              </div>

              {/* 内容 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-base text-ink group-hover:text-primary-600
                              transition-colors duration-200">
                    {doc.title}
                  </h3>
                  {doc.external && (
                    <ExternalLink className="w-3.5 h-3.5 text-ink-tertiary" />
                  )}
                </div>
                <p className="text-sm text-ink-secondary">{doc.description}</p>
              </div>

              {/* 箭头 */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200
                          self-center text-primary-500">
                →
              </div>
            </a>
          ))}
        </div>

        {/* GitHub 链接提示 */}
        <div className="mt-12 text-center p-6 rounded-xl bg-surface-subtle border border-border-default">
          <GitBranch className="w-6 h-6 mx-auto mb-2 text-ink-tertiary" />
          <p className="text-sm text-ink-secondary">
            所有文档均托管在{" "}
            <a
              href="https://github.com/oneslideicywater/diy-linux-shell"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-500 hover:text-primary-600 cursor-pointer"
            >
              GitHub 仓库
            </a>{" "}
            中
          </p>
        </div>
      </div>
    </div>
  )
}
