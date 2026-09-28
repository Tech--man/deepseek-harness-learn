---
id: kp-022
title: scope 机制：作用域注册、遮蔽与限制
domain: DeepSeek Harness
module: 工具与能力接缝
level: 进阶
prerequisites: [kp-005, kp-021]
related: [kp-009, kp-021, kp-030]
tags: [scope, shadowing, restriction, lineage]
sources: [packages/core/scope/src/index.ts, packages/core/scope/src/store.ts:159, docs/glossary.md §agent-scope, docs/subsystems/scope.md]
status: reviewed
---

# scope 机制

## 一句话定义
scope 是 **每 Agent 的注册单元**：注册（工具/提示段/变量/限制/监听者）要么全局、要么挂在一个不透明 scope key（约定 = live Agent 对象）下；`agent.ctx` 上的注册同时决定 **可见性与生命周期**；同名遮蔽取最具体者，限制只过滤继承面，子代理绝不继承父 scope。

## 为什么重要
"给这一个 Agent 换一套工具/人格"是多 Agent 系统的基本需求。dsh 用两层扁平结构（global / scoped）+ 数据化 lineage，避免了多层继承的复杂度爆炸——这是GLOSSARY 里定义最密集的一组概念，也是 agent preset 的实现基础。

## 前置知识
kp-005（Context 树）、kp-009（创建事务/setup window）。

## 核心概念（对照 docs/glossary.md §agent-scope）

| 概念 | 定义 |
|---|---|
| **scope key** | 不透明对象，按对象同一性比较；shipped loop 用 live Agent 自身 |
| **agent.ctx** | agent 的 scoped context（打了 `kScope` 标签的子 Context）；注册经它 → scope 可见 **且** scope 生命周期 |
| **scope carrier** | scope 过滤派发携带的 `thisArg`；无标签监听器全局放行，有标签监听器仅当其 key 是 dispatch key 或祖先时放行——**事件向上流、绝不向下** |
| **shadowing（遮蔽）** | 最具体者赢：scoped 工具/段/变量替换同名全局孪生（仅该 scope 可见） |
| **restriction** | `tools.restrict({allow,deny})` 只作用于 **继承面**（全局层+祖先层），跨链求交；本 scope 自有注册豁免（view():1186-1227） |
| **setup window** | 创建事务里"scope 与 agent 对象已存在、但 agent/session 未发布"的窗口：creator 在此注册世界；setup 只注册，不驱动 |
| **lineage** | 父子事实走数据（`parentSession`、durable `delegationDepth`、runtime `subagentDepth`），永不影响可见性 |

## 原理 / 机制

**实现载体**（scope/src/index.ts）：
- `createScope(ctx, key, {parent})` mint 一个 Cordis 插件 fiber + 标签子 Context——scope 卸载即 fiber 卸载，全部注册随动；
- 父链 `scopeParents` WeakMap + 一次性 `bindScopeParent`（循环检查，:72-82）；
- `scopeTarget(base, key)`（:170-185）实现事件向上流；"一个 standing composition 观察它组合的所有 agent"由此而来；
- `ScopedLayers`（store.ts:159）：eager 全局层 + 惰性 exact-scope 层；命名项重复注册抛错，匿名项（restrictions/guards/suppressors）逐条唯一。

**restriction 的关键设计**（view():1186-1227 注释）：被过滤掉的全局工具 = 从提示与执行两个面同时消失（与不存在不可区分）——per-child capability filter 若做到"本 scope 自有注册"上会锁死子 scope，所以刻意豁免。

## 直观类比
像 **酒店房卡的分级**：全局注册是大堂设施（人人可用）；scoped 注册是套房内的家具（只这间房有，退房即清）；shadowing 是"套房里的同名家具盖过大堂的"；restriction 是房卡上写的"禁止进入泳池"（限制的是公共区，不限制你套房里的东西）；lineage 是"这间房是谁开的"（登记信息，不影响你能进哪里）。

## 实例 / 案例
- subagent 创建子代理 = 新 flat scope：父注册不继承；fork backend 只通过 `seed` 注入"平衡的已完成回合前缀"日志（kp-030）；
- agent preset 给某会话不同能力集：服务行带 `isolate` realm + preset 里的 `presentAs('ptc')`（architecture.md 扩展表）。

## 常见误区
- **以为 scope 会向子代理传播**：显式设计为 flat 两层，"子树行为"用 lineage 数据表达；
- **把 restrict 当白名单生成器**：它只过滤继承面；scope 自有注册永远在；
- **在 setup window 之外注册**：要么被拒要么晚到；注册必须发生在 publish 前。

## 自测题
1. 为什么事件"向上流不向下"？举一个依赖此性质的扩展场景。
2. 被 restriction 过滤掉的全局工具，模型尝试调用会发生什么？
3. `delegationDepth` 放在 lineage（数据）而不是 scope 结构里，换来了什么？

## 与其他知识点的关系
- kp-009 的创建事务定义 setup window 的位置；
- kp-030 的 subagent 是 scope 隔离的最大用户。

## 延伸阅读
- `docs/subsystems/scope.md`、`docs/glossary.md`（agent-scope 节是权威定义）
- `packages/core/scope/src/index.ts`（~200 行可通读）
