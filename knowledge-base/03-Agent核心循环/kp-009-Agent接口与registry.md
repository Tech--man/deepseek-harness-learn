---
id: kp-009
title: Agent 接口、live registry 与创建事务
domain: DeepSeek Harness
module: Agent 核心循环
level: 核心
prerequisites: [kp-006, kp-007]
related: [kp-010, kp-022, kp-030]
tags: [agent, registry, 创建事务]
sources: [packages/core/agent/src/index.ts, packages/core/agent/src/types.ts, packages/core/agent-loop/src/index.ts:479-640, docs/subsystems/core.md]
status: reviewed
---

# Agent 接口、live registry 与创建事务

## 一句话定义
`Agent` 的公开接口小到只有 `{ readonly id: SessionId }`——一切能力都通过 `ctx.agents` 注册表与 `agent/*` 事件暴露；Agent 的创建是一段 **有回滚的发布事务**（prepare → setup → publish → announce）。

## 为什么重要
"接口最小化 + 注册表中介"是 dsh 解耦 UI/插件/内核的手段：消费方（Web UI、SDK、工具）永不 import 循环实现，只依赖注册表与事件。这是理解后续一切 agent 交互代码的前提。

## 前置知识
kp-006（Service）、kp-007（事件域）。

## 核心概念

| 概念 | 事实 | 位置 |
|---|---|---|
| `Agent` 公开接口 | 仅 `{ id }`；实现类（`ReactLoopAgent`）包内私有 | agent/src/types.ts:15-18 |
| `AgentRegistry` | `create()/resume()/enter()/announce()`；owner fiber 拥有 `AgentHandle {agent, dispose}` | agent/src/index.ts:358-550 |
| `agent/created` | serial 事件：初始化失败 → 回滚创建 | index.ts:550 |
| initiator | `withInitiator(agent, op)`：driver 在其生命周期内以自身为 initiator 运行，工具的 `exec.agent` 由此而来 | index.ts:308-327 |
| SessionStartSource | `'startup' \| 'resume' \| 'clear' \| 'compact'` | — |

## 原理 / 机制：创建事务四步（agent-loop/src/index.ts:479-640）

```text
prepare()   构造 machine + memoized 反向 teardown：
            cancel({kind:'disposed'}) → whenIdle → scope.dispose → handle.close → detach agent/session
setup       在发布【前】注册 scoped 世界（工具/提示段）；setup 的同步 commit 也发布前执行
publish()   sessions.enter + agents.enter（原子可见）→ announce → serial agent/created
失败        任一步抛错 → 反向 teardown 全量回滚 → 不留半构造 Agent
```

**resume 路径**：`persistence.open(id,'write')`（排除并发恢复）→ `handle.read(0)` → `interruptedTurnClosers(log)` 为中断尾巴生成合成闭合事件（普通批次 append，不 emit `session/event`，:842-864）——崩溃恢复是"读 + 补写"，不是特殊分支。

**为什么接口这么小**：如果 `Agent` 暴露方法，消费方就要绑定实现包；dsh 让所有交互走事件（inbox/status/assistant-stream…），实现可以整个被替换（一切皆插件落到循环上的体现）。

## 直观类比
`ctx.agents` 像 **机场塔台**：飞机（Agent）内部结构对乘客不可见，所有交互——起飞许可（created）、位置广播（status）、降落（disposed）——都通过塔台协议（事件）进行；创建事务像航班注册：手续不全就不给放行，取消注册则全链路撤销。

## 实例 / 案例
fork 一个会话（docs/architecture.md 扩展表）：

```ts
ctx.agents.create({
  sessionId, seed, meta: { parentSession, seedLength }
})
```

`agent/created` 的监听者（如 subagent 包）在这段时间窗口（setup window，kp-022）内为该 agent 注册 scoped 工具。

## 常见误区
- **以为 `Agent` 对象上有一堆方法**（send/cancel/steer…）：那些在内部 machine 上，公开面走 registry + 事件；
- **以为 agent/created 失败后 session 文件已持久化**：发布前失败整树回滚，setup 窗口内 append 的内容走 `appendUnstoredSuffix` 私有通道，绝不经 `session/event` 重发（:698-706）；
- **把 resume 理解成"重新加载文件"**：它同时打开写句柄并补写合成闭合事件。

## 自测题
1. 为什么 Agent 公开接口只有 id？这一设计换来了什么测试性？
2. 复述创建事务的反向 teardown 链。
3. fork 的 `seedLength` 元数据在日志重放时有什么用？

## 与其他知识点的关系
- kp-010 讲创建后的机器如何运转；
- kp-022 的 setup window 定义发生在本事务的哪一步。

## 延伸阅读
- `docs/subsystems/core.md`（Agent Handle 与取消语义）
- `packages/core/agent-loop/README.md`（创建/teardown 顺序）
