---
id: kp-025
title: 执行世界实盘：bash/fs/terminal 的 provider 细节
domain: DeepSeek Harness
module: 工具与能力接缝
level: 进阶
prerequisites: [kp-023]
related: [kp-023, kp-026]
tags: [bash, fs, terminal, sandbox, 提供者]
sources: [packages/shell/bash-local/src/index.ts, packages/shell/bash-sandbox/src/index.ts, packages/sandbox/sandbox-local/src/index.ts, packages/fs/fs-observation-policy/src/index.ts]
status: reviewed
---

# 执行世界实盘：provider 细节

## 一句话定义
把 kp-023 的接缝表落到源码：`bash-local` 是"模型友好环境"的 `bash -c`；`bash-sandbox` 只是它的一个 `inject` 三个服务的子类；`sandbox-local` 内部是 OS 能力降级链；fs 面有独立的观察策略事件层——本知识点是通读这些小包的"地图 + 摘录"。

## 为什么重要
接缝概念要落地才可信。这几个包总共约千行，是学习"如何写一个 dsh provider"的最佳模板。

## 前置知识
kp-023。

## 核心概念

**bash-local**（shell/bash-local/src/index.ts）：
- `bash -c` over `ctx.subprocess`；
- 模型友好环境 `ENV_OVERRIDES`（:30-35）：`NO_COLOR / TERM=dumb / PAGER=cat / GIT_PAGER=cat`——为"输出必然进模型上下文"优化；
- 默认 3s SIGTERM→SIGKILL 宽限（:42）；64MiB/流 spill 上限（:45）。

**bash-sandbox**（:56-57）：`class SandboxBashExecutor extends LocalBashExecutor`，`static inject=['subprocess','sandbox','sandboxPolicy']`——**继承而非重写**；runner 可执行但启动失败 → 抛 `SANDBOX_UNAVAILABLE`。

**sandbox-local**（sandbox-local/src/index.ts:2-8）：OS 能力降级链 `Linux bwrap → landlock → macOS sandbox-exec(Seatbelt) → Windows ACL runner`——同一 `confine(argv, policy)` 语义，不同后端。

**escalation**（sandbox/src/escalation.ts）：严格变宽表 `WIDER_MODES`（:25-28）、`ESCALATION_TARGETS` 目标词表（:37）、`sandbox_permissions`+`justification` 配对校验；执行期经 tool-bash 走 `ctx.approval.request`。

**terminal**（terminal/tool-terminal + terminal-bash）：`terminal_open/read/send/signal/list/close` 工具族；backend `BashTerminalBackend` 经 `ctx.terminals.registerBackend()`（terminal-bash/src/index.ts:184,237）——持久会话（如 dev server）不再受单请求生命周期约束。

**fs 面**：`tool-fs` 提供 `edit / read / read_image / write`（read_image 需 ctx.attachments + image 路由）；`tool-fs-search` 的 glob/grep 打包 ripgrep 经 `ctx.subprocess`；`fs-observation-policy` 是 **event-only 插件**：WeakMap 按 owner（agent session）记录 read 观察，写/编辑前强制先读 + provider 端原子 no-clobber 复查（src/index.ts:1-8）。

## 原理 / 机制：读一个 provider 的步骤
1. 看 `static inject`（依赖哪些服务）；
2. 看 Service 基类（extends 什么、覆写什么）；
3. 看 fail 模式（抛什么错码、是否 fail-loud）；
4. 看环境/资源上限（超时、内存、输出截断）；
5. 看 patch 行怎么把它接进 `dsh-base`（平台门控？）。

## 直观类比
base bundle 像 **精装修交付**：bash/pwsh 沙箱行带平台门控（`disabled: !!js process.platform === 'win32'`）；住户（用户 patch）想换地板（provider）只动那一行——水电（subprocess）与燃气（sandbox）接口标准化后，换供应商不再砸墙。

## 实例 / 案例
对照读 `bash-local` 与 `bash-sandbox` 两个文件（合计 <300 行），你会看到 kp-023 的每个论断都有一行代码对应——这是本知识库最推荐的一次"亲手验证"。

## 常见误区
- **以为 PAGER=cat 是偷懒**：是刻意的模型友好策略（分页器在无 TTY 管道里只会挂起或污染输出）；
- **以为 sandbox 挂了会静默回退 local**：fail-loud 抛 `SANDBOX_UNAVAILABLE`，绝不静默降级——安全边界不玩温柔；
- **以为 fs 观察策略在 provider 里**：它是事件层插件，provider 保持纯粹。

## 自测题
1. `ENV_OVERRIDES` 里每一条各防什么事故？
2. escalation 的 `justification` 为什么要配对校验？
3. terminal 工具族与 bash 工具的本质区别是什么（生命周期视角）？

## 与其他知识点的关系
- kp-026 盘点不共享执行世界的其余接缝（MCP/skill/browser/computer/PTC）。

## 延伸阅读
- `packages/sandbox/sandbox/README.md`（per-call policy 哲学）
- `packages/fs/fs-observation-policy/README.md`
