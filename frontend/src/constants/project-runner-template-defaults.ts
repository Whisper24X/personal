import type { ProjectContainerRuntimeConfig } from '@/types/api/projects'

export const DEFAULT_PROJECT_RUNNER_DOCKERFILE = `# ============================================================
# All-in-One AI 编码沙箱镜像
# ============================================================
#
# 基于 golang:1.23-bookworm (Debian)，预装 Go 工具链 + Node 22/pnpm + protoc
# 使用 glibc 以兼容 Taro @tarojs/binding-linux-x64-gnu（Alpine musl 不支持）
# runner-only profile 默认由编排层追加 \`sleep infinity\`
# preview/full-dev-sandbox profile 使用镜像内入口脚本启动 Supervisor + Nginx
#
# 构建: docker compose build  或  ./sandbox/sandbox.sh build
# ============================================================

FROM golang:1.23-bookworm

ENV TZ=Asia/Shanghai \\
    GO_ENV=development \\
    GOPROXY=https://goproxy.cn,direct \\
    GOPRIVATE=gitlab.yc345.tv \\
    CGO_ENABLED=1 \\
    NODE_ENV=development

RUN apt-get update && apt-get install -y --no-install-recommends \\
    bash curl git make vim jq cmake \\
    openssh-client netcat-openbsd \\
    supervisor nginx \\
    ca-certificates \\
    unzip \\
    xz-utils \\
    gcc g++ \\
    && rm -rf /var/lib/apt/lists/* \\
    && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \\
    && echo "Asia/Shanghai" > /etc/timezone

RUN ARCH=$(uname -m) \\
    && case "$ARCH" in aarch64) NODE_ARCH=arm64;; x86_64) NODE_ARCH=x64;; *) echo "unsupported arch: $ARCH" && exit 1;; esac \\
    && curl -fsSL "https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-\${NODE_ARCH}.tar.xz" -o /tmp/node.tar.xz \\
    && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \\
    && rm -f /tmp/node.tar.xz \\
    && node --version \\
    && npm --version

RUN ARCH=$(uname -m) \\
    && case "$ARCH" in aarch64) PROTOC_ARCH=aarch_64;; x86_64) PROTOC_ARCH=x86_64;; *) echo "unsupported arch: $ARCH" && exit 1;; esac \\
    && curl -sL "https://github.com/protocolbuffers/protobuf/releases/download/v21.9/protoc-21.9-linux-\${PROTOC_ARCH}.zip" -o /tmp/protoc.zip \\
    && unzip -o /tmp/protoc.zip -d /usr/local bin/protoc 'include/*' \\
    && rm -f /tmp/protoc.zip \\
    && protoc --version

RUN cd /tmp \\
    && curl -sL https://github.com/confluentinc/librdkafka/archive/refs/tags/v2.3.0.tar.gz | tar xz \\
    && cd librdkafka-2.3.0 \\
    && mkdir build && cd build \\
    && cmake .. -DCMAKE_INSTALL_PREFIX=/usr \\
    && make -j$(nproc) && make install \\
    && ldconfig \\
    && cd / && rm -rf /tmp/librdkafka-2.3.0

COPY backend/runner/ssh/id_ed25519 /root/.ssh/id_ed25519
COPY backend/runner/ssh/known_hosts /root/.ssh/known_hosts
RUN chmod 700 /root/.ssh \\
    && chmod 600 /root/.ssh/id_ed25519 \\
    && chmod 644 /root/.ssh/known_hosts \\
    && git config --global url."git@gitlab.yc345.tv:".insteadOf "https://gitlab.yc345.tv/"

RUN go install github.com/air-verse/air@v1.61.7 \\
    && go install github.com/go-kratos/kratos/cmd/kratos/v2@a7bae93 \\
    && go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.28.1 \\
    && go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.2.0 \\
    && go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@v2.13.0 \\
    && go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-openapiv2@v2.27.2 \\
    && go install github.com/go-kratos/kratos/cmd/protoc-gen-go-http/v2@a7bae93 \\
    && go install github.com/envoyproxy/protoc-gen-validate@v0.9.0 \\
    && go install github.com/google/wire/cmd/wire@v0.6.0 \\
    && go install github.com/abice/go-enum@v0.9.1 \\
    && go install golang.org/x/tools/cmd/goimports@v0.23.0 \\
    && go install github.com/securego/gosec/v2/cmd/gosec@v2.22.4 \\
    && rm -rf /root/.cache/go-build /go/pkg/mod/cache

RUN npm config set registry https://registry.npmmirror.com \\
    && npm config set fetch-retries 5 \\
    && npm config set fetch-retry-factor 2 \\
    && npm config set fetch-retry-mintimeout 20000 \\
    && npm config set fetch-retry-maxtimeout 120000 \\
    && npm config set prefer-offline true \\
    && npm install -g pnpm@9 \\
    && pnpm config set registry https://registry.npmmirror.com

ENV PATH="/root/.local/bin:/root/.opencode/bin:\${PATH}"

RUN bash -o pipefail -c 'curl -fsSL https://opencode.ai/install | bash' \\
    || echo "WARN: OpenCode install failed; opencode steps in docker mode need a working binary."
RUN bash -o pipefail -c 'curl -fsSL https://cursor.com/install | bash' \\
    || echo "WARN: Cursor CLI install failed or unavailable for this platform; docker mode cursor-agent steps need a working agent binary."

RUN npm i -g @anthropic-ai/claude-code@latest @openai/codex@latest @google/gemini-cli@latest

RUN if command -v agent >/dev/null 2>&1; then \\
      test -x "$(command -v agent)"; \\
    else \\
      echo "WARN: agent (Cursor CLI) not on PATH; skipping executable check."; \\
    fi

ENV SSL_CERT_FILE="/etc/ssl/certs/ca-certificates.crt"
ENV CGO_ENABLED=1

COPY backend/runner/sandbox.nginx.conf /etc/ainative/sandbox.nginx.conf
COPY backend/runner/sandbox.supervisord.conf /etc/ainative/sandbox.supervisord.conf
COPY backend/runner/entrypoint.sh /usr/local/bin/ainative-runner-entrypoint
RUN chmod +x /usr/local/bin/ainative-runner-entrypoint \\
    && mkdir -p /var/log/nginx /run/nginx /etc/ainative /var/log/supervisor /workspace/logs

WORKDIR /workspace
EXPOSE 8080

CMD ["/usr/local/bin/ainative-runner-entrypoint"]
`

