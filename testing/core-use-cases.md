# 无 PRD 情况下的核心用例与测试策略

本文在无产品需求文档与明确业务验收标准时，定义**最小可接受结果**：链路可跑通、页面可访问、关键 API 不报错。P0 / P1 每条用例均按 **用例标题、前置条件、执行步骤、预期结果** 编写；后续 PRD 到位后，可补充「当前验收说明」与业务规则级预期。

## 原则

- **分层**：P0 发布阻塞，P1 回归主路径，P2 扩展与质量。
- **依据**：[前端 system 路由](../../frontend/src/router/routes/system.ts)、[auth 路由](../../frontend/src/router/routes/auth.ts)；[认证控制器](../../backend/src/auth/auth.controller.ts)、[认证服务](../../backend/src/auth/auth.service.ts)；[AppModule](../../backend/src/app.module.ts)。架构总览见 [功能模块图](../architecture/functional-modules.md)（**图 1 系统分层**中单页补充用例为 **UC-20～UC-27**）。

## 环境与前置

| 项 | 说明 |
|----|------|
| 本地 | `pnpm dev` 或分别启动 backend（默认 `:9000`）与 frontend；数据库/Redis 见根目录 [docker-compose.yml](../../docker-compose.yml) |
| 数据 | 至少一个可登录测试账号；注册用例需唯一用户名或每次随机后缀 |
| 手工 | 浏览器；API 可用 curl/Bruno |
| E2E | [frontend/e2e/](../../frontend/e2e/) Playwright；`playwright.config.ts` 的 `baseURL` / `webServer.port` 与 [vite.config.ts](../../frontend/vite.config.ts) 中开发端口（默认 8000）一致；登录与健康检查依赖环境变量（见 [smoke.spec.ts](../../frontend/e2e/smoke.spec.ts) 顶部注释） |

## P0：核心用例（必须通过）

### UC-01 用户注册

**前置条件**

