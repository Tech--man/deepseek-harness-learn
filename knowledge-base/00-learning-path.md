# 学习路径：七段航线

> 总时长约 10–14 小时。★ 为承重墙知识点，优先攻克；每段结束建议对照仓库自测。

### 第 1 段：建立坐标——dsh 是什么、为什么这样设计
先不进源码，建立"Agent Harness"的心智模型与 dsh 的版图（monorepo 地图、五种运行形态、时空可组合范式）。读完你应该能画出 dsh 的高层架构图。
- 参考：kp:kp-001、kp:kp-002、kp:kp-003、kp:kp-004
- 自检：能一句话说清 harness 与 agent、与框架、与 CLI 的边界。

### 第 2 段：Cordis 基座——一切皆插件的机制
进入 `vendor/cordis` 与组装层：插件树、Service、类型化事件、effect 回收、inject 等待，以及 profile→bundle→patch 的层叠组合与 HMR。这是读一切后续源码的地基。
- 参考：kp:kp-005、kp:kp-006、kp:kp-007、kp:kp-008
- 自检：能写出最小插件并解释 `disabled: !!js` 的求值时机。

### 第 3 段：Agent 核心循环——源码的心脏 ★★
Agent 接口与注册表、turn/step 状态机、inbox 与 steering、水瀑事件、请求准备/冻结/重试、流式与 assistant/attempt、取消与恢复。建议开着 `packages/core/agent-loop` 对照读。
- 参考：kp:kp-009、kp:kp-010、kp:kp-011、kp:kp-012、kp:kp-013、kp:kp-014、kp:kp-015
- 自检：默画 turn flow 图（docs/architecture.md 的那张）。

### 第 4 段：会话与上下文——真相源与投影
SessionEvent 追加日志、"model-visible means logged" 不变量、JSONL vN 文件格式与迁移链、deriveMessages 与 session projections、系统提示组装（surface node / request series）、compaction 压缩。
- 参考：kp:kp-016、kp:kp-017、kp:kp-018、kp:kp-019、kp:kp-020
- 自检：解释为什么重试不重复 pre-step，而压缩重试却要重新 prepare。

### 第 5 段：工具与能力接缝——可换供应商的能力面
工具注册与执行管线（barriers/rolling pool）、scope 机制（shadowing/restriction/setup window）、seam 三角色与"换一处全产品变"的执行世界（shell/fs/sandbox/subprocess）、llm 接缝与 DeepSeek wire extensions、MCP/skill/terminal 等其余接缝。
- 参考：kp:kp-021、kp:kp-022、kp:kp-023、kp:kp-024、kp:kp-025、kp:kp-026
- 自检：沿三角色复述 `dsh-shell` 这条 seam。

### 第 6 段：应用与扩展——从内核到产品
Web UI 数据流（durable vs live 双通道）、Desktop 三层结构、TS/Python SDK 与 JSON-RPC、subagent/goal/Ralph 编排、jobs/schedule/hooks/webhook 事件面。
- 参考：kp:kp-027、kp:kp-028、kp:kp-029、kp:kp-030、kp:kp-031
- 自检：解释 session/event 与 agent/* 两个事件域各自的消费者。

### 第 7 段：工程实践——把 60+ 插件包管起来的纪律
验证脚本族与测试矩阵、AGENTS.md 工程约定、四本 cookbook（加包/加工具/加 adapter/加设置页）、常见误区与设计取舍总账。
- 参考：kp:kp-032、kp:kp-033、kp:kp-034
- 自检：说出给 dsh 添加一个 model-facing 工具的完整步骤。
