# AINATIVE

## 快速启动

### 前置要求

- Node.js >= 20.19.0
- pnpm
- Docker & Docker Compose

### 环境变量初始化

首次使用前，先在仓库根目录准备根级环境变量文件：

```bash
cp .env.example .env
```

根目录 `/.env` 主要用于：

- `docker-compose.yml` 的变量展开
- `pnpm run docker:build:runner` 等根级脚本

如需访问私有 GitLab 仓库，请将 `GITLAB_TOKEN` 改成你本地可用的值。

### 1. 开发环境（本地调试）

一键启动 PostgreSQL + Redis + 后端(NestJS watch) + 前端(Vite dev server)：

```bash
pnpm run dev:install   # 首次需要安装依赖
pnpm run dev           # 一键启动开发环境
```

也可以单独启动各部分：

```bash
pnpm run dev:backend   # 仅启动后端
pnpm run dev:frontend  # 仅启动前端
```

### 2. Docker 环境（全栈容器化）

当前 Docker 模式只支持本地构建镜像后启动。

构建并启动所有服务：

```bash
pnpm run docker        # 本地 build 后启动 Docker 全栈环境
pnpm run docker:build  # 仅本地构建镜像
```

启动后：

- 前端: [http://localhost:8000](http://localhost:8000)
- 后端: [http://localhost:9000](http://localhost:9000)

其他 Docker 命令：

```bash
pnpm run docker:down     # 停止容器
pnpm run docker:logs     # 查看日志
pnpm run docker:restart  # 重启容器
pnpm run docker:clean    # 停止并清除数据卷
```

### 所有可用命令

```bash
pnpm run               # 查看完整脚本列表
```

### 数据库迁移

当拉取到新代码包含数据库结构变更时（`backend/src/database/migrations/` 目录下有新文件），需要执行迁移命令以同步数据库：

```bash
cd backend
npm run migration:run
```

此操作仅新增或变更表结构，不会删除已有数据。已执行过的迁移会自动跳过，可重复运行。

> 执行前请确保 PostgreSQL 容器已启动（`pnpm run dev` 或 `docker compose up -d postgres`）。
