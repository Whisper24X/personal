# 本次会话改动汇总

## 1. Worktree 保留策略（方案二）

**问题**：任务完成后 worktree 立即被删除，无法保留生成的文件。

**改动**：
- `backend/src/tasks/infrastructure/persistence/task.repository.ts`：新增 `findTasksWithExpiredWorktrees`
- `backend/src/tasks/infrastructure/persistence/relational/repositories/task.repository.ts`：实现上述方法
- `backend/src/tasks/tasks.service.ts`：
  - 任务完成时不再立即清理 worktree，改为记录日志
  - 新增 `scheduleRetentionCleanup` 定时任务，按 `sandboxCleanupAt` 清理过期 worktree
  - 新增 `AINATIVE_RETENTION_CLEANUP_INTERVAL_MS` 配置（默认 1 小时）
- `backend/env-example-relational`：补充 `AINATIVE_RETENTION_CLEANUP_INTERVAL_MS` 说明

---

## 2. 任务详情页 - 产物列表布局

**问题**：下载/预览按钮不在视口内，布局不适配。

**改动**：
- `frontend/src/views/tasks/detail.vue`：
  - 网格改为 `lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]`
  - 产物列表区域增加 `max-h-[min(400px,50vh)] overflow-y-auto`
  - 产物卡片改为 `flex-col sm:flex-row` 响应式布局
  - 执行摘要卡片增加 `min-w-0 overflow-hidden`，工作区路径行增加 `min-w-0 truncate`，避免路径溢出

---

## 3. 产物预览与下载逻辑

**问题**：预览和下载应展示/下载生成的文件，而非 agent 摘要或 diff。

### 3.1 报告产物 - 完整内容

- `backend/src/tasks/tasks.service.ts`：报告产物保存完整 agent stdout，不再截断为 2000 字符

### 3.2 Diff 产物 - 提取生成文档

- `backend/src/artifacts/artifacts.service.ts`：
  - 新增 `extractNewFileContentFromDiff`，从 diff 中解析新文件内容
  - 单文件 diff 时，预览返回解析后的文档（text 模式）
  - 下载返回解析后的文档及 `suggestedFileName`
- `backend/src/artifacts/artifacts.controller.ts`：下载响应增加 `suggestedFileName`
- `frontend/src/types/api/artifacts.ts`：新增 `ArtifactDownloadResponse` 类型
- `frontend/src/api/artifacts.ts`：导出 `ArtifactDownloadResponse`
- `frontend/src/views/tasks/detail.vue`：下载时使用 `suggestedFileName` 作为文件名

### 3.3 文件产物 - 从 worktree 读取

- `backend/src/tasks/task-runtime.service.ts`：新增 `readFileFromWorktree`，从 worktree 读取文件内容
- `backend/src/tasks/tasks.service.ts`：
  - 新增 `createFileArtifactsFromWorktree`，为每个变更文件创建 file 类型产物
  - 在 `createGitDiffArtifact` 中调用，先创建文件产物再创建 diff
  - `createGitDiffArtifact` 返回创建的文件数量

### 3.4 产物优先级

- `backend/src/tasks/tasks.service.ts`：
  - 调整 `createNodeExecutionArtifact`：先执行 `createGitDiffArtifact`
  - 仅当 `fileCount === 0` 时创建 report 产物
  - 有生成文件时，产物列表只展示文件产物和 diff，不展示 agent 摘要

---

## 4. 涉及文件清单

### Backend
- `src/tasks/tasks.service.ts`
- `src/tasks/task-runtime.service.ts`
- `src/tasks/infrastructure/persistence/task.repository.ts`
- `src/tasks/infrastructure/persistence/relational/repositories/task.repository.ts`
- `src/artifacts/artifacts.service.ts`
- `src/artifacts/artifacts.controller.ts`
- `src/tasks/tasks.service.spec.ts`
- `env-example-relational`

### Frontend
- `src/views/tasks/detail.vue`
- `src/types/api/artifacts.ts`
- `src/api/artifacts.ts`

---

## 5. 配置说明

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `AINATIVE_RETENTION_CLEANUP_INTERVAL_MS` | worktree 定时清理间隔（毫秒） | 3600000（1 小时） |
| `worktreeRetentionHours`（项目 configJson） | worktree 保留时长（小时） | 48 |

---

## 6. 当前产物流程

| 场景 | 产物类型 | 预览/下载内容 |
|------|----------|---------------|
| 节点生成了文件 | **file**（如 `学习攻略.md`） | 项目目录中的实际文件 |
| 节点生成了文件 | diff（变更记录） | Git diff |
| 节点未生成文件 | report（agent 摘要） | Agent stdout |
