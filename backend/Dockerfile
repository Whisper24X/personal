# 构建阶段：编译 NestJS 应用，并顺带准备 docker / compose 二进制。
FROM node:22.21.1-bookworm-slim AS build

# 仅安装构建原生依赖和下载 docker 二进制所需工具，不进入最终镜像。
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        g++ \
        make \
        python3 \
    && rm -rf /var/lib/apt/lists/*

# 使用官方静态包，避免在运行镜像里额外安装完整 docker 发行版。
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

ARG DOCKER_COMPOSE_VERSION=v5.1.1
RUN mkdir -p /usr/local/lib/docker/cli-plugins \
    && ARCH=$(uname -m) \
    && case "$ARCH" in aarch64) COMPOSE_ARCH=aarch64;; x86_64) COMPOSE_ARCH=x86_64;; *) echo "unsupported arch: $ARCH" && exit 1;; esac \
    && curl --retry 5 --retry-all-errors --retry-delay 2 -fL \
      "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-linux-${COMPOSE_ARCH}" \
      -o /usr/local/lib/docker/cli-plugins/docker-compose \
    && chmod +x /usr/local/lib/docker/cli-plugins/docker-compose \
    && docker compose version

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# 仅保留生产依赖，并清理非 Linux 预编译产物以缩小最终镜像。
RUN npm run build \
    && npm prune --omit=dev \
    && npm cache clean --force \
    && find node_modules \
        \( -path '*/prebuilds/darwin-*' -o -path '*/prebuilds/win32-*' -o -path '*/build/Release/obj.target' \) \
        -prune -exec rm -rf '{}' +

# 运行阶段：只保留启动应用和 wait-for-it 所需的最小内容。
FROM node:22.21.1-bookworm-slim

# wait-for-it.sh 依赖 bash；Git/SSH 用于仓库同步；CA 证书用于 https 请求与 docker / compose。
RUN apt-get update && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        git \
        openssh-client \
    && rm -rf /var/lib/apt/lists/*

# 仅复制二进制本体，避免把下载工具带入最终镜像。
COPY --from=build /usr/local/bin/docker /usr/local/bin/docker
COPY --from=build /usr/local/lib/docker/cli-plugins/docker-compose /usr/local/lib/docker/cli-plugins/docker-compose

WORKDIR /usr/src/app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

COPY wait-for-it.sh /opt/wait-for-it.sh
COPY startup.relational.dev.sh /opt/startup.relational.dev.sh
RUN chmod +x /opt/wait-for-it.sh /opt/startup.relational.dev.sh \
    && sed -i 's/\r//g' /opt/wait-for-it.sh /opt/startup.relational.dev.sh

EXPOSE 9000

CMD ["/opt/startup.relational.dev.sh"]
