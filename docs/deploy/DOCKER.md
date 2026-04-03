# Docker 操作文档

本文档说明 AINative 项目的本地 Docker 构建和运行方式。

## 1. 前置要求

- 已安装 Docker 和 Docker Compose
- 已安装 Node.js 和 `pnpm`

## 2. 构建并启动

Linux / macOS 默认使用 [docker-compose.yml](../../docker-compose.yml)。

Windows PowerShell 使用 [docker-compose.windows.yml](../../docker-compose.windows.yml)。

```bash
NODE_ENV=development pnpm run docker:up:build
```

`NODE_ENV` 可以通过当前 shell 提供，也可以放到仓库根目录 `/.env`。Compose 会加载 `backend/.env.${NODE_ENV}`，并将该文件中的变量注入后端容器；如果没有这个环境变量，`docker compose` 会直接报错。

后端容器默认以 `backend/.env.${NODE_ENV}` 作为配置来源，不再由 compose 覆盖 `NODE_ENV`、`DATABASE_*` 等同名变量。请确保选中的 env 文件本身就是一份可直接运行的完整配置，并且其中的地址对容器可达：

- 连接宿主机服务时，优先使用 `host.docker.internal`
- 连接 compose 内服务时，使用服务名，例如 `postgres`、`redis`

唯一保留的 compose 覆盖项是 `AINATIVE_DATA_ROOT_DIR`。这是为了让后端容器经由宿主机 `docker.sock` 启动任务容器时，bind mount 使用宿主机绝对路径。

```bash
NODE_ENV=production pnpm run docker:up:build
NODE_ENV=local pnpm run docker:up:build
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
NODE_ENV=development pnpm run docker:build
```

如果要重建并启动：

```bash
NODE_ENV=development pnpm run docker:up:build
```

同样支持通过 `NODE_ENV` 选择对应的后端配置文件：

```bash
NODE_ENV=test pnpm run docker:build
```

Windows PowerShell:

```powershell
$env:NODE_ENV = "development"
pnpm run docker:up:build:windows
```

如果只想预先构建镜像：

```powershell
$env:NODE_ENV = "development"
pnpm run docker:build:windows
```

## 3. 常用运行命令

```bash
pnpm run docker:down
pnpm run docker:logs
pnpm run docker:restart
pnpm run docker:clean
```

Windows PowerShell:

```powershell
pnpm run docker:down:windows
pnpm run docker:logs:windows
pnpm run docker:restart:windows
pnpm run docker:clean:windows
```

说明：

- `docker:down`：停止容器
- `docker:logs`：查看容器日志
- `docker:restart`：重启容器
- `docker:clean`：停止容器并删除卷

## 4. GitLab Token 使用说明

后端镜像本身已经不再依赖 `GITLAB_USERNAME` / `GITLAB_TOKEN` 才能完成构建。它们现在主要用于两类场景：

- 构建 `ainative/runner:latest`
- backend 运行时需要把 GitLab SSH remote 转成带 HTTP token 的私有仓库访问地址

推荐把下面这些变量放到仓库根目录 `/.env`，这样 `docker compose` 和 `pnpm run docker:build:runner` 都能直接复用：

```dotenv
NODE_ENV=development
GITLAB_USERNAME=oauth2
GITLAB_TOKEN=your_gitlab_token
```

如果你不构建 runner，也不需要 backend 访问私有 GitLab HTTP 仓库，可以不设置 `GITLAB_TOKEN`。

也可以不写文件，继续只在当前 shell 中设置以下环境变量：

- `GITLAB_USERNAME`
- `GITLAB_TOKEN`

推荐约定：

- 使用 Personal Access Token 时，`GITLAB_USERNAME=oauth2`
- 使用 Deploy Token 时，`GITLAB_USERNAME` 使用 GitLab 提供的 deploy token 用户名
- `GITLAB_TOKEN` 至少需要具备私有依赖仓库的读取权限，通常为 `read_repository`

Linux / macOS:

```bash
export GITLAB_USERNAME=oauth2
export GITLAB_TOKEN=your_gitlab_token
NODE_ENV=development pnpm run docker:build:runner
```

Windows PowerShell:

```powershell
$env:GITLAB_USERNAME = "oauth2"
$env:GITLAB_TOKEN = "your_gitlab_token"
pnpm run docker:build:runner:windows
```

## 5. Runner 镜像构建

`docker compose` 默认不会帮你构建 `ainative/runner:latest`。这个镜像会在 backend 或本地 CLI 需要拉起任务容器时单独使用，所以需要预先构建一次。

Linux / macOS:

```bash
# 如果仓库根目录已经有 .env，可直接执行
pnpm run docker:build:runner
```

Windows PowerShell:

```powershell
pnpm run docker:build:runner:windows
```

默认镜像名是 `ainative/runner:latest`。如果构建成功，`ainative runner up` 和后端的 Docker 任务执行模式都会直接复用这张镜像。若 `/.env` 里 `GITLAB_TOKEN` 为空，runner 构建会直接报缺失，避免拿模板值去尝试拉私有依赖。

## 6. Windows 说明

- `docker-compose.windows.yml` 仅面向 Docker Desktop 的 Linux containers 模式。
- 该文件将 `AINATIVE_DATA_ROOT_DIR` 固定为容器内路径 `/usr/src/tmp`，避免 PowerShell 下 `${PWD}` 展开后的 Windows 盘符路径触发 `too many colons`。
- 如果后端后续需要把容器内工作目录再次透传给宿主机 Docker 做 bind mount，Windows 原生路径语义仍可能与 Linux 版不一致；这种场景优先使用 WSL2 运行 Compose。

## 7. 常见问题

### 7.1 Runner 镜像构建失败

优先检查：

- 当前 shell 是否已设置 `GITLAB_USERNAME` 和 `GITLAB_TOKEN`
- 仓库根目录 `/.env` 是否存在，且包含真实的 `GITLAB_USERNAME` / `GITLAB_TOKEN`
- Personal Access Token 是否配合 `GITLAB_USERNAME=oauth2`
- Deploy Token 是否使用了 GitLab 提供的专用用户名
- Token 是否具备私有依赖仓库的读取权限
- 构建机是否具备访问 `gitlab.yc345.tv` 的网络权限

### 7.2 Runner 镜像不存在

如果后端或 CLI 提示找不到 `ainative/runner:latest`，先在仓库根目录执行：

```bash
pnpm run docker:build:runner
```

Windows 使用：

```powershell
pnpm run docker:build:runner:windows
```
