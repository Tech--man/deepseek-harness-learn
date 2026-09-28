---
id: kp-028
title: Desktop：Electron 壳 / Desktop Host / Web 应用三层
domain: DeepSeek Harness
module: 应用与扩展
level: 进阶
prerequisites: [kp-003, kp-027]
related: [kp-003, kp-027]
tags: [desktop, electron, host, ipc]
sources: [apps/desktop/README.md, apps/desktop-host/src/index.ts:146-198, apps/desktop/src/preload-app.ts:84-86, apps/web/src/main.ts:15-30]
status: reviewed
---

# Desktop：三层结构

## 一句话定义
桌面版 = **Electron 壳**（apps/desktop）+ **Desktop Host**（Electron RunAsNode 子进程里的 profile runner，`runProfile({profile:'desktop'})`，默认端口 19387）+ **打包的 Web 应用**（`dsh-app://app/` 加载）；Node IPC 只承载 boot/readiness/shutdown 等低频信号，业务流量仍走 Web 的 RPC/WS。

## 为什么重要
它是"复用最大化的桌面化"范本：桌面端不是重写 UI，而是把 Web 应用整包搬进受控载体，再补上原生能力（目录选择、更新、快捷键）与专属 profile。

## 前置知识
kp-003（profile）、kp-027（Web 数据流）。

## 核心概念：三层职责

| 层 | 包 | 职责 |
|---|---|---|
| Electron shell | apps/desktop | 窗口、签名资源、preload 桥、HTTP 请求转发、单实例锁 |
| Desktop Host | apps/desktop-host | Electron Node 模式子进程，调用共享 CLI profile runner + 完整 Web 应用 |
| Web 应用 | apps/web 打包产物 | 与线上 Web 完全相同的前端，`dsh-app://` 协议加载 |

**关键事实**：
- 端口默认 **19387**（`args: ['--no-open','--port','19387']`，desktop-host/src/index.ts:151）；`webserver.config.port` patch 可覆盖；
- Electron 把应用 HTTP 请求转发给已认证 Host（丢弃 transfer-encoding/connection 头），bundle 响应标 `no-store`；WS 由 desktop carrier 认证（README:5）；
- 渲染进程 `dshDesktopBoot.ready()` 返回 `{injections, streamBaseUrl}`，注入 script 并设 `globalThis.__DSH_TRANSPORT__ = {ownsHost:true, streamBaseUrl}`（main.ts:23-25）；
- **profiles/desktop 独占**：CLI 不能 boot 或修改；Electron 与 `@deepseek-ai/dsh` 永远同版本（README:63-69）；打包标识 `desktop-runtime.json` 绑定 shell 版本/Node 版本/文件清单；
- 私有 Node IPC（`process.send`）承载 boot/readiness/**quit-inspection**（"会中断哪些任务 + armed scheduled reminders"）/update-tasks（:169-198）；
- 额外捆绑：独立 Python/Node/pnpm（primary-runtime）、office-docx/pptx/xlsx 技能。

## 原理 / 机制：boot injections 的时序
窗口立即加载打包 Web 资源 → 等 boot injections（preload 桥送入的原生能力清单）→ 才激活 client 插件（同一文档）。preload 只对 `dsh-app://app` 文档暴露 `dshDesktopBoot`（preload-app.ts:84-86）——协议隔离。

## 直观类比
像 **给 web 应用配了一个专职司机**（Host）：车（Electron 壳）只管驾驶与安全，司机负责打电话给同一家餐厅（CLI profile runner）按同一份菜单（desktop profile）出餐；乘客（Web UI）尝不出这家"分店"和总店的区别——除了能叫司机帮忙拿东西（原生桥）。

## 实例 / 案例
- 退出检查：quit-inspection 列出会中断的 jobs 与 armed reminders——用户确认后才退出（schedule 的 armed reminders 由此进入桌面生命周期）；
- 共享产品数据：CLI 与 Desktop 共享 `$DSH_HOME` 产品数据，但 executable packages、激活选择与锁文件分离（architecture.md:50-51）。

## 常见误区
- **以为桌面版有自己的 UI 代码库**：没有——就是打包的 Web 应用 + boot 注入；
- **以为 19387 是 Web 端口改了个数字**：它是 desktop profile 的 webserver，被 Electron 壳转发使用，不对外开浏览；
- **以为 `dsh desktop` 能启动桌面版**：该名字被 CLI 保留拒绝（kp-003）。

## 自测题
1. 为什么业务流量不走 Node IPC 而仍走 RPC/WS？
2. profiles/desktop 为什么必须被 CLI 屏蔽？
3. `desktop-runtime.json` 绑定三样东西，各防什么事故？

## 与其他知识点的关系
- kp-003 的应用启动是 Host 复用的底层；
- kp-027 的 Web 数据流原样运行在桌面里。

## 延伸阅读
- `apps/desktop/README.md`（分层图与版本表）
- `docs/architecture.md` §Desktop application
