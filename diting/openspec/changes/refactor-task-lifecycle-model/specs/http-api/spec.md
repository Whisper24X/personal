## MODIFIED Requirements

### Requirement: TaskCommandEndpointsUseNewLifecycle
HTTP 命令端点 SHALL 暴露新生命周期语义：submit、resume、retry、reopen、cancel。旧的 validate、queue、recover、block、needs-human 端点 MUST NOT 作为主要任务生命周期入口。

#### Scenario: SubmitDraftTask
- **WHEN** 客户端请求提交 `draft` 任务
- **THEN** API MUST 调用 `submitTask()`
- **AND** 任务 MUST 迁移到 `ready` 或 `waiting`

#### Scenario: ResumeWaitingTask
- **WHEN** 客户端请求恢复 `waiting` 任务
- **THEN** API MUST 调用 `resumeTask()`
- **AND** 响应中的任务 status MUST 是 `ready`

### Requirement: ApiReturnsAttemptAndWaitReason
任务详情 API SHALL 返回任务主状态、当前 RunAttempt、当前 WaitReason、失败和修复摘要。列表 API SHALL 优先展示任务主状态。

#### Scenario: WaitingTaskApiIncludesReason
- **WHEN** 客户端查询 `waiting` 任务详情
- **THEN** 响应 MUST 包含当前 WaitReason

#### Scenario: ActiveTaskApiIncludesAttemptStage
- **WHEN** 客户端查询 `active` 任务详情
- **THEN** 响应 MUST 包含当前 RunAttempt stage

### Requirement: LegacyEndpointHandling
旧 HTTP 端点 SHALL 被删除或仅用于返回迁移提示/错误提示。系统 MUST NOT 通过旧端点代理执行新命令，避免形成旧状态兼容层；系统也 MUST NOT 通过旧端点写入旧任务状态。

#### Scenario: RecoverDoesNotWriteQueued
- **WHEN** 旧 recover 入口被调用
- **THEN** 系统 MUST NOT 将任务写为 `queued`
- **AND** 系统 MUST 返回迁移提示或错误提示
