# DIY-Linux-Shell 产品官网 - 实现计划

## 1. 项目概述

本文档基于 [prd.md](./prd.md) 制定产品官网的详细实现计划，涵盖技术选型、项目结构、开发任务和部署方案。

---

## 2. 技术选型

### 2.1 推荐方案：Next.js (App Router) + Tailwind CSS

| 技术项 | 选型 | 理由 |
|--------|------|------|
| 框架 | Next.js 14+ (App Router) | Vercel 原生支持、SSG/SSR 灵活、SEO 友好 |
| 语言 | TypeScript | 类型安全、与主项目一致 |
| 样式 | Tailwind CSS 3.4+ | 原子化 CSS、快速开发、暗色模式内置支持 |
| 动画 | Framer Motion | 声明式动画、性能优秀 |
| 图标 | Lucide React | 轻量、Tree-shaking 友好、风格统一 |
| 部署 | Vercel | 一键部署、自动 HTTPS、CDN 加速 |
| 包管理 | pnpm | 快速、节省磁盘空间 |

### 2.2 备选方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **Next.js + Tailwind** | Vercel 最佳集成、SEO 强 | React 技术栈（与主项目 Vue 不同） | **推荐** |
| Nuxt 3 + Tailwind | Vue 生态统一、与主项目一致 | Vercel 支持稍弱于 Next.js | 团队偏好 Vue 时选择 |
| Vite + Vue + VitePress | 极简静态站 | 定制化能力受限 | 纯文档站场景 |
| Astro + Tailwind | 零 JS 默认输出、极快 | 交互能力有限 | 性能极致追求 |

> **建议采用 Next.js 方案**，因为官网是独立展示站点，与主项目（Electron 桌面应用）技术栈解耦是合理的，且 Next.js 在 Vercel 上有最佳体验。

---

## 3. 项目结构

```
website/
├── prd.md                          # 产品需求文档
├── plan.md                         # 实现计划文档
├── src/                            # 源代码目录
│   ├── app/                        # Next.js App Router 页面
│   │   ├── layout.tsx              # 根布局（Header + Footer）
│   │   ├── page.tsx                # 首页
│   │   ├── globals.css             # 全局样式
│   │   ├── features/
│   │   │   └── page.tsx            # 功能介绍页
│   │   ├── download/
│   │   │   └── page.tsx            # 下载页面
│   │   ├── screenshots/
│   │   │   └── page.tsx            # 截图展示页
│   │   ├── docs/
│   │   │   └── page.tsx            # 文档导航页
│   │   └── about/
│   │       └── page.tsx            # 关于我们页
│   ├── components/                 # 可复用组件
│   │   ├── layout/                 # 布局组件
│   │   │   ├── Header.tsx          # 导航栏
│   │   │   ├── Footer.tsx          # 页脚
│   │   │   ├── Navbar.tsx          # 导航菜单
│   │   │   └── MobileMenu.tsx      # 移动端菜单
│   │   ├── home/                   # 首页专用组件
│   │   │   ├── HeroSection.tsx     # Hero 区域
│   │   │   ├── FeatureCards.tsx    # 功能亮点卡片
│   │   │   ├── ProductShowcase.tsx # 产品截图展示
│   │   │   ├── TechStack.tsx       # 技术栈展示
│   │   │   └── CTASection.tsx      # CTA 行动召唤区
│   │   ├── features/               # 功能页专用组件
│   │   │   ├── FeatureSection.tsx  # 单个功能展示区块
│   │   │   └── FeatureComparison.tsx # 功能对比表
│   │   ├── download/               # 下载页专用组件
│   │   │   ├── DownloadCard.tsx    # 下载卡片
│   │   │   └── SystemRequirements.tsx # 系统要求
│   │   └── ui/                     # 通用 UI 组件
│   │       ├── Button.tsx          # 按钮
│   │       ├── Card.tsx            # 卡片
│   │       ├── Badge.tsx           # 徽章
│   │       ├── ThemeToggle.tsx     # 主题切换
│   │       ├── BackToTop.tsx       # 回到顶部
│   │       └── ImageWithFallback.tsx # 图片降级处理
│   ├── lib/                        # 工具函数和配置
│   │   ├── constants.ts            # 常量定义（链接、文本等）
│   │   ├── utils.ts                # 通用工具函数
│   │   └── github.ts              # GitHub API 封装
│   ├── hooks/                      # 自定义 Hooks
│   │   ├── useTheme.ts             # 主题切换 Hook
│   │   ├── useScrollSpy.ts         # 滚动监听 Hook
│   │   └── useMediaQuery.ts        # 响应式断点 Hook
│   └── types/                      # TypeScript 类型定义
│       └── index.ts
├── public/                         # 静态资源
│   ├── images/                     # 图片资源
│   │   ├── logo.svg                # 产品 Logo
│   │   ├── favicon.ico             # 网站图标
│   │   ├── og-image.png            # 社交分享图
│   │   ├── hero/                   # 首页 Hero 相关图片
│   │   ├── features/               # 功能截图
│   │   └── screenshots/            # 截图画廊图片
│   └── fonts/                      # 自定义字体（可选）
├── next.config.ts                  # Next.js 配置
├── tailwind.config.ts              # Tailwind CSS 配置
├── tsconfig.json                   # TypeScript 配置
├── package.json                    # 项目依赖
├── vercel.json                     # Vercel 部署配置（可选）
└── README.md                       # 项目说明
```

