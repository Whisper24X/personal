#!/bin/bash

# 即思即成（Mind2Build）项目目录结构初始化脚本
# 功能：根据 19_目录结构设计_STRUCTURE.md 创建完整的项目目录结构

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的信息
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

# 获取项目根目录（脚本所在目录的上级目录）
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

print_info "项目根目录: $PROJECT_ROOT"

# 创建目录的函数
create_dir() {
    local dir_path="$1"
    if [ ! -d "$dir_path" ]; then
        mkdir -p "$dir_path"
        print_success "创建目录: $dir_path"
    else
        print_warning "目录已存在: $dir_path"
    fi
}

# 创建空文件的函数（用于 .gitkeep）
create_file() {
    local file_path="$1"
    if [ ! -f "$file_path" ]; then
        touch "$file_path"
        print_success "创建文件: $file_path"
    fi
}

# 开始创建目录结构
print_info "开始创建项目目录结构..."
echo ""

# ==================== 后端目录结构 ====================
print_info "创建后端目录结构..."

# 核心层
create_dir "$PROJECT_ROOT/backend/src/core/base"
create_dir "$PROJECT_ROOT/backend/src/core/message"
create_dir "$PROJECT_ROOT/backend/src/core/memory"
create_dir "$PROJECT_ROOT/backend/src/core/context"

# 角色层
create_dir "$PROJECT_ROOT/backend/src/roles"

# 行动层
create_dir "$PROJECT_ROOT/backend/src/actions"

# 提供商层
create_dir "$PROJECT_ROOT/backend/src/providers/llm"

# 工具层
create_dir "$PROJECT_ROOT/backend/src/tools"

# 编排层
create_dir "$PROJECT_ROOT/backend/src/orchestration"

# 项目管理
create_dir "$PROJECT_ROOT/backend/src/project"

# API 层
create_dir "$PROJECT_ROOT/backend/src/api/routes"
create_dir "$PROJECT_ROOT/backend/src/api/controllers"
create_dir "$PROJECT_ROOT/backend/src/api/middleware"

# 数据库层
create_dir "$PROJECT_ROOT/backend/src/database/models"
create_dir "$PROJECT_ROOT/backend/src/database/repositories"

# 工具函数
create_dir "$PROJECT_ROOT/backend/src/utils"

# 类型定义
create_dir "$PROJECT_ROOT/backend/src/types"

# 配置
create_dir "$PROJECT_ROOT/backend/src/config"

# CLI
create_dir "$PROJECT_ROOT/backend/src/cli/commands"

# 测试目录
create_dir "$PROJECT_ROOT/backend/tests/unit/core"
create_dir "$PROJECT_ROOT/backend/tests/unit/roles"
create_dir "$PROJECT_ROOT/backend/tests/unit/actions"
create_dir "$PROJECT_ROOT/backend/tests/unit/providers"
create_dir "$PROJECT_ROOT/backend/tests/integration"
create_dir "$PROJECT_ROOT/backend/tests/e2e"
create_dir "$PROJECT_ROOT/backend/tests/fixtures"
create_dir "$PROJECT_ROOT/backend/tests/mocks"

# 构建输出目录
create_dir "$PROJECT_ROOT/backend/dist"
create_file "$PROJECT_ROOT/backend/dist/.gitkeep"

print_success "后端目录结构创建完成"
echo ""

# ==================== 前端目录结构 ====================
print_info "创建前端目录结构..."

# 资源目录
create_dir "$PROJECT_ROOT/frontend/src/assets/images"
create_dir "$PROJECT_ROOT/frontend/src/assets/icons"
create_dir "$PROJECT_ROOT/frontend/src/assets/fonts"
create_dir "$PROJECT_ROOT/frontend/src/assets/styles"

# 组件目录
create_dir "$PROJECT_ROOT/frontend/src/components/common"
create_dir "$PROJECT_ROOT/frontend/src/components/layout"
create_dir "$PROJECT_ROOT/frontend/src/components/project"
create_dir "$PROJECT_ROOT/frontend/src/components/team"
create_dir "$PROJECT_ROOT/frontend/src/components/chat"

