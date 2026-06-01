#!/usr/bin/env bash
# TC-channel-013：CSV 映射配置（「其他」Tab）— 与 csv文件映射配置.md 对齐
# 依赖：在项目根目录单独执行 npm install（勿把「# 注释」粘在命令后，否则 npm 会报错）
#
# 用法：
#   export AGENT_BROWSER_BASE_URL="https://你的后台根地址或已登录后的落地页"
#   # 可选：Playwright storageState / agent-browser 导出的 state
#   export AGENT_BROWSER_STATE="$PWD/auth.json"
#   # 调试时显示浏览器窗口（与 agent-browser 一致，也可用 AGENT_BROWSER_HEADED=1）
#   # export TC013_HEADED=1
#   # 可选：截图前校验 URL 须包含的子串（避免 nginx 默认页等误保存成「成功」截图）
#   # export TC013_URL_MUST_CONTAIN="你的域名片段"
# 可选：跳过 Then 条款自动化（保存成功 / 弹窗仍在 / Tab「其他」），默认会校验
#   # export TC013_SKIP_THEN_ASSERTS=1
#   # 可选：若首屏已在「渠道订单管理」，跳过菜单导航
#   # export AGENT_BROWSER_SKIP_NAV=1
#   ./scripts/tc-channel-013-csv-mapping.sh
#
# 保存后跳到 nginx：多为跳转到了「裸域名根」https://host/（无 /trip 等前端 base），命中 nginx 默认站。
#   脚本会在保存后检测并自动 open 回 AGENT_BROWSER_BASE_URL（可用 TC013_RECOVER_AFTER_SAVE=0 关闭）。
#   根因需前端/接口把 location 改为带 publicPath 的完整路径。
#
# 说明：不同 UI（Ant Design 等）的可访问性命名可能不同；若 find 失败，请
#   npx agent-browser snapshot -i -s ".ant-modal-content"（或整页）后按 @ref 操作。
#
# 弹窗区域截图：agent-browser 支持 screenshot [selector] [path]；若保存后弹窗已关闭，
#   第二张图可能失败，脚本会忽略该错误（见 TC013_SCREENSHOT_DIALOG）。
#
# 本地配置：在项目根目录执行 cp local-env.example.sh local-env.sh 并填写变量；
#   首次登录态：./scripts/tc-channel-013-save-auth.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$ROOT/local-env.sh" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/local-env.sh"
fi
cd "$ROOT"

: "${AGENT_BROWSER_BASE_URL:?请设置 AGENT_BROWSER_BASE_URL，或创建 local-env.sh（见 local-env.example.sh）}"

AB="$ROOT/node_modules/.bin/agent-browser"
if [[ ! -x "$AB" ]]; then
  echo "缺少 $AB，请在项目根目录执行: npm install" >&2
  exit 1
fi

# 不用空数组 + "${arr[@]}"：在 set -u 下 macOS 自带 bash 3.2 会报 unbound variable
HEADED=0
if [[ "${AGENT_BROWSER_HEADED:-}" == "1" || "${AGENT_BROWSER_HEADED:-}" == "true" \
  || "${TC013_HEADED:-}" == "1" || "${TC013_HEADED:-}" == "true" ]]; then
  HEADED=1
fi

ab_cli() {
  if [[ "$HEADED" -eq 1 ]]; then
    "$AB" --headed "$@"
  else
    "$AB" "$@"
  fi
}

ab_cli close 2>/dev/null || true
sleep 0.8
ab_cli close 2>/dev/null || true

# 只在启动时 load 一次登录态
if [[ -n "${AGENT_BROWSER_STATE:-}" && -f "$AGENT_BROWSER_STATE" ]]; then
  ab_cli state load "$AGENT_BROWSER_STATE"
fi

ab() {
  ab_cli "$@"
  sleep 0.45
}

echo "==> 打开页面"
ab open "$AGENT_BROWSER_BASE_URL"
ab wait --load networkidle

CURRENT_URL="$(ab get url)"

if [[ -n "${AGENT_BROWSER_SKIP_NAV:-}" ]]; then
  echo "==> 跳过菜单导航（AGENT_BROWSER_SKIP_NAV=1）"
elif [[ "$CURRENT_URL" == *"order/channel"* ]]; then
  echo "==> 当前已在渠道订单管理路由，跳过菜单点击（避免重复点「订单管理」破坏页面）"
else
  echo "==> Step 1：订单管理 → 渠道订单管理"
  ab find text "订单管理" click
  ab find text "渠道订单管理" click
  ab wait --load networkidle
fi

echo "==> 等待渠道订单页就绪"
ab wait --load networkidle

echo "==> Step 2：CSV 映射配置弹窗"
ab find role button click --name "CSV映射配置"
ab wait --text "CSV文件映射配置"

echo "==> Step 3：Tab「其他」+ 区块加载"
ab find role tab click --name "其他"
ab wait --load networkidle
# wait --text 在本机 daemon 上易 EAGAIN；用短毫秒等待 Tab 面板挂载（Element Plus）
ab wait 2500

