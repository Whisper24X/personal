#!/usr/bin/env bash
# 说明：合规验证第三方 HTTP RPC 检查脚本。
# 用途：检查 internal/data/rpc 中的 Resty 用法、上下文/Trace/状态码检查，以及 ProviderSet 和 Wire 注入。
# 注意：本文件依赖 compliance-context.sh 中的公共变量和函数，不应直接执行。

collect_http_rpc_files() {
  http_rpc_files=()
  local file
  local rel_path

  for file in "${http_rpc_args[@]}"; do
    http_rpc_files+=("$(path_to_abs "$file")")
  done

  for rel_path in "${changed_files[@]}"; do
    if [[ "$rel_path" =~ (^|/)internal/data/rpc/.*\.go$ ]]; then
      http_rpc_files+=("$GIT_ROOT/$rel_path")
    fi
  done
}

verify_http_rpc_provider_set() {
  local constructor="$1"
  local data_file="$BACKEND/internal/data/data.go"
  if [[ ! -f "$data_file" ]]; then
    fail "internal/data/data.go not found for HTTP RPC ProviderSet check"
  elif ! rg "$constructor" "$data_file" >/dev/null; then
    fail "$constructor not registered in internal/data/data.go ProviderSet"
  fi
}

verify_http_rpc_wire() {
  local constructor="$1"
  local wire_found=false
  local wire_file

  shopt -s nullglob
  for wire_file in "$BACKEND"/cmd/*/wire_gen.go "$BACKEND"/cmd/server/wire_gen.go; do
    if rg "$constructor" "$wire_file" >/dev/null; then
      wire_found=true
      break
    fi
  done
  shopt -u nullglob

  if [[ "$wire_found" == false ]]; then
    fail "$constructor not found in cmd/*/wire_gen.go; run make wire after ProviderSet changes"
  fi
}

verify_http_rpc_file() {
  local file="$1"
  local constructor

  if rg 'resty\.New\(' "$file" >/dev/null; then
    fail "resty.New() found in HTTP RPC file; use injected *resty.Client: $(git_rel "$file")"
  fi

  if rg 'restyClient\.R\(\)|\.R\(\)' "$file" >/dev/null; then
    rg 'SetContext\(ctx\)' "$file" >/dev/null || fail "SetContext(ctx) missing in HTTP RPC file: $(git_rel "$file")"
    rg 'EnableTrace\(\)' "$file" >/dev/null || fail "EnableTrace() missing in HTTP RPC file: $(git_rel "$file")"
    rg 'CheckStatus\(' "$file" >/dev/null || fail "CheckStatus(resp) or equivalent status check missing in HTTP RPC file: $(git_rel "$file")"
  fi

  while IFS= read -r constructor; do
    [[ -n "$constructor" ]] || continue
    verify_http_rpc_provider_set "$constructor"
    verify_http_rpc_wire "$constructor"
  done < <(rg -o 'func New[A-Za-z0-9]+HttpRpc' "$file" 2>/dev/null | sed 's/^func //')
}

verify_no_direct_resty_new() {
  local rel_path
  local abs_path

  for rel_path in "${changed_files[@]}"; do
    if [[ "$rel_path" =~ (^|/)internal/(data|biz|service)/.*\.go$ && ! "$rel_path" =~ (^|/)internal/pkg/ ]]; then
      abs_path="$ROOT/$rel_path"
      if [[ ! -f "$abs_path" ]]; then
        abs_path="$GIT_ROOT/$rel_path"
      fi
      if [[ -f "$abs_path" ]] && rg 'resty\.New\(' "$abs_path" >/dev/null; then
        fail "resty.New() found outside unified resty package: $rel_path"
      fi
    fi
  done
}

verify_http_rpc_compliance() {
  local file
  local seen_http_rpc_files=()

  collect_http_rpc_files

  for file in "${http_rpc_files[@]}"; do
    [[ -f "$file" ]] || continue
    if array_contains "$file" "${seen_http_rpc_files[@]}"; then
      continue
    fi
    seen_http_rpc_files+=("$file")
    verify_http_rpc_file "$file"
  done

  verify_no_direct_resty_new
}
