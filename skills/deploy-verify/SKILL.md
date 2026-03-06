---
name: deploy-verify
description: 验证部署结果：读取 ./logs/ 目录日志文件确认服务状态，执行 curl 可访问性验证，生成 deploy.md 和 verifyResult.md（JSON 格式）。当部署执行完成后需要验证服务可用性、生成部署报告时使用。
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

**检查来源（按优先级）**：

1. **解析 `sandbox/supervisord.conf` 获取服务列表**：
   - 读取所有 `[program:X]` 段，提取服务名和对应日志文件路径（`stdout_logfile`）
   - 这是本次验证的服务枚举来源，不要硬编码服务名

2. **读取各服务日志文件判断就绪状态**：
   - 读取每个服务的日志文件内容，分析是否已出现端口监听/就绪信号
   - 同时检查 `./logs/supervisord.log` 是否有 `FATAL` 或 `entered EXITED state`

3. **读取 `docs/deploy/deployResult.md`**：获取 deploy-execute 阶段的汇总结论

4. **获取端口号**：
   - 读取 `sandbox/.env` 获取 `SANDBOX_PORT`（默认 `8080`）
   - 或从 `docs/deploy/deployLog.md` 中提取端口号
   - 按固定路径构造地址：`http://localhost:${SANDBOX_PORT}/`、`/api/`、`/shadow/`、`/app/`

**本机 IP 识别**（写入 deploy.md 前必须执行）：

执行以下命令获取本机真实局域网 IP，用于替换模板中所有的 `[本机IP]`：

- Linux：`hostname -I | awk '{print $1}'`
- macOS：`ipconfig getifaddr en0`（若无结果，尝试 `en1`）

将获取到的 IP 填入 `## 访问地址` 节的「网络访问」和「或 http://[本机IP]:[端口]/」各行。

**Docker 状态**：从 `deployResult.md` 或 `deployLog.md` 读取 Docker 状态结论；若文件不存在，执行 `systemctl status docker` 并记录结果（`active(running)` / `inactive` / `failed`）。Docker 失败时执行 `journalctl -u docker -n 50 --no-pager` 获取错误日志。

**状态分类**（综合各服务日志与 supervisord.log）：

| 状态       | 含义                                     | 判断依据                                        |
| ---------- | ---------------------------------------- | ----------------------------------------------- |
| 运行中     | 服务已真正就绪并可接受请求               | 服务日志中出现端口监听/就绪信号                 |
| 启动失败   | 服务尝试启动但出现错误                   | supervisord.log 中 `FATAL` 或服务日志含致命错误 |
| 未启动     | supervisord.conf 中定义但日志为空或缺失  | 日志文件不存在或无任何输出                      |
| 目录不存在 | 项目不包含该服务（正常情况，不参与检查） | 对应目录不存在                                  |

> **注意**：日志中出现单行警告（如容器内无显示器导致的 `spawn xdg-open ENOENT`）需结合上下文判断，不要因非关键警告误判为失败。

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
- `app` 服务 → **暂时跳过，不参与检查**（后期环境就绪后移除此规则）
- "启动失败"的服务 → **直接判定为未完成**（项目应该有但启动出错）
- "未启动"的服务 → **直接判定为未完成**（项目应该有但没启动）
- "运行中"的服务 → 需要访问测试验证

> **重要强调**：502 Bad Gateway 是后端服务未正常启动的常见表现，必须判定为失败，绝对不能返回"已完成"。

### 3. 生成部署文档

在 `docs/deploy/deploy.md` 中生成完整的部署文档，文档格式见 [deploy-md-template.md](references/deploy-md-template.md)。

**文档要求**：

- 只包含实际存在的服务，不要添加项目中不存在的服务
- 有任何报错（Docker 启动失败、服务启动失败）时，取对应日志文件的最后 **50 行**写入 `## 错误日志` 节：
  - Docker 启动失败：执行 `journalctl -u docker -n 50 --no-pager`
  - 服务启动失败：从 `sandbox/supervisord.conf` 中找到该服务的 `stdout_logfile`，读取最后 50 行
  - 日志中无 `Error` / `Exception` / `Fatal` / `panic` 等关键词时，不附加日志
- 日志用代码块包裹
- 这些日志将用于下次循环时分析和修复问题

## 结果写入

将结果以 JSON 格式写入 `docs/deploy/verifyResult.md`，包含 `result`、`reason`、`details` 字段（Docker 失败时增加 `fix_commands` 字段，服务失败时增加 `error_logs` 字段）。

JSON 格式示例见 [verify-result-template.md](references/verify-result-template.md)。

## 完成判定标准

**"已完成"必须同时满足以下所有条件**：

1. Docker 服务正常运行（Linux 系统必须检查）
2. 没有任何"启动失败"的服务（`app` 服务暂时豁免，后期环境就绪后移除）
3. 没有任何"未启动"的服务（"目录不存在"及 `app` 服务除外）
4. 所有"运行中"的服务都可正常访问（返回 2xx 状态码）

**以下任一情况判定为"未完成"**：

1. **Docker 服务启动失败**（最高优先级，会导致所有容器化服务无法启动）
2. 存在"启动失败"的服务（`app` 服务除外）
3. 存在"未启动"的服务（`app` 服务除外）
4. 存在"已退出"的服务（`app` 服务除外）
5. 任何"运行中"的服务返回非 2xx 状态码（如 500、502、503、504 等）
6. 任何服务无法访问（Connection refused/timeout）
