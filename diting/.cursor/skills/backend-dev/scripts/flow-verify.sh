#!/usr/bin/env bash
# 说明：后端基础流程验证脚本。
# 用途：检查目标后端模块是否具备基础服务工件，并按需校验 HTTP Gateway 注册是否存在。
# 覆盖：后端目录识别、internal/server/http.go、internal/service/service.go、cmd/*/wire_gen.go 和 Register{Service}HTTPServer。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || cd "$SCRIPT_DIR/../../../.." && pwd)"

backend_arg=""
service_name=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-dir)
      backend_arg="${2:-}"
      shift 2
      ;;
    --backend-dir=*)
      backend_arg="${1#*=}"
      shift
      ;;
    *)
      if [[ -z "$service_name" ]]; then
        service_name="$1"
        shift
      else
        echo "ERROR: unexpected argument: $1"
        exit 1
      fi
      ;;
  esac
done

resolve_backend_dir() {
  local input="${BACKEND_DIR:-$backend_arg}"
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

BACKEND="$(resolve_backend_dir 2>/dev/null || true)"

echo "== Backend flow verification =="

if [[ -z "$BACKEND" || ! -d "$BACKEND" ]]; then
  echo "ERROR: backend module directory not found under $ROOT"
  exit 1
fi

HTTP_FILE="$BACKEND/internal/server/http.go"

if [[ ! -f "$HTTP_FILE" ]]; then
  echo "ERROR: internal/server/http.go not found"
  exit 1
fi

if [[ -n "$service_name" ]]; then
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

shopt -s nullglob
wire_files=("$BACKEND"/cmd/*/wire_gen.go "$BACKEND"/cmd/server/wire_gen.go)
shopt -u nullglob
if [[ ${#wire_files[@]} -eq 0 ]]; then
  echo "WARN: wire_gen.go not found under cmd/*"
fi

if [[ ! -f "$BACKEND/internal/service/service.go" ]]; then
  echo "ERROR: internal/service/service.go not found"
  exit 1
fi

echo "OK: backend flow baseline checks passed"