---

## 4. 实现阶段总览

| 阶段 | 名称 | 核心目标 | 预计工作量 |
|------|------|----------|------------|
| Phase 1 | 项目初始化 | 创建 Next.js 项目、配置 Tailwind、搭建基础架构 | 0.5 天 |
| Phase 2 | 布局与全局组件 | 实现 Header/Footer/主题切换/响应式导航 | 0.5 天 |
| Phase 3 | 首页开发 | Hero、功能亮点、产品展示、CTA 等核心区域 | 1 天 |
| Phase 4 | 功能介绍页 | 功能详情展示、图文交替布局 | 0.5 天 |
| Phase 5 | 下载页 | 下载卡片、系统要求、版本信息 | 0.5 天 |
| Phase 6 | 辅助页面 | 截图展示、文档导航、关于我们 | 0.5 天 |
| Phase 7 | 优化与部署 | SEO 优化、性能优化、Vercel 部署配置 | 0.5 天 |

---

## 5. 详细实现计划

### Phase 1: 项目初始化

#### 5.1.1 任务清单

| 序号 | 任务 | 产出物 | 依赖 |
|------|------|--------|------|
| 1.1 | 初始化 Next.js 项目 | package.json, next.config.ts | 无 |
| 1.2 | 配置 TypeScript | tsconfig.json | 1.1 |
| 1.3 | 安装并配置 Tailwind CSS | tailwind.config.ts, postcss.config.js | 1.1 |
| 1.4 | 安装依赖包 | framer-motion, lucide-react 等 | 1.1 |
| 1.5 | 创建目录结构 | src/ 下各目录 | 1.1 |
| 1.6 | 配置全局样式 | src/app/globals.css | 1.3 |
| 1.7 | 配置主题色和暗色模式 | tailwind.config.ts 扩展 | 1.3 |

#### 5.1.2 具体执行步骤

```bash
# Step 1: 创建 Next.js 项目
cd website
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Step 2: 安装额外依赖
pnpm add framer-motion lucide-react

# Step 3: 创建目录结构
mkdir -p src/components/{layout,home,features,download,ui}
mkdir -p src/{lib,hooks,types}
mkdir -p public/images/{hero,features,screenshots}
```

---

### Phase 2: 布局与全局组件

#### 5.2.1 任务清单

| 序号 | 任务 | 产出物 | 依赖 |
|------|------|--------|------|
| 2.1 | 实现 Header 组件 | src/components/layout/Header.tsx | Phase 1 |
| 2.2 | 实现 Footer 组件 | src/components/layout/Footer.tsx | Phase 1 |
| 2.3 | 实现根布局 | src/app/layout.tsx | 2.1, 2.2 |
| 2.4 | 实现主题切换 | src/components/ui/ThemeToggle.tsx + hooks/useTheme.ts | Phase 1 |
| 2.5 | 实现移动端响应式菜单 | src/components/layout/MobileMenu.tsx | 2.1 |
| 2.6 | 实现回到顶部按钮 | src/components/ui/BackToTop.tsx | Phase 1 |

#### 5.2.2 关键实现要点

**Header 组件需求**：
- 固定定位 `fixed top-0`
- 滚动时添加背景模糊效果 (`backdrop-blur`) 和阴影
- 导航链接：首页 / 功能 / 下载 / 截图 / 文档 / 关于
- 右侧操作区：GitHub Star 按钮 / 主题切换 / 下载按钮
- 移动端显示汉堡菜单

**Footer 组件需求**：
- 多列布局：产品 / 资源 / 社区 / 法律
- 版权信息
- 社交媒体图标链接

