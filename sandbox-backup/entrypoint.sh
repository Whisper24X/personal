#!/bin/bash
# ============================================================
# 沙箱容器入口脚本
# ============================================================

set -e

# ============================================================
# 环境检测
# ============================================================

SANDBOX_ENV="${SANDBOX_ENV:-development}"
GO_ENV="${GO_ENV:-$SANDBOX_ENV}"
export GO_ENV

# development / test 使用容器内 DB/Redis；stage / production 连接外部
USE_LOCAL_DB=false
if [[ "$SANDBOX_ENV" == "development" || "$SANDBOX_ENV" == "test" ]]; then
    USE_LOCAL_DB=true
fi

echo "============================================================"
echo "  AINative Workspace - All-in-One Sandbox"
echo "============================================================"
if $USE_LOCAL_DB; then
    echo "  环境: ${SANDBOX_ENV} (使用容器内 DB/Redis)"
else
    echo "  环境: ${SANDBOX_ENV} (连接外部 DB/Redis)"
fi
echo ""

# ============================================================
# 创建必要目录
# ============================================================

mkdir -p /var/log/supervisor /run/postgresql /run/nginx
chown postgres:postgres /run/postgresql

# ============================================================
# 配置 SSH 密钥（修复 Docker 挂载后权限问题）
# ============================================================

SSH_KEY_SRC="/workspace/ainative-backend/configs/ssh/id_ed25519"
KNOWN_HOSTS_SRC="/workspace/ainative-backend/configs/ssh/known_hosts"
SSH_DIR="/root/.ssh"

if [ -f "$SSH_KEY_SRC" ]; then
    echo "[INIT] Configuring SSH key..."
    mkdir -p "$SSH_DIR"
    cp "$SSH_KEY_SRC" "$SSH_DIR/id_ed25519"
    chmod 600 "$SSH_DIR/id_ed25519"
    
    if [ -f "$KNOWN_HOSTS_SRC" ]; then
        cp "$KNOWN_HOSTS_SRC" "$SSH_DIR/known_hosts"
        chmod 644 "$SSH_DIR/known_hosts"
    fi
    
    chmod 700 "$SSH_DIR"
    echo "[INIT] SSH key configured"
fi

# ============================================================
# 根据环境配置 supervisord
# ============================================================

if ! $USE_LOCAL_DB; then
    echo "[INIT] ${SANDBOX_ENV} 环境: 禁用容器内 PostgreSQL 和 Redis..."
    sed -i '/\[program:postgresql\]/,/^\[/ s/autostart=true/autostart=false/' /etc/supervisord.conf
    sed -i '/\[program:redis\]/,/^\[/ s/autostart=true/autostart=false/' /etc/supervisord.conf
    echo "[INIT] PostgreSQL 和 Redis 已禁用（将使用 ${SANDBOX_ENV}.yaml 中的外部连接）"
fi

# ============================================================
# 初始化 PostgreSQL（仅开发环境 + 首次运行）
# ============================================================

PG_DATA="/var/lib/postgresql/data"

if $USE_LOCAL_DB; then
    if [ ! -f "$PG_DATA/PG_VERSION" ]; then
        echo "[INIT] Initializing PostgreSQL..."
        
        su -s /bin/sh postgres -c "initdb -D $PG_DATA -E UTF8 --locale=C"
        
        echo "listen_addresses = '*'" >> $PG_DATA/postgresql.conf
        echo "password_encryption = 'scram-sha-256'" >> $PG_DATA/postgresql.conf
        echo "host all all 0.0.0.0/0 scram-sha-256" >> $PG_DATA/pg_hba.conf
        
        su -s /bin/sh postgres -c "pg_ctl -D $PG_DATA -l /tmp/pg_init.log start"
        
        # 等待 PostgreSQL 完全启动
        echo "[INIT] Waiting for PostgreSQL to be ready..."
        for i in $(seq 1 30); do
            if pg_isready -U postgres -q; then
                echo "[INIT] PostgreSQL is ready"
                break
            fi
            if [ $i -eq 30 ]; then
                echo "[ERROR] PostgreSQL failed to start within 30 seconds"
                exit 1
            fi
            sleep 1
        done
        
        su -s /bin/sh postgres -c "psql -c \"ALTER USER ${DB_USER:-postgres} WITH PASSWORD '${DB_PASSWORD:-123456}';\""
        
        # 创建业务数据库
        echo "[INIT] Creating database ${DB_NAME:-postgres}..."
        su -s /bin/sh postgres -c "psql -c \"CREATE DATABASE ${DB_NAME:-postgres} OWNER ${DB_USER:-postgres};\"" 2>/dev/null || echo "[INFO] Database already exists"
        echo "[INIT] Database ${DB_NAME:-postgres} ready"
        
        if [ -f "/workspace/ainative-backend/doc/sql/init.sql" ]; then
            echo "[INIT] Running init.sql..."
            su -s /bin/sh postgres -c "psql -d ${DB_NAME:-postgres} -f /workspace/ainative-backend/doc/sql/init.sql"
        fi
        
        su -s /bin/sh postgres -c "pg_ctl -D $PG_DATA stop"
        sleep 2
        
        echo "[INIT] PostgreSQL initialized"
    else
        echo "[INFO] PostgreSQL data exists, skipping init"
    fi
else
    echo "[INFO] ${SANDBOX_ENV} 环境: 跳过 PostgreSQL 初始化（使用外部数据库）"
fi

# ============================================================
# 显示服务信息
# ============================================================

echo ""
echo "============================================================"
echo "  Infrastructure (GO_ENV=${GO_ENV})"
echo "============================================================"
echo "  Nginx:       :8080 (gateway, Docker 映射端口: ${SANDBOX_PORT:-8070})"
if $USE_LOCAL_DB; then
echo "  PostgreSQL:  :${DB_PORT:-5432} (${DB_USER:-postgres}) [容器内]"
echo "  Redis:       :${REDIS_PORT:-6379} [容器内]"
else
echo "  PostgreSQL:  使用 ${GO_ENV}.yaml 中的外部连接"
echo "  Redis:       使用 ${GO_ENV}.yaml 中的外部连接"
fi
echo ""
echo "  访问地址："
if [ -n "${SANDBOX_BASE_URL:-}" ]; then
echo "  ${SANDBOX_BASE_URL}/"
echo "  ${SANDBOX_BASE_URL}/api/"
echo "  ${SANDBOX_BASE_URL}/shadow/"
echo "  ${SANDBOX_BASE_URL}/app/"
else
echo "  http://<HOST>:${SANDBOX_PORT:-8070}/"
echo "  http://<HOST>:${SANDBOX_PORT:-8070}/api/"
echo "  http://<HOST>:${SANDBOX_PORT:-8070}/shadow/"
echo "  http://<HOST>:${SANDBOX_PORT:-8070}/app/"
echo ""
echo "  提示: 在 sandbox/.env 中设置 SANDBOX_BASE_URL 可显示正确地址"
fi
echo ""
echo "============================================================"
echo ""

exec "$@"
