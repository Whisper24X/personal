# deploy-verify 输出模板

## deploy.md 模板

````markdown
# 部署信息

部署时间: [当前时间]
环境: Sandbox

## Docker 状态

- Docker 服务: [✅ 运行中 / ❌ 启动失败 / ⚠️ 未启动]
- 检查时间: [时间]

[如果 Docker 启动失败，添加错误日志和修复命令]

## 访问地址

- [服务名称]: [访问地址] [状态标注]

## 服务状态

### Docker ❌ 启动失败

错误日志（最后 20-30 行 journalctl）：

```
[journalctl 日志]
```

修复命令：

```bash
sudo systemctl start docker
sudo systemctl status docker
make sandbox
```

### [服务名称] ✅ 运行正常

- 访问地址: [地址]
- 状态码: 200 OK

### [服务名称] ❌ 启动失败

- 预期地址: [地址]
- 错误信息: [错误描述]

错误日志（最后 20-30 行）：

```
[错误日志内容]
```

## 部署摘要

| 指标     | 结果        |
| -------- | ----------- |
| 总服务数 | [数量]      |
| 正常运行 | [数量]      |
| 启动失败 | [数量]      |
| 部署状态 | [成功/失败] |
````

## verifyResult.md 示例

### 已完成

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
```

### 未完成（服务启动失败或返回错误）

```json
{
  "result": "未完成",
  "reason": "后端API返回502错误，服务未正常运行",
  "details": {
    "统一入口": "✅ 200 OK",
    "后端API": "❌ 502 Bad Gateway - 服务未正常启动",
    "管理后台": "✅ 200 OK"
  },
  "error_logs": {
    "后端API": "Error: Cannot find module 'xxx'\n    at Function.Module._resolveFilename..."
  }
}
```

### 未完成（Docker 启动失败）

```json
{
  "result": "未完成",
  "reason": "存在启动失败的服务：Docker，Docker 服务未运行",
  "details": {
    "Docker": "❌ 启动失败 - Cannot connect to the Docker daemon"
  },
  "error_logs": {
    "Docker": "[journalctl -u docker 输出的最后 20-30 行]"
  },
  "fix_commands": "sudo systemctl start docker\nsudo systemctl status docker"
}
```

### 未找到

```json
{
  "result": "未找到",
  "reason": "deploy.md 文件不存在，部署可能未执行"
}
```
