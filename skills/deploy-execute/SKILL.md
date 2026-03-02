---
name: deploy-execute
description: 执行部署命令并监控进度：停止旧服务、运行 make sandbox（或等效命令）、等待服务就绪，输出日志到 deployLog.md 和结果到 deployResult.md。当需要执行 sandbox 部署、监控服务启动或记录部署日志时使用。
---

# ExecuteDeployment - 执行部署

执行实际的部署命令，监控部署进度，确保服务完全启动。

## 输出规范（强制）

> **重要**：部署日志必须写入文件，不是仅输出到终端。

| 项目         | 规范                                           |
| ------------ | ---------------------------------------------- |
| **日志文件** | `docs/deploy/deployLog.md`                     |
| **结果文件** | `docs/deploy/deployResult.md`                  |
| **结果格式** | 固定两行：第一行状态，第二行原因               |
| **状态值**   | `部署成功` / `部署失败` / `部署超时`（三选一） |

## 执行步骤

### 1. 执行部署命令

**部署命令选择**：

| 条件                              | 命令                       |
| --------------------------------- | -------------------------- |
| 有 Makefile 且包含 `sandbox` 目标 | `make sandbox`             |
| 有 `docker-compose.yml`           | `docker compose up -d`     |
| 有 npm `start` 或 `dev` 脚本      | `npm run dev` / `pnpm dev` |
| 其他                              | 根据项目实际情况判断       |

**执行流程**：

1. **停止现有服务**（确保干净环境）
   - 执行 `make sandbox-stop`（无论服务是否在运行都执行此命令）
   - 等待停止命令执行完成

2. **启动服务**
   - 执行 `make sandbox` 或等效部署命令
   - 如果遇到任何部署错误，必须分析并解决问题，重新执行直到成功
   - **不要在遇到错误时停止，必须想办法解决问题**

### 2. 监控部署进度

**日志分析要求**：

需要分析日志输出，判断服务是否真正启动完成：

1. **观察日志输出**：识别服务启动的关键标志
2. **不要提前判断**：不要仅看到容器启动的消息就认为服务完成
3. **等待应用就绪**：需要等到实际的应用服务器启动并输出访问地址

**服务就绪判断标准**：

| 标志类型     | 示例                               | 状态    |
| ------------ | ---------------------------------- | ------- |
| 访问地址出现 | `Local: http://localhost:3000`     | ✅ 就绪 |
| Ready 状态   | `ready in 500ms`、`Server started` | ✅ 就绪 |
| 容器启动     | `Container xxx Started`            | ⏳ 等待 |
| 编译中       | `Compiling...`、`Building...`      | ⏳ 等待 |
| 错误         | `Error`、`Failed`、`EADDRINUSE`    | ❌ 失败 |

**等待策略**：

- 不同项目的日志格式不同，需要根据实际输出灵活判断
- 关键是确保应用服务器已完全启动并可以对外提供服务
- 如果日志输出停止且没有错误信息，可以尝试访问服务地址验证是否可用
- **必须等到 vite dev server 完全启动（看到 "ready in XXXms."）才能继续**

### 3. 输出部署日志

**日志文件** `docs/deploy/deployLog.md` 的完整格式见 [templates.md](templates.md)。

日志内容须包含：部署时间、执行命令、执行耗时、停止服务输出、启动服务输出、服务启动状态表（服务名/状态/访问地址/耗时）、错误记录（如有）。

**网络 IP 识别（用于网络访问）**：

在写入 deployLog.md 前，执行以下任一命令获取**本机真实局域网 IP**，用于填充「网络访问」行：

- Linux：`hostname -I | awk '{print $1}'` 或 `ip route get 1 2>/dev/null | awk '{print $7;exit}'`
- macOS：`ipconfig getifaddr en0`（根据实际网卡如 en1、en0 调整）

将识别到的 IP 记为 `<本机IP>`，仅用于「网络访问」行。

**提取访问地址（严格规则）**：

访问地址**只能**从以下两个来源提取，**禁止**从任何其他来源推断：

**来源1：`make sandbox` 命令的终端输出**

`sandbox.sh start` 执行结束时会打印如下格式的访问地址：

