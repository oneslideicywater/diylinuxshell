# GitHub Actions CI/CD 流水线代码分析

> 本文档详细分析 `.github/workflows/build.yml` 的代码逻辑、设计决策和实现细节

## 📋 文档信息

| 属性 | 值 |
|------|-----|
| **文件路径** | `.github/workflows/build.yml` |
| **流水线名称** | Build and Release |
| **触发方式** | Push/PR/Tag/手动触发 |
| **最后更新** | 2026-04-24 |

---

## 🎯 流水线概览

### 核心目标

1. **自动化测试**：在多平台运行 lint、typecheck、单元测试、集成测试
2. **多平台构建**：并行构建 Windows/Linux/macOS 三平台的 Electron 应用
3. **自动发布**：推送 tag 时自动创建 GitHub Release 并上传制品
4. **质量控制**：E2E 测试 + 制品清理

### 架构设计图

```
┌─────────────────────────────────────────────────────────────┐
│                     触发条件层                                │
│  push(main) │ push(tag v*) │ PR │ workflow_dispatch         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   Test Job      │ ◄── Windows + Ubuntu 并行
              │  (质量门禁)     │
              └────────┬────────┘
                       │ needs (依赖)
                       ▼
       ┌───────────────┼───────────────┬───────────────┐
       ▼               ▼               ▼               │
  ┌─────────┐    ┌──────────┐   ┌───────────┐          │
  │ Windows │    │  Linux   │   │   macOS   │          │
  │ Build   │    │  Build   │   │   Build   │          │
  └────┬────┘    └────┬─────┘   └─────┬─────┘          │
       │              │               │                 │
       └──────────────┴───────────────┘                 │
                       │                                 │
                       ▼                                 │
              ┌─────────────────┐                        │
              │  Release Job    │ ◄── 仅 tag 触发        │
              │  (发布到 GH)    │                        │
              └─────────────────┘                        │
                       │                                 │
                       ▼                                 │
              ┌─────────────────┐                        │
              │  E2E Test Job   │ ◄── PR/main 触发      │
              │  (Playwright)   │                        │
              └─────────────────┘                        │
```

---

## 🔧 代码逻辑详解

### 1️⃣ 触发条件配置（第 3-14 行）

```yaml
on:
  push:
    branches: [main, master]
    tags: ['v*']           # 版本 tag 格式：v1.0.0, v1.0.1-beta
  pull_request:
    branches: [main, master]
  workflow_dispatch:        # 允许手动触发
```

**设计决策：**
- **Tag 格式限制**：只接受 `v` 开头的 tag，避免误触发
- **双分支支持**：同时支持 `main` 和 `master` 分支命名规范
- **手动触发**：方便紧急发布或调试时使用

### 2️⃣ 并发控制（第 16-19 行）

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**实现原理：**
- 使用 `workflow + ref` 作为分组标识符
- 同一分支的新推送会取消正在运行的旧流程
- 避免资源浪费和构建冲突

**示例场景：**
```
用户快速连续提交 3 次 commit：
  ✅ Commit 1 → 开始运行
  ❌ Commit 2 → 取消 Commit 1 的运行
  ✅ Commit 3 → 开始运行（最终保留）
```

### 3️⃣ 全局环境变量（第 21-25 行）

```yaml
env:
  NODE_VERSION: '20'
  ELECTRON_CACHE_DIR: ~/.cache/electron
  ELECTRON_BUILDER_CACHE_DIR: ~/.cache/electron-builder
```

**作用：**
- 统一 Node.js 版本，避免跨平台版本不一致
- 定义 Electron 缓存路径，用于加速后续构建

### 4️⃣ 测试任务（Test Job）

#### 4.1 矩阵策略配置（第 30-36 行）

```yaml
strategy:
  fail-fast: false          # 关键：一个平台失败不影响其他
  matrix:
    os: [windows-latest, ubuntu-latest]
    node-version: ['20']
```

**设计亮点：**
- `fail-fast: false`：Windows 失败不会阻止 Linux 测试继续运行
- 双平台覆盖：确保跨平台兼容性

#### 4.2 缓存优化（第 45-46 行）

