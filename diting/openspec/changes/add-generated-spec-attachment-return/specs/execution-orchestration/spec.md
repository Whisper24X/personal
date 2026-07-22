## MODIFIED Requirements

### Requirement: ProductReviewPackage

product driver SHALL generate an OpenSpec review package containing requirement summary, repository list, OpenSpec changeId, major capability changes, risks, confirmation points, review reply format, and generated OpenSpec local path references when no uploaded `spec文档` exists.

#### Scenario: ReviewPackageCreated

- **WHEN** OpenSpec validation passes
- **THEN** product driver MUST write `artifacts/product-review.md` or an equivalent artifact
- **AND** review payload MUST include `【评审通过】`, `【需要修改】`, and `【废弃】` reply formats

#### Scenario: ReviewPackageIncludesOpenSpecPath

- **WHEN** the product task started with `openspecSourceState=none` and OpenSpec generation succeeds
- **THEN** the review package MUST include the generated OpenSpec absolute path
- **AND** the review package MUST identify the OpenSpec changeId and revision represented by that path

### Requirement: ProductGeneratedOpenSpecPath

For product tasks that generate OpenSpec from no uploaded spec package, core SHALL compute the generated OpenSpec change directory absolute path and pass it to the Meegle OpenSpec review entry before considering the OpenSpec review request ready.

#### Scenario: GeneratedOpenSpecPathComputed

- **WHEN** product driver returns a valid `openspecChangeId` for a task whose `openspecSourceState` is `none`
- **THEN** core MUST compute `workspaceId/openspec/changes/<changeId>`
- **AND** core MUST record the path with changeId and revision metadata

#### Scenario: GeneratedOpenSpecPathReturnedBeforeReview

- **WHEN** generated OpenSpec path is computed
- **THEN** core MUST pass `openspecPath` to the task-integration OpenSpec review capability before opening or reusing the review entry
- **AND** core MUST record `openspecPath` on the task and review metadata

#### Scenario: LegacySpecAttachmentSkippedForUploadBack

- **WHEN** product or programming flow uses an existing legacy `spec文档` attachment
- **THEN** core MUST NOT create a replacement generated upload as part of this requirement
- **AND** existing attachment metadata MUST remain available for audit
