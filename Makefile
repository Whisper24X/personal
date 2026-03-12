GOPATH=$(shell go env GOPATH)
VERSION=$(shell git describe --tags --always)
APP_RELATIVE_PATH=$(shell a=`basename $$PWD` && cd .. && b=`basename $$PWD` && echo $$b/$$a)
APP_NAME=$(shell echo $(APP_RELATIVE_PATH) | rev |cut -d '/' -f 1 | rev | tr '-' '_')
INTERNAL_PROTO_FILES=$(shell find internal -name *.proto)
API_PROTO_FILES=$(shell find api -name *.proto  -not -name apifox.proto)
BUF_INSTALLED=$(shell command -v buf 2> /dev/null)
GCI_INSTALLED=$(shell command -v gci 2> /dev/null)
YC_TURBO_KIT_INSTALLED := $(shell command -v yc_turbo_kit 2> /dev/null)
TABLES := ''
# Apifox Configuration
APIFOX_PROJECT_ID=6283389
APIFOX_PROJECT_TOKEN=APS-1zB0KpDZlq5eunxay3GzoRYC6AdeuXg9
# Yapi Configuration
YAPI_PROJECT_ID=xxx

.PHONY: init
# 初始化安装
init:
	go install github.com/go-kratos/kratos/cmd/kratos/v2@a7bae93
	go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.28.1
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.2.0
	go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@v2.13.0
	go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-openapiv2@v2.27.2
	go install github.com/go-kratos/kratos/cmd/protoc-gen-go-http/v2@a7bae93
	go install gitlab.yc345.tv/backend/protoc-gen-go-errors@v0.0.4
	go install github.com/envoyproxy/protoc-gen-validate@v0.9.0
	go install github.com/google/wire/cmd/wire@v0.6.0
	go install github.com/abice/go-enum@v0.9.1
	go install golang.org/x/tools/cmd/goimports@v0.23.0

.PHONY: mod
# 下载依赖
mod:
	go mod tidy

.PHONY: config
# 生成配置文件
config:
	protoc --proto_path=. \
	       --proto_path=./third_party \
 	       --go_out=paths=source_relative:. \
	       $(INTERNAL_PROTO_FILES)

.PHONY: api
# 生成API文件
api: buf
	protoc	--proto_path=./api \
			--proto_path=./third_party \
			--go_out=paths=source_relative:./api \
			--go-http_out=paths=source_relative:./api \
			--go-grpc_out=paths=source_relative:./api \
			--validate_out=paths=source_relative,lang=go:./api \
			--go-errors_out=paths=source_relative:. \
			--openapiv2_out ./doc/swagger/ \
			--openapiv2_opt logtostderr=true \
			--openapiv2_opt json_names_for_fields=false \
			$(API_PROTO_FILES)

.PHONY: build
# 构建
build:
	mkdir -p bin/ && GOPROXY="https://goproxy.cn,direct" GOPRIVATE="gitlab.yc345.tv/*" go mod tidy && go build -ldflags '-w -s -extldflags "-static" -X main.Version=$(VERSION)' -tags musl -o ./bin/ ./cmd/...

.PHONY: lint
# golang lint 检查
lint:
	@golangci-lint run --config .golangci.yml ./... -v

.PHONY: wire
# 生成依赖注入文件
wire:
	wire ./...

.PHONY: run
# run
run:
	@export GO_ENV=development && kratos run

.PHONY: gosec
# 代码安全检查gosec
gosec:
	GO111MODULE=on go install github.com/securego/gosec/v2/cmd/gosec@latest
	gosec -quiet -exclude=G104,G108,G403,G501,G502 -exclude-dir=api,third_party,sql,test ./...

