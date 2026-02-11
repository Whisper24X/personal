---
name: deploy-verify
description: 验证部署结果。检查服务状态、验证服务可访问性、生成部署文档。无状态验证工具，由 Deploy Action 循环调用。触发场景：(1) 部署后服务验证 (2) 服务可访问性检查 (3) 生成部署报告
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
2. 读取 `docs/deploy/deployLog.md`，获取服务地址和启动日志
3. 如果文件不存在，直接检查运行中的进程和端口

**Docker 状态检查**（优先级最高）：

1. **Docker 服务状态**

   ```bash
   systemctl --user status docker
   ```

   状态判定：
   - `active (running)` → ✅ Docker 正常
   - `inactive (dead)` → ❌ Docker 未启动
   - `failed` → ❌ Docker 启动失败

2. **Docker 错误日志**（如果 Docker 启动失败）

   ```bash
   journalctl --user -u docker -n 50 --no-pager
   ```

   关键错误识别：
   - `newuidmap: write to uid_map failed: Operation not permitted` → Rootless Docker UID/GID 映射配置错误
   - `failed to setup UID/GID map` → Rootless Docker UID/GID 映射配置错误
   - `address already in use` → 端口被占用
   - `Cannot connect to the Docker daemon` → Docker 服务未运行

**服务识别**：

- 根据项目目录结构识别所有应包含的服务
- 对比实际运行的服务，标识缺失或异常的服务
- 检查进程状态（`ps`、`docker ps` 等）

**状态分类**：

| 状态       | 含义                                     |
| ---------- | ---------------------------------------- |
| 运行中     | 服务进程存在且响应正常                   |
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
- "未启动"的服务 → **直接判定为未完成**（项目应该有但没启动）
- "启动失败"的服务 → **直接判定为未完成**（项目应该有但启动出错）
- "运行中"的服务 → 需要访问测试验证

> **重要强调**：502 Bad Gateway 是后端服务未正常启动的常见表现，必须判定为失败，绝对不能返回"已完成"。

### 3. 生成部署文档

在 `docs/deploy/deploy.md` 中生成完整的部署文档，内容包括：

```markdown
# 部署信息

部署时间: [当前时间]
环境: Sandbox

## Docker 状态

- Docker 服务: [✅ 运行中 / ❌ 启动失败 / ⚠️ 未启动]
- 检查时间: [时间]

[如果 Docker 启动失败，添加错误日志和修复命令]

## 访问地址

- [服务名称]: [访问地址] [状态标注]
- [服务名称]: [访问地址] [状态标注]

## 服务状态

### Docker ❌ 启动失败

错误日志：
```

[最后 20-30 行 journalctl 日志]

````

修复命令：
```bash
# 获取当前用户 UID
USER_UID=$(id -u)

# 添加 UID 格式配置到 /etc/subuid 和 /etc/subgid
sudo bash -c "echo \"${USER_UID}:100000:65536\" >> /etc/subuid"
sudo bash -c "echo \"${USER_UID}:100000:65536\" >> /etc/subgid"

# 重启 Docker 服务
systemctl --user restart docker

# 验证 Docker 状态
systemctl --user status docker

# 重新执行部署
make sandbox
````

### [服务名称] ✅ 运行正常

- 访问地址: [地址]
- 状态码: 200 OK
- 响应时间: [时间]

### [服务名称] ❌ 启动失败

- 预期地址: [地址]
- 错误信息: [错误描述]

错误日志：

```

[最后 20-30 行错误日志内容]

```

## 部署摘要

| 指标     | 结果        |
| -------- | ----------- |
| 总服务数 | [数量]      |
| 正常运行 | [数量]      |
| 启动失败 | [数量]      |
| 部署状态 | [成功/失败] |

````

**文档要求**：

- Docker 状态检查放在最前面（最高优先级）
- 只包含实际存在的服务，不要添加项目中不存在的服务
- Docker 启动失败时，必须记录 journalctl 日志和完整的修复命令
- 启动失败的服务**必须记录错误日志**（最后 20-30 行关键日志）
- 日志信息用代码块包裹，放在该服务状态说明之后
- 这些日志信息将用于下次循环时分析和修复问题

## 结果写入

将结果以 JSON 格式写入 `docs/deploy/verifyResult.md`：

### 示例 - 已完成（所有服务正常运行）

```json
{
  "result": "已完成",
  "reason": "deploy.md 已创建，所有服务均正常运行且可访问",
  "details": {
    "统一入口": "✅ 200 OK",
    "后端API": "✅ 200 OK",
    "管理后台": "✅ 200 OK"
  }
}
````

