## MODIFIED Requirements

### Requirement: OpenSpecReviewHumanGate

When product task generation and validation complete, system SHALL create or reuse an OpenSpec review entry and move the product task to `needs_human`. If the OpenSpec was generated because no `spec文档` was uploaded, the review request MUST include the generated OpenSpec local absolute path.

#### Scenario: OpenSpecReviewPending

- **WHEN** product driver successfully generated OpenSpec review payload and required local path metadata is available
- **THEN** system MUST create or reuse a Meegle review entry
- **AND** product task MUST enter `needs_human`
- **AND** HumanReview MUST record `requestType=openspec_review`

#### Scenario: OpenSpecReviewIncludesOpenSpecPath

- **WHEN** product task started with no uploaded spec attachment and OpenSpec generation succeeded
- **THEN** HumanReview reason or external review body MUST include the generated OpenSpec absolute path
- **AND** reviewers MUST be able to identify which OpenSpec changeId and revision the path represents

#### Scenario: OpenSpecReviewIgnoresUnprefixedReply

- **WHEN** product task is in `needs_human` and review reply has no valid gate prefix
- **THEN** system MUST keep product task in `needs_human`
- **AND** MUST NOT switch the task to programming

### Requirement: OpenSpecReviewFailClosed

When Meegle OpenSpec review ability is unavailable, review entry creation fails, review replies cannot be read, or required generated OpenSpec path metadata is missing, system MUST fail closed and prohibit automatic transition into programming.

#### Scenario: ReviewIssueOpenFailed

- **WHEN** product task needs to create OpenSpec review but creation fails
- **THEN** system MUST record failure event
- **AND** product task MUST remain `needs_human` or enter `blocked`
- **AND** system MUST NOT switch the task to programming

#### Scenario: GeneratedOpenSpecPathMissing

- **WHEN** product task needs generated OpenSpec path before review or handoff and path metadata is missing
- **THEN** HumanReview or task metadata MUST record the path metadata failure
- **AND** system MUST NOT treat the OpenSpec review as ready
- **AND** system MUST NOT switch the task to programming

## MODIFIED Requirements

### Requirement: LifecycleTerminologyAlignment
本 change 在 product workflow 上增加生成 OpenSpec 本地路径返回与路径缺失人工介入；历史中 `needs_human` 表示 OpenSpec review 或路径元数据等待、`blocked` 表示路径缺失 fail-closed、`queued` 表示审核修改后重新修订。对齐 `refactor-task-lifecycle-model` 后：路径缺失或等待 Meegle/人工回复 MUST 使用 `waiting + WaitReason(type=external_reply)`，`externalRef` 指向审核线程或路径干预入口；OpenSpec review 使用 `waiting + WaitReason(type=approval, source=openspec-review)`；`queued` 读写为 `ready`；恢复修订 MUST 使用 `resumeTask()` 进入 `ready`；生成与校验阶段 MUST 写入 RunAttempt.stage，不写入 Task 主状态。

#### Scenario: LegacyStatusNamesMapToSevenStateModel
- **WHEN** 读者或实现引用本 change 中的历史 Task 状态名
- **THEN** MUST 按 `openspec/changes/refactor-task-lifecycle-model/lifecycle-alignment.md` 或本目录 `lifecycle-alignment.md` 映射到 7 态模型
- **AND** 执行阶段 MUST NOT 写入 Task 主状态
