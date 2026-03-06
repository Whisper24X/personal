---
name: deploy-execute
description: 执行部署命令并监控进度：运行 make sandbox-restart、读取 ./logs/ 目录下的日志文件判断服务启动状态，发现错误立即修复并重启，输出日志到 deployLog.md 和结果到 deployResult.md。当需要执行 sandbox 部署、监控服务启动或记录部署日志时使用。
---

# ExecuteDeployment - 执行部署

执行实际的部署命令，通过读取日志文件监控部署进度，**发现错误立即修复后重启**，确保服务完全启动。

## 输出规范（强制）

> **重要**：部署日志必须写入文件，不是仅输出到终端。

| 项目         | 规范                                           |
| ------------ | ---------------------------------------------- |
| **日志文件** | `docs/deploy/deployLog.md`                     |
| **结果文件** | `docs/deploy/deployResult.md`                  |
| **结果格式** | 固定两行：第一行状态，第二行原因               |
| **状态值**   | `部署成功` / `部署失败` / `部署超时`（三选一） |

输出模板见 [references/templates.md](references/templates.md)。

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

- 出现 `FATAL` 或 `entered EXITED state` → 立即读取该服务日志，进入**步骤 2d 错误修复流程**
- **例外**：`app` 服务出现 `FATAL` 时，**直接跳过，不进入修复流程**（后期环境就绪后移除此规则）

**步骤 2c：通过分析日志内容判断各服务是否真正就绪**

每隔 10 秒读取每个服务的日志文件，通过日志内容**自主判断**服务是否已完成初始化并可接受请求。无固定格式，根据实际内容分析：

- 出现端口监听信息（如 `listening on`、`running at`、`http://`、`ready`、`started` 等）→ 就绪
- 出现持续刷新的进度信息（编译中、安装依赖中）→ 仍在初始化，继续等待
- 出现明显错误 → 进入**步骤 2d 错误修复流程**

> **注意**：部分服务的日志中可能出现非关键性的警告或错误（如容器内无显示器导致的 `spawn xdg-open ENOENT`），需结合上下文判断是否影响服务可用性，不要因单行警告误判为失败。

| 情况                           | 判定              |
| ------------------------------ | ----------------- |
| supervisord.log 出现 `FATAL`   | 进入步骤 2d 修复  |
| 服务日志出现明显错误           | 进入步骤 2d 修复  |
| 所有服务日志均出现就绪信号     | ✅ 继续步骤 3     |
| 600 秒内仍有服务未出现就绪信号 | ⏳ 超时，标记失败 |

**步骤 2d：错误内联修复（发现错误时立即执行）**

> 这是核心改进：检测到启动错误后，**不记录后放弃**，而是立即尝试分析修复，修复后原地重启，最多内部重启 2 次。

执行流程：

```
1. 读取出错服务的完整日志内容，分析根因
2. 自主判断是否可修复：
   - 可修复 → 直接修改相关文件或执行修复命令
             → 将修复动作写入 deployLog.md 的「## 修复记录」章节
             → 重新执行 make sandbox-restart（内部重启计数 +1）
             → 返回步骤 2b 继续监控
   - 无法判断如何修复 → 将错误详情写入 deployLog.md，标记「部署失败」，终止
3. 内部重启计数达到 2 次后仍失败 → 写入错误详情，标记「部署失败」，终止
```

> **Go 版本冲突的特殊规定**：
> 当错误为 `go.mod requires go >= X.Y (running go A.B)` 时，修复方式必须是将 go.mod 中的 `go X.Y` 降低为沙箱实际运行的版本（即 `go A.B`）。
> 禁止通过设置 `GOTOOLCHAIN=auto`、`GOTOOLCHAIN=path` 或修改 `Makefile`/`air.toml` 来让沙箱下载更高版本的 Go 工具链。
> 沙箱环境的 Go 版本是固定基准，代码应适配环境，而非环境适配代码。

修复记录格式（追加到 `docs/deploy/deployLog.md`）：

```markdown
## 修复记录

- **错误原因**：[错误日志原文摘要]
- **修复动作**：[具体执行了什么操作，修改了哪个文件的哪一行]
- **修复结果**：成功 / 失败（[失败原因]）
```

### 3. 检查日志中的错误关键词

读取以下日志文件，检查是否存在错误：

- `./logs/backend.log`
- `./logs/shadow.log`

> `./logs/app.log` 暂时跳过（后期环境就绪后恢复）

错误关键词：`Error`、`panic`、`Fatal`、`Exception`、`EADDRINUSE`、`Cannot find module`

如发现错误，记录相关行到部署日志。

## 结果写入

### deployLog.md

内容须包含：部署时间、执行命令、各服务 RUNNING 状态时间点、应用级别就绪时间、修复记录（如有）、错误记录（如有）。

### deployResult.md

将结果写入 `docs/deploy/deployResult.md`：

#### 示例 - 部署成功

```
部署成功
所有服务已启动，backend: [::]:8000, app: http://localhost:8200
```

#### 示例 - 部署成功（经修复后）

```
部署成功
发现 go.mod 版本不匹配，已修复后重启，所有服务正常启动
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

| 错误类型          | 处理方式                                      |
| ----------------- | --------------------------------------------- |
| Docker 服务未运行 | 执行 `sudo systemctl start docker` 启动后重试 |
| 服务启动报错      | 进入步骤 2d，分析日志，自主修复，内部重启     |
| 超时（>600s）     | 标记部署超时，记录 supervisord.log 最后内容   |
