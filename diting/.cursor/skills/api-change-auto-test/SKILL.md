---
name: api-change-auto-test
description: 基于 API 变更文档自动执行接口回归。支持 OpenSpec spec（openspec/specs/<change-id>/spec.md、openspec/changes/*/specs/http-api/spec.md）与 legacy apiChanges.md。解析新增/修改接口，按项目 runtime.json 判型 admin/client 鉴权并直连后端执行 smoke/full，产出标准化报告。用户提到 API 变更文档、接口自动化、OpenSpec http-api、按文档跑接口测试时使用。
disable-model-invocation: true
---

# API Change Auto Test

## 目标

将 API 变更文档转成可执行测试计划，并按 skill 内项目配置直连后端（默认）执行回归。skill **不负责起服**；鉴权与起服由 WORKFLOW `StartBackendService` 节点调用本 skill 脚本完成。

## 输入（优先级）

1. 显式传入 `.md` 文件路径（OpenSpec spec 或 `apiChanges.md`）
2. 传入 `<change-id>` → 依次尝试：
   - `openspec/specs/<change-id>/spec.md`
   - `openspec/changes/<change-id>/specs/http-api/spec.md`
   - 扫描 `openspec/changes/<change-id>/specs/*/spec.md`
3. 传入 `<feature-id>` → 读取 `docs/feature/<feature-id>/apiChanges.md`
4. 省略参数 → 自动探测工作区最新的 OpenSpec spec 或 `apiChanges.md`（含 `openspec/specs/*/spec.md`）

工作区根目录由 `SKILL_WORKSPACE_ROOT` 指定（Titing 任务默认为 `.titing/workspaces/<task-id>/`）。

## Titing 任务工作区部署

通过飞书「spec文档」附件 zip 分发，推荐结构：

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

`prepareWorkspace` 解压后，`loadSpecSkillsIntoWorkspace()` 会将 `skills/` 合并到 `.cursor/skills/`。

## 项目配置 `skills/api-change-auto-test/api-test/runtime.json`

单文件定义鉴权判型与后端起服。推荐随 skill 放在 `skills/api-change-auto-test/api-test/runtime.json`；兼容 legacy 工作区根 `api-test/runtime.json` 与 `api-test/api-auth.json`（仅 auth 子集）。示例见 `api-test/runtime.example.json`。

- `auth.channels`：admin / client 对应 `headerEnv`（支持 legacy env 名）
- `auth.classify`：按 `pathPrefix` / `pathRegex` / `moduleContains` 自动判型
- `backend`：`cwd`、`startCommand`、`healthUrl`、`baseUrl`（供 `start-backend.sh` 使用）

## StartBackendService 脚本（WORKFLOW 调用）

**Phase A — 鉴权就绪**

```bash
export SKILL_WORKSPACE_ROOT="/path/to/workspace"
node .cursor/skills/api-change-auto-test/scripts/check-auth-ready.mjs
```

- 退出码 `0`：就绪；`2`：缺 token；`1`：错误
- 双链路：进程 env 或 `.env.local` 任一满足即可

**Phase B — 起服 + 写 env**

```bash
bash .cursor/skills/api-change-auto-test/scripts/start-backend.sh
node .cursor/skills/api-change-auto-test/scripts/write-env-local.mjs
```

## 固定测试流程

1. 解析文档并生成结构化接口清单：
   ```bash
   node "$SKILL_DIR/scripts/parse-api-changes.mjs" <doc.md> <reportDir>/parsed-apis.json
   ```
2. 生成测试计划（smoke/full）：
   ```bash
   node "$SKILL_DIR/scripts/generate-report.mjs" plan <parsedJson> smoke <reportDir>/smoke-plan.json
   ```
3. 计算评估指标：
   ```bash
   node "$SKILL_DIR/scripts/calculate-metrics.mjs" <reportDir> <reportDir>/metrics.json
   ```
4. 一键执行（推荐）：
   ```bash
   export SKILL_WORKSPACE_ROOT="/path/to/task-workspace"
   bash skills/api-change-auto-test/scripts/run-api-change-suite.sh smoke <change-id>
   ```
   `smoke` 入口会先跑 smoke，通过后**脚本自动衔接 full**（无需再单独执行 full 命令）。`full` 入口行为相同，可用于补救重跑。

## OpenSpec 集成（openspec-superpowers-workflow 阶段 4）

当 change 含 API spec 时，阶段 4 验证 MUST 调用本 skill：

1. 确认 skill 目录存在
2. `check-auth-ready` 通过且 `backend ready`
3. 执行 smoke；通过后脚本**自动衔接** full（同一条 `smoke` 命令）
4. 读取 `tmp/api-test-reports/<change-id>/summary.md` 写入验证报告
5. smoke 或 full 任一失败则不得声称接口验证通过

## 执行约束

- 默认 `RUNNER_DIRECT_MODE=true` 直连本机后端；仅显式设置 `RUNNER_CONTAINER_NAME` 且 `RUNNER_DIRECT_MODE=false` 时走 docker
- 按 `runtime.json` 自动判型 admin/client，curl 时挂对应 token header
- POST 默认 body：`{ page: 1, pageSize: 10 }`
- 单请求超时默认 `RUNNER_REQUEST_TIMEOUT_MS=30000`
- 报告目录：`tmp/api-test-reports/<feature-id-or-change-id>/`
- `parsed-apis.json` 与 `cases[]` 含 `authChannel` 字段
- `cases[]` 含 `durationMs`、`timedOut`、`startedAt`、`completedAt`，用于指标计算

## 环境变量

见 `env.example` 与 `.env.local.template`。禁止将真实 token 写入 spec.zip 或 git。

## 输出

- `parsed-apis.json`：解析结果（含 `authChannel`）
- `smoke-plan.json` / `full-plan.json`：计划执行的变更接口
- `smoke-result.json` / `full-result.json`：执行状态（含 `authChannel`）
- `metrics.json`：六项评估指标、等级、综合得分；数据一致率依赖可选 `cases[].consistencyChecks[]`
- `summary.md`：汇总结论，含 Auth Channel、耗时、超时和评估指标

## 快速命令

```bash
export SKILL_WORKSPACE_ROOT="$(pwd)"
node skills/api-change-auto-test/scripts/check-auth-ready.mjs
bash skills/api-change-auto-test/scripts/run-api-change-suite.sh smoke <change-id>
```