**暗色模式实现策略**：
```typescript
// 使用 next-themes 库或自定义 Provider
// tailwind.config.ts 中配置 darkMode: 'class'
// 通过 HTML 元素的 class='dark' 切换
```

---

### Phase 3: 首页开发

#### 5.3.1 任务清单

| 序号 | 任务 | 产出物 | 依赖 |
|------|------|--------|------|
| 3.1 | 实现 HeroSection | src/components/home/HeroSection.tsx | Phase 2 |
| 3.2 | 实现 FeatureCards | src/components/home/FeatureCards.tsx | Phase 2 |
| 3.3 | 实现 ProductShowcase | src/components/home/ProductShowcase.tsx | Phase 2 |
| 3.4 | 实现 TechStack 展示 | src/components/home/TechStack.tsx | Phase 2 |
| 3.5 | 实现 CTASection | src/components/home/CTASection.tsx | Phase 2 |
| 3.6 | 组装首页 | src/app/page.tsx | 3.1-3.5 |

#### 5.3.2 各区域设计说明

**HeroSection**：
- 大标题：「DIY-Linux-Shell」+ 副标题「现代化的 SSH 终端管理工具」
- 核心卖点列表（3 条）：多会话管理 / SFTP 文件传输 / 跨平台支持
- 双 CTA 按钮：「立即下载」主按钮 + 「查看文档」次按钮
- 背景：渐变色或网格图案，可加微动画

**FeatureCards（4 个核心功能）**：
| 卡片 | 标题 | 图标 | 描述 |
|------|------|------|------|
| 1 | 多会话管理 | Terminal | 同时管理多个 SSH 连接，标签页高效切换 |
| 2 | SFTP 文件传输 | FolderUp | 双栏浏览器、批量传输、实时进度可视化 |
| 3 | 会话分组 | FolderTree | 多级嵌套分组，灵活组织连接 |
| 4 | 跨平台支持 | Monitor | Windows / Linux / macOS 全平台覆盖 |

**ProductShowcase**：
- 主界面大截图（带圆角阴影装饰效果）
- 可使用 Framer Motion 做入场动画（淡入 + 上移）

**TechStack**：
- 技术栈图标横向排列：Electron / Vue 3 / TypeScript / xterm.js / Element Plus / Pinia
- 悬停时显示名称 tooltip

**CTASection**：
- 简洁背景 + 大字号召文案
- GitHub Star 按钮 + 下载按钮

---

### Phase 4: 功能介绍页

#### 5.4.1 任务清单

| 序号 | 任务 | 产出物 | 依赖 |
|------|------|--------|------|
| 4.1 | 实现 FeatureSection 组件 | src/components/features/FeatureSection.tsx | Phase 2 |
| 4.2 | 组装功能介绍页 | src/app/features/page.tsx | 4.1 |

#### 5.4.2 页面内容规划

功能介绍页包含以下模块（每个模块一个 FeatureSection）：

| 序号 | 功能模块 | 核心卖点 | 配图建议 |
|------|----------|----------|----------|
| 1 | 终端管理 | 多 Tab 会话、xterm.js 高性能终端、自定义字体/光标/缓冲区 | 多标签页界面截图 |
| 2 | SFTP 文件传输 | 双栏浏览器、批量上传下载、树形进度展示、多 Tab 支持 | SFTP 传输界面截图 |
| 3 | 会话组织 | 多级嵌套分组（最多5级）、快速筛选查找 | 分组侧边栏截图 |
| 4 | 体验优化 | 深浅主题切换、自动重连、数据持久化、跨平台 | 设置界面或主题切换截图 |

每个 FeatureSection 采用 **左图右文 / 右图左文交替布局**，使用 Framer Motion 做滚动触发的入场动画。

---

### Phase 5: 下载页

#### 5.5.1 任务清单

| 序号 | 任务 | 产出物 | 依赖 |
|------|------|--------|------|
| 5.1 | 实现 DownloadCard 组件 | src/components/download/DownloadCard.tsx | Phase 2 |
| 5.2 | 实现 SystemRequirements 组件 | src/components/download/SystemRequirements.tsx | Phase 2 |
| 5.3 | 组装下载页 | src/app/download/page.tsx | 5.1, 5.2 |

#### 5.5.2 页面内容

**DownloadCard - 三个平台下载入口**：

| 平台 | 图标 | 按钮文字 | 链接目标 |
|------|------|----------|----------|
| Windows | 🪟 | 下载 for Windows (.exe) | GitHub Release → xxx-setup-x.x.x.exe |
| macOS | 🍎 | 下载 for macOS (.dmg) | GitHub Release → xxx-x.x.x.dmg |
| Linux | 🐧 | 下载 for Linux (.AppImage) | GitHub Release → xxx-x.x.x.AppImage |