.PHONY: checkVersion
# 定义变量; 要检查更新的包
PACKAGES := gitlab.yc345.tv/backend/utils gitlab.yc345.tv/backend/go-logger
# checkVersion 检查包版本并是否更新
checkVersion:
	@for package in $(PACKAGES); do \
		result="$$(go list -m -u $$package)"; \
		if [ -z "$${result##*[[]*}" ]; then \
			content="$$(echo "$$result" | grep -oE '\[([^]]+)\]' | sed 's/[][]//g')"; \
			echo "\033[1;33m$$package 已存在最新版本: $$content\033[0m"; \
			read -p "是否更新到最新版本 (y/N): " choice && \
			if [ "$$choice" = "y" ]; then \
				go get $$package && \
				upresult="$$(go list -m -u $$package)"; \
				if [ -z "$${upresult##*[[]*}" ]; then \
					echo "\033[1;31m$$package 更新失败!\033[0m"; \
				fi; \
			fi; \
		fi; \
	done
	go mod tidy;

.PHONY: apidoc
# 同步接口文档
apidoc:ycTurboKitCheck
	@yc_turbo_kit apidoc apifox -t $(APIFOX_PROJECT_TOKEN) -p $(APIFOX_PROJECT_ID)
	@yc_turbo_kit apidoc yapi -t $(YAPI_PROJECT_ID)

