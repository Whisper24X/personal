#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
BACKEND="$ROOT/studyspace-service"

echo "== Backend flow verification =="

if [[ ! -d "$BACKEND" ]]; then
  echo "ERROR: studyspace-service directory not found under $ROOT"
  exit 1
fi

HTTP_FILE="$BACKEND/internal/server/http.go"

if [[ ! -f "$HTTP_FILE" ]]; then
  echo "ERROR: internal/server/http.go not found"
  exit 1
fi

if [[ "${1:-}" != "" ]]; then
  service_name="$1"
  echo "Checking HTTP registration for: $service_name"
  expected="Register${service_name}HTTPServer"
  if ! rg "$expected" "$HTTP_FILE" >/dev/null; then
    echo "ERROR: $expected not found in internal/server/http.go"
    echo "Expected a registration call like: {position}V1.${expected}(srv, {position}V1${service_name}Service)"
    echo "Existing HTTP registrations:"
    rg "Register[A-Za-z0-9]+HTTPServer" "$HTTP_FILE" || true
    exit 1
  fi
  echo "OK: HTTP registration found for $service_name"
fi

if [[ ! -f "$BACKEND/cmd/server/wire_gen.go" ]]; then
  echo "ERROR: cmd/server/wire_gen.go not found"
  exit 1
fi

if [[ ! -f "$BACKEND/internal/service/service.go" ]]; then
  echo "ERROR: internal/service/service.go not found"
  exit 1
fi

echo "OK: backend flow baseline checks passed"
