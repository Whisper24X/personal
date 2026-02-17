## ADDED Requirements

### Requirement: Workflow template CRUD and activation
The system SHALL provide APIs to create, query, update, and activate/deactivate workflow templates.

#### Scenario: Create workflow template
- **WHEN** an authorized user submits a template with name, mode, and ordered node definitions
- **THEN** the system stores the template and marks it active by default

#### Scenario: Disable workflow template
- **WHEN** an authorized user deactivates a workflow template
- **THEN** the template becomes unavailable for new task creation

### Requirement: Workflow template version publishing
The system SHALL create immutable version snapshots for published workflow templates.

#### Scenario: Publish template version
- **WHEN** an authorized user publishes a template
- **THEN** the system creates a new version record with frozen node definitions and version number

#### Scenario: Create task with specific template version
- **WHEN** a task creation request references a template and version
- **THEN** the system validates version existence and uses that version snapshot for node instantiation
