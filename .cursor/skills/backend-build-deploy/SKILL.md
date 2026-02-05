---
name: backend-build-deploy
description: ainative-backend Go 后端编译打包部署。支持本地构建、Docker 镜像构建、Kubernetes 部署（test/stage/production）。当用户提到"后端构建"、"后端部署"、"backend 打包"、"编译后端"或需要部署后端服务时使用。
---

# ainative-backend 后端构建部署

ainative-backend 是基于 Kratos 框架的 Go 后端服务，支持 gRPC 和 HTTP 双协议。

## 快速开始

根据用户需求选择对应操作：

| 操作 | 使用场景 |
|------|---------|
| 本地构建 | 开发调试、本地运行 |
| Docker 镜像构建 | 容器化部署准备 |
| K8s 部署 | 自动化部署到集群 |

## 操作 1: 本地构建

用于本地开发和调试，生成可执行二进制文件。

### 构建命令

```bash
# 进入项目目录
cd ainative-backend

# 使用 Makefile 构建
make build
```

### 构建过程

1. 执行 `go mod tidy` 同步依赖
2. 使用 `go build` 编译代码
3. 生成二进制文件到 `bin/` 目录

### 构建参数

- `GOPROXY`: `https://goproxy.cn,direct`
- `GOPRIVATE`: `gitlab.yc345.tv/*`
- 编译选项：`-ldflags '-w -s -extldflags "-static" -X main.Version=$(VERSION)'`
- 构建标签：`-tags musl`（静态编译）

### 构建产物

```bash
ainative-backend/bin/yanxue    # 主服务二进制文件
```

### 本地运行

```bash
cd ainative-backend
./bin/yanxue -conf ./configs
```

## 操作 2: Docker 镜像构建

构建容器镜像用于部署到 Kubernetes 集群。

### Dockerfile 说明

项目使用多阶段构建：

1. **构建阶段**：使用 `golang:1.23.7-alpine3.20-base`
   - 执行 `make build` 编译代码
   - 使用缓存加速依赖下载

2. **运行阶段**：使用 `alpine-timezone:3.15`
   - 复制二进制文件和配置
   - 暴露端口：9000（gRPC）、8000（HTTP）

### 手动构建镜像

```bash
cd ainative-backend

# 构建镜像
docker build -t yanxue:latest .

# 带 SSH 密钥（访问私有仓库）
docker build \
  --build-arg SSH_PRIVATE_KEY="$(cat ~/.ssh/id_rsa)" \
  -t yanxue:latest .
```

### 镜像标签规范

- 测试环境：`docker.yc345.tv/7to12/yanxue:test-{SHORT_SHA}`
- 预发环境：`docker.yc345.tv/7to12/yanxue:stage-{SHORT_SHA}`
- 生产环境：`docker.yc345.tv/7to12/yanxue:{VERSION_TAG}`

## 操作 3: GitLab CI/CD 自动部署

项目已配置完整的 CI/CD 流程，推送代码即可自动部署。

### 部署流程

#### 测试环境（test 分支）

```yaml
触发条件: 推送到 test 分支
流程:
  1. 镜像构建 - 使用 Docker 构建镜像
  2. 容器发布 - 更新 K8s deployment
  3. 状态检查 - 等待 rollout 完成
```

部署命令：

```bash
# 切换到 test 分支
git checkout test

# 合并代码并推送
git merge feature-branch
git push origin test
```

#### 预发环境（stage 分支）

```yaml
触发条件: 推送到 stage 分支
流程:
  1. 镜像构建
  2. 容器发布（火山云集群）
  3. 状态检查
```

部署命令：

```bash
git checkout stage
git merge test
git push origin stage
```

#### 生产环境（版本标签）

```yaml
触发条件: 推送版本标签（v1.2.3）
流程:
  1. 镜像构建（带版本号）
  2. 手动部署到生产环境
```

部署命令：

```bash
# 创建版本标签
git tag v1.2.3
git push origin v1.2.3
```

### CI/CD 环境变量

GitLab CI 使用以下环境变量（已在 GitLab 配置）：

| 变量 | 说明 |
|------|------|
| `DOCKER_REGISTRY` | Harbor 镜像仓库地址 |
| `DOCKER_USERNAME` | Docker 登录用户名 |
| `DOCKER_PASSWORD` | Docker 登录密码 |
| `KUBE_HOST_TEST` | 测试环境 K8s API |
| `KUBE_TOKEN_TEST` | 测试环境访问令牌 |
| `KUBE_HOST_STAGE_VOLCENGINE` | 预发环境 K8s API |
| `KUBE_TOKEN_STAGE_VOLCENGINE` | 预发环境访问令牌 |
| `PRIVATE_KEY` | Git SSH 私钥 |