> 注：下载链接指向 GitHub Releases 页面，由用户自行选择版本下载

**SystemRequirements 内容**：

| 项目 | 要求 |
|------|------|
| 操作系统 | Windows 10+ / macOS 10.15+ /主流 Linux 发行版 |
| 架构 | x64 / arm64 (Apple Silicon) |

**安装简要步骤**（3 步以内）：
1. 下载对应平台安装包
2. 运行安装程序
3. 启动并添加 SSH 连接

---

### Phase 6: 辅助页面

#### 5.6.1 任务清单

| 序号 | 任务 | 产出物 | 依赖 |
|------|------|--------|------|
| 6.1 | 截图展示页 | src/app/screenshots/page.tsx | Phase 2 |
| 6.2 | 文档导航页 | src/app/docs/page.tsx | Phase 2 |
| 6.3 | 关于我们页 | src/app/about/page.tsx | Phase 2 |

#### 5.6.2 各页面说明

**截图展示页 (/screenshots)**：
- 图片网格/瀑布流布局
- 分类标签筛选（全部 / 终端 / SFTP / 设置 / 其他）
- 点击放大 Lightbox 效果（可用 react-medium-image-zoom 或自实现）

**文档导航页 (/docs)**：
- 卡片式链接布局，跳转到外部文档
- 链接列表：
  - 快速开始指南 → GitHub README
  - API 文档 → （如有独立文档站）
  - 更新日志 → GitHub Releases
  - 常见问题 → GitHub Issues/Discussions
  - 贡献指南 → GitHub CONTRIBUTING.md

**关于我们页 (/about)**：
- 产品简介
- 开源协议信息（MIT / Apache 2.0）
- 致谢/贡献者列表
- 联系方式（GitHub Issues / Email）

---

### Phase 7: 优化与部署

#### 5.7.1 任务清单

| 序号 | 任务 | 产出物 | 依赖 |
|------|------|--------|------|
| 7.1 | SEO Meta 标签优化 | 各页面 metadata export | Phase 3-6 |
| 7.2 | Open Graph 配置 | og-image.png + metadata | 7.1 |
| 7.3 | 图片优化 | WebP 格式转换、next/image 配置 | Phase 3-6 |
| 7.4 | Sitemap 生成 | src/app/sitemap.ts | Phase 2 |
| 7.5 | robots.txt 配置 | src/app/robots.ts | Phase 2 |
| 7.6 | Vercel 部署配置 | vercel.json | Phase 1 |
| 7.7 | 性能测试与调优 | Lighthouse 报告 | 7.1-7.6 |

#### 5.7.2 Vercel 部署方案

**方式一：Vercel CLI 部署（推荐首次使用）**
```bash
# 安装 Vercel CLI
pnpm add -D vercel

# 登录并部署
npx vercel

# 生产环境部署
npx vercel --prod
```

**方式二：GitHub 集成部署（推荐持续使用）**
1. 将 website 目录作为独立 Git 仓库（或 monorepo 子目录）
2. 在 Vercel Dashboard 导入项目
3. 配置：
   - Framework Preset: Next.js
   - Build Command: `pnpm build`
   - Output Directory: `.next`
   - Install Command: `pnpm install`
4. 每次 push 到 main 分支自动部署

**vercel.json 配置示例**：
```json
{
  "framework": "nextjs",
  "headers": [
    {
      "source": "/images/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

#### 5.7.3 SEO metadata 实现示例

```typescript
// src/app/layout.tsx
export const metadata: Metadata = {
  title: {
    default: 'DIY-Linux-Shell - 现代化 SSH 终端管理工具',
    template: '%s | DIY-Linux-Shell',
  },
  description: '一款基于 Electron + Vue 3 的现代化 SSH 终端管理工具，提供多会话管理、SFTP 文件传输、终端分屏等核心功能。',
  keywords: ['SSH', '终端', 'Terminal', 'SFTP', 'Linux', 'Electron', 'Vue'],
  authors: [{ name: 'DIY-Linux-Shell Team' }],
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: 'https://diy-linux-shell.vercel.app',
    siteName: 'DIY-Linux-Shell',
    images: ['/images/og-image.png'],
  },
}
```

---

## 6. 关键配置文件示例

### 6.1 next.config.ts

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'github.com',
      },
    ],
  },
  // 静态导出选项（如需纯静态部署）
  // output: 'export',
}

export default nextConfig
```

### 6.1b 字体加载配置（next/font）

