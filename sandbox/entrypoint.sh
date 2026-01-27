#!/bin/bash
# ============================================================
# 沙箱容器入口脚本
# ============================================================

set -e

echo "============================================================"
echo "  AINative Workspace - All-in-One Sandbox"
echo "============================================================"
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
# 初始化 PostgreSQL（仅首次运行）
# ============================================================

PG_DATA="/var/lib/postgresql/data"

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
    
    if [ -f "/workspace/ainative-backend/doc/sql/init.sql" ]; then
        echo "[INIT] Running init.sql..."
        su -s /bin/sh postgres -c "psql -f /workspace/ainative-backend/doc/sql/init.sql"
    fi
    
    su -s /bin/sh postgres -c "pg_ctl -D $PG_DATA stop"
    sleep 2
    
    echo "[INIT] PostgreSQL initialized"
else
    echo "[INFO] PostgreSQL data exists, skipping init"
fi

# ============================================================
# 显示服务信息
# ============================================================

echo ""
echo "============================================================"
echo "  Infrastructure"
echo "============================================================"
echo "  Nginx:       :8080 (gateway)"
echo "  PostgreSQL:  :${DB_PORT:-5432} (${DB_USER:-postgres})"
echo "  Redis:       :${REDIS_PORT:-6379}"
echo ""
echo "  http://localhost:8080/"
echo "  http://localhost:8080/api/"
echo "  http://localhost:8080/shadow/"
echo "  http://localhost:8080/app/"
echo "  http://localhost:8080/pc/"
echo ""
echo "============================================================"
echo ""

exec "$@"
