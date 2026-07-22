---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes
---

# Systematic Debugging

## Overview

Random fixes waste time and create new bugs. Quick patches mask underlying issues.

**Core principle:** ALWAYS find root cause before attempting fixes.

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose fixes.

## When to Use

Use for ANY technical issue:
- Test failures
- Bugs in production
- Unexpected behavior
- Performance problems
- Build failures
- Integration issues

## The Four Phases

### Phase 1: Root Cause Investigation

Before attempting any fix:

1. Read error messages carefully.
2. Reproduce consistently.
3. Check recent changes.
4. Gather evidence at component boundaries.
5. Trace data flow back to the source.
6. If the bug is deep in the stack, trace one level at a time to the original trigger.
7. In multi-component systems, log what enters and exits each boundary before proposing a fix.

### Phase 2: Pattern Analysis

1. Find working examples.
2. Compare against references.
3. Identify differences.
4. Understand dependencies.
5. Prefer local examples over intuition.

### Phase 3: Hypothesis and Testing

1. Form a single hypothesis.
2. Test minimally.
3. Verify before continuing.
4. Say "I don't understand X" when needed.
5. Change only one variable per attempt.

### Phase 4: Implementation

1. Create a failing test case if possible.
2. Implement a single fix.
3. Verify the fix.
4. If 3+ fixes failed, question architecture before continuing.
5. Add defense-in-depth validation if the same class of bug could recur.
6. Do not mark the issue resolved until the fix is reproducible and the evidence points to the source, not the symptom.

## Red Flags

Do not:
- propose fixes before tracing root cause
- skip reproduction
- bundle multiple unrelated changes
- guess under time pressure

## Practical Aids

- Use `root-cause-tracing.md` when the symptom appears deep in the call chain.
- Use `condition-based-waiting.md` when waiting on async state.
- Use `defense-in-depth.md` when the bug is caused by invalid data or unsafe context.