使用 Next.js 内置的 `next/font` 优化字体加载，避免布局偏移 (CLS)：

```typescript
// src/lib/fonts.ts
import { JetBrains_Mono, IBM_Plex_Sans } from 'next/font/google'

/* JetBrains Mono - 用于品牌标题和代码 */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400', '500', '600', '700'],
})

/* IBM Plex Sans - 用于正文内容 */
export const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700'],
})
```

在 `layout.tsx` 中应用：

```tsx
// src/app/layout.tsx
import { jetbrainsMono, ibmPlexSans } from '@/lib/fonts'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${jetbrainsMono.variable} ${ibmPlexSans.variable}`}>
      <body className="font-sans bg-surface text-ink antialiased">
        {children}
      </body>
    </html>
  )
}
```

> **图片优化要点**：
> - Hero 区域截图使用 `<Image priority />` 标记 LCP 资源
> - 其他图片使用 `<Image fill className="object-cover" />` 响应式填充
> - 所有产品截图转为 WebP 格式并懒加载 (`loading="lazy"`)

### 6.2 tailwind.config.ts 扩展

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /* 浅色优先配色方案 (参考 prd.md 5.2 节) */
      colors: {
        /* 品牌主色 - 亮蓝色系 */
        primary: {
          50: '#EFF6FF',
          100: '#DDEBFF',
          200: '#BCD5FF',
          300: '#8EB3FF',
          400: '#5E8FFF',
          500: '#3370FF',
          600: '#2550E0',
          700: '#163BD6',
          800: '#0D2AB8',
          900: '#081E87',
        },
        /* CTA 绿色 - 运行成功语义 */
        success: {
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
        },
        /* 文字层级 */
        ink: {
          DEFAULT: '#1D2129',   /* 主文字 */
          secondary: '#4E5969', /* 次文字 */
          tertiary: '#86909C',  /* 辅助文字 */
        },
        /* 背景层级 */
        surface: {
          DEFAULT: '#FFFFFF',   /* 页面/卡片背景 */
          subtle: '#F7F8FA',    /* 区块交替背景 */
          muted: '#F0F0F0',     /* 分割线/禁用 */
        },
        /* 边框 */
        border: {
          DEFAULT: '#E5E7EB',
          strong: '#C9CDD4',
        },
        /* 暗色主题背景 */
        dark: {
          bg: '#0E1014',
          surface: '#1D2129',
          card: '#1E293B',
          border: '#334155',
          text: '#F8FAFC',
          'text-secondary': '#94A3B8',
        },
      },
      /* Developer Mono 字体方案 (参考 prd.md 5.3 节) */
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      /* 动效过渡 (参考 prd.md 5.5 节) */
      transitionDuration: {
        DEFAULT: '200ms',
      },
      /* 圆角 */
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
      },
      /* 阴影层次 */
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
}

export default config
```

---

## 7. 外部资源链接

| 资源 | URL |
|------|-----|
| GitHub 仓库 | https://github.com/oneslideicywater/diy-linux-shell |
| GitHub Releases | https://github.com/oneslideicywater/diy-linux-shell/releases |
| Next.js 文档 | https://nextjs.org/docs |
| Tailwind CSS 文档 | https://tailwindcss.com/docs |
| Vercel 部署文档 | https://vercel.com/docs |
| Framer Motion 文档 | https://www.framer.com/motion/ |
| Lucide 图标 | https://lucide.dev |

---

## 8. 注意事项

1. **图片资源**：所有产品截图需从运行中的 DIY-Linux-Shell 应用截取，确保展示最新 UI
2. **链接准确性**：所有外链（GitHub、Releases 等）需在上线前验证有效性
3. **内容一致性**：网站上的功能描述需与产品实际功能保持一致
4. **字体加载**：使用 `next/font` 加载 JetBrains Mono + IBM Plex Sans，优化 CLS
5. **浅色优先设计**：
   - 默认主题为浅色（亮色），暗色作为可切换选项
   - 浅色模式下确保卡片 `bg-white` 或更高透明度（避免 `bg-white/10` 这种不可见的写法）
   - 浅色模式下文字对比度 >= 4.5:1（主文字 #1D2129 在白底上满足要求）
   - 浅色模式下边框使用 `border-gray-200` 级别可见
6. **动效克制**：所有动画时长控制在 150-300ms，尊重 `prefers-reduced-motion`
7. **图标规范**：使用 Lucide React SVG 图标，禁止用 emoji 作为 UI 图标
8. **交互反馈**：所有可点击元素添加 `cursor-pointer` 和 hover 状态变化
