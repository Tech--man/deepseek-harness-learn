# 覆盖矩阵

检查知识库是否覆盖一个工业级 Agent Harness 的完整面向。✅=本库覆盖；◐=点到为止；⬜=明确划出边界（见 README"边界说明"）。

## 维度一：按领域分层

| 领域 | 概念/机制 | 覆盖 | 知识点 |
|---|---|---|---|
| 基础认知 | Agent Harness 概念、与同类产品对比 | ✅ | kp-001 |
| | dsh 定位、monorepo 地图、"一切皆插件" | ✅ | kp-002 |
| | 五种运行形态与 CLI/Desktop 入口 | ✅ | kp-003 |
| | 时空可组合编程范式（Cordis 论文） | ✅ | kp-004 |
| 框架基座 | Context / 插件树 / 加载生命周期 | ✅ | kp-005 |
| | Service 与 ctx key、类型声明合并 | ✅ | kp-006 |
| | 类型化事件（5 种派发）、effect 回收 | ✅ | kp-007 |
| | profile→bundle→patch 层叠、dump-config、HMR | ✅ | kp-008 |
| 核心循环 | Agent 接口、live registry、agent/* 事件 | ✅ | kp-009 |
| | turn/step 状态机、turn flow | ✅★ | kp-010 |
| | inbox、steering、inject 上下文 | ✅ | kp-011 |
| | 水瀑事件与 next() 语义 | ✅ | kp-012 |
| | 请求准备/冻结/重试、series 语义 | ✅ | kp-013 |
| | 流式、assistant/message vs attempt | ✅ | kp-014 |
| | 取消与错误恢复 | ✅ | kp-015 |
| 会话上下文 | SessionEvent 日志、model-visible means logged | ✅★ | kp-016 |
| | JSONL vN 格式、zstd、generation 迁移 | ✅ | kp-017 |
| | deriveMessages、session projections | ✅ | kp-018 |
| | 系统提示组装（surface node、request series） | ✅ | kp-019 |
| | compaction（pressure/overflow、两步恢复） | ✅ | kp-020 |
| 工具接缝 | 工具注册、执行管线、executionMode 并发 | ✅ | kp-021 |
| | scope（scope key/shadowing/restriction/setup/lineage） | ✅ | kp-022 |
| | seam 三角色、执行世界（shell/fs/sandbox/subprocess） | ✅ | kp-023 |
| | llm 接缝、adapter、DeepSeek wire extensions | ✅ | kp-024 |
| | 其余接缝（MCP/LSP/terminal/browser/computer/PTC/skill） | ✅ | kp-026 |
| | 审批与安全策略（approval/permission/SAFETY） | ✅ | kp-026 |
| 应用生态 | Web UI 数据流、ConversationNode | ✅ | kp-027 |
| | Desktop 三层结构 | ✅ | kp-028 |
| | TS/Python SDK、ACP | ✅ | kp-029 |
| | subagent / agent teams / goal / Ralph | ✅ | kp-030 |
| | jobs/schedule/hooks/webhook/命令面 | ✅ | kp-031 |
| 工程实践 | 验证脚本、测试矩阵、CI、monorepo 约定 | ✅ | kp-032 |
| | cookbook：加包/工具/adapter/设置页 | ✅ | kp-033 |
| | 常见误区与设计取舍 | ✅ | kp-034 |
| | 打包与安装：bundle/profile 双 manifest、四层加载顺序 | ✅ | kp-035 |

## 维度二点五：官方技术预览站三档对照（2026-09-28 交叉验证）

| 官方站档位 | 内容 | 本库落点 |
|---|---|---|
| **guide**（用户操作） | 使用 Web UI / 配置模型 / 网络代理 / Python SDK / GitHub 评审会话 / 会话提醒 / 记忆 MCP | kp-003「用户入门操作面」、kp-029、kp-026（记忆 MCP）；github-review / schedule 两页为功能运维向，仅留链接 |
| **develop**（插件作者） | 第一个插件 / tool DSL / 插件配置 / 打包与安装 / 生命周期 / 服务 / 事件 / 三层拆分 / LLM adapter / dynamic-cordis | kp-035（新）、kp-005/006/007/008（补 fiber 状态机、可选依赖、处置器并发、Schemastery、服务隔离、提示词驱动配置）、kp-024（adapter 实操义务）、kp-033（入门阶梯互链） |
| **reference**（架构参考） | architecture / capability-seams / agent-lifecycle / tool-execution-pipeline / api-gateway / cordis-primer / subsystems ×59 | 本库一手来源，抽查一致（kp-010/012/021/023 等）；官方中文定名见 99-术语表 |

## 维度二：按学习法要求

| 要求 | 状态 |
|---|---|
| 基础概念与术语 | ✅ kp-001~004 + 99-术语表 |
| 核心原理与机制 | ✅ 02/03/04/05 模块 |
| 关键模型/公式/图示 | ✅ turn flow 图、层叠图、seam 图（源码与文档引用） |
| 实践案例/工具/工作流 | ✅ 各 KP"实例"节 + kp-033 cookbook |
| 进阶专题与前沿 | ✅ HMR、迁移链、投影、agent teams、Ralph（kp-008/017/018/030） |
| 历史脉络 | ◐ 版本演进以 git log/PR 号为锚（0.1.x 迭代快），不展开编年史 |
| 常见误区/争议/伦理 | ✅ kp-034 + 各 KP"常见误区"节；安全见 kp-026 与 SAFETY.md 讨论 |
| 自测题 | ✅ 每个 KP 一节 |
| 知识点互联 | ✅ frontmatter related + 站点"相关知识点" |

## 留白（有意不做）
- 逐行源码注释版（体积失控；每个 KP 的 `sources` 指向入口文件）；
- Windows 平台差异细节（base bundle 用 `disabled: !!js process.platform === 'win32'` 门控，规则已提，枚举不展开）；
- 桌面端签名/公证等发布工程。
