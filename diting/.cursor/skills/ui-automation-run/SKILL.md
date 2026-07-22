---
name: ui-automation-run
description: Use when ui-automation-master routes to UI automation Run for Playwright execution, evidence capture, metrics, rerun, or review bridge output.
---

# UI Automation Run

## 作用

执行 `TEST.md`，采集证据，计算指标，复盘结果，并在需要时输出可转写的修复桥接内容。
这是子 skill 执行层，只在 `ui-automation-master` 路由到 `Run` 时使用。浏览器自动化必须使用 `playwright-skill`。

## 负责范围

- 读取 `TEST.md`
- 执行 `本轮是否执行=是` 的 case
- 产出 `testExecutionReport.md`
- 产出 `TEST-EXECUTION-RECORD.md`
- 产出 `uiAutomationMetrics.json`
- 产出 `testExecutionResult.md`
- 产出 `testReview.md`
- 在失败且可修复时，产出 `Improve Review Bridge`
- 处理 rerun 场景，但仍只负责 UI 证据，不做代码修复
- 预认证登录态注入、网络证据、DOM 证据、console 证据都属于 run 阶段职责
- 生成、校验并执行 Playwright by-id 脚本

## 输入

- 当前任务的 `TEST.md`
- 上一轮的 `testExecutionReport.md` / `TEST-EXECUTION-RECORD.md` / `testExecutionResult.md`
- `uiAutomationMetrics.json`
- `testReview.md`
- 执行协议与脚本：
  - `skills/ui-automation-run/references/contract-v2-lite.md`
  - `skills/ui-automation-run/scripts/calc_ui_metrics.py`
  - `skills/ui-automation-run/references/case-template-v2-lite.md`
- Playwright 执行能力：
  - `skills/playwright-skill/SKILL.md`

## 必须继承的协议

- 执行必须遵守 `contract-v2-lite.md`
- 先做 scope / executable gate，再执行
- 执行入口必须是浏览器可访问页面：原生小程序 case 不直接执行；Taro 跨端 case 使用目标仓启动后的 H5 URL 或菜单入口执行。
- 只执行 `本轮是否执行=是` 的 case
- `SKIPPED_NOT_IN_SCOPE` 与 `SKIPPED_NOT_EXECUTABLE` 口径必须与 contract 一致
- `TEST-EXECUTION-RECORD.md` 必须包含结构化 facts JSON
- `testReview.md` 必须带可转写的 Improve Review Bridge
- 当任务提供预认证登录态注入能力时，必须优先使用
- 当任务要求重跑时，必须读取上一轮报告并只重跑受影响范围
- 必须保留以下事实字段：`caseId`、`priority`、`inScope`、`executable`、`result`、`durationMs`、`ttiMs`、`retryCount`、`blockedReason`、`skippedReason`、`samplePath`、`completionRate`、`usabilityScore`、`operabilityScore`、`deadClickCount`、`invalidInputCount`
- `testExecutionReport.md` 需要包含执行概览、用例结果、跳过范围、证据索引、失败/阻塞原因、建议动作
- `testExecutionResult.md` 固定两行，且只能由 `calc_ui_metrics.py` 写出
- 若存在 `TITING_AUTH_LOGIN_API` / `TITING_AUTH_LOGIN_BODY_JSON` / `TITING_AUTH_TOKEN_JSON_PATH` / `TITING_AUTH_STORAGE_KEY` / `TITING_AUTH_ENTRY_URL`，必须先注入已登录会话再执行
- 必须遵循 `playwright-skill` 的固定顺序：抽取 case ID -> 写入 by-id 脚本 -> 校验覆盖 -> 更新 `AUTOMATED_TEST.md` -> 执行
- Playwright 脚本先写入 `/tmp/playwright-test-*.js`，再同步到任务 artifacts，不得写入 skill 目录

## 规则

- 必须使用 `playwright-skill`，不得使用 MCP、CDP、browser-mcp 或 DevTools MCP 作为执行器
- 先判 scope，再执行
- 若 case 标注为小程序/Taro，先解析目标仓当前 H5 启动地址；无法拿到 H5 入口时按 `SKIPPED_NOT_EXECUTABLE` 记录，不得改用原生小程序调试器或非 Playwright 执行器。
- 只执行 `本轮是否执行=是` 的 case
- `SKIPPED_NOT_IN_SCOPE` 和 `SKIPPED_NOT_EXECUTABLE` 按当前 scope / executable 口径处理
- 执行阶段不改业务代码
- 必须运行 `skills/ui-automation-run/scripts/calc_ui_metrics.py` 生成或重算 `uiAutomationMetrics.json` 和 `testExecutionResult.md`
- `testExecutionResult.md` 只能以该脚本输出为准，不得手算门禁结论
- 只有指标脚本输出 `gate.status=passed`，才允许把 `testExecutionResult.md` 写成 `已完成`
- 不能跳过脚本直接写门禁结论
- 执行与复盘应遵循 `Observation -> Action -> Recover -> Verify` 的闭环
- 发生卡点时，必须写出单卡点 `3 x N` 解阻记录

## 输出与复盘

- 执行结果必须有证据
- 复盘必须基于 `uiAutomationMetrics.json` 和执行记录
- `testReview.md` 结尾必须给出可直接转写的 `Improve Review Bridge`
- 如果复盘判定要修复，必须给出重跑范围
- `testReview.md` 需要明确字段映射和 SKIPPED 归因口径
- 证据至少包含 Playwright 输出、截图或 trace、DOM 状态、console 摘要、关键网络请求摘要

## 重跑模式

- 修复后重新读取上一轮报告
- 只重跑受影响的 P0 / P1 范围
- 重跑完成后重新算指标、重写结果文件
- 不把“代码已修复”当成最终完成，必须有 UI 重跑证据
- 完成后交回 `ui-automation-master` 重新判断下一阶段
