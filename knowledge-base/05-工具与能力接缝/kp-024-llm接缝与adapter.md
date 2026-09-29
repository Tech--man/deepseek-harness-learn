---
id: kp-024
title: llm 接缝：词汇表、adapter 与 DeepSeek wire extensions
domain: DeepSeek Harness
module: 工具与能力接缝
level: 进阶
prerequisites: [kp-013, kp-023]
related: [kp-013, kp-019, kp-023]
tags: [llm, adapter, streaming, wire extensions]
sources: [packages/llm/llm/src/{types,message,index,call-config}.ts, packages/llm/llm-deepseek/src/{wire-types,serialize,translate}.ts, docs/deepseek-llm-api-wire-extensions.md, docs/user/develop/practice/llm-adapter.md, docs/user/guide/providers.md]
status: reviewed
---

# llm 接缝

## 一句话定义
`ctx.llm`（`LlmRuntime`）持有 provider 中立的词汇表（内容块/消息/流块/用量），adapter 经 `registerAdapter(providers, adapter)` 注册（all-or-nothing、可原子换路由），每次调用穿过 `llm/stream` waterfall；DeepSeek 官方 adapter 以 Anthropic Messages 兼容子集直连，并携带一套 `dsh_*` wire extensions 与 HTTP 头扩展。

## 为什么重要
这是"换发动机"的那条 seam。它的词汇表设计（merge-extensible vs closed map）直接决定新能力如何无痛加入；`prepareCall` 的能力声明则反向控制循环的行为（kp-013/019）。

## 前置知识
kp-013（PreparedLlmCall）、kp-023（seam）。

## 核心概念：词汇表速查（llm/src/types.ts、message.ts）

| 类型 | 关键内容 | 开放性 |
|---|---|---|
| `ContentBlockMap` | text / reasoning / image / file / tool-call / tool-addition / tool-removal | merge-extensible（可扩展） |
| `MessageRoleMap` | system / developer / user / assistant / tool（tool 是一等 `ToolResultMessage`） | closed（封闭） |
| `StreamChunk` | block-start / text-delta / reasoning-delta / tool-call-delta / block-end / usage / finish | 封闭 |
| `FinishReasonMap` | stop / tool-calls / max-tokens / aborted / error | merge-extensible |
| `TokenUsage` | `inputTokens` 只计未缓存输入；缓存单列 cacheRead/cacheWrite | — |
| `GenerateOptions` | provider/model/reasoningEffort/messages/system/tools/toolHistory/…/`purpose: 'compaction'\|'session-title'` | — |
| `LlmResolvedModelInfo` | context/defaultMaxTokens/reasoning/`systemPromptUpdate`/`toolUpdate: 'in-history'\|'addition-only'` | 模型能力元数据 |

## 原理 / 机制

**adapter 注册与 dispatch**（llm/src/index.ts）：
- `registerAdapter(providers[], adapter)` all-or-nothing，重复路由抛 `DUPLICATE_ADAPTER`；handle 带 `replace(providers)` 原子换路由（:416-423）；
- adapter 契约唯一必须实现 `stream(options)`；`prepareCall` 默认实现 = resolveModel + 绑定 stream（:278-283）；**动态 adapter 覆写 prepareCall 把"模型元数据代"与"dispatch 代"绑死**——防 HMR 期间拿 A 代能力配 B 代 endpoint（:269-277 注释）；
- 每次 dispatch 过 `llm/stream` waterfall（retry/replay/路由中间件可短路）；`llm-replay`（test-support）就注册为普通 provider。

**能力准入**（resolveCallWithInfo，:892-926）：
- 显式请求不支持的 `reasoningEffort` → 进 provider I/O **之前**抛 `UNSUPPORTED_REASONING_EFFORT`（无 clamp、无别名）；
- 不支持 image 的路由：history 里的图整体投影为文本占位（:1070-1074）；file 块一律投影 handle 文本；
- `toolUpdate` 决定中途换工具走完整声明还是 in-history 增删块（:1076-1077）。

