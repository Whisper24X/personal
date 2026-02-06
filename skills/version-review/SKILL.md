---
name: version-review
description: Conducts a 5-round interactive review of version ideas to check consistency with system core logic. Uses knowledge base (business rules, historical PRD/MRD, terminology, tech constraints) to generate targeted questions via Cursor CLI tools. Supports frontend API interaction mode with state machine management. Use when reviewing version ideas, checking version consistency, or when the user asks for version review or validation.
---

# Version Review

Conducts a structured 5-round review process to validate version ideas against system knowledge base and identify potential conflicts or inconsistencies.

**Important**:

- Question and document generation uses **Cursor CLI tools** (works in any environment)
- User interaction is handled through **frontend API endpoints** with polling mechanism
- Review state is managed by a state machine and persisted in database

## Quick Start

When conducting a version review:

1. Frontend calls `POST /api/projects/:id/versions/:versionId/review/start` to start the review
2. Frontend polls `GET /api/projects/:id/versions/:versionId/review/status` to check status
3. When status is `waiting_answer`, frontend displays question and waits for user input
4. Frontend calls `POST /api/projects/:id/versions/:versionId/review/answer` to submit answer
5. System automatically generates next question or review document
6. Repeat steps 2-5 until all 5 rounds are completed

## Review Process

### Prerequisites

- **Version idea**: User's description of what they want to build
- **Project ID**: To retrieve relevant knowledge base content
- **Knowledge base**: Should contain business rules, historical PRD/MRD, terminology, and tech constraints

### State Machine

The review process uses a state machine with the following states:

- `pending`: Review not started
- `generating_question`: Generating question via Cursor CLI
- `waiting_answer`: Question generated, waiting for user answer
- `generating_document`: All questions completed, generating review document
- `completed`: Review completed, document generated
- `failed`: Error occurred during review

State transitions:

```
pending → generating_question → waiting_answer → generating_question → ... → generating_document → completed
                                                                                    ↓
                                                                                 failed
```

### 5-Round Review Structure

Execute these rounds **in order**, using previous answers to inform subsequent questions:

#### Round 1: Business Rules Conflict Check

**Knowledge sources**: Business rules (`BUSINESS_RULES`)

**Focus**:

- Check if version idea conflicts with existing business rules
- Identify specific conflicting rules
- Ask if adjustments are needed to comply with rules

**Question generation**:

```
Based on the version idea and business rules knowledge, generate a question that:
1. Points out potentially conflicting business rules
2. Asks if the user needs to adjust their idea to comply
3. Provides specific conflict examples (if any)
```

#### Round 2: Feature Conflict Check

**Knowledge sources**: Historical PRD, feature lists (`HISTORY_PRD`, `FEATURE_LIST`)

**Focus**:

- Check if version idea duplicates or conflicts with existing features
- Identify overlapping functionality
- Ask if feature scope needs adjustment

**Question generation**:

```
Based on the version idea, knowledge base, and previous Q&A, generate a question that:
1. Points out potentially duplicate or conflicting features
2. Asks if feature scope needs adjustment
3. Provides specific feature comparisons (if any)
```

#### Round 3: Terminology Consistency Check

**Knowledge sources**: Terminology dictionary (`TERMINOLOGY`)

**Focus**:

- Check if terms used in version idea match system definitions
- List potentially inconsistent terms
- Ask if terminology needs to be unified

**Question generation**:

```
Based on the version idea, knowledge base, and previous Q&A, generate a question that:
1. Lists potentially inconsistent terms
2. Asks if terminology usage needs to be unified
3. Provides standard definitions from terminology dictionary (if available)
```

#### Round 4: Data Model Consistency Check

**Knowledge sources**: Tech constraints, dev specs (`TECH_CONSTRAINTS`, `DEV_SPEC`)

**Focus**:

- Check if version idea involves data model changes
- Identify potential technical constraints
- Ask if requirements need adjustment to comply with tech specs

**Question generation**:

```
Based on the version idea, knowledge base, and previous Q&A, generate a question that:
1. Points out potential data model changes
2. Points out potential technical constraints
3. Asks if requirements need adjustment to comply with tech specs
```

#### Round 5: Final Confirmation

**Knowledge sources**: All previous rounds' knowledge and answers

**Focus**:

