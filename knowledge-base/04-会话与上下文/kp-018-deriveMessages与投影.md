---
id: kp-018
title: deriveMessages 与投影：从日志到模型历史
domain: DeepSeek Harness
module: 会话与上下文
level: 核心
prerequisites: [kp-016]
related: [kp-016, kp-019, kp-027]
tags: [deriveMessages, 投影, surface, 缓存]
sources: [packages/core/session/src/surface.ts:120-258, packages/core/session/src/index.ts:860-881, packages/session/session-projection/src/index.ts]
status: reviewed
---

# deriveMessages 与投影

## 一句话定义
`deriveMessages()` 沿 surface 节点从日志 **投影** 出模型历史（空内容不投影、替换生效、插件消息投影可改写），结果按 generation 缓存并逐对象深冻结；durable 状态的通用读取面是 `dsh-session-projection` 注册的纯 fold（`stateOf()` 读、`snapshot()` 裁剪给客户端）。

## 为什么重要
"日志 → 历史"的投影规则决定了模型每次看到什么。理解投影，就能精确回答"为什么这行旧消息不见了""为什么刷新后 UI 和模型看到的不一致"这类问题。

## 前置知识
kp-016（surface）。

## 核心概念

**投影规则**（surface.ts:120-158 的 `deriveEventMessage`）：
- user 消息原样；
- 空 content 的 system/developer/assistant → 投影为 null（无头节点 + 无活跃后继 = 无提示词）；
- 被替换节点：只有"最新替换"的替身内容生效；
- `contentGeneration`（含消息投影）/`replaceGeneration`（仅位置替换）两个代数对外暴露。

**缓存与冻结**（index.ts:860-881）：`derivedNodes / derivedGeneration` 缓存；每个 message 对象每 agent 只深冻结一次（kp-013 的 WeakSet）——投影结果是 **不可变快照**。

**session-projection seam**（session-projection/src/index.ts:199）：
- 注册单位 = 纯 fold：`{key, stateSchema, init, apply, stateVersion, wire}`；
- host 消费者激活期必须显式 require 该服务，缺失则显式失败（强制接缝，不做静默默认）；
- `stateOf(key)` 读类型化状态；`snapshot(key…)` 批量生成 **裁剪过的客户端视图**（cropped views）——kp-027 的 Web 数据流以此为基础；
- agent-loop 自带两个：`turnBoundary`（turn 号）与 `inbox`（带 splice 坐标校验）。

## 原理 / 机制：一次请求历史的诞生

```text
日志（append-only） ──surface 追加/替换──▶ 表面节点集
   │ deriveMessages()（缓存 by generation）
   ▼
模型历史（不可变、冻结）
   + header.config/header.tools（kp-013 冻结证据）
   ▼
构建请求 → 发送（llm/stream）
```

**为什么缓存有效**：surface 只追加，替换是事件；generation 单调递增 → 缓存键随事件数自动失效。

## 直观类比
像 **数据库的物化视图**：表（日志）只插入；视图（投影）带版本号（generation）增量维护；查询方拿到的行对象是冻结的，防"读到的历史被并发改掉"。

## 实例 / 案例
- runtime-context 快照（时间/cwd/文件引用…）作为 `user/message(source: runtime-context)` 落日志，且"内容没变就不投影"（RuntimeContextProjection 只在内容变化或被替换删除时生成新快照，agent-loop/runtime-context.ts:114-164）；
- Web 客户端订阅 `session/event` 的同时用 `snapshot()` 做初始全量——首屏快照 + 增量事件无缝衔接。

## 常见误区
- **以为投影可以带副作用**：fold 必须纯；副作用请监听事件；
- **以为换 provider 需要重新投影历史**：不需要——投影是 provider 无关的；图片降级等 modality 适配发生在请求装配期（kp-024）；
- **在 detached 场景（如外部工具读日志）忘带投影定义**：消息投影读出来会不同——文档要求显式复刻定义。

## 自测题
1. 空 content 的 system 消息什么时候会"消失"？这服务于什么设计（提示：kp-019）？
2. `snapshot()` 与 `stateOf()` 的分工是什么？为什么 Web 要 cropped view？
3. 写一个统计每 turn 工具调用数的 projection 骨架。

## 与其他知识点的关系
- kp-019 依赖本机制的 system 节点语义；
- kp-027 的双通道数据流一半建在投影上。

## 延伸阅读
- `docs/subsystems/session.md` §plugin-owned message projections
- `.agents/notes/implemented/architecture/2026-08-19-session-projection-mandatory-seam.md`
