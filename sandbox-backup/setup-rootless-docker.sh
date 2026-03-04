#!/usr/bin/env bash
# ============================================================
# Rootless Docker 环境检查与修复脚本
# ============================================================
#
# 用于自动检查和修复 Rootless Docker 运行环境。
# 解决 newuidmap / UID mapping 相关的权限问题。
#
# 使用方式:
#   bash sandbox/setup-rootless-docker.sh          # 检查并修复
#   bash sandbox/setup-rootless-docker.sh --check   # 仅检查，不修复
#   bash sandbox/setup-rootless-docker.sh --fix     # 直接修复（需要 sudo）
#
# 常见错误场景:
#   newuidmap: write to uid_map failed: Operation not permitted
#   rootlesskit: failed to setup UID/GID map
#
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[  OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail()    { echo -e "${RED}[FAIL]${NC} $1"; }
section() { echo -e "\n${CYAN}── $1 ──${NC}"; }

CURRENT_USER=$(whoami)
CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)

MODE="${1:---check-and-fix}"

ISSUES=()
FIXES=()

# ============================================================
# 检查函数
# ============================================================

check_os() {
    section "操作系统检查"
    if [[ "$(uname)" != "Linux" ]]; then
        fail "当前系统为 $(uname)，Rootless Docker 仅支持 Linux"
        fail "macOS 请使用 Docker Desktop"
        exit 1
    fi
    success "Linux 系统: $(uname -r)"
}

check_kernel_userns() {
    section "内核 User Namespaces 支持"
    local max_ns
    max_ns=$(cat /proc/sys/user/max_user_namespaces 2>/dev/null || echo "0")
    
    if [[ "$max_ns" -eq 0 ]]; then
        fail "user namespaces 未启用 (max_user_namespaces=$max_ns)"
        ISSUES+=("kernel_userns")
        FIXES+=("sudo sysctl -w user.max_user_namespaces=63759")
        FIXES+=("echo 'user.max_user_namespaces=63759' | sudo tee /etc/sysctl.d/99-userns.conf")
    else
        success "user namespaces 已启用 (max=$max_ns)"
    fi
}

check_subuid_subgid() {
    section "/etc/subuid 和 /etc/subgid 配置"

    local subuid_ok=false
    local subgid_ok=false

    # 检查 /etc/subuid
    if [[ -f /etc/subuid ]]; then
        info "当前 /etc/subuid 内容:"
        while IFS= read -r line; do
            echo "    $line"
        done < /etc/subuid

        # 需要用户名或 UID 的条目
        if grep -qE "^${CURRENT_USER}:" /etc/subuid 2>/dev/null; then
            success "/etc/subuid 包含用户名条目 (${CURRENT_USER})"
            subuid_ok=true
        fi
        if grep -qE "^${CURRENT_UID}:" /etc/subuid 2>/dev/null; then
            success "/etc/subuid 包含 UID 条目 (${CURRENT_UID})"
            subuid_ok=true
        fi
    else
        fail "/etc/subuid 文件不存在"
    fi

    if [[ -f /etc/subgid ]]; then
        info "当前 /etc/subgid 内容:"
        while IFS= read -r line; do
            echo "    $line"
        done < /etc/subgid

        if grep -qE "^${CURRENT_USER}:" /etc/subgid 2>/dev/null; then
            success "/etc/subgid 包含用户名条目 (${CURRENT_USER})"
            subgid_ok=true
        fi
        if grep -qE "^${CURRENT_UID}:" /etc/subgid 2>/dev/null; then
            success "/etc/subgid 包含 UID 条目 (${CURRENT_UID})"
            subgid_ok=true
        fi
    else
        fail "/etc/subgid 文件不存在"
    fi

    if ! $subuid_ok; then
        fail "/etc/subuid 缺少用户 ${CURRENT_USER}(UID=${CURRENT_UID}) 的条目"
        ISSUES+=("subuid")
        FIXES+=("sudo bash -c 'echo \"${CURRENT_USER}:100000:65536\" >> /etc/subuid'")
        FIXES+=("sudo bash -c 'echo \"${CURRENT_UID}:100000:65536\" >> /etc/subuid'")
    fi

    if ! $subgid_ok; then
        fail "/etc/subgid 缺少用户 ${CURRENT_USER}(GID=${CURRENT_GID}) 的条目"
        ISSUES+=("subgid")
        FIXES+=("sudo bash -c 'echo \"${CURRENT_USER}:100000:65536\" >> /etc/subgid'")
        FIXES+=("sudo bash -c 'echo \"${CURRENT_UID}:100000:65536\" >> /etc/subgid'")
    fi
}

