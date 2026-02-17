## ADDED Requirements

### Requirement: Project CRUD management
The system SHALL provide authenticated APIs to create, read, update, and delete projects under a business line.

#### Scenario: Create project under business line
- **WHEN** an authorized user submits a project with `name`, `businessLineId`, `gitUrl`, and `defaultBranch`
- **THEN** the system creates the project and stores the business line association

#### Scenario: Reject project creation for unauthorized business line
- **WHEN** a user without management permission on the target business line attempts to create a project
- **THEN** the system rejects the request with a forbidden error

### Requirement: Project configuration snapshot persistence
The system SHALL persist project-level execution configuration in a structured JSON payload.

#### Scenario: Save project execution config
- **WHEN** an authorized user updates project config including agent adapter, allowed skills/mcp, and concurrency options
- **THEN** the system stores the config in project metadata and returns the persisted value

#### Scenario: Return project config in detail API
- **WHEN** a user with project visibility accesses project details
- **THEN** the response includes the latest project config payload
