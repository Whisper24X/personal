# ── 构建阶段 ──
FROM node:22.21.1-bookworm-slim AS build

# node-pty 等原生模块需要编译工具链
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先复制依赖清单，利用 Docker 层缓存
COPY package*.json ./
RUN npm ci

# 复制源码并构建
COPY . .
RUN npm run build

# ── 运行阶段 ──
FROM node:22.21.1-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        bash curl git openssh-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# CLI tools (curl-based): Claude Code, OpenCode, Cursor
RUN curl -fsSL https://claude.ai/install.sh | bash \
    && curl -fsSL https://opencode.ai/install | bash \
    && curl -fsSL https://cursor.com/install | bash

# CLI tools (npm-based): Codex, Gemini CLI
RUN npm i -g @openai/codex@latest @google/gemini-cli@latest

ENV PATH="/root/.local/bin:/root/.opencode/bin:${PATH}"

WORKDIR /usr/src/app

# 构建产物与运行时依赖（migration/seed 直接从 dist 运行，无需源码）
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