check_newuidmap() {
    section "newuidmap / newgidmap 检查"

    for cmd in newuidmap newgidmap; do
        local cmd_path
        cmd_path=$(command -v "$cmd" 2>/dev/null || echo "")

        if [[ -z "$cmd_path" ]]; then
            fail "$cmd 未找到"
            ISSUES+=("${cmd}_missing")
            FIXES+=("sudo apt-get install -y uidmap  # Debian/Ubuntu")
            continue
        fi

        local owner group perms
        owner=$(stat -c '%U' "$cmd_path" 2>/dev/null || echo "unknown")
        group=$(stat -c '%G' "$cmd_path" 2>/dev/null || echo "unknown")
        perms=$(stat -c '%a' "$cmd_path" 2>/dev/null || echo "000")
        local has_suid=false
        [[ -u "$cmd_path" ]] && has_suid=true

        info "$cmd 路径: $cmd_path"
        info "$cmd 所属: ${owner}:${group}, 权限: ${perms}, setuid: ${has_suid}"

        # 检查 1: 必须归属于 root
        if [[ "$owner" != "root" ]]; then
            fail "$cmd 所属者是 '${owner}'，不是 'root'"
            fail "  setuid 位只有在文件归属 root 时才能提升为 root 权限"
            ISSUES+=("${cmd}_owner")
            FIXES+=("sudo chown root:root ${cmd_path}")

            # 检查系统路径是否有正确版本
            if [[ "$cmd_path" != "/usr/bin/$cmd" ]] && [[ -f "/usr/bin/$cmd" ]]; then
                local sys_owner
                sys_owner=$(stat -c '%U' "/usr/bin/$cmd" 2>/dev/null || echo "unknown")
                if [[ "$sys_owner" == "root" ]]; then
                    warn "系统路径 /usr/bin/$cmd 归属 root，可作为替代"
                    warn "  当前 PATH 导致优先使用了 $cmd_path"
                    ISSUES+=("${cmd}_path_priority")
                    FIXES+=("# 方案A: 修复当前 $cmd 的所属者")
                    FIXES+=("sudo chown root:root ${cmd_path}")
                    FIXES+=("# 方案B: 删除自定义的 $cmd，使用系统版本")
                    FIXES+=("# rm ${cmd_path}  # 确保 /usr/bin 在 PATH 中")
                fi
            fi
        else
            success "$cmd 归属于 root"
        fi

        # 检查 2: 必须有 setuid 位
        if ! $has_suid; then
            fail "$cmd 缺少 setuid 位"
            ISSUES+=("${cmd}_suid")
            FIXES+=("sudo chmod u+s ${cmd_path}")
        else
            success "$cmd 已设置 setuid 位"
        fi
    done
}

check_docker_socket() {
    section "Docker Socket 检查"

    local docker_host="${DOCKER_HOST:-}"
    
    if [[ -n "$docker_host" ]]; then
        info "DOCKER_HOST 已设置: $docker_host"
    fi

    # 检查 rootless docker socket
    local rootless_sock="$HOME/.docker/run/docker.sock"
    local xdg_sock="${XDG_RUNTIME_DIR:-/run/user/$CURRENT_UID}/docker.sock"
    local system_sock="/var/run/docker.sock"

    for sock in "$rootless_sock" "$xdg_sock" "$system_sock"; do
        if [[ -S "$sock" ]]; then
            success "Docker socket 存在: $sock"
        else
            info "Docker socket 不存在: $sock"
        fi
    done
}

