#!/usr/bin/env bash
# ============================================================
# All-in-One AI 编码沙箱管理脚本
# ============================================================
#
# 使用方式:
#   ./sandbox/sandbox.sh build     - 构建沙箱镜像
#   ./sandbox/sandbox.sh rebuild   - 强制重建镜像（无缓存）
#   ./sandbox/sandbox.sh start     - 启动沙箱容器
#   ./sandbox/sandbox.sh stop      - 停止沙箱容器
#   ./sandbox/sandbox.sh restart   - 重启沙箱容器
#   ./sandbox/sandbox.sh shell     - 进入沙箱 Shell
#   ./sandbox/sandbox.sh logs      - 查看沙箱日志
#   ./sandbox/sandbox.sh status    - 查看服务状态
#   ./sandbox/sandbox.sh exec      - 在沙箱内执行命令
#   ./sandbox/sandbox.sh clean     - 清理沙箱（删除容器和数据）

set -e

# ============================================================
# 配置常量
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 安全加载 .env：只读取 KEY=VALUE 格式行，忽略注释和空行
if [[ -f "$SCRIPT_DIR/.env" ]]; then
    while IFS='=' read -r key value; do
        [[ "$key" =~ ^[[:space:]]*#.*$ || -z "$key" ]] && continue
        key="${key%%[[:space:]]*}"
        value="${value##[[:space:]]*}"
        # 去除 value 两端的引号（单引号或双引号）
        if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then
            value="${BASH_REMATCH[1]}"
        fi
        export "$key=$value"
    done < "$SCRIPT_DIR/.env"
fi

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

# ============================================================
# 自动推导
# ============================================================

_resolve_worktree_suffix() {
    local branch
    branch=$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null) || branch=""
    if [[ -z "$branch" || "$branch" == "HEAD" ]]; then
        branch=$(basename "$PROJECT_ROOT")
    fi
    # 规范化：Docker Compose 项目名只允许 [a-z0-9-_]
    # 斜杠/点号 → 连字符，大写 → 小写
    local normalized="${branch//\//-}"
    normalized="${normalized//./-}"
    echo "$normalized" | tr '[:upper:]' '[:lower:]'
}


_port_in_use() {
    lsof -i :"$1" -sTCP:LISTEN >/dev/null 2>&1
}

_resolve_port() {
    local suffix="$1"
    # master/main 优先 8080，被占用则 fallback
    if [[ "$suffix" == "master" || "$suffix" == "main" ]] && ! _port_in_use 8080; then
        echo 8080; return
    fi
    local hash port
    hash=$(printf '%s' "$suffix" | cksum | awk '{print $1}')
    port=$(( 8081 + hash % 41071 ))
    for (( i=0; i<100; i++ )); do
        _port_in_use "$port" || { echo "$port"; return; }
        port=$(( 8081 + (port - 8080) % 41071 ))
    done
    warn "尝试 100 次仍未找到可用端口，使用 $port" >&2
    echo "$port"
}

WORKTREE_SUFFIX="$(_resolve_worktree_suffix)"
SANDBOX_PROJECT="${SANDBOX_PROJECT:-$(basename "$PROJECT_ROOT")}"
CONTAINER_NAME="${SANDBOX_NAME:-${SANDBOX_PROJECT}-sandbox-${WORKTREE_SUFFIX}}"
NGINX_PORT="${SANDBOX_PORT:-$(_resolve_port "$WORKTREE_SUFFIX")}"

SHARED_VOLUMES=("${SANDBOX_PROJECT}-go-mod-cache" "${SANDBOX_PROJECT}-go-build-cache" "${SANDBOX_PROJECT}-pnpm-store-cache")

export SANDBOX_NAME="$CONTAINER_NAME"
export SANDBOX_PORT="$NGINX_PORT"
export SANDBOX_PROJECT

check_docker() {
    if ! docker info > /dev/null 2>&1; then
        error "Docker 未运行，请先启动 Docker Desktop"
        exit 1
    fi
}

dc() {
    docker compose -f "$SCRIPT_DIR/docker-compose.yml" --project-directory "$PROJECT_ROOT" \
        --project-name "${SANDBOX_PROJECT}-${WORKTREE_SUFFIX}" "$@"
}

is_running() {
    docker ps --filter "name=^${CONTAINER_NAME}$" --format "{{.Names}}" 2>/dev/null | grep -q "^${CONTAINER_NAME}$"
}

docker_exec() {
    local flags="-i"
    [[ -t 0 ]] && flags="-it"
    docker exec $flags "$CONTAINER_NAME" "$@"
}

# ============================================================
# 命令实现
# ============================================================

cmd_build() {
    check_docker
    info "构建沙箱镜像..."
    dc build
    success "沙箱镜像构建完成！"
}

cmd_rebuild() {
    check_docker
    info "强制重建沙箱镜像（无缓存）..."
    dc build --no-cache
    success "沙箱镜像重建完成！"
}

_ensure_shared_volumes() {
    for vol in "${SHARED_VOLUMES[@]}"; do
        if ! docker volume inspect "$vol" > /dev/null 2>&1; then
            docker volume create "$vol" > /dev/null
        fi
    done
}

cmd_start() {
    check_docker

    if is_running; then
        warn "沙箱已在运行中"
        cmd_info
        return
    fi

    local legacy_name="${SANDBOX_PROJECT}-sandbox"
    if [[ "$CONTAINER_NAME" != "$legacy_name" ]] && \
       docker ps -a --filter "name=^${legacy_name}$" --format "{{.Names}}" 2>/dev/null | grep -q "^${legacy_name}$"; then
        warn "检测到旧容器 ${legacy_name}，正在停止并移除..."
        docker rm -f "$legacy_name" > /dev/null 2>&1 || true
    fi

    _ensure_shared_volumes
    info "启动沙箱容器 [${WORKTREE_SUFFIX}]..."
    dc up -d --wait

    success "沙箱已启动！"
    echo ""
    cmd_info
}

cmd_stop() {
    check_docker
    info "停止沙箱容器..."
    dc down
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
    if [[ -z "$service" ]]; then
        error "请指定服务名: backend | shadow | app | nginx"
        exit 1
    fi
    docker_exec sh -c "cat /workspace/logs/${service}.log && echo '=== 以上为历史日志，以下为实时日志 ===' && tail -n 0 -f /workspace/logs/${service}.log"
}

cmd_info() {
    echo ""
    echo -e "${CYAN}  AINative Workspace - All-in-One Sandbox${NC}"
    echo -e "${CYAN}============================================================${NC}"
    echo ""
    echo -e "分支:   ${YELLOW}${WORKTREE_SUFFIX}${NC}"
    echo -e "容器:   ${CONTAINER_NAME}"
    echo -e "端口:   ${NGINX_PORT}"

    if is_running; then
        echo -e "状态:   ${GREEN}运行中${NC}"
    else
        echo -e "状态:   ${YELLOW}已停止${NC}"
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

cmd_list() {
    check_docker
    echo ""
    echo -e "${CYAN}所有沙箱实例${NC}"
    echo -e "${CYAN}============================================================${NC}"
    echo ""
    local found=false
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        found=true
        local name port status
        name=$(echo "$line" | awk '{print $1}')
        port=$(echo "$line" | awk '{print $2}')
        status=$(echo "$line" | cut -d' ' -f3-)
        local host_port
        host_port=$(echo "$port" | sed -n 's/.*0\.0\.0\.0:\([0-9]*\)->.*/\1/p')
        [[ -z "$host_port" ]] && host_port="$port"
        echo -e "  ${GREEN}${name}${NC}"
        echo -e "    端口: ${host_port}    状态: ${status}"
        echo ""
    done < <(docker ps --filter "name=${SANDBOX_PROJECT}-sandbox" --format "{{.Names}} {{.Ports}} {{.Status}}" 2>/dev/null)

    if [[ "$found" == false ]]; then
        echo -e "  ${YELLOW}没有运行中的沙箱实例${NC}"
    fi
}

cmd_status() {
    check_docker

    if ! is_running; then
        warn "沙箱未运行"
        return
    fi

    docker_exec supervisorctl status
}

cmd_clean() {
    check_docker

    warn "即将清理沙箱（删除容器、卷和镜像）"
    read -p "确认清理？[y/N] " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "已取消"
        return
    fi

    info "清理沙箱..."
    dc down -v --rmi local 2>/dev/null || true
    success "沙箱已清理"

    local existing=()
    for vol in "${SHARED_VOLUMES[@]}"; do
        if docker volume inspect "$vol" > /dev/null 2>&1; then
            existing+=("$vol")
        fi
    done

    if [[ ${#existing[@]} -gt 0 ]]; then
        echo ""
        warn "检测到共享缓存卷（所有分支共用，删除后首次构建会变慢）:"
        for vol in "${existing[@]}"; do
            echo "  - $vol"
        done
        read -p "是否也清理共享缓存卷？[y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            for vol in "${existing[@]}"; do
                docker volume rm "$vol" > /dev/null 2>&1 || true
            done
            success "共享缓存卷已清理"
        else
            info "保留共享缓存卷"
        fi
    fi
}

cmd_restart() {
    check_docker
    info "重启沙箱容器..."

    # 日志文件由容器内 root 创建，宿主机用户无权清空；
    # 趁容器还在运行，用 docker exec 在容器内完成截断。
    if is_running; then
        info "清理日志文件（容器内执行）..."
        docker_exec sh -c 'for f in /workspace/logs/*.log; do [ -f "$f" ] && : > "$f"; done' \
            && success "日志已清空" \
            || warn "日志清理失败，继续重启"
    fi

    dc down
    # 容器可能由旧 project-name 创建，dc down 无法删除；显式清理残留
    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
    dc up -d --wait
    success "沙箱已重启"
}

cmd_exec() {
    check_docker

    if [[ $# -eq 0 ]]; then
        error "缺少命令参数，用法: $0 exec <command> [args...]"
        exit 1
    fi

    if ! is_running; then
        error "沙箱未运行"
        exit 1
    fi

    docker_exec "$@"
}

cmd_help() {
    echo ""
    echo -e "${CYAN}All-in-One AI 编码沙箱${NC}"
    echo ""
    echo -e "当前分支: ${YELLOW}${WORKTREE_SUFFIX}${NC}  容器: ${CONTAINER_NAME}  端口: ${NGINX_PORT}"
    echo ""
    echo "使用方式: $0 <command> [arguments]"
    echo ""
    echo "命令:"
    echo "  build              构建沙箱镜像"
    echo "  rebuild            强制重建镜像（无缓存）"
    echo "  start              启动沙箱容器"
    echo "  stop               停止沙箱容器"
    echo "  restart            重启沙箱容器"
    echo "  shell              进入沙箱 Shell"
    echo "  status             查看服务状态"
    echo "  logs [service]     查看日志（backend/shadow/app）"
    echo "  info               显示沙箱信息"
    echo "  list               列出所有运行中的沙箱实例"
    echo "  exec <cmd>         在沙箱内执行命令"
    echo "  clean              清理沙箱（删除容器和数据）"
    echo "  help               显示帮助信息"
    echo ""
    echo "多 worktree 支持: 容器名和端口根据分支名自动推导，无需手动配置"
    echo "手动覆盖: 在 sandbox/.env 中设置 SANDBOX_NAME / SANDBOX_PORT"
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
        rebuild)        cmd_rebuild ;;
        start|up)       cmd_start ;;
        stop|down)      cmd_stop ;;
        restart)        cmd_restart ;;
        shell|sh|bash)  cmd_shell ;;
        logs)           cmd_logs "$@" ;;
        status|ps)      cmd_status ;;
        info)           cmd_info ;;
        list|ls)        cmd_list ;;
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
