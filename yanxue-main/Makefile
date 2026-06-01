# ==============================================================================
# AINative Workspace Makefile
# ==============================================================================
#
# 项目结构：
#   - ainative-backend  : Go 后端服务
#   - ainative-shadow   : 影子服务
#   - ainative-app      : 移动端小程序
#
# 使用方式：
#   make help           查看所有可用命令
#   make subtree-pull   拉取所有子仓库
#   make subtree-status 查看子仓库状态
#   make branch-test    切换到 test 并拉取子仓库 (backend=test, shadow/app=develop)
#   make subtree-push-test  推送 test 到子仓库 (backend=test, shadow/app=develop)
#
# ==============================================================================

.DEFAULT_GOAL := help

# ==============================================================================
# 配置
# ==============================================================================

# Subtree 配置（格式：别名|目录|仓库地址|分支）
SUBTREES := \
	backend|ainative-backend|git@gitlab.yc345.tv:backend/yanxue.git|master \
	shadow|ainative-shadow|git@gitlab.yc345.tv:frontend/trip-shadow.git|master \
	app|ainative-app|git@gitlab.yc345.tv:frontend/trip-miniprogram.git|master

# 颜色
C_RESET  := \033[0m
C_RED    := \033[31m
C_GREEN  := \033[32m
C_YELLOW := \033[33m
C_BLUE   := \033[34m
C_CYAN   := \033[36m
C_BOLD   := \033[1m

# ==============================================================================
# 内部函数
# ==============================================================================

# 解析 subtree 配置字段
_name   = $(word 1,$(subst |, ,$(1)))
_prefix = $(word 2,$(subst |, ,$(1)))
_repo   = $(word 3,$(subst |, ,$(1)))
_branch = $(word 4,$(subst |, ,$(1)))

# 所有 subtree 名称
NAMES := $(foreach s,$(SUBTREES),$(call _name,$(s)))

# 检查执行环境
define _check_env
	@ROOT=$$(git rev-parse --show-toplevel 2>/dev/null) || { \
		echo "$(C_RED)错误: 不在 git 仓库中$(C_RESET)"; exit 1; \
	}; \
	[ "$$(pwd -P)" = "$$(cd $$ROOT && pwd -P)" ] || { \
		echo "$(C_RED)错误: 请在仓库根目录执行$(C_RESET)"; exit 1; \
	}; \
	[ ! -f "$$ROOT/.git" ] || { \
		echo "$(C_RED)错误: 不能在 worktree 中执行 subtree 操作$(C_RESET)"; exit 1; \
	}
endef

# ==============================================================================
# Subtree 目标生成
# ==============================================================================

# 生成 subtree-pull 目标: subtree-pull-{name}
define _gen_pull
subtree-pull-$(call _name,$(1)):
	$(_check_env)
	@echo "$(C_BLUE)拉取 $(call _prefix,$(1))...$(C_RESET)"
	@OUT=$$$$(git subtree pull --prefix=$(call _prefix,$(1)) $(call _repo,$(1)) $(call _branch,$(1)) --squash 2>&1); \
	CODE=$$$$?; \
	if [ $$$$CODE -ne 0 ] && echo "$$$$OUT" | grep -q "does not exist"; then \
		echo "$(C_YELLOW)首次添加 $(call _prefix,$(1))...$(C_RESET)"; \
		$(MAKE) -s subtree-add-$(call _name,$(1)); \
	elif [ $$$$CODE -ne 0 ]; then \
		echo "$$$$OUT"; exit 1; \
	else \
		echo "$(C_GREEN)✓ $(call _prefix,$(1)) 已更新$(C_RESET)"; \
	fi
endef

# 生成 subtree-push 目标: subtree-push-{name} feature/xxx
# 用法: make subtree-push-backend feature/xxx
# 必须指定 feature/ 分支，禁止直接推送到 master
define _gen_push
subtree-push-$(call _name,$(1)):
	$(_check_env)
	@PUSH_BRANCH="$(filter-out subtree-push-$(call _name,$(1)),$(MAKECMDGOALS))"; \
	if [ -z "$$$$PUSH_BRANCH" ]; then \
		echo "$(C_RED)错误: 必须指定 feature/ 分支，禁止直接推送到 master$(C_RESET)"; \
		echo "$(C_YELLOW)用法: make subtree-push-$(call _name,$(1)) feature/xxx$(C_RESET)"; \
		exit 1; \
	fi; \
	if ! echo "$$$$PUSH_BRANCH" | grep -q "^feature/"; then \
		echo "$(C_RED)错误: 分支必须以 feature/ 开头，禁止直接推送到 master$(C_RESET)"; \
		echo "$(C_YELLOW)用法: make subtree-push-$(call _name,$(1)) feature/xxx$(C_RESET)"; \
		exit 1; \
	fi; \
	echo "$(C_BLUE)推送 $(call _prefix,$(1)) -> $$$$PUSH_BRANCH...$(C_RESET)"; \
	OUT=$$$$(git subtree push --prefix=$(call _prefix,$(1)) $(call _repo,$(1)) $$$$PUSH_BRANCH 2>&1); \
	CODE=$$$$?; \
	if echo "$$$$OUT" | grep -q "Everything up-to-date"; then \
		echo "$(C_YELLOW)$(call _prefix,$(1)) 无变更$(C_RESET)"; \
	elif [ $$$$CODE -ne 0 ]; then \
		echo "$$$$OUT"; \
		echo "$(C_RED)推送失败，请先执行: make subtree-pull-$(call _name,$(1))$(C_RESET)"; \
		exit 1; \
	else \
		echo "$(C_GREEN)✓ $(call _prefix,$(1)) 已推送到 $$$$PUSH_BRANCH$(C_RESET)"; \
	fi
endef

# 允许任意分支名作为目标（避免 make 报错）
%:
	@:

# 生成 subtree-add 目标: subtree-add-{name}
define _gen_add
subtree-add-$(call _name,$(1)):
	$(_check_env)
	@echo "$(C_BLUE)添加 $(call _prefix,$(1))...$(C_RESET)"
	@if [ -d "$(call _prefix,$(1))" ]; then \
		echo "$(C_YELLOW)清理已存在的目录...$(C_RESET)"; \
		git rm -rf --cached $(call _prefix,$(1)) 2>/dev/null || true; \
		rm -rf $(call _prefix,$(1)); \
		git commit -m "chore: reset $(call _prefix,$(1))" 2>/dev/null || true; \
	fi
	@git subtree add --prefix=$(call _prefix,$(1)) $(call _repo,$(1)) $(call _branch,$(1)) --squash
	@echo "$(C_GREEN)✓ $(call _prefix,$(1)) 已添加$(C_RESET)"
endef

# 动态生成所有目标
$(foreach s,$(SUBTREES),$(eval $(call _gen_pull,$(s))))
$(foreach s,$(SUBTREES),$(eval $(call _gen_push,$(s))))
$(foreach s,$(SUBTREES),$(eval $(call _gen_add,$(s))))

# ==============================================================================
# Subtree 批量操作
# ==============================================================================

.PHONY: subtree-pull subtree-push subtree-add subtree-status subtree-list

## 拉取所有子仓库
subtree-pull: $(foreach n,$(NAMES),subtree-pull-$(n))
	@echo ""
	@echo "$(C_GREEN)$(C_BOLD)✓ 全部拉取完成$(C_RESET)"

## 推送所有子仓库到指定 feature 分支
## 用法: make subtree-push feature/xxx
subtree-push: $(foreach n,$(NAMES),subtree-push-$(n))
	@echo ""
	@echo "$(C_GREEN)$(C_BOLD)✓ 全部推送完成$(C_RESET)"

## 添加所有子仓库
subtree-add: $(foreach n,$(NAMES),subtree-add-$(n))
	@echo ""
	@echo "$(C_GREEN)$(C_BOLD)✓ 全部添加完成$(C_RESET)"

# ==============================================================================
# Test 分支工作流
# ==============================================================================
# 切换 test 分支后拉取子仓库：backend=test, shadow/app=develop
# 推送 test 分支代码到子仓库：backend=test, shadow/app=develop

.PHONY: branch-test subtree-pull-test subtree-push-test merge-to-test push-test

## 合并当前分支到 test
## 流程: checkout test → pull origin test → merge --no-ff 当前分支
merge-to-test:
	$(_check_env)
	@CUR=$$(git rev-parse --abbrev-ref HEAD 2>/dev/null); \
	if [ "$$CUR" = "test" ]; then \
		echo "$(C_YELLOW)当前已在 test 分支$(C_RESET)"; exit 0; \
	fi; \
	echo "$(C_BLUE)合并 $$CUR -> test...$(C_RESET)"; \
	git checkout test && git pull origin test && git merge --no-ff $$CUR -m "Merge branch '$$CUR' into test" && \
	echo "$(C_GREEN)✓ 已合并到 test$(C_RESET)"

## 切换到 test 分支并拉取子仓库对应分支
## backend -> test, shadow/app -> develop
branch-test:
	$(_check_env)
	@echo "$(C_BLUE)切换到 test 分支...$(C_RESET)"
	@git checkout test
	@$(MAKE) -s subtree-pull-test

## 拉取子仓库（test 分支工作流）
## backend -> test, shadow/app -> develop
subtree-pull-test:
	$(_check_env)
	@echo "$(C_BLUE)拉取 ainative-backend (test)...$(C_RESET)"
	@OUT=$$(git subtree pull --prefix=ainative-backend git@gitlab.yc345.tv:backend/yanxue.git test --squash 2>&1); \
	CODE=$$?; \
	if [ $$CODE -ne 0 ] && echo "$$OUT" | grep -q "does not exist"; then \
		echo "$(C_YELLOW)首次添加 ainative-backend...$(C_RESET)"; $(MAKE) -s subtree-add-backend; \
	elif [ $$CODE -ne 0 ]; then echo "$$OUT"; exit 1; \
	else echo "$(C_GREEN)✓ ainative-backend 已更新$(C_RESET)"; fi
	@echo "$(C_BLUE)拉取 ainative-shadow (develop)...$(C_RESET)"
	@OUT=$$(git subtree pull --prefix=ainative-shadow git@gitlab.yc345.tv:frontend/trip-shadow.git develop --squash 2>&1); \
	CODE=$$?; \
	if [ $$CODE -ne 0 ] && echo "$$OUT" | grep -q "does not exist"; then \
		echo "$(C_YELLOW)首次添加 ainative-shadow...$(C_RESET)"; $(MAKE) -s subtree-add-shadow; \
	elif [ $$CODE -ne 0 ]; then echo "$$OUT"; exit 1; \
	else echo "$(C_GREEN)✓ ainative-shadow 已更新$(C_RESET)"; fi
	@echo "$(C_BLUE)拉取 ainative-app (develop)...$(C_RESET)"
	@OUT=$$(git subtree pull --prefix=ainative-app git@gitlab.yc345.tv:frontend/trip-miniprogram.git develop --squash 2>&1); \
	CODE=$$?; \
	if [ $$CODE -ne 0 ] && echo "$$OUT" | grep -q "does not exist"; then \
		echo "$(C_YELLOW)首次添加 ainative-app...$(C_RESET)"; $(MAKE) -s subtree-add-app; \
	elif [ $$CODE -ne 0 ]; then echo "$$OUT"; exit 1; \
	else echo "$(C_GREEN)✓ ainative-app 已更新$(C_RESET)"; fi
	@echo ""
	@echo "$(C_GREEN)$(C_BOLD)✓ test 分支子仓库拉取完成$(C_RESET)"

## 推送 test 分支代码到子仓库对应分支
## backend -> test, shadow/app -> develop
subtree-push-test:
	$(_check_env)
	@CUR=$$(git rev-parse --abbrev-ref HEAD 2>/dev/null); \
	if [ "$$CUR" != "test" ]; then \
		echo "$(C_YELLOW)当前分支为 $$CUR，建议在 test 分支执行$(C_RESET)"; \
	fi
	@echo "$(C_BLUE)推送 ainative-backend -> test...$(C_RESET)"
	@OUT=$$(git subtree push --prefix=ainative-backend git@gitlab.yc345.tv:backend/yanxue.git test 2>&1); \
	CODE=$$?; \
	if echo "$$OUT" | grep -q "Everything up-to-date"; then echo "$(C_YELLOW)ainative-backend 无变更$(C_RESET)"; \
	elif [ $$CODE -ne 0 ]; then echo "$$OUT"; echo "$(C_RED)推送失败$(C_RESET)"; exit 1; \
	else echo "$(C_GREEN)✓ ainative-backend 已推送到 test$(C_RESET)"; fi
	@echo "$(C_BLUE)推送 ainative-shadow -> develop...$(C_RESET)"
	@OUT=$$(git subtree push --prefix=ainative-shadow git@gitlab.yc345.tv:frontend/trip-shadow.git develop 2>&1); \
	CODE=$$?; \
	if echo "$$OUT" | grep -q "Everything up-to-date"; then echo "$(C_YELLOW)ainative-shadow 无变更$(C_RESET)"; \
	elif [ $$CODE -ne 0 ]; then echo "$$OUT"; echo "$(C_RED)推送失败$(C_RESET)"; exit 1; \
	else echo "$(C_GREEN)✓ ainative-shadow 已推送到 develop$(C_RESET)"; fi
	@echo "$(C_BLUE)推送 ainative-app -> develop...$(C_RESET)"
	@OUT=$$(git subtree push --prefix=ainative-app git@gitlab.yc345.tv:frontend/trip-miniprogram.git develop 2>&1); \
	CODE=$$?; \
	if echo "$$OUT" | grep -q "Everything up-to-date"; then echo "$(C_YELLOW)ainative-app 无变更$(C_RESET)"; \
	elif [ $$CODE -ne 0 ]; then echo "$$OUT"; echo "$(C_RED)推送失败$(C_RESET)"; exit 1; \
	else echo "$(C_GREEN)✓ ainative-app 已推送到 develop$(C_RESET)"; fi
	@echo ""
	@echo "$(C_GREEN)$(C_BOLD)✓ test 分支子仓库推送完成$(C_RESET)"

## 完整流程：1) 切换到 test 并拉取子仓库 2) 合并切换前的分支到 test 3) 提交到 test 4) 推送 test 到子仓
## 用法: make push-test（在 feature 分支上执行，自动合并当前分支到 test）
push-test:
	$(_check_env)
	@CUR=$$(git rev-parse --abbrev-ref HEAD 2>/dev/null); \
	if [ "$$CUR" = "test" ]; then \
		echo "$(C_RED)错误: 当前已在 test 分支，请在 feature 分支上执行$(C_RESET)"; exit 1; \
	fi; \
	echo "$(C_BLUE)1/4 切换到 test 并拉取子仓库...$(C_RESET)"; \
	git checkout test || { echo "$(C_RED)切换失败$(C_RESET)"; exit 1; }; \
	$(MAKE) -s subtree-pull-test; \
	echo "$(C_BLUE)2/4 合并 $$CUR -> test...$(C_RESET)"; \
	git merge --no-ff $$CUR -m "Merge branch '$$CUR' into test" || { echo "$(C_RED)合并失败，请解决冲突后重试$(C_RESET)"; exit 1; }; \
	echo "$(C_BLUE)3/4 提交到 test 分支（合并已完成）$(C_RESET)"; \
	echo "$(C_BLUE)4/4 推送 test 到主仓和子仓库...$(C_RESET)"; \
	git push origin test || { echo "$(C_RED)推送主仓失败$(C_RESET)"; exit 1; }; \
	$(MAKE) -s subtree-push-test; \
	echo ""; \
	echo "$(C_GREEN)$(C_BOLD)✓ push-test 完成$(C_RESET)"

## 查看子仓库状态
subtree-status:
	$(_check_env)
	@echo "$(C_CYAN)$(C_BOLD)子仓库状态$(C_RESET)"
	@echo ""
	@$(foreach s,$(SUBTREES), \
		echo "$(C_YELLOW)● $(call _prefix,$(s))$(C_RESET)"; \
		if [ -d "$(call _prefix,$(s))" ]; then \
			COMMIT=$$(git log --oneline -1 -- $(call _prefix,$(s))/ 2>/dev/null); \
			if [ -n "$$COMMIT" ]; then \
				echo "  $(C_GREEN)$$COMMIT$(C_RESET)"; \
			else \
				echo "  $(C_YELLOW)无提交记录$(C_RESET)"; \
			fi; \
			CHANGES=$$(git status --short $(call _prefix,$(s))/ 2>/dev/null); \
			if [ -n "$$CHANGES" ]; then \
				echo "  $(C_RED)有未提交的更改$(C_RESET)"; \
			fi; \
		else \
			echo "  $(C_RED)未添加$(C_RESET)"; \
		fi; \
		echo "";)

## 列出子仓库配置
subtree-list:
	@echo "$(C_CYAN)$(C_BOLD)子仓库配置$(C_RESET)"
	@echo ""
	@$(foreach s,$(SUBTREES), \
		echo "$(C_YELLOW)$(call _name,$(s))$(C_RESET)"; \
		echo "  目录: $(call _prefix,$(s))"; \
		echo "  仓库: $(call _repo,$(s))"; \
		echo "  分支: $(call _branch,$(s))"; \
		echo "";)

# ==============================================================================
# 帮助
# ==============================================================================

.PHONY: help

help:
	@echo ""
	@echo "$(C_CYAN)$(C_BOLD)AINative Workspace$(C_RESET)"
	@echo ""
	@echo "$(C_YELLOW)子仓库管理$(C_RESET)"
	@echo "  $(C_GREEN)make subtree-pull$(C_RESET)      拉取所有子仓库"
	@echo "  $(C_GREEN)make subtree-push$(C_RESET)      推送所有子仓库"
	@echo "  $(C_GREEN)make subtree-add$(C_RESET)       添加所有子仓库"
	@echo "  $(C_GREEN)make subtree-status$(C_RESET)    查看子仓库状态"
	@echo "  $(C_GREEN)make subtree-list$(C_RESET)      列出子仓库配置"
	@echo ""
	@echo "$(C_YELLOW)单个子仓库$(C_RESET)"
	@$(foreach s,$(SUBTREES), \
		echo "  $(C_GREEN)make subtree-pull-$(call _name,$(s))$(C_RESET)  拉取 $(call _prefix,$(s))";)
	@$(foreach s,$(SUBTREES), \
		echo "  $(C_GREEN)make subtree-push-$(call _name,$(s))$(C_RESET)  推送 $(call _prefix,$(s))";)
	@echo ""
	@echo ""
	@echo "$(C_YELLOW)推送到指定分支$(C_RESET)"
	@echo "  $(C_GREEN)make subtree-push-backend feature/xxx$(C_RESET)  推送到 feature 分支"
	@echo ""
	@echo "$(C_YELLOW)Test 分支工作流$(C_RESET)"
	@echo "  $(C_GREEN)make branch-test$(C_RESET)            切换到 test 并拉取子仓库 (backend=test, shadow/app=develop)"
	@echo "  $(C_GREEN)make subtree-pull-test$(C_RESET)      拉取子仓库 (backend=test, shadow/app=develop)"
	@echo "  $(C_GREEN)make subtree-push-test$(C_RESET)      推送 test 到子仓库 (backend=test, shadow/app=develop)"
	@echo "  $(C_GREEN)make merge-to-test$(C_RESET)          合并当前分支到 test"
	@echo "  $(C_GREEN)make push-test$(C_RESET)  切换 test→拉取子仓→合并当前分支→推送主仓和子仓"
	@echo ""

# .PHONY 声明
.PHONY: $(foreach n,$(NAMES),subtree-pull-$(n) subtree-push-$(n) subtree-add-$(n))
