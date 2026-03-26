#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="${AINATIVE_RUNNER_WORKSPACE:-/workspace}"
BACKEND_DIR="${WORKSPACE_ROOT}/backend"
FRONTEND_DIR="${WORKSPACE_ROOT}/frontend"
SANDBOX_BACKEND_DIR="${WORKSPACE_ROOT}/ainative-backend"
SANDBOX_SHADOW_DIR="${WORKSPACE_ROOT}/ainative-shadow"
SANDBOX_APP_DIR="${WORKSPACE_ROOT}/ainative-app"
LOG_DIR="${WORKSPACE_ROOT}/logs"
BACKEND_PORT="${AINATIVE_RUNNER_BACKEND_PORT:-9000}"
FRONTEND_PORT="${AINATIVE_RUNNER_FRONTEND_PORT:-8000}"

mkdir -p "${LOG_DIR}" /run/nginx /var/log/nginx /var/log/supervisor /etc/ainative

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

write_repo_supervisord_config() {
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

if [[ -d "${SANDBOX_BACKEND_DIR}" && -d "${SANDBOX_SHADOW_DIR}" && -d "${SANDBOX_APP_DIR}" ]]; then
  cp /etc/ainative/sandbox.nginx.conf /etc/nginx/nginx.conf
  exec supervisord -c /etc/ainative/sandbox.supervisord.conf -n
fi

if [[ ! -f "${BACKEND_DIR}/package.json" && ! -f "${FRONTEND_DIR}/package.json" ]]; then
  echo "AINative runner sandbox could not find a supported workspace layout under ${WORKSPACE_ROOT}" >&2
  exit 1
fi

write_repo_nginx_config
write_backend_wrapper
write_frontend_wrapper
write_repo_supervisord_config
exec supervisord -c /tmp/ainative-runner-supervisord.conf -n
