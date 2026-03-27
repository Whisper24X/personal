# PM2 测试环境启动说明

本文说明如何在测试环境中使用 `pm2` 启动 AINative 前后端服务。

## 前置条件

- Node.js >= 20.19.0
- `pnpm` 已安装
- `pm2` 已安装
- PostgreSQL 和 Redis 已可用

如未安装 `pm2`，可执行：

```bash
npm install -g pm2
```

## 相关文件

- PM2 配置文件：`ecosystem.config.cjs`
- 后端测试环境变量：`backend/.env.test`

## 启动前准备

1. 安装依赖：

```bash
pnpm install
pnpm --dir frontend install
pnpm --dir backend install
```

2. 确保测试环境依赖已启动。

如果你使用仓库内的 Docker Compose 启动 PostgreSQL 和 Redis，可执行：

```bash
docker compose up -d postgres redis
```

3. 构建前后端产物：

```bash
pnpm --dir backend build
pnpm --dir frontend build
```

## 启动服务

在项目根目录执行：

```bash
pm2 start ecosystem.config.cjs --env test
```

启动后默认端口：

- 前端：`8000`
- 后端：`9000`

## 常用命令

查看进程状态：

```bash
pm2 status
```

查看日志：

```bash
pm2 logs
```

重启服务：

```bash
pm2 restart ecosystem.config.cjs --env test
```

停止服务：

```bash
pm2 stop ecosystem.config.cjs
```

删除进程：

```bash
pm2 delete ecosystem.config.cjs
```

## 说明

- 后端进程使用 `NODE_ENV=test` 启动，会读取 `backend/.env.test`
- 前端进程通过 `vite preview` 提供静态页面服务
- 修改前端或后端代码后，需要重新执行构建，再重启 `pm2`

可参考流程：

```bash
pnpm --dir backend build
pnpm --dir frontend build
pm2 restart ecosystem.config.cjs --env test
```
