# DeepSeek Harness 源码学习知识库

> 一套逐知识点拆解 **DeepSeek Harness（`dsh`）** 源码的完整学习包：**34 个知识点**的 Markdown 知识库 + 零依赖纯静态学习站点 + 每日上游跟踪自动化。
>
> 基于 `deepseek-ai/deepseek-harness` @ `origin/master 21638c56`（2026-09-27，dsh 0.1.7-rc.2），本机源码：`~/Developer/projects/web-frontend/deepseek-harness`。

## 这是什么

dsh 是 DeepSeek 开源的 Agent Harness（Agent 驾驭层）：以 **Cordis** 框架为基座、以 **"Everything is a Plugin"（一切皆插件）** 为架构原则——模型适配器、工具注册表、会话日志、乃至 Agent 循环本身都是可替换的插件（54 个包组 / 312 个工作区包）。本知识库逐文件通读其源码，拆解插件基座、核心循环（turn/step 状态机、水瀑事件）、会话日志不变量、能力接缝与应用形态。

- **知识库（`knowledge-base/`）**：34 篇知识点，每篇 YAML frontmatter + 十二段正文（一句话定义 → 为什么重要 → 核心概念 → 原理机制 → 图示 → 类比 → 实例 → 误区 → 自测题 → 关系 → 延伸阅读），覆盖矩阵、七段学习路径、28 条术语表配套。
- **学习站点（`learning-site/`）**：hash 路由 SPA，视觉系统对齐 deepseek.com 官方设计（品牌蓝 #4d6bfe、近黑主按钮、玻璃分层、无纹理留白，明暗双主题）。
- **每日跟踪（`tools/`）**：自动化任务跟踪上游 `master` 与 `dsh-v*` 发布 tag，有更新则修订知识库、重建站点、并在「版本追踪」页追加时间线记录。

## 目录结构

```text
deepseek-harness-learn/
├── README.md                  ← 本文件
├── knowledge-base/            ← 知识库（Markdown，唯一事实源）
│   ├── 00-overview.md         ← 领域总览、边界、知识树
│   ├── 00-coverage-matrix.md  ← 覆盖矩阵（模块 × 知识点自检）
│   ├── 00-learning-path.md    ← 学习路径（七段航线，10–14 小时）
│   ├── 01-总览与定位/         ← kp-001 ~ kp-004
│   ├── 02-Cordis基座/         ← kp-005 ~ kp-008
│   ├── 03-Agent核心循环/      ← kp-009 ~ kp-015（源码的心脏）
│   ├── 04-会话与上下文/       ← kp-016 ~ kp-020
│   ├── 05-工具与能力接缝/     ← kp-021 ~ kp-026
│   ├── 06-应用与扩展/         ← kp-027 ~ kp-031
│   ├── 07-工程实践/           ← kp-032 ~ kp-034
│   ├── 09-版本追踪.md         ← 每日跟踪日志（结构化解析为站点时间线）
│   ├── 99-术语表.md           ← 28 条领域术语
│   └── 99-参考资料.md
├── learning-site/             ← 零依赖纯静态站点（file:// 可直接打开）
│   ├── index.html / app.js / style.css
│   ├── data.js                ← 由构建器生成（随库提交，站点自含）
│   └── favicon.svg            ← DeepSeek 官方鲸鱼标
└── tools/
    ├── build-site.mjs         ← 构建器：knowledge-base → data.js
    └── last-sync.json         ← 上游跟踪基线（commit / date / tag / KP 数）
```

## 站点功能

