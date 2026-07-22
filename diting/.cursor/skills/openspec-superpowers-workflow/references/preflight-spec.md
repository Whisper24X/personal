# Preflight And Spec

负责第一大阶段：前置检查、Brainstorming、OpenSpec 规格制品和人工确认卡点。

## 输入

- `{{workspacePath}}/WORKFLOW_PROMPTS.md`
- `{{workspacePath}}/openspec/`
- `{{workspacePath}}/skills/openspec-superpowers-workflow/`
- 飞书任务的 `{{taskPrompt}}`

## 进入闸门

1. 先读取主 `SKILL.md` 和 `WORKFLOW_PROMPTS.md`。
2. 优先读取任务包内 `skills/openspec-superpowers-workflow/references/preflight-spec.md`；若已合并到 `.cursor/skills/`，使用合并后的路径。
3. 定位 change-id、OpenSpec 真源、任务包根目录和技术栈 Profile。
4. 初始化或恢复 `openspec/changes/<change-id>/workflow-state.md`。
5. 如果处于 Diting 无交互节点，只校验已物化制品；缺关键制品时写入阻断并停止。

## 0. 前置检查

### 0.1 OpenSpec CLI 分工

Agent 只可用 Shell 检查 `which openspec`；`openspec new`、`instructions`、`validate`、`archive` 默认由用户终端或 Diting 平台执行。

- CLI 可用：提示用户或平台执行对应命令，把输出交给 Agent。
- CLI 不可用：进入降级模式，Agent 手动创建/检查制品格式。
- CLI 静默失败：视为降级模式，不重复盲跑命令。

标准模式创建 change 时，提示用户执行：

```bash
/opsx-new <change-id>
openspec instructions <artifact-id> --change "<change-id>" --json
```

### 0.2 Superpowers Skills 可用性

交互模式必须先读取并遵循：

- `superpowers:brainstorming`

后续阶段按需读取并遵循：

- `superpowers:writing-plans`
- `superpowers:test-driven-development`
- `superpowers:verification-before-completion`
- `superpowers:requesting-code-review`

若对应 skill 不可读取，按本 workflow 的等价步骤降级执行，不得跳过实质内容。

### 0.3 技术栈 Profile 识别

进入实现前必须识别 Profile，并记录到 `design.md` 或阶段报告。识别顺序遵循主 `SKILL.md` 的“技术栈 Profile”规则。无法确定时询问用户；Diting 无交互模式下写入阻断。

## 1. Brainstorming 与设计

交互模式必须执行，并且必须等待用户在澄清问题、候选方案、Superpowers design、Superpowers plan、OpenSpec 制品和进入实现前人工卡点上明确回复。Diting 无交互模式如果已有 `design.md` / `plan.md`，只校验内容；缺失则阻断。

交互模式固定顺序：

1. Brainstorming 产生并确认方案。
2. 写入 `docs/superpowers/specs/YYYY-MM-DD-<change-id>-design.md`，完成 review 并等待用户确认。
3. 写入 `docs/superpowers/plans/YYYY-MM-DD-<change-id>-plan.md`，完成 self-review 并等待用户确认。
4. 将已确认的 Superpowers design / plan 迁移到 OpenSpec change 目录，再创建或更新 `proposal.md`、`tasks.md` 和 `spec.md`。
5. 确认 OpenSpec 制品已完整承接内容后，删除临时 `docs/superpowers/` design / plan 文档。

### 1.1 探索项目上下文

检查相关代码、文档、OpenSpec 现有 change、最近 git 提交和任务背景。若需要 OpenSpec change 列表，由用户或平台执行：

```bash
openspec list
```

确定 `change-id`，使用 kebab-case 且动词开头。

### 1.2 澄清问题

按 `superpowers:brainstorming` 的方式一次只问一个问题，优先用选择题。若用户已明确指定方案，可简化候选方案讨论，但必须记录约束和理由。

### 1.3 候选方案与确认

