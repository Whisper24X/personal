---
name: eslint-prettier-verify
description: Verify and fix ESLint plus Prettier-enforced formatting before commit or CI. Use when quality-gate/husky fails on lint, the user asks to clear eslint/prettier errors, after large refactors, or to confirm a change set matches the repo’s lint rules. Applies to pnpm monorepos (root lint scripts), NestJS backend eslint, and Vue/Vite frontends that combine oxlint + eslint.
---

# ESLint / Prettier verification

Run the project’s **official** lint entry points first; do not invent one-off eslint globs unless the repo has no script.

## This repository (ainative monorepo)

**Check only (matches CI / husky `quality-gate` lint half):**

```bash
pnpm run lint
```

**Full gate (lint + types):**

```bash
pnpm run quality-gate
```

**Auto-fix what the toolchain can fix**

- Backend (NestJS; Prettier rules run inside ESLint):

```bash
cd backend && pnpm exec eslint "{src,apps,libs,test}/**/*.ts" --fix
```

- Frontend (oxlint + ESLint with fix flags via package script):

```bash
pnpm --dir frontend run lint
```

Then re-run `pnpm run lint` from the repo root.

## Order of operations

1. Run **auto-fix** for the package that reported errors (backend and/or frontend).
2. Re-run **`pnpm run lint`** at the monorepo root.
3. For **remaining** errors, fix by hand:
   - `@typescript-eslint/no-unused-vars`: remove unused imports/symbols or use them; do not silence without cause.
   - Logic rules (e.g. `no-floating-promises`): change code, not formatter settings.
4. If the user’s goal is “green commit hook”, finish with `pnpm run quality-gate` when appropriate.

## Other codebases

- Read `package.json` → use `lint`, `lint:fix`, or documented eslint commands from the **correct** package root.
- Prefer `eslint . --fix` or the project’s eslint glob only when it matches existing scripts or docs.
- Prettier: use the repo’s `format` / `lint` script; avoid running a global Prettier CLI with different config than CI.

## Anti-patterns

- Skipping lint after `--fix` and assuming the hook will pass.
- Fixing only one workspace when root `lint` runs both frontend and backend.
- Treating “0 prettier/prettier errors” as sufficient when other ESLint rules still fail.
