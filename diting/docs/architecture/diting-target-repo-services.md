# diting 目标仓服务生命周期

更新日期：2026-06-24

## 目标

为 diting 任务执行链提供可配置、可开关的目标仓服务生命周期能力：

- 在每轮 `execute` 完成后、`quality` 前启动服务（lazy start）
- 所有服务探活通过后再进入质量评测
- 任务结束、失败、取消时可靠停止服务并回收进程

## 启用方式

服务启动能力由目标仓配置驱动。推荐路径是让 `LocalWorktreeEnvironmentPlugin.prepareWorkspace()` 在缺少配置时注入可提交的 `.diting/services.yaml` 模板，再由执行 Agent 按目标仓结构适配。满足以下任一条件时启用：

1. `task.metadata.serviceStartup.services` 非空
2. `task.metadata.serviceStartup.servicesYaml` 可注入为配置文件
3. 目标仓存在 `.diting/services.yaml`

配置优先级：

1. `task.metadata.serviceStartup.enabled=false`：显式关闭，跳过注入和启动
2. `task.metadata.serviceStartup.services`：结构化配置，非空时完全覆盖文件
3. `task.metadata.serviceStartup.servicesYaml`：写入 workspace 的 `configPath || ".diting/services.yaml"`
4. workspace 内已有 `configPath || ".diting/services.yaml"`

当任务没有任何 `serviceStartup` 覆盖且目标仓缺少 `.diting/services.yaml` 时，Environment plugin 会创建模板文件；该模板不会加入 `.git/info/exclude`，应作为目标仓变更由 Agent 修正后保留。

## 执行时序

每轮 Goal Loop：

1. `ExecutionPlugin.execute`
2. `stopTargetServices`（当 `restartBeforeQuality !== false` 且已有运行中服务）
3. `startTargetServices`
4. health 全部通过
5. `QualityPlugin.evaluate`

关键约束：

- `prepareWorkspace` 完成后不会自动启动服务
- 默认 `restartBeforeQuality=true`，repair 轮次必须 stop -> start
- `execute` 已完成时禁止因 PID 存活跳过重启

## 配置文件格式

目标仓 `.diting/services.yaml` 可从 [`docs/templates/diting-services.yaml`](../templates/diting-services.yaml) 复制后按仓库实际命令调整：

```yaml
schemaVersion: 1
defaults:
  startupTimeoutMs: 120000
  stopTimeoutMs: 15000
  env:
    NODE_ENV: test
services:
  - id: backend
    repoKey: Repo1
    cwd: apps/server
    command: ["npm", "run", "start:dev"]
    healthUrl: http://127.0.0.1:3000/health
    healthIntervalMs: 2000
    startupTimeoutMs: 120000
    stopTimeoutMs: 15000
  - id: frontend
    repoKey: Repo1
    cwd: apps/web
    command: ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"]
    healthUrl: http://127.0.0.1:5173
    dependsOn: [backend]
```

字段说明：

- 必填：`id`、`cwd`、`command`、`healthUrl`
- 可选：`repoKey`、`dependsOn`、`env`、`port`、`healthIntervalMs`、`startupTimeoutMs`、`stopTimeoutMs`
- 单仓任务可省略 `repoKey`，`cwd` 相对主仓目录解析
- 多仓任务建议填写 `repoKey`，取值需与 `task.metadata.repos[].key` 一致

## task.metadata 配置

```json
{
  "serviceStartup": {
    "enabled": true,
    "startupTiming": "before_quality",
    "configPath": ".diting/services.yaml",
    "servicesYaml": "schemaVersion: 1\nservices:\n  - id: backend\n    cwd: apps/server\n    command: [\"npm\", \"run\", \"start:dev\"]\n    healthUrl: http://127.0.0.1:3000/health\n",
    "services": [],
    "startupTimeoutMs": 180000,
    "skipHealthCheck": false,
    "restartBeforeQuality": true
  }
}
```

说明：

- `startupTiming` 当前仅支持 `before_quality`
- `restartBeforeQuality=false` 时允许在服务仍健康时复用，不执行 stop/start
- `services` 非空时覆盖文件定义
- `servicesYaml` 适合外部系统按任务即时下发，内容格式与 `.diting/services.yaml` 相同；该路径属于临时覆盖，不是推荐主路径

## Environment 模板注入与 Agent 适配

当任务没有 `task.metadata.serviceStartup` 覆盖时，`LocalWorktreeEnvironmentPlugin.prepareWorkspace()` 会检查准备好的目标仓：

1. 若目标仓已有 `.diting/services.yaml`，不覆盖，由 Agent 在执行阶段校验和必要时修正。
2. 若目标仓缺少 `.diting/services.yaml`，写入一个可提交模板，包含 `schemaVersion`、`defaults`、示例 service 以及 `repoKey`/`cwd`/`command`/`healthUrl` 的 TODO 指引。
3. 模板文件不写入 `.git/info/exclude`，因此会出现在目标仓 diff 中，后续可进入 PR。
4. `{artifactsPath}/workspace.json` 会记录 `serviceStartupScaffoldPaths`，用于诊断本次模板注入位置。

执行 Agent 的 prompt 会统一追加 target services 指引，即使目标仓提供了自定义 `WORKFLOW_PROMPTS.md` 也会生效。Agent 需要根据目标仓实际结构检查或更新：

- `cwd` 是否指向服务目录
- `command` 是否能启动服务
- `healthUrl` 是否对应可探活地址
- 多仓任务的 `repoKey` 是否与 `task.metadata.repos[].key` 对齐
- 前后端或多服务之间的 `dependsOn` 是否完整

## 即时注入 servicesYaml

当 `task.metadata.serviceStartup.servicesYaml` 存在且未被 `enabled=false` 或非空 `services` 覆盖时，`LocalWorktreeEnvironmentPlugin.prepareWorkspace()` 会在 workspace 准备完成后执行注入：

1. 使用 `parseServiceStartupConfigYaml()` 校验 YAML 内容。
2. 写入目标 repo 的 `configPath || ".diting/services.yaml"`，并自动创建父目录。
3. 将生成的具体文件路径写入对应 repo 的 `.git/info/exclude`，避免 agent 把注入文件提交到目标仓。
4. 在 `{artifactsPath}/workspace.json` 记录 `serviceStartupInjectedPath`，用于诊断本次任务实际注入位置。

单仓任务默认注入主仓；多仓任务如果 YAML 中所有服务都指向同一个 `repoKey`，则注入到对应仓，否则注入主仓。无论注入到哪个仓，服务启动仍由 `target-service-lifecycle` 读取文件并按每个 service 的 `repoKey` 解析运行目录。

该路径用于外部系统显式传入完整 YAML。与 Environment 模板不同，`servicesYaml` 注入文件会被排除在 Git 状态之外，不应进入目标仓 PR。

## 治理与日志

- 每条服务命令在 spawn 前会经过 `observability-governance.beforeCommand`
- 服务状态写入 `{artifactsPath}/services.json`
- 本次不额外采集长期服务 stdout/stderr 日志；如后续需要，应在服务生命周期模块中补充文件落盘和脱敏策略

## 失败语义

- health 超时：`EnvironmentPreparationError(stage="service_startup")`
- 启动失败会清理已启动 sibling，避免残留进程
- 任务终态与 finally 路径都执行 `stopTargetServices`

## 多仓解析

- 配置了 `repoKey` 时，`cwd` 解析到匹配 `WorkspaceRepo.path`
- 未配置 `repoKey` 时默认主仓（`repos[0]`）
