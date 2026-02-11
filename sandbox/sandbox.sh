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
    # 第一步：检查 docker 命令是否存在
    if ! command -v docker &> /dev/null; then
        error "Docker 未安装，请先安装 Docker"
        exit 1
    fi

    # 第二步：如果 docker info 正常，直接返回
    if docker info > /dev/null 2>&1; then
        return 0
    fi

    # 第三步：Docker 不可用，尝试诊断和自动修复
    warn "Docker 未运行，正在诊断..."

    # 检测运行环境（macOS vs Linux）
    if [[ "$(uname)" == "Darwin" ]]; then
        error "Docker Desktop 未运行，请先启动 Docker Desktop"
        exit 1
    fi

    # Linux 环境：尝试自动修复 Rootless Docker
    _check_and_fix_rootless_docker
}

# 诊断和修复 Rootless Docker 环境
_check_and_fix_rootless_docker() {
    info "检测到 Linux 环境，诊断 Rootless Docker..."

    local has_fix=false
    local need_restart=false
    local diagnostics=()

    # ---- 检查 1: 内核是否支持 user namespaces ----
    local max_ns
    max_ns=$(cat /proc/sys/user/max_user_namespaces 2>/dev/null || echo "0")
    if [[ "$max_ns" -eq 0 ]]; then
        diagnostics+=("❌ 内核未启用 user namespaces (max_user_namespaces=0)")
        diagnostics+=("   修复: sudo sysctl -w user.max_user_namespaces=63759")
        diagnostics+=("   持久化: echo 'user.max_user_namespaces=63759' | sudo tee /etc/sysctl.d/99-userns.conf && sudo sysctl --system")
    else
        diagnostics+=("✅ 内核 user namespaces 已启用 (max=$max_ns)")
    fi

    # ---- 检查 2: /etc/subuid 和 /etc/subgid 配置 ----
    local current_user
    current_user=$(whoami)
    local current_uid
    current_uid=$(id -u)

    local subuid_ok=false
    local subgid_ok=false

    if [[ -f /etc/subuid ]]; then
        # 检查是否有当前用户名或 UID 的条目
        if grep -qE "^(${current_user}|${current_uid}):" /etc/subuid 2>/dev/null; then
            subuid_ok=true
            diagnostics+=("✅ /etc/subuid 配置正常")
        fi
    fi

    if [[ -f /etc/subgid ]]; then
        if grep -qE "^(${current_user}|${current_uid}):" /etc/subgid 2>/dev/null; then
            subgid_ok=true
            diagnostics+=("✅ /etc/subgid 配置正常")
        fi
    fi

    if ! $subuid_ok || ! $subgid_ok; then
        diagnostics+=("❌ /etc/subuid 或 /etc/subgid 缺少用户 ${current_user}(${current_uid}) 的条目")
        diagnostics+=("   修复: sudo bash -c 'echo \"${current_user}:100000:65536\" >> /etc/subuid'")
        diagnostics+=("         sudo bash -c 'echo \"${current_user}:100000:65536\" >> /etc/subgid'")
        # 同时添加 UID 格式条目以兼容某些版本的 newuidmap
        diagnostics+=("         sudo bash -c 'echo \"${current_uid}:100000:65536\" >> /etc/subuid'")
        diagnostics+=("         sudo bash -c 'echo \"${current_uid}:100000:65536\" >> /etc/subgid'")
    fi

    # ---- 检查 3: newuidmap / newgidmap 权限 ----
    local newuidmap_path
    newuidmap_path=$(command -v newuidmap 2>/dev/null || echo "")

    if [[ -z "$newuidmap_path" ]]; then
        diagnostics+=("❌ newuidmap 未找到")
        diagnostics+=("   修复: sudo apt-get install -y uidmap (Debian/Ubuntu)")
        diagnostics+=("         sudo yum install -y shadow-utils (CentOS/RHEL)")
    else
        local owner
        owner=$(stat -c '%U' "$newuidmap_path" 2>/dev/null || echo "unknown")
        local perms
        perms=$(stat -c '%a' "$newuidmap_path" 2>/dev/null || echo "000")

        if [[ "$owner" != "root" ]]; then
            diagnostics+=("❌ newuidmap ($newuidmap_path) 所属者是 '${owner}'，而非 'root'")
            diagnostics+=("   setuid 位需要文件归属于 root 才能正常工作")
            diagnostics+=("   修复: sudo chown root:root ${newuidmap_path}")

            # 检查系统路径是否有正确的 newuidmap
            if [[ -f /usr/bin/newuidmap ]]; then
                local sys_owner
                sys_owner=$(stat -c '%U' /usr/bin/newuidmap 2>/dev/null || echo "unknown")
                if [[ "$sys_owner" == "root" ]]; then
                    diagnostics+=("   或者: 使用系统自带的 /usr/bin/newuidmap（已归属 root）")
                    diagnostics+=("         确保 PATH 中 /usr/bin 优先于 ${newuidmap_path%/*}")

                    # 自动尝试修复：临时把 /usr/bin 放到 PATH 前面
                    export PATH="/usr/bin:$PATH"
                    has_fix=true
                    need_restart=true
                    diagnostics+=("   🔧 已自动将 /usr/bin 添加到 PATH 前端")
                fi
            fi
        else
            # 检查 setuid 位
            if [[ ! -u "$newuidmap_path" ]]; then
                diagnostics+=("❌ newuidmap ($newuidmap_path) 缺少 setuid 位")
                diagnostics+=("   修复: sudo chmod u+s ${newuidmap_path}")
            else
                diagnostics+=("✅ newuidmap 权限正常 ($newuidmap_path, owner=$owner, perms=$perms)")
            fi
        fi
    fi

    # ---- 检查 4: Docker systemd 服务状态 ----
    local docker_unit_status=""
    if systemctl --user is-enabled docker.service &>/dev/null 2>&1; then
        docker_unit_status=$(systemctl --user status docker.service 2>&1 | tail -5 || true)
        diagnostics+=("ℹ️  Docker 用户服务状态 (最近日志):")
        diagnostics+=("   $docker_unit_status")
    fi

    # ---- 打印诊断结果 ----
    echo ""
    echo -e "${CYAN}========== Rootless Docker 诊断报告 ==========${NC}"
    for line in "${diagnostics[@]}"; do
        echo -e "  $line"
    done
    echo -e "${CYAN}===============================================${NC}"
    echo ""

    # ---- 自动修复后重试 ----
    if $has_fix && $need_restart; then
        info "正在尝试重启 Rootless Docker..."
        systemctl --user restart docker.service 2>/dev/null || true
        sleep 3

        if docker info > /dev/null 2>&1; then
            success "Docker 已成功启动！"
            return 0
        fi
    fi

    # ---- 尝试直接启动 ----
    info "尝试启动 Docker 服务..."
    systemctl --user start docker.service 2>/dev/null || true
    sleep 3

    if docker info > /dev/null 2>&1; then
        success "Docker 已成功启动！"
        return 0
    fi

    # ---- 无法自动修复，给出手动修复指引 ----
    echo ""
    error "Docker 无法自动启动，请根据上述诊断报告手动修复"
    echo ""
    echo -e "${YELLOW}快速修复脚本:${NC}"
    echo "  bash $SCRIPT_DIR/setup-rootless-docker.sh"
    echo ""
    echo -e "${YELLOW}或手动执行以下步骤:${NC}"
    echo "  1. 确保 /etc/subuid 和 /etc/subgid 包含当前用户条目"
    echo "  2. 确保 newuidmap/newgidmap 归属于 root 并有 setuid 位"
    echo "  3. 重启 Docker: systemctl --user restart docker"
    echo ""
    exit 1
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
