#!/usr/bin/env bash

set -euo pipefail

WORKSPACE_ROOT="${AINATIVE_RUNNER_WORKSPACE:-/workspace}"
RUNNER_CONFIG_FILE="${AINATIVE_RUNNER_CONFIG_FILE:-${WORKSPACE_ROOT}/ainative.runner.json}"
LOG_DIR="${WORKSPACE_ROOT}/logs"

mkdir -p "${LOG_DIR}" /run/nginx /var/log/nginx /var/log/supervisor /etc/ainative

configure_gitlab_http_auth() {
  local gitlab_token="${GITLAB_TOKEN:-}"
  if [[ -z "${gitlab_token}" ]]; then
    return
  fi

  local gitlab_username="${GITLAB_USERNAME:-oauth2}"

  urlencode() {
    python3 -c 'import sys, urllib.parse; sys.stdout.write(urllib.parse.quote(sys.argv[1], safe=""))' "$1"
  }

  export GIT_CONFIG_GLOBAL="${GIT_CONFIG_GLOBAL:-/root/.gitconfig}"
  mkdir -p "$(dirname "${GIT_CONFIG_GLOBAL}")"

  cat > /root/.netrc <<EOF
machine gitlab.yc345.tv
login ${gitlab_username}
password ${gitlab_token}
EOF
  chmod 600 /root/.netrc

  local encoded_username
  local encoded_token
  encoded_username="$(urlencode "${gitlab_username}")"
  encoded_token="$(urlencode "${gitlab_token}")"

  (
    cd /tmp
    git config --file "${GIT_CONFIG_GLOBAL}" url."https://${encoded_username}:${encoded_token}@gitlab.yc345.tv/".insteadOf "https://gitlab.yc345.tv/"
  )
}

configure_gitlab_http_auth
unset GITLAB_TOKEN GITLAB_USERNAME

if [[ -n "${AINATIVE_RUNNER_CONFIG_JSON:-}" ]]; then
  node /usr/local/bin/ainative-render-runner-config
elif [[ -f "${RUNNER_CONFIG_FILE}" ]]; then
  node /usr/local/bin/ainative-render-runner-config "${RUNNER_CONFIG_FILE}"
else
  echo "AINative runner requires AINATIVE_RUNNER_CONFIG_JSON or ${RUNNER_CONFIG_FILE}" >&2
  exit 1
fi

exec supervisord -c /tmp/ainative-runner-supervisord.conf -n