# 洋葱研学为 Element Plus（.el-dialog）；下拉无「系统字段」无障碍名，按弹窗内 combobox 顺序操作
MODAL_SEL="${TC013_MODAL_SELECTOR:-.el-dialog}"
COMBO_SEL="${MODAL_SEL} [role=combobox]"
PH_STATUS="${MODAL_SEL} [placeholder=\"输入CSV文件中的状态值\"]"

tc013_pick_el_option() {
  local label="$1"
  local js
  js="$(node -e 'console.log(JSON.stringify(process.argv[1]))' "$label")"
  ab_cli eval --stdin <<EOS
(() => {
  const label = $js;
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
    .filter(e => e.offsetParent !== null);
  const el = items.find(e => (e.textContent || '').trim() === label)
    || items.find(e => (e.textContent || '').includes(label));
  if (el) el.click();
})();
EOS
}

tc013_dialog_root_eval='const d = document.querySelector(".el-overlay-dialog .el-dialog") || document.querySelector(".el-dialog");'

tc013_dialog_select_click() {
  local idx="$1"
  ab_cli eval --stdin <<EOS
(() => {
  ${tc013_dialog_root_eval}
  const w = d && d.querySelectorAll('.el-select__wrapper');
  if (w && w[${idx}]) w[${idx}].click();
})();
EOS
}

tc013_fill_status_placeholder() {
  local nth="$1" val="$2"
  local vj
  vj="$(node -e 'console.log(JSON.stringify(process.argv[1]))' "$val")"
  ab_cli eval --stdin <<EOS
(() => {
  ${tc013_dialog_root_eval}
  if (!d) return;
  const val = $vj;
  const n = ${nth};
  const inputs = [...d.querySelectorAll('input')].filter(i =>
    (i.placeholder || '').includes('输入CSV文件中的状态值'));
  const el = inputs[n];
  if (!el) return;
  el.focus();
  el.value = '';
  el.dispatchEvent(new InputEvent('input', { bubbles: true, data: val, inputType: 'insertText' }));
  el.value = val;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
})();
EOS
}

echo "==> Step 4：系统字段与 CSV 字段映射"
if [[ -n "${TC013_ADD_FIELD_ROW:-}" ]]; then
  ab find text "添加字段映射" click || true
fi
tc013_dialog_select_click 0
ab wait 800
ab find role option click --name "订单编号" || ab find text "订单编号" click || tc013_pick_el_option 订单编号
ab find placeholder "输入CSV文件字段名" fill "A"

echo "==> Step 5：订单状态值映射"
if [[ -n "${TC013_ADD_ORDER_STATUS_ROW:-}" ]]; then
  ab find text "添加状态映射" click || true
fi
tc013_dialog_select_click 1
ab wait 800
ab find role option click --name "待支付" || ab find text "待支付" click || tc013_pick_el_option 待支付
tc013_fill_status_placeholder 0 "B"

echo "==> Step 6：服务状态值映射"
if [[ -n "${TC013_ADD_SERVICE_STATUS_ROW:-}" ]]; then
  ab find text "添加状态映射" click || true
fi
tc013_dialog_select_click "${TC013_SERVICESTATUS_COMBOBOX_NTH:-2}"
ab wait 800
ab find role option click --name "待预约" || ab find text "待预约" click || tc013_pick_el_option 待预约
tc013_fill_status_placeholder 1 "C"

echo "==> Step 7：保存（优先点弹窗 footer 内按钮，避免点到页面上其它「保存」）"
ab_cli eval --stdin <<'EOS'
(() => {
  const d = document.querySelector('.el-overlay-dialog .el-dialog') || document.querySelector('.el-dialog');
  if (!d) return;
  const footer = d.querySelector('.el-dialog__footer');
  const scope = footer || d;
  let btn = [...scope.querySelectorAll('button')].find(b => (b.textContent || '').trim() === '保存');
  if (!btn) {
    btn = [...d.querySelectorAll('button.el-button--primary')].find(b => (b.textContent || '').trim() === '保存');
  }
  if (btn) btn.click();
})();
EOS
ab wait --load networkidle

# Then（csv文件映射配置.md）：须在 recover 之前校验——recover 会 open BASE_URL，toast/弹窗状态会丢失
tc013_assert_then_clause() {
  [[ "${TC013_SKIP_THEN_ASSERTS:-}" == "1" ]] && return 0
  local v
  echo "==> Then：等待页面出现「保存成功」"
  ab wait --text "保存成功"

  echo "==> Then：映射配置弹窗仍应可见"
  v="$(ab_cli eval '(() => { const d = document.querySelector(".el-overlay-dialog .el-dialog") || document.querySelector(".el-dialog"); if (!d) return "0"; const r = d.getBoundingClientRect(); const st = window.getComputedStyle(d); const vis = st.visibility !== "hidden" && st.display !== "none" && Number(st.opacity || 1) > 0; return (r.width > 2 && r.height > 2 && vis) ? "1" : "0"; })()' 2>/dev/null || echo 0)"
  if [[ "${v//[$'\t\r\n ']}" != "1" ]]; then
    echo "错误：Then 不满足——未检测到可见的 .el-dialog 映射弹窗。" >&2
    return 1
  fi

  echo "==> Then：当前选中 Tab 应为「其他」"
  v="$(ab_cli eval '(() => {
    const tabs = [...document.querySelectorAll("[role=tab]")];
    const t = tabs.find(e => (e.textContent || "").replace(/\\s+/g, "").includes("其他"));
    if (!t) return "0";
    const sel = t.getAttribute("aria-selected") === "true" || t.classList.contains("is-active");
    return sel ? "1" : "0";
  })()' 2>/dev/null || echo 0)"
  if [[ "${v//[$'\t\r\n ']}" != "1" ]]; then
    echo "错误：Then 不满足——Tab「其他」未处于选中态（aria-selected / is-active）。" >&2
    return 1
  fi
  return 0
}