提出 2-3 个候选方案，说明优点、缺点、适用场景和推荐方案。用户确认推荐方案前不得进入 Superpowers design / plan、OpenSpec `proposal.md`、`tasks.md` 或 `spec.md` 的编写和更新。

### 1.4 写入 Superpowers design

交互模式下必须先按原生 brainstorming 路径写入临时设计文档：

```text
docs/superpowers/specs/YYYY-MM-DD-<change-id>-design.md
```

Superpowers design 至少包含：

```markdown
# <change-id> 设计文档

## 澄清问题及结论
## 候选方案对比
## 最终选择及理由
## 技术设计
### 架构分层
### 关键决策
### 技术栈 Profile
### 风险与约束
### Open Questions
```

UI / 小程序验证形态必须在 design 中提前记录：

- 涉及小程序、Taro、跨端页面或移动端 H5 时，先判断目标仓是否能以 H5 形态启动或访问。
- 能通过 H5 验证的场景，`技术设计` 或 `风险与约束` 必须写明“使用目标仓 H5 入口验证”，不要默认落为人工验证。
- 只有 H5 入口不存在，或验收点依赖微信授权、原生支付、订阅消息、扫码、蓝牙等原生专属能力时，才记录为不可 UI 自动化或人工验证。

### 1.5 Spec Review Loop

使用 `code-reviewer` subagent 或等价人工审查聚焦 Superpowers design 的一致性、完整性、可执行性。发现问题后修复并重审；超过 3 轮仍无法收敛时交给用户决策。

### 1.6 User Review Gate

向用户展示 Superpowers design 路径和核心结论，等待用户明确审批。用户要求修改时回到 1.4 / 1.5。用户确认前不得创建或更新 OpenSpec 制品。

### 1.7 生成 Superpowers plan

按 `superpowers:writing-plans` 生成实现计划，写入：

```text
docs/superpowers/plans/YYYY-MM-DD-<change-id>-plan.md
```

计划必须包含：

- Goal 和 Architecture。
- Tech Stack / Profile。
- 按 task 拆分的文件清单。
- 每个 autonomous task 的 RED、GREEN、REFACTOR 步骤。
- 单测命令、预期失败/通过输出和 commit 建议。
- UI 验证方式：小程序/Taro 场景若可通过目标仓 H5 入口验证，计划中必须把 H5 作为自动化验证路径，并为后续 `TEST.md` / Playwright 留出输入材料。

### 1.8 Plan Review Gate

完成 writing-plans self-review 后，向用户展示 Superpowers plan 路径、任务拆分和关键验证命令，等待用户明确审批。用户要求修改时回到 1.7；用户确认前不得创建或更新 OpenSpec 制品。

## 2. OpenSpec Artifacts

### 2.1 创建或补齐制品

只有在 Superpowers design 和 Superpowers plan 都获得用户确认后，才能进入 OpenSpec Artifacts。

标准模式下，逐个消费用户或平台提供的 `openspec instructions ... --json` 输出，根据 `template`、`outputPath`、`context`、`rules` 写入文件。`context` 和 `rules` 是给 Agent 的约束，不复制进制品正文。OpenSpec `design.md` 和 `plan.md` 必须从已确认的 Superpowers design / plan 迁移而来，不得重新发明另一套设计或计划。

降级模式下手动创建：

- `proposal.md`：目标、方案、影响范围。
- `openspec/specs/<change-id>/spec.md`：`## ADDED/MODIFIED/REMOVED/RENAMED Requirements`、`### Requirement`、至少一个 `#### Scenario:`；涉及小程序/Taro 且可用 H5 验证时，Scenario 的 Given/When/Then 必须描述目标仓 H5 入口下的可观测行为。
- `tasks.md`：任务列表，autonomous task 必须包含 TDD 步骤和验证方式；可 H5 验证的 UI task 必须写明 H5 / Playwright 验证，而不是人工验证。
- `design.md`、`plan.md`：从已确认的 Superpowers design / plan 迁移而来。

