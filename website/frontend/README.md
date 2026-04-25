# DIY-Linux-Shell 官方网站

> 现代化 SSH 终端管理工具的产品介绍官网 — 基于 Next.js + Tailwind CSS 构建

## 🌐 在线预览

[https://diy-linux-shell.vercel.app](https://diy-linux-shell.vercel.app)（待部署）

## ✨ 功能特性

- **首页** — Hero 区域、功能亮点 Bento Grid、产品截图展示、技术栈标签、CTA 行动召唤
- **功能页** — 四大核心模块详细介绍（多会话终端 / SFTP 传输 / 分组管理 / 体验优化）
- **下载页** — Windows / macOS / Linux 三平台下载入口、系统要求说明
- **截图页** — 分类展示产品界面截图
- **文档中心** — 快速开始、更新日志、问题反馈、FAQ 导航
- **关于我们** — 项目简介、设计理念、开源协议、参与贡献
- **深色/浅色主题** — 一键切换，跟随系统偏好
- **响应式设计** — 移动端适配，毛玻璃导航栏滚动效果

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | [Next.js 16](https://nextjs.org) (App Router, Webpack) |
| 语言 | TypeScript (strict mode) |
| 样式 | [Tailwind CSS v4](https://tailwindcss.com) (CSS-first 配置) |
| 动画 | [Framer Motion](https://www.framer.com/motion/) |
| 图标 | [Lucide React](https://lucide.dev) v1.x |
| 主题 | [next-themes](https://github.com/pacocoursey/next-themes) |
| 字体 | JetBrains Mono (标题/代码) + IBM Plex Sans (正文) |

## 📁 项目结构

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router 页面
│   │   ├── layout.tsx          # 根布局 (字体 + ThemeProvider + Header + Footer)
│   │   ├── page.tsx            # 首页
│   │   ├── globals.css         # 全局样式 & 设计 Token (Tailwind v4 @theme)
│   │   ├── features/page.tsx   # 功能介绍
│   │   ├── download/page.tsx   # 下载安装
│   │   ├── screenshots/page.tsx # 产品截图
│   │   ├── docs/page.tsx       # 文档导航
│   │   └── about/page.tsx      # 关于项目
│   ├── components/
│   │   ├── home/               # 首页专用组件
│   │   │   ├── HeroSection.tsx      # 首屏大图区域
│   │   │   ├── FeatureCards.tsx     # Bento Grid 功能卡片
│   │   │   ├── ProductShowcase.tsx  # 产品界面预览
│   │   │   ├── TechStack.tsx        # 技术栈标签云
│   │   │   └── CTASection.tsx       # 底部行动召唤
│   │   ├── layout/             # 布局组件
│   │   │   ├── Header.tsx           # 固定顶部导航栏
│   │   │   └── Footer.tsx           # 全局页脚
│   │   ├── features/           # 功能页组件
│   │   │   └── FeatureSection.tsx   # 左右交替详情区块
│   │   └── ui/                 # 基础 UI 组件
│   │       ├── ThemeProvider.tsx    # next-themes 封装
│   │       └── ThemeToggle.tsx      # 亮/暗模式切换按钮
│   └── lib/
│       └── fonts.ts            # Google Fonts 配置
├── public/                     # 静态资源 (图片等)
├── next.config.ts              # Next.js 配置
├── tsconfig.json               # TypeScript 配置
├── package.json                # 项目依赖
└── tailwind.config.ts          # Tailwind CSS 配置
```

## 🎨 设计系统

### 色彩 Token (浅色优先)

| 用途 | 变量名 | 色值 |
|------|--------|------|
| 品牌主色 | `--color-primary-500` | `#3370FF` |
| CTA 绿色 | `--color-success-500` | `#22C55E` |
| 主文字 | `--color-ink` | `#1D2129` |
| 次文字 | `--color-ink-secondary` | `#4E5969` |
| 卡片背景 | `--color-surface` | `#FFFFFF` |
| 区域背景 | `--color-surface-subtle` | `#F7F8FA` |
| 边框默认 | `--color-border-default` | `#E5E7EB` |

### 字体层级

- **品牌/代码**: `JetBrains Mono` (`--font-mono`) — 用于 Logo、代码块、标签
- **正文内容**: `IBM Plex Sans` (`--font-sans`) — 用于段落、标题、UI 文本

## 🚀 快速开始

### 环境要求

- Node.js >= 18.17
- npm >= 9 (或 pnpm / yarn)

### 安装依赖

```bash
cd website/frontend
npm install
```

### 启动开发服务器

> ⚠️ Windows 平台需使用 Webpack 模式（Turbopack 暂不支持 win32/x64）

```bash
npm run dev
# 或显式指定 webpack:
npx next dev --webpack -p 3000
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000)

### 构建生产版本

```bash
npx next build --webpack
npx next start --webpack -p 3000
```

## 📦 部署到 Vercel

1. Fork 本仓库或连接 GitHub 仓库
2. 在 [Vercel](https://vercel.com) 中导入项目
3. 设置 Root Directory 为 `website/frontend`
4. Build Command 保持默认 `next build`
5. 点击 Deploy

> 💡 Vercel 会自动检测 Next.js 项目并配置最佳构建参数。

## 🔧 开发注意事项

- 所有页面组件遵循 App Router 约定（Server Component 默认，交互部分 `"use client"`）
- 图标使用 `lucide-react`，注意 v1.x 已移除部分图标（如 `Github` → 使用 `GitBranch`）
- 新增页面后记得在 `Header.tsx` 的 `navLinks` 数组中添加导航链接
- 设计 Token 统一定义在 `globals.css` 的 `@theme inline` 块中
- 修改全局样式前请确认是否已有对应的 Token 可复用

## 📄 License

MIT — 详见 [LICENSE](../../LICENSE) 文件

## 🙏 致谢

- [Next.js](https://nextjs.org) — React 全栈框架
- [Tailwind CSS](https://tailwindcss.com) — 原子化 CSS 工具
- [Lucide](https://lucide.dev) — 开源图标库
- [Framer Motion](https://www.framer.com/motion/) — React 动画库