- **页面**：总览首页 / 学习路径 / 知识地图（SVG 依赖图）/ 术语表 / 版本追踪 / 参考资料 + 34 个知识点页；上一节/下一节与相关知识点互链。
- **搜索**：`/` 聚焦，客户端检索覆盖知识点、术语、版本记录，键盘上下选择。
- **进度**：localStorage 记录已完成知识点，顶栏进度环实时反映。
- **视觉**：DeepSeek 官方设计系统——胶囊玻璃顶栏（滚动后磨砂）、官网蓝系等级徽章（入门/核心/进阶/前沿）、浅底语法高亮代码块、整框圆角表格；明暗主题手动切换并记忆。
- **交互**：侧栏可拖拽调宽（200–440px，双击复位，持久化）；6px 悬停显现式滚动条；移动端抽屉导航。
- **版本追踪页**：由 `09-版本追踪.md` 结构化解析的时间线——每条记录含 badge、修订知识点快链、编号要点，支持 `#/changelog/e-YYYY-MM-DD` 锚点直达与搜索命中。
- **免责声明**：全站页脚标注内容由 AI 驱动生成、需仔细甄别，并提供 GitHub Issues 反馈入口。

## 如何使用

```bash
# 方式一：直接打开（无需服务）
open learning-site/index.html

# 方式二：本地服务（推荐）
cd learning-site && python3 -m http.server 8140
# 访问 http://127.0.0.1:8140

# 修改知识库后重新生成站点
node tools/build-site.mjs
```

建议入口：首页点「开始学习」按七段航线走；赶时间只读带 ★ 的承重墙知识点；开着上游仓库对照每篇页脚标注的源码路径。

## 每日上游跟踪

自动化任务每日 9:30 执行：读取 `tools/last-sync.json` 基线 → 拉取上游（stash 保护 + ff-only）→ 有更新则分析变更、按最小必要原则修订受影响知识点 → 重建站点校验 → 在 `09-版本追踪.md` 追加一条记录并更新基线。

- 跟踪范围：`origin/master` 与 `dsh-v*` 发布 tag；`dev` 等中间分支不在跟踪面内。
- `09-版本追踪.md` 尾部「格式约定」锁定了记录格式与解析器契约，追加记录时勿破坏结构。

## 部署（GitHub Pages · 自动发布）

站点公开部署在 **https://tech--man.github.io/deepseek-harness-learn/** ，仓库为 public。

- 发布方式：`.github/workflows/deploy.yml`——每次 push 到 `main` 自动把 `learning-site/` 目录发布到 Pages（也可在 Actions 页手动触发 `workflow_dispatch`）。
- 站点为 hash 路由 SPA，无需任何 URL 重写；`data.js` 等资产用相对路径引用，子路径部署天然兼容。
- 因此标准提交流（重建 → 自检 → commit → push）的最后一步 push 即完成部署，无需额外操作。

## 边界与免责

- 聚焦**架构与机制**（怎么设计的、为什么），不逐行穷举 UI 样式与测试用例；
- dsh 处于 developer preview，API 变动快；文中代码引用以基线快照为准，最新变化见站点「版本追踪」页；
- **内容由 AI 驱动生成**，可能存在偏差、遗漏或过时之处，请以官方仓库与文档为准，引用前请仔细甄别；发现错误欢迎在 [GitHub Issues](https://github.com/Tech--man/deepseek-harness-learn/issues) 反馈。

## 版本管理

本目录是独立 git 仓库（不在 workspace 根初始化），远程为 GitHub 仓库 `Tech--man/deepseek-harness-learn`。

```bash
# 修改知识库后的标准提交流
node tools/build-site.mjs        # 1. 重新生成站点（KB 是唯一事实源）
node --check learning-site/app.js  # 2. 语法自检
git add -A && git commit -m "…"  # 3. 提交（learning-site 随源入库，仓库自含可静态部署）
git push                         # 4. 推送
```

约定：
- `knowledge-base/` 是内容源；`learning-site/` 由构建生成但**随库提交**（改源后必须重建再提交，避免两态漂移）。
- 保持零依赖：站点不引入任何构建工具与外部 CDN；`.mimosa/` 等工具缓存已在 `.gitignore` 中忽略。
- 新增知识点：按 `kp-xxx.md` 放入对应模块目录并写全 frontmatter，构建器自动收录与排序。