if ! tc013_assert_then_clause; then
  failed_png="${TC013_SCREENSHOT:-./tc-channel-013-after-save.png}"
  failed_png="${failed_png%.png}-FAILED.png"
  echo "==> Then 断言失败，保存排查截图: $failed_png" >&2
  ab screenshot "$failed_png" 2>/dev/null || true
  exit 1
fi

ab wait 1500

# 保存后若整页跳到 https://host/ 或出现 nginx 欢迎页，拉回业务入口（否则截图与校验必挂）
tc013_recover_after_save_if_needed() {
  [[ "${TC013_RECOVER_AFTER_SAVE:-1}" == "0" ]] && return 0
  local u peek
  u="$(ab get url)"
  peek="$(ab_cli eval \
    '(document.body && document.body.innerText) ? document.body.innerText.slice(0, 500) : ""' 2>/dev/null || true)"
  if [[ "$u" =~ ^https?://[^/?#]+/?$ ]] || echo "$peek" | grep -qi 'Welcome to nginx'; then
    echo "==> 保存后当前页非业务路由（裸域名根或 nginx 默认页）。常见原因：跳转使用了 \`/\` 而未带前端 base（如 /trip）。" >&2
    echo "    正在重新打开 AGENT_BROWSER_BASE_URL …" >&2
    ab open "$AGENT_BROWSER_BASE_URL"
    ab wait --load networkidle
    ab wait 2000
  fi
}

tc013_recover_after_save_if_needed

tc013_assert_page_ok_for_screenshot() {
  local final_url peek failed_png
  final_url="$(ab get url)"
  if [[ -n "${TC013_URL_MUST_CONTAIN:-}" && "$final_url" != *"${TC013_URL_MUST_CONTAIN}"* ]]; then
    echo "错误：当前 URL 不包含 TC013_URL_MUST_CONTAIN=${TC013_URL_MUST_CONTAIN}" >&2
    echo "  实际 URL: $final_url" >&2
    echo "  请检查 AGENT_BROWSER_BASE_URL、网关跳转与登录态。" >&2
    return 1
  fi
  peek="$(ab_cli eval \
    '(document.body && document.body.innerText) ? document.body.innerText.slice(0, 500) : ""' 2>/dev/null || true)"
  if echo "$peek" | grep -qi 'Welcome to nginx'; then
    echo "错误：页面正文为 nginx 默认欢迎页，不是业务后台。" >&2
    echo "  当前 URL: $final_url" >&2
    echo "  请修正 local-env.sh 中的地址或网络/DNS。" >&2
    return 1
  fi
  if [[ "$final_url" =~ ^https?://localhost/?$ ]] || [[ "$final_url" =~ ^https?://127\.0\.0\.1/?$ ]]; then
    echo "错误：当前仅为本机根路径（localhost / 127.0.0.1），通常为未配置的默认站点。" >&2
    echo "  请设置完整的业务 AGENT_BROWSER_BASE_URL。" >&2
    return 1
  fi
  return 0
}

SHOT="${TC013_SCREENSHOT:-./tc-channel-013-after-save.png}"
SHOT_DIALOG="${TC013_SCREENSHOT_DIALOG:-./tc-channel-013-dialog-after-save.png}"

echo "==> 断言：截图前校验当前页（避免 nginx 等误当成功）"
if ! tc013_assert_page_ok_for_screenshot; then
  failed_png="${SHOT%.png}-FAILED.png"
  [[ "$failed_png" == "$SHOT" ]] && failed_png="./tc-channel-013-after-save-FAILED.png"
  echo "==> 校验失败，仍保存排查用截图: $failed_png" >&2
  ab screenshot "$failed_png" || true
  exit 1
fi

echo "==> 截图留证（全页）"
ab screenshot "$SHOT"

echo "==> 可选：弹窗区域截图（若选择器不存在则跳过）"
ab screenshot ".el-overlay-dialog .el-dialog" "$SHOT_DIALOG" 2>/dev/null \
  || ab screenshot ".el-dialog" "$SHOT_DIALOG" 2>/dev/null \
  || echo "（未截取到弹窗，可能已关闭或无 .el-dialog）"

echo "==> TC-channel-013 主流程完成（请人工或结合 snapshot 校验行内数据是否与 A/B/C 一致）"
