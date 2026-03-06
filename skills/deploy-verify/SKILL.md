---
name: deploy-verify
description: 验证部署结果：检查服务状态与可访问性（curl 验证），生成 deploy.md 和 verifyResult.md（JSON 格式）。当部署执行完成后需要验证服务可用性、生成部署报告时使用。
---

# VerifyDeployment - 验证部署

在部署完成后，验证所有服务的运行状态和可访问性，并生成最终的部署文档。

## 输出规范（强制）

> **重要**：验证结果必须写入文件，不是输出到终端。

| 项目         | 规范                                         |
| ------------ | -------------------------------------------- |
| **部署文档** | `docs/deploy/deploy.md`                      |
| **结果文件** | `docs/deploy/verifyResult.md`                |
| **结果格式** | JSON 格式，包含 result、reason、details 字段 |

## 执行步骤

### 1. 检查服务状态

**检查来源**：

1. 读取 `docs/deploy/deployResult.md`，获取部署执行阶段的结果
2. 读取 `docs/deploy/deployLog.md`，获取服务地址和启动日志；从中提取端口号（`SANDBOX_PORT`）
3. 如果以上文件不存在，通过以下方式获取访问地址：
   - 读取 `sandbox/.env` 获取容器名（`SANDBOX_NAME`）和端口（`SANDBOX_PORT`，默认 `8080`）
   - 执行 `docker ps --filter "name=^${SANDBOX_NAME}$" --format "{{.Ports}}"` 确认容器实际映射端口
   - 按固定路径构造地址：`http://localhost:${SANDBOX_PORT}/`、`/api/`、`/shadow/`、`/app/`

**本机 IP 识别**（写入 deploy.md 前必须执行）：

执行以下命令获取本机真实局域网 IP，用于替换模板中所有的 `[本机IP]`：

- Linux：`hostname -I | awk '{print $1}'`
- macOS：`ipconfig getifaddr en0`（若无结果，尝试 `en1`）

将获取到的 IP 填入 `## 访问地址` 节的「网络访问」和「或 http://[本机IP]:[端口]/」各行。

**Docker 状态**：从 `deployResult.md` 或 `deployLog.md` 读取 Docker 状态结论；若文件不存在，执行 `systemctl status docker` 并记录结果（`active(running)` / `inactive` / `failed`）。Docker 失败时执行 `journalctl -u docker -n 50 --no-pager` 获取错误日志。

**服务识别**：

- 根据项目目录结构识别所有应包含的服务
- 对比实际运行的服务，标识缺失或异常的服务
- 检查进程状态（`ps`、`docker ps` 等）

**状态分类**：

| 状态       | 含义                                     |
| ---------- | ---------------------------------------- |
| 运行中     | 服务进程存在且响应正常                   |
| 已退出     | 容器存在但已停止（`Exited`）             |
| 未启动     | 项目包含该服务但未运行                   |
| 启动失败   | 服务尝试启动但出现错误                   |
| 目录不存在 | 项目不包含该服务（正常情况，不参与检查） |

### 2. 验证服务可访问性

**对每个"运行中"的服务执行访问测试**：

使用 `curl` 验证每个服务地址的可访问性：

```bash
curl -s -o /dev/null -w "%{http_code}" http://[地址]:[端口]
```

**响应状态码判定**：

| 状态码范围 | 判定    | 说明                                   |
| ---------- | ------- | -------------------------------------- |
| 2xx        | ✅ 成功 | 服务正常运行                           |
| 3xx        | ✅ 成功 | 重定向，一般视为正常                   |
| 4xx        | ❌ 失败 | 客户端错误（404 等）                   |
| 5xx        | ❌ 失败 | 服务器错误（**特别注意 502/503/504**） |
| 连接拒绝   | ❌ 失败 | Connection refused - 服务未监听        |
| 连接超时   | ❌ 失败 | Connection timeout - 服务无响应        |

**关键判断逻辑（必须严格遵守）**：

- "目录不存在"的服务 → **不参与检查**（项目本身不包含该服务，属于正常情况）
- "已退出"的服务 → **直接判定为未完成**（容器已停止）
- "未启动"的服务 → **直接判定为未完成**（项目应该有但没启动）
- "启动失败"的服务 → **直接判定为未完成**（项目应该有但启动出错）
- "运行中"的服务 → 需要访问测试验证

> **重要强调**：502 Bad Gateway 是后端服务未正常启动的常见表现，必须判定为失败，绝对不能返回"已完成"。

### 3. 生成部署文档

在 `docs/deploy/deploy.md` 中生成完整的部署文档，文档格式见 [deploy-md-template.md](deploy-md-template.md)。

**文档要求**：

- 只包含实际存在的服务，不要添加项目中不存在的服务
- 有任何报错（Docker 启动失败、容器已退出且日志含报错、服务启动失败）时，取对应来源的最后 **50 行**日志写入 `## 错误日志` 节：
  - Docker 启动失败：执行 `journalctl -u docker -n 50 --no-pager`
  - 容器已退出或启动失败：执行 `docker logs --tail 50 <容器名>`
  - 容器已退出但日志无 `Error` / `Exception` / `Fatal` / `panic` 等关键词时，不附加日志
- 日志用代码块包裹
- 这些日志将用于下次循环时分析和修复问题

## 结果写入

将结果以 JSON 格式写入 `docs/deploy/verifyResult.md`，包含 `result`、`reason`、`details` 字段（Docker 失败时增加 `fix_commands` 字段，服务失败时增加 `error_logs` 字段）。

JSON 格式示例见 [verify-result-template.md](verify-result-template.md)。

## 完成判定标准

**"已完成"必须同时满足以下所有条件**：

1. Docker 服务正常运行（Linux 系统必须检查）
2. 没有任何"启动失败"的服务
3. 没有任何"未启动"的服务（"目录不存在"除外）
4. 所有"运行中"的服务都可正常访问（返回 2xx 状态码）

**以下任一情况判定为"未完成"**：

1. **Docker 服务启动失败**（最高优先级，会导致所有容器化服务无法启动）
2. 存在"启动失败"的服务
3. 存在"未启动"的服务
4. 存在"已退出"的服务
5. 任何"运行中"的服务返回非 2xx 状态码（如 500、502、503、504 等）
6. 任何服务无法访问（Connection refused/timeout）
