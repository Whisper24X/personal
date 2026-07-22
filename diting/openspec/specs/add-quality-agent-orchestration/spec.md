## ADDED Requirements

### Requirement: QualityAgentDispatch

diting SHALL support `agentKind=quality` tasks and agents as a first-class dispatch target for post-implementation quality orchestration.

#### Scenario: QualityTaskDefaults

- **WHEN** a task is created with `agentKind=quality`
- **THEN** core MUST set `driverId=quality-orchestrator`
- **AND** core MUST select `codex` as the default runtime provider unless the legacy executor explicitly requests `cursor`
- **AND** task metadata MUST record the normalized agent request.

#### Scenario: QualityAgentClaimsQualityTasksOnly

- **WHEN** a `quality` agent is idle
- **AND** both `programming` and `quality` ready tasks exist
- **THEN** the worker pool MUST allow the quality agent to claim only the `agentKind=quality` task
- **AND** it MUST NOT claim legacy programming tasks.

### Requirement: ImplementationHandoffToQuality

After a programming agent successfully completes implementation, diting SHALL write an implementation handoff artifact and transfer the current task to the quality agent stage before running quality evaluation.

#### Scenario: ProgrammingSuccessCreatesQualityHandoff

- **WHEN** a `programming` task execution exits successfully
- **THEN** core MUST write `artifacts/implementation-handoff.json`
- **AND** task metadata MUST include `implementationHandoff` and `implementationHandoffPath`
- **AND** the handoff MUST include workspace id, OpenSpec change id, revision, OpenSpec path, source programming task id, per-repo anchors, changed files, execution/session metadata, and artifact paths
- **AND** core MUST transition the current task from `active(programming)` to `ready(quality)`
- **AND** core MUST record a `programming.completed_for_quality` event
- **AND** core MUST NOT call `QualityPlugin.evaluate` in the programming stage.

### Requirement: QualityHandoffAnchorValidation

The quality agent stage SHALL fail closed when the implementation handoff cannot be proven to match the restored workspace.

#### Scenario: ValidRepoAnchorsRequired

- **WHEN** a quality task starts
- **THEN** core MUST validate every repo anchor by `key`, `url`, `path`, `baseSha`, and `headSha`
- **AND** `repos` MUST NOT be empty.

#### Scenario: InvalidRepoAnchorsFailClosed

- **WHEN** the implementation handoff is missing
- **OR** the handoff has no repo anchors
- **OR** a workspace repo is missing
- **OR** repo `url` or `path` does not match the handoff
- **OR** base/head commit information is missing or mismatched
- **THEN** core MUST transition the task to `waiting`
- **AND** core MUST record a WaitReason with `type=environment_blocked`
- **AND** core MUST record `quality.fail_closed`
- **AND** core MUST NOT run completion gate or quality evaluation.

### Requirement: QualityOrchestration

The quality agent stage SHALL orchestrate completion gate, quality evaluation, API/UI evidence gate, code review, quality report persistence, PR/MR creation, and terminal state transition.

#### Scenario: QualityPasses

- **WHEN** handoff anchor validation passes
- **AND** OpenSpec completion gate passes
- **AND** `QualityPlugin.evaluate` passes
- **AND** API/UI automation evidence gate passes
- **AND** code review has no CRITICAL or IMPORTANT findings
- **THEN** core MUST write `artifacts/quality-report.json`
- **AND** task metadata MUST include `qualityReport` and `qualityReportPath`
- **AND** core MUST create PR/MR using the existing PR creation capability
- **AND** core MUST transition the task from `active(quality)` to `succeeded`
- **AND** core MUST record `quality.passed`.

#### Scenario: ArtifactWriteFailureFailsClosed

- **WHEN** writing a required quality artifact fails
- **THEN** core MUST transition the task to `waiting`
- **AND** core MUST record a WaitReason with `type=environment_blocked`
- **AND** the WaitReason message MUST include the failed artifact filename
- **AND** core MUST NOT skip quality checks or report success.

### Requirement: QualityEvidenceGate

The quality agent stage SHALL verify API/UI automation evidence and code review artifacts before allowing delivery.

#### Scenario: AutomationEvidenceRequired

- **WHEN** API or UI automation is applicable
- **THEN** quality orchestration MUST require a traceable report path or failed evidence check
- **AND** missing evidence MUST fail the quality gate.

#### Scenario: NotApplicableEvidenceRequiresReason

- **WHEN** API or UI automation is not applicable
- **THEN** quality orchestration MUST record `not_applicable`
- **AND** it MUST include a human-readable reason.

#### Scenario: CodeReviewReportRequired

- **WHEN** quality orchestration reaches code review
- **THEN** the quality runtime MUST execute a read-only review
- **AND** core MUST write `artifacts/code-review-report.json`
- **AND** the report MUST include schema version, review artifact id, execution id, findings, and summary.

#### Scenario: CodeReviewBlockersFailQuality

- **WHEN** the code review report is missing, invalid, or lacks review artifact id
- **OR** it contains a CRITICAL or IMPORTANT finding
- **THEN** quality orchestration MUST NOT pass
- **AND** it MUST either fail closed to `waiting` or create a repair handoff, according to the failure type.

### Requirement: QualityRepairHandoff

When quality orchestration fails on an automatically repairable issue, diting SHALL use the existing repair model and return the task to programming.

#### Scenario: QualityFailureReturnsToProgramming

- **WHEN** quality evaluation, evidence gate, completion gate, or code review produces an automatically repairable failure
- **THEN** core MUST record failure through the existing FailureRepairService metadata
- **AND** core MUST update `repair_goals`
- **AND** core MUST write `artifacts/quality-report.json`
- **AND** core MUST write `artifacts/quality-repair-handoff.json`
- **AND** task metadata MUST include `qualityReportPath` and `qualityRepairHandoffPath`
- **AND** core MUST transition the current task from `active(quality)` to `ready(programming)`
- **AND** core MUST record `quality.failed_for_repair` and `repair.returned_to_programming`.

#### Scenario: RepairStopConditionsRemainAuthoritative

- **WHEN** budget limited, repeated failure, no effective diff, high risk, or Meegle child repair issue logic applies
- **THEN** quality orchestration MUST preserve the existing repair goal and failure repair semantics
- **AND** it MUST NOT create a second repair protocol outside FailureRepairService / `repair_goals`.

### Requirement: QualityObservability

diting SHALL expose quality agent handoff and quality orchestration status through run observability and diagnostics.

#### Scenario: QualityEventsMappedToStages

- **WHEN** logs contain quality handoff events
- **THEN** observability MUST map `quality.started`, `quality.passed`, and `quality.failed_for_repair` to the `quality` stage
- **AND** it MUST map `repair.returned_to_programming` to the `repair` stage.

#### Scenario: DiagnoseShowsQualityArtifacts

- **WHEN** task metadata includes `implementationHandoffPath`, `qualityReportPath`, or `qualityRepairHandoffPath`
- **THEN** diagnose output MUST include those artifact paths and quality summary keys.
