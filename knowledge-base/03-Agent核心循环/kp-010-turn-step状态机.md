---
id: kp-010
title: turn / step 状态机：一次完整循环的事件序列
domain: DeepSeek Harness
module: Agent 核心循环
level: 核心
prerequisites: [kp-009]
related: [kp-011, kp-012, kp-013, kp-016]
tags: [turn, step, 状态机, 事件序列]
sources: [packages/core/agent-loop/src/agent.ts, docs/architecture.md §Turn flow, docs/agent-lifecycle.md]
star: true
status: reviewed
---

# turn / step 状态机

## 一句话定义
dsh 的循环只有两级：**step = 一次模型请求 + 它引发的工具执行**；**turn = 零或多于零个 step**（在收到"自然停止 + 无排队输入"后结束）；`ReactLoopAgent` 驱动器有三个 phase：`idle | maintenance | running`。

## 为什么重要
这张事件序列图是 dsh 的心电图——所有扩展点（waterfall/durable 事件）都挂在这条时间线上。看懂它，任何 agent 行为问题都能定位到具体事件。

## 前置知识
kp-009；kp-007（waterfall）。

## 核心概念

| 术语 | 定义 |
|---|---|
| turn | 一次"消耗被接纳输入"的排水，`turn/start` 到 `turn/end` |
| step | 一次模型请求及其工具执行，`step/start` 到 `step/end` |
| round | 外层策略迭代（goal round / Ralph attempt），不归循环管 |
| tool barriers / rolling pool | 工具并发调度的分段与有界池（kp-021） |

## 原理 / 机制：完整 turn flow（对照 docs/architecture.md）

```text
turn/start  (turn 号 = turnBoundary 投影 lastTurn+1, agent.ts:305)
  claim：取走全部 next-step 输入 + 1 条排队的 next-turn 消息 → 逐条 emit agent/inbox/claimed
  组装：ctx.systemPrompt.assemble() + runtime-context 快照投影
  ──▶ agent/pre-step (waterfall)：默认 enter{messages}；监听者可改写或 reject
      reject            → turnEnds={kind:'blocked'}，turn 结束但不花模型调用
      首轮 enter 空消息  → {kind:'completed'}，同样零 step
  step/start
    agent/request (waterfall) → ctx.llm.prepareCall() 得绑定调用
      （两个异步阶段中取消 = system 与 users 都不提交）
    append system/message（按节点协调）
    append user/message（仅首轮）
    buildRequest：记录 request/header / request/context，派生并冻结模型历史
    流式绑定调用 ─ llm/stream (waterfall) ─▶ agent/assistant-stream chunk*
      成功   → append assistant/message → agent/assistant-stream end
      失败   → append assistant/attempt → agent/request-error (waterfall)
              监听者回 {kind:'retry'} → 在开放 step 内重试（不重复 pre-step/用户准入）
    tool/call* → tools/pre-execute → tools/execute → tools/post-execute → tool/result*
    工具欠新请求 或 next-step 有输入 → 回到 claim，下一个 step
    自然停止 + inbox 空 → agent/turn-stopping (serial，最后排水)
  step/end
turn/end {turn, reason: completed|blocked|aborted|error|max-tokens|forked|interrupted}
```

**关键实现细节**（agent.ts）：
- turn 结束后 `inbox.hasPending` 决定是否立即再开一个 turn（换新 AbortController，:373-378）；
- `max-tokens` 是 sticky 的：turn 已出现过 max-tokens，后续 step 完成**不会**把 turn 结果降级为 completed（:336-337）；
- 异常路径：signal aborted → `{kind:'aborted', reason}`（cause 归一为 user/parent/hook/disposed 的拷贝，:80-95）；其他错误 → `{kind:'error'}` 并 emit live `agent/error`；`finally` 必 append `turn/end`（:365-371）；
- 维护（maintenance）期间唤醒被 latch（`wakeRequested`），在 `kick` 的 finally 收敛点重放（:259-263）。

## 直观类比
turn 像 **一趟航班**：登机（claim 输入）→ 起飞决策（pre-step，可被塔台拒绝）→ 航段（step：联系塔台请求 [prepareCall] → 飞行 [流式] → 处理空管指令 [工具]）→ 可连续多航段 → 落地（turn/end，写明原因）。航班取消（aborted）与返航（error）都仍要写飞行日志（turn/end 必 append）。

## 实例 / 案例
数一次典型问答的事件：`turn/start → step/start → system/message → user/message → request/header → assistant/message(含嵌入流) → step/end → turn/end`。若模型连续调两个工具再回答，中间多一轮 step（tool/call ×2 + tool/result ×2 落在第一个 step 内）。

## 常见误区
- **以为 turn = 一条用户消息**：turn 是"排水到无事可做"；steering 消息被 claim 后并入当前 turn 的下一个 step；
- **以为 pre-step 每次模型请求都跑**：它只在 step 开始前跑；**重试不重复 pre-step**（kp-013）；
- **以为工具执行在一个 step 里是串行整批**：按模型顺序分段、段内可并行、段间屏障（kp-021）。

## 自测题
1. 默写 turn flow 图（不看资料）。
2. `turn/end.reason` 有哪几种取值？`max-tokens` 为什么 sticky？
3. pre-step 的 reject 与空 enter 有何区别（turn 结果 kind）？

## 与其他知识点的关系
- kp-011/012/013/014 分别展开 claim、waterfall、重试、流式；
- kp-016 讲这一切如何落成 durable 日志。

## 延伸阅读
- `docs/agent-lifecycle.md`（官方时序图，与本文一一对应）
- `packages/core/agent-loop/README.md#understand-the-implementation`
