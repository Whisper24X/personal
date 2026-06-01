#!/usr/bin/env bash
# 使用方式：
#   cp local-env.example.sh local-env.sh
#   编辑 local-env.sh 填写下面各项
# local-env.sh 已被 .gitignore 忽略，勿提交仓库。

# 项目根目录（source 本文件时自动解析，勿改）
_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 自动化入口：登录后能打开的首页或业务起始页（与用例里菜单起点一致即可）
export AGENT_BROWSER_BASE_URL="https://请填写你的后台根地址"

# 首次生成 auth 用：登录页完整 URL
export AGENT_BROWSER_LOGIN_URL="https://请填写你的登录页地址"

# 账号密码（仅保存在本机 local-env.sh；不要提交）
export AGENT_BROWSER_USERNAME="请填写账号"
export AGENT_BROWSER_PASSWORD="请填写密码"

# 登录态保存路径（运行 scripts/tc-channel-013-save-auth.sh 后生成）
export AGENT_BROWSER_STATE="$_ROOT/.agent-browser-secrets/tc013-auth.json"

# 显示浏览器窗口（调试用；也可用 TC013_HEADED=1）
# export AGENT_BROWSER_HEADED=1

# 跑 TC013 时截图前校验：当前 URL 必须包含的子串（例如域名片段 yangcong345.com 或 trip）
# export TC013_URL_MUST_CONTAIN="yangcong345.com"

# 可选：已进入「渠道订单管理」页时再跑用例，跳过侧边菜单
# export AGENT_BROWSER_SKIP_NAV=1

# 可选：跳过 TC013 Then 自动化断言（保存成功 / 弹窗仍在 / Tab「其他」）
# export TC013_SKIP_THEN_ASSERTS=1
