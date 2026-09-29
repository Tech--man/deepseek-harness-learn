---
id: kp-029
title: SDK：TS 客户端、Python SDK 与 runtime wheel、ACP
domain: DeepSeek Harness
module: 应用与扩展
level: 进阶
prerequisites: [kp-003, kp-016]
related: [kp-003, kp-028, kp-030]
tags: [sdk, json-rpc, python, acp]
sources: [packages/sdk/{protocol,server,client}/README.md, python/sdk/api.py, python/sdk-runtime/README.md, packages/acp/acp/README.md, docs/user/guide/python-sdk.md]
status: reviewed
---

# SDK：TS / Python / ACP

## 一句话定义
三套程序化入口共享同一内核：TS SDK（newline-delimited JSON-RPC over stdio，`dsh-sdk-jsonrpc-server` 插件承载）、Python SDK（**纯同步** API + 单文件原生 runtime wheel，内嵌完整 dsh）、ACP 服务器（自动化专用 stdio 协议，故意不含 DSH 专属展示）。

## 为什么重要
SDK 是"把 harness 嵌进你的程序"的正道：每个 sessionId 一个 agent、durable 事件逐条流出、回复不归因给某个 prompt——这些协议决策决定了上层应用怎么写才稳。

## 前置知识
kp-003（sdk/sdk-minimal profile）。

## 核心概念

**TS SDK 三层**（packages/sdk/）：
- `dsh-sdk-protocol`：JSON-RPC 类型 + newline-delimited stdio transport；
- `dsh-sdk-jsonrpc-server`（server 插件）：mount 为 `jsonrpc`；每 sessionId 一个 agent；`initialize` 等 Loader 树 settle 后返回 wire 身份 `deepseek-harness-sdk-runtime`；随后流式回 `session.event`（每个 durable 事件）+ `session.status`（whole-agent 生命周期）；`shutdown` → dispose 根 context → exit 0；stdout 只承载协议帧；
- `dsh-sdk-client`：两层 API——`DeepSeekHarness`（owned runs：queue prompt → 等 `agent/inbox/spliced` durable 回执确认 message id → 收集到 whole-agent idle）压在 `HarnessClient`（显式 start/prompt/request + `subscribe`/`subscribeSessionTree`，按 `subagent.started` lineage 过滤会话树）之上。

官方最小示例（sdk/client/README.md:30-42）：

```ts
import { DeepSeekHarness } from '@deepseek-ai/dsh-sdk-client'
await using harness = new DeepSeekHarness({
  profile: 'sdk', provider: 'deepseek-official', model: 'deepseek-v4-flash',
  reasoningEffort: ReasoningEffortId('max'), maxTokens: 49_152,
})
const result = await harness.run('say hi')
console.log(result.finalResponse)
```

**Python SDK**（python/sdk）：
- 纯同步 API（无 asyncio；client.py 用线程做 reader/stderr loop，:344-350）；
- `DeepSeekHarness`（api.py:49，上下文管理器）→ `harness.run(prompt) → result.final_response`；`Session` 内部按 inbox 回执 → idle 收集（:139-149）；
- `HarnessClient`：initialize/session_prompt/request/subscribe_notifications/subscribe_session_notifications（按 lineage 过滤，client.py:492-537）；
- **每次启动必须显式 DSH_HOME，绝不回落 `~/.dsh`**（python/README.md:11）。

**runtime wheel**（python/sdk-runtime）：`deepseek-harness-runtime-bin` 把正常 dsh CLI + 封闭 Node 依赖树打成 **单文件原生可执行** `deepseek-harness-sdk-runtime-<platform>-<arch>`（附 `-rg` sidecar、macOS `-spawn-helper`、`primary-runtime/` 内嵌 CPython/Node/pnpm、office-skills）；五平台 wheel-only（hatch_build.py 拒绝 sdist）；`deepseek-harness-runtime.json` 是模块元数据锚（`__init__.py:24`）；SDK 默认启动 `dsh --profile sdk`（`DSH_PRIMARY_RUNTIME` 未设时用 bundle carrier）。

**ACP**（acp/acp）：stdio JSON-RPC，基于 `@agentclientprotocol/sdk`；表面：`initialize / authenticate / session/{new,list,resume,close,set_config_option,prompt,cancel}` + `session/update`（按会话串行）+ `session/request_permission`（一次性 allow/reject）；**故意不含** plan/todo/terminal/elicitation 等 DSH 专属展示；`dsh-subagent-acp` 用它做进程外子代理。

**官方发布口径**（guide/python-sdk，2026-09-28 交叉验证）：对外安装即 `pip install deepseek-harness-sdk`——包内含**匹配的原生运行时 wheel 与 `dsh` 命令**，普通 SDK 运行**不需要系统 Node.js**。平台门槛：Python ≥3.10；Linux x64/arm64、macOS 14+（arm64）、Windows x64。官方最小示例 `python/sdk/examples/minimal.py` 以 `--workspace`（隔离工作区）+ `--dsh-home`（隔离 home）+ `--session-id` 三个显式参数运行——与"每次启动必须显式 DSH_HOME"的约束一致。

## 直观类比
三套 SDK 像 **同一间餐厅的三种点餐方式**：TS SDK=店内点单机（双工、能看后厨每个事件）；Python SDK=电话订餐（同步、一句话等出餐，但电话那头是自带厨房车的总店 wheel）；ACP=外卖平台标准协议（只谈通用的下单/取消/配送，不谈本店特色）。

## 实例 / 案例
- `sdk-minimal` profile：Python minimal 示例用它——单 bundle、直接 `DEEPSEEK_API_KEY`、`danger-full-access`（教学边界）；
- `RunResult{sessionId, finalResponse, events, notifications}` 的 events 是全量 durable 事件——你可以拿它做自己的 UI/审计。

## 常见误区
- **以为 Python SDK 有 asyncio 版**：刻意纯同步（线程够用，降低使用门槛）；
- **以为 runtime wheel 需要"安装 dsh 到系统"**：单文件可执行 + 附属文件，SDK 使用无需系统 Node；
- **把 ACP 当 SDK 用**：它砍掉了 DSH 展示面，适合自动化编排而非产品集成。

## 自测题
1. 为什么 server 插件要等 Loader settle 后才回 `initialize`？
2. "回复不归因给某个 prompt"这个协议决策带来了什么（提示：多 steer 场景）？
3. Python 端强制 DSH_HOME 的理由是什么？

## 与其他知识点的关系
- kp-030 的 subagent provider 表里有 `dsh-sdk`——SDK 会话树本身可被父 harness 委派；
- kp-003 的 profile 选择在 SDK 内部同样适用。

## 延伸阅读
- `packages/sdk/README.md`（Source map 表）
- `python/sdk-runtime/README.md`（wheel 布局）
