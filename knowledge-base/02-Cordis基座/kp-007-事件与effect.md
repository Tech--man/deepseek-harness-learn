---
id: kp-007
title: 类型化事件与 effect 回收
domain: DeepSeek Harness
module: Cordis 基座
level: 核心
prerequisites: [kp-005]
related: [kp-006, kp-012, kp-016]
tags: [事件, waterfall, effect, 生命周期]
sources: [vendor/cordis/src/events.ts, docs/cordis-primer.md, packages/core/agent/src/dispatch.ts]
status: reviewed
---

# 类型化事件与 effect 回收

## 一句话定义
Cordis 事件是带类型、带派发模式的扩展点（`namespace/action` 命名），监听器注册即 effect、随插件卸载自动回收；其中 **waterfall** 模式构成 around 中间件链，是 dsh 全部拦截机制的地基。

## 为什么重要
dsh 把"扩展"分为两个通道：改行为走事件（尤其 waterfall），用能力走 service。列一张事件表基本就等价于列一张 dsh 的扩展点清单——官方甚至生成了 event map（docs/event-producer-consumer.md）。

## 前置知识
kp-005、kp-006。

## 核心概念：五种派发模式

| 模式 | 语义 | dsh 例子 |
|---|---|---|
| `emit` | 通知所有监听器，单个失败被容错 | `agent/status`、`session/event` 广播 |
| `parallel` | 并发等全部完成 | 少用 |
| `serial` | 按注册顺序逐个 await | `agent/created`、`agent/turn-stopping` |
| `bail` | 返回真值即短路 | 校验类 |
| `waterfall` | around 链：`(args, next) => …`，**不调 next 即短路，返回值权威** | `agent/pre-step`、`agent/request`、`llm/stream`、`tools/execute` |

（对照表：docs/cordis-primer.md:19-25；定义：vendor/cordis/src/events.ts:32。）

## 原理 / 机制

**waterfall 语义**（这是全 dsh 最重要的一个语义）：

```ts
ctx.on('llm/stream', (options, next) => {
  if (options.purpose === 'compaction') return customStream(options)  // 短路：不走真 adapter
  return next({ ...options, temperature: 0.2 })                        // 包装后放行
})
```

- 监听器按注册顺序执行；`prepend: true` 可插队（primer:29-35）；
- 包装 `next()` 的返回值 = 中间件模式；直接 return = 拦截；
- **返回值是权威结果**——下游监听器拿到的是上游包装后的值。

**effect 回收**：`ctx.on` / `ctx.effect(fn => disposer)` 的返回物登记进当前 fiber；Context 卸载时按逆序执行。生成器形式可声明多步 setup/teardown：

```ts
ctx.effect(function* () {
  const handle = openResource()
  yield () => handle.close()     // teardown
})
```

（`packages/session/session-title/src/index.ts:481`、`packages/llm/llm/src/index.ts:403` 都是真实用例。）

**agent/* 事件的统一包装**（`packages/core/agent/src/dispatch.ts:120-146`）：agent 域事件自动融合 `agent` 字段进 payload，并携带 `scopeTarget(agent)` 作 filter carrier——**事件向上流动，绝不向下**（kp-022 详述 scope 机制）。

## 直观类比
五种派发像 **厨房传菜方式**：emit=群发传呼（谁爱听谁听）、serial=流水线接力、waterfall=主厨试菜链（每级主厨可以尝一口改味再递给下级，也可以直接退回——这就是拦截）、bail=质检员（发现问题立即叫停）、effect 回收=下班时每位厨师收拾自己用过的灶台。

## 实例 / 案例
- `session-title` 生成器同时用了三种注册（`packages/session/session-title/src/index.ts:356-372`）：`ctx.on('session/event',…)` 观察落事件、`ctx.on('llm/stream', (o, next) => …)` 用 waterfall 拦截流、`ctx.on('session/disposed',…)` 清理；
- compaction-basic 用 `agent/pre-step`（waterfall）做压力触发、用 `agent/request-error`（waterfall）做溢出重试决策——一个插件两种拦截，互不改内核（kp-020）。

## 常见误区
- **把 emit 事件当拦截点**：emit 只观察；想改结果必须用 waterfall（dsh 在事件表里用 `@mode` 标注模式，docs/cordis-primer.md:27）；
- **在 waterfall 里忘记调用 next 也不返回**：等价于把结果置为 undefined，会静默短路下游；
- **手动 off 事件**：不需要——fiber 卸载自动回收；手动 off 反而会破坏"声明式回滚"的对称性。

## 自测题
1. 为什么 `agent/turn-stopping` 用 serial 而不是 waterfall？（提示：它只做终端检查点，无决策链）
2. 写一个把所有 `web_fetch` 结果缓存 60 秒的 waterfall 监听器骨架。
3. effect 回滚的顺序是什么？为什么是逆序？

## 与其他知识点的关系
- kp-012 把 waterfall 语义落到 agent 循环的四个决策链上；
- kp-016 的 `session/event` 是 emit 域；kp-022 讲 scope 过滤如何改变事件可见性。

## 延伸阅读
- `docs/cordis-tutorial/04-events.md`、`docs/cordis-api/events.md`
- `docs/event-producer-consumer.md`（生成的事件地图）
