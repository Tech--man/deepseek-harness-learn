---
id: kp-006
title: Service 与 ctx key：服务定义、声明合并与注入等待
domain: DeepSeek Harness
module: Cordis 基座
level: 核心
prerequisites: [kp-005]
related: [kp-007, kp-023]
tags: [service, ctx, inject, 类型合并]
sources: [vendor/cordis/src/service.ts, vendor/cordis/src/registry.ts, docs/cordis-tutorial/03-services.md, docs/user/develop/framework/service.md, docs/glossary.md]
status: reviewed
---

# Service 与 ctx key

## 一句话定义
Cordis 的 Service 是占据 `ctx.<key>` 的长命对象：实现类继承 `Service` 并 `super(ctx, '<key>')`，类型侧用 **声明合并** 把 key 写进 `Context` 接口；消费方用 `inject = ['<key>']` 声明依赖，未就绪时插件保持 PENDING。

## 为什么重要
`ctx.tools`、`ctx.sessions`、`ctx.llm`、`ctx.agentLoop`……dsh 的整个能力面都通过这单一机制暴露。这是读懂任何子系统入口的钥匙，也是 capability seam（kp-023）的"服务定义"角色的物理形态。

## 前置知识
kp-005（Context/插件树）。

## 核心概念

| 角色 | 代码 | 位置 |
|---|---|---|
| Service 实现类 | `class GreeterService extends Service { constructor(ctx){ super(ctx,'greeter') } }` | 教程 03 章 |
| 类型声明合并 | `declare module '@deepseek-ai/cordis' { interface Context { greeter: GreeterService } }` | 同上 |
| 提供服务 | `ctx.provide('greeter', service)` 或插件即 Service 类 | `vendor/cordis/src/service.ts:35-57` |
| 消费等待 | `export const inject = ['greeter']` | `vendor/cordis/src/registry.ts:19` |

## 原理 / 机制

**生命周期绑定**：Service 构造时通过 `ctx.reflect.provide(name, this)` 登记到自己的 fiber；fiber 卸载时服务自动注销——服务生命 ≤ 插件生命，不会悬空。

**注入等待（PENDING）**：Loader 对声明 `inject` 的 entry，只有在 key 可达后才动态 import 并 apply。两处关键推论：
1. **配置惰性求值**：entry config 中的 `!!js ctx.xxx` 表达式在依赖激活后才求值（vendor README 修改 15）——所以 patch 里能安全引用服务；
2. **静默 PENDING 陷阱**：依赖名拼错或目标插件失败时，本插件永远不激活且无报错（教程 06 章以 hmr 缺 timer 为例）。

**dsh 的 ctx key 全景**（docs/architecture.md 核心包表 + 组合 YAML）：

| key | 服务 | 所属包 |
|---|---|---|
| `ctx.sessions` | 会话日志与存储句柄 | core/session |
| `ctx.systemPrompt` | 提示组装器 | core/system-prompt |
| `ctx.tools` | 工具注册表 | core/tools |
| `ctx.agents` | Agent live registry | core/agent |
| `ctx.agentLoop` | 默认循环驱动 | core/agent-loop |
| `ctx.llm` | 模型适配接缝 | llm/llm |
| `ctx.shell` / `ctx.fs` / `ctx.sandbox` / `ctx.subprocess` | 执行世界 | shell/fs/sandbox/subprocess |
| `ctx.pluginManager` / `ctx.webhookRuntime` / `ctx.goals` … | 其余能力 | boot/webhook/goal |

## 原理补充：可选依赖、消失重载与隔离（官方 develop/framework 档，2026-09-28 交叉验证）

- **必需 vs 可选**：`inject: ['tools']` 是必需依赖——服务缺席时插件不加载；可选依赖则**省略 inject**，在使用点用 `ctx.get('metrics')?.record(...)` 查询（可空处理）。用哪个取决于"这个插件离开该服务还有没有意义"。
- **服务消失的自动行为**：运行中某项必需服务消失（如提供方被卸载）→ 依赖它的插件**自动 dispose**；服务重新出现 → **自动重新加载**。这条防止插件调用已不存在的服务，也让"换 provider"（kp-023）在运行时是安全的。
- **服务隔离**：`cordis.yml` 支持 `group: true` + `isolate: { shell: true }`——同一个服务可以有多个实例，不同插件组看到不同实例（两组各配一个 `timeoutMs` 不同的 `dsh-bash-local`，互不影响）。服务可见性是**树结构**层面的裁决，不是全局单例。
- **插件三形态**：函数（`export function apply(ctx)`）、对象（`export default { name, inject, apply }`）、类（`export default class extends Service`）。官方建议：函数形式为默认，需要向其他插件提供服务时用类形式。

## 直观类比
Service 像 **操作系统里的设备驱动**：`ctx.<key>` 是设备文件（/dev/xxx），inject 是"驱动加载完成"的 udev 事件——应用不必轮询设备是否就绪，就绪前你的程序根本不启动。

## 实例 / 案例
- `session-title` 插件头：`export const inject = ['sessionTitle']`…实际形态是反向——它 *提供* `ctx.sessionTitle`（`packages/session/session-title/src/index.ts:356` 附近），而消费它的组件靠事件 `session/event` 工作；
- `sdk-jsonrpc-server` 声明 `inject: ['sdkAppStartup','loader']`（sdk-app patch），把启动服务和 Loader 本身都变成依赖。

## 常见误区
- **用 TypeScript `interface` 定义 seam**：glossary 明确禁止——服务定义必须是抽象类或具体注册类，因为运行时要走原型链（docs/glossary.md）；
- **以为 provide 之后立刻可 get**：跨 fiber 的可见性仍受树结构约束，且类型上 `ctx.get('x')` 可能是 undefined，消费方应配合 inject；
- **把常量配置塞 Service**：一次性配置应进 patch 行 config，Service 只承载有行为的状态。

## 自测题
1. 写出"提供 `ctx.greeter`"的完整四件套（类/声明合并/注册/消费）。
2. 为什么 `!!js` 表达式能安全引用 `ctx.headlessStartup`？
3. dsh 里 `ctx.agentLoop` 与 `agent/*` 事件各解决什么问题？

## 与其他知识点的关系
- kp-007（事件/effect）是与本点并列的另一根支柱；
- kp-023（seam）讲"服务定义"如何成为可替换能力的契约面。

## 延伸阅读
- `docs/cordis-api/service.md`、`registry.md`
- `vendor/cordis/src/service.ts`（提供/注销实现，~100 行可通读）
