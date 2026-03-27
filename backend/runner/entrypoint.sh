#!/usr/bin/env bash
# ============================================================
# AINative Runner 入口脚本
# ============================================================
#
# 根据 /workspace 目录结构自动判断运行模式：
#
#   1. Sandbox 模式（三合一项目）
#      条件：同时存在 ainative-backend/ + ainative-shadow/ + ainative-app/
#      行为：使用预置的 sandbox.nginx.conf + sandbox.supervisord.conf
#
#   2. Repo 模式（独立前后端项目）
#      条件：存在 backend/package.json 或 frontend/package.json
#      行为：动态生成 nginx 反向代理配置 + supervisord 进程管理配置
#
#   3. 无匹配 → 报错退出
#
# 环境变量（可通过 docker-compose 或 k8s 覆盖）:
#   AINATIVE_RUNNER_WORKSPACE       — 工作区根目录（默认 /workspace）
#   AINATIVE_RUNNER_BACKEND_PORT    — 后端服务端口（默认 9000）
#   AINATIVE_RUNNER_FRONTEND_PORT   — 前端 dev server 端口（默认 8000）
# ============================================================

set -euo pipefail

# ── 路径常量 ──
WORKSPACE_ROOT="${AINATIVE_RUNNER_WORKSPACE:-/workspace}"
BACKEND_DIR="${WORKSPACE_ROOT}/backend"
FRONTEND_DIR="${WORKSPACE_ROOT}/frontend"
# Sandbox 模式下的三个子项目目录
SANDBOX_BACKEND_DIR="${WORKSPACE_ROOT}/ainative-backend"
SANDBOX_SHADOW_DIR="${WORKSPACE_ROOT}/ainative-shadow"
SANDBOX_APP_DIR="${WORKSPACE_ROOT}/ainative-app"
LOG_DIR="${WORKSPACE_ROOT}/logs"
BACKEND_PORT="${AINATIVE_RUNNER_BACKEND_PORT:-9000}"
FRONTEND_PORT="${AINATIVE_RUNNER_FRONTEND_PORT:-8000}"

mkdir -p "${LOG_DIR}" /run/nginx /var/log/nginx /var/log/supervisor /etc/ainative

# ============================================================
# 辅助函数：生成 Repo 模式下的启动脚本和配置
# ============================================================

# 生成后端启动 wrapper 脚本
# - 检查 node_modules 是否已安装，未安装则重试 3 次 npm ci
# - 最终执行 npm run start:dev 以热重载模式启动 NestJS
write_backend_wrapper() {
  cat > /tmp/ainative-runner-backend.sh <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd ${BACKEND_DIR}

if [ ! -x node_modules/.bin/nest ]; then
  for attempt in 1 2 3; do
    if npm ci --no-audit --no-fund; then
      break
    fi
    if [ "\${attempt}" -eq 3 ]; then
      npm install --no-audit --no-fund
      break
    fi
    sleep \$((attempt * 5))
  done
fi

exec npm run start:dev
EOF
  chmod +x /tmp/ainative-runner-backend.sh
}

# 生成前端启动 wrapper 脚本
# - 检查 node_modules 是否已安装，未安装则重试 3 次 npm ci
# - 最终执行 vite dev server，绑定 0.0.0.0 以允许容器外访问
write_frontend_wrapper() {
  cat > /tmp/ainative-runner-frontend.sh <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd ${FRONTEND_DIR}

if [ ! -x node_modules/.bin/vite ]; then
  for attempt in 1 2 3; do
    if npm ci --no-audit --no-fund --include=optional; then
      break
    fi
    if [ "\${attempt}" -eq 3 ]; then
      npm install --no-audit --no-fund --include=optional
      break
    fi
    sleep \$((attempt * 5))
  done
fi

exec npm run dev -- --host 0.0.0.0 --port ${FRONTEND_PORT}
EOF
  chmod +x /tmp/ainative-runner-frontend.sh
}

