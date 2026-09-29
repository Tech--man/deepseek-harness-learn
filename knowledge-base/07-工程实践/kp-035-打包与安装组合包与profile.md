---
id: kp-035
title: 打包与安装：组合包（bundle）与 profile
domain: DeepSeek Harness
module: 工程实践
level: 核心
prerequisites: [kp-003, kp-008]
related: [kp-003, kp-008, kp-033]
tags: [打包, bundle, profile, 分发, patch, 加载顺序]
sources: [docs/user/develop/basic/publish.md, docs/user/develop/basic/index.md, packages/bundle/web-app/cordis.patch.yml, https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish]
status: reviewed
---

# 打包与安装：组合包（bundle）与 profile

## 一句话定义
dsh 的分发模型建立在两个由 `package.json` 描述、但回答不同问题的 manifest 之上：**组合包（bundle）**声明 `dsh.bundle`，回答"这个包贡献什么"（一份 patch 配置层）；**profile** 声明 `dsh.profile`，回答"这套配置由哪些组合包按什么顺序组成"——二者互斥，没有东西同时是两者。

## 为什么重要
kp-003/kp-008 讲的是"配置如何层叠"，本页讲的是"层从哪来、谁分发、按什么顺序赢"。它是把教程里的 `--patch` 临时插件变成**可安装、可复现、可分发**的正式产品的路径，也是读 `dsh-base`/`dsh-web-app` 等官方组合包的钥匙。全部内容来自官方技术预览站 develop 档（2026-09-28 交叉验证补入）。

## 前置知识
kp-003（运行形态与 profiles）、kp-008（组装层叠与 HMR）、kp-012（patch 行为模型）。

## 核心概念

**① 组合包（bundle）三件套**：

```
hello-plugin/
├── package.json       # dsh.bundle manifest
├── cordis.patch.yml   # 该包被 profile 列出时应用的层
└── index.js           # patch 行引用的插件模块
```

```json
{
  "name": "dsh-hello-plugin",
  "type": "module",
  "main": "index.js",
  "files": ["index.js", "cordis.patch.yml"],
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```

关键区别：patch 里的插件行按**包名**（`name: dsh-hello-plugin`）而非相对源码路径引用模块——Node 模块解析才能找到已安装的代码。`patch` 字段也可接受有序文件列表（`["./base.patch.yml", "./web.patch.yml"]`），按序作为同一层应用。**没有 `dsh.bundle` 声明的包仍可安装，但只作普通依赖**：`dsh plugin` 打警告、不激活任何层——供 import 而非供启用的库型包就用这种形态。

**② profile 目录两件套**（`$DSH_HOME/profiles/<name>`）：
- `package.json`：树外插件依赖（pnpm 管理）+ `dsh.profile.bundles` 有序组合包列表；
- `cordis.patch.yml`：用户自己的 patch 层，在所有组合包层之后应用。

profile manifest 从不需要手写：`dsh --profile <name> --from-default-profile <template>` 从随附应用模板创建；`dsh plugin` 则创建 base 起步的 profile 并维护 bundles 列表。

## 原理 / 机制：四层加载顺序与"整行胜出"

**生效配置在空根之上按以下顺序逐层组合**：
1. profile 的 `dsh.profile.bundles` 各组合包 patch，按列表顺序（`@deepseek-ai/dsh-base` 恒为第一个，之后按加入顺序）；
2. profile 自己的 `cordis.patch.yml`；
3. home 级 `$DSH_HOME/cordis.patch.yml`——各 profile 共享的机器本地偏好；
4. 每个 `--patch <path>` overlay，按 argv 顺序。

**应用参数不是另一层 patch**：表层组合包可以通过普通应用自有服务解析它们（见下）。

后应用的层**按行胜出**，且 patch 会替换目标行的**整个 `config` 值**而不是深度合并各键。两个推论：
- 你的 patch 可以按 `id` 覆盖前面各层的行（官方 `dsh-web-app` 组合包就是这样覆盖 `dsh-base` 行的），但必须**重述该行需要的每一个键**；
- 用户可以在自己 profile 层覆盖你的行而无需改你的包——所以**优先给出用户大概率会保留的配置默认值，其余交给 schema 承担**。

内置组合包名称始终从 dsh 安装目录本身解析；pnpm 只管理树外包，因此你的组合包可以放心依赖 `@deepseek-ai/dsh-base` 存在且与安装一致。

