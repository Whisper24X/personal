#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage:"
  echo "  bash skills/api-change-auto-test/scripts/run-api-change-suite.sh smoke [change-id|feature-id|spec.md|apiChanges.md]"
  echo "  bash skills/api-change-auto-test/scripts/run-api-change-suite.sh full  [change-id|feature-id|spec.md|apiChanges.md]"
  exit 1
fi

MODE="$1"
TARGET="${2:-}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_ROOT="${SKILL_WORKSPACE_ROOT:-$(pwd)}"
export SKILL_WORKSPACE_ROOT="${WORKSPACE_ROOT}"

load_env_local() {
  local f
  for f in \
    "${WORKSPACE_ROOT}/.cursor/skills/api-change-auto-test/.env.local" \
    "${WORKSPACE_ROOT}/skills/api-change-auto-test/.env.local" \
    "${SKILL_DIR}/.env.local"; do
    if [[ -f "${f}" ]]; then
      # shellcheck disable=SC1090
      set -a
      source "${f}"
      set +a
    fi
  done
}

load_env_local

resolve_open_spec_file() {
  local change_id="$1"
  local c0="${WORKSPACE_ROOT}/openspec/specs/${change_id}/spec.md"
  if [[ -f "${c0}" ]]; then
    echo "${c0}"
    return 0
  fi
  local c1="${WORKSPACE_ROOT}/openspec/changes/${change_id}/specs/http-api/spec.md"
  if [[ -f "${c1}" ]]; then
    echo "${c1}"
    return 0
  fi
  local found
  found="$(find "${WORKSPACE_ROOT}/openspec/changes/${change_id}/specs" -name 'spec.md' -type f 2>/dev/null | head -1 || true)"
  if [[ -n "${found}" && -f "${found}" ]]; then
    echo "${found}"
    return 0
  fi
  return 1
}

resolve_api_changes_file() {
  local input="$1"
  if [[ "${input}" == *.md ]]; then
    if [[ -f "${input}" ]]; then
      echo "$(cd "$(dirname "${input}")" && pwd)/$(basename "${input}")"
      return 0
    fi
    if [[ -f "${WORKSPACE_ROOT}/${input}" ]]; then
      echo "${WORKSPACE_ROOT}/${input}"
      return 0
    fi
    return 1
  fi

  if resolve_open_spec_file "${input}"; then
    return 0
  fi

  local c1="${WORKSPACE_ROOT}/docs/feature/${input}/apiChanges.md"
  local c2="${WORKSPACE_ROOT}/tmp/${input}/apiChanges.md"
  local c3="${WORKSPACE_ROOT}/tmp/apiChanges.runner.md"
  [[ -f "${c1}" ]] && { echo "${c1}"; return 0; }
  [[ -f "${c2}" ]] && { echo "${c2}"; return 0; }
  [[ -f "${c3}" ]] && { echo "${c3}"; return 0; }
  return 1
}

auto_detect_api_changes_file() {
  local newest_local
  newest_local="$(python3 - <<'PY' "${WORKSPACE_ROOT}"
import pathlib, sys
root = pathlib.Path(sys.argv[1])
candidates = list(root.glob("openspec/changes/*/specs/http-api/spec.md"))
if not candidates:
    candidates = list(root.glob("openspec/changes/*/specs/*/spec.md"))
if not candidates:
    candidates = list(root.glob("openspec/specs/*/spec.md"))
if not candidates:
    candidates = list(root.glob("docs/feature/*/apiChanges.md"))
if not candidates:
    candidates = list(root.glob("tmp/*/apiChanges.md"))
if not candidates:
    fallback = root / "tmp" / "apiChanges.runner.md"
    if fallback.exists():
        print(fallback)
    sys.exit(0)
latest = max(candidates, key=lambda p: p.stat().st_mtime)
print(latest)
PY
)"
  if [[ -n "${newest_local}" && -f "${newest_local}" ]]; then
    echo "${newest_local}"
    return 0
  fi

  local container_name
  container_name="$(docker ps --format '{{.Names}}\t{{.Image}}' 2>/dev/null | python3 - <<'PY' || true
import sys
for line in sys.stdin:
    line=line.strip()
    if not line:
        continue
    try:
        name, image = line.split('\t', 1)
    except ValueError:
        continue
    if "ainative/runner" in image:
        print(name)
        break
PY
)"
  if [[ -z "${container_name}" ]]; then
    return 1
  fi

  local container_doc
  container_doc="$(docker exec "${container_name}" python3 - <<'PY'
import pathlib
root = pathlib.Path("/workspace")
candidates = list(root.glob("openspec/changes/*/specs/http-api/spec.md"))
if not candidates:
    candidates = list(root.glob("openspec/changes/*/specs/*/spec.md"))
if not candidates:
    candidates = list(root.glob("openspec/specs/*/spec.md"))
if not candidates:
    candidates = list(root.glob("docs/feature/*/apiChanges.md"))
if not candidates:
    raise SystemExit(0)