**DeepSeek wire extensions**（docs/deepseek-llm-api-wire-extensions.md）：
- HTTP 头：`x-deepseek-harness-user-id / -session-id`、`x-deepseek-harness-compact: 1`（压缩请求标记）；
- 请求体顶层 `dsh_plugin_packages`（激活包清单）与 `dsh_session_log`（会话日志连续后缀 + 水位 + 2xx 后追加 delivery-accepted 事件，maxBytes 默认 8MiB）；`dsh_session_log` 的 `enabled` 是 **Volatile 配置**（自 2026-09-28 起）——每个请求重新读开关，运行中切换无需重注册插件；
- 扩展接缝 `ctx.deepseekLlmApiExtensions`：provider 注册唯一字段，`prepare(request)→{value, accept?()}`；**事务**：先序列化 base body → 合并（撞名抛 `REQUEST_EXTENSION`）→ **HTTP 2xx 后才 accept()** 提交付货状态——重复投递永远优于缺口；
- reasoning 回写：历史里的 reasoning 块序列化为 `{type:'thinking', thinking, signature?}`；`purpose:'session-title'` 强制关思考（serialize.ts:146）。

**第二 adapter**：`llm-pi-ai` 多 provider/OpenAI 兼容（协议表 openai-completions / openai-responses / anthropic-messages；`apiKeyEnv` 每请求经 `ctx.credentials` 解析——**密钥永不进配置**，assertUsableApiKey 只报 ref 位置）。

**adapter 作者义务**（官方 develop/practice/llm-adapter 档，2026-09-28 交叉验证——实操视角补 cookbook 的协议版）：
- **StreamChunk 协议逐型**：`block-start`（index 从 0 递增）→ `text-delta`/`tool-call-delta` → `block-end`（携带**完整块**）→ `usage` → `finish`（reason kind `stop` | `tool-calls`）。硬规则：每个 block-start 必有配对 block-end；**usage 必须在 finish 之前；finish 必须是最后一个分片**；`argumentsDelta` 是原始 JSON 文本增量（可一片发完也可多片）。
- **`resolveModel(provider, model, signal?)`**：一次查询返回确切提供方/模型身份 + 可选 `context`/`reasoning` 元数据（有序**不透明 ID** + 展示名 + 可选配置默认值；保留 adapter 给出的权威可选列表，**包括上游能力 API 的 `off`，不得提升为核心枚举**）；异步查询必须响应 signal 使取消完全停稳。服务在调用 `stream()` 前校验并拒绝显式指定但不支持的推理强度；省略 `reasoning` = 该模型无可选推理强度。
- **`listModels()`**：adapter 能公布模型选项时覆写，供选择器使用。
- **每次提供方 HTTP 请求必须合并 `attributionHeaders()`** 并透传 `options.signal`；传输/协议故障抛**带稳定 code 的 `LlmError`**（如 `PROVIDER_HTTP_ERROR`），agent loop 保留 code 供诊断与策略——不要指望普通 `Error` 被自动转换。

## 直观类比
词汇表像 **海运集装箱标准**：箱型（块）可扩展（新箱型大家投票加），但船舱布局（角色）封闭；adapter 是 **船公司**：登记航线（providers）后准时开船，能力单（model info）决定这班船能不能运冷藏箱（图片）；wire extensions 是 **随船报关单**（dsh_* 字段）——海关确认收货（2xx）才算签收。

## 实例 / 案例
- compaction 与 session-title 复用同一 runtime，但 `purpose` 标记让 adapter 区别对待（title 强制关思考）；
- 多 provider 共存：`deepseek-official` 与 pi-ai 路由同时挂载，路由名不冲突。

## 常见误区
- **以为 TokenUsage.inputTokens 是 prompt 总量**：DeepSeek 折叠总量的 adapter 必须自行扣除缓存部分；
- **以为 extension 合并失败会重发整个请求**：序列化失败只发 base body 并跳过 accept——下轮重发扩展（宁可重复不可缺口）；
- **在 llm/stream 监听者里改消息**：请求内容是日志的纯函数，监听者只读（index.ts:67-74）。

## 自测题
1. `toolUpdate:'in-history'` 与 `'addition-only'` 分别导致 kp-019 的什么行为？
2. 为什么 adapter 必须绑死元数据代与 dispatch 代？
3. `accept()` 延迟到 2xx 之后，如果进程在 2xx 前崩溃会怎样？

## 与其他知识点的关系
- kp-019 的 surface node 决策消费 `systemPromptUpdate`；
- kp-020 的摘要请求走同一 runtime（purpose:'compaction'）。

## 延伸阅读
- `docs/deepseek-llm-api-wire-extensions.md`
- `packages/llm/llm/README.md`（词汇表权威）
