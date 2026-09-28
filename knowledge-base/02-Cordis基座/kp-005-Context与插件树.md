---
id: kp-005
title: Cordis Context 与插件树
domain: DeepSeek Harness
module: Cordis 基座
level: 核心
prerequisites: [kp-002, kp-004]
related: [kp-006, kp-022]
tags: [cordis, context, 插件树, fiber]
sources: [vendor/cordis/src/context.ts, vendor/cordis/src/index.ts, docs/cordis-primer.md, docs/cordis-tutorial/01-first-plugin.md]
status: reviewed
---

# Cordis Context 与插件树

## 一句话定义
Cordis 把每个运行中的 dsh 组织成一棵 **Context 树**：根 Context 挂载 Loader，Loader 按 patch 组合出的 entry 树并发激活插件；每个插件是一个 fiber（可独立卸载的执行单元），其上再派生子 Context。

## 为什么重要
这是 dsh 的"操作系统"：理解 Context 树的结构与激活规则，才能理解任何 `ctx.<key>` 从哪来、插件何时被激活、卸载时发生什么。

## 前置知识
kp-002；ESM 动态 import。

## 核心概念

| 概念 | 是什么 | 关键事实 |
|---|---|---|
| **Context** | 服务仓库 + 事件总线 + 生命周期容器 | `vendor/cordis/src/context.ts`；`ctx.get(key)` 取服务 |
| **插件（plugin）** | 三种形态：①带 `inject`/`apply(ctx)` 的函数 ②`Service` 子类 ③对象 | `docs/cordis-primer.md:9-13` |
| **fiber** | 插件的运行实例，拥有自己的 effect 列表 | 卸载 fiber = 回滚其全部 effect |
| **entry（行）** | patch 组合出的挂载单位：`{id, name, config, disabled, inject…}` | 激活由 **服务可用性** 驱动，行序无加载语义 |
| **Loader** | 读取组合树、动态 import 模块、管理激活的常驻插件 | `vendor/loader/`；模块替换（HMR）在 loader 内部实现 |

## 原理 / 机制

**激活规则**：Loader 拿到 entry 树后并发激活，但每个 entry 若声明 `inject: ['a','b']`，必须等对应服务在（祖先）Context 上可用才开始加载。这就是"就绪驱动"：

```yaml
# packages/bundle/headless/cordis.patch.yml:22-26
- id: headless-runner
  name: '@deepseek-ai/dsh-headless-runner'
  inject: [headlessStartup]            # 等 headlessStartup 服务激活
  config:
    task: !!js ctx.headlessStartup.task   # 求值也被推迟到激活后
```

**挂载协议**：`ctx.plugin(X)` 返回 Fiber。函数型插件的 `apply(ctx, config)` 在子 Context 上执行；`apply` 返回的函数就是该插件的 disposer（`docs/cordis-tutorial/02-lifecycle-and-effects.md`）。

**最小插件**（教程第一章的形状）：

```ts
export const inject = ['timer']            // 依赖声明（缺了就永远 PENDING）
export function apply(ctx, config) {
  ctx.on('session/event', (ev) => console.log(ev.type))
  return () => console.log('unmounted')    // disposer：卸载时回滚
}
```

**服务可用性的传播**：子 Context 能取到父 Context 的服务（lookup 向上冒泡），但事件不会跨树广播到不相关分支。

## 直观类比
Context 树像 **Linux 的进程树 + 环境变量继承**：每个插件是一个进程（有自己的生命周期与资源表），父进程的环境（服务）对子进程可见；kill 一个进程，它注册的所有回调一并释放。

## 实例 / 案例
- dsh 启动时 `boot()` 挂根 Include，Loader 读取 `dsh-base` 等 patch 组合出的约百行 entry 并发激活（kp-003 启动链路）；
- agent-loop 包在激活时 `ctx.provide('agentLoop', ...)`，随后任何声明 `inject: ['agentLoop']` 的插件才会被激活。

## 常见误区
- **以为 entry 行的书写顺序决定激活顺序**：顺序只影响"同优先级并发"的公平性，真正门槛是 inject 依赖；
- **以为插件卸载 = gc 回收**：必须靠 effect 回滚（kp-007），忘记返回 disposer 是最常见的泄漏源；
- **以为一个 package 一个插件**：一个包可导出多个插件（如 `dsh-agent-loop` 同时注册 machine 与 projection）。

## 自测题
1. 插件的三种形态分别适合什么场景？
2. `inject: ['timer']` 少了会怎样？（提示：教程 06 章——hmr 插件缺 timer 会永远 PENDING 且静默）
3. 子 Context 读服务与监听事件的方向有什么不同？

## 与其他知识点的关系
- kp-006 展开服务系统；kp-007 展开事件与 effect；kp-008 展开谁来决定挂载哪些行（patch）。

## 延伸阅读
- `docs/cordis-tutorial/01-first-plugin.md`、`02-lifecycle-and-effects.md`
- `vendor/cordis/src/index.ts`（公共 API 面）