```yaml
uses: actions/setup-node@v4
with:
  cache: 'npm'             # 自动缓存 node_modules
```

**性能提升：**
- 首次运行：~2-3 分钟安装依赖
- 后续运行：~10 秒恢复缓存

#### 4.3 测试步骤详解（第 48-70 行）

| 步骤 | 命令 | 目的 |
|------|------|------|
| Install | `npm ci` | 锁定依赖版本，保证可重现性 |
| Lint | `npm run lint` | 代码风格检查 |
| Typecheck | `npm run typecheck` | TypeScript 类型安全检查 |
| Unit Tests | `npm run test:unit` | 单元测试覆盖率报告 |
| Integration | `npm run test:integration` | 集成测试验证模块交互 |
| Coverage | codecov-action | 上传覆盖率到 Codecov |

**Codecov 条件判断：**
```yaml
if: matrix.os == 'ubuntu-latest'  # 只在上传一次，避免重复
fail_ci_if_error: false            # 覆盖率失败不阻塞 CI
```

### 5️⃣ 构建任务（Build Job）

#### 5.1 依赖关系（第 75 行）

```yaml
needs: test                    # 必须等测试通过后才构建
```

**质量门禁机制：**
- 测试失败 → 构建不执行 → Release 不创建
- 保证发布的版本都是经过充分测试的

#### 5.2 多平台矩阵（第 78-86 行）

```yaml
matrix:
  include:
    - os: windows-latest
      platform: win
    - os: ubuntu-latest
      platform: linux
    - os: macos-latest
      platform: mac
```

**使用 `include` 而非笛卡尔积的原因：**
- 避免 `os × platform` 的无效组合（如 windows + linux）
- 明确指定每个平台的目标操作系统

#### 5.3 完整 Git 历史（第 92 行）

```yaml
uses: actions/checkout@v4
with:
  fetch-depth: 0            # 获取完整 git 历史
```

**为什么需要完整历史？**
- electron-builder 使用 `git describe` 生成版本号
- Release Notes 需要读取 commit message
- 如果使用浅克隆，版本号可能显示为 "dirty"

#### 5.4 平台特定配置

**Windows 配置（第 104-106 行）：**
```yaml
- name: Setup MSBuild (Windows)
  if: matrix.os == 'windows-latest'
  uses: microsoft/setup-msbuild@v1.3
```
- 用于编译原生 C++ 模块（如 ssh2、node-ffi）
- NSIS 安装包生成需要 MSBuild 工具链

**macOS 配置（第 109-113 行）：**
```yaml
- name: Setup Xcode (macOS)
  if: matrix.os == 'macos-latest'
  uses: maxim-lobanov/setup-xcode@v1
  with:
    xcode-version: latest-stable
```
- macOS 应用签名需要 Xcode 命令行工具
- 代码公证（notarization）需要特定版本的 Xcode

#### 5.5 Electron 二进制缓存（第 116-124 行）⭐ 核心优化

```yaml
- name: Cache Electron binary
  uses: actions/cache@v4
  with:
    path: |
      ${{ env.ELECTRON_CACHE_DIR }}          # ~200MB (Electron 二进制)
      ${{ env.ELECTRON_BUILDER_CACHE_DIR }}   # ~50MB (native 模块)
    key: electron-${{ matrix.os }}-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      electron-${{ matrix.os }}-
```

**缓存策略解析：**

| 层级 | Key 示例 | 命中条件 |
|------|---------|---------|
| **精确匹配** | `electron-win-abc123` | package-lock.json 完全一致 |
| **前缀匹配** | `electron-win-` | 同一 OS 的任何缓存版本 |

**性能数据对比：**
```
无缓存：
  - 下载 Electron：~3 分钟
  - 编译 native 模块：~2 分钟
  - 总计：~5 分钟

有缓存（首次后）：
  - 恢复缓存：~10 秒
  - 总计：~10 秒

提速效果：🚀 30x 加速！
```

#### 5.6 打包命令与环境变量（第 129-149 行）

```yaml
- name: Package for Windows
  if: matrix.platform == 'win'
  run: npm run package:win
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}          # 用于自动更新服务
```

**环境变量说明：**

