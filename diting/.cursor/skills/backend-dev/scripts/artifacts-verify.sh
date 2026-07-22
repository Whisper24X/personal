#!/usr/bin/env bash
# 说明：生成物和历史残留验证脚本。
# 用途：检查本地构建产物、历史子技能目录、过期命令和技能文档一致性，避免无关生成物混入交付。
# 覆盖：<backend-dir>/server、旧 backend-* 技能目录、过期 make 命令、技能文档链接和 Makefile target。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || cd "$SCRIPT_DIR/../../../.." && pwd)"

resolve_backend_dir() {
  local input="${BACKEND_DIR:-${1:-}}"
  if [[ -n "$input" ]]; then
    if [[ "$input" = /* ]]; then
      echo "$input"
    else
      echo "$ROOT/$input"
    fi
    return 0
  fi

  if [[ -f "$ROOT/go.mod" && -f "$ROOT/Makefile" && -f "$ROOT/internal/server/http.go" ]]; then
    echo "$ROOT"
    return 0
  fi

  local candidate
  for candidate in "$ROOT"/*; do
    [[ -d "$candidate" ]] || continue
    [[ -f "$candidate/go.mod" && -f "$candidate/Makefile" && -f "$candidate/internal/server/http.go" ]] || continue
    echo "$candidate"
    return 0
  done

  if [[ -f "$ROOT/go.mod" && -f "$ROOT/Makefile" ]]; then
    echo "$ROOT"
    return 0
  fi

  for candidate in "$ROOT"/*; do
    [[ -d "$candidate" ]] || continue
    [[ -f "$candidate/go.mod" && -f "$candidate/Makefile" ]] || continue
    echo "$candidate"
    return 0
  done

  return 1
}

BACKEND="$(resolve_backend_dir "${1:-}" 2>/dev/null || true)"

echo "== Generated artifact checks =="

if [[ -n "$BACKEND" && -f "$BACKEND/server" ]]; then
  echo "ERROR: build artifact remains: $BACKEND/server"
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

if [[ -n "$BACKEND" ]]; then
  BACKEND_DIR="$BACKEND" "$ROOT/.agents/skills/backend-dev/scripts/docs-verify.sh"
else
  "$ROOT/.agents/skills/backend-dev/scripts/docs-verify.sh"
fi

echo "OK: no stale generated artifacts or old backend skill commands found"