- 前后端与数据库已按 [环境与前置](#环境与前置) 就绪；测试用户名在系统中尚不存在（或使用随机后缀保证唯一）。

**执行步骤**

1. 浏览器打开 `/login`。
2. 切换至「注册」模式。
3. 填写用户名、密码（不少于 6 位）、确认密码；可选填写昵称。
4. 提交注册表单。

**预期结果**

- 界面提示注册成功；随后自动完成登录。
- 跳转至登录后默认落地页（与 [resolveAuthenticatedRedirectPath](../../frontend/src/utils/router/post-auth.ts) 行为一致），进入已登录态。

**接口或说明**：`POST /v1/auth/register` 或 `POST /v1/auth/email/register`（见 [auth.controller](../../backend/src/auth/auth.controller.ts)）。

**当前验收说明**：（团队填写）

---

### UC-02 用户登录

**前置条件**

- 系统中已存在可登录用户账号；前后端可用。

**执行步骤**

1. 打开 `/login`。
2. 输入已存在用户的用户名与正确密码。
3. 点击登录。

**预期结果**

- 前端保存访问令牌（及刷新令牌，若返回）；可进入受保护页面。
- 无未捕获的全局致命错误导致白屏。

**接口或说明**：`POST /v1/auth/login` 或 `POST /v1/auth/email/login`。

**当前验收说明**：（团队填写）

---

### UC-03 登录失败（错误凭据）

**前置条件**

- 前后端可用；准备一个**不存在**的用户名或**错误**密码用于尝试。

**执行步骤**

1. 打开 `/login`。
2. 输入不存在的用户名或错误密码。
3. 点击登录。

**预期结果**

- 展示明确失败提示（如「登录失败」类文案）。
- 不进入已登录态；本地无有效会话。

**接口或说明**：与 [validateLogin](../../backend/src/auth/auth.service.ts) 抛出的 `NotFoundException` / `UnauthorizedException` 行为一致。

**当前验收说明**：（团队填写）

---

### UC-04 刷新会话

**前置条件**

- 用户已完成登录，且本地持有 refresh token（以实际前端实现为准）。

**执行步骤**

1. 在已登录状态下，触发刷新访问令牌流程（如前端静默刷新、或手动调用刷新接口）。

**预期结果**

- `POST /v1/auth/refresh`（Bearer 为 refresh token）返回 HTTP 200，响应中含新的 access token（及可选新的 refresh token）。
- 业务请求可使用新 access token 继续访问。

**接口或说明**：需有效 refresh token；若产品无静默刷新，本用例可降为 P1 或标记为「不适用」。

**当前验收说明**：（团队填写）

---

### UC-05 获取当前用户

**前置条件**

- 用户已登录；持有有效 access token。

**执行步骤**

1. 使用当前会话请求 `GET /v1/auth/me`（或通过前端触发拉取当前用户信息）。

**预期结果**

- HTTP 200；响应体为当前用户信息与 JWT `sub` 一致。
- 前端用户态展示与接口一致（若页面有展示）。

**接口或说明**：`GET /v1/auth/me`。

**当前验收说明**：（团队填写）

---

### UC-06 未登录访问控制

**前置条件**

- 浏览器无有效登录会话（清除本地存储或使用无痕模式）。

**执行步骤**

1. 直接访问根路径 `/` 或任一需登录的路由（如 `/dashboard`）。

**预期结果**

- 导航至 `/login`，或 URL 带 `redirect` 等查询参数指向原目标（与 [auth-guard](../../frontend/src/router/guards/auth-guard.ts) 一致）。
- 未登录用户不可浏览需登录页的主要内容区。

**当前验收说明**：（团队填写）

---

### UC-07 主导航冒烟（已登录）

**前置条件**

- 用户已登录；账号具备访问各菜单所需能力（若存在权限控制，以实际角色为准）。

**执行步骤**

1. 在已登录状态下，依次访问下列路径（可分多次会话执行）：`/home`、`/dashboard`、`/kanban`、`/knowledge-base`、`/skills`、`/mcp`、`/automations`、`/git`、`/business-lines`、`/business-lines/invite`、`/tasks`、`/goals`、`/settings`、`/projects/workflows`（必要时为 `/projects/workflows` 带上 `projectId` query）。
2. 观察页面加载与浏览器控制台。

**预期结果**

- 每个路径下页面可完成加载，无持续白屏。
- 控制台无持续报错（允许与权限相关的预期提示或空态）。

**说明**：`/projects`、`/users` 可能重定向至 `/dashboard` 并带设置区块 query；以实际路由为准。

**当前验收说明**：（团队填写）

---

### UC-08 后端健康检查

**前置条件**

- 后端进程已启动；已知根 URL（本地默认 `http://127.0.0.1:9000`）。

**执行步骤**

1. 对后端根路径发起 `GET` 请求（浏览器或 curl）。

**预期结果**

- HTTP 200；响应为服务端信息类 JSON（见 [HomeController](../../backend/src/home/home.controller.ts)）。

**当前验收说明**：（团队填写）

---

## P1：主业务路径（建议每版本回归）

### UC-10 业务线管理

**前置条件**

- 用户已登录；具备业务线相关菜单/能力（以实际权限为准）。

**执行步骤**

1. 进入业务线管理页面（如 `/business-lines`）。
2. 查看列表；如有「新建/编辑」，打开表单并尝试保存（最小操作以不破坏数据为前提）。

**预期结果**

- 列表或空态可正常展示；表单可打开与提交（成功或返回可理解的校验/权限提示）。

**接口或说明**：业务线域见 [BusinessLinesModule](../../backend/src/business-lines/business-lines.module.ts)。**邀请落地、成员与权限**的专项路径见 [UC-16](#uc-16-接受业务线邀请)、[UC-17](#uc-17-业务线管理页成员与权限)。

**当前验收说明**：（团队填写）

---

### UC-11 项目与工作流

**前置条件**

- 用户已登录；存在可进入的项目或工作流入口（或空态可接受）。

**执行步骤**

1. 从工作台进入项目相关入口，或直接访问 `/projects/workflows`（可带 `projectId`）。
2. 确认工作流相关界面是否加载。

**预期结果**

- 工作流相关 UI 可打开；无持续白屏与未处理异常。

**接口或说明**：Projects、WorkflowTemplates 等域。**新建项目**路径见 [UC-18](#uc-18-新建项目)。

**当前验收说明**：（团队填写）

---

### UC-12 任务列表与任务详情

**前置条件**

- 用户已登录；准备一个有效任务 `id`（或从列表点击进入）。

**执行步骤**

1. 访问 `/tasks`。
2. 进入某条任务的详情 `/task-detail/:id`。

**预期结果**

- 列表页加载；详情页在有效 `id` 下可展示任务信息或合理空态/错误提示。

**接口或说明**：Tasks 域。**新建任务**见 [UC-19](#uc-19-新建任务)。

**当前验收说明**：（团队填写）

---

### UC-13 目标（需求）链路

**前置条件**

- 用户已登录；可选：已知 `projectId` 用于项目目标列表。

**执行步骤**

1. 访问 `/goals` 或 `/projects/:projectId/goals`。
2. 若有目标，进入 `/goals/:goalId` 查看详情。

**预期结果**

- 各页面可加载；详情在有效 `goalId` 下可展示或合理提示。

**接口或说明**：Goals 域。

**当前验收说明**：（团队填写）

---

### UC-14 修改个人资料或密码

**前置条件**

- 用户已登录。

**执行步骤**

1. 进入设置或个人资料相关页面（如 `/settings`）。
2. 修改资料；若修改密码，按界面要求填写旧密码与新密码并提交。

**预期结果**

- 修改成功有反馈；改密码时未提供旧密码或旧密码错误时，有明确错误提示（与 [auth.service update](../../backend/src/auth/auth.service.ts) 一致）。

**接口或说明**：`PATCH /v1/auth/me`。

**当前验收说明**：（团队填写）

---

### UC-15 登出

**前置条件**

- 用户已登录。

**执行步骤**

1. 在界面执行登出（以产品入口为准）。
2. 再次访问此前需登录的页面（如 `/dashboard`）。

**预期结果**

- `POST /v1/auth/logout` 返回成功（若前端调用）；本地会话清除。
- 再次访问受保护路由时需重新登录。

**接口或说明**：`POST /v1/auth/logout`。

**当前验收说明**：（团队填写）

---

### UC-16 接受业务线邀请

**前置条件**

- 已生成**有效**业务线邀请（含 `token`；可由具备权限的用户在业务线管理内创建邀请，或由测试环境预置）。
- 使用**尚未加入该业务线**的账号，或按产品规则允许重复校验的场景。

**执行步骤**

1. 在浏览器打开邀请落地页：`/business-lines/invite`，URL 查询参数中带 `token`（与后端 `POST /v1/business-lines/invitations/accept` 约定一致）。
2. 在页面执行「接受邀请」或等价操作。

**预期结果**

- 邀请合法且未过期时：提示成功；展示已加入角色等信息（与前端 [invite.vue](../../frontend/src/views/business-lines/invite.vue) 行为一致）；可按引导进入业务线管理 `/business-lines`。
- `token` 缺失、无效或已失效时：有明确错误提示，无未处理异常白屏。

**接口或说明**：`POST /v1/business-lines/invitations/accept`；见 [business-lines.controller](../../backend/src/business-lines/business-lines.controller.ts)。

**当前验收说明**：（团队填写）

---

### UC-17 业务线管理页：成员与权限

**前置条件**

- 用户已登录；对至少一条业务线具备**管理或成员查看**相关能力（以权限配置为准）。
- 已进入业务线管理页 `/business-lines`，且工作区已选中目标业务线（与 [BusinessLineManagementPanel](../../frontend/src/components/business/settings/BusinessLineManagementPanel.vue) 数据一致）。

**执行步骤**

1. 在业务线管理页切换至**成员**相关区域（如「成员」Tab 或侧栏入口）。
2. 查看成员列表或空态；若具备权限，打开**成员权限/角色**相关弹窗或子页（最小操作：打开即关闭，不强制改数据）。
3. （可选）切换至**权限**或**业务线角色**相关 Tab，确认界面可加载。

**预期结果**

- 成员列表、权限与角色相关区块可加载；无持续白屏。
- 无权限时展示可理解的提示，而非静默失败；有权限时操作有明确成功或校验反馈。

**接口或说明**：成员与自定义角色等见 [BusinessLinesModule](../../backend/src/business-lines/business-lines.module.ts) 下成员、角色、邀请相关接口。

**当前验收说明**：（团队填写）

---

### UC-18 新建项目

**前置条件**

- 用户已登录；具备**创建项目**能力（与前端 [canCreateProject](../../frontend/src/hooks/core/useLayout.ts) / `createProjectItem` 权限一致）。
- 已存在至少一条**业务线**，且当前工作区已选中将作为项目归属的业务线（在 [业务线管理页](../../frontend/src/views/business-lines/manage.vue) [BusinessLineManagementPanel](../../frontend/src/components/business/settings/BusinessLineManagementPanel.vue) 中可操作）。

**执行步骤**

1. 打开 `/business-lines`，确认左侧或顶栏已选中目标业务线。
2. 进入 **「项目」** 主 Tab（与面板内 `projects` 分区一致），点击 **「新建项目」**。
3. 在表单中填写**项目名称**、**Git 仓库地址**、**默认分支**（默认可为 `main`）；按需填写描述。
4. 提交保存（内部调用 `projectsApi.create`，对应后端 `POST /v1/projects`）。

**预期结果**

- 校验通过时：提示「新建项目成功」或等价反馈；项目列表刷新，新项目出现在当前业务线下。
- 缺少必填项、仓库不可用或权限不足时：界面展示**可理解的错误/校验信息**，无未捕获异常白屏。
- （可选）填写仓库地址后若触发分支探测/补全，界面行为正常或可忽略（与 [inspect-repository](../../backend/src/projects/projects.controller.ts) 能力一致时）。

**接口或说明**：`POST /v1/projects`（[projects.controller](../../backend/src/projects/projects.controller.ts)）；创建后进入工作流等见 [UC-11](#uc-11-项目与工作流)。

**当前验收说明**：（团队填写）

---

### UC-19 新建任务

**前置条件**

- 用户已登录；具备**创建任务**能力（与 [TaskCreatePanel](../../frontend/src/components/tasks/TaskCreatePanel.vue) 中 `createTask` 与 `BUTTON_ACCESS_CONFIG.createTask` 一致）。
- 已在**左侧栏或 URL** 选定目标 **`projectId`**（未选项目时界面会提示先选择项目）。
- **对话模式**：业务线/项目侧已具备可用的 **Agent CLI** 与配置（否则界面会提示先完成配置）。**工作流模式**：目标项目下存在可选的**工作流模板**（或接受「无模板」时的校验提示）。

**执行步骤**

1. 访问 `/tasks`（页面主体为 [TaskCreatePanel](../../frontend/src/components/tasks/TaskCreatePanel.vue)）。
2. 确认当前项目上下文（侧栏选中或 `?projectId=` 与布局一致）。
3. 选择任务模式：**对话**或**工作流**；按模式填写 **提示词（prompt）**；对话模式选择 **Agent CLI 与配置**、**基准分支**等；工作流模式选择 **工作流模板**。
4. 提交创建（`tasksApi.create` → **`POST /v1/tasks`**）。

**预期结果**

- 校验通过时：提示创建成功并**跳转至任务详情** `/task-detail/:id`（通常带 `projectId` query）；任务可在侧栏最近任务等入口出现。
- 缺少项目、提示词、CLI/模板等必填项时：**表单级提示**清晰，不提交；接口失败时有错误提示，无白屏。

**接口或说明**：`POST /v1/tasks`（[tasks.controller](../../backend/src/tasks/tasks.controller.ts)）；列表与详情浏览见 [UC-12](#uc-12-任务列表与任务详情)。

**当前验收说明**：（团队填写）

以下用例与 [功能模块图](../architecture/functional-modules.md) **图 1（系统分层）**中的前端能力面及 **图 3（前后端映射）**对齐，在 [UC-07](#uc-07-主导航冒烟已登录) 之外对**单路由**做最小链路验收（页面可加载、关键交互或空态可接受）。

---

### UC-20 首页与工作台

**前置条件**

- 用户已登录；具备进入首页与工作台的访问能力（与路由 [system.ts](../../frontend/src/router/routes/system.ts) 中 `/home`、`/dashboard` 一致）。

**执行步骤**

1. 访问 `/home`。
2. 访问 `/dashboard`（可按工作区习惯携带 `projectId` query）。

**预期结果**

- 两路径页面可完成加载，无持续白屏；控制台无未处理致命错误。
- **图 3 映射**：聚合工作台与导航入口，后端依赖多域（见功能模块图说明）。

**接口或说明**：对应图 1 中 `FE_Home`、`FE_Dash`。

**当前验收说明**：（团队填写）

---

### UC-21 看板

**前置条件**

- 用户已登录；具备看板路由访问权限。

**执行步骤**

1. 访问 `/kanban`。

**预期结果**

- 页面可加载；无持续白屏；允许业务空态或权限提示。
- **图 3 映射**：任务/执行域（Tasks 等）相关展示。

**接口或说明**：对应图 1 中 `FE_Kanban`。

**当前验收说明**：（团队填写）

---

### UC-22 知识库

**前置条件**

- 用户已登录。

**执行步骤**

1. 访问 `/knowledge-base`。

**预期结果**

- 页面可加载；无持续白屏；允许空态或权限相关提示。

**接口或说明**：对应图 1 中 `FE_KB`；后端域以项目/知识存储实现为准（见功能模块图）。

**当前验收说明**：（团队填写）

---

### UC-23 技能

**前置条件**

- 用户已登录。

**执行步骤**

1. 访问 `/skills`。

**预期结果**

- 页面可加载；无持续白屏；列表或空态合理。
- **图 3 映射**：**Skills** 域。

**接口或说明**：对应图 1 中 `FE_Skills`。

**当前验收说明**：（团队填写）

---

### UC-24 MCP

**前置条件**

- 用户已登录。

**执行步骤**

1. 访问 `/mcp`。

**预期结果**

- 页面可加载；无持续白屏；配置列表或空态可接受。
- **图 3 映射**：**Mcps** 域。

**接口或说明**：对应图 1 中 `FE_MCP`。

**当前验收说明**：（团队填写）

---

### UC-25 自动化

**前置条件**

- 用户已登录。

**执行步骤**

1. 访问 `/automations`。

**预期结果**

- 页面可加载；无持续白屏；自动化列表或空态可接受。
- **图 3 映射**：**Automations** 域。

**接口或说明**：对应图 1 中 `FE_Auto`。

**当前验收说明**：（团队填写）

---

### UC-26 Git 集成页

**前置条件**

- 用户已登录；已选择项目上下文（以实际侧栏/`projectId` 为准）。

**执行步骤**

1. 访问 `/git`。

**预期结果**

- 页面可加载；无持续白屏；无凭证或空仓库时的提示可接受。
- **图 3 映射**：**Git**、**Projects** 相关能力。

**接口或说明**：对应图 1 中 `FE_Git`。

**当前验收说明**：（团队填写）

---

### UC-27 通用设置页

**前置条件**

- 用户已登录。

**执行步骤**

1. 访问 `/settings`（账号/通用/通知等分区以页面为准）。

**预期结果**

- 设置页可加载；分区可切换；无持续白屏。
- 与 [UC-14](#uc-14-修改个人资料或密码)（资料/密码）互补：本用例强调**设置壳与分区**可达。

**接口或说明**：对应图 1 中 `FE_Settings`；**Auth/Users** 见既有认证用例。

**当前验收说明**：（团队填写）

## P2：扩展与质量

- 通知：列表与推送深度场景（**Notifications**）按需补充；入口若与仪表盘聚合则以环境为准。
- 队列与任务执行：Worker/Queue 与任务长时间运行（**Queue**、Tasks 子流程）按需补充。
- 自动化：除 [UC-25](#uc-25-自动化) 入口外，复杂「创建—查询—状态变更」仍在此层扩展。
- Git：除 [UC-26](#uc-26-git-集成页) 页加载外，远端凭证与合并推送等需独立环境再测。
- 可观测性：慢接口、日志落盘（[ObservabilityModule](../../backend/src/observability/observability.module.ts)）按需。

## 与现有自动化衔接

- **单元测试**：仓库内已有大量 `*.spec.ts`，不重复覆盖相同纯逻辑。
- **E2E**：见 [frontend/e2e](../../frontend/e2e/)，覆盖 P0 子集（登录页、未登录重定向、可选登录与健康检查）。
- **后端 e2e**：见 [backend/package.json](../../backend/package.json) 中 `test:e2e`，需独立环境与 Docker compose 时再纳入 CI。

## 风险说明

无 PRD 时，本节 P0/P1 用例**不保证**业务规则正确性（例如看板列与工作流状态是否一致），仅保证**链路可用**；PRD 就绪后升级「预期结果」与「当前验收说明」。

## XMind / OPML 导出

与本文档同目录提供脑图结构，便于在 XMind 中打开或再编辑：

- **`core-use-cases.xmind`**：**XMind Zen / 2020+** 使用的打包方式（ZIP 内含 `content.json`、`manifest.json`、`metadata.json`，与 [xmindmark](https://github.com/xmindltd/xmindmark) 导出一致），当前 XMind 客户端一般应能**直接双击打开**。若仍失败，请用 **`core-use-cases.opml`** 走 **文件 → 导入 → OPML**。
- **`core-use-cases.opml`**：通用大纲格式，适合导入或备用（旧版仅支持 XML 的 XMind 8 也可用 OPML）。
- **重新生成 `.xmind`**：在仓库根目录执行  
  `python3 docs/testing/build-core-use-cases-xmind.py`  
  脚本**从本文**解析 `## P0` / `## P1` 下各 `### UC-xx` 的 **前置条件、执行步骤、预期结果** 生成脑图（与正文一致，无需再维护脚本内重复数据）。脑图结构：**用例标题 → 前置条件 → 执行步骤 → 预期结果** 为**链式嵌套**；**用例根节点标题**带 **`[P0]` / `[P1]`**；各段多行内容写在对应节点标题内（换行后为 `1. …` 编号列表）。脑图**不含**「接口或说明」「当前验收说明」。生成脑图时，脚本会对节点做**纯文字化**（去掉 Markdown 链接、加粗、反引号；**前端路由**改为白话；`GET/POST /v1/...` 等统一为「调用后端接口」等），**正文 Markdown 仍以原始路径与格式为准**。**修改用例后**只需更新本文并重新运行上述命令。`P2：扩展与质量`、`与现有自动化衔接`、`风险说明` 等节亦从本文对应标题下 bullet 同步；规则见 `build-core-use-cases-xmind.py` 中 `xmind_plain_text` 与 `ROUTE_TO_PLAIN`。
