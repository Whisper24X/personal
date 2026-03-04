# ============================================================
# All-in-One AI 编码沙箱镜像
# ============================================================

FROM golang:1.23-alpine

# ============================================================
# 环境变量
# ============================================================

ENV TZ=Asia/Shanghai \
    GO_ENV=development \
    GOPROXY=https://goproxy.cn,direct \
    GOPRIVATE=gitlab.yc345.tv \
    CGO_ENABLED=0 \
    NODE_ENV=development

# ============================================================
# 安装依赖
# ============================================================

RUN apk add --no-cache \
    bash curl git make vim jq \
    openssh-client netcat-openbsd \
    supervisor nginx \
    nodejs npm \
    tzdata \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone

# 从 Alpine 3.17 仓库安装 protobuf 3.21.9 (对应 protoc v3.21.9 / release v21.9)
RUN apk add --no-cache \
    --repository=https://dl-cdn.alpinelinux.org/alpine/v3.17/main \
    protobuf=3.21.9-r0

# ============================================================
# 配置 SSH + Git
# ============================================================

COPY ssh/id_ed25519 /root/.ssh/id_ed25519
COPY ssh/known_hosts /root/.ssh/known_hosts
RUN chmod 700 /root/.ssh \
    && chmod 600 /root/.ssh/id_ed25519 \
    && chmod 644 /root/.ssh/known_hosts \
    && git config --global url."git@gitlab.yc345.tv:".insteadOf "https://gitlab.yc345.tv/"

# ============================================================
# 配置 GO
# ============================================================

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
    && rm -rf /root/.cache/go-build /go/pkg/mod/cache

# ============================================================
# 配置 Node
# ============================================================

RUN npm install -g pnpm@9 \
    && pnpm config set registry https://registry.npmmirror.com

# ============================================================
# 配置 Nginx 和 Supervisor
# ============================================================

COPY nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisord.conf
RUN mkdir -p /var/log/nginx /run/nginx /etc/supervisor.d /var/log/supervisor

# ============================================================
# 工作目录和端口
# ============================================================

WORKDIR /workspace
EXPOSE 8080

CMD ["supervisord", "-c", "/etc/supervisord.conf", "-n"]
