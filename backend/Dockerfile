# ============================================================
# 多阶段构建：Stage 1 — 编译 & 打包
# ============================================================
FROM node:22.21.1-bookworm-slim AS build

# node-pty 等原生模块需要编译工具链（python3 → node-gyp, make/g++ → C++ addon）
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先复制依赖清单，利用 Docker 层缓存——源码变更不会重新安装依赖
COPY package*.json ./
RUN npm ci

# 复制源码并构建 NestJS 产物到 dist/
COPY . .
RUN npm run build

# ============================================================
# 多阶段构建：Stage 2 — 精简运行时镜像
# ============================================================
FROM node:22.21.1-bookworm-slim

# ── 系统基础依赖 ──
# bash         — 启动脚本需要
# curl         — 健康检查 & 下载 CLI 工具
# git          — AI agent 操作 git 仓库
# openssh-client — 通过 SSH 拉取私有仓库（如需要）
# ca-certificates — HTTPS 证书信任链
RUN apt-get update && apt-get install -y --no-install-recommends \
        bash curl git openssh-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ── Docker CLI（静态二进制，通过宿主机 docker.sock 控制宿主机 Docker） ──
ARG DOCKER_CLI_VERSION=29.2.1
RUN ARCH=$(uname -m) \
    && case "$ARCH" in aarch64) DOCKER_ARCH=aarch64;; x86_64) DOCKER_ARCH=x86_64;; *) echo "unsupported arch: $ARCH" && exit 1;; esac \
    && curl --retry 5 --retry-all-errors --retry-delay 2 -fL \
      "https://download.docker.com/linux/static/stable/${DOCKER_ARCH}/docker-${DOCKER_CLI_VERSION}.tgz" \
      -o /tmp/docker.tgz \
    && tar -xzf /tmp/docker.tgz -C /tmp docker/docker \
    && install -m 0755 /tmp/docker/docker /usr/local/bin/docker \
    && rm -rf /tmp/docker /tmp/docker.tgz \
    && docker --version

# ── Docker Compose plugin（支持 `docker compose up --wait` 等命令） ──
ARG DOCKER_COMPOSE_VERSION=v5.1.1
RUN mkdir -p /usr/local/lib/docker/cli-plugins \
    && ARCH=$(uname -m) \
    && case "$ARCH" in aarch64) COMPOSE_ARCH=aarch64;; x86_64) COMPOSE_ARCH=x86_64;; *) echo "unsupported arch: $ARCH" && exit 1;; esac \
    && curl --retry 5 --retry-all-errors --retry-delay 2 -fL \
      "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-linux-${COMPOSE_ARCH}" \
      -o /usr/local/lib/docker/cli-plugins/docker-compose \
    && chmod +x /usr/local/lib/docker/cli-plugins/docker-compose \
    && docker compose version

# ── AI Coding CLI 工具 ──
# curl 安装：OpenCode（Go 编译）、Cursor CLI
RUN curl -fsSL https://opencode.ai/install | bash \
    && curl -fsSL https://cursor.com/install | bash

# npm 全局安装：Claude Code、Codex、Gemini CLI
RUN npm i -g @anthropic-ai/claude-code@latest @openai/codex@latest @google/gemini-cli@latest

# ── 环境变量 ──
# DOCKER_CONFIG — Docker CLI 配置目录（认证信息等）
# PATH         — 追加 OpenCode / CLI 工具路径
ENV DOCKER_CONFIG=/root/.docker \
    PATH="/root/.local/bin:/root/.opencode/bin:${PATH}"

# Go 编译的 CLI（OpenCode、Codex）需要显式指定 CA 证书路径，否则 HTTPS 请求会报证书错误
ENV SSL_CERT_FILE="/etc/ssl/certs/ca-certificates.crt"

WORKDIR /usr/src/app

# ── 从构建阶段复制产物（仅 dist + 生产依赖，不含源码） ──
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/runner ./runner

# ── 启动脚本 ──
# wait-for-it.sh — 等待依赖服务（如数据库）就绪后再启动应用
# startup.sh     — 应用启动入口，执行 migration 并启动 NestJS 服务
COPY wait-for-it.sh /opt/wait-for-it.sh
COPY startup.relational.dev.sh /opt/startup.sh
RUN chmod +x /opt/wait-for-it.sh /opt/startup.sh \
    && sed -i 's/\r//g' /opt/wait-for-it.sh /opt/startup.sh

EXPOSE 9000

CMD ["/opt/startup.sh"]
