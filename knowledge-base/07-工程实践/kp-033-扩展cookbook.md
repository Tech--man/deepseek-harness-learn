---
id: kp-033
title: 扩展实操：四本 cookbook
domain: DeepSeek Harness
module: 工程实践
level: 核心
prerequisites: [kp-021, kp-024, kp-032]
related: [kp-021, kp-023, kp-024, kp-032]
tags: [cookbook, 插件开发, 工具, adapter]
sources: [docs/cookbook/extension-cookbook.md, docs/cookbook/adding-a-package.md, docs/cookbook/adding-a-tool.md, docs/cookbook/adding-an-llm-adapter.md, docs/cookbook/adding-a-settings-card.md]
status: reviewed
---

# 扩展实操：四本 cookbook

## 一句话定义
官方 cookbook 把"给 dsh 加东西"收敛成四条流水线——**加包**（6 步）、**加工具**（9 节工具参考）、**加 LLM adapter**（4 节协议义务）、**加设置卡**（5 步）；另有 extension-cookbook 给出"特性 → 机制"的总映射表。

## 为什么重要
读完前 32 个知识点，这是动手清单。尤其 valuable 的是 extension-cookbook 的结论：**每个产品特性都对应一个文档化扩展点 listener，无一改 loop**（hook 系统、/goal、/loop、compaction、subagent、MCP、skills、cron 全部如此）。

## 前置知识
kp-021（工具管线）、kp-024（adapter 协议）、kp-032（门禁）。

## 核心概念

**① 加一个包**（adding-a-package.md，6 步）：
1. 建包：manifest 不变量清单（private、版本对齐根、`type:module`、exports 结构、cordis peer+dev 双声明、files 白名单）；
2. 注册根 configs：恰属一个 TS 聚合（client 包另有 `dsh.client` + `tsdown.client.ts` preset）；
3. 拓扑决策：三角色独立演化才拆包（`shell` trio 是模板）；
4. 写 README：kind 四选一 + **Model Experience 三段 H4**（What the model sees / Token effect / KV Cache effect）+ Known Limitations 章节；
5. 可选 locale 元数据（`locale/en.json` + icon ≤256KiB）；
6. verify：install → doc-sync → constraints/typecheck/lint → build+hygiene。

**② 加一个工具**（adding-a-tool.md，9 节参考）：
- 最小 `defineTool` 形状（typed）或裸 JSON-Schema；
- **execute 契约 9 条**：args 预校验、readonly 定义、执行身份冻结 + opaque token、单一 canonical JSON 返回值、throw=isError、尊重 `exec.signal`、`presentationMeta` 持久卡片数据、`exec.agent.inject()` 异步通知…；
- 长任务走 `ctx.jobs.start()`；
- 策略分层选择规则：pre-execute=可扩展策略 / guard=单调终拒 / execute=包装 dispatch / post-execute=变换 / result=只读观察（与 kp-021 三段一一对应）；
- UI 呈现需前置设计（Host presenter 纯函数、Web 卡片从 raw events 派生）。

**③ 加一个 LLM adapter**（adding-an-llm-adapter.md，4 节）：
- 形状：`LlmAdapter` 子类 + `ctx.llm.registerAdapter`（一 adapter 一 provider 路由，重复抛错）；
- **协议义务**：usage 先于 finish、finish 后不发、tool-call arguments 全程 RAW JSON 字符串流式 `argumentsDelta`、块 index 首见顺序、错误仅两条通道（throw `LlmError` 或 `finish{kind:'error'|'aborted'}`）、不支持的选项抛 `UNSUPPORTED_OPTION` 而非静默丢弃、replayState 最小无损 JSON 投影；
- 结构分离 wire/serialize/transport/translate/adapter（llm-deepseek 是模板）。

**④ 加一个设置卡**（adding-a-settings-card.md，5 步）：
1. Config schema 声明 `Volatile<T>` live 字段（`.get()` 读取、`.check()` 跨字段校验跑在 Host）；
2. 组合插件：`role('secret')` 出表单、credential references；
3. 验证编辑：patch 写入、实例身份不变、重启恢复、非法值拒绝且文件/live 值都不变；
4. 跨插件贡献 `plugins.detail.*` slot（按 subject kind 分发）；
5. browser 半身搭载规则（client module system 扫 `dsh.client`）。

**extension-cookbook 四形状**：工具插件 / hook 插件（waterfall typed decision）/ UI 插件（durable `session/event` + 瞬态 `agent/assistant-stream` 双消费）/ 外部协议驱动 + feature→mechanism 映射表。

## 直观类比
cookbook 像 **乐高说明书**：加包=拼一盒新积木（先看编号规则），加工具=造一个可重复按压的机关（压力测试写进合同），加 adapter=接一条新电源线（插头协议逐条列出，接错即烧），加设置卡=给积木装一个可调旋钮。

## 实例 / 案例
最小工具（形状摘录）：

```ts
ctx.tools.register(defineTool({
  name: 'echo', description: 'repeat input',
  inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
  output: { schema: { type: 'string' }, render: (o) => o },
  async execute(args, exec) { return args.text },
}))
```

## 常见误区
- **把 execute 当任意函数写**：9 条契约每条都对应一个系统假设（如 RAW JSON arguments 是为了流式组装）；
- **adapter 静默丢弃不支持选项**：协议要求 `UNSUPPORTED_OPTION`——静默降级是 bug 温床；
- **忘记 Model Experience 三段**：README 缺它会被 `verify-package-readme-model-experience` 拦下——"模型怎么用这个工具"是包契约的一部分。

## 自测题
1. 按 6 步在纸上设计你自己的第一个 dsh 包（做什么、拆不拆包、README 写什么）。
2. execute 契约里哪一条与 kp-015 的取消语义直接相关？
3. 为什么 adapter 的 usage 必须先于 finish？

## 与其他知识点的关系
- kp-021/024 是本页的机制底座；kp-032 的门禁是本页的质量闭环。

## 延伸阅读
- `docs/cookbook/` 另有 5 篇：adding-a-remote-api / adding-a-session-format-version / adding-a-vendored-package / maintaining-dsh-code-review / responding-to-pr-review-on-a-stack
