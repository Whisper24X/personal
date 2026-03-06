---
name: deploy-execute
description: 执行部署命令并监控进度：运行 make sandbox-restart、读取 ./logs/ 目录下的日志文件判断服务启动状态，输出日志到 deployLog.md 和结果到 deployResult.md。当需要执行 sandbox 部署、监控服务启动或记录部署日志时使用。
---

# ExecuteDeployment - 执行部署

执行实际的部署命令，通过读取日志文件监控部署进度，确保服务完全启动。

## 输出规范（强制）

> **重要**：部署日志必须写入文件，不是仅输出到终端。

| 项目         | 规范                                           |
| ------------ | ---------------------------------------------- |
| **日志文件** | `docs/deploy/deployLog.md`                     |
| **结果文件** | `docs/deploy/deployResult.md`                  |
| **结果格式** | 固定两行：第一行状态，第二行原因               |
| **状态值**   | `部署成功` / `部署失败` / `部署超时`（三选一） |

## 执行步骤

### 1. 执行重启命令

执行 `make sandbox-restart`，该命令会自动完成：

- 停止现有容器（`dc stop`）
- 清空所有日志文件（`./logs/*.log`）
- 重新启动容器并等待就绪（`dc up -d --wait`）

```bash
make sandbox-restart
```

- 如果遇到 Docker 未运行等错误，分析并解决后重试
- **不要在遇到错误时停止，必须想办法解决问题**

### 2. 发现服务列表并等待就绪

**步骤 2a：从 `sandbox/supervisord.conf` 读取服务列表**

解析项目中的 `sandbox/supervisord.conf`，找出所有 `[program:X]` 段，提取：

- 服务名（`X`）
- 对应的日志文件路径（`stdout_logfile`，路径中 `/workspace/` 对应项目根目录的 `./logs/`）

示例解析结果（以当前项目为例，实际以配置文件内容为准）：

```
nginx   → ./logs/nginx.log
backend → ./logs/backend.log
shadow  → ./logs/shadow.log
app     → ./logs/app.log
```

**步骤 2b：监控崩溃（早期检测）**

在等待就绪的过程中，同时读取 `./logs/supervisord.log`：

- 出现 `FATAL` 或 `entered EXITED state` → 对应服务崩溃，立即读取该服务日志获取错误，标记部署失败，无需等到超时

**步骤 2c：通过分析日志内容判断各服务是否真正就绪**

每隔 10 秒读取每个服务的日志文件，通过日志内容**自主判断**服务是否已完成初始化并可接受请求。无固定格式，根据实际内容分析：

- 出现端口监听信息（如 `listening on`、`running at`、`http://`、`ready`、`started` 等）→ 就绪
- 出现持续刷新的进度信息（编译中、安装依赖中）→ 仍在初始化，继续等待
- 出现明显错误（`panic`、`Fatal error`、`EADDRINUSE`、`Cannot find module`）→ 启动失败

> **注意**：部分服务的日志中可能出现非关键性的警告或错误（如容器内无显示器导致的 `spawn xdg-open ENOENT`），需结合上下文判断是否影响服务可用性，不要因单行警告误判为失败。

| 情况                           | 判定        |
| ------------------------------ | ----------- |
| supervisord.log 出现 `FATAL`   | ❌ 部署失败 |
| 所有服务日志均出现就绪信号     | ✅ 继续     |
| 600 秒内仍有服务未出现就绪信号 | ⏳ 超时     |

### 3. 检查日志中的错误关键词

读取以下日志文件，检查是否存在错误：

- `./logs/backend.log`
- `./logs/app.log`
- `./logs/shadow.log`

错误关键词：`Error`、`panic`、`Fatal`、`Exception`、`EADDRINUSE`、`Cannot find module`

如发现错误，记录相关行到部署日志。

## 结果写入

### deployLog.md

内容须包含：部署时间、执行命令、各服务 RUNNING 状态时间点、应用级别就绪时间、错误记录（如有）。

### deployResult.md

将结果写入 `docs/deploy/deployResult.md`：

#### 示例 - 部署成功

```
部署成功
所有服务已启动，backend: [::]:8000, app: http://localhost:8200
```

#### 示例 - 部署失败（服务启动失败）

```
部署失败
backend 服务进入 FATAL 状态，错误日志：panic: runtime error...
```

#### 示例 - 部署超时

```
部署超时
等待 600 秒后 app 服务仍未进入 RUNNING 状态，supervisord 最后日志：spawned 'app' with pid 10
```

## 错误处理策略

| 错误类型                    | 处理方式                                      |
| --------------------------- | --------------------------------------------- |
| Docker 服务未运行           | 执行 `sudo systemctl start docker` 启动后重试 |
| 端口被占用 (EADDRINUSE)     | 杀死占用进程后重试                            |
| 依赖缺失 (MODULE_NOT_FOUND) | 执行 `pnpm install` 后重试                    |
| 构建错误                    | 记录错误详情，标记部署失败                    |
| supervisord FATAL           | 读取对应服务日志获取详细错误                  |
| 超时（>600s）               | 标记部署超时，记录 supervisord.log 最后内容   |
