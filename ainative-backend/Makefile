# SSH 配置（用于拉取私有仓库）
# 使用项目内的 SSH key，或使用系统默认 SSH key（如果已配置）
MAKEFILE_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
export GIT_SSH_COMMAND := ssh -i $(MAKEFILE_DIR)/configs/ssh/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=no
export GOPROXY=https://goproxy.cn,direct
export GOPRIVATE=gitlab.yc345.tv/*

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
init: git-config
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

.PHONY: git-config
# 配置 Git 使用 SSH 访问私有仓库（如果未配置）+ 修复 SSH key 权限
git-config:
	@if [ -f configs/ssh/id_ed25519 ]; then \
		chmod 600 configs/ssh/id_ed25519; \
	fi
	@if ! git config --global --get url."git@gitlab.yc345.tv:".insteadOf > /dev/null 2>&1; then \
		echo "配置 Git 使用 SSH 访问 gitlab.yc345.tv..."; \
		git config --global url."git@gitlab.yc345.tv:".insteadOf "https://gitlab.yc345.tv/"; \
		echo "✓ Git 配置完成"; \
	else \
		echo "✓ Git SSH 配置已存在"; \
	fi

.PHONY: mod
# 下载依赖
mod: git-config
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
