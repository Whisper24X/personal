# AINATIVE

## 快速启动

### 前置要求

- Node.js >= 20.19.0
- pnpm
- Docker & Docker Compose

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

默认模式为“从私有镜像仓库拉取镜像后启动”，其他人无需本地重新编译。
基础镜像地址已固定为 `docker.yc345.tv/devices/ainative-backend` 和 `docker.yc345.tv/devices/ainative-frontend`，默认 tag 为 `latest`。

拉取并启动所有服务：

```bash
pnpm run docker:pull   # 拉取私有镜像
pnpm run docker        # 启动 Docker 全栈环境
```

如果要拉取指定版本，可以在命令前临时指定 tag：

```bash
IMAGE_TAG=2026-03-25 pnpm run docker:pull
IMAGE_TAG=2026-03-25 pnpm run docker
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

### 3. Docker 开发模式（本地构建）

需要本地重新构建镜像时，使用开发覆盖文件：

```bash
pnpm run docker:dev      # 本地 build 后启动
pnpm run docker:build    # 仅本地构建镜像
pnpm run docker:dev:down # 停止开发模式容器
```

### 4. 发布镜像到私有仓库

发布前先登录私有仓库：

```bash
docker login docker.yc345.tv
```

统一发布前后端镜像：

```bash
pnpm run docker:release
```

这个命令会：

- 使用 `git rev-parse --short HEAD` 作为版本 tag
- 构建并推送 `docker.yc345.tv/devices/ainative-frontend:<git-sha>`
- 构建并推送 `docker.yc345.tv/devices/ainative-backend:<git-sha>`
- 同步更新两个镜像的 `latest`

如果只想单独发布某一侧：

```bash
pnpm run docker:release:frontend
pnpm run docker:release:backend
```

如果拉取刚发布的指定版本：

```bash
IMAGE_TAG=$(git rev-parse --short HEAD) pnpm run docker:pull
IMAGE_TAG=$(git rev-parse --short HEAD) pnpm run docker
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
