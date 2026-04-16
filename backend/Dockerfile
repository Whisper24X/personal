# syntax=docker/dockerfile:1.7
FROM node:22.21.1-bookworm-slim AS build

# node-pty 等原生模块需要编译工具链
RUN --mount=type=cache,id=backend-build-apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=backend-build-apt-lib,target=/var/lib/apt,sharing=locked \
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
# 运行镜像只保留生产依赖和当前 Linux 平台需要的原生模块产物
RUN npm run build \
    && npm prune --omit=dev \
    && npm cache clean --force \
    && rm -rf /root/.cache \
    && find node_modules \
        \( -path '*/prebuilds/darwin-*' -o -path '*/prebuilds/win32-*' -o -path '*/build/Release/obj.target' \) \
        -prune -exec rm -rf '{}' +

# ── 运行阶段 ──
FROM node:22.21.1-bookworm-slim

ENV TZ=Asia/Shanghai \
    DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=development

# 运行层只保留后端实际依赖：
# - bash + netcat-openbsd：启动脚本与 wait-for-it
# - git + openssh-client：项目仓库读写与 SSH remote
# - zip + unzip：技能/资料包导入导出
# - docker CLI：通过宿主机 docker.sock 编排任务 runner 容器
# - ca-certificates：Node / git / docker 的 HTTPS 证书
RUN --mount=type=cache,id=backend-runtime-apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=backend-runtime-apt-lib,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    bash curl git openssh-client netcat-openbsd zip unzip ca-certificates make \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone

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


# ============================================================
# AI Coding CLI 工具
# ============================================================

# Claude Code / Codex / Gemini CLI（npm 全局安装）
RUN npm i -g @anthropic-ai/claude-code@latest @openai/codex@latest @google/gemini-cli@latest

# OpenCode / Cursor CLI 为 best-effort 安装：网络或上游变更可能导致安装失败，不阻断镜像构建
RUN bash -o pipefail -c 'curl -fsSL https://opencode.ai/install | bash' \
    || echo "WARN: OpenCode install failed; opencode steps in docker mode need a working binary."
RUN bash -o pipefail -c 'curl -fsSL https://cursor.com/install | bash' \
    || echo "WARN: Cursor CLI install failed or unavailable for this platform; docker mode cursor-agent steps need a working agent binary."

ENV PATH="/root/.local/bin:/root/.opencode/bin:${PATH}" \
    SSL_CERT_FILE="/etc/ssl/certs/ca-certificates.crt"

WORKDIR /usr/src/app

# 构建产物与运行时依赖（migration 直接从 dist 运行，无需源码）
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

# 启动脚本
COPY wait-for-it.sh /opt/wait-for-it.sh
COPY startup.runtime.sh /opt/startup.sh
RUN chmod +x /opt/wait-for-it.sh /opt/startup.sh \
    && sed -i 's/\r//g' /opt/wait-for-it.sh /opt/startup.sh

EXPOSE 9000

CMD ["/opt/startup.sh"]