# 动态生成 Nginx 配置（Repo 模式）
# 统一监听 8080 端口，根据路径分发：
#   /api/    → 反向代理到后端（BACKEND_PORT）
#   /ws      → WebSocket 反向代理到后端
#   /        → 反向代理到前端 dev server（FRONTEND_PORT）
#   /health  → 健康检查端点，始终返回 200
write_repo_nginx_config() {
  cat > /etc/nginx/nginx.conf <<EOF
worker_processes auto;
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

    map \$http_upgrade \$connection_upgrade {
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
EOF

  # 如果存在后端项目，追加 /api/ 和 /ws 反向代理配置
  if [[ -f "${BACKEND_DIR}/package.json" ]]; then
    cat >> /etc/nginx/nginx.conf <<EOF

        location /api/ {
            proxy_pass http://127.0.0.1:${BACKEND_PORT}/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection \$connection_upgrade;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        location /ws {
            proxy_pass http://127.0.0.1:${BACKEND_PORT}/ws;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection \$connection_upgrade;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
EOF
  fi

  # 如果存在前端项目，追加 / 根路径代理到 dev server
  if [[ -f "${FRONTEND_DIR}/package.json" ]]; then
    cat >> /etc/nginx/nginx.conf <<EOF

        location / {
            proxy_pass http://127.0.0.1:${FRONTEND_PORT};
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection \$connection_upgrade;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
EOF
  else
    # 无前端时返回占位文本
    cat >> /etc/nginx/nginx.conf <<'EOF'

        location / {
            default_type "text/plain; charset=utf-8";
            return 200 'AINative runner sandbox is running. Frontend is not available in this workspace.';
        }
EOF
  fi

  cat >> /etc/nginx/nginx.conf <<'EOF'
    }
}
EOF
}

# 动态生成 Supervisord 配置（Repo 模式）
# 统一管理 nginx + backend + frontend 三个进程
write_repo_supervisord_config() {
  # 基础配置：supervisord 本体 + unix socket + nginx 进程
  cat > /tmp/ainative-runner-supervisord.conf <<EOF
[supervisord]
nodaemon=true
logfile=${LOG_DIR}/supervisord.log
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
stdout_logfile=${LOG_DIR}/nginx.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=2
EOF

  # 如果存在后端项目，追加 backend 进程配置
  if [[ -f "${BACKEND_DIR}/package.json" ]]; then
    cat >> /tmp/ainative-runner-supervisord.conf <<EOF

[program:backend]
command=/tmp/ainative-runner-backend.sh
directory=${BACKEND_DIR}
environment=NODE_ENV="development",APP_PORT="${BACKEND_PORT}"
autostart=true
autorestart=true
startsecs=10
startretries=3
priority=100
redirect_stderr=true
stdout_logfile=${LOG_DIR}/backend.log
stdout_logfile_maxbytes=20MB
stdout_logfile_backups=2
EOF
  fi

  # 如果存在前端项目，追加 frontend 进程配置
  if [[ -f "${FRONTEND_DIR}/package.json" ]]; then
    cat >> /tmp/ainative-runner-supervisord.conf <<EOF

[program:frontend]
command=/tmp/ainative-runner-frontend.sh
directory=${FRONTEND_DIR}
environment=NODE_ENV="development",CI="true",BROWSER="none"
autostart=true
autorestart=true
startsecs=10
startretries=3
priority=110
redirect_stderr=true
stdout_logfile=${LOG_DIR}/frontend.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=2
EOF
  fi
}

# ============================================================
# 主逻辑：根据目录结构选择运行模式
# ============================================================

# 模式 1: Sandbox 模式 — 三个子项目目录同时存在
# 直接使用镜像内预置的 nginx + supervisord 配置
if [[ -d "${SANDBOX_BACKEND_DIR}" && -d "${SANDBOX_SHADOW_DIR}" && -d "${SANDBOX_APP_DIR}" ]]; then
  cp /etc/ainative/sandbox.nginx.conf /etc/nginx/nginx.conf
  exec supervisord -c /etc/ainative/sandbox.supervisord.conf -n
fi

# 模式 2: Repo 模式 — 至少需要 backend 或 frontend 之一
if [[ ! -f "${BACKEND_DIR}/package.json" && ! -f "${FRONTEND_DIR}/package.json" ]]; then
  echo "AINative runner sandbox could not find a supported workspace layout under ${WORKSPACE_ROOT}" >&2
  exit 1
fi

# 动态生成配置并启动 supervisord（前台模式，容器不退出）
write_repo_nginx_config
write_backend_wrapper
write_frontend_wrapper
write_repo_supervisord_config
exec supervisord -c /tmp/ainative-runner-supervisord.conf -n
