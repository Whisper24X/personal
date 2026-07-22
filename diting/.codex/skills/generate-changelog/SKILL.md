---
name: generate-changelog
description: Generate Markdown changelog drafts from Git history, branch diffs, release ranges, or Conventional Commit messages. Use when the user asks to automatically create, update, draft, summarize, or prepare a changelog, release notes, version notes, branch change summary, or "what changed" section from a repository.
---

# Generate Changelog

## Workflow

1. Identify the repository and commit range.
   - Use the current working directory when the user does not specify a repo.
   - Use `--range A..B` when the user gives an exact range.
   - Use `--from <ref> --to <ref>` for release ranges.
   - With no range, let the script compare the current branch against the merge-base of `origin/main`, `main`, or `master`.
2. Run `scripts/generate_changelog.py` and inspect the generated Markdown.
3. Edit the draft only for clarity: combine duplicate items, remove noisy internal chores if the user wants user-facing notes, and preserve issue/PR identifiers.
4. If writing to a file, update the target changelog section without deleting unrelated historical entries.

## Script

Run from any Git repository:

```bash
python3 /path/to/generate-changelog/scripts/generate_changelog.py
```

Useful options:

```bash
python3 /path/to/generate-changelog/scripts/generate_changelog.py --from v1.2.0 --to HEAD
python3 /path/to/generate-changelog/scripts/generate_changelog.py --range origin/main..HEAD
python3 /path/to/generate-changelog/scripts/generate_changelog.py --repo /path/to/repo --output CHANGELOG.draft.md
python3 /path/to/generate-changelog/scripts/generate_changelog.py --user-facing
```

## Output Guidance

- Keep the final answer concise and include the changelog path if a file was written.
- For user-facing changelogs, prefer sections like Added, Fixed, Changed, Performance, Documentation, Maintenance, Reverted, Breaking Changes.
- For engineering changelogs, keep technical scopes and commit hashes when useful.
- If the script reports no commits, say that no commits were found for the selected range and show the range used.
