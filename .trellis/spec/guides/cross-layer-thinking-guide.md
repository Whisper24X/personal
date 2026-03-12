# Cross-Layer Thinking Guide

> **Purpose**: Think through data flow across layers before implementing.

---

## The Problem

**Most bugs happen at layer boundaries**, not within layers.

Common cross-layer bugs:
- API returns format A, frontend expects format B
- Database stores X, service transforms to Y, but loses data
- Multiple layers implement the same logic differently

---

## Before Implementing Cross-Layer Features

### Step 1: Map the Data Flow

Draw out how data moves:

```
Source → Transform → Store → Retrieve → Transform → Display
```

For each arrow, ask:
- What format is the data in?
- What could go wrong?
- Who is responsible for validation?

### Step 2: Identify Boundaries

| Boundary | Common Issues |
|----------|---------------|
| API ↔ Service | Type mismatches, missing fields |
| Service ↔ Database | Format conversions, null handling |
| Backend ↔ Frontend | Serialization, date formats |
| Component ↔ Component | Props shape changes |

### Step 3: Define Contracts

For each boundary:
- What is the exact input format?
- What is the exact output format?
- What errors can occur?

---

## Common Cross-Layer Mistakes

### Mistake 1: Implicit Format Assumptions

**Bad**: Assuming date format without checking

**Good**: Explicit format conversion at boundaries

### Mistake 2: Scattered Validation

**Bad**: Validating the same thing in multiple layers

**Good**: Validate once at the entry point

### Mistake 3: Leaky Abstractions

**Bad**: Component knows about database schema

**Good**: Each layer only knows its neighbors

### Mistake 4: Read Path Coupled to Slow Sync

**Bad**: A read-only feature (for example project docs browsing) always performs remote repository sync before serving local cached content.

**Good**: Separate "repository exists locally" from "repository is freshly synced". Read paths should prefer local cache and only do remote sync when the product explicitly needs freshness.

Typical example:
- Knowledge-base `GET /projects/:id/docs` should read the local `docs/` tree directly when the project repository has already been prepared.
- Remote `git fetch` should be triggered by explicit sync actions, first-time clone, or workflows that truly require latest remote state.

### Mistake 5: Structured Output Contract Left Implicit

**Bad**: The runner expects JSON lines on `stdout`, but the integrated CLI defaults to plain text or emits important events only on `stderr`.

**Good**: Treat structured CLI output as a contract across runner, task persistence, and frontend rendering:

- The runner must force the CLI into a machine-readable mode when downstream code persists `stdout` JSONL.
- The persistence layer must document whether it stores only `stdout` JSON lines or also error metadata.
- Adapter tests should assert the default command arguments that enable structured output.

Typical example:
- A task node persists `output.jsonl` only from `stdout` JSON lines. If a new CLI adapter is added without `--output-format stream-json`/`--json`, task logs may exist while `output.jsonl` stays empty.

---

## Checklist for Cross-Layer Features

Before implementation:
- [ ] Mapped the complete data flow
- [ ] Identified all layer boundaries
- [ ] Defined format at each boundary
- [ ] Decided where validation happens

After implementation:
- [ ] Tested with edge cases (null, empty, invalid)
- [ ] Verified error handling at each boundary
- [ ] Checked data survives round-trip
- [ ] Verified read paths are not accidentally blocked by remote sync or other slow side effects
- [ ] Verified machine-readable CLI integrations actually emit the format required by downstream persistence/rendering

---

## When to Create Flow Documentation

Create detailed flow docs when:
- Feature spans 3+ layers
- Multiple teams are involved
- Data format is complex
- Feature has caused bugs before
