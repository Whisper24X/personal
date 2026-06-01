# Git Commit Quality Gates

The repository root owns git commit hooks.

## Requirements

- Run `pnpm install` in the repository root so `husky` installs the root hooks.
- Every commit must pass the root `pre-commit` gate.
- The root `pre-commit` gate runs:
  - `pnpm run lint`
  - `pnpm run type-check`
- The root `lint` gate runs:
  - frontend `lint:check`
  - backend `lint`
- The root `type-check` gate runs:
  - frontend `type-check`
  - backend `type-check`
- Commit messages must pass the root `commit-msg` hook and `commitlint`.

## Notes

- Do not add or maintain per-package git hook entrypoints under `frontend/` or `backend/`.
- If a new package needs commit-time checks, wire it into the root quality gate instead of adding a second hook chain.
