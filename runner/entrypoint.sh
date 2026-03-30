#!/usr/bin/env bash

set -euo pipefail

WORKSPACE_ROOT="${AINATIVE_RUNNER_WORKSPACE:-/workspace}"
RUNNER_CONFIG_FILE="${AINATIVE_RUNNER_CONFIG_FILE:-${WORKSPACE_ROOT}/ainative.runner.json}"
LOG_DIR="${WORKSPACE_ROOT}/logs"

mkdir -p "${LOG_DIR}" /run/nginx /var/log/nginx /var/log/supervisor /etc/ainative

if [[ -n "${AINATIVE_RUNNER_CONFIG_JSON:-}" ]]; then
  node /usr/local/bin/ainative-render-runner-config
elif [[ -f "${RUNNER_CONFIG_FILE}" ]]; then
  node /usr/local/bin/ainative-render-runner-config "${RUNNER_CONFIG_FILE}"
else
  echo "AINative runner requires AINATIVE_RUNNER_CONFIG_JSON or ${RUNNER_CONFIG_FILE}" >&2
  exit 1
fi

exec supervisord -c /tmp/ainative-runner-supervisord.conf -n
