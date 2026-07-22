# diting 产品 Agent 使用手册

更新日期：2026-06-23

本文面向接入、产品评审和运维同学，说明 diting 的产品 Agent 如何把 Meegle 原始需求转换为 OpenSpec change，并在人工评审通过后交给编程 Agent 实现。

## 1. 产品 Agent 是什么

产品 Agent 是 diting 中的非编码 Agent lane：

```text
agentKind = product
driverId = openspec-product
runtimeProviderId = codex | cursor
```

它负责：

- 读取 Meegle 或手工任务中的需求、仓库、分支和约束。
- 创建或复用临时 workspace。
- 生成、修订并校验 `openspec/changes/<change-id>/`。
- 当原始 Meegle 任务没有 `spec文档` 附件时，把生成后的完整 `openspec/` 打包回传到 Meegle「spec文档」附件字段。
- 输出评审材料 `artifacts/product-review.md`。
- 创建或复用 Meegle OpenSpec review 审核入口。
- 在审核通过后生成 handoff，将当前任务切换为 `agentKind=programming` 并恢复到 `ready`。

它不负责：

- 修改业务代码。
- 执行 lint、test、build。
- 创建 commit、push 或 PR。
- 绕过人工评审直接进入开发。

Codex 和 Cursor 在这里不是产品 Agent 本身，而是 `openspec-product` driver 下的 runtime provider。默认优先使用 Codex；Codex 不可用时可配置或回退到 Cursor。

## 2. 推荐使用场景

使用产品 Agent：

- Meegle 需求只有原始业务描述，没有 `spec文档` 附件。
- 希望先产出 OpenSpec，并让产品或负责人评审后再开发。
- 需求需要多仓实现，但需要统一的 OpenSpec change 作为开发依据。
- 需要把评审反馈沉淀为可追溯的任务状态和 handoff artifact。

不建议使用产品 Agent：

- 已有经过确认的 `spec文档` 附件，且希望直接进入旧的多仓编程流程。
- 只是临时小修，不需要 OpenSpec 评审门禁。
- 当前没有可用的 Codex/Cursor runtime 或 Meegle review 入口。

## 3. 启用配置

最小启用方式是在服务端环境变量中配置至少 1 个产品 Agent 并启动调度器：

```bash
DITING_SCHEDULER_PRODUCT_AGENT_COUNT=1
DITING_PLUGIN_PRODUCT_AGENT_DEFAULT_RUNTIME=codex
DITING_OPENSPEC_REVIEW_GATE_ENABLED=true
```

常用配置：

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DITING_SCHEDULER_PRODUCT_AGENT_COUNT` | `0` | 启动时 seed 的 product agent 数量；设为 `1` 或更大才会消费 product task |
| `DITING_PLUGIN_PRODUCT_AGENT_DEFAULT_RUNTIME` | `codex` | 产品 Agent 默认 runtime provider，可设为 `cursor` |
| `DITING_OPENSPEC_REVIEW_GATE_ENABLED` | `true` | 是否启用 OpenSpec review 自动门禁 |
| `DITING_OPENSPEC_REVIEW_PREFIX_APPROVED` | `【评审通过】` | 以该前缀开头的审核回复会批准 handoff，并让当前任务进入 programming 开发阶段 |
| `DITING_OPENSPEC_REVIEW_PREFIX_CHANGES_REQUESTED` | `【需要修改】` | 以该前缀开头的审核回复会让 product task 回到 `ready` 修订 |
| `DITING_OPENSPEC_REVIEW_PREFIX_DISMISSED` | `【废弃】` | 以该前缀开头的审核回复会取消或阻断 product task |
| `DITING_WORKSPACE_CLEANUP_ON_SUCCESS` | `false` | 建议保持 false，方便查看 product workspace 与 artifacts |
| `DITING_WORKSPACE_CLEANUP_ON_FAILURE` | `false` | 建议保持 false，方便排障 |

完整配置见 [diting-config.md](./diting-config.md)。

## 4. 任务入口

### 4.1 Meegle 自动同步

Meegle 是推荐入口。同步逻辑会根据是否有 `spec文档` 附件选择路径：

| Meegle 输入 | 系统行为 |
| --- | --- |
| 没有 `spec文档` 附件 | 创建或更新 `agentKind=product` 的 product task，由产品 Agent 生成 OpenSpec，并在 review 子任务描述中返回 OpenSpec 绝对路径 |
| 有 `spec文档` 附件 | 走 legacy attachment import，导入附件中的根级 `openspec/` |
| 已有待评审 workspace | 保持或恢复 review pending 状态 |
| 已审核通过 workspace | 将当前 product task 切换为 programming task 并恢复到 `ready` |

因此，开启产品 Agent 后，`spec文档` 不再是所有 Meegle 任务的通用前置条件。缺附件是产品 Agent 的正常入口，不是预检失败。

### 4.2 手工创建 product task

也可以通过 HTTP API 手工创建任务：

```bash
curl -X POST http://localhost:13000/api/tasks \
  -H 'content-type: application/json' \
  -d '{
    "title": "生成会员续费提醒 OpenSpec",
    "instruction": "基于会员到期前 7 天提醒、到期当天提醒、过期后召回三个场景，整理 OpenSpec change。",
    "repo": "https://example.com/app.git",
    "branch": "main",
    "source": "manual",
    "agentKind": "product",
    "preferredDriver": "openspec-product",
    "preferredRuntime": "codex",
    "acceptanceCriteria": [
      "OpenSpec 覆盖触发时机、通知渠道、失败重试和用户退订",
      "评审材料列出需要产品确认的问题"
    ]
  }'
