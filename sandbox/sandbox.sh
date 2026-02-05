#!/usr/bin/env bash
# ============================================================
# All-in-One AI 编码沙箱管理脚本
# ============================================================
#
# 使用方式:
#   ./sandbox/sandbox.sh build   - 构建沙箱镜像
#   ./sandbox/sandbox.sh start   - 启动沙箱容器
#   ./sandbox/sandbox.sh stop    - 停止沙箱容器
#   ./sandbox/sandbox.sh shell   - 进入沙箱 Shell
#   ./sandbox/sandbox.sh logs    - 查看沙箱日志
#   ./sandbox/sandbox.sh status  - 查看服务状态
#   ./sandbox/sandbox.sh clean   - 清理沙箱（删除容器和数据）

set -e

# ============================================================
# 配置常量
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 加载 .env 配置文件（如果存在）
if [[ -f "$SCRIPT_DIR/.env" ]]; then
    # shellcheck source=/dev/null
    source "$SCRIPT_DIR/.env"
fi

# 容器配置（优先级：命令行环境变量 > .env 文件 > 默认值）
CONTAINER_NAME="${SANDBOX_NAME:-ainative-workspace-sandbox}"
IMAGE_NAME="${CONTAINER_NAME}:latest"
NGINX_PORT="${SANDBOX_PORT:-8080}"
MEMORY_LIMIT="${SANDBOX_MEMORY:-8g}"
MEMORY_RESERVATION="${SANDBOX_MEMORY_MIN:-2g}"

# 命名卷（基于容器名生成）
VOLUME_GO_MOD="${CONTAINER_NAME}-go-mod-cache"
VOLUME_PNPM="${CONTAINER_NAME}-pnpm-store"
VOLUME_PG_DATA="${CONTAINER_NAME}-pg-data"
VOLUME_REDIS_DATA="${CONTAINER_NAME}-redis-data"

# ============================================================
# 工具函数
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1" >&2; }

check_docker() {
    if ! docker info > /dev/null 2>&1; then
        error "Docker 未运行，请先启动 Docker Desktop"
        exit 1
    fi
}

is_running() {
    docker ps --filter "name=^${CONTAINER_NAME}$" --format "{{.Names}}" 2>/dev/null | grep -q "^${CONTAINER_NAME}$"
}

container_exists() {
    docker ps -a --filter "name=^${CONTAINER_NAME}$" --format "{{.Names}}" 2>/dev/null | grep -q "^${CONTAINER_NAME}$"
}

image_exists() {
    docker images --format "{{.Repository}}:{{.Tag}}" 2>/dev/null | grep -q "^${IMAGE_NAME}$"
}

# ============================================================
# 命令实现
# ============================================================

cmd_build() {
    check_docker
    info "构建沙箱镜像..."
    
    docker build -t "$IMAGE_NAME" -f "$SCRIPT_DIR/Dockerfile" "$SCRIPT_DIR"
    
    success "沙箱镜像构建完成！"
}

cmd_start() {
    check_docker
    
    if is_running; then
        warn "沙箱已在运行中"
        cmd_info
        return
    fi
    
    if ! image_exists; then
        warn "镜像不存在，开始构建..."
        cmd_build
    fi
    
    if container_exists; then
        info "移除已停止的容器..."
        docker rm "$CONTAINER_NAME" > /dev/null 2>&1 || true
    fi
    
    info "启动沙箱容器..."
    
    docker run -d \
        --name "$CONTAINER_NAME" \
        --hostname "$CONTAINER_NAME" \
        -p "${NGINX_PORT}:8080" \
        --memory="${MEMORY_LIMIT}" --memory-reservation="${MEMORY_RESERVATION}" \
        -v "$PROJECT_ROOT/ainative-backend:/workspace/ainative-backend" \
        -v "$PROJECT_ROOT/ainative-shadow:/workspace/ainative-shadow" \
        -v "$PROJECT_ROOT/ainative-app:/workspace/ainative-app" \
        -v "$VOLUME_GO_MOD:/go/pkg/mod" \
        -v "$VOLUME_PNPM:/root/.local/share/pnpm/store" \
        -v "$VOLUME_PG_DATA:/var/lib/postgresql/data" \
        -v "$VOLUME_REDIS_DATA:/var/lib/redis" \
        "$IMAGE_NAME"
    
    info "等待服务启动..."
    sleep 5
    
    success "沙箱已启动！"
    echo ""
    cmd_info
}

cmd_stop() {
    check_docker
    
    if ! is_running; then
        warn "沙箱未运行"
        return
    fi
    
    info "停止沙箱容器..."
    docker stop "$CONTAINER_NAME"
    success "沙箱已停止"
}