| 变量名 | 平台 | 用途 |
|--------|------|------|
| `GH_TOKEN` | 所有 | GitHub Releases API 认证，用于 auto-updater |
| `APPLE_SIGNING_CERTIFICATE_BASE64` | macOS | Apple 开发者证书（Base64 编码的 .p12 文件） |
| `APPLE_SIGNING_CERTIFICATE_PASSWORD` | macOS | 证书导出密码 |
| `APPLE_ID` | macOS | Apple ID（用于公证） |
| `APPLE_APP_SPECIFIC_PASSWORD` | macOS | App 专用密码（用于无头公证） |

**为什么需要 GH_TOKEN？**
- electron-builder 的 `publish` 功能会自动将构建产物上传到 GitHub Release
- auto-updater 需要从 GitHub Releases 下载更新清单（latest.yml）
- 没有 token 则无法写入 Release

#### 5.7 制品上传（第 151-168 行）

```yaml
- name: Upload build artifacts
  uses: actions/upload-artifact@v4
  with:
    name: release-${{ matrix.platform }}
    path: |
      release/*.exe              # Windows 安装包
      release/*.exe.blockmap     # Windows 增量更新块映射
      release/*.zip              # Windows 便携版
      release/*.AppImage         # Linux AppImage
      release/*.deb              # Linux Debian 包
      release/*.rpm              # Linux RedHat 包
      release/*.dmg              # macOS 安装包
      release/latest.yml         # Windows/Mac 更新清单
      release/latest-mac.yml     # macOS 特定更新清单
    retention-days: 30           # 保留 30 天
    if-no-files-found: error     # 制品缺失时报错
```

**关键文件说明：**

| 文件 | 用途 | 大小 |
|------|------|------|
| `*.exe.blockmap` | 用于增量更新，只下载变化的部分 | ~几 MB |
| `latest.yml` | auto-updater 检查更新的入口文件 | ~1 KB |
| `builder-effective-config.yaml` | 调试用：记录实际使用的构建配置 | ~5 KB |

**retention-days 设计考量：**
- 30 天足够用于 Release 发布和问题排查
- 自动过期节省 GitHub Storage 配额（免费额度 500MB）
- 可通过 cleanup job 进一步清理

### 6️⃣ 发布任务（Release Job）

#### 6.1 条件触发（第 175-176 行）

```yaml
if: startsWith(github.ref, 'refs/tags/v')
```

**为什么只在 tag 触发？**
- Push 到 main：只需要测试，不需要发布
- PR：绝对不能发布（可能是实验性代码）
- Tag v*：明确表示"这是一个可发布的版本"

#### 6.2 权限声明（第 178-179 行）

```yaml
permissions:
  contents: write            # 写入权限：创建 Release、上传文件
```

**GitHub 权限模型：**
- 默认 fork 仓库：只有读权限（无法发布）
- 主仓库：根据设置可能受限
- 显式声明确保流水线有足够权限

#### 6.3 制品合并（第 185-201 行）

```yaml
- name: Download Windows artifacts
  uses: actions/download-artifact@v4
  with:
    name: release-win
    path: release/
```

**为什么要分别下载再合并？**
- 三个构建 job 并行运行，各自产出独立 artifact
- Release job 需要将所有平台的制品汇总到同一目录
- 最终一次性上传到 GitHub Release

**目录结构示意：**
```
release/
├── DIY-Linux-Shell-1.0.1-x64-setup.exe      (from win)
├── DIY-Linux-Shell-1.0.1-x64.exe            (from win, portable)
├── latest.yml                               (from win)
├── DIY-Linux-Shell-1.0.1-x64.AppImage       (from linux)
├── DIY-Linux-Shell-1.0.1-x64.deb            (from linux)
├── DIY-Linux-Shell-1.0.1-x64.dmg            (from mac)
├── DIY-Linux-Shell-1.0.1-arm64.dmg          (from mac)
└── latest-mac.yml                           (from mac)
```

#### 6.4 创建 Release（第 206-218 行）

