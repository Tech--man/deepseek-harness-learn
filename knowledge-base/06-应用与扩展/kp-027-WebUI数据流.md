---
id: kp-027
title: Web UI：双通道数据流与 ConversationNode
domain: DeepSeek Harness
module: 应用与扩展
level: 进阶
prerequisites: [kp-016, kp-018]
related: [kp-016, kp-018, kp-028]
tags: [web, 数据流, conversation, 前端]
sources: [docs/subsystems/web-client.md, docs/subsystems/conversation.md, packages/client/connection/README.md, packages/client/ui-conversation/src/client/contract/conversation.ts]
status: reviewed
---

# Web UI：双通道数据流与 ConversationNode

## 一句话定义
浏览器端本身也是一个 Cordis 应用：**durable 事实**（session/event）走 packed Remote `follow`（首帧含 header+tail page+cursor+投影基线，之后按 seq 追加），**瞬态增量**（`assistant/live-chunk` 等控制事件）走 `/api/remote.mux` 多路复用 WebSocket——历史可重放、直播可丢失，两条通道在 ConversationNode 组装器汇合。

## 为什么重要
这是"会话日志即真相源"在 UI 的镜像：UI 不是另一份状态，而是同一份日志的另一个投影。读懂双通道，就懂了 dsh 如何做到刷新页面无感、断线原子恢复。

## 前置知识
kp-016、kp-018（投影/snapshot）。

## 核心概念

**技术栈**（web-client.md:5-26）：浏览器端是 Cordis 应用（plugin 图由 Host 写入 `window.__DSH_BOOT__`）；React 只做渲染层（`ui-renderer` 唯一用 `useSyncExternalStore` 绑定 observable）；模块系统是惰性 CommonJS 表；Vite 构建。

**传输**（connection/README.md:32,39）：
- unary：HTTP POST `/api`；
- 流：API Gateway 的 `/api/remote.mux` 多路复用 WebSocket（`@Remote({mode:'stream'})` 方法走它）——**不是 SSE**（SSE 只用于 HMR）；
- 认证：进程铸造随机 launch token → `GET /?token=...` 换签名 cookie；静态资源公开、RPC/WS 全要 browser session。

**双通道**（web-client.md:48,70-85）：
| 通道 | 内容 | 恢复 |
|---|---|---|
| durable 显示 | Session log → `follow`/`page` → SessionEventLikeEntry 窗口 → Conversation Contexts → target snapshot | 重连按 generation 原子替换窗口 |
| transient 控制 | control baseline → Remote snapshot stream → SessionManager stores → hooks → 组件 | Connection generation 源 `$events` |

**ConversationNode**（conversation.ts:196-239）：
- `ConversationNodeDefinition<State>` = `{ kind, target?, match(event)→按稳定(kind,id)关联, start(context,match,reader)→State, update()→State, publication?, Location }`；
- 每 Session 一个 `ConversationNodeAssembler`：把 durable/transient 条目喂给所有注册的 Definition，按 target 发布独立 source；
- Chat（ui-chat）与 Trajectory（ui-trajectory）各自注册 Definition/视图——**同一事件族、互不共享显示模型**；live chunk 是 Client-only transient 事件，历史回放读 message 内嵌流不展开 token 行。

**主题**（ui-theme/README.md）：light/dark/system + 内容字号 12–17px，存 `ui-theme` settings namespace（loopback 持久化到 profile patch）；全部颜色走 `--dsw-*` CSS token；第三方皮肤经 `ctx.theme` 注册 alias-token override 按序 fold。

## 直观类比
像 **新闻网站的双轨制**：已刊文章（durable events）从 CMS（session log）分页拉取、可检索可回看；直播间弹幕（live chunk）走推送通道、过了就过；版面编辑（ConversationNodeAssembler）把两路素材按模板（Definition）排进不同版面（Chat/Trajectory）。

## 实例 / 案例
- 打字机效果 = live-chunk；刷新后逐字重放效果 = message 嵌入压缩流的回放——两种"看起来一样"的动画，来源完全不同；
- 断线重连：客户端按 generation 原子替换事件窗口，`page()` 只在补旧历史/修 gap 时调用。

## 常见误区
- **以为 Web 端维护一份独立会话状态**：它只是日志的投影 + 瞬态层；
- **以为要监听所有 session/event 手工拼 UI**：注册一个 ConversationNodeDefinition 即可获得重放/快照/增量全套；
- **把主题色写死**：所有 UI 色值必须走 `--dsw-*` token，皮肤靠 alias override。

## 自测题
1. durable 与 transient 通道各自传输什么？为什么聊天内容不都走 live？
2. `follow()` 首帧为什么带"完整投影基线"？
3. Chat 与 Trajectory 为什么不共享显示模型？

## 与其他知识点的关系
- kp-028 的 Desktop 复用整个 Web 应用；
- kp-018 的 snapshot() 是 follow 基线的来源。

## 延伸阅读
- `docs/subsystems/web-client.md`、`conversation.md`、`web-server.md`
