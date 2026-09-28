---
id: kp-001
title: 什么是 Agent Harness（驾驭层）
domain: DeepSeek Harness
module: 总览与定位
level: 入门
prerequisites: []
related: [kp-002, kp-010]
tags: [概念, harness, agent]
sources: [README.md, docs/architecture.md]
status: reviewed
---

# 什么是 Agent Harness

## 一句话定义
Agent Harness（驾驭层）是介于 **用户/外部触发** 与 **大模型** 之间的完整运行时：负责把"让模型帮你干活"这件事工程化——组装上下文、调度工具、执行循环、持久化过程、呈现结果，而模型本身只负责"思考与输出"。

## 为什么重要
模型 API 只提供"一次推理"：给输入、回输出。但真实任务需要多轮循环、工具调用、失败重试、人机协作、历史回放——这些都是 harness 的工作。**harness 的质量直接决定同一个模型的表现上限**：上下文怎么拼、工具怎么调度、错误怎么恢复，每一个决策都在放大或损耗模型能力。Claude Code、OpenAI Codex CLI、以及本项目 dsh，都是这一层的实现。

## 前置知识
- LLM 基本调用模型（输入消息列表 → 输出消息）；
- function calling / tool use 概念。

## 核心概念
一个 harness 至少要解决五个骨架问题：

| 骨架问题 | 含义 | dsh 中的承载者 |
|---|---|---|
| 上下文组装 | 每次请求给模型看什么（系统提示、历史、工具 schema） | `ctx.systemPrompt` + 会话日志投影 |
| 循环驱动 | 模型→工具→模型→…到什么时候停 | `ctx.agentLoop`（turn/step 状态机） |
| 能力供给 | 模型能"动手"做什么（执行、读写、搜索…） | `ctx.tools` + 各能力接缝 |
| 过程持久化 | 干过什么留什么痕，崩溃后怎么办 | `ctx.sessions`（追加式事件日志） |
| 人机接口 | 人怎么批准/打断/观察，结果怎么呈现 | `ctx.agents` + `session/event` + UI |

## 原理 / 机制
把 harness 拆开看，它是一个 **分层控制回路**：

```text
外层：人 / 定时器 / webhook ──输入──▶ 收件箱（inbox）
中层：AgentLoop ──每步──▶ ① 组装提示  ② 请求模型  ③ 执行工具 ──▶ 回到 ①
内层：会话日志 ──▶ 所有"模型可见"的事实都必须先落日志，循环从日志投影历史
```

关键设计张力（也是各 harness 分道扬镳的地方）：
1. **可编程性 vs 封闭性**：harness 深度影响模型行为，所以它的每个环节（提示、工具、循环）该开放到什么程度？dsh 的答案是极端开放——连循环本身都是插件；
2. **持久化 vs 性能**：追加式日志保证可重放/可审计，但每次请求都要从日志推导历史，需要投影缓存折中；
3. **自由 vs 安全**：能执行 shell 的 Agent 很强也很危险，沙箱与审批策略是 harness 的伦理担当。

## 直观类比
模型是 **发动机**，harness 是 **整辆车**：方向盘（交互）、变速箱（循环节奏）、油路（上下文供给）、行车记录仪（会话日志）、安全气囊（审批/取消）。换发动机不用重造车——这正是 dsh 用 `ctx.llm` 接缝把模型层抽象掉的原因。

## 实例 / 案例
- `dsh web` 启动后在 `http://127.0.0.1:3080` 获得完整 Web UI，背后跑的就是这套 harness；
- 同一套 harness 换成 `dsh --profile headless` 就变成一次性脚本运行器，换 `sdk` 就是给 Python/TS 程序用的 JSON-RPC 服务——harness 与"壳"解耦。

## 常见误区
- **"Harness = 框架"**：框架（如 Cordis）只提供组合机制；harness 是用框架搭出的领域系统（含领域概念：turn/step/session/seam）。
- **"Harness = prompt 模板"**：提示只是上下文组装的一小部分；循环、持久化、审批才是重头。
- **"工具越多越好"**：工具注册影响提示词体积与模型注意力，dsh 用 scope/restriction 机制做裁剪（见 kp-022）。

## 自测题
1. 用一句话向产品经理解释"为什么要有一个 harness"？
2. 列出五个骨架问题，并指出哪一个问题在"Agent 会写文件"场景下最致命？
3. dsh 把循环本身也做成插件，好处与代价各是什么？

## 与其他知识点的关系
- kp-002 讲 dsh 如何具体回答这五个问题；
- kp-010（turn/step）是"循环驱动"问题的完整解；
- kp-016（会话日志）是"过程持久化"问题的完整解。

## 延伸阅读
- 仓库 `README.md`（定位与引用）；
- Anthropic《Building effective agents》——同样的问题域，对照视角。
