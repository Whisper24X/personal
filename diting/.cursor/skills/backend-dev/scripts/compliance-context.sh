#!/usr/bin/env bash
# 说明：合规验证上下文脚本。
# 用途：供 compliance-verify.sh 加载，统一处理后端目录解析、Git diff、路径转换和错误收集。
# 注意：本文件只定义函数和公共变量，不应直接执行。

failures=0

fail() {
  echo "ERROR: $*"
  failures=$((failures + 1))
}

warn() {
  echo "WARN: $*"
}

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

path_to_abs() {
  local input="$1"
  if [[ "$input" = /* ]]; then
    echo "$input"
  elif [[ -e "$BACKEND/$input" ]]; then
    echo "$BACKEND/$input"
  else
    echo "$ROOT/$input"
  fi
}

git_rel() {
  local input="$1"
  if [[ "$input" == "$GIT_ROOT/"* ]]; then
    echo "${input#"$GIT_ROOT"/}"
  elif [[ "$input" == "$GIT_ROOT" ]]; then
    echo "."
  else
    echo "$input"
  fi
}

collect_changed_files() {
  {
    git -C "$GIT_ROOT" diff --name-only HEAD -- "$BACKEND"
    git -C "$GIT_ROOT" ls-files --others --exclude-standard -- "$BACKEND"
  } | LC_ALL=C sort -u
}

load_changed_files() {
  changed_files=()
  local changed_file
  while IFS= read -r changed_file; do
    [[ -n "$changed_file" ]] || continue
    changed_files+=("$changed_file")
  done < <(collect_changed_files)
}

has_changed_match() {
  local pattern="$1"
  local file
  for file in "${changed_files[@]}"; do
    if [[ "$file" =~ $pattern ]]; then
      return 0
    fi
  done
  return 1
}

snapshot_backend_diff() {
  local output="$1"
  {
    echo "## tracked-unstaged"
    git -C "$GIT_ROOT" diff --binary -- "$BACKEND" || true
    echo "## tracked-staged"
    git -C "$GIT_ROOT" diff --cached --binary -- "$BACKEND" || true
    echo "## untracked"
    git -C "$GIT_ROOT" ls-files --others --exclude-standard -- "$BACKEND" | LC_ALL=C sort | while IFS= read -r rel_path; do
      local abs_path="$GIT_ROOT/$rel_path"
      if [[ -f "$abs_path" ]]; then
        shasum "$abs_path"
      else
        echo "DIR $rel_path"
      fi
    done
  } > "$output"
}

array_contains() {
  local needle="$1"
  local item
  shift
  for item in "$@"; do
    if [[ "$item" == "$needle" ]]; then
      return 0
    fi
  done
  return 1
}
