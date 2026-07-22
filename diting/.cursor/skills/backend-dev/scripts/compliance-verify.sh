#!/usr/bin/env bash
# 说明：后端代码合规验证总入口。
# 用途：解析任务参数，加载专项检查脚本，检查本次后端变更是否偏离 backend-dev 规则。
# 覆盖：生成一致性、HTTP Gateway 注册、ProviderSet/Wire、Biz 常量位置、第三方 HTTP RPC 写法和构建产物残留。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || cd "$SCRIPT_DIR/../../../.." && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/compliance-context.sh"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/compliance-generation-check.sh"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/compliance-core-check.sh"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/compliance-http-rpc-check.sh"

backend_arg=""
task_type="other"
service_name=""
table_name=""
declare -a proto_args=()
declare -a http_rpc_args=()

usage() {
  echo "Usage: compliance-verify.sh --backend-dir <dir> --task-type <crud|rpc|logic|gorm|generation|other> [--service <ServiceName>] [--proto <path>] [--table <name>] [--http-rpc-file <path>]"
}

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
    --task-type)
      task_type="${2:-}"
      shift 2
      ;;
    --task-type=*)
      task_type="${1#*=}"
      shift
      ;;
    --service)
      service_name="${2:-}"
      shift 2
      ;;
    --service=*)
      service_name="${1#*=}"
      shift
      ;;
    --proto)
      proto_args+=("${2:-}")
      shift 2
      ;;
    --proto=*)
      proto_args+=("${1#*=}")
      shift
      ;;
    --table)
      table_name="${2:-}"
      shift 2
      ;;
    --table=*)
      table_name="${1#*=}"
      shift
      ;;
    --http-rpc-file)
      http_rpc_args+=("${2:-}")
      shift 2
      ;;
    --http-rpc-file=*)
      http_rpc_args+=("${1#*=}")
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unexpected argument: $1"
      usage
      exit 1
      ;;
  esac
done

BACKEND="$(resolve_backend_dir 2>/dev/null || true)"

echo "== Backend compliance verification =="

if [[ -z "$BACKEND" || ! -d "$BACKEND" ]]; then
  echo "ERROR: backend module directory not found under $ROOT"
  exit 1
fi

if ! git -C "$BACKEND" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: backend module is not a git worktree: $BACKEND"
  exit 1
fi

GIT_ROOT="$(git -C "$BACKEND" rev-parse --show-toplevel)"

load_changed_files
detect_generation_scope

echo "Backend: $BACKEND"
echo "Task type: $task_type"

run_core_compliance_checks
verify_proto_generation
verify_gorm_generation
verify_http_rpc_compliance

if [[ $failures -gt 0 ]]; then
  echo "FAILED: backend compliance verification found $failures issue(s)"
  exit 1
fi

echo "OK: backend compliance checks passed"
