# Proposal: Multi-repo spec-driven workflow

## Why

Engineering tasks from Feishu (Meegle) often span multiple Git repositories, ship workflow prompts and OpenSpec assets outside application repos, and require automated PR creation per changed repo after quality gates. The current diting pipeline assumes a single `repo/` worktree and reads `WORKFLOW_PROMPTS.md` from the target repository.

## What changes

- Parse `Repo1..RepoN` blocks in work item descriptions (with `---` separated instruction body).
- **Preflight** before workspace creation: validate repo list in description, spec文档 attachments, and compliance (WORKFLOW_PROMPTS, archive rules).
- Materialize Feishu field「spec文档」 (files and archives) into the task workspace root.
- Discover skills inside spec archives and load into `.cursor/skills/` for executor CLI.
- Load `WORKFLOW_PROMPTS.md` from the workspace root / spec path only (not from code repos).
- Prepare multiple git worktrees under `repos/<slug>/` on one shared branch.
- Load spec-bundled skills into CLI-visible `.cursor/skills/`; then install OpenSpec and optional Superpowers supplement.
- Run quality evaluation per repo; create one PR per repo with changes via `gh pr create`.

## Capabilities

- `plugins` — environment multi-worktree, spec documents, workspace tooling
- `execution-orchestration` — workflow prompt lookup, cwd, multi-repo template variables
- `configuration` — new environment variables
- `governance` — allow `git` / `gh` for PR step
- `task-lifecycle` — optional: PR failure before `done`

## Impact

- Breaking: execution no longer reads `WORKFLOW_PROMPTS.md` from `repoPath`.
- `ditingTask.repo` remains primary repo URL; `metadata.repos` holds full list.
- Requires `gh` auth and GitLab push on the diting host.

## Design document

Human-readable scheme (Chinese): [docs/architecture/diting-multi-repo-spec-workflow.md](../../../../docs/architecture/diting-multi-repo-spec-workflow.md)

## Confirmed decisions (2026-06-03)

- Spec root file name collision: rename with `{basename}-{n}{ext}`, never overwrite.
- PR base branch: detect per repository (`origin/HEAD`, then `main` / `master`).
- Tooling install failure: block task by default (no skip/degrade in v1).
- Preflight failure: `blocked` before any git worktree is created.
- Spec archive may ship `skills/`; merge into workspace `.cursor/skills/` for Cursor/Codex execution.

## Status

Proposal and design only — **implementation not started** (2026-06-03).
