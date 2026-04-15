# AINative Repo Constraints

This file is the entry point for repo-level development constraints.

Detailed rules should live under `docs/dev-spec/`. Keep `AGENTS.md` short and use it as an index, not as the full source of truth.

## Active Specs

- Dev spec index: `docs/dev-spec/README.md`
- Frontend architecture (five-partition SPA + cross-app alignment): `.agents/skills/frontend-architecture/SKILL.md` and `references/`; AI/editor guardrails: `.cursor/rules/frontend-architecture-*.mdc`

## Frontend architecture

- **Normative rules**: `.agents/skills/frontend-architecture/references/spa-architecture.md` and `references/multi-frontend-alignment.md` (dependency matrix, public feature API, CLI boundaries).
- **Project background** (feasibility, phased execution history, risks): `docs/technical/frontend-architecture-feasibility-analysis.md` — not a substitute for the skill references.
- **Path aliases** (see `frontend/vite.config.ts`, `frontend/tsconfig*.json`): `@app/`, `@pages/`, `@features/`, `@api/`, `@shared/` plus legacy `@/`. **New code** should prefer the partition aliases and directories under `frontend/src/` per the skill references.
- **Lint & dependency guard**: `frontend/eslint.config.ts` — `eslint-plugin-boundaries` (`boundaries/dependencies`) and `max-lines` (default **error@600** for Vue SFC; a short **exempt list** keeps known giant files at warn until split; 400-line soft limit is review-only). Root `quality-gate` runs `pnpm --dir frontend run deps:circular:strict` (`dpdm`, no circular imports). Import matrix: `.cursor/rules/frontend-architecture-imports.mdc`.
- **Legacy paths**: do not add new files where `eslint` / team policy forbids (e.g. deprecated `views`/`hooks` patterns); details in `frontend/eslint.config.ts` and the feasibility doc for historical context.
