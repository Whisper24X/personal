#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-all}"
REGISTRY="docker.yc345.tv"
NAMESPACE="devices"
TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
PUSH_LATEST="${PUSH_LATEST:-1}"

log() {
  printf '==> %s\n' "$*" >&2
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

ensure_backend_ssh_files() {
  local required_files=(
    "backend/ssh/id_rsa"
    "backend/ssh/known_hosts"
  )

  local file
  for file in "${required_files[@]}"; do
    [[ -f "$file" ]] || fail "missing required file for backend image build: $file"
  done
}

build_and_push() {
  local service="$1"
  local context="$2"
  local repository
  case "${service}" in
    frontend)
      repository="ainative-frontend"
      ;;
    backend)
      repository="ainative-backend"
      ;;
    *)
      fail "unsupported service '${service}'"
      ;;
  esac

  local image="${REGISTRY}/${NAMESPACE}/${repository}"
  local versioned_image="${image}:${TAG}"

  log "building ${versioned_image}"
  if [[ "${PUSH_LATEST}" == "1" ]]; then
    docker build -t "${versioned_image}" -t "${image}:latest" "${context}" >&2
  else
    docker build -t "${versioned_image}" "${context}" >&2
  fi

  log "pushing ${versioned_image}"
  docker push "${versioned_image}" >&2

  if [[ "${PUSH_LATEST}" == "1" ]]; then
    log "pushing ${image}:latest"
    docker push "${image}:latest" >&2
  fi

  printf '%s\n' "${versioned_image}"
}

require_command docker
require_command git

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "${REPO_ROOT}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "this command must run inside a git repository"
fi

case "${TARGET}" in
  all|frontend|backend)
    ;;
  *)
    fail "unsupported target '${TARGET}', expected one of: all, frontend, backend"
    ;;
esac

log "registry: ${REGISTRY}"
log "image tag: ${TAG}"

if [[ "${PUSH_LATEST}" == "1" ]]; then
  log "latest tag: enabled"
else
  log "latest tag: disabled"
fi

published_images=()

if [[ "${TARGET}" == "all" || "${TARGET}" == "frontend" ]]; then
  published_images+=("$(build_and_push frontend ./frontend)")
fi

if [[ "${TARGET}" == "all" || "${TARGET}" == "backend" ]]; then
  ensure_backend_ssh_files
  published_images+=("$(build_and_push backend ./backend)")
fi

log "published images:"
printf '  %s\n' "${published_images[@]}"
