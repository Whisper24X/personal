# 即思即成（Mind2Build）脚本工具集

本目录包含项目开发、构建、测试和部署所需的各种脚本工具。

---

## 📁 脚本列表

### 1. setup-structure.sh

**功能**: 自动创建完整的项目目录结构

**用途**: 
- 快速初始化项目目录
- 按照 `19_目录结构设计_STRUCTURE.md` 创建标准目录结构
- 适用于项目初始化阶段

**使用方法**:
```bash
# 在项目根目录执行
./scripts/setup-structure.sh
```

**输出内容**:
- ✅ 后端目录结构（backend/）
- ✅ 前端目录结构（frontend/）
- ✅ 数据库目录结构（database/）
- ✅ 共享代码目录（shared/）
- ✅ 配置、日志、工作区等辅助目录

**执行后的下一步**:
```bash
# 1. 初始化后端项目
cd backend
npm init -y
npm install express typescript @types/express @types/node

# 2. 初始化前端项目
cd frontend
npm create vite@latest . -- --template vue-ts

# 3. 初始化数据库
cd database
npx prisma init

# 4. 安装根依赖（monorepo）
cd ..
npm install -D concurrently pnpm
```

---

## 🚀 待添加的脚本

以下脚本将在后续开发中添加：

### setup.sh
**功能**: 完整的开发环境初始化
- 安装所有依赖
- 配置数据库
- 生成配置文件
- 检查环境要求

### build.sh
**功能**: 构建项目
- 构建后端（TypeScript → JavaScript）
- 构建前端（Vue → 静态文件）
- 生成生产环境文件

### test.sh
**功能**: 运行所有测试
- 后端单元测试
- 前端单元测试
- 集成测试
- E2E 测试

### deploy.sh
**功能**: 部署到生产环境
- 构建项目
- 上传到服务器
- 启动服务
- 健康检查

### db-migrate.sh
**功能**: 数据库迁移
- 执行 Prisma 迁移
- 更新数据库模式
- 备份数据

### db-seed.sh
**功能**: 插入种子数据
- 开发环境数据
- 测试数据
- 初始化数据

### db-backup.sh
**功能**: 数据库备份
- 导出数据库
- 压缩备份文件
- 上传到备份存储

### db-restore.sh
**功能**: 数据库恢复
- 从备份恢复数据
- 验证数据完整性

### lint.sh
**功能**: 代码质量检查
- ESLint 检查
- TypeScript 类型检查
- Prettier 格式检查

### dev.sh
**功能**: 启动开发服务器
- 并发启动后端和前端
- 监听文件变化
- 热重载

---

## 📝 脚本开发规范

### 命名规范
- 使用小写字母和连字符（kebab-case）
- 文件扩展名：`.sh`（Bash 脚本）
- 示例：`setup-structure.sh`, `db-backup.sh`

### 脚本结构
```bash
#!/bin/bash

# 脚本说明
# 功能：XXX

set -e  # 遇到错误立即退出

# 颜色输出定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# 主逻辑
main() {
    print_info "开始执行..."
    # 具体逻辑
    print_success "执行完成"
}

# 执行主函数
main "$@"
```

### 编码规范
1. **错误处理**: 使用 `set -e` 确保错误时退出
2. **路径处理**: 使用绝对路径或相对于脚本的路径
3. **输出提示**: 使用带颜色的输出便于识别
4. **参数验证**: 检查必要的参数和环境变量
5. **注释说明**: 在复杂逻辑处添加注释

### 可执行权限
所有脚本都需要添加可执行权限：
```bash
chmod +x scripts/*.sh
```

---

## 🔧 环境要求

### 必需工具
- **Bash**: 4.0+
- **Node.js**: 18+
- **npm/pnpm**: 最新版本
- **Git**: 2.0+

### 可选工具
- **Docker**: 容器化部署
- **PostgreSQL**: 数据库（如果本地运行）

---

## 💡 使用建议

1. **首次使用**: 先运行 `setup-structure.sh` 创建目录结构
2. **开发阶段**: 使用 `dev.sh` 启动开发服务器
3. **提交前**: 运行 `lint.sh` 和 `test.sh` 检查代码
4. **部署前**: 运行 `build.sh` 构建项目
5. **数据备份**: 定期运行 `db-backup.sh` 备份数据

---

## 📖 参考文档

- [19_目录结构设计_STRUCTURE.md](../doc/19_目录结构设计_STRUCTURE.md) - 目录结构设计
- [14_开发指南_DEVELOPMENT.md](../doc/14_开发指南_DEVELOPMENT.md) - 开发指南
- [15_部署指南_DEPLOYMENT.md](../doc/15_部署指南_DEPLOYMENT.md) - 部署指南

---

## ⚠️ 注意事项

1. **权限问题**: 某些脚本可能需要 sudo 权限
2. **路径问题**: 建议在项目根目录执行脚本
3. **备份数据**: 执行数据库相关脚本前请先备份
4. **环境变量**: 确保必要的环境变量已配置（如 `.env` 文件）

---

## 🤝 贡献指南

如果你想添加新的脚本工具：

1. 遵循上述命名和编码规范
2. 在本 README 中添加脚本说明
3. 编写清晰的注释和帮助信息
4. 测试脚本在不同环境下的兼容性

---

**维护者**: Mind2Build Team  
**最后更新**: 2025-12-25