cmd_shell() {
    check_docker
    
    if ! is_running; then
        warn "沙箱未运行，正在启动..."
        cmd_start
    fi
    
    info "进入沙箱 Shell..."
    echo ""
    docker exec -it "$CONTAINER_NAME" bash
}

cmd_logs() {
    check_docker
    
    if ! is_running; then
        error "沙箱未运行"
        exit 1
    fi
    
    local service="${1:-}"
    if [[ -n "$service" ]]; then
        docker exec -it "$CONTAINER_NAME" tail -f "/var/log/supervisor/${service}.log"
    else
        docker logs -f "$CONTAINER_NAME"
    fi
}

cmd_info() {
    echo ""
    echo -e "${CYAN}  AINative Workspace - All-in-One Sandbox${NC}"
    echo -e "${CYAN}============================================================${NC}"
    echo ""
    
    if is_running; then
        echo -e "状态: ${GREEN}运行中${NC}"
    else
        echo -e "状态: ${YELLOW}已停止${NC}"
        return
    fi
    
    echo ""
    echo "访问地址:"
    echo "  统一入口:    http://localhost:${NGINX_PORT}/"
    echo "  后端 API:    http://localhost:${NGINX_PORT}/api/"
    echo "  管理后台:    http://localhost:${NGINX_PORT}/shadow/"
    echo "  移动端 H5:   http://localhost:${NGINX_PORT}/app/"
    echo ""
    echo "常用命令:"
    echo "  进入沙箱:     ./sandbox/sandbox.sh shell"
    echo "  查看状态:     ./sandbox/sandbox.sh status"
    echo "  查看日志:     ./sandbox/sandbox.sh logs [backend|shadow|app]"
}

cmd_status() {
    check_docker
    
    if ! is_running; then
        warn "沙箱未运行"
        return
    fi
    
    docker exec -it "$CONTAINER_NAME" supervisorctl status
}

cmd_clean() {
    check_docker
    
    warn "即将清理沙箱（删除容器和所有数据）"
    read -p "确认清理？[y/N] " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "已取消"
        return
    fi
    
    info "清理沙箱..."
    
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
    docker volume rm "$VOLUME_GO_MOD" "$VOLUME_PNPM" "$VOLUME_PG_DATA" "$VOLUME_REDIS_DATA" 2>/dev/null || true
    docker rmi "$IMAGE_NAME" 2>/dev/null || true
    
    success "沙箱已清理"
}

cmd_restart() {
    cmd_stop
    sleep 2
    cmd_start
}

cmd_exec() {
    check_docker
    
    if ! is_running; then
        error "沙箱未运行"
        exit 1
    fi
    
    docker exec -it "$CONTAINER_NAME" "$@"
}

cmd_help() {
    echo ""
    echo -e "${CYAN}All-in-One AI 编码沙箱${NC}"
    echo ""
    echo "使用方式: $0 <command> [arguments]"
    echo ""
    echo "命令:"
    echo "  build              构建沙箱镜像"
    echo "  start              启动沙箱容器"
    echo "  stop               停止沙箱容器"
    echo "  restart            重启沙箱容器"
    echo "  shell              进入沙箱 Shell"
    echo "  status             查看服务状态"
    echo "  logs [service]     查看日志（backend/shadow/app）"
    echo "  info               显示沙箱信息"
    echo "  exec <cmd>         在沙箱内执行命令"
    echo "  clean              清理沙箱（删除容器和数据）"
    echo "  help               显示帮助信息"
    echo ""
    echo "配置方式（优先级从高到低）:"
    echo "  1. 命令行环境变量:  SANDBOX_PORT=8081 ./sandbox/sandbox.sh start"
    echo "  2. .env 配置文件:   vim sandbox/.env"
    echo "  3. 默认值"
    echo ""
    echo "可配置项:"
    echo "  SANDBOX_NAME       容器名称（默认: ainative-workspace-sandbox）"
    echo "  SANDBOX_PORT       Nginx 端口（默认: 8080）"
    echo "  SANDBOX_MEMORY     内存限制（默认: 8g）"
    echo "  SANDBOX_MEMORY_MIN 内存预留（默认: 2g）"
    echo ""
}

# ============================================================
# 主入口
# ============================================================

main() {
    local command="${1:-help}"
    shift || true
    
    case "$command" in
        build)          cmd_build ;;
        start|up)       cmd_start ;;
        stop|down)      cmd_stop ;;
        restart)        cmd_restart ;;
        shell|sh|bash)  cmd_shell ;;
        logs)           cmd_logs "$@" ;;
        status|ps)      cmd_status ;;
        info)           cmd_info ;;
        exec)           cmd_exec "$@" ;;
        clean)          cmd_clean ;;
        help|--help|-h) cmd_help ;;
        *)
            error "未知命令: $command"
            cmd_help
            exit 1
            ;;
    esac
}

main "$@"