### 2.2 OpenSpec 格式验证

标准模式提示用户或平台执行：

```bash
openspec validate "<change-id>" --strict
```

降级模式人工检查：

- `spec.md` 位于 `openspec/specs/<change-id>/spec.md`。
- Requirement 标题层级正确。
- 每个 Requirement 至少一个 `#### Scenario:`。
- Scenario 包含清晰的 WHEN / THEN 或 Given / When / Then。
- 小程序/Taro Scenario 已优先声明 H5 验证路径；只有 H5 不可用或依赖原生专属能力时，才允许标注人工验证或不可 UI 自动化。
- `tasks.md` 中 autonomous task 可验证、可勾选。

### 2.3 制品集中归属

最终所有制品统一归属到：

```text
openspec/changes/<change-id>/
  proposal.md
  design.md
  plan.md
  tasks.md
  workflow-state.md
openspec/specs/<change-id>/spec.md
```

将已确认的 Superpowers 文档复制或移动到 change 目录并重命名：

```text
docs/superpowers/specs/YYYY-MM-DD-<change-id>-design.md
  -> openspec/changes/<change-id>/design.md
docs/superpowers/plans/YYYY-MM-DD-<change-id>-plan.md
  -> openspec/changes/<change-id>/plan.md
```

确认 OpenSpec `design.md` / `plan.md` 内容完整后，删除上述临时 Superpowers 文档。若删除失败或需要保留用于审计，必须在阶段报告中说明原因和路径。

### 2.4 强制人工确认卡点

进入实现前必须向用户展示：

1. `proposal.md` 的目标、方案和影响范围。
2. `spec.md` 的 Requirements / Scenarios 列表。
3. `tasks.md` 的 autonomous task 列表。
4. `design.md` 和 `plan.md` 已到位。
5. 技术栈 Profile 和关键验证命令。

必须等待用户明确确认后才能进入 `Implement`。会话恢复时，如果实现尚未开始，必须重新展示并等待确认；聊天摘要不能替代此卡点。

## 执行规则

1. 交互模式必须执行 Brainstorming、方案确认、`design.md`、`plan.md` 和 OpenSpec artifacts 创建，并在每个用户确认卡点停止等待回复。
2. Diting 无交互模式只校验已物化制品，不重新创建 PRD/MRD/OpenSpec change。
3. 缺 `proposal.md`、`design.md`、`plan.md`、`tasks.md`、`workflow-state.md` 或 `spec.md` 时，写入 `docs/feature/{{gitBranch}}/taskResult.md` 并停止。
4. 真实 token、账号密码、生产凭据不得进入任务包、OpenSpec 制品或 git。
5. 阶段 1 完成前不得写实现代码。

## Workflow State 模板

```markdown
# Workflow State

- [ ] phase-1-preflight-spec
- [ ] phase-1-report
- [ ] phase-2-implementation
- [ ] phase-2-completion-gate
- [ ] phase-2-report
- [ ] phase-3-verification-review
- [ ] phase-3-api-automation
- [ ] phase-3-ui-automation
- [ ] phase-3-code-review
- [ ] phase-3-report
- [ ] phase-4-archive
- [ ] phase-4-report
```

`workflow-state.md` 是恢复和最终完成判断的唯一可信来源。

## 阶段报告

写入：

```text
openspec/changes/<change-id>/stage-reports/stage-1-preflight-spec.md
```

报告包含：

- change-id 和任务包根目录。
- OpenSpec CLI / Superpowers skills 可用性与降级说明。
- 技术栈 Profile 和命令来源。
- `proposal.md`、`design.md`、`plan.md`、`tasks.md`、`spec.md` 路径。
- OpenSpec validate 或人工格式检查结果。
- 人工确认卡点结论。
- 是否允许进入实现阶段。

完成后勾选：

- `phase-1-preflight-spec`
- `phase-1-report`
