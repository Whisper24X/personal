#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SKILL_DIR="$ROOT/.agents/skills/backend-dev"
BACKEND="$ROOT/studyspace-service"

echo "== Backend skill docs verification =="

required_targets=(api protocode wire gorm sqlimport sqltopb)
for target in "${required_targets[@]}"; do
  if ! rg "^${target}:" "$BACKEND/Makefile" >/dev/null; then
    echo "ERROR: Makefile target not found: $target"
    exit 1
  fi
done

stale_module="gitlab.yc345.tv/backend/ainative""-backend"
stale_model="ainative""_backend"
stale_sql_dir="doc/sql/yan""xue"
stale_api="api/ad""min"
stale_cmd="make pb""tocode"
history_terms=(
  "旧""技能"
  "旧后端""技能"
  "迁""移"
  "depre""cated"
  "恢复""旧"
)

for pattern in "$stale_module" "$stale_model" "$stale_sql_dir" "$stale_api" "$stale_cmd"; do
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

if ! rg 'yc_turbo_kit sqltopb .* -t "\$\$TABLES"' "$BACKEND/Makefile" >/dev/null; then
  echo 'ERROR: Makefile sqltopb target must pass table list with -t "$$TABLES"'
  exit 1
fi

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