```
访问地址:
  统一入口:    http://localhost:${SANDBOX_PORT}/ 或 http://10.8.8.152:${SANDBOX_PORT}/
  后端 API:    http://localhost:${SANDBOX_PORT}/api/ 或 http://10.8.8.152:${SANDBOX_PORT}/api/
  管理后台:    http://localhost:${SANDBOX_PORT}/shadow/ 或 http://10.8.8.152:${SANDBOX_PORT}/shadow/
  移动端 H5:   http://localhost:${SANDBOX_PORT}/app/ 或 http://10.8.8.152:${SANDBOX_PORT}/app/
  网络访问:    http://<本机IP>:${SANDBOX_PORT}/ （局域网内其他设备可访问）
```

直接从这段输出中提取 `http://localhost:[端口]/[路径]` 格式的地址；「网络访问」行用上一步识别的 `<本机IP>` 单独补充。

**来源2：`sandbox/.env` 配置文件**

如果命令输出中没有打印访问地址（如容器已在运行时输出跳过了 info），读取 `sandbox/.env` 获取 `SANDBOX_PORT`（默认 `8080`），按以下固定格式构造：

- 统一入口：`http://localhost:${SANDBOX_PORT}/ 或 http://10.8.8.152:${SANDBOX_PORT}/`
- 后端 API：`http://localhost:${SANDBOX_PORT}/api/ 或 http://10.8.8.152:${SANDBOX_PORT}/api/`
- 管理后台：`http://localhost:${SANDBOX_PORT}/shadow/ 或 http://10.8.8.152:${SANDBOX_PORT}/shadow/`
- 移动端 H5：`http://localhost:${SANDBOX_PORT}/app/ 或 http://10.8.8.152:${SANDBOX_PORT}/app/`
- 网络访问：`http://<本机IP>:${SANDBOX_PORT}/ （局域网内其他设备可访问）`

**严格禁止**：

- ❌ 读取任何 nginx 配置文件（`nginx.conf`、`/etc/nginx/` 等）
- ❌ 使用 nginx `server_name` 中的域名作为访问地址
- ❌ 执行 `nginx -T`、`hostname` 或任何 OS 网络发现命令
- ❌ 从项目目录结构或 docs 文档中"推断"访问地址
- ❌ 使用 `localhost` 以外的主机名（`sandbox/.env` 中未显式配置时）

**例外**：为获取「网络访问」行的本机 IP，执行 `hostname -I`、`ip route get`、`ipconfig getifaddr` 等命令是**允许**的。

记录服务启动状态（运行中/未启动/启动失败），只记录实际存在的服务。

## 结果写入

将结果写入 `docs/deploy/deployResult.md`：

### 示例 - 部署成功

```
部署成功
所有服务已启动，frontend: http://localhost:5173, backend: http://localhost:3000
```

### 示例 - 部署失败（Docker 配置错误）

```
部署失败
Docker 启动失败：Docker 服务未运行或配置错误。请执行 `sudo systemctl start docker` 启动服务后重试。

详细错误信息请查看 deployLog.md
```

### 示例 - 部署失败（服务启动失败）

```
部署失败
后端服务启动失败：Error: Cannot find module 'express'。前端服务正常启动。
```

### 示例 - 部署超时

```
部署超时
等待 600 秒后服务仍未就绪，最后日志：Compiling TypeScript...
```

## 错误处理策略

| 错误类型                    | 处理方式                                      |
| --------------------------- | --------------------------------------------- |
| 端口被占用 (EADDRINUSE)     | 杀死占用进程后重试                            |
| 依赖缺失 (MODULE_NOT_FOUND) | 执行 `pnpm install` 后重试                    |
| 构建错误                    | 记录错误详情，标记部署失败                    |
| Docker 服务未运行           | 执行 `sudo systemctl start docker` 启动后重试 |
| Docker 容器启动失败         | 检查容器日志 (`docker logs`)，记录错误详情    |
| 超时（>600s）               | 标记部署超时，记录最后日志                    |

**Docker 错误详细处理**：

1. **Docker 服务未运行**

   ```bash
   sudo systemctl start docker
   # 等待 3-5 秒后验证
   sudo systemctl status docker
   ```

2. **Docker 容器启动失败**
   ```bash
   # 查看容器列表
   docker ps -a
   # 查看失败容器的日志
   docker logs <container_id>
   ```
