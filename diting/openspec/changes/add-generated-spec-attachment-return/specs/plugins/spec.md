## MODIFIED Requirements

### Requirement: TaskIntegrationOpenSpecReviewCapability

task-integration 插件 SHALL provide OpenSpec review ability for creating or reusing review entries and polling review replies when enabled. Plugins that support product-agent generated specs MUST accept `openspecPath` in the review request and expose that path in the external review entry before review is opened.

#### Scenario: PluginOpensOpenSpecReviewIssue

- **WHEN** core passes product task, OpenSpec changeId, revision, review summary, idempotency key, and optional `openspecPath`
- **THEN** the plugin MUST return review issue external ID, title, URL, idempotency key, and reuse status

#### Scenario: PluginPullsOpenSpecReviewIssue

- **WHEN** core requests replies for an OpenSpec review in `needs_human`
- **THEN** the plugin MUST return review status, raw reply, reply body, replyId, and updatedAt

#### Scenario: PluginExposesOpenSpecPath

- **WHEN** core passes `openspecPath` for a generated OpenSpec review
- **THEN** the plugin MUST include the absolute path in the external review entry body
- **AND** SHOULD tell reviewers to inspect `proposal.md`, `design.md`, `specs/`, and `tasks.md`

### Requirement: MeegleOpenSpecReviewAdapter

Meegle task-integration 插件 SHALL support OpenSpec review entry creation and generated OpenSpec local path display. Review replies only produce executable decisions when they start with `【评审通过】`, `【需要修改】`, or `【废弃】`.

#### Scenario: MeegleReviewApproved

- **WHEN** Meegle review reply is `【评审通过】同意进入开发`
- **THEN** the plugin MUST return `decision: approved`
- **AND** reply body MUST be `同意进入开发`

#### Scenario: MeegleReviewChangesRequested

- **WHEN** Meegle review reply is `【需要修改】补充异常场景`
- **THEN** the plugin MUST return `decision: changes_requested`
- **AND** reply body MUST be `补充异常场景`

#### Scenario: MeegleReviewUnreadyText

- **WHEN** Meegle review reply does not start with a gate prefix
- **THEN** the plugin MUST return not-ready state
- **AND** core MUST NOT switch the task to programming

#### Scenario: MeegleShowsGeneratedOpenSpecPath

- **WHEN** product workflow generated OpenSpec for a work item without an uploaded `spec文档`
- **THEN** the Meegle adapter MUST create the review child task with `OpenSpec 文档绝对路径：<openspecPath>` in the description
- **AND** the description MUST keep the gate prefix instructions for approval, changes requested, and dismissal
