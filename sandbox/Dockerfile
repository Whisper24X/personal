# ============================================================
# All-in-One AI 编码沙箱镜像
# ============================================================

FROM golang:1.23-alpine

# ============================================================
# 安装依赖
# ============================================================

RUN apk add --no-cache \
    bash curl git make vim jq \
    openssh-client \
    supervisor nginx \
    postgresql postgresql-contrib \
    redis \
    nodejs npm \
    tzdata \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone

# ============================================================
# 环境变量
# ============================================================

ENV TZ=Asia/Shanghai \
    GO_ENV=development \
    GOPROXY=https://goproxy.cn,direct \
    GOPRIVATE=gitlab.yc345.tv \
    CGO_ENABLED=0 \
    NODE_ENV=development \
    DB_HOST=localhost \
    DB_PORT=5432 \
    DB_USER=postgres \
    DB_PASSWORD=123456 \
    DB_NAME=postgres \
    REDIS_HOST=localhost \
    REDIS_PORT=6379 \
    REDIS_PASSWORD=123456

# ============================================================
# 配置 Git 和安装工具
# ============================================================

RUN git config --global url."git@gitlab.yc345.tv:".insteadOf "https://gitlab.yc345.tv/" \
    && go install github.com/air-verse/air@v1.61.7 \
    && npm install -g pnpm \
    && pnpm config set registry https://registry.npmmirror.com

# ============================================================
# 配置 PostgreSQL
# ============================================================

RUN mkdir -p /var/lib/postgresql/data /run/postgresql \
    && chown -R postgres:postgres /var/lib/postgresql /run/postgresql

# ============================================================
# 配置 Redis
# ============================================================

RUN sed -i 's/^bind .*/bind 0.0.0.0/' /etc/redis.conf \
    && sed -i 's/^daemonize yes/daemonize no/' /etc/redis.conf \
    && echo "requirepass 123456" >> /etc/redis.conf

# ============================================================
# 配置 Nginx 和 Supervisor
# ============================================================

COPY nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisord.conf
RUN mkdir -p /var/log/nginx /run/nginx /etc/supervisor.d /var/log/supervisor

# ============================================================
# 启动脚本
# ============================================================

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# ============================================================
# 工作目录和端口
# ============================================================

WORKDIR /workspace
EXPOSE 8080

# ============================================================
# 健康检查
# ============================================================

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD pg_isready -U postgres && REDISCLI_AUTH=123456 redis-cli ping | grep -q PONG

# ============================================================
# 入口点
# ============================================================

ENTRYPOINT ["/entrypoint.sh"]
CMD ["supervisord", "-c", "/etc/supervisord.conf", "-n"]