export const DEFAULT_PROJECT_RUNNER_NGINX_CONF = `worker_processes auto;
error_log /dev/stderr warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /dev/stdout main;

    sendfile on;
    keepalive_timeout 65;

    client_max_body_size 100M;

    proxy_connect_timeout 60;
    proxy_send_timeout 300;
    proxy_read_timeout 300;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    server {
        listen 8080;
        server_name localhost;
        charset utf-8;

        location ~ ^/api/.*\\.(ts|js|mjs|vue|less|css|scss|map)$ {
            proxy_pass http://127.0.0.1:8200;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        location /api/ {
            proxy_pass http://127.0.0.1:8000/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /shadow/ {
            proxy_pass http://0.0.0.0:5176/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /static/ {
            proxy_pass http://0.0.0.0:5176;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
        }

        location /rsbuild-hmr {
            proxy_pass http://0.0.0.0:5176/rsbuild-hmr;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        location = /app {
            return 302 /app/;
        }

        location /app/ {
            proxy_pass http://127.0.0.1:8200/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /health {
            return 200 'OK';
            add_header Content-Type text/plain;
        }

        location = / {
            default_type "text/html; charset=utf-8";
            return 200 '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AINative Workspace</title></head><body><h1>AINative Workspace</h1></body></html>';
        }

        location / {
            proxy_pass http://127.0.0.1:8200;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
`

export const DEFAULT_PROJECT_RUNNER_SUPERVISORD_CONF = `[supervisord]
nodaemon=true
logfile=/workspace/logs/supervisord.log
logfile_maxbytes=10MB
logfile_backups=1
pidfile=/run/supervisord.pid
user=root

[unix_http_server]
file=/run/supervisor.sock
chmod=0700

[rpcinterface:supervisor]
supervisor.rpcinterface_factory = supervisor.rpcinterface:make_main_rpcinterface

[supervisorctl]
serverurl=unix:///run/supervisor.sock

[program:nginx]
command=/usr/sbin/nginx -g "daemon off;"
autostart=true
autorestart=true
priority=30
redirect_stderr=true
stdout_logfile=/workspace/logs/nginx.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=2

[program:backend]
command=/bin/bash -c "GOFLAGS='-p=1' air -c .air.toml"
directory=/workspace/ainative-backend
environment=GO_ENV="local"
autostart=true
autorestart=true
startsecs=5
startretries=3
priority=100
redirect_stderr=true
stdout_logfile=/workspace/logs/backend.log
stdout_logfile_maxbytes=20MB
stdout_logfile_backups=2

[program:shadow]
command=/bin/bash -c "export APP_PROJECT_NAME=shadow BASE_API_URL=/api/yanxue CI=true BROWSER=none SANDBOX=true && cd /workspace/ainative-shadow && pnpm install && pnpm dev"
directory=/workspace/ainative-shadow
environment=CI="true",BROWSER="none",APP_PROJECT_NAME="shadow",BASE_API_URL="/api/yanxue",VITE_BASE_URL="/shadow/",VITE_API_URL="/api",SANDBOX="true"
autostart=true
autorestart=true
startsecs=10
startretries=3
priority=110
redirect_stderr=true
stdout_logfile=/workspace/logs/shadow.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=2

[program:app]
command=/bin/bash -c "npm install && npm run dev:h5:local"
directory=/workspace/ainative-app
environment=TARO_APP_API="/api",BROWSER="none",CI="true"
autostart=true
autorestart=true
startsecs=10
startretries=3
priority=120
redirect_stderr=true
stdout_logfile=/workspace/logs/app.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=2

[group:infrastructure]
programs=nginx
priority=10

[group:services]
programs=backend,shadow,app
priority=100
`

