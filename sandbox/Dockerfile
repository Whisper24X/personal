# ============================================================
# All-in-One AI 编码沙箱镜像
# ============================================================
#
# 基于 golang:1.23-alpine，预装 Go 工具链 + Node/pnpm + protoc
# 容器启动后由 Supervisor 托管 backend / shadow / app 三个服务
#
# 构建: docker compose build  或  ./sandbox/sandbox.sh build
# ============================================================

FROM golang:1.23-alpine

# ============================================================
# 环境变量
# ============================================================

ENV TZ=Asia/Shanghai \
    GO_ENV=development \
    GOPROXY=https://goproxy.cn,direct \
    GOPRIVATE=gitlab.yc345.tv \
    CGO_ENABLED=1 \
    NODE_ENV=development

# ============================================================
# 系统依赖
# ============================================================

# bash/curl/git/make  — 基础构建工具
# vim/jq              — 调试辅助
# openssh-client      — 拉取 gitlab 私有仓库
# netcat-openbsd      — 健康检查 / 端口探测
# supervisor/nginx    — 进程管理 + 反向代理
# nodejs/npm          — 前端构建
RUN apk add --no-cache \
    bash curl git make vim jq \
    openssh-client netcat-openbsd \
    supervisor nginx \
    nodejs npm \
    tzdata \
    gcc musl-dev librdkafka-dev \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone

# protoc 需要锁定 3.21.9 版本，当前 Alpine 主线已升级，从 3.17 仓库安装
RUN apk add --no-cache \
    --repository=https://dl-cdn.alpinelinux.org/alpine/v3.17/main \
    protobuf=3.21.9-r0

# ============================================================
# SSH + Git（用于拉取 gitlab.yc345.tv 私有依赖）
# ============================================================

COPY ssh/id_ed25519 /root/.ssh/id_ed25519
COPY ssh/known_hosts /root/.ssh/known_hosts
RUN chmod 700 /root/.ssh \
    && chmod 600 /root/.ssh/id_ed25519 \
    && chmod 644 /root/.ssh/known_hosts \
    && git config --global url."git@gitlab.yc345.tv:".insteadOf "https://gitlab.yc345.tv/"

# ============================================================
# Go 工具链
# ============================================================

# air             — 热重载
# kratos          — 框架 CLI
# protoc-gen-*    — Proto 代码生成（Go/gRPC/HTTP/Gateway/Validate/Errors）
# wire            — 依赖注入
# go-enum         — 枚举生成
# goimports       — 代码格式化
RUN go install github.com/air-verse/air@v1.61.7 \
    && go install github.com/go-kratos/kratos/cmd/kratos/v2@a7bae93 \
    && go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.28.1 \
    && go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.2.0 \
    && go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@v2.13.0 \
    && go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-openapiv2@v2.27.2 \
    && go install github.com/go-kratos/kratos/cmd/protoc-gen-go-http/v2@a7bae93 \
    && go install github.com/envoyproxy/protoc-gen-validate@v0.9.0 \
    && go install github.com/google/wire/cmd/wire@v0.6.0 \
    && go install github.com/abice/go-enum@v0.9.1 \
    && go install golang.org/x/tools/cmd/goimports@v0.23.0 \
    && go install gitlab.yc345.tv/backend/protoc-gen-go-errors@v0.0.4 \
    && go install gitlab.yc345.tv/backend/yc_turbo_kit@latest \
    && go install github.com/securego/gosec/v2/cmd/gosec@latest \
    && rm -rf /root/.cache/go-build /go/pkg/mod/cache

# ============================================================
# Node / pnpm（前端构建）
# ============================================================

RUN npm install -g pnpm@9 \
    && pnpm config set registry https://registry.npmmirror.com

# ============================================================
# Nginx + Supervisor 配置
# ============================================================

COPY nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisord.conf
RUN mkdir -p /var/log/nginx /run/nginx /etc/supervisor.d /var/log/supervisor /workspace/logs

# ============================================================
# 启动入口
# ============================================================

WORKDIR /workspace
EXPOSE 8080

# Supervisor 前台运行，托管 nginx / backend / shadow / app
CMD ["supervisord", "-c", "/etc/supervisord.conf", "-n"]
