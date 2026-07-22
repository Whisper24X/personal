---
name: create-gitlab-mr
description: >-
  在本仓库完成 Git 提交并创建 GitLab Merge Request（MR）。使用 glab 推送分支、创建 MR、指定审核人。
  当用户要求提交、commit、提 MR/PR、merge request，或说「提交一个 mr」时使用。
---

# 创建 GitLab Merge Request

本仓库托管于 **GitLab**（`gitlab.yc345.tv/frontend/diting`），使用 **`glab`**，不用 `gh`。

## 前置条件

- 用户**明确要求**提交或创建 MR 时才执行 commit / push；未要求时只展示变更或询问。
- 工作区有未提交变更时，先完成提交再提 MR。
- 若用户提供飞书需求链接且需标准化分支名，先读 [create-feature-branch](~/.cursor/plugins/cache/onions-plugins/common/d16963a14c04eb3db5c37579cea557f1d9b3c5f9/skills/create-feature-branch/SKILL.md) 创建分支；否则从 `master` 拉取功能分支。

## 工作流

### 1. 收集上下文（并行执行）

```bash
git status
git diff
git diff --cached
git branch -vv
git log --oneline -10
```

若当前在 `master` 且有新变更，先创建分支再提交：

```bash
git fetch origin
git checkout master && git pull origin master   # 新 feature 分支的基线
git checkout -b <type>/<short-description>
```

分支命名：`feat/`、`fix/`、`chore/`、`refactor/` + 简短英文描述（kebab-case）。

### 2. 提交（Conventional Commits）

格式真源：[docs/dev-spec/repo/git-commit-convention.md](../../../docs/dev-spec/repo/git-commit-convention.md)、[.cursor/rules/git-commit-conventional.mdc](../../rules/git-commit-conventional.mdc)。

**必须** header + 空行 + body（多文件变更禁止仅标题）：

```bash
cat > /tmp/commit-msg.txt <<'EOF'
type(scope): subject

- 具体变更点 1（路径/模块）
- 具体变更点 2（动机或影响）
EOF
npm run commitlint:check -- /tmp/commit-msg.txt
git add <relevant-files>
git commit -F /tmp/commit-msg.txt
```

- `type`：`feat` `fix` `docs` `chore` `refactor` `test` `build` `ci` `perf` `style` `revert`
- `scope`：`server` `web` `core` `plugin-api` `repo` `openspec`
- 勿提交 `.env`、密钥等敏感文件
- pre-commit 会跑 `quality-gate`（type-check）；失败则修复后**新建** commit，勿 amend 已失败或被 hook 拒绝的提交

### 3. 推送并创建 MR

```bash
git push -u origin HEAD
```

```bash
glab mr create \
  --title "<与 commit header 一致或概括本次变更>" \
  --description "$(cat <<'EOF'
## Summary

- 变更要点 1
- 变更要点 2

## Test plan

- [ ] 验证项 1
- [ ] 验证项 2
EOF
)" \
  --target-branch master \
  --reviewer yanjialin
```

### 4. 审核人规则

| 情况 | 操作 |
|------|------|
| 用户**未指定**审核人 | **默认** `--reviewer yanjialin` |
| 用户指定了审核人 | 使用指定用户名（可逗号分隔多个） |
| 已有 MR 需补审核人 | `glab mr update <id> --reviewer yanjialin` |

### 5. 收尾

- 将 MR URL 返回给用户
- `git status` 确认工作区干净（或说明剩余未提交文件）

## 禁止事项

- 不要 `git push --force` 到 `master`；除非用户明确要求 force push
- 不要 `git commit --amend`，除非用户明确要求且 HEAD 由本会话创建且未 push
- 不要 `--no-verify` 跳过 hook
- 不要修改 `git config`
- 用户未要求时不要 push

## MR 描述模板

```markdown
## Summary

- <1–3 条概括本次变更>

## Test plan

- [ ] <如何验证>
```

## 示例

用户：「把 dev 脚本改动提交并提个 mr」

1. 确认在功能分支 `chore/repo-add-dev-start-script`
2. `git add package.json package-lock.json`
3. 写 Conventional Commit 并通过 `commitlint:check`
4. `git push -u origin HEAD`
5. `glab mr create ... --reviewer yanjialin`
6. 返回：`https://gitlab.yc345.tv/frontend/diting/-/merge_requests/<id>`