.PHONY: pbdoc
# sql转为pb
pbdoc:
	@rm -rf ./doc/pb/*
	@yc_turbo_kit sqltopb -p 'shadow.v1' -g 'gitlab.yc345.tv/backend/ainative-backend/api/shadow/v1;v1' -o './doc/pb'


.PHONY: jmeter
# jmeter 生成压测文件 make jmeter USER=your_username
jmeter:ycTurboKitCheck
	@if [ -n "$(USER)" ]; then \
		echo "notice jmeter user: $(USER)"; \
		yc_turbo_kit jmeter -d backend.ainative -u $(USER) -s "|" -q false; \
	else \
		echo "Please provide USER parameter"; \
		exit 1; \
	fi

.PHONY: protocode
# 通过proto文件,生成对应的data,biz,service代码,make protocode
protocode:ycTurboKitCheck
	@echo "proto code start";
	@yc_turbo_kit proto logic
	@yc_turbo_kit proto data -t $(TABLES)
	@echo "proto code finish";

.PHONY: gorm
# 生成 GORM 数据库代码
gorm:ycTurboKitCheck
	@yc_turbo_kit ormgen -v v2 -t $(TABLES)

.PHONY: sqldump
# 导出sql文件
sqldump:ycTurboKitCheck
	@yc_turbo_kit sqldump -f true -t $(TABLES)

.PHONY: sqlimport
# 导入sql文件 (使用: make sqlimport ./doc/sql/ 或 make sqlimport ./doc/sql/users.sql)
sqlimport:ycTurboKitCheck
	@if [ -z "$(word 2,$(MAKECMDGOALS))" ]; then \
		echo "错误: 必须指定 SQL 文件或目录路径"; \
		echo "使用方法: make sqlimport ./doc/sql/users.sql"; \
		exit 1; \
	fi
	@yc_turbo_kit sqlimport -i $(word 2,$(MAKECMDGOALS))

.PHONY: sqltopb
# sql转为pb，需要传入位置参数: make sqltopb shadow table1,table2
sqltopb:ycTurboKitCheck
	@if [ -z "$(word 2,$(MAKECMDGOALS))" ]; then \
		echo "错误: 必须指定 POSITION 参数 (shadow/app)"; \
		echo "使用方法: make sqltopb shadow table1,table2"; \
		exit 1; \
	fi
	@if [ -z "$(word 3,$(MAKECMDGOALS))" ]; then \
		echo "错误: 必须指定 TABLES 参数"; \
		echo "使用方法: make sqltopb shadow table1,table2"; \
		exit 1; \
	fi
	@POSITION=$(word 2,$(MAKECMDGOALS)); \
	TABLES=$(word 3,$(MAKECMDGOALS)); \
	@yc_turbo_kit sqltopb -p "$$POSITION.v1" -g "gitlab.yc345.tv/backend/ainative-backend/api/$$POSITION/v1;v1" -o "./api/$$POSITION/v1"
%: # 防止位置参数被当作目标处理
	@:

# ==============================================================================
# Subtree 配置（test 分支用）
# ==============================================================================
# 检查执行环境（subtree 需在仓库根目录、非 worktree 中执行）
define _check_env
	@ROOT=$$(git rev-parse --show-toplevel 2>/dev/null) || { \
		echo "\033[31m错误: 不在 git 仓库中\033[0m"; exit 1; \
	}; \
	[ "$$(pwd -P)" = "$$(cd $$ROOT && pwd -P)" ] || { \
		echo "\033[31m错误: 请在仓库根目录执行\033[0m"; exit 1; \
	}; \
	[ ! -f "$$ROOT/.git" ] || { \
		echo "\033[31m错误: 不能在 worktree 中执行 subtree 操作\033[0m"; exit 1; \
	}
endef

.PHONY: subtree-pull-test subtree-pull-test-backend subtree-pull-test-shadow subtree-pull-test-app
.PHONY: subtree-push-test subtree-push-test-backend subtree-push-test-shadow subtree-push-test-app
.PHONY: checkout-test merge-to-test

# 拉取子仓库（test 分支用：backend<-test, shadow/app<-develop）
subtree-pull-test: subtree-pull-test-backend subtree-pull-test-shadow subtree-pull-test-app
	@echo ""
	@echo "\033[32m\033[1m✓ 全部拉取完成\033[0m"

subtree-pull-test-backend:
	$(_check_env)
	@echo "\033[34m拉取 ainative-backend <- test...\033[0m"
	@git subtree pull --prefix=ainative-backend git@gitlab.yc345.tv:backend/yanxue.git test --squash
	@echo "\033[32m✓ ainative-backend 已更新\033[0m"

subtree-pull-test-shadow:
	$(_check_env)
	@echo "\033[34m拉取 ainative-shadow <- develop...\033[0m"
	@git subtree pull --prefix=ainative-shadow git@gitlab.yc345.tv:frontend/trip-shadow.git develop --squash
	@echo "\033[32m✓ ainative-shadow 已更新\033[0m"

subtree-pull-test-app:
	$(_check_env)
	@echo "\033[34m拉取 ainative-app <- develop...\033[0m"
	@git subtree pull --prefix=ainative-app git@gitlab.yc345.tv:frontend/trip-miniprogram.git develop --squash
	@echo "\033[32m✓ ainative-app 已更新\033[0m"

# 推送 test 分支到子仓库（backend->test, shadow/app->develop）
subtree-push-test: subtree-push-test-backend subtree-push-test-shadow subtree-push-test-app
	@echo ""
	@echo "\033[32m\033[1m✓ 全部推送完成\033[0m"

subtree-push-test-backend:
	$(_check_env)
	@echo "\033[34m推送 ainative-backend -> test...\033[0m"
	@git subtree push --prefix=ainative-backend git@gitlab.yc345.tv:backend/yanxue.git test
	@echo "\033[32m✓ ainative-backend 已推送\033[0m"

subtree-push-test-shadow:
	$(_check_env)
	@echo "\033[34m推送 ainative-shadow -> develop...\033[0m"
	@git subtree push --prefix=ainative-shadow git@gitlab.yc345.tv:frontend/trip-shadow.git develop
	@echo "\033[32m✓ ainative-shadow 已推送\033[0m"

subtree-push-test-app:
	$(_check_env)
	@echo "\033[34m推送 ainative-app -> develop...\033[0m"
	@git subtree push --prefix=ainative-app git@gitlab.yc345.tv:frontend/trip-miniprogram.git develop
	@echo "\033[32m✓ ainative-app 已推送\033[0m"

# 切换 test 分支并拉取子仓库
checkout-test:
	$(_check_env)
	@echo "\033[34m切换到 test 并拉取...\033[0m"
	@git checkout test && git pull origin test
	@$(MAKE) subtree-pull-test
	@echo "\033[32m✓ 已切换到 test 并完成子仓库拉取\033[0m"

# 合并当前分支到 test，推送主仓库，并推送子仓库
merge-to-test:
	$(_check_env)
	@CURRENT=$$(git branch --show-current); \
	if [ "$$CURRENT" = "test" ]; then \
		echo "\033[31m错误: 当前已在 test 分支，请先切换到要合并的分支\033[0m"; exit 1; \
	fi; \
	echo "\033[34m当前分支: $$CURRENT\033[0m"; \
	echo "\033[34m切换到 test 并拉取...\033[0m"; \
	git checkout test && git pull origin test; \
	echo "\033[34m合并 $$CURRENT 到 test...\033[0m"; \
	git merge $$CURRENT -m "Merge branch '$$CURRENT' into test"; \
	echo "\033[34m推送 test 到 remote...\033[0m"; \
	git push origin test; \
	echo "\033[34m推送 test 到子仓库...\033[0m"; \
	$(MAKE) subtree-push-test; \
	echo "\033[32m✓ 已合并 $$CURRENT 到 test，主仓库与子仓库均已推送\033[0m"

.PHONY: redisclear
# 清除Redis缓存
redisclear:ycTurboKitCheck
	@yc_turbo_kit redisclear

.PHONY: errcode
# 导出错误码
errcode:
	@go run ./internal/pkg/errcode/main.go

.PHONY: buf
# buf 格式化 proto
buf:
	@if [ -n "$(BUF_INSTALLED)" ]; then \
        cd ./api  && \
        buf format -w && \
        echo "proto format finish"; \
    else \
        echo "please installation buf: https://buf.build/docs/installation"; \
    fi

.PHONY: gci
# buf 格式化 proto
gci:
	@if [ -n "$(GCI_INSTALLED)" ]; then \
        gci write ./internal --skip-generated && \
        echo "gci format finish"; \
    else \
        echo "please installation gci: https://github.com/daixiang0/gci"; \
    fi

.PHONY: ycTurboKitCheck
# 效率工具安装检查
ycTurboKitCheck:
	@if [ -z "$(YC_TURBO_KIT_INSTALLED)" ]; then \
  		echo "try to install yc_turbo_kit: https://gitlab.yc345.tv/backend/yc_turbo_kit"; \
  	   	go install gitlab.yc345.tv/backend/yc_turbo_kit@latest; \
    fi

.PHONY: new-pre-branch
# 创建新的pre分支 tag +1
new-pre-branch:
	@git fetch --tags
	@latest_tag=$$(git describe --tags --abbrev=0 origin/master); \
	IFS='.' read -r -a version_parts <<< "$${latest_tag#v}"; \
	major=$${version_parts[0]}; \
	minor=$${version_parts[1]}; \
	patch=$${version_parts[2]}; \
	new_patch=$$((patch + 1)); \
	new_tag="v$${major}.$${minor}.$${new_patch}"; \
	git checkout -b "pre/$${new_tag}" origin/master; \
	git branch --unset-upstream; \

protoc-install:
	@curl -LO https://github.com/protocolbuffers/protobuf/releases/download/v21.9/protoc-21.9-osx-x86_64.zip
	@unzip -o protoc-21.9-osx-x86_64.zip -d ./protoc-21.9-osx-x86_64
	@mv ./protoc-21.9-osx-x86_64/bin/protoc "$(shell go env GOPATH)/bin/protoc"
	@rm -rf protoc-21.9-osx-x86_64.zip ./protoc-21.9-osx-x86_64

.PHONY: all
# generate all
all:
	make api;
	make config;
	make checkVersion;
	make wire;
	make gosec;

# show help
help:
	@echo ''
	@echo 'Usage:'
	@echo ' make [target]'
	@echo ''
	@echo 'Targets:'
	@awk '/^[a-zA-Z\-\_0-9]+:/ { \
	helpMessage = match(lastLine, /^# (.*)/); \
		if (helpMessage) { \
			helpCommand = substr($$1, 0, index($$1, ":")-1); \
			helpMessage = substr(lastLine, RSTART + 2, RLENGTH); \
			printf "\033[36m%-22s\033[0m %s\n", helpCommand,helpMessage; \
		} \
	} \
	{ lastLine = $$0 }' $(MAKEFILE_LIST)

.DEFAULT_GOAL := help
