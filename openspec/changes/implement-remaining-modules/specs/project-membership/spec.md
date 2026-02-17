## ADDED Requirements

### Requirement: Project member role management
The system SHALL support adding, updating, listing, and removing project members with explicit project roles.

#### Scenario: Add project member with valid role
- **WHEN** an authorized user adds a business-line member to a project with role `owner`/`maintainer`/`developer`/`viewer`
- **THEN** the system creates a project membership record

#### Scenario: Reject non-business-line user as project member
- **WHEN** an authorized user attempts to add a user that is not in the project's business line
- **THEN** the system rejects the request with a validation error

### Requirement: Enforce project role mutation guardrails
The system SHALL protect critical role operations to avoid orphaned ownership.

#### Scenario: Prevent removing last project owner
- **WHEN** a request attempts to remove or downgrade the final remaining project owner
- **THEN** the system rejects the operation and keeps at least one owner

#### Scenario: Restrict role mutation to authorized actors
- **WHEN** a user without project-management privilege attempts to change another member's role
- **THEN** the system rejects the request with a forbidden error
