#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
BACKEND="$ROOT/studyspace-service"

echo "== Generated artifact checks =="

if [[ -f "$BACKEND/server" ]]; then
  echo "ERROR: build artifact remains: studyspace-service/server"
  exit 1
fi

old_skill_prefix="backend-"
old_skill_suffixes=(
  audit
  database
  gorm
  proto-gen
  proto-edit
  api-gen
  codeing
  quality
)

for suffix in "${old_skill_suffixes[@]}"; do
  dir="${old_skill_prefix}${suffix}"
  if [[ -d "$ROOT/.agents/skills/$dir" ]]; then
    echo "ERROR: unexpected backend skill directory remains: .agents/skills/$dir"
    exit 1
  fi
done

stale_api_cmd="make pb""tocode"
if rg "$stale_api_cmd" "$ROOT/.agents/skills" >/dev/null; then
  echo "ERROR: stale command found: $stale_api_cmd"
  exit 1
fi

stale_skill_phrase="Skill tool with skill"
stale_skill_phrase="${stale_skill_phrase}=\"backend-"
if rg "$stale_skill_phrase" "$ROOT/.agents/skills/backend-dev" >/dev/null; then
  echo "ERROR: backend-dev still instructs invoking old backend sub-skills"
  exit 1
fi

"$ROOT/.agents/skills/backend-dev/scripts/verify-skill-docs.sh"

echo "OK: no stale generated artifacts or old backend skill commands found"
