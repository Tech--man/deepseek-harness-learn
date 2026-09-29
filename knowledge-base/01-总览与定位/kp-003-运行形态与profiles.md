---
id: kp-003
title: 运行形态：五种 profile 与 CLI/Desktop 入口
domain: DeepSeek Harness
module: 总览与定位
level: 入门
prerequisites: [kp-002]
related: [kp-008, kp-027, kp-028, kp-029]
tags: [profile, cli, 运行形态]
sources: [README.md, docs/architecture.md, docs/user/guide/index.md, docs/user/guide/providers.md, docs/user/guide/network-proxy.md, apps/cli/src/bin.ts, apps/cli/src/profile-boot.ts]
status: reviewed
---

# 运行形态：五种 profile 与 CLI/Desktop 入口

## 一句话定义
一个 dsh 应用 = 一个 **profile**（有序 bundle + 用户补丁的组合配方），`dsh <profile>` 或 `dsh --profile <name>` 启动；出厂五种形态 `web` / `headless` / `sdk` / `sdk-minimal` / `acp`，另有两个特权形态 `plugin`（插件管理）与 `desktop`（Electron 保留）。

## 为什么重要
同一个内核长出五种产品形态，验证了"一切皆插件"的成色：形态差异只体现在 bundle 叠加层，不体现在 fork 源码。

## 前置知识
kp-002（profile/bundle 概念）。

## 核心概念

| 形态 | 命令 | 叠加的 bundle | 干什么 |
|---|---|---|---|
| **web** | `dsh web` | dsh-base + dsh-web-app | Web UI @ `127.0.0.1:3080`（浏览器会自动打开，SSH 场景只打印 URL；`--no-open` 禁止开浏览器） |
| **headless** | `dsh --profile headless` | dsh-base + dsh-headless | 一次性运行器：无 HTTP 服务、无 UI，跑完即退，禁 HMR |
| **sdk** | 由 TS/Python SDK 选择 | dsh-base + dsh-sdk-app | JSON-RPC 服务端，供 SDK 驱动 |
| **sdk-minimal** | Python minimal 示例 | 仅 dsh-sdk-minimal（**不复用 dsh-base**，自带完整显式插件树） | 精简教学/嵌入形态，直接读 `DEEPSEEK_API_KEY` |
| **acp** | `dsh acp` | dsh-base + dsh-acp-app | 纯自动化 ACP（Agent Client Protocol）服务器，stdout 归协议 |
| **plugin** | `dsh plugin`（需显式 `--profile plugin` 才能注册同名 profile） | — | 插件管理命令面（install/enable/版本豁免） |
| **desktop** | Electron 应用内部 | 桌面专属 | `dsh desktop` 被保留拒绝（args.ts:83-85），由 apps/desktop 承载 |

## 原理 / 机制：`npx @deepseek-ai/dsh web` 之后发生了什么

```text
bin.ts runCli()                         apps/cli/src/bin.ts:18-38
 ├─ 解析 launcher flag（--profile/--patch/--dump-config…其余原样传给应用）
 ├─ profile-boot.ts runProfile(:244)
 │   ├─ composeProfile：按序加载 bundle 补丁 + 用户层
 │   ├─ prepareProfile：重写空根 cordis.yml（仅作 include baseUrl 锚点）
 │   ├─ createRuntimeResolution：包安装优先 + bundle 有序 BFS 的运行时解析表
 │   └─ boot()：挂根 Include → Loader 并发激活插件树
 │       ├─ 先 provide('profileContext') + launch environment（apps/cli/src/profile-boot.ts:296-312）
 │       └─ 必需服务（agent-loop/webserver/modules/connection…）任一失败 → 全树 dispose → StartupError 诊断 → exit 1
 └─ web-startup 提供 ctx.webStartup → webserver 行 port: !!js ctx.webStartup.port ?? 3080
```

