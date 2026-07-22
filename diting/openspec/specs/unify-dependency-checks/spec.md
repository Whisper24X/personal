# unify-dependency-checks Spec

## ADDED Requirements

### Requirement: Unified Dependency Check API

The system SHALL expose a unified dependency check API that returns sanitized dependency status for built-in task integrations, platform tools, and coding runtime providers.

#### Scenario: List dependency checks

Given the server has Meegle, GitLab, Codex or Cursor plugins registered
When the console requests `GET /api/dependency-checks`
Then the response includes a ready count, total count, degraded flag, and dependency check cards grouped by category
And each check includes only sanitized details, public metadata, status, requiredFor, child items, and available actions
And the response does not include tokens, raw CLI output, authentication file paths, or short-lived user/device codes.

#### Scenario: Re-check dependencies

Given the console dependency check modal is open
When the user triggers `POST /api/dependency-checks/recheck`
Then the server re-evaluates dependency status for all checks or the requested subset
And the response uses the same sanitized model as the list API
And a failing CLI check does not crash the server.

### Requirement: Startup Dependency Status Does Not Redefine Readiness

The system SHALL show dependency check degraded status in the console without changing the existing `/api/readiness` HTTP readiness semantics for optional dependencies.

#### Scenario: Optional dependency degraded after startup

Given Meegle or GitLab is not authorized
When the server is otherwise healthy and the console loads dependency checks
Then the dependency check summary may be degraded
And `/api/readiness` remains governed by its existing database and required plugin kind checks
And optional dependency failures are shown as actionable dependency check cards.

#### Scenario: Alternative coding runtime is available

Given Codex CLI is unavailable
And Cursor CLI is available
When the console loads dependency checks
Then the dependency check summary is not degraded because at least one coding runtime can run programming tasks.

### Requirement: Task Start Required Dependency Gate

The system SHALL reuse the existing task preflight chain to block only dependencies required by the task being submitted, resumed, executed, or handed off.

#### Scenario: Programming task with no ready coding runtime

Given a programming task requires a coding runtime
And Codex/Cursor CLI availability checks are blocked with no alternative ready runtime
When the task is submitted or execution is about to prepare the environment
Then preflight fails with a dependency check failure
And the task enters `waiting` with `waitReason.type=environment_blocked` and `waitReason.source=preflight`.

#### Scenario: Programming task with one ready coding runtime

Given a programming task requires a coding runtime
And either Codex or Cursor CLI is ready
When the task preflight runs
Then dependency preflight passes for coding runtime requirements.

#### Scenario: Task that does not require GitLab

Given GitLab CLI is not authorized
And a task does not create a merge request or require platform actions
When the task preflight runs
Then GitLab auth failure does not block that task.

#### Scenario: Product to programming handoff

Given a product task hands off to a programming task
When the programming handoff preflight runs
Then required dependency checks are evaluated alongside existing approved OpenSpec handoff checks
And any required dependency failure blocks the handoff through the existing preflight blocked path.

### Requirement: Dependency Check Modal

The web console SHALL provide a modal dependency check center for judging dependency status and launching authorization or configuration actions.

#### Scenario: Open dependency check modal in H5 console

Given the web console H5 app is loaded
When the user opens the dependency check entry
Then a modal appears with a title, `n/m ready` progress, grouped dependency cards, child status items, `Re-check`, and `Skip for now`
And cards show Required or Optional status.

#### Scenario: Authorize Meegle or GitLab

Given a Meegle or GitLab dependency card is blocked because authorization is missing
When the user clicks the authorization action
Then the console starts the existing `/api/integrations/*/auth/start|poll` flow
And the dependency check aggregation result does not store or expose short-lived user/device codes.

#### Scenario: Skip dependency modal

Given the dependency check modal is open with blocked dependencies
When the user clicks `Skip for now`
Then the modal closes
And the backend dependency check state is not changed
And a later task that requires the blocked dependency is still blocked by preflight.

### Requirement: CLI Status Semantics

The system SHALL distinguish ready, warning, blocked, unknown, checking, and unverified dependency statuses.

#### Scenario: Coding runtime CLI is available

Given a Codex or Cursor runtime CLI is installed and configured
When dependency checks are listed
Then that runtime is marked `ready`
And the check only reports CLI availability, not OpenSpec installation or login state
And when multiple discovered sources exist for the same runtime, any ready source makes that runtime ready.

#### Scenario: GitLab CLI is available but authorization is missing

Given the GitLab CLI command is available
And GitLab authorization is missing
When dependency checks are listed
Then the GitLab dependency card is `blocked`
And its child items show `CLI available` as `ready` and `Signed in` as `blocked`.

### Requirement: Secure Public Dependency Check Output

The system SHALL restrict dependency check public output to a whitelist of safe fields.

#### Scenario: CLI command returns sensitive output

Given a dependency provider receives CLI output that includes token-like values, device/user code values, raw stderr, or authentication file paths
When the provider returns a dependency check result
Then the public API response redacts or omits those values
And logs and OpenSpec artifacts do not contain those secrets.
