## ADDED Requirements

### Requirement: ProductSpecDriverWorkflow

`openspec-product` driver SHALL 在 workspace root 中执行 Product workflow，生成、修订并校验 OpenSpec change；该 workflow MUST NOT 执行业务代码实现、质量检查或 PR 创建。

#### Scenario: ProductDriverGeneratesOpenSpecChange

- **WHEN** product task 进入 running
- **THEN** product driver MUST 在 workspace 中生成 `openspec/changes/<change-id>/proposal.md`、`design.md`、`tasks.md` 与 delta specs
- **AND** execution 结果 MUST 记录 `openspecChangeId`

#### Scenario: ProductDriverDoesNotModifyBusinessCode

- **WHEN** product driver 执行 OpenSpec 生成
- **THEN** driver MUST NOT 创建业务代码 PR
- **AND** MUST NOT 将 product task 送入 quality 评测

### Requirement: ProductOpenSpecValidation

product driver SHALL 在提交审核前运行 `openspec validate <change-id> --strict` 或等价校验；校验失败时 MUST 尝试修订 OpenSpec，仍失败时 MUST 进入人工等待。

#### Scenario: ProductValidationPasses

- **WHEN** product driver 生成 OpenSpec change 且校验通过
- **THEN** 系统 MUST 写入 validation artifact
- **AND** MUST 创建或复用 OpenSpec review 审核入口

#### Scenario: ProductValidationFailsAfterRepair

- **WHEN** product driver 无法修复 OpenSpec validation error
- **THEN** product task MUST 进入 `needs_human` 或 `blocked`
- **AND** 系统 MUST NOT 进入 programming 开发阶段

### Requirement: ProductReviewPackage

product driver SHALL 生成 OpenSpec review package，包含需求摘要、仓库列表、OpenSpec changeId、主要能力变更、风险、待确认点和审核回复格式。

#### Scenario: ReviewPackageCreated

- **WHEN** OpenSpec validation 通过
- **THEN** product driver MUST 写入 `artifacts/product-review.md` 或等价 artifact
- **AND** review payload MUST 包含 `【评审通过】`、`【需要修改】`、`【废弃】` 三种回复格式

### Requirement: ApprovedOpenSpecHandoff

OpenSpec review 通过后，系统 SHALL 写入 handoff artifact，并将当前 product task 切换为 programming task；programming task MUST 使用 approved workspace OpenSpec 执行开发。

#### Scenario: HandoffArtifactWritten

- **WHEN** OpenSpec review 决策为 approved
- **THEN** 系统 MUST 写入 `artifacts/handoff.json`
- **AND** handoff MUST 包含 `workspaceId`、`openspecChangeId`、approved revision 与 repos

#### Scenario: ProductTaskPromotedFromHandoff

- **WHEN** handoff artifact 写入成功
- **THEN** 系统 MUST 将当前 task 更新为 `agentKind=programming`
- **AND** 当前 task MUST 从 review 等待状态恢复到 `ready`
- **AND** programming task metadata MUST 包含 `sourceProductTaskId`、`workspaceId` 与 `openspecChangeId`

### Requirement: ProductTasksSkipCodingQualityAndPr

product task SHALL 在 OpenSpec review 阶段结束，不得执行 coding quality、completion gate 或 PR 创建；这些步骤只适用于 handoff 后的 programming task。

#### Scenario: ProductTaskDoesNotRunQuality

- **WHEN** product driver 成功创建 review issue
- **THEN** 系统 MUST 将 product task 转入 `needs_human`
- **AND** MUST NOT 调用 `QualityPlugin.evaluate`

#### Scenario: ProgrammingTaskRunsExistingGates

- **WHEN** approved OpenSpec handoff 将当前任务切换为 programming task
- **THEN** programming task MUST 继续使用既有 completion gate、quality、repair loop 与 PR 流程

## MODIFIED Requirements

### Requirement: GoalLoopSequence
Goal Loop SHALL 按任务 agent kind 分派到对应 driver：product task 执行 Product workflow（OpenSpec 生成、校验、审核包与 handoff），programming task 执行既有 coding workflow。programming task SHALL 按序执行：(1) execution 插件运行；(2) 若任务关联 OpenSpec change，则运行 completion-gate；(3) completion-gate 通过后，若 quality 启用则运行 quality；(4) 所有失败路径按既有 failure repair 策略处理；(5) 质量通过后创建 PR 并完成任务。product task MUST NOT 进入 coding quality 或 PR 流程。

#### Scenario: QualityPassDone
- **WHEN** execution 成功且 quality eval 全部通过
- **THEN** 任务迁移至 done

#### Scenario: ProductTaskStopsAtReview
- **WHEN** product workflow 成功生成 OpenSpec 并创建 review issue
- **THEN** product task MUST 进入 `needs_human`
- **AND** 系统 MUST NOT 调用 completion-gate、quality 或 PR 创建

#### Scenario: ProgrammingTaskUsesApprovedOpenSpec
- **WHEN** programming task 来源于 approved OpenSpec handoff
- **THEN** 系统 MUST 在 quality 前运行关联 OpenSpec completion gate
- **AND** completion gate MUST 使用 approved `openspecChangeId`
