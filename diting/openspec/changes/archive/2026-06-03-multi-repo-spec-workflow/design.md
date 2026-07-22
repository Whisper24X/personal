# Design: Multi-repo spec-driven workflow

Human-readable scheme (Chinese): [docs/architecture/diting-multi-repo-spec-workflow.md](../../../../docs/architecture/diting-multi-repo-spec-workflow.md)

## Summary

- Preflight before workspace creation (`blocked` on failure).
- Multiple git worktrees under `repos/<slug>/` on one branch.
- `WORKFLOW_PROMPTS.md` from workspace root / spec attachments only.
- Spec zip skills merged into `.cursor/skills/`.
- Per-repo quality and PR creation via `gh`.

## Core boundaries

Server owns Meegle download, spec materialization, preflight, and PR steps. Core exposes optional `runPreflight` and `createPullRequests` hooks on `ServiceDependencies`.