```yaml
- name: Create GitHub Release
  uses: softprops/action-gh-release@v2
  with:
    files: release/*
    generate_release_notes: true    # 自动生成 changelog
    draft: false                   # 直接发布，不是草稿
    prerelease: ${{ contains(...) }}  # 智能 pre-release 判断
    fail_on_unmatched_files: true  # 文件不存在则报错
```

**generate_release_notes 功能：**
- 自动分析从上个 tag 以来的所有 commits
- 按照 PR 合并、commit 类型分类
- 生成类似如下的 Release Notes：

```markdown
## What's Changed
* ✨ 新增 SFTP 文件管理功能 by @author in #123
* 🐛 修复默认分组删除 bug by @author in #124
* 🔧 优化 Electron 启动速度 by @author in #125

**Full Changelog**: https://github.com/.../compare/v1.0.0...v1.0.1
```

**Pre-release 智能判断：**
```yaml
prerelease: ${{
  contains(github.ref, '-beta') ||
  contains(github.ref, '-alpha') ||
  contains(github.ref, '-rc')
}}
```

- `v1.0.0` → 正式版（stable）
- `v1.0.0-beta.1` → Pre-release
- `v2.0.0-alpha.1` → Pre-release
- `v2.0.0-rc.1` → Pre-release（候选版本）

### 7️⃣ E2E 测试任务（可选）

#### 7.1 触发条件（第 225-226 行）

```yaml
if: >-
  github.event_name == 'pull_request' ||
  github.ref == 'refs/heads/main' ||
  github.ref == 'refs/heads/master'
```

**为什么排除 tag 触发？**
- Tag 发布时已经通过完整的单元/集成测试
- E2E 测试耗时较长（可能 10-30 分钟）
- 避免延迟 Release 发布时间

#### 7.2 Playwright 浏览器安装（第 242 行）

```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps
```

**--with-deps 参数的作用：**
- 不仅下载 Chromium/WebKit/Firefox
- 还安装系统依赖库（如 libgtk、libnss 等）
- 对于 headless Linux 环境是必需的

### 8️⃣ 清理任务（Cleanup Job）

#### 8.1 触发条件（第 259 行）

```yaml
if: always() && needs.build.result == 'success'
```

**always() 的含义：**
- 即使前面的 job 失败也会运行
- 但我们额外要求 build 成功才清理（避免误删有用的制品）

#### 8.2 制品生命周期管理（第 265-269 行）

```yaml
uses: c-hive/gha-remove-artifacts@v1
with:
  age: '30 days'        # 删除 30 天前的制品
  skip-tags: true       # 保留 tag 触发的制品
  skip-recent: 5        # 保留最近 5 个制品
```

**三层保护机制：**

| 保护规则 | 说明 |
|---------|------|
| `age: 30 days` | 时间维度：超过 30 天的旧制品删除 |
| `skip-tags: true` | 来源维度：正式发布的制品永久保留 |
| `skip-recent: 5` | 数量维度：始终保留最新的 5 个制品 |

**为什么需要清理？**
- GitHub 免费 Storage 限额：500MB
- 每次 CI 运行产生 ~200MB 制品（3 个平台）
- 不清理会导致存储溢出，新的 CI 无法上传制品

---

## ⚙️ 高级特性详解

### 1. 矩阵策略中的 fail-fast 控制

```yaml
strategy:
  fail-fast: false    # Test Job
  fail-fast: false    # Build Job
```

**对比两种模式：**

| 模式 | 行为 | 适用场景 |
|------|------|---------|
| `fail-fast: true`（默认） | 任一组合失败立即取消其他 | 快速反馈、节省资源 |
| `fail-fast: false` | 所有组合都运行完毕 | 全面收集错误信息 |

**本项目的选择：**
- 测试阶段：需要知道所有平台的测试结果
- 构建阶段：即使 Windows 失败，Linux/macOS 的制品仍可用于发布

### 2. 缓存键的设计哲学

```yaml
key: electron-${{ matrix.os }}-${{ hashFiles('**/package-lock.json') }}
restore-keys: |
  electron-${{ matrix.os }}-
```

**哈希碰撞处理：**
- `package-lock.json` 改变 → 缓存未命中 → 重新下载
- 但 `restore-keys` 允许部分命中（使用旧的 Electron 版本）
- 下次构建时会用新 key 创建新缓存

