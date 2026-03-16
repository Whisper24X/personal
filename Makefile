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
# 沙箱环境
# ==============================================================================

.PHONY: sandbox sandbox-build sandbox-stop sandbox-shell sandbox-logs sandbox-clean sandbox-restart sandbox-list sandbox-mirror sandbox-doctor

SANDBOX := ./sandbox/sandbox.sh

## 启动沙箱
sandbox:
	@$(SANDBOX) start

## 构建沙箱镜像
sandbox-build:
	@$(SANDBOX) build

## 停止沙箱
sandbox-stop:
	@$(SANDBOX) stop

## 进入沙箱终端
sandbox-shell:
	@$(SANDBOX) shell

## 查看沙箱日志 (用法: make sandbox-logs backend)
sandbox-logs:
	@$(SANDBOX) logs $(word 2,$(MAKECMDGOALS))

## 清理沙箱
sandbox-clean:
	@$(SANDBOX) clean

## 重启沙箱
sandbox-restart:
	@$(SANDBOX) restart

## 诊断 Docker/沙箱环境问题
sandbox-doctor:
	@bash ./sandbox/setup-rootless-docker.sh --check

## 配置 Docker 镜像加速
sandbox-mirror:
	@echo '{"registry-mirrors":["https://dockerproxy.com","https://docker.mirrors.ustc.edu.cn","https://docker.nju.edu.cn"]}' > ~/.docker/daemon.json
	@echo "$(C_GREEN)✓ 已配置镜像加速，请重启 Docker Desktop$(C_RESET)"

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
	@echo "$(C_YELLOW)沙箱环境$(C_RESET)"
	@echo "  $(C_GREEN)make sandbox$(C_RESET)           启动沙箱"
	@echo "  $(C_GREEN)make sandbox-build$(C_RESET)     构建沙箱镜像"
	@echo "  $(C_GREEN)make sandbox-stop$(C_RESET)      停止沙箱"
	@echo "  $(C_GREEN)make sandbox-shell$(C_RESET)     进入沙箱终端"
	@echo "  $(C_GREEN)make sandbox-logs$(C_RESET)      查看沙箱日志"
	@echo "  $(C_GREEN)make sandbox-clean$(C_RESET)     清理沙箱"
	@echo "  $(C_GREEN)make sandbox-restart$(C_RESET)   重启沙箱"
	@echo "  $(C_GREEN)make sandbox-mirror$(C_RESET)    配置 Docker 镜像加速"
	@echo ""

# .PHONY 声明
.PHONY: $(foreach n,$(NAMES),subtree-pull-$(n) subtree-push-$(n) subtree-add-$(n))
