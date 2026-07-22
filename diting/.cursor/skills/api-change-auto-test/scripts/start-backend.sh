#!/usr/bin/env bash

set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_ROOT="${SKILL_WORKSPACE_ROOT:-$(pwd)}"
export SKILL_WORKSPACE_ROOT="${WORKSPACE_ROOT}"

RUNTIME_JSON=""
for candidate in \
  "${SKILL_DIR}/api-test/runtime.json" \
  "${WORKSPACE_ROOT}/skills/api-change-auto-test/api-test/runtime.json" \
  "${WORKSPACE_ROOT}/.cursor/skills/api-change-auto-test/api-test/runtime.json" \
  "${WORKSPACE_ROOT}/api-test/runtime.json"; do
  if [[ -f "${candidate}" ]]; then
    RUNTIME_JSON="${candidate}"
    break
  fi
done

if [[ -z "${RUNTIME_JSON}" ]]; then
  echo "Missing runtime.json. Expected skills/api-change-auto-test/api-test/runtime.json"
  exit 1
fi

read_backend_field() {
  node -e "
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
const field = process.argv[2];
const backend = cfg.backend || {};
process.stdout.write(String(backend[field] || ''));
" "${RUNTIME_JSON}" "$1"
}

CWD_REL="$(read_backend_field cwd)"
START_COMMAND="$(read_backend_field startCommand)"
HEALTH_URL="$(read_backend_field healthUrl)"
BASE_URL="$(read_backend_field baseUrl)"
PID_FILE_REL="$(read_backend_field pidFile)"
LOG_FILE_REL="$(read_backend_field logFile)"

if [[ -z "${START_COMMAND}" ]]; then
  echo "runtime.json.backend.startCommand is required"
  exit 1
fi

if [[ -n "${CWD_REL}" ]]; then
  if [[ -d "${WORKSPACE_ROOT}/${CWD_REL}" ]]; then
    BACKEND_CWD="${WORKSPACE_ROOT}/${CWD_REL}"
  elif [[ -d "${CWD_REL}" ]]; then
    BACKEND_CWD="${CWD_REL}"
  else
    echo "Cannot resolve backend cwd: ${CWD_REL}"
    exit 1
  fi
else
  BACKEND_CWD="${WORKSPACE_ROOT}"
fi

PID_FILE="${WORKSPACE_ROOT}/${PID_FILE_REL:-tmp/api-test-backend.pid}"
LOG_FILE="${WORKSPACE_ROOT}/${LOG_FILE_REL:-tmp/api-test-backend.log}"
mkdir -p "$(dirname "${PID_FILE}")" "$(dirname "${LOG_FILE}")"

if [[ -f "${PID_FILE}" ]]; then
  OLD_PID="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -n "${OLD_PID}" ]] && kill -0 "${OLD_PID}" 2>/dev/null; then
    echo "Backend already running with pid ${OLD_PID}"
    if [[ -n "${HEALTH_URL}" ]]; then
      if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
        echo "Health check passed: ${HEALTH_URL}"
        exit 0
      fi
    else
      exit 0
    fi
  fi
fi

echo "Starting backend in ${BACKEND_CWD}"
echo "Command: ${START_COMMAND}"
nohup bash -lc "cd '${BACKEND_CWD}' && ${START_COMMAND}" >>"${LOG_FILE}" 2>&1 &
NEW_PID=$!
echo "${NEW_PID}" > "${PID_FILE}"
echo "Started backend pid ${NEW_PID}, log: ${LOG_FILE}"

if [[ -z "${HEALTH_URL}" ]]; then
  echo "No healthUrl configured; skipping health check"
  exit 0
fi

TIMEOUT_SEC="${RUNNER_BACKEND_HEALTH_TIMEOUT:-120}"
for ((i=1; i<=TIMEOUT_SEC; i++)); do
  if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
    echo "Health check passed: ${HEALTH_URL}"
    if [[ -n "${BASE_URL}" ]]; then
      export RUNNER_BASE_URL="${BASE_URL}"
      node "${SKILL_DIR}/scripts/write-env-local.mjs" >/dev/null
      echo "Updated .env.local with RUNNER_BASE_URL=${BASE_URL}"
    fi
    exit 0
  fi
  if ! kill -0 "${NEW_PID}" 2>/dev/null; then
    echo "Backend process ${NEW_PID} exited before health check passed"
    tail -n 40 "${LOG_FILE}" || true
    exit 1
  fi
  sleep 1
done

echo "Health check timed out after ${TIMEOUT_SEC}s: ${HEALTH_URL}"
tail -n 40 "${LOG_FILE}" || true
exit 1
