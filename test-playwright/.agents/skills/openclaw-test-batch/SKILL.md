---
name: openclaw-test-batch
description: 将测试用例集拆解为 N 条可独立执行的原子用例，落盘 manifest 与结果目录，并指导通过 OpenClaw Gateway（openclaw agent -m）逐条循环执行与汇总。在用户需要批量跑用例、龙虾/OpenClaw 分批执行、避免一次性塞入全部用例、或需要按会话隔离/共享登录态执行时使用。若用例尚未生成，请先使用 test-cases skill 再使用本 skill。
license: MIT
---

# OpenClaw 测试用例批量拆解与执行

## 与 test-cases 的分工

| Skill | 职责 |
|--------|------|
| **test-cases** | 从 PRD/需求**生成**结构化测试用例 |
| **openclaw-test-batch**（本 skill） | 对**已有**用例清单**拆条**、**落盘**、**逐条交给 OpenClaw 执行**并**汇总** |

## 何时使用

- 用户有一大份用例（粘贴、Markdown 文件、项目内文档），希望拆成 **N 条**并**一条条**让 OpenClaw（龙虾）执行。
- 需要约定目录、清单格式、CLI 循环方式，避免上下文塞满或执行顺序混乱。
- 需要选择 **独立 session**（每条干净）或 **同一 session**（共享登录态）。

## 开始前

**声明**：本 skill 用于「拆解 + 编排 + 汇总模板」；OpenClaw **不会自动无人值守无限循环**，需由脚本 `openclaw agent` 或人工在渠道中逐条触发。

按需加载：`references/case-schema.md`（字段与 manifest）、`references/openclaw-cli.md`（参数与 shell 示例）。

## 流程

### 1. 确认输入

支持：用户粘贴、Markdown/文本文件路径、仓库内已有用例文档。若输入是模糊需求而非用例列表，**不要**用本 skill 代替 PRD 用例生成——应引导先使用 **test-cases**。

### 2. 拆解为 N 条原子用例

- 每条必须包含最小字段：`id`、`title`、`steps`、`expected`；可选 `preconditions`、`data`。
- **N 的确定**：用户指定 N → 拆成恰好 N 条；未指定 → N 等于自然拆出的条数，并在 `README.md` 写明。
- 粒度：一条用例对应一次可验证的独立场景；**不要**把多条无关断言硬塞进一条。

### 3. 落盘（在 workspace 或用户指定根目录）

创建目录：`openclaw-batch/<runId>/`（`runId` 建议含日期时间，如 `20260407-143022`）。

写入：

- `README.md`：运行时间、选用的 `agentId`、输入来源、执行策略（是否固定 `--session-id`）、环境说明。
- `manifest.json` **或** `cases/*.md`：清单与顺序（格式见 `references/case-schema.md`）。
- 预先创建空目录：`results/`（存放每条执行结果）。

### 4. 逐条执行（循环喂给 OpenClaw）

对每条用例构造**单条** `message`：

- 仅包含**当前用例**全文 + 简短指令（例如：执行用例、输出 JSON/Markdown 结果、标明 pass/fail/blocked）。
- 通过 **`openclaw agent --agent <id> -m "..."`** 调用；参数与 session 策略见 `references/openclaw-cli.md`。
- **独立上下文**：每条不传 `--session-id`（或按文档开新会话）。
- **共享登录态**：多条共用同一 `--session-id`**，并在失败时停止或跳过后续（在 `README.md` 说明）。

备选：在已绑定渠道中人工逐条发送**同构**消息。

### 5. 汇总

每条执行后要求将结果写入 `results/<case-id>.md`（或 JSON Lines），字段至少包含：`case_id`、`status`（pass/fail/blocked/skipped）、`notes`、`evidence`（可选）。

最后生成 `summary.md`：总条数、各状态计数、失败列表与阻塞原因。

## 边界

- 定时、飞书回调等全量自动化：可提示用户查阅 OpenClaw **cron** 或渠道文档；本 skill 不展开实现细节。
- 若用例依赖外部工具（浏览器、MCP），在单条 message 中显式要求加载对应 skill 或工具说明。
