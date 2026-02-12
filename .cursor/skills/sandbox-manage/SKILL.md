---
name: sandbox-manage
description: 沙箱环境管理：环境配置、端口映射、服务架构、多实例支持、故障排查。当用户提到"沙箱配置"、"sandbox"、"环境切换"、"端口映射"、"沙箱启动失败"、"沙箱故障排查"或需要管理沙箱运行环境时使用。
---

# 沙箱环境管理

沙箱是基于 Docker 的一体化开发环境，通过单一容器运行所有服务（Backend、Shadow、App QRCode、PostgreSQL、Redis、Nginx）。

## 环境体系

### 环境自动检测

环境通过本机 IP 自动判断，也可手动强制指定：

```bash
# sandbox/.env
SANDBOX_ENV=development          # 设值则跳过 IP 检测，强制使用
SANDBOX_IP_TEST=10.8.8.152      # IP 匹配则为 test
#SANDBOX_IP_STAGE=              # IP 匹配则为 stage
#SANDBOX_IP_PRODUCTION=         # IP 匹配则为 production
```

### 四环境对照

| 环境 | SANDBOX_ENV | 容器内 DB/Redis | 后端配置 | 访问域名 |
|------|-------------|----------------|----------|----------|
| 开发 | `development` | 启动 | `development.yaml` | 自动检测 IP:PORT |
| 测试 | `test` | 启动 | `test.yaml` | device-test.local.yc345.tv |
| 预发 | `stage` | 不启动 | `stage.yaml` | device-stage.local.yc345.tv |
| 生产 | `production` | 不启动 | `production.yaml` | device.local.yc345.tv |

**核心区别**：
- **development/test**：启动容器内 PostgreSQL + Redis（自包含）
- **stage/production**：不启动内部 DB/Redis，连接外部数据库（通过 yaml 配置）

## 端口架构

### 映射关系

```
外部访问（主机）          Docker 映射           容器内部（固定）
─────────────────         ──────────         ─────────────────
${SANDBOX_PORT}    ←→    -p ${PORT}:8080    ←→    Nginx :8080
(可配置,默认8070)                                      │
                                                      ├→ Backend :8000
                                                      ├→ Shadow  :8100
                                                      ├→ App     :8200
                                                      ├→ PostgreSQL :5432
                                                      └→ Redis   :6379
```

### 关键概念

- **主机端口**（`SANDBOX_PORT`）：浏览器访问入口，可配置
- **容器端口**（8080）：Nginx 网关，固定不可改
- **内部服务端口**（8000/8100/8200/5432/6379）：容器内固定

### 访问路径

```
<访问地址>/          # 沙箱首页
<访问地址>/api/      # 后端 API (→ 8000)
<访问地址>/shadow/   # 管理后台 (→ 8100)
<访问地址>/app/      # 小程序二维码页面 (→ 8200)
```

## 配置方式

### 核心配置文件：sandbox/.env

```bash
# 运行环境
SANDBOX_ENV=development

# 各环境外部访问地址（development 留空自动拼接 IP:PORT）
SANDBOX_BASE_URL_DEVELOPMENT=
SANDBOX_BASE_URL_TEST=http://device-test.local.yc345.tv
SANDBOX_BASE_URL_STAGE=http://device-stage.local.yc345.tv
SANDBOX_BASE_URL_PRODUCTION=http://device.local.yc345.tv

# Docker 端口映射（多实例时必须不同）
SANDBOX_PORT=8070

# 容器资源
SANDBOX_NAME=yanxue-main-sandbox
SANDBOX_MEMORY=8g
SANDBOX_MEMORY_MIN=2g
```

### 配置优先级（高→低）

1. 命令行环境变量：`SANDBOX_ENV=test make sandbox-restart`
2. `.env` 文件中的值
3. 默认值（8080）

## 常用命令

