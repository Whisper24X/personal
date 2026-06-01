#!/bin/bash

# 开发服务器启动脚本
# 功能: 并发启动后端和前端开发服务器,支持热重载和文件监听
# 使用方法: ./scripts/dev.sh

set -e

# 颜色输出定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 辅助函数
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_section() {
    echo -e "${CYAN}===${NC} $1 ${CYAN}===${NC}"
}

# 检查依赖
check_dependencies() {
    print_section "检查依赖"
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装,请先安装 Node.js (>= 18.0.0)"
        exit 1
    fi
    
    local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 18 ]; then
        print_error "Node.js 版本过低 (当前: $(node -v), 需要: >= 18.0.0)"
        exit 1
    fi
    print_info "Node.js 版本: $(node -v) ✓"
    
    # 检查 pnpm
    if ! command -v pnpm &> /dev/null; then
        print_error "pnpm 未安装,请先安装 pnpm (>= 8.0.0)"
        print_info "安装命令: npm install -g pnpm"
        exit 1
    fi
    print_info "pnpm 版本: $(pnpm -v) ✓"
    
    print_success "依赖检查完成"
    echo
}

# 检查项目结构
check_project_structure() {
    print_section "检查项目结构"
    
    local errors=0
    
    if [ ! -f "package.json" ]; then
        print_error "package.json 不存在"
        errors=$((errors + 1))
    fi
    
    if [ ! -d "backend" ]; then
        print_error "backend 目录不存在"
        errors=$((errors + 1))
    fi
    
    if [ ! -d "frontend" ]; then
        print_error "frontend 目录不存在"
        errors=$((errors + 1))
    fi
    
    if [ ! -d "shared" ]; then
        print_warning "shared 目录不存在"
    fi
    
    if [ $errors -gt 0 ]; then
        print_error "项目结构不完整,请在项目根目录运行此脚本"
        exit 1
    fi
    
    print_success "项目结构检查完成"
    echo
}

# 安装依赖
install_dependencies() {
    print_section "安装/检查依赖"
    
    if [ ! -d "node_modules" ] || [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
        print_info "安装项目依赖..."
        pnpm install
        print_success "依赖安装完成"
    else
        print_info "依赖已安装,跳过安装步骤"
    fi
    echo
}

# 构建 shared 包
build_shared() {
    print_section "构建 Shared 包"
    
    if [ -d "shared" ]; then
        print_info "构建 @mind2build/shared..."
        pnpm build:shared
        print_success "Shared 包构建完成"
    else
        print_warning "shared 目录不存在,跳过构建"
    fi
    echo
}

# 清理旧进程
cleanup() {
    print_info "清理旧进程..."
    
    # 查找并终止占用端口的进程
    if command -v lsof &> /dev/null; then
        # 检查后端端口 (3000)
        local backend_pid=$(lsof -ti:3000)
        if [ ! -z "$backend_pid" ]; then
            print_warning "终止占用端口 3000 的进程: $backend_pid"
            kill -9 $backend_pid 2>/dev/null || true
        fi
        
        # 检查前端端口 (5173)
        local frontend_pid=$(lsof -ti:5173)
        if [ ! -z "$frontend_pid" ]; then
            print_warning "终止占用端口 5173 的进程: $frontend_pid"
            kill -9 $frontend_pid 2>/dev/null || true
        fi
    fi
}

# 处理退出信号
handle_exit() {
    echo
    print_warning "收到退出信号,正在停止服务..."
    
    # 终止所有子进程
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    # 等待进程结束
    wait 2>/dev/null || true
    
    print_success "服务已停止"
    exit 0
}

# 注册退出信号处理
trap handle_exit SIGINT SIGTERM EXIT

# 启动开发服务器
start_dev_servers() {
    print_section "启动开发服务器"
    
    # 创建日志目录
    mkdir -p logs
    
    print_info "启动后端服务器 (端口: 3000)..."
    pnpm dev:backend > logs/dev-backend.log 2>&1 &
    BACKEND_PID=$!
    
    # 等待一下让后端先启动
    sleep 2
    
    print_info "启动前端服务器 (端口: 5173)..."
    pnpm dev:frontend > logs/dev-frontend.log 2>&1 &
    FRONTEND_PID=$!
    
    echo
    print_success "开发服务器启动完成!"
    echo
    print_info "访问地址:"
    echo -e "  ${CYAN}前端:${NC} http://localhost:5173"
    echo -e "  ${CYAN}后端:${NC} http://localhost:3000"
    echo
    print_info "日志文件:"
    echo -e "  ${CYAN}后端:${NC} logs/dev-backend.log"
    echo -e "  ${CYAN}前端:${NC} logs/dev-frontend.log"
    echo
    print_info "按 ${YELLOW}Ctrl+C${NC} 停止服务"
    echo
    print_section "实时日志输出"
    echo
    
    # 使用 tail 实时显示日志
    tail -f logs/dev-backend.log logs/dev-frontend.log 2>/dev/null &
    TAIL_PID=$!
    
    # 等待子进程
    wait
}

# 主函数
main() {
    echo
    print_section "Mind2Build 开发服务器启动器"
    echo
    
    # 检查依赖
    check_dependencies
    
    # 检查项目结构
    check_project_structure
    
    # 安装依赖
    install_dependencies
    
    # 构建 shared 包
    build_shared
    
    # 清理旧进程
    cleanup
    
    # 启动开发服务器
    start_dev_servers
}

# 运行主函数
main
