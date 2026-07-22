#!/usr/bin/env bash
# 说明：合规验证核心工件检查脚本。
# 用途：检查构建产物、HTTP Gateway 注册、Biz 常量位置，以及生成文件变更是否存在缺少触发条件的风险。
# 注意：本文件依赖 compliance-context.sh 中的公共变量和函数，不应直接执行。

run_core_compliance_checks() {
  if [[ -f "$BACKEND/server" ]]; then
    fail "build artifact remains: $BACKEND/server"
  fi

  if [[ -n "$service_name" ]]; then
    local http_file="$BACKEND/internal/server/http.go"
    if [[ ! -f "$http_file" ]]; then
      fail "internal/server/http.go not found"
    elif ! rg "Register${service_name}HTTPServer" "$http_file" >/dev/null; then
      fail "Register${service_name}HTTPServer not found in internal/server/http.go"
    else
      echo "OK: HTTP registration found for $service_name"
    fi
  fi

  if git -C "$GIT_ROOT" diff -U0 HEAD -- "$BACKEND/internal/biz" | rg '^\+const \(' >/dev/null; then
    fail "new const block found in internal/biz; move business constants to internal/data/constant"
  fi

  local generated_changed=false
  if has_changed_match '(^|/)api/.*(\.pb\.go|_http\.pb\.go|_grpc\.pb\.go|\.pb\.validate\.go)$' || \
    has_changed_match '(^|/)doc/swagger/.*\.json$' || \
    has_changed_match '(^|/)internal/data/gorm/.*(\.gen\.go|\.repo\.go)$'; then
    generated_changed=true
  fi

  if [[ "$generated_changed" == true && "$proto_involved" == false && "$gorm_involved" == false ]]; then
    warn "generated artifacts changed, but no proto/gorm trigger was detected; verify they came from standard make targets"
  fi
}
