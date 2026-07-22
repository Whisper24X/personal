#!/usr/bin/env python3
"""Generate a Markdown changelog draft from git commits."""

from __future__ import annotations

import argparse
import datetime as dt
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


SECTION_ORDER = [
    "Breaking Changes",
    "Added",
    "Fixed",
    "Changed",
    "Performance",
    "Documentation",
    "Tests",
    "Maintenance",
    "Reverted",
    "Other",
]

TYPE_TO_SECTION = {
    "feat": "Added",
    "fix": "Fixed",
    "perf": "Performance",
    "refactor": "Changed",
    "style": "Changed",
    "docs": "Documentation",
    "test": "Tests",
    "build": "Maintenance",
    "chore": "Maintenance",
    "ci": "Maintenance",
    "revert": "Reverted",
}

USER_FACING_SECTIONS = {
    "Breaking Changes",
    "Added",
    "Fixed",
    "Changed",
    "Performance",
    "Reverted",
    "Other",
}


@dataclass
class Commit:
    sha: str
    date: str
    subject: str
    body: str


def run_git(repo: Path, args: list[str], check: bool = True) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if check and result.returncode != 0:
        message = result.stderr.strip() or result.stdout.strip()
        raise SystemExit(f"git {' '.join(args)} failed: {message}")
    return result.stdout.strip()


def ref_exists(repo: Path, ref: str) -> bool:
    subprocess_result = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "--verify", "--quiet", ref],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return subprocess_result.returncode == 0


def default_range(repo: Path, to_ref: str) -> str:
    for base in ("origin/main", "main", "master"):
        if ref_exists(repo, base):
            merge_base = run_git(repo, ["merge-base", base, to_ref])
            return f"{merge_base}..{to_ref}"

    tags = run_git(repo, ["tag", "--sort=-creatordate"], check=False).splitlines()
    if tags:
        return f"{tags[0]}..{to_ref}"
    return to_ref


def parse_commits(repo: Path, revision_range: str, include_merges: bool) -> list[Commit]:
    pretty = "%x1e%h%x1f%ad%x1f%s%x1f%b"
    args = ["log", revision_range, f"--pretty=format:{pretty}", "--date=short"]
    if not include_merges:
        args.append("--no-merges")
    raw = run_git(repo, args, check=False)
    commits: list[Commit] = []
    for record in raw.split("\x1e"):
        record = record.strip()
        if not record:
            continue
        parts = record.split("\x1f", 3)
        if len(parts) != 4:
            continue
        commits.append(Commit(*[part.strip() for part in parts]))
    return commits


def parse_subject(subject: str) -> tuple[str, str, bool]:
    match = re.match(r"(?P<type>[a-zA-Z]+)(?:\((?P<scope>[^)]+)\))?(?P<bang>!)?:\s*(?P<desc>.+)", subject)
    if not match:
        return "Other", subject, False

    commit_type = match.group("type").lower()
    section = TYPE_TO_SECTION.get(commit_type, "Other")
    scope = match.group("scope")
    desc = match.group("desc").strip()
    breaking = bool(match.group("bang"))
    if scope:
        desc = f"**{scope}:** {desc}"
    return section, desc, breaking


def render(commits: list[Commit], revision_range: str, title: str, user_facing: bool) -> str:
    today = dt.date.today().isoformat()
    grouped: dict[str, list[str]] = {section: [] for section in SECTION_ORDER}

    for commit in commits:
        section, description, breaking = parse_subject(commit.subject)
        if "BREAKING CHANGE" in commit.body or "BREAKING-CHANGE" in commit.body:
            breaking = True
        item = description
        if not user_facing:
            item = f"{item} ({commit.sha})"
        if breaking:
            grouped["Breaking Changes"].append(item)
        elif section in grouped:
            grouped[section].append(item)
        else:
            grouped["Other"].append(item)

    lines = [f"# {title}", "", f"_Generated {today} from `{revision_range}`._", ""]
    if not commits:
        lines.extend(["No commits found for this range.", ""])
        return "\n".join(lines)

    for section in SECTION_ORDER:
        items = grouped[section]
        if user_facing and section not in USER_FACING_SECTIONS:
            continue
        if not items:
            continue
        lines.extend([f"## {section}", ""])
        for item in items:
            lines.append(f"- {item}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=os.getcwd(), help="Git repository path. Defaults to cwd.")
    parser.add_argument("--range", dest="revision_range", help="Exact git revision range, e.g. v1.0.0..HEAD.")
    parser.add_argument("--from", dest="from_ref", help="Start ref for changelog range.")
    parser.add_argument("--to", dest="to_ref", default="HEAD", help="End ref. Defaults to HEAD.")
    parser.add_argument("--include-merges", action="store_true", help="Include merge commits.")
    parser.add_argument("--user-facing", action="store_true", help="Omit hashes and internal-only sections.")
    parser.add_argument("--title", default="Changelog", help="Markdown title.")
    parser.add_argument("--output", help="Write Markdown to this file instead of stdout.")
    args = parser.parse_args()

    repo = Path(args.repo).expanduser().resolve()
    if not (repo / ".git").exists() and not run_git(repo, ["rev-parse", "--git-dir"], check=False):
        raise SystemExit(f"not a git repository: {repo}")

    if args.revision_range:
        revision_range = args.revision_range
    elif args.from_ref:
        revision_range = f"{args.from_ref}..{args.to_ref}"
    else:
        revision_range = default_range(repo, args.to_ref)

    commits = parse_commits(repo, revision_range, args.include_merges)
    markdown = render(commits, revision_range, args.title, args.user_facing)

    if args.output:
        output = Path(args.output).expanduser()
        if not output.is_absolute():
            output = repo / output
        output.write_text(markdown, encoding="utf-8")
        print(f"wrote {output}")
    else:
        print(markdown, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
