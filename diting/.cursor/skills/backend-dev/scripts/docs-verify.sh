#!/usr/bin/env bash
# 说明：技能文档自检脚本。
# 用途：校验技能文档、模板、Markdown 链接、Makefile target 和历史措辞，确保技能规则自身保持一致。
# 覆盖：references/*.md、模板中文注释、过期项目名/命令、Proto/API 生成口径和 HTTP 注册示例。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || cd "$SCRIPT_DIR/../../../.." && pwd)"
SKILL_DIR="$ROOT/.agents/skills/backend-dev"

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

echo "== Backend skill docs verification =="

if [[ -n "$BACKEND" && -f "$BACKEND/Makefile" ]]; then
  required_targets=(api protocode wire gorm)
  optional_targets=(sqlimport sqltopb)
  for target in "${required_targets[@]}"; do
    if ! rg "^${target}:" "$BACKEND/Makefile" >/dev/null; then
      echo "WARN: Makefile target not found in detected backend: $target"
    fi
  done
  for target in "${optional_targets[@]}"; do
    if ! rg "^${target}:" "$BACKEND/Makefile" >/dev/null; then
      echo "WARN: optional Makefile target not found in detected backend: $target"
    fi
  done
else
  echo "WARN: backend module not detected; skipped Makefile target checks"
fi

stale_module="gitlab.yc345.tv/backend/ainative""-backend"
stale_model="ainative""_backend"
stale_sql_dir="doc/sql/yan""xue"
stale_api="api/ad""min"
stale_cmd="make pb""tocode"
project_terms=(
  "study""space-service"
  "study""space_service"
  "study""space_crm"
)
history_terms=(
  "旧""技能"
  "旧后端""技能"
  "depre""cated"
  "恢复""旧"
)

for pattern in "$stale_module" "$stale_model" "$stale_sql_dir" "$stale_api" "$stale_cmd" "${project_terms[@]}"; do
  if rg "$pattern" "$SKILL_DIR" >/dev/null; then
    echo "ERROR: stale skill document pattern found: $pattern"
    exit 1
  fi
done

for term in "${history_terms[@]}"; do
  if rg "$term" "$SKILL_DIR" >/dev/null; then
    echo "ERROR: historical wording found in backend-dev docs: $term"
    exit 1
  fi
done

optional_protocode_patterns=(
  "用户明确""要求.*make protocode"
  "确认""接受.*make protocode"
  "只有用户""确认.*make protocode"
  "只有用户明确""要求脚手架"
)

for pattern in "${optional_protocode_patterns[@]}"; do
  if rg "$pattern" "$SKILL_DIR" >/dev/null; then
    echo "ERROR: optional protocode wording found: $pattern"
    exit 1
  fi
done

ambiguous_proto_patterns=(
  "Confirm Proto ""Plan"
  "必须先获得用户""确认"
  "用户""确认后才允许"
  "必须先向用户""确认"
)

for pattern in "${ambiguous_proto_patterns[@]}"; do
  if rg "$pattern" "$SKILL_DIR" >/dev/null; then
    echo "ERROR: outdated proto confirmation wording found: $pattern"
    exit 1
  fi
done

required_generation_docs=(
  "$SKILL_DIR/SKILL.md"
  "$SKILL_DIR/references/api-generation.md"
  "$SKILL_DIR/references/examples.md"
  "$SKILL_DIR/references/quality-gate.md"
  "$SKILL_DIR/references/project-context.md"
)

for doc in "${required_generation_docs[@]}"; do
  if ! rg "make api" "$doc" >/dev/null || ! rg "make protocode" "$doc" >/dev/null; then
    echo "ERROR: generation document must mention both make api and make protocode: $doc"
    exit 1
  fi
done

stale_alias_patterns=(
  "shadowv1\\.Register"
  "appv1\\.Register"
  "\\{position\\}v1\\.Register"
)

for pattern in "${stale_alias_patterns[@]}"; do
  if rg "$pattern" "$SKILL_DIR" >/dev/null; then
    echo "ERROR: stale HTTP registration alias found in backend-dev docs: $pattern"
    exit 1
  fi
done

python3 - "$SKILL_DIR" <<'PY'
import re
import sys
from pathlib import Path

root = Path(sys.argv[1])
missing = []
comment_errors = []
link_re = re.compile(r"\[[^\]]+\]\(([^)]+\.md(?:#[^)]+)?)\)")

for path in root.rglob("*.md"):
    text = path.read_text(encoding="utf-8")
    for raw in link_re.findall(text):
        target = raw.split("#", 1)[0]
        if target.startswith(("http://", "https://", "/")):
            continue
        candidate = (path.parent / target).resolve()
        if not candidate.exists():
            missing.append(f"{path.relative_to(root)} -> {raw}")

required_comments = {
    "references/templates-service.md": [
        "ProductList",
        "ProductInfo",
        "ProductStore",
        "ProductDel",
    ],
    "references/templates-biz.md": [
        "ProductList",
        "ProductInfo",
        "ProductStore",
        "ProductDel",
        "ProductStatus",
        "BatchCreate",
        "UpdateStock",
    ],
}

for rel, funcs in required_comments.items():
    path = root / rel
    text = path.read_text(encoding="utf-8")
    for func in funcs:
        pattern = re.compile(rf"// {func} [^\n]*[\u4e00-\u9fff][^\n]*\nfunc \([^)]*\) {func}\(")
        if not pattern.search(text):
            comment_errors.append(f"{rel}: missing Chinese comment for {func}")

if missing:
    print("ERROR: broken markdown links:")
    for item in missing:
        print(f"  {item}")
    sys.exit(1)

if comment_errors:
    print("ERROR: template method comments missing:")
    for item in comment_errors:
        print(f"  {item}")
    sys.exit(1)
PY

echo "OK: backend skill docs checks passed"
