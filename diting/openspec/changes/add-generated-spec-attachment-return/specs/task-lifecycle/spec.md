## MODIFIED Requirements

### Requirement: ProductTaskLifecycle

系统 SHALL support product task lifecycle for generating, revising, validating, returning generated OpenSpec local path when required, and submitting OpenSpec for review. A product task entering `needs_human` MUST represent OpenSpec review or path metadata intervention, not code implementation failure.

#### Scenario: ProductTaskCreatedFromMeegleWithoutSpec

- **WHEN** Meegle synced task has no spec attachment and `openspecSourceState` is `none`
- **THEN** system MUST create or update an `agentKind=product` product task
- **AND** task MUST be queueable for product agent execution

#### Scenario: ProductTaskWaitsForReview

- **WHEN** product driver generated and validated OpenSpec, generated OpenSpec path is available when required, and review entry was created
- **THEN** product task MUST enter `needs_human`
- **AND** metadata MUST identify `workflowRole=product_spec`, review request type, and `openspecPath` metadata when present

#### Scenario: ProductTaskWaitsForOpenSpecPathIntervention

- **WHEN** generated OpenSpec path is required but missing
- **THEN** product task MUST remain `needs_human` or become `blocked`
- **AND** metadata MUST include path metadata failure detail
- **AND** no programming task MUST be created

### Requirement: ProductReviewHandoff

OpenSpec review approval SHALL lock the approved OpenSpec revision and switch the current task to programming only after required generated `openspecPath` metadata exists. Unapproved or path-incomplete specs MUST NOT enter programming.

#### Scenario: ApprovedReviewCreatesProgrammingTask

- **WHEN** product task receives `【评审通过】` review reply and required generated OpenSpec path metadata is present
- **THEN** system MUST record approved `openspecChangeId`, revision, workspaceId, and `openspecPath`
- **AND** MUST create or restore an `agentKind=programming` implementation task

#### Scenario: ApprovalBlockedWithoutOpenSpecPath

- **WHEN** product task receives `【评审通过】` but it started from `openspecSourceState=none` and lacks `openspecPath`
- **THEN** system MUST fail closed
- **AND** MUST NOT switch the task to programming

#### Scenario: ChangesRequestedRequeuesProductTask

- **WHEN** product task receives `【需要修改】` review reply
- **THEN** system MUST save feedback in task metadata or HumanReview
- **AND** product task MUST return to queued for product agent revision
- **AND** next generated revision MUST return the generated OpenSpec path before review is ready

## MODIFIED Requirements

### Requirement: LifecycleTerminologyAlignment
本 change 在 product workflow 上增加生成 OpenSpec 本地路径返回与路径缺失人工介入；历史中 `needs_human` 表示 OpenSpec review 或路径元数据等待、`blocked` 表示路径缺失 fail-closed、`queued` 表示审核修改后重新修订。对齐 `refactor-task-lifecycle-model` 后：路径缺失或等待 Meegle/人工回复 MUST 使用 `waiting + WaitReason(type=external_reply)`，`externalRef` 指向审核线程或路径干预入口；OpenSpec review 使用 `waiting + WaitReason(type=approval, source=openspec-review)`；`queued` 读写为 `ready`；恢复修订 MUST 使用 `resumeTask()` 进入 `ready`；生成与校验阶段 MUST 写入 RunAttempt.stage，不写入 Task 主状态。

#### Scenario: LegacyStatusNamesMapToSevenStateModel
- **WHEN** 读者或实现引用本 change 中的历史 Task 状态名
- **THEN** MUST 按 `openspec/changes/refactor-task-lifecycle-model/lifecycle-alignment.md` 或本目录 `lifecycle-alignment.md` 映射到 7 态模型
- **AND** 执行阶段 MUST NOT 写入 Task 主状态
