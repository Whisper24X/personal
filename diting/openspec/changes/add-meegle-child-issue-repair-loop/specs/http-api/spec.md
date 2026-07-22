## ADDED Requirements

### Requirement: SyncHumanRepairIssueEndpoint

HTTP API SHALL expose `POST /api/tasks/:id/sync-human-repair-issue` to explicitly read a Meegle child task description and decide whether the parent task can recover.

#### Scenario: ChildRepairIssueNotReady

- **WHEN** the endpoint is called for a `needs_human` Meegle parent task whose child task description does not start with `【开发中】`
- **THEN** the response MUST be `200`
- **AND** the body MUST include `ready: false` and `recovered: false`
- **AND** the parent task MUST remain `needs_human`

#### Scenario: ChildRepairIssueReady

- **WHEN** the endpoint is called for a `needs_human` Meegle parent task whose child task description starts with `【开发中】`
- **THEN** the response MUST be `200`
- **AND** the body MUST include `ready: true`, `recovered: true`, `childExternalId`, `replyId`, and `summary`
- **AND** the parent task MUST transition to `queued`

#### Scenario: ChildRepairIssueSyncConflict

- **WHEN** the endpoint is called for a task that is not `needs_human`, is not sourced from Meegle, or has no child issue metadata
- **THEN** the response MUST be `409`
- **AND** the body MUST include an error message

### Requirement: WebConsoleChildRepairIssueAction

The web console SHALL provide a task detail action that calls `POST /api/tasks/:id/sync-human-repair-issue` for `needs_human` tasks with child issue metadata.

#### Scenario: ShowChildRepairIssueButton

- **WHEN** a selected task has status `needs_human` and `metadata.humanLoop.childIssue`
- **THEN** the task detail action row MUST show a `检查子任务方案` action

#### Scenario: HideChildRepairIssueButton

- **WHEN** a selected task is not `needs_human` or has no child issue metadata
- **THEN** the task detail action row MUST NOT offer the child issue sync action

#### Scenario: ChildRepairIssueButtonNotReadyFeedback

- **WHEN** the user clicks `检查子任务方案` and the API returns `ready: false`
- **THEN** the console MUST show feedback that the child task description has not started with `【开发中】`

#### Scenario: ChildRepairIssueButtonRecoveredFeedback

- **WHEN** the user clicks `检查子任务方案` and the API returns `recovered: true`
- **THEN** the console MUST refresh task list and task detail data
