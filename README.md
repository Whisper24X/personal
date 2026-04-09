# AINATIVE

## 快速启动

### 前置要求

- Node.js >= 20.19.0
- pnpm
- Docker & Docker Compose

### 环境变量初始化

- 后端运行配置使用 `backend/.env.${NODE_ENV}`
- runner 镜像构建配置使用 `runner/.env.build`

如果需要本地构建 runner，并且镜像构建阶段要访问私有 GitLab 仓库，先准备：

```bash
cp runner/.env.build.example runner/.env.build
```

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
NODE_ENV=development pnpm run docker:up:build
NODE_ENV=development pnpm run docker:build  # 仅本地构建镜像
```

启动后：

- 前端: [http://localhost:8000](http://localhost:8000)
- 后端: [http://localhost:9000](http://localhost:9000)

其他 Docker 命令：

```bash
NODE_ENV=development pnpm run docker:down     # 停止容器
NODE_ENV=development pnpm run docker:logs     # 查看日志
NODE_ENV=development pnpm run docker:restart  # 重启容器
NODE_ENV=development pnpm run docker:clean    # 停止并清除数据卷
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
