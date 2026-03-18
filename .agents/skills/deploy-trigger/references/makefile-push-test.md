# Makefile push-test 补丁说明

deploy-trigger 的 push-test 流程依赖 ainative-workspace 模板仓库的 Makefile 支持。若模板仓库（`git@gitlab.yc345.tv:frontend/ainative-workspace.git`）尚未包含以下改动，需在模板中新增 `push-test` 目标，并修改 `merge-to-test`、`subtree-pull-test` 以支持冲突自动解决。

## 1. 新增 push-test 目标

在 `merge-to-test` 之后、`commit-merge-push-test` 之前添加：

```makefile
## 当前分支已 push 时的快速部署：切换 test → 拉取子仓 → 合并当前分支 → 推送
## 用法: make push-test（需在 feature 分支上执行，且已 push）
push-test:
	$(_check_env)
	@$(MAKE) -s merge-to-test && $(MAKE) -s subtree-pull-test && $(MAKE) -s subtree-push-test
	@echo ""
	@echo "$(C_GREEN)$(C_BOLD)✓ push-test 完成$(C_RESET)"
```

并在 `.PHONY` 中增加 `push-test`。

## 2. 修改 merge-to-test（冲突自动解决）

将 `git merge --no-ff` 改为支持 `-X theirs`，失败时自动执行 `git checkout --theirs .` 并提交。

## 3. 修改 subtree-pull-test（冲突自动解决）

在每个 subtree pull 失败且输出含 `CONFLICT` 时，执行 `git checkout --theirs -- <prefix>/` 并 `git add`、`git commit` 完成合并。
