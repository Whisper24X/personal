## ADDED Requirements

### Requirement: Task creation from template snapshot
The system SHALL instantiate ordered task nodes from a workflow template version when creating a task.

#### Scenario: Create workflow task with checklist
- **WHEN** a user creates a task with project, template version, and acceptance checklist
- **THEN** the system stores the task and generates ordered task nodes from the template snapshot

#### Scenario: Create conversation task
- **WHEN** a user creates a conversation-mode task without multi-node workflow
- **THEN** the system generates exactly one task node and keeps the unified status model

### Requirement: Task execution operations
The system SHALL support execute, retry, and cancel actions while preserving valid state transitions.

#### Scenario: Execute next pending node
- **WHEN** a user triggers execute on a task in `todo` or `in_review`
- **THEN** the system moves the next runnable node to `in_progress` and recalculates task status

#### Scenario: Retry reviewed node
- **WHEN** a user triggers retry for a node in `in_review`
- **THEN** the node returns to `in_progress` and a new execution attempt is recorded

#### Scenario: Cancel running task
- **WHEN** a user cancels a task with an `in_progress` node
- **THEN** the running node transitions to `in_review` with cancellation context and task status is recalculated

### Requirement: Task status aggregation
The system SHALL derive task status from node statuses using deterministic priority rules.

#### Scenario: Node in progress dominates status
- **WHEN** any node is `in_progress`
- **THEN** task status is `in_progress`

#### Scenario: Mixed done and todo without running nodes
- **WHEN** at least one node is `done` and at least one node is `todo`, with no node `in_progress` or `in_review`
- **THEN** task status is `in_progress`
