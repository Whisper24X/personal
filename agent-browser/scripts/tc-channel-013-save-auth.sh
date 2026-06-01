#!/usr/bin/env bash
# 读取 local-env.sh 中的 LOGIN_URL / USERNAME / PASSWORD，写入 AGENT_BROWSER_STATE
#
# 用法（在项目根目录）：
#   ./scripts/tc-channel-013-save-auth.sh
#
# 显示浏览器：在 local-env.sh 中设置 AGENT_BROWSER_HEADED=1 或 TC013_HEADED=1，
#   或仅本次手动登录时用 TC013_AUTH_HEADED=1（与上述任一方式等价，均会加 --headed）。
#
# 若自动登录失败（验证码/SSO/选择器不匹配），用手动方式：
#   TC013_AUTH_HEADED=1 ./scripts/tc-channel-013-save-auth.sh
# 浏览器打开后自行登录，回到终端按回车，再保存 state。

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

AB="$ROOT/node_modules/.bin/agent-browser"
if [[ ! -x "$AB" ]]; then
  echo "缺少 $AB，请在项目根目录执行: npm install" >&2
  exit 1
fi

if [[ -f "$ROOT/local-env.sh" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/local-env.sh"
else
  echo "缺少 $ROOT/local-env.sh"
  echo "请执行: cp local-env.example.sh local-env.sh 并填写地址与账号密码"
  exit 1
fi

: "${AGENT_BROWSER_LOGIN_URL:?请在 local-env.sh 中设置 AGENT_BROWSER_LOGIN_URL}"
: "${AGENT_BROWSER_USERNAME:?请在 local-env.sh 中设置 AGENT_BROWSER_USERNAME}"
: "${AGENT_BROWSER_PASSWORD:?请在 local-env.sh 中设置 AGENT_BROWSER_PASSWORD}"
: "${AGENT_BROWSER_STATE:?请在 local-env.sh 中设置 AGENT_BROWSER_STATE}"

# 必须在 source local-env 之后判断，否则 AGENT_BROWSER_HEADED 等不生效
# 不用空数组 + "${arr[@]}"：set -u 下 macOS bash 3.2 会报 unbound variable
HEADED=0
if [[ "${AGENT_BROWSER_HEADED:-}" == "1" || "${AGENT_BROWSER_HEADED:-}" == "true" \
  || "${TC013_HEADED:-}" == "1" || "${TC013_HEADED:-}" == "true" \
  || "${TC013_AUTH_HEADED:-}" == "1" || "${TC013_AUTH_HEADED:-}" == "true" ]]; then
  HEADED=1
fi

ab_cli() {
  if [[ "$HEADED" -eq 1 ]]; then
    "$AB" --headed "$@"
  else
    "$AB" "$@"
  fi
}

mkdir -p "$(dirname "$AGENT_BROWSER_STATE")"

ab_cli close 2>/dev/null || true

if [[ "${TC013_AUTH_HEADED:-}" == "1" ]]; then
  echo ">>>  headed 模式：请在浏览器中完成登录，成功后回到此处按回车保存会话…"
  ab_cli open "$AGENT_BROWSER_LOGIN_URL"
  ab_cli wait --load networkidle
  read -r -p "登录完成后按回车继续…"
  ab_cli state save "$AGENT_BROWSER_STATE"
else
  echo ">>> 使用 auth vault 尝试自动登录…"
  echo "$AGENT_BROWSER_PASSWORD" | ab_cli auth save tc013 \
    --url "$AGENT_BROWSER_LOGIN_URL" \
    --username "$AGENT_BROWSER_USERNAME" \
    --password-stdin
  set +e
  ab_cli auth login tc013
  login_ec=$?
  set -e
  if [[ "$login_ec" -ne 0 ]]; then
    echo ">>> auth login 未匹配到提交按钮，改用页面语义定位…"
    ab_cli close 2>/dev/null || true
    ab_cli open "$AGENT_BROWSER_LOGIN_URL"
    ab_cli wait --load networkidle
    ab_cli wait --text "账号"
    # 洋葱研学 / Element Plus：快照为 textbox「* 账号」，关联 label 为「账号」
    ab_cli find label "账号" fill "$AGENT_BROWSER_USERNAME" \
      || ab_cli find label "手机号" fill "$AGENT_BROWSER_USERNAME" \
      || ab_cli find label "用户名" fill "$AGENT_BROWSER_USERNAME" \
      || ab_cli find placeholder "手机" fill "$AGENT_BROWSER_USERNAME" \
      || ab_cli find placeholder "邮箱" fill "$AGENT_BROWSER_USERNAME" \
      || ab_cli find role textbox fill "$AGENT_BROWSER_USERNAME"
    ab_cli find label "密码" fill "$AGENT_BROWSER_PASSWORD" \
      || ab_cli find placeholder "密码" fill "$AGENT_BROWSER_PASSWORD"
    ab_cli find role button click --name "登录" \
      || ab_cli find text "登录" click
    ab_cli wait --load networkidle
  fi
  ab_cli state save "$AGENT_BROWSER_STATE"
fi

echo ">>> 已保存: $AGENT_BROWSER_STATE"
echo ">>> 运行用例: ./scripts/tc-channel-013-csv-mapping.sh"