```

创建后，将任务推进到 `ready`：

```bash
curl -X POST http://localhost:13000/api/tasks/<task-id>/queue
```

## 5. 标准流程

```text
1. 需求进入 diting
2. 系统创建 product task
3. product-agent-* claim 任务
4. openspec-product driver 创建 workspace
5. runtime provider 生成 OpenSpec change；如需要补充信息，产品 Agent 在 Meegle 评论中提问并让任务进入 waiting
6. 人工在最新评论前加 `【回复】` 标签补充内容，并在 Web 控制台点击「检查回复」
7. 系统读取最新评论、剥离 `【回复】` 后追加到任务指令，恢复 product task 继续生成或修订 OpenSpec
8. 系统校验 OpenSpec 结构并写 artifacts
9. 若任务原本没有 `spec文档` 附件，系统在 Meegle OpenSpec review 子任务描述中返回 `openspec/changes/<change-id>/` 绝对路径
10. product task 进入 waiting
11. Meegle OpenSpec review 等待人工回复
12. 审核通过后写 handoff.json
13. 系统将当前任务切换为 programming/coding 并恢复到 ready
14. programming agent 基于 approved OpenSpec 开发、质检、PR
```

product task 进入 `waiting` 时，通常表示等待产品交互回复或 OpenSpec review，不表示代码实现失败。Web 控制台和诊断命令会通过 `waitReason.type`、`agentKind=product`、`driverId=openspec-product`、`HumanReview.requestType=openspec_review` 区分它和编程任务的 repair。

## 6. 产品交互回复格式

产品 Agent 在生成 OpenSpec 的中途需要人工补充信息时，会把问题写到 Meegle 评论里，并让任务进入 `waiting`。人工回复必须在最新评论前加 `【回复】` 标签：

```text
【回复】过期后召回最多每 7 天一次，用户退订后不再发送短信。
```

在 Web 控制台打开该任务并点击「检查回复」后，系统会调用 `POST /api/tasks/:id/sync-human-reply` 拉取 Meegle 评论，只接受以 `【回复】` 开头的最新评论；标签会被剥离，正文会追加到任务指令中，然后 product task 恢复到 `ready` 进入下一轮生成。没有 `【回复】` 标签的普通讨论不会推进状态，避免误把评论串中的上下文当成明确反馈。

`【回复】` 只用于产品 Agent 中途交互，不代表最终 OpenSpec 已审核通过。

## 7. 审核回复格式

审核回复必须以配置的前缀开头，默认如下：

| 回复前缀 | 结果 |
| --- | --- |
| `【评审通过】` | 锁定 approved OpenSpec revision，将当前任务切换为 programming 并恢复到 `ready` |
| `【需要修改】` | 保存反馈，product task 回到 `ready`，等待产品 Agent 修订 |
| `【废弃】` | 取消或阻断 product task，不进入开发 |

示例：

```text
【评审通过】同意进入开发，请保持通知渠道先支持站内信和短信。
```

```text
【需要修改】补充过期后召回频率上限，以及用户退订后的行为。
```

```text
【废弃】本期暂不开发，等待会员体系改版后再评估。
```

没有合规前缀的回复只会被记录，不会推进状态。无法创建审核入口或无法读取审核回复时，系统会 fail closed，不会自动进入 programming 开发阶段。

## 8. 产物位置

产品 Agent 运行后，重点查看 workspace 内这些文件：

| 路径 | 说明 |
| --- | --- |
| `task.md` | 从任务输入归一化出的需求上下文 |
| `openspec/changes/<change-id>/` | 产品 Agent 生成或修订的 OpenSpec change |
| `artifacts/openspec-validation.json` | OpenSpec 结构校验结果 |
| `artifacts/product-review.md` | 给人工评审看的摘要、方案、风险和待确认项 |
| `artifacts/handoff.json` | 审核通过后供当前任务切换到 programming 阶段使用的 handoff 元数据 |

等待 review 期间，product workspace 默认应被保留。无 `spec文档` 附件输入时，OpenSpec review 子任务描述会返回 `openspec/changes/<change-id>/` 的本地绝对路径，用户按该路径审核 `proposal.md`、`design.md`、`specs/`、`tasks.md`。审核通过后，当前任务会携带 approved workspace 元数据切换为 programming task；如果缺少 `workspaceId`、`openspecChangeId`、必需的 `openspecPath` metadata，或 workspace 无法恢复，任务会保持 `waiting`，不会退回到原始需求直接开发。

## 9. 观察与排障

### 看任务列表

```bash
curl 'http://localhost:13000/api/tasks?agentKind=product'
```

### 看任务详情和观测信息

```bash
curl 'http://localhost:13000/api/tasks/<task-id>'
curl 'http://localhost:13000/api/tasks/<task-id>/observability'
```

### 诊断单个任务

```bash
npm run diagnose:task -w apps/server -- --task-id <task-id>
```

常见问题：

| 现象 | 优先检查 |
| --- | --- |
| product task 一直不执行 | `DITING_SCHEDULER_PRODUCT_AGENT_COUNT` 是否大于 0；是否存在 idle `product-agent-*`；runtime provider 是否健康 |
| 无 spec 附件进入 `waiting` | 确认任务是否被归一为 `agentKind=product`；检查 OpenSpec review 子任务是否返回 `openspecPath`；切换到 programming 阶段时缺 approved OpenSpec 或 `openspecPath` metadata 会被正常阻断 |
| 进入 `waiting` 后不往下走 | Meegle review 回复是否以精确前缀开头；review gate 是否启用；是否能读取审核入口 |
| 审核通过后任务未进入 programming/ready | 检查 `artifacts/handoff.json`、`workspaceId`、`openspecChangeId`、`openspecPath` metadata、workspace restore 结果 |
| programming task 保持 `waiting` | approved workspace 丢失、OpenSpec change 缺失或校验失败；不要手工改成基于原始需求开发 |

## 9. 角色分工

| 角色 | 负责事项 |
| --- | --- |
| 产品或需求负责人 | 在 Meegle 提供清晰需求；按前缀回复 OpenSpec review |
| 产品 Agent | 生成、修订、校验 OpenSpec；整理评审材料 |
| diting 调度器 | 按 agent kind 分派 product/programming task；处理 review gate 与 handoff |
| 编程 Agent | 只在 approved OpenSpec 存在后执行开发、质量检查、repair 和 PR |
| 运维 | 确认 product agent count、runtime provider、workspace 保留和 Meegle review 能力 |

## 10. 与 legacy spec 附件路径的关系

legacy `spec文档` 附件仍然兼容：

- 附件存在时，系统可导入其中的根级 `openspec/`。
- 附件缺失时，product agent 会在 workspace 内生成 OpenSpec。
- 对缺附件任务，生成完成后会把完整 `openspec/` zip 追加或绑定到原工作项「spec文档」字段；已有 legacy 用户附件不会被删除或替换。
- product workflow 关闭或 product agent 数量为 0 时，旧任务仍可按原有 spec 附件预检和编程链路运行。

一句话原则：有已确认的 spec 包可以直接导入；没有 spec 包时，让产品 Agent 先生成并走评审门禁。
