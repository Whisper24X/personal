# Docker 操作文档

本文档说明 AINative 项目的本地 Docker 构建和运行方式。

## 1. 前置要求

- 已安装 Docker 和 Docker Compose
- 已安装 Node.js 和 `pnpm`

## 2. 构建并启动

项目统一使用 [docker-compose.yml](./docker-compose.yml) 进行本地构建和运行。

```bash
pnpm run docker
```

该命令会执行：

1. 基于本地源码构建前端镜像
2. 基于本地源码构建后端镜像
3. 启动前后端容器

启动后：

- 前端: [http://localhost:8000](http://localhost:8000)
- 后端: [http://localhost:9000](http://localhost:9000)

如果只想预先构建镜像：

```bash
pnpm run docker:build
```

## 3. 常用运行命令

```bash
pnpm run docker:down
pnpm run docker:logs
pnpm run docker:restart
pnpm run docker:clean
```

说明：

- `docker:down`：停止容器
- `docker:logs`：查看容器日志
- `docker:restart`：重启容器
- `docker:clean`：停止容器并删除卷

## 4. 后端镜像构建注意事项

后端镜像构建依赖以下文件：

- `backend/ssh/id_rsa`
- `backend/ssh/known_hosts`

如果缺少这些文件，后端镜像构建会直接失败。

## 5. 常见问题

### 5.1 后端镜像构建失败

优先检查：

- `backend/ssh/id_rsa` 是否存在
- `backend/ssh/known_hosts` 是否存在
- 构建机是否具备访问私有依赖仓库的权限
