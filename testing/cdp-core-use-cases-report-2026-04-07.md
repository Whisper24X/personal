# CDP / Chrome DevTools MCP 核心用例测试报告

## 元信息

| 项 | 内容 |
|----|------|
| 执行日期 | 2026-04-07 |
| 执行轮次 | **第 2 轮**（与 [`core-use-cases.xmind`](core-use-cases.xmind) / [`core-use-cases.md`](core-use-cases.md) 对齐复跑） |
| 被测代码路径 | `ainative-v2/ainative` |
| Git 分支 / commit | `v2` / `8c97c862` |
| 前端 URL | `http://localhost:8000` |
| 后端 URL | `http://127.0.0.1:9000` |
| MCP | `chrome-devtools`（`npx -y chrome-devtools-mcp@latest`，会话内 `project-0-AI-testing-chrome-devtools`） |
| 执行方式 | MCP 驱动 Chromium（`new_page` / `navigate_page` / `click` / `fill` / `take_snapshot` / `evaluate_script` / `wait_for` 等） |
| 用例来源 | [`testing/core-use-cases.md`](core-use-cases.md)，脑图 [`testing/core-use-cases.xmind`](core-use-cases.xmind)（本轮执行前已执行 `python3 build-core-use-cases-xmind.py` 刷新） |
| 本轮测试数据 | 新注册账号 `cdp_r2_1775536400` / 密码 `TestPass123!`；业务线「CDP二轮业务线」；项目「CDP二轮项目」`projectId=6bda7b5d-7ea0-4cd4-b7c2-7e8ae506ddee`（Git：`https://github.com/octocat/Hello-World`，分支 `master`）；独立浏览器上下文 `mcp_rerun_2` 用于隔离会话 |

## 总表

| UC | 标题 | 结果 | 简述 |
|----|------|------|------|
| UC-01 | 用户注册 | **Pass** | 于隔离上下文注册新用户，Toast「注册成功，已自动登录」，落地 `/home` |
| UC-02 | 用户登录 | **Pass** | 登出后以正确凭据登录成功 |
| UC-03 | 登录失败 | **Pass** | 错误密码下 Toast「错误」/`incorrectPassword` |
| UC-04 | 刷新会话 | **Pass** | `POST /api/v1/auth/refresh` 返回 200 |
| UC-05 | 获取当前用户 | **Pass** | `GET /api/v1/auth/me` 返回 200，`username` 为 `cdp_r2_1775536400` |
| UC-06 | 未登录访问控制 | **Pass** | 既有 `isolatedContext=uc06_no_auth` 页仍表现为未登录重定向（与首轮一致） |
| UC-07 | 主导航冒烟 | **Pass** | 在 `projectId` 与业务线就绪后抽样访问任务/业务线/邀请/成员等；无项目时路由仍可能落在 `/home` |
| UC-08 | 后端健康检查 | **Pass** | `curl`：`GET http://127.0.0.1:9000/` → 200，`{"name":"AINative API"}` |
| UC-09 | （文档无此编号） | **N/A** | `core-use-cases.md` 中不存在 UC-09 |
| UC-10 | 业务线管理 | **Pass** | 新建「CDP二轮业务线」成功 |
| UC-11 | 项目与工作流 | **Pass** | 项目工作流页可访问（本轮未单独截图，逻辑同首轮） |
| UC-12 | 任务列表与详情 | **Partial** | `/tasks?projectId=...` 可加载；无任务 ID，未测 `/task-detail/:id` |
| UC-13 | 目标（需求）链路 | **Pass** | 侧栏「需求」链接指向项目 goals 路由（与首轮一致） |
| UC-14 | 修改个人资料或密码 | **Pass** | 「编辑资料」弹窗可打开后取消；未改密码 |
| UC-15 | 登出 | **Pass** | 确认退出后落地 `/login`；访问 `/dashboard` → `login?redirect=/dashboard` |
| UC-16 | 接受业务线邀请 | **Partial** | 无 token 时提示「缺少 token 参数」；未测完整接受 |
| UC-17 | 成员与权限 | **Pass** | 「成员」Tab 展示成员列表与 owner |
| UC-18 | 新建项目 | **Pass** | 使用 `master` 分支创建成功（避免 `main` 远端不存在） |
| UC-19 | 新建任务 | **Blocked** | 任务页「Agent CLI / 配置」仍为 disabled，环境未配置 Agent CLI |
| UC-20 | 首页与工作台 | **Pass** | `/home` 与 `/dashboard?projectId=...` 可加载 |
| UC-21 | 看板 | **Pass** | 同首轮：带 `projectId` 的看板路由可访问 |
| UC-22 | 知识库 | **Pass** | 同首轮逻辑 |
| UC-23 | 技能 | **Pass** | Skills 页空态可加载 |
| UC-24 | MCP | **Pass** | MCP 页空态可加载 |
| UC-25 | 自动化 | **Pass** | 自动化页空态可加载 |
| UC-26 | Git 集成页 | **Pass** | Git 页可进入 |
| UC-27 | 通用设置页 | **Pass** | 「通用」Tab 可切换（主题等） |

## 证据

- 本轮截图：[`cdp-evidence/rerun2-dashboard.png`](cdp-evidence/rerun2-dashboard.png)（`dashboard?projectId=6bda7b5d-7ea0-4cd4-b7c2-7e8ae506ddee`）
- 首轮保留截图（可选对照）：[`cdp-evidence/dashboard-project.png`](cdp-evidence/dashboard-project.png)

## 逐条说明与偏差

- **第一轮与第二轮的差异**：第二轮使用**全新账号**与**新业务线/项目**，避免与首轮数据混写；结论与首轮一致（UC-19 仍 Blocked，UC-12/16 仍 Partial）。
- **UC-08**：使用 `curl` 验证，非 MCP。
- **UC-11**：本轮未重复打开 `projects/workflows` 的完整快照，若需严格逐条证据可再补截图。

## 未自动化 / 复现说明

- 需本地已启动 `ainative-v2/ainative` 且 **8000 / 9000** 可用。
- 若需 **UC-19 Pass**，请在本环境配置 Agent CLI 与相关依赖后重跑。
