# deploy.md 模板

````markdown
# 部署信息

部署时间: [当前时间]
环境: Sandbox

## Docker 状态

- Docker 服务: [✅ 运行中 / ❌ 启动失败 / ⚠️ 未启动]
- 检查时间: [时间]

## 访问地址

```
访问地址:
统一入口:    http://localhost:[端口]/ 或 http://[本机IP]:[端口]/
后端 API:    http://localhost:[端口]/api/ 或 http://[本机IP]:[端口]/api/
管理后台:    http://localhost:[端口]/shadow/ 或 http://[本机IP]:[端口]/shadow/
移动端 H5:   http://localhost:[端口]/app/ 或 http://[本机IP]:[端口]/app/
网络访问:    http://[本机IP]:[端口]/ （局域网内其他设备可访问）
测试环境访问: http://10.8.8.152:[端口]/ （固定测试环境，子路径 /api/、/shadow/、/app/ 同上）
```

| 服务      | 地址                            | 验证结果                |
| --------- | ------------------------------- | ----------------------- |
| 统一入口  | http://localhost:[端口]/        | [✅ 200 OK / ❌ 状态码] |
| 后端 API  | http://localhost:[端口]/api/    | [✅ 200 OK / ❌ 状态码] |
| 管理后台  | http://localhost:[端口]/shadow/ | [✅ 200 OK / ❌ 状态码] |
| 移动端 H5 | http://localhost:[端口]/app/    | [✅ 200 OK / ❌ 状态码] |

## 错误日志（仅有报错时附加）

```
[docker logs --tail 50 <容器名> 或 journalctl -u docker -n 50 的输出]
```

## 部署摘要

| 指标     | 结果        |
| -------- | ----------- |
| 总服务数 | [数量]      |
| 正常运行 | [数量]      |
| 启动失败 | [数量]      |
| 部署状态 | [成功/失败] |
````