```bash
make sandbox              # 启动沙箱
make sandbox-restart      # 重启沙箱
make sandbox-stop         # 停止沙箱
make sandbox-clean        # 清理并删除沙箱
make sandbox-status       # 查看服务状态
make sandbox-logs         # 查看日志
make sandbox-shell        # 进入容器
./sandbox/sandbox.sh info # 查看当前环境和访问地址
```

### 临时切换环境

```bash
SANDBOX_ENV=test make sandbox-restart
SANDBOX_PORT=9000 make sandbox   # 临时使用其他端口
```

## 多实例支持

不同项目使用不同 `SANDBOX_PORT` 和 `SANDBOX_NAME`，可同时运行：

| 项目 | SANDBOX_NAME | SANDBOX_PORT |
|------|-------------|-------------|
| yanxue-main | yanxue-main-sandbox | 8070 |
| ainative-workspace | ainative-workspace-sandbox | 8080 |

验证：`docker ps --filter "name=sandbox" --format "table {{.Names}}\t{{.Ports}}"`

## 沙箱配置文件清单

| 文件 | 作用 | 可配置 |
|------|------|--------|
| `sandbox/.env` | 环境变量 | ✅ SANDBOX_ENV、SANDBOX_PORT 等 |
| `sandbox/sandbox.sh` | 管理脚本 | ✅ 读取配置并控制容器 |
| `sandbox/nginx.conf` | Nginx 主配置 | ⚠️ 容器内固定监听 8080 |
| `sandbox/supervisord.conf` | 进程管理 | ⚠️ 服务启停配置 |
| `sandbox/entrypoint.sh` | 容器启动脚本 | ⚠️ 数据库初始化逻辑 |
| `sandbox/Dockerfile` | 镜像构建 | ⚠️ EXPOSE 8080 |
| `sandbox/app-qrcode.nginx.conf` | 二维码页面 Nginx | ⚠️ 端口 8200 |
| `sandbox/app-qrcode-page.html` | 二维码展示页 | ⚠️ 静态 HTML |

## 故障排查

### 问题 1：无法访问服务

```bash
# 检查端口映射
docker port yanxue-main-sandbox
# 预期输出: 8080/tcp -> 0.0.0.0:8070

# 检查服务状态
make sandbox-status
```

### 问题 2：端口被占用

```bash
# 查找占用进程
lsof -i :8070

# 解决：停止占用进程 或 修改 SANDBOX_PORT
```

### 问题 3：环境变量未生效

```bash
# 检查实际使用的端口
docker ps | grep sandbox

# 检查 .env 配置
cat sandbox/.env | grep SANDBOX_
```

### 问题 4：数据库不存在

沙箱首次启动时 `entrypoint.sh` 会自动创建数据库。如果失败：

```bash
make sandbox-shell
su -s /bin/sh postgres -c "psql -c \"CREATE DATABASE ${DB_NAME:-postgres} OWNER ${DB_USER:-postgres};\""
```

### 问题 5：服务未启动

```bash
make sandbox-shell
supervisorctl status        # 查看所有服务状态
supervisorctl restart app-qrcode  # 重启指定服务
supervisorctl tail -f backend     # 查看服务日志
```

## 与参考项目对比

yanxue-main 与 ainative-workspace 沙箱配置差异：

| 配置项 | yanxue-main | ainative-workspace |
|--------|------------|-------------------|
| SANDBOX_PORT | 8070 | 8080 |
| DB_NAME | postgres | ainative_backend |
| 服务列表 | backend, shadow, app-qrcode | backend, shadow, app |

**注意**：yanxue-main 的 app 服务使用静态 Nginx（二维码展示页）。

## 最佳实践

1. 通过 `SANDBOX_ENV` 区分环境，切换后执行 `make sandbox-restart`
2. 为每个环境配置对应的 `SANDBOX_BASE_URL_<ENV>`
3. 多项目使用不同端口避免冲突
4. 通过 `./sandbox/sandbox.sh info` 查看当前配置
5. 修改沙箱配置后需要 `make sandbox-clean && make sandbox` 重建
