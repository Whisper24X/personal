# AINative Web UI 界面布局（基于 `docs/ainative-requirement-design.md`）

> 目标：把 MVP 的“登录 → 项目 → 任务 → 执行 → 日志/产物”路径做成清晰、可扩展的 Admin Console 信息架构与页面布局。
>
> 设计系统：见 `design-system/ainative/MASTER.md`（以及 `design-system/ainative/pages/*.md` 覆盖规则）。

---

## 1. 信息架构（IA）与导航

### 1.1 MVP 路由（P0）

| 模块 | 路由 | 说明 |
|------|------|------|
| 登录 | `/login` | 账号密码登录 |
| 项目 | `/projects` | 项目列表 |
| | `/projects/:id` | 项目详情（含配置入口） |
| 任务 | `/tasks` | 任务列表 |
| | `/tasks/:id` | 任务详情（执行按钮、状态、日志流、产物） |
| 设置 | `/settings` | 工作区/用户偏好（可后置） |

### 1.2 侧边栏推荐分组（可渐进启用）

1) **Build**：Projects、Workflows（可先隐藏/禁用）  
2) **Run**：Tasks  
3) **Manage**：Skills、MCP（后续）  
4) **Admin**：Users、Business Lines、Audit/Observability（角色/权限控制）

> 权限矩阵参考：`docs/ainative-requirement-design.md` 的“权限矩阵”章节。

---

## 2. 全局布局（App Shell）

页面结构：
- 左侧：**Sidebar**（业务线/工作区切换 + 导航）
- 顶部：**Header**（Breadcrumb + 全局动作 + 用户菜单）
- 主区：**Main**（页面标题区 + 内容区）

响应式策略：
- `>= md`：固定侧边栏（`w-64`）
- `< md`：侧边栏变为 off-canvas（overlay + slide-in drawer），表格默认 `overflow-x-auto`

实现参考（当前仓库）：
- `frontend/src/layouts/AppShell.vue`：App Shell（含 `< md` 的 off-canvas 侧边栏 + Header hamburger）

---

## 3. 页面布局要点（Wireframe 级）

### 3.1 Projects List

- 页头：标题 + “New Project”
- 列表：桌面表格 / 移动卡片
- 空状态：解释“项目=Git 绑定+配置”，引导创建

详见：`design-system/ainative/pages/projects-list.md`

### 3.2 Project Detail

- 顶部：Breadcrumb + 项目标题 + Repo/Branch 元信息
- Tabs：Overview / Tasks / Config（MVP）

详见：`design-system/ainative/pages/project-detail.md`

### 3.3 Tasks List

- 页头：标题 + “New Task”
- 过滤：Search + Status（MVP）
- 列表：状态 Badge + 更新时间

详见：`design-system/ainative/pages/tasks-list.md`

### 3.4 Task Detail（核心）

- Header：强动作导向（Run/Retry/Stop）+ 状态 Badge
- 版式：桌面 Split（Logs 左 / Artifacts 右），移动端纵向堆叠
- Logs：monospace + follow tail + search
- Artifacts：preview/download + 过期提示（如有）

详见：`design-system/ainative/pages/task-detail.md`
