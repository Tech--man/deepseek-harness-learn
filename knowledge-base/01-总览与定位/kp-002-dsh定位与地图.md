---
id: kp-002
title: DeepSeek Harness 是什么：定位、地图与"一切皆插件"
domain: DeepSeek Harness
module: 总览与定位
level: 入门
prerequisites: [kp-001]
related: [kp-003, kp-005, kp-023]
tags: [dsh, monorepo, 插件架构]
sources: [README.md, docs/architecture.md, AGENTS.md]
star: true
status: reviewed
---

# DeepSeek Harness 是什么

## 一句话定义
dsh 是 DeepSeek 开源的 Agent Harness：**建立在 Cordis 之上、一切皆插件的 monorepo**——模型适配器、工具注册表、会话日志、Agent 循环本身都是插件，任何部分都能从配置替换。

## 为什么重要
它是目前极少数 **把"agent harness 该长什么样"完整公开** 的工业实现：官方 architecture 文档 + 每包 README + 设计决策笔记（`.agents/notes/`）三层资料齐备。读懂它，等于拿到了一份"Agent 运行时"的参考蓝图。

## 前置知识
kp-001（harness 概念）。

## 核心概念：monorepo 地图

```text
deepseek-harness/
├─ vendor/            cordis 框架整包内嵌（改名 @deepseek-ai/*）：cordis/loader/include/hmr/timer…
├─ packages/          54 个包组 / 312 个工作区插件包，每个包 = 一个 Cordis 插件（或一组同域插件）
│   ├─ core/          内核：session、agent、agent-loop、tools、system-prompt、scope…
│   ├─ llm/           模型接缝：词汇表 + DeepSeek adapter
│   ├─ shell|fs|sandbox|subprocess|mcp|lsp|browser-use|computer-use…   能力接缝
│   ├─ session/       会话持久化：persistence-jsonl、format-v0-to-v4 迁移包、projection
│   ├─ compaction/    上下文压缩（compaction + compaction-basic）
│   ├─ bundle/        发行层：dsh-base / web-app / headless / sdk-app / acp-app / sdk-minimal
│   └─ boot/          组装与运维：app-boot、hmr、plugin-manager、cmdline
├─ apps/              cli（dsh 入口）、web、desktop（Electron）、desktop-host
├─ python/            sdk（客户端库）+ sdk-runtime（内嵌 dsh 的 wheel）
├─ docs/              architecture.md + subsystems/*.md + cordis-tutorial/ + 决策笔记
└─ benchmarks/ scripts/ website/
```

**核心原则："Everything is a plugin"**（README.md:7）：
- **没有特权内核可打补丁**——扩展 dsh = 在树旁挂一个插件；注册都是 effect，插件卸载时自动回收（docs/architecture.md:9-13）；
- 官方论文背书：Cordis 的设计出自《A Programming Paradigm for Spatiotemporal Composability》（arXiv 2608.25512）；
- 版本状态：developer preview（0.1.x），官方明示"会有破坏性变更"。

## 原理 / 机制：一个运行中的 dsh 是什么

**Profile（组合配方）**：命名组合，存于 Harness home，列出叠加的 bundle 与用户自己的 `cordis.patch.yml`。出厂模板：`web`、`headless`、`sdk`、`sdk-minimal`、`acp`。

**Bundle（发行格式）**：Cordis 配置行 + 代码的打包单位，在包 `package.json` 的 `dsh` 字段声明（`dsh.bundle` 指向补丁文件）。`dsh-base` 是共享第一层（模型适配、工具、持久化、沙箱、审批、设置…94 行配置），`dsh-web-app` 等在其上叠加。

**Patch（替换单元）**：每行配置可被上层 patch 按 id 整块替换——改行为不改源码。

```text
空 entry 列表 ──▶ bundle1 patch ──▶ bundle2 … ──▶ profile patch ──▶ home patch ──▶ --patch
```

**查看你机器上实际组装的树**：

```sh
dsh --profile web --dump-config   # 打印每行配置及其来源层
```

## 直观类比
dsh 像一个 **可自定义的驾驶舱**：Cordis 是驾驶舱的挂载轨道（socket），每个插件是一块仪表/控件（service + 事件 + 可拔插）；profile 是"驾驶配置单"，bundle 是"整组预装模块"，patch 是"用户改线"。换发动机（LLM）、换方向盘（UI）、拆掉巡航（compaction）都不用动车身。

## 实例 / 案例
- `packages/bundle/base/cordis.patch.yml`：一行即一个插件，如 `- id: agent-loop / name: '@deepseek-ai/dsh-agent-loop'`；带条件挂载 `- disabled: !!js "!ctx.get('profileContext')"`;
- `packages/core/tools/src/index.ts:1088`：`run_code` 是保留工具名，任何 scope 都不可注册——内核级规则也通过普通包实现+校验执行。

## 常见误区
- **以为要读完全部 60 个包**：先读内核 6 包（core/{session,agent,agent-loop,tools,system-prompt,scope}）+ llm，其余沿 seam 三角色按需读（kp-023）；
- **以为 vendor/ 是第三方依赖目录**：cordis 是整包源码内嵌（`vendor/cordis/src/*.ts` 共 9 个文件）并带 22 条本地修改（`vendor/README.md`），是理解机制的第一手材料；
- **以为 dsh 绑定 DeepSeek 模型**：`ctx.llm` 是接缝，adapter 可换（kp-024）。

## 自测题
1. 说出 dsh monorepo 六个顶层目录各自的职责。
2. "一切皆插件"如何解决"改内核要重新构建"的问题？
3. profile、bundle、patch 三者的关系是什么？`dsh --dump-config` 为什么重要？

## 与其他知识点的关系
- kp-003 展开运行形态；kp-005~008 展开 Cordis 与组装细节；kp-023 展开 seam 设计。

## 延伸阅读
- `docs/architecture.md`（官方架构图，本文多次引用）
- `vendor/README.md`（cordis 内嵌版本与修改日志）
- 论文：arXiv 2608.25512