**安装与验证**：`dsh plugin --profile demo add ./hello-plugin` 首次使用会初始化 profile（dsh-base 为第一个组合包）→ pnpm 链接 checkout → 因包声明了 `dsh.bundle` 而被追加进 `bundles`。先 `dsh --profile demo --dump-config` 验证（应出现 `# == dsh-hello-plugin` 层）再启动；`dsh plugin --profile demo remove dsh-hello-plugin` 同时移除依赖与对应的层。链接安装的 checkout 保留自己的 `node_modules`；需与宿主共享实例的 dsh 包按 kp-033 约定同时声明 `peerDependencies` 与 `devDependencies`。

**表层组合包持有自己的命令行**：定义了可运行应用的组合包挂载一个普通提供方插件——`inject = ['cmdlineArgs']`，用 commander program 调 `@deepseek-ai/dsh-cmdline` 的 `parseCmdline`，在 program 自己的 action 里把应用自有服务提供出去。启动器把**自身 flag 之后的同一份不可变参数快照**交给每个插件，所以加应用专属 flag 无需改启动器，多个插件也可解析该快照。受这些参数配置的行在自己的 `!!js` 选项里读取服务、旁边写部署回退值（`port: !!js ctx.myAppStartup.port ?? 8080`）；遇到 `--help` 时提供方不发布服务，这些行不激活。

## 直观类比
bundle 与 profile 像 **乐高盒子与图纸**：盒子（bundle）只声明"我提供哪块板子 + 板子上的图案（patch）"，图纸（profile）声明"按什么顺序把哪些盒子拼进来、最后再贴哪几张自己的贴纸（用户层）"。加载顺序是**图纸从下往上贴**：基础盒 → 你买的盒子 → 机器层 → 命令行贴纸；每张贴纸**整张覆盖**同一位置的旧图案，不是叠透明片。

## 实例 / 案例
从 GitHub 安装而不发布注册表：`dsh plugin --profile demo add github:you/hello-plugin`——但 git 安装拉的是**源码不是构建产物**，没有任何环节运行 `build`。两端各做一件事：
- **作者**提供 `prepare` 脚本（pnpm 在 git 安装后运行），从源码构建发布入口，且必须**自包含**（不能假设旁边有 monorepo checkout；可用专用 tsdown 配置直接转译 `src/`，不做类型检查）；
- **用户**为构建授权：pnpm ≥10 默认拒绝运行 git 依赖的 `prepare`，第一次 `add` 会失败——把 pnpm 打印的包键写进该 profile 的 `pnpm-workspace.yaml`：

```yaml
allowBuilds:
  dsh-hello-plugin: true
```

**安全语义**：这项授权等于"允许该包的代码在安装时于你的机器上执行，且不在 agent 运行的任何沙箱之内"——只对源码可信的包授权，并锁定 commit（`github:you/hello-plugin#<sha>`）。不想让用户授权就走免授权分发：npm 发布（`pnpm publish` 时构建好 `lib/`）或交付 tarball（`pnpm pack` → `dsh plugin add ./hello-plugin-0.1.0.tgz`），二者都不需要任何构建权限。

## 常见误区
- **以为 bundle 和 profile 可以是同一个东西**：官方明确"没有东西同时是两者"——分发物是 bundle，启动物是 profile；
- **以为覆盖是深度合并**：patch 按**行**替换整个 `config` 值，覆盖者漏写一个键，该键就丢了（这是 design intent，不是 bug）；
- **忘记 profile manifest 不是手写物**：手写 `dsh.profile` 容易与 CLI 维护状态脱节——用 `dsh plugin` 维护；
- **把 GitHub 安装当"装完即用"**：没有 prepare 授权就是加载失败，且授权是本机执行代码的真实安全决策。

## 自测题
1. 四层加载顺序是什么？用户 patch 层排在组合包层之前还是之后？
2. 你想把 `dsh-base` 某行的 `timeoutMs` 从 5000 改成 8000，patch 该怎么写？只写这一个键会发生什么？
3. `dsh plugin add github:you/x` 第一次失败的可能原因有哪两层（pnpm 侧 / 包侧）？

## 与其他知识点的关系
- kp-003 是 profile 的运行形态视角（本页是分发视角）；
- kp-008 的 patch/层叠语义在"四层顺序 + 整行胜出"里落地为安装模型；
- kp-033 的包 manifest 不变量（peer+dev 双声明）在链接安装场景下继续成立。

## 延伸阅读
- 官方站：https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish （同一内容的线上版）
- `docs/user/develop/basic/config.md`（插件配置）、`packages/bundle/web-app/cordis.patch.yml`（官方组合包覆盖 dsh-base 行的实例）
- `apps/cli/reference/README.md`（确切的层优先级、flag 与 profile 机制）
