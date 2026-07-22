## ADDED Requirements

### Requirement: ProductTaskLifecycle

系统 SHALL 支持 product task 生命周期，用于从 Meegle 原始需求生成、修订、校验并提交 OpenSpec 审核；product task 进入 `needs_human` 时 MUST 表示等待 OpenSpec review，而非代码实现失败。

#### Scenario: ProductTaskCreatedFromMeegleWithoutSpec

- **WHEN** Meegle 同步任务没有 spec 附件且 `openspecSourceState` 为 `none`
- **THEN** 系统 MUST 创建或更新 `agentKind=product` 的 product task
- **AND** 任务 MUST 可进入 queued 等待 product agent 执行

#### Scenario: ProductTaskWaitsForReview

- **WHEN** product driver 成功生成并校验 OpenSpec 且创建审核入口
- **THEN** product task MUST 进入 `needs_human`
- **AND** metadata MUST 标识 `workflowRole=product_spec` 与 review request type

### Requirement: ProductReviewHandoff

OpenSpec review 通过后，系统 SHALL 锁定 approved OpenSpec revision，完成 product task handoff，并将当前 product task 切换为对应 programming task；未通过审核 MUST NOT 进入 programming 开发阶段。

#### Scenario: ApprovedReviewPromotesProductTask

- **WHEN** product task 收到 `【评审通过】` 审核回复
- **THEN** 系统 MUST 记录 approved `openspecChangeId`、revision 与 `workspaceId`
- **AND** MUST 将当前 task 更新为 `agentKind=programming` 的 implementation task
- **AND** 当前 task MUST 从 review 等待状态恢复到 `ready`

#### Scenario: ChangesRequestedRequeuesProductTask

- **WHEN** product task 收到 `【需要修改】` 审核回复
- **THEN** 系统 MUST 将反馈写入 task metadata 或 HumanReview
- **AND** product task MUST 恢复到 `ready` 等待 product agent 修订
- **AND** 系统 MUST NOT 进入 programming 开发阶段

#### Scenario: DismissedReviewTerminatesProductFlow

- **WHEN** product task 收到 `【废弃】` 审核回复
- **THEN** 系统 MUST cancel 或 block product task
- **AND** 系统 MUST NOT 进入 programming 开发阶段

### Requirement: ProgrammingRequiresApprovedOpenSpec

由 product workflow 切换而来的 programming task SHALL 以 approved workspace OpenSpec 为前置条件；缺少 approved `workspaceId`、`openspecChangeId` 或 OpenSpec 校验结果时 MUST fail closed。

#### Scenario: ProgrammingBlockedWithoutApprovedOpenSpec

- **WHEN** programming task 来源于 product handoff 但缺少 approved `openspecChangeId`
- **THEN** 任务 MUST 迁移至 `blocked`
- **AND** 系统 MUST NOT 基于原始 Meegle instruction 直接执行开发

#### Scenario: ProgrammingUsesApprovedWorkspace

- **WHEN** programming task 包含 approved `workspaceId` 与 `openspecChangeId`
- **THEN** 系统 MUST 在执行前恢复该 workspace
- **AND** completion gate MUST 以该 OpenSpec change 为依据

## MODIFIED Requirements

### Requirement: PreflightBlockedState
任务预检失败时，任务 MUST 迁移至等待/阻断状态并在 `metadata.preflight` 记录失败检查项；调度器 MUST NOT 调用不安全的 `prepareWorkspace`。product task 缺少 spec 附件不属于预检失败；programming task 缺少 approved OpenSpec 属于预检失败。对齐 7 态模型后，任务 MUST 可通过 `waiting` → `ready` 恢复。

#### Scenario: BlockedAfterPreflight
- **WHEN** 预检返回 `passed: false`
- **THEN** 任务状态为 `waiting` 且不创建工作区

#### Scenario: ProductPreflightAllowsMissingSpecAttachment
- **WHEN** product task 的仓库与需求说明有效但没有 spec 附件
- **THEN** 预检 MUST NOT 因 `spec文档` 为空而失败

#### Scenario: ProgrammingPreflightBlocksMissingApprovedSpec
- **WHEN** programming task 缺少 approved workspace OpenSpec
- **THEN** 预检 MUST 返回失败
- **AND** 任务状态 MUST 为 `waiting`

## MODIFIED Requirements

### Requirement: LifecycleTerminologyAlignment
本 change 描述 product task OpenSpec 生成、审核与 programming handoff；历史中 `needs_human` 表示 OpenSpec review 等待、`queued` 表示可调度或审核后重新修订、`blocked` 表示预检或 approved OpenSpec 缺失。对齐 `refactor-task-lifecycle-model` 后：OpenSpec review MUST 使用 `waiting + WaitReason(type=approval, source=openspec-review)`；`queued` 读写为 `ready`；`needs_human` 与 `blocked` 读写为 `waiting`；审核修改后恢复 MUST 使用 `resumeTask()` 进入 `ready`；product agent 执行阶段 MUST 写入 RunAttempt.stage，Task 主状态保持 `active`。

#### Scenario: LegacyStatusNamesMapToSevenStateModel
- **WHEN** 读者或实现引用本 change 中的历史 Task 状态名
- **THEN** MUST 按 `openspec/changes/refactor-task-lifecycle-model/lifecycle-alignment.md` 或本目录 `lifecycle-alignment.md` 映射到 7 态模型
- **AND** 执行阶段 MUST NOT 写入 Task 主状态
