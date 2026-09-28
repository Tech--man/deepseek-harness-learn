---
id: kp-023
title: Capability Seam：三角色与"换一处、全产品变"
domain: DeepSeek Harness
module: 工具与能力接缝
level: 核心
prerequisites: [kp-006]
related: [kp-006, kp-021, kp-025, kp-026]
tags: [seam, 提供者, 沙箱, 执行世界]
sources: [docs/architecture.md §Capability seams, docs/capability-seams.md, docs/glossary.md §capability-seam, packages/shell/shell/src/index.ts]
star: true
status: reviewed
---

# Capability Seam：三角色与执行世界

## 一句话定义
seam = 一个可替换能力的 **三个角色**：Service Definition（拥有 `ctx.<key>` 与词汇类型的 Cordis Service，抽象类或具体注册类，绝不许用 TS interface）+ 一或多个 Service Provider + 一或多个 Consumer；关键设计是 **shell/fs/sandbox/subprocess 共享一个"执行世界"**——换 provider，Bash、PTY、LSP 全跟着走。

## 为什么重要
这是 dsh 架构文档明说的"多数改动的第一步决策"（architecture.md：事件选域第一，能力挂 seam 第二）。同时它是理解 60+ 包的读图法：任何包先问"它在这条 seam 里演哪个角色"。

## 前置知识
kp-006（Service）。

## 核心概念：主接缝总表（对照 docs/capability-seams.md 生成表）

| ctx key | Definition | Providers | Consumers |
|---|---|---|---|
| `ctx.subprocess` | `SubprocessRuntime`（spawn/spawnTerminal，凭据清洗） | subprocess-local / subprocess-ssh | bash-local、bash-sandbox、terminal-bash、lsp-stdio、subagent-* |
| `ctx.shell` | `ShellExecutor`（resolve+execute） | bash-local / bash-sandbox / pwsh-local | tool-bash、tool-pwsh、hooks 桥 |
| `ctx.sandbox` | `SandboxProvider.confine(argv, policy)` | sandbox-local（bwrap→landlock→Seatbelt→ACL 链）/ sandbox-ssh | bash-sandbox、terminal-bash |
| `ctx.sandboxPolicy` | 部署默认 mode + workspace root 唯一家 | — | bash-sandbox、fs-sandbox、terminal-bash |
| `ctx.fs` | `FileSystem`（resolve/stat/readText/writeText/editText…） | fs-local / fs-sandbox / fs-ssh | tool-fs、fs-observation-policy |
| `ctx.terminals` / `ctx.lsp` / `ctx.ptcRuntime` | 终端 / 语言服务 / PTC 程序运行时 | terminal-bash / lsp-stdio / ptc-runtime-node | tool-terminal / tool-lsp / `run_code` |

## 原理 / 机制：执行世界为什么联动

`bash-sandbox` 的声明（shell/bash-sandbox/src/index.ts:56-57）：

```ts
export class SandboxBashExecutor extends LocalBashExecutor {
  static inject = ['subprocess', 'sandbox', 'sandboxPolicy']
  // execute() = confine(argv) over ctx.subprocess
}
```

- 消费者交出 **精确 argv**，同世界的 sandbox backend 包一层（`confine(argv, policy, signal)`，sandbox/src/index.ts:177）；
- **per-call 策略而非 per-provider**：同一时刻 bash 可 read-only、受限子 agent 可写自己的状态目录（sandbox/src/index.ts:60-73 注释）；
- `sandboxPolicy` 是 mode 与 workspace root 的唯一家——bash 与 fs 都读它，防"围到不同 root"；
- 沙箱 runner 不可用 → 前台抛 `SANDBOX_UNAVAILABLE`（fail loud，不静默降级）；
- **升级（escalation）**：严格变宽表 `WIDER_MODES` + 目标词表 + `sandbox_permissions`+`justification` 配对校验（sandbox/src/escalation.ts:25-37），tool-bash 执行期调 `ctx.approval.request`。

**swap 的实际成本**：把 `bash-local` 行换成 `bash-sandbox` 行（patch 一行），或 `fs-local` 换 `fs-ssh`——工具层零改动。这就是"一处 provider swap 改变整个产品"的机制。

## 直观类比
执行世界像 **同一个厨房里的水电煤总闸**：bash、terminal、LSP 都是灶具；换"民用燃气"（local）为"中央管道气"（sandbox/ssh）只需改总闸接口（provider 行），灶具（工具层）不认识区别——但 policy 闸门（sandboxPolicy）决定每个灶眼此刻的开度。

## 实例 / 案例
1. `dsh sdk-minimal` 用 `sandbox-policy(danger-full-access)`——教学形态放开围栏（bundle 清单）；
2. `fs-observation-policy` 是 event-only 插件：WeakMap 按 owner 记录 read 观察，写/编辑前强制先读 + provider 端原子 no-clobber 复查——观察策略不占 seam 的服务位；
3. approval 的 `ApprovalOutcome` 闭集 fail-closed：无 answerer/异常 → `unavailable`（拒绝），从不在故障时放行。

## 常见误区
- **把 seam 说成单个包/单个接口**：三角色齐备才是 seam；一个角色不算（glossary 硬性规定）；
- **以为沙箱是工具的属性**：它是 provider 的能力，工具只交 argv；
- **以为 fs/bash 可以有不同 root**：`ctx.sandboxPolicy` 统一裁决，故意不允许。

## 自测题
1. 说出 `dsh-shell` 这条 seam 的三角色各是谁。
2. 为什么 service definition 禁用 TypeScript interface？
3. 设计一条新 seam（如"通知"）需要写哪三类代码？

## 与其他知识点的关系
- kp-025 展开 llm 这条最特殊的 seam；
- kp-026 盘点其余接缝与审批面。

## 延伸阅读
- `docs/capability-seams.md`（生成的全接缝表）
- `docs/cookbook/adding-a-tool.md`
