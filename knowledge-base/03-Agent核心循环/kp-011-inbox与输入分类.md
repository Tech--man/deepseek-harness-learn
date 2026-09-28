---
id: kp-011
title: inbox 与输入分类：followup / steer / inject
domain: DeepSeek Harness
module: Agent 核心循环
level: 核心
prerequisites: [kp-010]
related: [kp-010, kp-012]
tags: [inbox, steering, inject, 下一轮输入]
sources: [packages/core/agent-loop/src/inbox.ts, packages/core/agent-loop/src/agent.ts:154-235, docs/glossary.md]
status: reviewed
---

# inbox 与输入分类：followup / steer / inject

## 一句话定义
一个收件箱喂整个驱动器：输入分三档——`followup`（开新 turn）、`steer`（并入当前 turn 的下一个 step）、`inject`（并入下一 step 但**不唤醒**驱动器）；claim 时全部 next-step 输入 + 至多 1 条排队 next-turn 消息一起取走。

## 为什么重要
"用户在模型干活时又说了话"是所有 harness 都要回答的问题。dsh 的答案是一套精确的输入语义：不粗暴打断，也不简单排队——而是让插件和 UI 有能力表达"这是新指令 / 这是补充 / 这只是背景材料"。

## 前置知识
kp-010（turn/step）。

## 核心概念

| API | 语义 | 唤醒？ | 落点 |
|---|---|---|---|
| `agent.followup(msg)` | next-turn + 唤醒 | ✅ | 新 turn 的首批输入 |
| `agent.steer(msg)` | next-step + 唤醒 | ✅ | 当前 turn 的下一个 step |
| `agent.inject(msg)` | next-step **不唤醒** | ❌ | 同上，等下次唤醒时一起 claim |

**claim 规则**（inbox.ts:109-114）：`inbox.claim(target, turn)` 取走全部 next-step 消息；若 target=next-turn 再加 1 条排队的 next-turn 消息；逐条 emit live `agent/inbox/claimed`。claim 先于 pre-step——所以 pre-step 监听者（如 compaction）看到的是"已被接纳的批次"。

**注入的持久化**：inbox 是一个注册在 `dsh-session-projection` 上的 durable 投影（splice 事件 `agent/inbox/spliced` 落日志，校验 splice 坐标 + MessageId 唯一，inbox.ts:27-65）——进程崩溃后未消费的输入可重放。

## 原理 / 机制

**唤醒的边缘情况**（agent.ts:154-174）：
- 唤醒发生在 aborted activity 上 → 重分类为 next-turn（不给已死的 step 递料）；
- 驱动器在 maintenance/running 中 → 只 latch `wakeRequested`，在收敛点（kick finally）重放；
- `cancel(cause,{keepInbox})` 默认清空 inbox——"取消"在 dsh 语义里包含丢弃未消费输入。

**工具的结果上下文也走 inbox**：工具执行返回 `additionalContexts` 时被 splice 进 next-step（agent.ts:517-520 的 `acceptContext`）——即"模型让工具塞给下一步的备忘"与用户 steering 共用同一条管道。

## 直观类比
收件箱像 **餐桌上的三色碟子**：绿碟（followup）="再上一道新菜"（开新 turn）；黄碟（steer）="这道菜少放盐"（下一 step 修正）；蓝碟（inject）="把菜单放桌角备用"（不叫服务员，等下次上菜时顺带）。服务员（driver）上菜时把碟子按颜色清走（claim），账单（turn/end）只写绿碟。

## 实例 / 案例
- compaction 的摘要请求不进 inbox（直接 `llm.stream`），但压缩结果以 surface replace 落日志——对照：inject 是"下轮上下文"而非"立即请求"；
- skill 包把加载的 skill body 以 instructions 形式 `agent.inject()`（tool-skill/src/index.ts L165-169），保证它排在 catalog 之后、位置确定。

## 常见误区
- **以为 steering 会打断当前模型请求**：不会——steer 只影响"下一个 step"；真正打断是 `cancel`；
- **以为 inject 立即生效**：不唤醒驱动器，若 agent 正在 idle，消息静静躺在 inbox 直到有人唤醒；
- **把 inbox 当内存队列**：它是 durable 投影，重放后依然存在。

## 自测题
1. 用户发第二条消息时（模型正在流式输出），消息会进哪个档？何时被消费？
2. claim 时"全部 next-step + 1 条 next-turn"的设计理由是什么？
3. 工具的 `additionalContexts` 与 `agent.inject()` 有何异同？

## 与其他知识点的关系
- kp-010 的 claim 步骤消费本机制；
- kp-018（projections）解释 inbox 为何可重放。

## 延伸阅读
- `docs/glossary.md`（loop hierarchy 术语）
- `packages/core/agent-loop/README.md`（inbox 投影节）