- Summarize key points from previous discussions
- Ask if version idea needs adjustment based on review
- If adjustment needed, ask for specific direction

**Question generation**:

```
Based on the version idea, knowledge base, and all previous Q&A, generate a question that:
1. Summarizes key points from previous discussions
2. Asks if version idea needs adjustment based on review results
3. If adjustment needed, asks for specific adjustment direction
```

## Knowledge Context Retrieval

Before starting the review, retrieve structured knowledge context:

**Required knowledge types**:

- `BUSINESS_RULES` - Business logic and compliance requirements
- `HISTORY_PRD` - Existing features and consistency
- `HISTORY_MRD` - Historical market research
- `TERMINOLOGY` - Unified term definitions
- `TECH_CONSTRAINTS` - Performance limits and architecture boundaries
- `DEV_SPEC` - Development specifications

**Retrieval limit**: 3 items per knowledge type (to keep context manageable)

## Question Generation Guidelines

### Principles

1. **Knowledge-driven**: Base questions on actual knowledge base content, not assumptions
2. **Specific and actionable**: Questions should be concrete, not abstract
3. **Focus on conflicts**: Prioritize identifying inconsistencies and conflicts
4. **Clear suggestions**: Provide explicit modification recommendations

### Question Format

Each question should:

- Be direct and clear
- Reference specific knowledge base content when relevant
- Include context from previous rounds (for rounds 2-5)
- Be answerable with a brief response

### Example Question Structure

```
[Context from knowledge base]

Your version idea mentions [specific aspect].
According to our [knowledge type], we have [specific rule/feature/term]:
- [Specific item 1]
- [Specific item 2]

Does this conflict with your idea? Do you need to adjust [specific aspect]?
```

## Review Document Generation

After completing all 5 rounds, generate a review document with:

### Document Structure

```markdown
# Version Review: [Version Name]

## Version Information

- Version Name: [name]
- Version Idea: [idea]
- Review Date: [date]

## Q&A Record

### Round 1: Business Rules Conflict Check

**Question:** [question]
**Answer:** [answer]

### Round 2: Feature Conflict Check

**Question:** [question]
**Answer:** [answer]

### Round 3: Terminology Consistency Check

**Question:** [question]
**Answer:** [answer]

### Round 4: Data Model Consistency Check

**Question:** [question]
**Answer:** [answer]

### Round 5: Final Confirmation

**Question:** [question]
**Answer:** [answer]

## Review Summary

### Conflict Analysis

[Analysis based on Q&A and knowledge base]

### Recommendations

[Specific recommendations for each conflict]

### Action Items

- [ ] Action item 1
- [ ] Action item 2
```

## API Integration

### Endpoints

1. **Start Review**: `POST /api/projects/:id/versions/:versionId/review/start`
   - Initializes review state and generates first question
   - Returns: `{ status: "generating_question", currentRound: 1 }`

2. **Get Status**: `GET /api/projects/:id/versions/:versionId/review/status`
   - Returns current review state, current question, and Q&A history
   - Frontend should poll this endpoint periodically

3. **Submit Answer**: `POST /api/projects/:id/versions/:versionId/review/answer`
   - Submits user answer and automatically generates next question
   - Returns: `{ status: "generating_question", currentRound: N }`

4. **Continue Review**: `POST /api/projects/:id/versions/:versionId/review/continue`
   - Manually trigger next question generation (usually not needed)

### Frontend Flow

1. Call `startReview` to initialize
2. Poll `getStatus` every 2 seconds
3. When status is `waiting_answer`, display question and wait for user input
4. Call `submitAnswer` with user's answer
5. Continue polling until status is `completed` or `failed`

## Error Handling

- **Knowledge retrieval failure**: Continue with empty knowledge context, use default question templates
- **Question generation failure**: Use fallback question: "请检查版本想法在[question type]方面是否存在问题？"
- **State persistence failure**: Log error and return error status to frontend
- **Document generation failure**: Set status to `failed` and return error message

## Integration Notes

This skill is designed to work with:

- `RAGService` for knowledge retrieval
- `CLIExecutor` for question and document generation via Cursor CLI
- `ProjectVersionRepository` for state persistence in database metadata
- Frontend API endpoints for user interaction

The review process is **asynchronous** - question generation and document generation happen asynchronously, requiring frontend polling.
