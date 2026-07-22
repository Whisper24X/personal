# Changelog

## 2026-06-09

### Added

- Added the project-local `generate-changelog` Codex skill under `.codex/skills/generate-changelog`.
- Added a reusable `generate_changelog.py` helper that drafts Markdown changelogs from git ranges, branch diffs, release refs, and Conventional Commit subjects.

### Changed

- Unified project documentation branding to `谛听` and `diting` across README, docs, OpenSpec specs, OpenSpec design notes, and archived change records.
- Renamed architecture narrative documents to the `docs/architecture/diting-*.md` pattern and updated all local references.
- Updated documentation examples, environment-variable references, webhook header references, package references, and implementation path references to use `diting` naming consistently.
- Refreshed the documentation landing page metadata and visible project label to use `谛听` and `diting`.

### Fixed

- Fixed local Markdown links affected by the architecture document rename.
- Replaced links to the removed architecture workflow document with the current architecture index.
