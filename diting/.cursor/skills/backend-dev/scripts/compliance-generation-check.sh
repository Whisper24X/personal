#!/usr/bin/env bash
# 说明：合规验证生成一致性检查脚本。
# 用途：识别 Proto/API 与 GORM 生成场景，重新执行标准 make target，并比较生成前后 diff 是否一致。
# 注意：本文件依赖 compliance-context.sh 中的公共变量和函数，不应直接执行。

detect_generation_scope() {
  proto_involved=false
  gorm_involved=false

  case "$task_type" in
    crud|rpc|generation)
      proto_involved=true
      ;;
  esac

  case "$task_type" in
    crud|gorm)
      gorm_involved=true
      ;;
  esac

  if [[ ${#proto_args[@]} -gt 0 ]] || has_changed_match '\.proto$'; then
    proto_involved=true
  fi

  if [[ -n "$table_name" ]] || has_changed_match '(^|/)doc/sql/.*\.sql$'; then
    gorm_involved=true
  fi
}

run_generation_consistency() {
  local label="$1"
  shift
  local before after
  before="$(mktemp)"
  after="$(mktemp)"
  snapshot_backend_diff "$before"
  if ! (cd "$BACKEND" && "$@"); then
    rm -f "$before" "$after"
    fail "$label command failed"
    return
  fi
  snapshot_backend_diff "$after"
  if ! cmp -s "$before" "$after"; then
    echo "ERROR: $label changed backend diff after regeneration"
    echo "Regeneration command must be committed into the current change before Quality Gate passes."
    diff -u "$before" "$after" | sed -n '1,160p' || true
    failures=$((failures + 1))
  else
    echo "OK: $label generation is consistent"
  fi
  rm -f "$before" "$after"
}

verify_proto_generation() {
  [[ "$proto_involved" == true ]] || return 0

  local proto
  local rel_path
  local base
  local generated
  local proto_files=()

  for proto in "${proto_args[@]}"; do
    proto_files+=("$(path_to_abs "$proto")")
  done

  for rel_path in "${changed_files[@]}"; do
    if [[ "$rel_path" == *.proto ]]; then
      proto_files+=("$GIT_ROOT/$rel_path")
    fi
  done

  for proto in "${proto_files[@]}"; do
    [[ -f "$proto" ]] || continue
    base="${proto%.proto}"
    for generated in "${base}.pb.go" "${base}_http.pb.go" "${base}_grpc.pb.go" "${base}.pb.validate.go"; do
      if [[ ! -f "$generated" ]]; then
        fail "generated proto artifact missing: $(git_rel "$generated")"
      fi
    done
  done

  run_generation_consistency "Proto/API" bash -c 'make api && make protocode'
}

verify_gorm_generation() {
  [[ "$gorm_involved" == true ]] || return 0
  run_generation_consistency "GORM" bash -c 'make gorm'
}