latest = max(candidates, key=lambda p: p.stat().st_mtime)
print(str(latest))
PY
)"
  if [[ -z "${container_doc}" ]]; then
    return 1
  fi

  mkdir -p "${WORKSPACE_ROOT}/tmp"
  local copied="${WORKSPACE_ROOT}/tmp/apiChanges.runner.auto.md"
  docker cp "${container_name}:${container_doc}" "${copied}" >/dev/null
  if [[ -f "${copied}" ]]; then
    echo "${copied}"
    return 0
  fi
  return 1
}

derive_feature_id() {
  node -e "
const p = process.argv[1].replace(/\\\\/g, '/').split('/');
const changesIdx = p.indexOf('changes');
if (changesIdx >= 0 && p[changesIdx + 1] && p[changesIdx + 1] !== 'archive') {
  process.stdout.write(p[changesIdx + 1]);
  process.exit(0);
}
const openspecIdx = p.indexOf('openspec');
const specsIdx = openspecIdx >= 0 ? p.indexOf('specs', openspecIdx) : -1;
if (specsIdx >= 0 && p[specsIdx - 1] === 'openspec' && p[specsIdx + 1]) {
  process.stdout.write(p[specsIdx + 1]);
  process.exit(0);
}
const featureIdx = p.lastIndexOf('feature');
if (featureIdx >= 0 && p[featureIdx + 1]) {
  process.stdout.write(p[featureIdx + 1]);
  process.exit(0);
}
process.stdout.write(p[p.length - 2] || 'unknown-feature');
" "$1"
}

write_skipped_full_result() {
  local report_dir="$1"
  local feature_id="$2"
  local reason="$3"
  node -e "
const fs = require('fs');
const out = process.argv[1];
const featureId = process.argv[2];
const reason = process.argv[3];
const now = new Date().toISOString();
fs.writeFileSync(out, JSON.stringify({
  mode: 'full',
  status: 'skipped',
  featureId,
  reportDir: require('path').dirname(out),
  executionTarget: null,
  plannedCount: 0,
  passedCount: 0,
  failedCount: 0,
  startedAt: now,
  completedAt: now,
  durationMs: 0,
  logFile: '',
  cases: [],
  reason,
}, null, 2) + '\\n');
" "${report_dir}/full-result.json" "${feature_id}" "${reason}"
}

write_metrics() {
  local report_dir="$1"
  node "${SKILL_DIR}/scripts/calculate-metrics.mjs" \
    "${report_dir}" \
    "${report_dir}/metrics.json" >/dev/null
  echo "Metrics: ${report_dir}/metrics.json"
}

write_summary() {
  local report_dir="$1"
  write_metrics "${report_dir}"
  node "${SKILL_DIR}/scripts/generate-report.mjs" summary \
    "${report_dir}/parsed-apis.json" \
    "${report_dir}/smoke-result.json" \
    "${report_dir}/full-result.json" \
    "${report_dir}/summary.md"
  echo "Summary: ${report_dir}/summary.md"
}

if [[ -n "${TARGET}" ]]; then
  API_CHANGES_FILE="$(resolve_api_changes_file "${TARGET}" || true)"
  if [[ -z "${API_CHANGES_FILE}" ]]; then
    echo "Cannot resolve API change document from target: ${TARGET}"
    echo "Tried OpenSpec: openspec/specs/${TARGET}/spec.md"
    echo "Tried OpenSpec: openspec/changes/${TARGET}/specs/http-api/spec.md"
    echo "Tried legacy: docs/feature/${TARGET}/apiChanges.md"
    exit 1
  fi
else
  API_CHANGES_FILE="$(auto_detect_api_changes_file || true)"
  if [[ -z "${API_CHANGES_FILE}" ]]; then
    echo "Cannot auto-detect API change document. Pass change-id, feature-id, or file path explicitly."
    exit 1
  fi
fi

echo "Resolved API change document: ${API_CHANGES_FILE}"
if [[ "${MODE}" != "smoke" && "${MODE}" != "full" ]]; then
  echo "Unsupported mode: ${MODE}"
  exit 1
fi

FEATURE_ID="$(derive_feature_id "${API_CHANGES_FILE}")"
REPORT_DIR="${WORKSPACE_ROOT}/tmp/api-test-reports/${FEATURE_ID}"

set +e
node "${SKILL_DIR}/scripts/run-runner-http-suite.mjs" smoke "${API_CHANGES_FILE}"
SMOKE_CODE=$?
set -e

if [[ "${SMOKE_CODE}" -ne 0 ]]; then
  write_skipped_full_result "${REPORT_DIR}" "${FEATURE_ID}" "smoke failed"
  write_summary "${REPORT_DIR}"
  exit "${SMOKE_CODE}"
fi

# smoke 通过后自动衔接 full（smoke / full 两种入口行为一致）
set +e
node "${SKILL_DIR}/scripts/run-runner-http-suite.mjs" full "${API_CHANGES_FILE}"
FULL_CODE=$?
set -e
write_summary "${REPORT_DIR}"
exit "${FULL_CODE}"
