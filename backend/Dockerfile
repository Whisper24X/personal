# syntax=docker/dockerfile:1.7
FROM golang:1.23-bookworm AS go-toolchain

# ── 构建阶段 ──
FROM node:22.21.1-bookworm-slim AS build

# node-pty 等原生模块需要编译工具链
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
        python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先复制依赖清单，利用 Docker 层缓存
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci

# 复制源码并构建
COPY . .
RUN npm run build

# ── 运行阶段 ──
FROM node:22.21.1-bookworm-slim

COPY --from=go-toolchain /usr/local/go /usr/local/go

# ============================================================
# 环境变量
# ============================================================

ENV TZ=Asia/Shanghai \
    DEBIAN_FRONTEND=noninteractive \
    GOROOT=/usr/local/go \
    GOPATH=/go \
    GO_ENV=development \
    GOPROXY=https://goproxy.cn,direct \
    GOPRIVATE=gitlab.yc345.tv \
    CGO_ENABLED=1 \
    NODE_ENV=development \
    PATH=/go/bin:/usr/local/go/bin:/root/.local/bin:/root/.opencode/bin:${PATH}

# ============================================================
# 系统依赖
# ============================================================

# bash/curl/git/make  — 基础构建工具
# vim/jq              — 调试辅助
# openssh-client      — 拉取 gitlab 私有仓库
# netcat-openbsd      — 健康检查 / 端口探测
# supervisor/nginx    — 进程管理 + 反向代理
# nodejs/npm          — 前端构建（glibc 兼容 Taro binding）
# cmake               — 构建 librdkafka（confluent-kafka-go 需 v2.3+，Debian 自带版本过旧）
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    bash curl git make vim jq cmake python3 \
    openssh-client netcat-openbsd \
    supervisor nginx \
    ca-certificates \
    docker.io \
    unzip \
    gcc g++ \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone

# protoc 锁定 3.21.9
RUN ARCH=$(uname -m) \
    && case "$ARCH" in aarch64) PROTOC_ARCH=aarch_64;; x86_64) PROTOC_ARCH=x86_64;; *) echo "unsupported arch: $ARCH" && exit 1;; esac \
    && curl -sL "https://github.com/protocolbuffers/protobuf/releases/download/v21.9/protoc-21.9-linux-${PROTOC_ARCH}.zip" -o /tmp/protoc.zip \
    && unzip -o /tmp/protoc.zip -d /usr/local bin/protoc 'include/*' \
    && rm -f /tmp/protoc.zip \
    && protoc --version

# 从源码构建 librdkafka v2.3+（confluent-kafka-go 要求，Debian bookworm 仅 2.0.2）
RUN cd /tmp \
    && curl -sL https://github.com/confluentinc/librdkafka/archive/refs/tags/v2.3.0.tar.gz | tar xz \
    && cd librdkafka-2.3.0 \
    && mkdir build && cd build \
    && cmake .. -DCMAKE_INSTALL_PREFIX=/usr \
    && make -j$(nproc) && make install \
    && ldconfig \
    && cd / && rm -rf /tmp/librdkafka-2.3.0

# ============================================================
# SSH + Git（用于拉取 gitlab.yc345.tv 私有依赖）
# ============================================================

COPY ssh/id_rsa /root/.ssh/id_rsa
COPY ssh/known_hosts /root/.ssh/known_hosts
RUN chmod 700 /root/.ssh \
    && chmod 600 /root/.ssh/id_rsa \
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
RUN --mount=type=cache,target=/root/.cache/go-build,sharing=locked \
    --mount=type=cache,target=/go/pkg/mod,sharing=locked \
    go install github.com/air-verse/air@v1.61.7 \
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
    && go install github.com/securego/gosec/v2/cmd/gosec@v2.22.4

# ============================================================
# Node / pnpm（前端构建）
# ============================================================

RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm install -g pnpm@9 @anthropic-ai/claude-code@latest @openai/codex@latest @google/gemini-cli@latest \
    && pnpm config set registry https://registry.npmmirror.com

# CLI tools (curl-based): OpenCode, Cursor
RUN curl -fsSL https://opencode.ai/install | bash \
    && curl -fsSL https://cursor.com/install | bash

# Go 编译的 CLI（OpenCode、Codex）需要显式指定 CA 证书路径
ENV SSL_CERT_FILE="/etc/ssl/certs/ca-certificates.crt"

WORKDIR /usr/src/app

# 构建产物与运行时依赖（migration 直接从 dist 运行，无需源码）
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

# 启动脚本
COPY wait-for-it.sh /opt/wait-for-it.sh
COPY startup.relational.dev.sh /opt/startup.sh
RUN chmod +x /opt/wait-for-it.sh /opt/startup.sh \
    && sed -i 's/\r//g' /opt/wait-for-it.sh /opt/startup.sh

EXPOSE 9000

CMD ["/opt/startup.sh"]