要点：
- **行序无加载语义**——激活由服务可用性（inject 依赖）驱动（base patch 头注释）；
- **`dsh <name>` 是 `--profile <name>` 的缩写**（args.ts:92）；其余 flag 不被 launcher 消费，而是作为 `cmdlineArgs` 交给应用层（profile-boot.ts 头注释）；
- **Desktop 是三层特例**：Electron 壳内启动私有 Desktop Host（Node 模式），Host 再调用共享 CLI profile runner 与完整 Web 应用；默认端口 `19387`，桌面独占 `$DSH_HOME/profiles/desktop`（docs/architecture.md:48-56）。

## 用户入门操作面（官方 guide 档，2026-09-28 交叉验证补入）

从"使用者"视角（对应官方站 guide 档三页）走一遍 web profile 的最小闭环：

- **配置模型**（guide/providers）：Web UI **设置 → 模型**输入 DeepSeek API 密钥即保存，模型路由**下一次请求立即生效、无需重启**。密钥是**只写**的——页面只收到脱敏描述符，明文存 `$DSH_HOME/.credentials.yaml`，settings 只留凭据引用。第三方 provider 直接选 dsh 自带 id（`anthropic`/`openai`/`moonshotai`/`zai`）；中转站走**自定义模型 API**：小写 Provider ID（**永久不可改**）+ baseURL + 协议三选一（`openai-completions` / `openai-responses` / `anthropic-messages`，与 kp-024 协议表一致）+ 模型目录探测。
- **工作区**：Web UI 默认不选任何工作区，会话输入框在选中工作区前不可用；`dsh` 进程把启动目录作为默认文件系统位置。
- **网络代理**（guide/network-proxy）：出站请求（模型调用/web 搜索/抓取/HTTP MCP）走标准 `HTTPS_PROXY`/`HTTP_PROXY` 环境变量，启动时读取；也可写 `$DSH_HOME/.env`。安全细节：**项目自己的 `.env` 不能设置代理变量**——DSH 宁可拒绝启动，也不让一个 clone 下来的仓库决定你的流量去向；代理 URL 含凭据时绝不回显。DSH 不读操作系统代理设置（macOS "系统代理"只对浏览器生效），TUN 模式除外。

## 直观类比
profile 像航司的 **机型配置**：同一架飞机（内核+插件池），客舱布局（bundle 叠加）决定它是客运（web）、货运（headless）还是改装侦察机（acp）。

## 实例 / 案例
```sh
dsh web                      # 交互式 Web UI
dsh --profile headless "解释这段代码"   # 一次性运行
python -c "import deepseek_harness"    # Python SDK 内部替你启动 sdk profile
dsh --profile web --patch my.yml --dump-config   # 自定义补丁并预览组合
```

## 常见误区
- **以为 `dsh web` 的 3080 是写死的**：webserver 行的端口是 `!!js` 表达式，`--port` flag 或 patch 都能覆盖（web-app/cordis.patch.yml:168）；
- **以为 sdk-minimal 是 sdk 的精简版**：它刻意不叠加 dsh-base，是"一包一树"的独立形态（docs/architecture.md:27-28）；
- **以为 CLI 可以管理桌面 profile**：桌面 profile 由桌面端独占，公共 CLI 被拒绝（architecture.md:50）。

## 自测题
1. 五种出厂 profile 各自的边界（有无 HTTP/有无 UI/是否复用 base）？
2. launcher 收到 `dsh web --port 4000` 后，`--port` 走了什么路径？
3. 为什么必需服务失败要"全树 dispose"而不是部分降级？

## 与其他知识点的关系
- kp-008 详细展开 bundle/patch 组装与 `--dump-config`；
- kp-027/028/029 分别展开 web、desktop、sdk/acp 形态的内部。

## 延伸阅读
- `docs/architecture.md` §Profiles and bundles / §Application launch / §Desktop application
- `apps/cli/README.md`（层叠顺序的权威表述）