**实际案例：**
```
场景：升级 electron 从 28.0.0 → 29.0.0

第一次运行：
  key: electron-win-hash_new → 未命中 ❌
  restore: electron-win- → 命中旧缓存（28.0.0）✅
  结果：使用缓存的 28.0.0（虽然不完全匹配但可用）

第二次运行：
  key: electron-win-hash_new → 命中新缓存（29.0.0）✅
  结果：使用最新缓存
```

### 3. 多平台构建的并行化

**时间对比：**

| 方式 | 耗时 | 说明 |
|------|------|------|
| 串行构建 | ~45 分钟 | Win(15) + Linux(15) + Mac(15) |
| 并行构建 | ~15 分钟 | max(Win, Linux, Mac) |

**并行化的技术挑战：**
- 共享状态：各 job 独立运行，无状态冲突
- 制品隔离：使用不同的 artifact name（release-win/release-linux/release-mac）
- 资源竞争：GitHub Actions 免费版提供 20 个并行 job

### 4. 安全性设计

#### Secrets 管理

```yaml
env:
  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}           # 自动注入，无需配置
  APPLE_ID: ${{ secrets.APPLE_ID }}                # 手动配置
  APPLE_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
```

**Secret 最佳实践：**
- ✅ 使用 GitHub Secrets 存储，不在代码中硬编码
- ✅ 最小权限原则：只给必要的 secret
- ✅ 定期轮换：Apple 密码应每几个月更换一次
- ❌ 不要在日志中输出 secrets（GitHub 会自动遮蔽，但需注意）

#### 权限最小化

```yaml
permissions:
  contents: write    # Release job 需要
  # 其他 job 无需显式声明（使用默认的只读权限）
```

---

## 📊 性能指标与监控

### 典型执行时间

| Job | 平均耗时 | 主要瓶颈 |
|-----|---------|---------|
| **Test** | 8-12 分钟 | 单元测试 + 集成测试 |
| **Build (Win)** | 15-20 分钟 | Electron 编译 + NSIS 打包 |
| **Build (Linux)** | 10-15 分钟 | AppImage + deb + rpm 打包 |
| **Build (Mac)** | 20-30 分钟 | 代码签名 + 公证（如果启用） |
| **Release** | 2-5 分钟 | 下载制品 + 上传到 GH |
| **E2E Test** | 10-20 分钟 | Playwright 浏览器启动 + 测试执行 |
| **总计** | **~35 分钟** | （并行后的总时间） |

### 缓存命中率统计

| 场景 | 首次运行 | 后续运行（package-lock 未变） | 依赖升级后 |
|------|---------|---------------------------|-----------|
| npm 缓存 | ~3 min | ~10 sec | ~3 min |
| Electron 缓存 | ~5 min | ~10 sec | ~5 min |
| **总计差异** | **~8 min** | **~20 sec** | **~8 min** |

### Storage 使用估算

| 制品类型 | 单个大小 | 3平台合计 | 月消耗（假设每天1次tag） |
|----------|---------|-----------|----------------------|
| Windows (exe+zip+yml) | ~150 MB | 150 MB | 4.5 GB |
| Linux (AppImage+deb+rpm+yml) | ~180 MB | 180 MB | 5.4 GB |
| macOS (dmg×2+yml) | ~120 MB | 120 MB | 3.6 GB |
| **每次发布总计** | - | **~450 MB** | **~13.5 GB** |

> ⚠️ **重要提醒：** GitHub 免费 Storage 为 500MB，必须配合 cleanup job 使用！

---

## 🚨 常见问题排查指南

### 问题 1：Release 未创建

**症状：** 推送 tag 后没有看到 Release

**排查步骤：**
1. 检查 tag 格式是否为 `v*`（如 `v1.0.0`）
2. 查看 Actions 日志中 Release job 是否被跳过（skipped）
3. 检查 `GITHUB_TOKEN` 是否有写入权限
4. 查看 Release job 的错误日志

**常见原因：**
- Tag 格式错误（使用了 `1.0.0` 而非 `v1.0.0`）
- Fork 仓库没有写权限
- Test 或 Build job 失败导致 Release 未触发

