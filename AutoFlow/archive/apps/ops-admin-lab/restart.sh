#!/usr/bin/env bash
# 重启 ops-admin-lab 两个服务
# 用法：bash restart.sh

set -e
cd "$(dirname "$0")"

wait_for_url() {
  local name="$1"
  local url="$2"
  local timeout_seconds="${3:-15}"
  local elapsed=0

  while [ "$elapsed" -lt "$timeout_seconds" ]; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  echo "❌ ${name} 启动失败：${url} 在 ${timeout_seconds}s 内未就绪"
  return 1
}

echo "🔄 停止旧进程..."
lsof -ti:4175 | xargs kill -9 2>/dev/null || true   # dev server
lsof -ti:4176 | xargs kill -9 2>/dev/null || true   # test-runner
lsof -ti:4177 | xargs kill -9 2>/dev/null || true   # playwright test server (独立端口)
sleep 1

echo "🚀 启动应用服务 (4175)..."
npm run dev &
APP_PID=$!

echo "🚀 启动 Test Runner (4176)..."
npm run test-runner &
TR_PID=$!

if ! wait_for_url "应用服务" "http://127.0.0.1:4175/api/health"; then
  kill "$APP_PID" "$TR_PID" 2>/dev/null || true
  exit 1
fi

if ! wait_for_url "Test Runner" "http://127.0.0.1:4176/api/tr/health"; then
  kill "$APP_PID" "$TR_PID" 2>/dev/null || true
  exit 1
fi

echo ""
echo "✅ 服务已就绪"
echo "   应用:        http://127.0.0.1:4175"
echo "   Test Runner: http://127.0.0.1:4176"
