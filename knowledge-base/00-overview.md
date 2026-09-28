---
id: overview
title: 领域总览：DeepSeek Harness 源码解读
domain: DeepSeek Harness
module: 总览
level: 入门
status: reviewed
---

# 领域总览

## 一句话定义
DeepSeek Harness（`dsh`）是 DeepSeek 于 2026 年开源的 **Agent Harness（Agent 驾驭层）**：一个以 Cordis 框架为基座、以"一切皆插件"为原则的 monorepo，把驱动大模型完成任务的全部基础设施——模型适配、工具、会话持久化、Agent 循环、UI——都实现为可从配置替换的 Cordis 插件。

## 领域边界

**是什么：**
- Agent Harness：介于"用户请求"与"模型输出"之间的完整运行时——管理会话、组装上下文、调度工具、执行循环、呈现结果。类比：Claude Code 之于 Claude 模型，dsh 之于 DeepSeek 模型（但它是框架级开源项目，不绑定单一入口）。
- 一个 **pnpm monorepo**：根目录下 `packages/`（约 60 个插件包）、`apps/`（cli/desktop/web/desktop-host）、`vendor/`（内嵌 cordis 源码）、`python/`（Python SDK）、`docs/`（极完备的架构文档）。

**不是什么：**
- 不是模型、不是推理引擎——它通过 `ctx.llm` 接缝调用模型 API；
- 不是通用插件框架本身——框架是 Cordis（整包 vendor 进 `vendor/cordis`，改名 `@deepseek-ai/cordis`）；
- 不是仅一个 CLI 工具——它同时是 Web 应用、桌面应用、SDK 服务端（`web/headless/sdk/sdk-minimal/acp` 五种 profile）。

## 核心问题域
Harness 要回答的五个骨架问题，也是本知识库的主线：

| 问题 | dsh 的答案 | 模块 |
|---|---|---|
| 如何让一切可替换？ | Cordis：插件贡献 service / typed events / 可逆 effect | 02 |
| Agent 如何一步步干活？ | AgentLoop：turn/step 状态机 + 水瀑事件管线 | 03 |
| 模型看到的上下文以什么为准？ | 追加式 SessionEvent 日志："model-visible means logged" | 04 |
| 能力（shell/fs/沙箱…）如何可换供应商？ | Capability Seam：定义/提供者/消费者三角色 | 05 |
| 如何长出 Web/桌面/SDK 多种形态？ | profile → bundle → patch 的组合层叠 | 02+06 |

## 学习目标
读完本知识库，你应该能：
1. 说清 Cordis 五大概念（plugin/Context/Service/events/inject）并写出自己的插件；
2. 复述一次 turn 从 inbox 到 turn/end 的完整事件序列；
3. 解释"会话日志即上下文真相源"及其对重放、fork、压缩的意义；
4. 沿 seam 三角色读懂任意一个工具/能力包；
5. 动手写一个 dsh 插件（tool / LLM adapter / 命令）。

## 前置知识
- TypeScript/ESM 基础、Node.js 基本概念；
- 对 LLM Agent 的直觉认知（模型 + 工具调用循环）；
- YAML（patch 文件）、JSON-RPC（SDK 层）。

## 版本锚点
- 源码快照：`origin/master @ 21638c56`（2026-09-27，dsh 0.1.7-rc.2）
- 官方文档：[deepseek-harness.github.io/deepseek-harness](https://deepseek-harness.github.io/deepseek-harness/)；仓库内 `docs/` 与本知识库互为补充（`docs/architecture.md` 是官方权威图）。
