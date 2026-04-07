# 任务隔离容器方案（完整说明）

下文自洽描述当前实现：**为每个任务（或每个 workflow run）准备一个长期存活的 runner 容器，通过 bind mount 挂上宿主机构建好的 Git worktree，在容器内用 `docker exec` 跑 Agent CLI**；调度、状态、Git、数据库仍在 Nest 进程一侧，容器只承担隔离后的命令执行（以及可选的预览/全量沙箱进程）。

---

## 一、和「整栈开发沙箱」不是一回事

- **本方案**：默认是**轻量 runner**。容器里往往只有占位主进程（例如 `sleep infinity`），真正干活的是后端一次次 `docker exec` 进去的短生命周期命令。目标是 **CLI / 依赖与宿主机隔离**、工作区与编排解耦，而不是在任务容器里常驻一整套产品微服务。
- **另一种常见形态**（例如项目里单独的 compose + 多服务）：偏**给人用的开发/预览环境**，生命周期由脚本 `up`/`down` 管理，进程多、资源重。本仓库可选的 `preview-web`、`full-dev-sandbox` 画像是在**同一 runner 镜像**上打开 supervisord + nginx 等，仍由任务编排驱动创建/销毁，语义上仍是「任务绑定的执行环境」，不是替代整个产品的 compose 栈。

---

## 二、控制面与执行面（职责边界）

**控制面（Nest 与宿主上同一进程视角）**

- HTTP API、鉴权、任务与节点状态落库、通知。
- 调度、租约、tick；Docker 模式下配合数据库表 **`project_execution_slots`**：按**项目**登记当前占用隔离槽的任务、对应容器名、心跳时间，并用 TTL 清理失效租约；调度侧还有 advisory lock 等，保证同一项目不会并发乱占槽。
- **Git worktree** 的创建、路径策略、允许根目录校验等仍在宿主侧完成（兼容现有 `TaskRuntimeService` / `TaskGitService` 流程）。
- 任务日志、节点输出、任务级 jsonl 等由控制面写入数据根目录（例如 `tmp/.../tasks/<taskId>/task-log.jsonl`、`nodes/<nodeId>/output.jsonl`）。
- **`docker` CLI 编排**：创建/删除名为 `ainative-task-*` 或 `ainative-run-*` 的容器、挂载卷、读状态；业务侧统一走 **`ContainerOrchestrationService`** 的 ensure/remove 与模式判断，底层由 **`IsolatedRunnerContainerService`**、**`AgentProcessLauncherService`** 等配合实现。

**执行面（任务容器内）**

- 各类 Agent（Cursor、Codex 等）在容器内由 **`docker exec`** 拉起（stdin/argv 等由 launcher 适配）。
- 部分「短 prompt」辅助能力（如标题建议、步骤摘要）在实现上会：**若该任务容器已存在则 exec 进容器**；若尚不存在则返回 runner unavailable，由调用方决定降级策略。
- 选用带 entrypoint 的沙箱画像时，容器内还可跑 nginx、前后端 dev 等，用于预览或全量沙箱。

**两种部署方式**

- **后端在宿主跑、Docker 只跑任务容器**：本机 Docker daemon 可用，`AINATIVE_DATA_ROOT_DIR` 下的 worktree 路径必须能被 Docker bind mount。
- **后端也在 compose 里**：通常把 `docker.sock` 挂进后端容器，由容器内 Nest 调 `docker`，与宿主共用同一 daemon。

---

## 三、隔离粒度与容器命名

- 默认 **`AINATIVE_TASK_ISOLATION_SCOPE` 为按任务**：一个 `task.id` 对应一个容器，名称形如 **`ainative-task-<taskId>`**（非法字符会做 sanitize）。
- 若设为 **`workflow_run`** 且能从任务配置解析出 workflow run id，则名称前缀为 **`ainative-run-<id>`**，在同一 workflow run 下多任务可复用同一容器（以代码解析为准）。
- Docker 模式下，**有效隔离范围在配置上按 task 维度管理**，并与 **每项目至多一个活跃任务容器租约**（`project_execution_slots`）一起约束并发。

---

## 四、环境变量（行为开关）

| 变量 | 作用 |
|------|------|
| `AINATIVE_TASK_ISOLATION_SCOPE` | `task`（默认）或 `workflow_run`，见上一节。 |
| `AINATIVE_RUNNER_IMAGE` | Runner 镜像名，默认 `ainative/runner:latest`，由仓库根目录用 `runner/Dockerfile.runner` 构建。 |
| `AINATIVE_RUNNER_WORKSPACE` | 容器内工作区挂载点，默认 `/workspace`，须与 `docker run -v` 一致。 |
| `AINATIVE_TASK_SANDBOX_PROFILE` | `runner-only`（默认）、`preview-web`、`full-dev-sandbox`，见下一节。 |
| `AINATIVE_RUNNER_START_TIMEOUT_MS` | 等待容器就绪的最长时间；轻量画像与带 entrypoint 的画像默认值不同（见 `ContainerExecutionConfigService`）。 |
| `AINATIVE_RUNNER_READINESS_URL` | 非 `runner-only` 时探测就绪的 URL，默认 `http://127.0.0.1:8080/health`。 |
| `AINATIVE_SLOT_HEARTBEAT_MS` / `AINATIVE_SLOT_TTL_MS` | 槽位心跳间隔与租约 TTL，用于过期与清理。 |