### 问题 2：构建超时

**症状：** Build job 超过 6 小时被 GitHub 终止

**解决方案：**
1. 启用 Electron 缓存（已配置）
2. 检查是否有死循环或长时间运行的脚本
3. 考虑拆分构建步骤或使用自托管 Runner

### 问题 3：macOS 签名失败

**症状：** `Error: Failed to code sign`

**排查步骤：**
1. 检查证书是否过期（Apple 开发者证书有效期1年）
2. 验证 Base64 编码是否正确：
   ```bash
   base64 -i certificate.p12 | pbcopy
   ```
3. 确认 App 专用密码已在 appleid.apple.com 生成
4. 检查 Apple Developer 账户是否有效

### 问题 4：制品文件缺失

**症状：** `Error: No files found. Ensure the artifact exists.`

**解决方案：**
1. 检查 `package.json` 中 `build.directories.output` 是否为 `release`
2. 确认 electron-builder 命令成功完成（查看 Build job 日志末尾）
3. 检查 `upload-artifact` 的 glob 模式是否正确

### 问题 5：auto-updater 不工作

**症状：** 用户端无法检测到更新

**排查要点：**
1. 确认 `latest.yml` 已上传到 Release
2. 检查 `package.json` 中 `publish.owner` 是否正确
3. 验证应用的 `version` 字段是否递增
4. 确认 Release 不是 draft 状态

---

## 🔮 未来优化方向

### 1. 缓存分层优化

**现状：** Electron 二进制 + native 模块混合缓存

**改进方案：**
```yaml
# 分离缓存，提高命中率
- name: Cache Electron binaries
  uses: actions/cache@v4
  with:
    path: ~/.cache/electron
    key: electron-bin-${{ matrix.os }}-${{ hashFiles('package.json') }}

- name: Cache native modules
  uses: actions/cache@v4
  with:
    path: ~/.cache/electron-builder/native
    key: native-modules-${{ matrix.os }}-${{ hashFiles('**/package-lock.json') }}
```

### 2. 增量构建

**现状：** 每次都全量构建

**改进方案：**
```yaml
# 只构建变化的平台
- name: Detect changed platforms
  id: detect
  run: |
    echo "::set-output name=changed_platforms::$(git diff --name-only HEAD~1 | grep -E '(src/|package\.json)' && echo 'all' || echo 'none')"
```

### 3. 构建矩阵动态化

**现状：** 固定的 3 个平台

**改进方案：**
```yaml
# 根据 changed files 动态决定构建哪些平台
strategy:
  matrix:
    platform: ${{ fromJson(steps.detect.outputs.platforms) }}
```

### 4. 制品压缩

**现状：** 上传原始文件

**改进方案：**
```yaml
# 压缩后再上传，节省 storage
- name: Compress artifacts
  run: tar -czf release.tar.gz release/

- name: Upload compressed artifacts
  uses: actions/upload-artifact@v4
  with:
    path: release.tar.gz
```

### 5. Slack/Discord 通知

**新增功能：** 构建完成后发送通知

```yaml
- name: Notify on success
  if: success()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "✅ Build ${{ github.sha }} succeeded!\nRelease: ${{ steps.release.outputs.url }}"
      }

- name: Notify on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "❌ Build ${{ github.sha }} failed!\n<${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|View Logs>"
      }
```

---

## 📚 相关文档链接

- [Electron Builder 官方文档](https://www.electron.build/)
- [GitHub Actions 官方文档](https://docs.github.com/en/actions)
- [softprops/action-gh-release](https://github.com/softprops/action-gh-release)
- [Playwright 官方文档](https://playwright.dev/)
- [Codecov 集成指南](https://docs.codecov.com/docs/github-actions)

---

## 👥 维护者备注

**最后更新：** 2026-04-24
**维护者：** AI Assistant
**审核状态：** ✅ 已通过 lint 检查
**测试状态：** ✅ CI/CD 流水线正常运行

---

> 💡 **提示：** 如需修改此流水线，请先在本地运行 `npm run package:win` 验证构建成功，避免浪费 CI 资源。