# 视图目录
create_dir "$PROJECT_ROOT/frontend/src/views"

# 路由
create_dir "$PROJECT_ROOT/frontend/src/router"

# 状态管理
create_dir "$PROJECT_ROOT/frontend/src/stores"

# API 调用
create_dir "$PROJECT_ROOT/frontend/src/api"

# 组合式函数
create_dir "$PROJECT_ROOT/frontend/src/composables"

# 工具函数
create_dir "$PROJECT_ROOT/frontend/src/utils"

# 类型定义
create_dir "$PROJECT_ROOT/frontend/src/types"

# 常量
create_dir "$PROJECT_ROOT/frontend/src/constants"

# 指令
create_dir "$PROJECT_ROOT/frontend/src/directives"

# 插件
create_dir "$PROJECT_ROOT/frontend/src/plugins"

# 公共资源
create_dir "$PROJECT_ROOT/frontend/public"

# 测试目录
create_dir "$PROJECT_ROOT/frontend/tests/unit/components"
create_dir "$PROJECT_ROOT/frontend/tests/unit/utils"
create_dir "$PROJECT_ROOT/frontend/tests/e2e/specs"

# 构建输出目录
create_dir "$PROJECT_ROOT/frontend/dist"
create_file "$PROJECT_ROOT/frontend/dist/.gitkeep"

print_success "前端目录结构创建完成"
echo ""

# ==================== 数据库目录结构 ====================
print_info "创建数据库目录结构..."

create_dir "$PROJECT_ROOT/database/prisma/migrations"
create_dir "$PROJECT_ROOT/database/schema"
create_dir "$PROJECT_ROOT/database/migrations"
create_dir "$PROJECT_ROOT/database/seeds/development"
create_dir "$PROJECT_ROOT/database/seeds/test"
create_dir "$PROJECT_ROOT/database/seeds/production"
create_dir "$PROJECT_ROOT/database/backup"
create_file "$PROJECT_ROOT/database/backup/.gitkeep"
create_dir "$PROJECT_ROOT/database/scripts"

print_success "数据库目录结构创建完成"
echo ""

# ==================== 共享代码目录 ====================
print_info "创建共享代码目录结构..."

create_dir "$PROJECT_ROOT/shared/types"
create_dir "$PROJECT_ROOT/shared/utils"
create_dir "$PROJECT_ROOT/shared/constants"

print_success "共享代码目录结构创建完成"
echo ""

# ==================== 其他目录 ====================
print_info "创建其他必要目录..."

# 配置目录
create_dir "$PROJECT_ROOT/config"

# 工作区目录
create_dir "$PROJECT_ROOT/workspace"
create_file "$PROJECT_ROOT/workspace/.gitkeep"

# 日志目录
create_dir "$PROJECT_ROOT/logs"
create_file "$PROJECT_ROOT/logs/.gitkeep"

# GitHub 配置
create_dir "$PROJECT_ROOT/.github/workflows"
create_dir "$PROJECT_ROOT/.github/ISSUE_TEMPLATE"

# VSCode 配置
create_dir "$PROJECT_ROOT/.vscode"

# Docker 配置
create_dir "$PROJECT_ROOT/docker"

print_success "其他目录创建完成"
echo ""

# ==================== 总结 ====================
echo ""
print_success "=========================================="
print_success "  项目目录结构创建完成！"
print_success "=========================================="
echo ""
print_info "下一步操作："
echo "  1. 初始化 Node.js 项目: cd backend && npm init"
echo "  2. 初始化 Vue 项目: cd frontend && npm create vite@latest ."
echo "  3. 初始化 Prisma: cd database && npx prisma init"
echo "  4. 配置环境变量: 复制 .env.example 并重命名为 .env"
echo "  5. 安装依赖: pnpm install (根目录)"
echo ""
print_info "参考文档: doc/19_目录结构设计_STRUCTURE.md"
echo ""