本地临时排障时，需优先确认 Docker daemon、runner 镜像与 bind mount 路径都可用；当前实现不再回退到宿主执行。

---

## 五、沙箱画像：三种模式

**1. `runner-only`（默认）**

- 编排创建容器时，主进程多为 **`sleep infinity`** 类占位，容器长期存活。
- **所有实际 Agent 执行**通过 **`docker exec`** 进入该容器。
- 因此 **`docker logs <容器名>` 经常为空**、容器内可能没有 `/workspace/logs`，**属于正常现象**；排查执行过程应看控制面写的 **`task-log.jsonl` / 节点 `output.jsonl`**，而不是误以为容器没跑起来。

**2. `preview-web` / `full-dev-sandbox`**

- 不使用单纯 `sleep infinity` 占位，而走镜像 **entrypoint**（如 `runner/entrypoint.sh`）：拉起 **supervisord、nginx**，并按 worktree 布局生成或选用 nginx/supervisord 配置（单仓 `backend`+`frontend` 与旧式 `ainative-backend` 等布局分支处理）。
- **`ensure` 成功**以就绪 URL 返回成功为准（默认 `127.0.0.1:8080/health`）。
- 可为 **`backend/node_modules`、`frontend/node_modules`、`logs`** 增加**匿名卷**，避免在容器里 `npm ci` 写回宿主 worktree。
- **`full-dev-sandbox`** 通常施加更严的内存、pids 等 cgroup 类限制（由 `ContainerExecutionConfigService` 定义）。

---

## 六、槽位、心跳与后端重启

- 表 **`project_execution_slots`** 记录项目当前槽位占用者与容器标识，并依赖**心跳**续期；超 TTL 则视为可清理的僵尸租约。
- **`ContainerOrchestrationService` 在进程启动时**：会先对数据库里仍有效的槽位**恢复心跳定时器**，再执行孤儿容器回收。这样任务停在 **`in_review`（审批等待）** 时，**仅因后端重启**不会立刻丢槽、误杀仍应保留的 runner。
- 当前实现要求「必须有运行中的任务容器」；容器不存在或不可用时会直接报错，避免破坏隔离假设。

---

## 七、容器生命周期（何时创建、何时删除）

当前约定与「每跑完一个节点就删容器」不同：

- **同一任务在默认 `task` 隔离下，从第一个需要容器的执行点开始到整条任务结束，复用同一 runner**，中间包含**多节点串并行**与 **`in_review` 审批暂停**。
- **`in_review` 不触发容器删除**；**只有任务进入终态 `done`** 时，才由 **`TaskStatusService`** 触发移除 runner 并释放槽位。
- **`TaskNodeExecutionService`** 在单节点收尾时**不再**负责拆容器，避免把「等待审批」误判成任务结束。
- 编排层负责 **`ensure`、心跳、孤儿治理**；确保严格模式下在需要时容器已就绪。

这样审批流不会在还有待办节点或待最终审批时，提前释放隔离环境。

---

## 八、镜像与后端代码更新

- 若 Nest **跑在已构建的后端镜像里**，且**没有**把 `backend/src` bind mount 进容器，则 **`docker restart` 只会重启旧镜像层里的 JS**，**不会**带上你刚改的 TypeScript 源码。
- 验证编排/任务逻辑改动时，需要 **`docker compose up -d --build backend`**（或等价地重新 build 再 up），确保镜像内产物更新。

---

## 九、验收与排查（实操顺序）

**建议至少人工验一条路径**：多步任务 → 中间某步进入 `in_review` → 确认 `ainative-task-*` 仍在 → 最终审批到 `done` → 容器被删；再配合容器已运行的正常执行路径一起跑通。

**排查时可按序自问**：

1. Docker daemon 是否可用？报错是否提示「需要运行中的任务容器」？
2. 沙箱画像是 `runner-only` 还是带 entrypoint？后者是否已通过 health 检查？
3. 任务状态是 `in_review` 还是 `done`？`project_execution_slots` 里是否还有本任务一行？
4. 后端是否刚重启过？若槽位逻辑异常，是否先怀疑心跳恢复与 TTL？
5. `docker logs` 为空时，是否已读 **task/node 的 jsonl**？
6. 改过 `backend` 编排代码后，是否已 **重建后端镜像**？

---

## 十、实现落点（便于在仓库内搜索）

- 编排门面、启动恢复与清理：**`backend/src/containers/container-orchestration.service.ts`**
- 环境变量与镜像/超时/资源/命名：**`backend/src/containers/container-execution-config.service.ts`**
- `docker run`/`rm` 等：**`backend/src/containers/isolated-runner-container.service.ts`**
- `docker exec` 与进程启动：**`backend/src/containers/agent-process-launcher.service.ts`**
- 任务终态清理容器：**`backend/src/tasks/application/task-status.service.ts`**
- 节点执行不在收尾拆容器：**`backend/src/tasks/application/task-node-execution.service.ts`**
- 槽位表迁移：**`backend/src/database/migrations/`** 下创建 `project_execution_slots` 的迁移
- Runner 镜像相关静态资产位于仓库根目录 **`runner/`**，其中当前长期保留的是 **`runner/Dockerfile.runner`**、**`runner/entrypoint.sh`** 与 **`runner/render-runner-config.mjs`**。

以上即当前「任务隔离容器」方案的完整轮廓：轻量默认可 exec、可选全沙箱画像、宿主控制面 + 容器执行面、槽位与心跳、以及 **仅在 `done` 时回收** 的生命周期。
