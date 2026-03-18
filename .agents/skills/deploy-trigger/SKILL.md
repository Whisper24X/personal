---
name: deploy-trigger
description: 将子项目当前分支推送到远端并合并到 develop，然后触发对应子项目的部署接口。支持 backend、shadow、app 单独或全量部署。禁止在 main/master/release/develop 上执行。当用户提到「部署」「发布」「推送」「merge 到 develop」「触发部署」，或指定子项目名称（backend/shadow/app）时使用。
---

# deploy-trigger — 推送并触发部署

自动读取当前分支，统一流程：

- **当前分支未 push**：先 `git push origin <branch>` 推送当前分支
- **然后**：执行 `make push-test`（切换 test → 拉取子仓 → 合并当前分支 → 推送主仓和子仓）
- **成功后**：仅触发 Jarvis（shadow）部署。冲突时自动采用 theirs 策略。

禁止在 main、master、release、develop 上执行，其余分支均可。

## 部署配置（首次使用前替换）

| 子项目  | 说明                                            |
| ------- | ----------------------------------------------- |
| shadow  | Jarvis API，需配置 `jarvisProjectName` 和 Token |
| backend | `<BACKEND_WEBHOOK_URL>`（待替换）               |
| app     | `<APP_WEBHOOK_URL>`（待替换）                   |

> 完整 curl 命令见 [references/reference.md](references/reference.md)。将占位符替换为实际 URL 后保存即可永久生效。

## 执行步骤

### 1. 获取并校验当前分支

```bash
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
```

- 若分支名为 `main`、`master`、`release` 或 `develop`，**立即终止**，提示：当前分支为 `{CURRENT_BRANCH}`，禁止在此分支上部署。请切换到 feature/bugfix 等分支后重试。
- 后续所有步骤均使用 `$CURRENT_BRANCH`，无需用户重复输入。

### 2. subtree-push（推送到当前分支）

在 **Workspace 根目录**（ainative-workspace/）执行：

```bash
make subtree-push-{name} $CURRENT_BRANCH
```

- `{name}` 为目标子项目：`backend` / `shadow` / `app`（或依次执行全部）
- 若输出包含 `Everything up-to-date`，提示「无变更，跳过后续步骤」后终止
- 若推送失败，提示：推送失败，请先执行 `make subtree-pull-{name}` 同步远端后重试

### 3. subtree-merge-develop（合并到 develop）

```bash
make subtree-merge-develop-{name} $CURRENT_BRANCH
```

- 从 `$CURRENT_BRANCH` 拉取并推送到子仓库 develop 分支
- 若失败，输出完整错误信息并终止，不触发部署

### 4. 触发部署

步骤 3 成功后，根据子项目调用对应接口。完整 curl 命令见 [references/reference.md](references/reference.md)。

> 若用户说「只 merge，不部署」，执行步骤 1–3，跳过步骤 4。

## shadow 前置条件

`ainative-shadow/package.json` 须包含：

```json
"jarvisProjectName": "<SHADOW_PROJECT_NAME>"
```

Token 查找顺序：`JARVIS_TOKEN` 环境变量 → `~/.config/jarvis-cli/config.toml`

## 使用场景

| 场景         | 说明                                                                   |
| ------------ | ---------------------------------------------------------------------- |
| 部署测试环境 | 若未 push 先推送，再 make push-test，成功后仅触发 Jarvis（shadow）部署 |
| 仅合并不部署 | 用户说「只 merge 到 develop，不部署」，跳过 Jarvis 触发                |

## push-test 流程（当前分支已 push）

在 Workspace 根目录执行：

```bash
make push-test
```

等价于：`merge-to-test` → `subtree-pull-test` → `subtree-push-test`。完成后仅触发 Jarvis 部署。merge 或 subtree-pull 冲突时自动采用 theirs 策略解决。

## 错误处理策略

| 错误类型                           | 处理方式                                                            |
| ---------------------------------- | ------------------------------------------------------------------- |
| 分支为 main/master/release/develop | 终止，提示切换到 feature/bugfix 等分支                              |
| push-test 失败                     | 输出完整错误信息，终止，不触发部署                                  |
| subtree-push 无变更                | 提示「无变更」，终止                                                |
| subtree-push 失败                  | 提示执行 `make subtree-pull-{name}` 后重试，终止                    |
| subtree-merge-develop 失败         | 输出完整错误信息，终止，不触发部署                                  |
| shadow token 为空                  | 终止，提示配置 `JARVIS_TOKEN` 或 `~/.config/jarvis-cli/config.toml` |
| shadow `jarvisProjectName` 未配置  | 终止，提示在 `ainative-shadow/package.json` 中添加该字段            |
| shadow HTTP 非 2xx                 | 输出响应体，提示检查 token 或 project_name                          |
| backend/app URL 为占位符           | 终止，提示替换 `<BACKEND_WEBHOOK_URL>` / `<APP_WEBHOOK_URL>`        |
