# Lint 约束任务生成规则

供 project-management Step 5.5 使用，用于根据 tasks.md 中任务涉及的端，针对性生成 lint 约束任务。

## 核心原则

**如果没有修改该端代码，则不生成该端的 lint 任务。**

仅当任务描述明确涉及**修改**该端可被 lint 检查的代码（如 .vue、.ts、.go 等）时，才生成对应端的 lint 任务。纯配置、纯 SQL、仅「确认/检查」类任务且无代码变更的，不生成 lint。

## 端与 Lint 命令映射

| 端               | 项目路径            | Lint 命令                          |
| ---------------- | ------------------- | ---------------------------------- |
| ainative-app     | `ainative-app/`     | `cd ainative-app && pnpm lint`     |
| ainative-shadow  | `ainative-shadow/`  | `cd ainative-shadow && pnpm lint`  |
| ainative-backend | `ainative-backend/` | `cd ainative-backend && make lint` |

## 端识别规则

扫描 `tasks.md` 中所有任务描述及文件路径，**仅当任务涉及修改该端代码**时，才判定涉及该端并生成 lint 任务。

### ainative-app（移动端）

任务描述包含**新增/修改**以下路径或文件时判定涉及（需有实际代码变更）：

- `ainative-app/src/`、`src/types/`、`src/mock/`、`src/api/`、`src/components/`、`src/pages/`
- `pages/index`、`pages/`（移动端页面，且为新增或修改）
- `.vue`、`.ts`、`.js` 文件（在 app 目录下）

**不判定**：仅「确认 XX 已存在」「检查 XX」且无具体 app 代码文件路径的任务。

### ainative-shadow（管理后台）

任务描述包含**新增/修改**以下路径或文件时判定涉及（需有实际代码变更）：

- `ainative-shadow/src/`、`src/router`、`router/modules`、`src/views`、`src/api`、`src/locales`
- `路由`、`菜单`、`管理后台`（且涉及新增/修改路由、视图、组件等代码）
- `.vue`、`.ts`、`.js` 文件（在 shadow 目录下）

**不判定**：仅「确认 XX 已存在」且无具体 shadow 代码文件路径的任务。

### ainative-backend（后端）

任务描述包含**新增/修改**以下路径或文件时判定涉及（需有 Go 代码变更）：

- `ainative-backend/internal/`、`internal/`、`proto/`、`.proto`、`cmd/`
- `biz`、`data`、`service`（Kratos 分层，且为 Go 代码）
- `API 接口`、`gRPC`、`Protobuf`（且涉及 proto 或 Go 实现）
- `*.go` 文件

**不判定**：仅涉及 `init.sql`、`数据库`、`迁移`（纯 SQL）且**无 Go 代码**修改的任务。例如「确认 init.sql 中菜单已存在」不生成 backend lint。

## 任务格式模板

```markdown
## N. Lint 约束

- [ ] N.1 Lint 约束：ainative-app 执行 `cd ainative-app && pnpm lint` 通过

- [ ] N.2 Lint 约束：ainative-shadow 执行 `cd ainative-shadow && pnpm lint` 通过

- [ ] N.3 Lint 约束：ainative-backend 执行 `cd ainative-backend && make lint` 通过
```

**规则**：

- 仅追加**涉及的端**对应的任务，未涉及的端不生成
- **不填故事点**，不添加评估说明
- 章节编号 N 为当前 tasks.md 最大章节号 + 1
- 子任务编号 N.1、N.2、N.3 按涉及端的顺序递增
- 使用 `- [ ]` 未完成标记

## 去重规则

若 tasks.md 已存在「Lint 约束」或「## N. Lint 约束」章节，则：

- 检查现有 lint 任务是否已覆盖所有涉及的端
- 若已覆盖，跳过
- 若有新增的端，仅追加缺失的 lint 任务

## 与 Step 5 的衔接

Step 5（故事点估算）时：

- **跳过**「Lint 约束」章节中的任务，不为其填写故事点
- 若 Lint 约束章节在 Step 5 之前已存在，识别并跳过

## 与 Step 6 的衔接

Step 6（验证故事点）时：

- lint 任务计入 `totalTasks`
- lint 任务**无需**检查故事点字段（允许无故事点）
- 仅对非 lint 任务验证故事点完整性