### 示例 - 未完成（服务返回错误状态码）

```json
{
  "result": "未完成",
  "reason": "后端API返回502错误，服务未正常运行",
  "details": {
    "统一入口": "✅ 200 OK",
    "后端API": "❌ 502 Bad Gateway - 服务未正常启动",
    "管理后台": "✅ 200 OK"
  }
}
```

### 示例 - 未完成（Docker 启动失败）

```json
{
  "result": "未完成",
  "reason": "存在启动失败的服务：Docker，Rootless Docker UID/GID 映射配置错误，需要手动修复配置文件",
  "details": {
    "Docker": "❌ 启动失败 - newuidmap: write to uid_map failed: Operation not permitted"
  },
  "error_logs": {
    "Docker": "2月 11 11:37:24 device-test rootlesskit[1781702]: [rootlesskit:parent] error: failed to setup UID/GID map: newuidmap 1781713 [0 1000 1 1 100000 65536] failed: newuidmap: write to uid_map failed: Operation not permitted\n2月 11 11:37:24 device-test rootlesskit[1781702]: : exit status 1\n2月 11 11:37:24 device-test systemd[608]: docker.service: Main process exited, code=exited, status=1/FAILURE\n2月 11 11:37:24 device-test systemd[608]: docker.service: Failed with result 'exit-code'."
  },
  "fix_commands": "# 修复 Rootless Docker UID/GID 映射配置\nUSER_UID=$(id -u)\nsudo bash -c \"echo \\\"${USER_UID}:100000:65536\\\" >> /etc/subuid\"\nsudo bash -c \"echo \\\"${USER_UID}:100000:65536\\\" >> /etc/subgid\"\nsystemctl --user restart docker\nsystemctl --user status docker"
}
```

### 示例 - 未完成（存在启动失败的服务）

```json
{
  "result": "未完成",
  "reason": "存在启动失败的服务：后端API",
  "details": {
    "统一入口": "✅ 200 OK",
    "后端API": "❌ 启动失败",
    "管理后台": "✅ 200 OK"
  },
  "error_logs": {
    "后端API": "Error: Cannot find module 'xxx'\n    at Function.Module._resolveFilename...\n[deploy.md 中记录的完整错误日志]"
  }
}
```

### 示例 - 未找到

```json
{
  "result": "未找到",
  "reason": "deploy.md 文件不存在，部署可能未执行"
}
```

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
4. 任何"运行中"的服务返回非 2xx 状态码（如 500、502、503、504 等）
5. 任何服务无法访问（Connection refused/timeout）

## 重要提醒

1. **必须写入两个文件**：`docs/deploy/deploy.md`（部署文档）和 `docs/deploy/verifyResult.md`（验证结果）
2. **结果文件格式**：JSON 格式，包含 result、reason、details 字段（Docker 失败时增加 fix_commands 字段）
3. **确保目录存在**：如果 `docs/deploy/` 目录不存在，需要先创建
4. **Docker 状态优先级最高**：Docker 启动失败会导致所有容器化服务无法启动，必须优先检查
5. **502 = 失败**：502 Bad Gateway 是后端服务未正常启动的典型表现，绝对不能返回"已完成"
6. **错误日志必须记录**：启动失败的服务必须在 deploy.md 和 verifyResult.md 中都包含错误日志
7. **只有 "目录不存在" 的服务可以忽略**：其他所有异常状态都必须导致整体结果为"未完成"
8. **Docker 错误提供修复命令**：Rootless Docker UID/GID 映射错误时，在 verifyResult.md 中提供完整的修复命令
