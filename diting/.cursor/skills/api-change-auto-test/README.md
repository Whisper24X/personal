# api-change-auto-test 可移植版

完整可移植 Skill 包，支持 **OpenSpec delta spec** 与 legacy **`apiChanges.md`**。按 skill 内 `api-test/runtime.json` 判型 admin/client 鉴权，默认直连本机后端。

## 目录

- `SKILL.md`
- `env.example` / `.env.local.template`
- `api-test/runtime.example.json`
- `scripts/`
  - `runtime-config.mjs` — 加载 runtime.json、classifyEndpoint、env 合并
  - `check-auth-ready.mjs` — Phase A 鉴权就绪检查
  - `write-env-local.mjs` — 合并写入 `.env.local`
  - `start-backend.sh` — Phase B 按 runtime 起服 + 健康检查
  - `run-api-change-suite.sh`
  - `run-runner-http-suite.mjs`
  - `parse-api-changes.mjs`
  - `generate-report.mjs`
  - `calculate-metrics.mjs` — 计算接口自动化测试评估指标

## Titing / 飞书 spec 附件打包

```text
spec.zip
├── WORKFLOW_PROMPTS.md
├── openspec/
│   ├── specs/<change-id>/spec.md
│   └── changes/<change-id>/tasks.md
└── skills/
    └── api-change-auto-test/
        └── api-test/runtime.json
```

## 快速使用

```bash
export SKILL_WORKSPACE_ROOT="/path/to/.titing/workspaces/<task-id>"
cd "$SKILL_WORKSPACE_ROOT"

# Phase A
node skills/api-change-auto-test/scripts/check-auth-ready.mjs

# Phase B（需 runtime.json.backend）
bash skills/api-change-auto-test/scripts/start-backend.sh
node skills/api-change-auto-test/scripts/write-env-local.mjs

# 测试
bash skills/api-change-auto-test/scripts/run-api-change-suite.sh smoke <change-id>
```

`<change-id>` 可省略；省略时自动探测最新 OpenSpec spec。

## 报告

`tmp/api-test-reports/<change-id>/`：

```text
parsed-apis.json      # 含 authChannel
smoke-result.json     # cases 含 authChannel
full-result.json      # full 执行结果
metrics.json          # 六项评估指标、等级、综合得分
summary.md            # 汇总结论，含 Auth Channel、耗时、超时和评估指标
```

`metrics.json` 根据《接口自动化测试指标调研报告》计算：

- 用例通过率：通过断言数 / 总断言数
- 平均响应时间：总响应时间 / 请求总数
- P95 响应时间：第 95 百分位请求耗时
- 数据一致率：从可选 `cases[].consistencyChecks[]` 聚合；未提供时标记为不可计算，不参与综合评分
- 超时率：超时请求数 / 总请求数
- Agent 执行成功率：成功完成任务数 / 总任务数

综合得分使用报告中的权重；遇到不可计算指标时，仅对可计算指标按剩余权重重归一化。

## 鉴权双链路

| 链路 | token 来源 |
|------|-----------|
| 全自动 | 执行机 / diting 进程 env：`RUNNER_ADMIN_AUTH_HEADER` 等 |
| 人机 | `needs_human` 后人工写 `.cursor/skills/api-change-auto-test/.env.local` |

legacy 名 `RUNNER_SHADOW_AUTH_HEADER` / `RUNNER_WECHAT_AUTH_HEADER` 仍兼容。

## 直连模式（默认）

```bash
export RUNNER_DIRECT_MODE="true"
export RUNNER_BASE_URL="http://127.0.0.1:8000"
export RUNNER_REQUEST_TIMEOUT_MS="30000"
```

仅当显式设置 `RUNNER_CONTAINER_NAME` 且 `RUNNER_DIRECT_MODE=false` 时使用 docker。

## 迁移到其他项目

复制 `skills/api-change-auto-test/` 到 spec 包，并在 skill 内自备 `api-test/runtime.json`（可参考 `api-test/runtime.example.json`）。