check_docker_running() {
    section "Docker 服务状态"

    if docker info > /dev/null 2>&1; then
        success "Docker 正在运行"
        local docker_root
        docker_root=$(docker info 2>/dev/null | grep "Docker Root Dir" | awk '{print $NF}')
        info "Docker Root: $docker_root"
        
        local is_rootless=false
        if echo "$docker_root" | grep -q "$HOME" 2>/dev/null; then
            is_rootless=true
        fi
        info "模式: $(if $is_rootless; then echo 'Rootless'; else echo 'System (root)'; fi)"
        return 0
    fi

    fail "Docker 未在运行"

    # 检查 systemd 服务
    if systemctl --user is-enabled docker.service &>/dev/null; then
        local status
        status=$(systemctl --user is-active docker.service 2>/dev/null || echo "unknown")
        info "Rootless Docker 服务状态: $status"
        
        if [[ "$status" == "failed" ]] || [[ "$status" == "inactive" ]]; then
            info "最近日志:"
            systemctl --user status docker.service 2>&1 | tail -10 | while IFS= read -r line; do
                echo "    $line"
            done
            ISSUES+=("docker_service")
        fi
    fi

    if systemctl is-active docker.service &>/dev/null 2>&1; then
        info "系统级 Docker 正在运行"
        warn "  可设置 DOCKER_HOST=unix:///var/run/docker.sock 使用系统 Docker"
    fi

    return 1
}

# ============================================================
# 修复函数
# ============================================================

apply_fixes() {
    if [[ ${#ISSUES[@]} -eq 0 ]]; then
        echo ""
        success "所有检查通过，无需修复！"
        return 0
    fi

    echo ""
    echo -e "${YELLOW}========== 发现 ${#ISSUES[@]} 个问题 ==========${NC}"
    echo ""

    if [[ "$MODE" == "--check" ]]; then
        echo -e "${CYAN}需要执行的修复命令:${NC}"
        echo ""
        local idx=1
        for fix in "${FIXES[@]}"; do
            echo "  $idx. $fix"
            ((idx++))
        done
        echo ""
        warn "运行 'bash $0 --fix' 自动修复（需要 sudo 权限）"
        return 1
    fi

    echo -e "${CYAN}正在执行修复...${NC}"
    echo ""

    local fixed=0
    local failed=0

    for fix in "${FIXES[@]}"; do
        # 跳过注释行
        if [[ "$fix" == \#* ]]; then
            info "$fix"
            continue
        fi
        
        info "执行: $fix"
        if eval "$fix" 2>/dev/null; then
            success "已完成"
            ((fixed++))
        else
            fail "执行失败（可能需要 sudo 权限）"
            ((failed++))
        fi
    done

    echo ""
    if [[ $failed -gt 0 ]]; then
        warn "$fixed 项修复成功，$failed 项失败"
        warn "失败的修复项通常需要 sudo 权限，请联系系统管理员"
        echo ""
        echo -e "${YELLOW}手动修复命令:${NC}"
        for fix in "${FIXES[@]}"; do
            [[ "$fix" == \#* ]] && continue
            echo "  $fix"
        done
        return 1
    else
        success "所有 $fixed 项修复已完成"
    fi

    # 重启 Docker 服务
    echo ""
    info "正在重启 Docker 服务..."
    systemctl --user daemon-reload 2>/dev/null || true
    systemctl --user restart docker.service 2>/dev/null || true
    sleep 3

    if docker info > /dev/null 2>&1; then
        success "Docker 已成功启动！"
        return 0
    else
        warn "Docker 启动仍然失败，可能需要重新登录用户会话"
        warn "  执行: loginctl terminate-user ${CURRENT_USER} 然后重新 SSH 登录"
        return 1
    fi
}

# ============================================================
# 主流程
# ============================================================

main() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║   Rootless Docker 环境检查与修复工具        ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
    echo ""
    info "当前用户: ${CURRENT_USER} (UID=${CURRENT_UID}, GID=${CURRENT_GID})"
    info "运行模式: ${MODE}"

    check_os
    check_kernel_userns
    check_subuid_subgid
    check_newuidmap
    check_docker_socket
    check_docker_running || true

    apply_fixes
}

main
