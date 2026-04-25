import type { Metadata } from "next"
import Link from "next/link"
import {
  GitBranch,
  Heart,
  Scale,
  Users,
  ExternalLink,
  BookOpen,
  Bug,
} from "lucide-react"

export const metadata: Metadata = {
  title: "关于我们",
  description:
    "了解 DIY-Linux-Shell 的项目背景、设计理念、开源协议和参与贡献方式。基于 Electron + Vue 3 + TypeScript 构建的现代化 SSH 终端管理工具。",
}

/* 关于页面 */
export default function AboutPage() {
  return (
    <div className="pt-24 pb-20 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-primary-500 font-mono uppercase tracking-wider mb-3">
            About
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            关于 DIY-Linux-Shell
          </h1>
          <p className="text-lg text-ink-secondary max-w-lg mx-auto">
            一个为开发者和运维人员打造的
            <br className="hidden sm:block" />
            现代化 SSH 终端管理工具
          </p>
        </div>

        {/* 项目简介 — 对齐 README 项目简介 */}
        <div className="rounded-xl border border-border-default bg-surface p-8 shadow-card mb-10">
          <div className="flex items-start gap-4">
            <GitBranch className="w-6 h-6 text-primary-500 flex-shrink-0 mt-1" />
            <div>
              <h2 className="font-semibold text-xl text-ink mb-3">项目简介</h2>
              <p className="text-sm text-ink-secondary leading-relaxed">
                DIY-Linux-Shell 是一款基于{" "}
                <span className="font-mono font-medium text-primary-500">Electron + Vue 3 + TypeScript</span>{" "}
                构建的现代化 SSH 终端管理工具。
                它旨在为开发者和运维人员提供一种高效、便捷的方式来管理和操作远程 Linux 服务器，
                同时支持多会话终端、SFTP 文件传输、会话分组管理等核心功能。
              </p>
              <p className="text-sm text-ink-secondary leading-relaxed mt-3">
                项目采用 Apache 2.0 开源协议发布，支持 Windows、macOS 和 Linux 三大主流操作系统。
                目前已通过全部基础测试，各平台安装包正在陆续上传中。
              </p>
            </div>
          </div>
        </div>

        {/* 设计理念 */}
        <div className="grid sm:grid-cols-2 gap-5 mb-10">
          <div className="flex items-start gap-4 p-6 rounded-xl border border-border-default bg-surface">
            <Heart className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-base text-ink mb-1">设计理念</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                以用户体验为核心，追求简洁直观的界面设计和流畅的交互体验。
                每一个功能都经过精心打磨，让远程服务器管理变得轻松高效。
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-6 rounded-xl border border-border-default bg-surface">
            <Users className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-base text-ink mb-1">目标用户</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                面向需要频繁连接和管理多台 Linux 服务器的开发者和运维人员，
                提供一站式远程服务器管理解决方案。
              </p>
            </div>
          </div>

          {/* 开源协议 — 对齐 README License */}
          <div className="flex items-start gap-4 p-6 rounded-xl border border-border-default bg-surface sm:col-span-2">
            <Scale className="w-6 h-6 text-primary-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-base text-ink mb-1">开源协议</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                本项目采用 <span className="font-semibold text-primary-500">Apache 2.0</span> 开源协议发布。
                你可以自由地使用、复制、修改、合并、发布、分发、再授权本软件，
                但需遵守 Apache 2.0 协议的相关条款（保留版权声明、声明修改内容等）。
              </p>
            </div>
          </div>
        </div>

        {/* 参与贡献 — 对齐 README 贡献指南 */}
        <div className="rounded-xl border border-border-default bg-surface-subtle p-8 mb-10">
          <h2 className="font-semibold text-xl text-ink mb-5">参与贡献</h2>
          <div className="space-y-4 text-sm text-ink-secondary">
            <p>
              我们非常欢迎社区贡献！无论是提交 Issue、改进文档，还是贡献代码，
              都是对项目的宝贵支持。
            </p>
            <ul className="space-y-2 pl-4 list-disc">
              <li>在 Gitee / GitHub 上提交 Issue 或 Pull Request</li>
              <li>参与功能讨论和技术方案设计</li>
              <li>完善测试用例和文档编写</li>
              <li>帮助翻译和国际化支持</li>
            </ul>
          </div>
        </div>

        {/* 快速链接 — 对齐 README 相关链接 */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <a
            href="https://gitee.com/oneslideicywater/diy-linux-shell"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 p-5 rounded-xl border border-border-default bg-surface
                       hover:border-primary-200 hover:-translate-y-0.5 hover:shadow-card-hover
                       transition-all duration-200 cursor-pointer"
          >
            <GitBranch className="w-5 h-5 text-ink-tertiary group-hover:text-primary-500 transition-colors duration-200" />
            <div>
              <p className="font-medium text-sm text-ink group-hover:text-primary-600 transition-colors duration-200">
                Gitee 仓库
              </p>
              <p className="text-xs text-ink-tertiary">源码托管（国内访问）</p>
            </div>
            <ExternalLink className="w-4 h-4 ml-auto text-ink-tertiary opacity-0 group-hover:opacity-100
                                   transition-opacity duration-200" />
          </a>

          <a
            href="https://github.com/oneslideicywater/diy-linux-shell"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 p-5 rounded-xl border border-border-default bg-surface
                       hover:border-primary-200 hover:-translate-y-0.5 hover:shadow-card-hover
                       transition-all duration-200 cursor-pointer"
          >
            <GitBranch className="w-5 h-5 text-ink-tertiary group-hover:text-primary-500 transition-colors duration-200" />
            <div>
              <p className="font-medium text-sm text-ink group-hover:text-primary-600 transition-colors duration-200">
                GitHub 仓库
              </p>
              <p className="text-xs text-ink-tertiary">源码托管（国际访问）</p>
            </div>
            <ExternalLink className="w-4 h-4 ml-auto text-ink-tertiary opacity-0 group-hover:opacity-100
                                   transition-opacity duration-200" />
          </a>

          <a
            href="https://gitee.com/oneslideicywater/diy-linux-shell/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 p-5 rounded-xl border border-border-default bg-surface
                       hover:border-primary-200 hover:-translate-y-0.5 hover:shadow-card-hover
                       transition-all duration-200 cursor-pointer"
          >
            <Bug className="w-5 h-5 text-ink-tertiary group-hover:text-warning-500 transition-colors duration-200" />
            <div>
              <p className="font-medium text-sm text-ink group-hover:text-primary-600 transition-colors duration-200">
                问题反馈
              </p>
              <p className="text-xs text-ink-tertiary">提交 Bug 或功能建议</p>
            </div>
            <ExternalLink className="w-4 h-4 ml-auto text-ink-tertiary opacity-0 group-hover:opacity-100
                                   transition-opacity duration-200" />
          </a>

          <Link
            href="/docs"
            className="group flex items-center gap-3 p-5 rounded-xl border border-border-default bg-surface
                      hover:border-primary-200 hover:-translate-y-0.5 hover:shadow-card-hover
                      transition-all duration-200 cursor-pointer"
          >
            <BookOpen className="w-5 h-5 text-ink-tertiary group-hover:text-primary-500 transition-colors duration-200" />
            <div>
              <p className="font-medium text-sm text-ink group-hover:text-primary-600 transition-colors duration-200">
                使用文档
              </p>
              <p className="text-xs text-ink-tertiary">快速开始与 API 参考</p>
            </div>
          </Link>
        </div>

        {/* 技术栈概览 — 对齐 README 徽章 */}
        <div className="text-center pt-8 border-t border-border-default">
          <p className="text-xs text-ink-tertiary font-mono mb-3">
            Built with
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              "Electron 29.x",
              "Vue 3.4",
              "TypeScript 5.3",
              "xterm.js",
              "Element Plus",
              "Pinia",
              "SSH2",
            ].map((tech) => (
              <span
                key={tech}
                className="px-3 py-1 rounded-full bg-surface-subtle text-xs font-mono text-ink-secondary
                           border border-border-default"
              >
                {tech}
              </span>
            ))}
          </div>
          <p className="mt-6 text-xs text-ink-tertiary">
            © 2024 DIY-Linux-Shell · Apache 2.0 License
          </p>
        </div>
      </div>
    </div>
  )
}