export const DEFAULT_REPO_PROJECT_RUNNER_NGINX_CONF = `worker_processes auto;
error_log /dev/stderr warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    access_log /dev/stdout;
    sendfile on;
    keepalive_timeout 65;

    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    server {
        listen 8080;
        server_name localhost;
        charset utf-8;

        location /health {
            return 200 'OK';
            add_header Content-Type text/plain;
        }

        location /api/ {
            proxy_pass http://127.0.0.1:9000/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /ws {
            proxy_pass http://127.0.0.1:9000/ws;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location / {
            proxy_pass http://127.0.0.1:8000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
`

export const DEFAULT_REPO_PROJECT_RUNNER_SUPERVISORD_CONF = `[supervisord]
nodaemon=true
logfile=/workspace/logs/supervisord.log
logfile_maxbytes=10MB
logfile_backups=1
pidfile=/run/supervisord.pid
user=root

[unix_http_server]
file=/run/supervisor.sock
chmod=0700

[rpcinterface:supervisor]
supervisor.rpcinterface_factory = supervisor.rpcinterface:make_main_rpcinterface

[supervisorctl]
serverurl=unix:///run/supervisor.sock

[program:nginx]
command=/usr/sbin/nginx -g "daemon off;"
autostart=true
autorestart=true
priority=30
redirect_stderr=true
stdout_logfile=/workspace/logs/nginx.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=2

[program:backend]
command=/bin/bash -lc "if [ -f /workspace/backend/package.json ]; then cd /workspace/backend && if [ ! -x node_modules/.bin/nest ]; then npm ci --no-audit --no-fund || npm install --no-audit --no-fund; fi && exec npm run start:dev; else echo 'backend project not found, skipping.' && exec sleep infinity; fi"
directory=/workspace/backend
environment=NODE_ENV="development",APP_PORT="9000"
autostart=true
autorestart=true
startsecs=10
startretries=3
priority=100
redirect_stderr=true
stdout_logfile=/workspace/logs/backend.log
stdout_logfile_maxbytes=20MB
stdout_logfile_backups=2

[program:frontend]
command=/bin/bash -lc "if [ -f /workspace/frontend/package.json ]; then cd /workspace/frontend && if [ ! -x node_modules/.bin/vite ]; then npm ci --no-audit --no-fund --include=optional || npm install --no-audit --no-fund --include=optional; fi && exec npm run dev -- --host 0.0.0.0 --port 8000; else echo 'frontend project not found, skipping.' && exec sleep infinity; fi"
directory=/workspace/frontend
environment=NODE_ENV="development",CI="true",BROWSER="none"
autostart=true
autorestart=true
startsecs=10
startretries=3
priority=110
redirect_stderr=true
stdout_logfile=/workspace/logs/frontend.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=2

[group:infrastructure]
programs=nginx
priority=10

[group:services]
programs=backend,frontend
priority=100
`

type SandboxProfile = ProjectContainerRuntimeConfig['sandboxProfile'] | '' | null | undefined

export const resolveDefaultProjectRunnerTemplates = (sandboxProfile?: SandboxProfile) => {
  if (sandboxProfile === 'full-dev-sandbox') {
    return {
      dockerfileRunner: DEFAULT_PROJECT_RUNNER_DOCKERFILE,
      sandboxNginxConf: DEFAULT_PROJECT_RUNNER_NGINX_CONF,
      sandboxSupervisordConf: DEFAULT_PROJECT_RUNNER_SUPERVISORD_CONF,
    }
  }

  return {
    dockerfileRunner: DEFAULT_PROJECT_RUNNER_DOCKERFILE,
    sandboxNginxConf: DEFAULT_REPO_PROJECT_RUNNER_NGINX_CONF,
    sandboxSupervisordConf: DEFAULT_REPO_PROJECT_RUNNER_SUPERVISORD_CONF,
  }
}
