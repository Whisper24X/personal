#!/bin/bash
# Summary .learnings: pending count and high-priority entries.
# Usage: ./summary-learnings.sh [LEARNINGS_DIR]
#   LEARNINGS_DIR defaults to .learnings (relative to cwd).
# Example (from project root for a workspace):
#   ./skills/self-improvement/scripts/summary-learnings.sh workspace/xxx/ainative-workspace/.learnings

set -e

LEARNINGS_DIR="${1:-.learnings}"

if [[ ! -d "$LEARNINGS_DIR" ]]; then
  echo "Directory not found: $LEARNINGS_DIR"
  exit 1
fi

# Avoid literal glob when no .md files
shopt -s nullglob 2>/dev/null || true
MD_FILES=("$LEARNINGS_DIR"/*.md)
shopt -u nullglob 2>/dev/null || true

echo "=== .learnings summary: $LEARNINGS_DIR ==="
echo ""

# Pending count (matches "**Status**: pending" in markdown)
if [[ ${#MD_FILES[@]} -eq 0 ]]; then
  PENDING=0
else
  PENDING=$(grep -h "Status\*\*: pending" "${MD_FILES[@]}" 2>/dev/null | wc -l | tr -d ' ')
  PENDING=${PENDING:-0}
fi
echo "Pending entries: $PENDING"
echo ""

# High/critical priority: show heading lines (## [ID] ...)
echo "High/Critical priority entries:"
if [[ ${#MD_FILES[@]} -gt 0 ]]; then
  grep -B5 -Eh "Priority\*\*: (high|critical)" "${MD_FILES[@]}" 2>/dev/null | grep "^## \[" || true
fi
echo ""

echo "Done. Use SKILL.md '定期回顾' for resolution and promotion steps."
