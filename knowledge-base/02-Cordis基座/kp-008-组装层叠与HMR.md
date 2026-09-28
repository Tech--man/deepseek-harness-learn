---
id: kp-008
title: 组装层：profile → bundle → patch 层叠、dump-config 与 HMR
domain: DeepSeek Harness
module: Cordis 基座
level: 进阶
prerequisites: [kp-003, kp-006]
related: [kp-003, kp-005, kp-029]
tags: [patch, bundle, hmr, 组合]
sources: [apps/cli/README.md, apps/cli/src/profile-boot.ts, apps/cli/src/dump-config.ts, packages/boot/hmr/README.md, vendor/README.md]
star: true
status: reviewed
---

# 组装层：层叠补丁、dump-config 与 HMR

## 一句话定义
dsh 的运行时树由 **有序补丁层叠** 组装而成（bundle 顺序 → profile patch → home patch → `--patch`），`--dump-config` 用与挂载相同的算法打印这棵树，HMR 让配置变更免重启生效——组合不是启动时一次性事件，而是可持续演进的状态。

## 为什么重要
这是"改行为不改源码"的全部机制所在；也是 dsh 区别于"改 fork"类项目的核心工程资产。

## 前置知识
kp-003（启动链路）、kp-006（`!!js` 惰性求值）。

## 核心概念

**层叠顺序**（apps/cli/README.md:41-46）：

```text
空根 cordis.yml
 └▶ 各 bundle 的 cordis.patch.yml（按 package.json 的 dsh.profile.bundles 顺序）
    └▶ profile 的 cordis.patch.yml
       └▶ home 级 $DSH_HOME/cordis.patch.yml      # machine 级偏好，故反超 profile
          └▶ --patch 命令行 overlay
```

**patch 行的三种操作**：
- `- id: X, config: {...}` —— **整块替换**该行 config（不深合并）；
- `- id: X, disabled: true` —— 停用；
- `- insert: [...]` —— 插入新行（name 可为包名/绝对路径/file URL）。

## 原理 / 机制

**1. `applyEntryPatches` 的意义**（vendor README 修改 11）：上游 cordis 的 insert 行"插入后不可达"，即后续 patch 无法再配置它。DeepSeek 把该逻辑抽成导出纯函数并修复——同一 patch 列表内，后面的 patch 可以配置/停用先前 insert 的行。**没有它，profile 组合根本无法工作**（web-app 要改 base 行、base 要门控行为）。

**2. `disabled: !!js` 每次挂载求值**（vendor README 修改 18）：disabled 是唯一在每次挂载决策时对 loader 上下文求值的元数据字段，例如 base 里按平台门控：

```yaml
- id: pwsh-sandbox
  disabled: !!js process.platform === 'win32'   # Windows 上停用
```

**3. `--dump-config` 与挂载同源**（dump-config.ts:51-75）：收集各层（带 `# ==` 来源注释）→ 用与实际挂载 **同一算法** 组合打印；不匹配任何行的 patch 会被按层报告（防"写了补丁但没生效"）。坏配置恢复用 `--dump-default-config`（不解析用户层）。

**4. 根 cordis.yml 每次启动被重写为空数组**（profile-boot.ts:103-110）：它只作 Loader include 的 baseUrl 锚点；不重写会被 Loader 树回写烤入组合行，下次启动重复插入——一个"配置即产物"的防御细节。

**5. HMR（`@deepseek-ai/dsh-hmr`）**：
- base 默认启用 **配置监听**（`config.root: []` + `disabled: !!js "!ctx.get('profileContext')"`），headless/sdk/acp 在 YAML 里显式关闭；
- 单一序列化队列：模块替换、Include 刷新、profile 配置变更排队执行；pnpm 安装在队列之外（hmr README:12）；
- 事件：`hmr/change`（文件变更）、`hmr/reload`（替换完成，携带 `Map<Plugin, Reload>`）；
- 限制：依赖 Node loader 内部实现（按 `getOrCreateModuleJob` 判型而非版本号，vendor README:51）；框架依赖变更需重启进程。

**6. 准入与豁免**：组合边界检查 `peerDependencies` 对 `@deepseek-ai/dsh`/`dsh-*` 的版本范围；被拒 bundle 进 `skippedBundles`，硬要装可用 `dsh plugin allow-version … --accept-risk` 写入 `compatibility.json`。

## 直观类比
层叠 patch 像 **CSS 层叠**：bundle 是框架预置样式，profile patch 是主题，home patch 是用户自定义样式表，`--patch` 是行内 style——特异性由层的位置决定；`--dump-config` 是 DevTools 的 computed styles；HMR 是热更新样式表不用刷新页面。

## 实例 / 案例
`dsh --profile web --dump-config` 输出示意（节选）：

```yaml
- id: agent-loop                    # == layer: dsh-base
  name: '@deepseek-ai/dsh-agent-loop'
- id: webserver                     # == layer: profile(web-app) override
  config:
    port: !!js ctx.webStartup.port ?? 3080
```

## 常见误区
- **以为 patch 会深合并 config**：整块替换！改 base 行必须复述完整配置（app-boot README:206）；
- **以为用户 patch 永远赢**：home 层在 profile 层之后，是因为它代表机器级偏好——语义是"越靠近用户越后应用"，不是"patch 优先级一致"；
- **把 HMR 当万能热更**：换已装包版本仍需 Plugin Manager 重启；hmr 队列外的 pnpm 安装不会自动触发重载。

## 自测题
1. 画出五层层叠顺序，并解释为什么 home 层排在 profile 之后。
2. 写一个把 `agent-loop` 换成自己实现 + 停用原行的 patch 片段。
3. `--dump-config` 报告"unmatched patch"时意味着什么？

## 与其他知识点的关系
- kp-003 的启动链路调用本机制的产物；
- kp-029 的 SDK 运行时也按同一 profile 机制启动（`dsh --profile sdk`）。

## 延伸阅读
- `packages/bundle/base/README.md`（base patch 的逐行说明，当前 529 行 YAML / 94 行）
- `apps/cli/composition.md`（生成的组合图）
