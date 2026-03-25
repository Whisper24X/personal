# Docker 操作文档

本文档说明 AINative 项目的 Docker 构建、发布、拉取和运行方式。

## 1. 镜像地址

- 前端镜像：`docker.yc345.tv/devices/ainative-frontend`
- 后端镜像：`docker.yc345.tv/devices/ainative-backend`

默认运行时拉取 `latest`，也可以通过 `IMAGE_TAG` 指定具体版本。

## 2. 前置要求

- 已安装 Docker 和 Docker Compose
- 已安装 Node.js 和 `pnpm`
- 已有私有仓库 `docker.yc345.tv` 的登录权限

登录私有仓库：

```bash
docker login docker.yc345.tv
```

## 3. 发布镜像

### 3.1 发布前后端

```bash
pnpm run docker:release
```

该命令会执行以下流程：

1. 读取当前仓库的 `git commit short sha`
2. 构建前端镜像 `docker.yc345.tv/devices/ainative-frontend:<git-sha>`
3. 构建后端镜像 `docker.yc345.tv/devices/ainative-backend:<git-sha>`
4. 推送上述两个版本镜像
5. 同步推送两个镜像的 `latest`

### 3.2 仅发布前端

```bash
pnpm run docker:release:frontend
```

### 3.3 仅发布后端

```bash
pnpm run docker:release:backend
```

### 3.4 指定版本 tag

默认 tag 为：

```bash
git rev-parse --short HEAD
```

如果需要手动指定 tag，可在命令前覆盖 `IMAGE_TAG`：

```bash
IMAGE_TAG=20260325-abcd123 pnpm run docker:release
```

### 3.5 不同步推送 latest

发布脚本默认会同步推送 `latest`。如果只想推版本 tag，不更新 `latest`：

```bash
PUSH_LATEST=0 pnpm run docker:release
```

## 4. 拉取并运行已发布镜像

### 4.1 拉取 latest 并启动

```bash
pnpm run docker:pull
pnpm run docker
```

对应镜像来源见 [docker-compose.yml](./docker-compose.yml)。

### 4.2 拉取指定版本并启动

```bash
IMAGE_TAG=abcd123 pnpm run docker:pull
IMAGE_TAG=abcd123 pnpm run docker
```

### 4.3 常用运行命令

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

## 5. 本地开发镜像模式

默认 `docker-compose.yml` 面向已发布镜像运行。

如果需要在本地重新构建镜像，请使用开发覆盖文件 [docker-compose.dev.yml](./docker-compose.dev.yml)：

```bash
pnpm run docker:build
pnpm run docker:dev
pnpm run docker:dev:down
```

说明：

- `docker:build`：本地构建前后端镜像
- `docker:dev`：本地构建后启动
- `docker:dev:down`：停止开发模式容器

## 6. 发布脚本说明

发布脚本位于 [scripts/docker-release.sh](./scripts/docker-release.sh)。

脚本当前逻辑如下：

- 仓库地址固定为 `docker.yc345.tv`
- 命名空间固定为 `devices`
- 前端仓库名固定为 `ainative-frontend`
- 后端仓库名固定为 `ainative-backend`
- 默认 tag 为 `git rev-parse --short HEAD`

## 7. 后端镜像构建注意事项

后端镜像构建依赖以下文件：

- `backend/ssh/id_rsa`
- `backend/ssh/known_hosts`

如果缺少这些文件，`pnpm run docker:release` 在构建后端镜像时会直接失败。

## 8. 常见问题

### 8.1 `docker login` 或 `docker push` 失败

检查是否已登录正确仓库：

```bash
docker login docker.yc345.tv
```

同时确认当前账号对 `devices/ainative-frontend` 和 `devices/ainative-backend` 有推送权限。

### 8.2 指定版本拉取失败

先确认该 tag 是否已经发布过，例如：

```bash
IMAGE_TAG=$(git rev-parse --short HEAD) pnpm run docker:pull
```

如果仓库中没有该 tag，拉取会失败。

### 8.3 后端镜像构建失败

优先检查：

- `backend/ssh/id_rsa` 是否存在
- `backend/ssh/known_hosts` 是否存在
- 构建机是否具备访问私有依赖仓库的权限
