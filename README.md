# AINATIVE

## 快速启动

### 前置要求

- Node.js >= 20.19.0
- pnpm
- Docker & Docker Compose

### 1. 开发环境（本地调试）

一键启动 PostgreSQL + Redis + 后端(NestJS watch) + 前端(Vite dev server)：

```bash
pnpm run install:all   # 首次需要安装依赖
pnpm run dev           # 一键启动开发环境
```

也可以单独启动各部分：

```bash
pnpm run dev:backend   # 仅启动后端
pnpm run dev:frontend  # 仅启动前端
```

### 2. Docker 环境（全栈容器化）

一键构建并启动所有服务：

```bash
pnpm run docker        # 一键启动 Docker 全栈环境
```

启动后：
- 前端: http://localhost:8000
- 后端: http://localhost:9000

其他 Docker 命令：

```bash
pnpm run docker:build   # 构建镜像
pnpm run docker:down    # 停止容器
pnpm run docker:logs    # 查看日志
pnpm run docker:restart # 重启容器
pnpm run docker:clean   # 停止并清除数据卷
```

### 所有可用命令

```bash
pnpm run               # 查看完整脚本列表
```