## 部署回滚

### 测试环境回滚

GitLab CI 提供手动回滚按钮：

```
【测试环境】容器回滚 - 点击 Run 执行
```

或命令行回滚：

```bash
kubectl config use-context testenv
kubectl -n 7to12 rollout undo deployment yanxue
```

### 预发环境回滚

```bash
kubectl config use-context stagenv
kubectl -n 7to12 rollout undo deployment yanxue
```

## 查看部署状态

### 方式 1: Rancher UI

访问 https://rancher.yc345.tv/

1. 选择对应集群
2. 进入 `7to12` 命名空间
3. 查看 `yanxue` deployment

### 方式 2: kubectl 命令

```bash
# 查看 Pod 状态
kubectl -n 7to12 get pods

# 查看 deployment
kubectl -n 7to12 get deployment yanxue

# 查看部署历史
kubectl -n 7to12 rollout history deployment yanxue

# 查看实时日志
kubectl -n 7to12 logs -f deployment/yanxue
```

## 常见问题处理

### 问题 1: 编译失败

```
错误: build failed
```

**解决**：
1. 检查代码语法错误
2. 执行 `go mod tidy` 同步依赖
3. 确认 Go 版本：`go version`（需要 1.23+）

### 问题 2: Docker 构建失败

```
错误: failed to fetch git repository
```

**解决**：
1. 检查 SSH 私钥配置
2. 确认能访问 `gitlab.yc345.tv`
3. 验证 `.ssh/id_rsa` 文件权限：600

### 问题 3: K8s 部署失败

```
错误: deployment "yanxue" not found
```

**解决**：
1. 确认 deployment 存在：`kubectl -n 7to12 get deployment`
2. 检查命名空间是否正确
3. 验证 RBAC 权限

### 问题 4: Pod 启动失败

```
状态: CrashLoopBackOff
```

**解决**：
1. 查看日志：`kubectl -n 7to12 logs deployment/yanxue`
2. 检查配置文件：`/src/configs`
3. 验证数据库连接
4. 检查依赖服务（Redis、PostgreSQL）

## Makefile 常用命令

| 命令 | 说明 |
|------|------|
| `make build` | 编译生成二进制 |
| `make api` | 生成 Proto 代码 |
| `make wire` | 生成依赖注入代码 |
| `make lint` | 代码质量检查 |
| `make gosec` | 安全扫描 |
| `make gorm TABLES=xxx` | 生成 GORM 代码 |
| `make sqltopb TABLES=xxx` | 表转 Proto |

## 版本管理

### 创建新版本

使用 Makefile 自动创建 release 分支：

```bash
# 基于 master 最新 tag 创建新版本
make new-release-branch

# 示例：当前最新 tag 为 v1.2.3
# 将自动创建 release/v1.2.4 分支
```

### 版本号规范

遵循语义化版本：`v{major}.{minor}.{patch}`

- `major`：重大更新、不兼容变更
- `minor`：新功能、向后兼容
- `patch`：Bug 修复、小优化

## 项目结构

```
ainative-backend/
├── cmd/                    # 主程序入口
├── internal/               # 内部代码
│   ├── biz/               # 业务逻辑层
│   ├── data/              # 数据访问层
│   ├── service/           # 服务层
│   └── server/            # 服务器配置
├── api/                    # Proto 定义和生成代码
├── configs/                # 配置文件
├── bin/                    # 构建产物
├── Dockerfile              # Docker 构建文件
├── Makefile                # 构建脚本
└── .gitlab-ci.yml         # CI/CD 配置
```

## 相关文档

- [Kratos 框架文档](https://go-kratos.dev/)
- [GitLab CI 配置文档](https://guanghe.feishu.cn/docs/doccn7x1etOkjKfKZL9mwQjtpzf)
- [Harbor 镜像仓库](https://docker.yc345.tv/harbor/projects/5/repositories)
- [Rancher 管理界面](https://rancher.yc345.tv/)
- backend-dev skill: 后端开发完整流程
- backend-quality skill: 代码质量检查

## 注意事项

1. **SSH 密钥**：构建镜像需要访问私有 Git 仓库
2. **环境隔离**：test/stage/production 使用不同配置
3. **版本标签**：生产环境使用版本标签触发
4. **数据库迁移**：部署前确认数据库表结构已更新
5. **依赖检查**：确认 Redis、PostgreSQL 等依赖服务正常
6. **配置更新**：修改 `configs/` 需要重新部署
