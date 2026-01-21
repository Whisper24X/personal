# mind2build 部署指南

**文档版本**: v1.1  
**创建日期**: 2025-12-24  
**最后更新**: 2026-01-21  
**适用版本**: mind2build v1.2+

---

## 目录

1. [系统要求](#1-系统要求)
2. [安装方式](#2-安装方式)
3. [配置指南](#3-配置指南)
4. [部署方式](#4-部署方式)
5. [运维管理](#5-运维管理)
6. [故障排查](#6-故障排查)

---

## 1. 系统要求

### 1.1 硬件要求

**最低配置**:
- CPU: 2核
- 内存: 4GB
- 磁盘: 10GB 可用空间

**推荐配置**:
- CPU: 4核+
- 内存: 8GB+
- 磁盘: 50GB+ SSD

### 1.2 软件要求

**操作系统**:
- ✅ Linux (Ubuntu 20.04+, CentOS 8+)
- ✅ macOS (11.0+)
- ✅ Windows 10/11 + WSL2

**依赖软件**:
- Node.js: v18+ (推荐 v20+)
- TypeScript: v5.3+
- pnpm: v8+ (monorepo包管理)
- PostgreSQL: v14+ (数据库)
- Git: 2.30+ (必需，用于项目版本管理)

### 1.3 网络要求

- ✅ 稳定的互联网连接
- ✅ 可访问 LLM API（OpenAI/Anthropic 等）
- ⚠️ 国内用户可能需要配置代理

---

## 2. 安装方式

### 2.1 从源码安装（推荐）

**Step 1: 克隆仓库**
```bash
git clone https://github.com/your-org/testflow.git
cd testflow
```

**Step 2: 安装依赖**
```bash
# 安装所有依赖（monorepo）
pnpm install

# 或单独安装后端依赖
cd backend
pnpm install
```

**Step 3: 配置环境变量**
```bash
# 复制环境变量示例文件
cp backend/.env.example backend/.env

# 编辑 .env 文件，配置数据库和LLM API Keys
vim backend/.env
```

**Step 4: 初始化数据库**
```bash
# 参考 21_数据库配置指南_DBSETUP.md
# 执行数据库迁移脚本
psql -U postgres -d your_database -f backend/src/database/migrations/000_complete_schema.sql
```

**Step 5: 验证安装**
```bash
# 运行开发服务器
pnpm --filter backend dev

# 或运行CLI命令
pnpm --filter backend cli generate "Create a todo app"
```

### 2.2 使用 Docker 安装

**Step 1: 构建镜像**
```bash
# 构建后端镜像
cd backend
docker build -t testflow-backend:latest .

# 或使用 docker-compose
docker-compose build
```

**Step 2: 运行容器**
```bash
docker run -it \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e ZHIPUAI_API_KEY=your-api-key \
  -v $(pwd)/workspace:/app/workspace \
  testflow-backend:latest \
  pnpm cli generate "Create a 2048 game"
```

**Step 3: 使用 Docker Compose**
```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: mind2build_db
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/mind2build_db
      - ZHIPUAI_API_KEY=${ZHIPUAI_API_KEY}
    volumes:
      - ./workspace:/app/workspace
    depends_on:
      - postgres
    ports:
      - "3000:3000"

volumes:
  pgdata:
```

```bash
docker-compose up -d
```

---

## 3. 配置指南

### 3.1 初始化配置

系统使用 TypeScript 配置文件和 PostgreSQL 数据库存储配置。

**环境变量配置**（`.env` 文件）:
```bash
# 数据库配置
DATABASE_URL="postgresql://postgres:password@localhost:5432/mind2build_db"

# LLM 配置（默认提供商）
LLM_PROVIDER="zhipuai"
ZHIPUAI_API_KEY="your-api-key"
ZHIPUAI_MODEL="glm-4-flash"

# 服务器配置
PORT=3000
HOST=0.0.0.0

# 工作空间配置
WORKSPACE_PATH="./workspace"
```

### 3.2 数据库配置

LLM配置存储在 PostgreSQL 数据库中：
- `llm_configs` 表：系统默认LLM配置
- `llm_provider_configs` 表：提供商级别的配置（API keys和base URLs）
- `role_llm_configs` 表：角色特定的LLM配置

参考 [13_配置管理_CONFIG.md](./13_配置管理_CONFIG.md) 了解详细配置方法。

### 3.3 环境变量配置

```bash
# ~/.bashrc 或 ~/.zshrc
export OPENAI_API_KEY="sk-your-api-key"
export ANTHROPIC_API_KEY="your-anthropic-key"

# 代理配置（国内用户）
export HTTP_PROXY="http://127.0.0.1:7890"
export HTTPS_PROXY="http://127.0.0.1:7890"

# 日志级别
export LOG_LEVEL="INFO"  # DEBUG/INFO/WARNING/ERROR
```

### 3.3 多 LLM 提供商配置

**智谱AI（默认）**:
```bash
export LLM_PROVIDER="zhipuai"
export ZHIPUAI_API_KEY="your-api-key"
export ZHIPUAI_MODEL="glm-4-flash"
```

**OpenAI**:
```bash
export LLM_PROVIDER="openai"
export OPENAI_API_KEY="sk-xxx"
export OPENAI_MODEL="gpt-4-turbo"
```

**火山引擎 Ark**:
```bash
export LLM_PROVIDER="ark"
export ARK_API_KEY="your-api-key"
export ARK_MODEL="doubao-1-5-pro-32k-250115"
```

**DeepSeek**:
```bash
export LLM_PROVIDER="deepseek"
export DEEPSEEK_API_KEY="your-api-key"
export DEEPSEEK_MODEL="deepseek-chat"
```

**Cursor Agent**:
```bash
export LLM_PROVIDER="cursor"
export CURSOR_API_KEY="your-api-key"
export CURSOR_REPOSITORY="https://github.com/owner/repo"
```

**架构说明**: 大多数LLM提供商通过统一的 `OpenAICompatibleLLM` 类实现，Cursor Agent使用独立的 `CursorLLM` 实现。

---

## 4. 部署方式

### 4.1 本地开发部署

**适用场景**: 个人开发、测试

```bash
# 启动后端开发服务器
pnpm --filter backend dev

# 或使用CLI命令
pnpm --filter backend cli generate "Your idea"

# 启动前端开发服务器（可选）
pnpm --filter frontend dev
```

### 4.2 服务器部署

**Step 1: 创建用户**
```bash
sudo useradd -m -s /bin/bash mind2build
sudo su - mind2build
```

**Step 2: 安装和配置**
```bash
# 克隆仓库
cd /opt
git clone https://github.com/your-org/testflow.git
cd testflow

# 安装依赖
pnpm install

# 配置环境变量
cp backend/.env.example backend/.env
vim backend/.env

# 初始化数据库
psql -U postgres -d mind2build_db -f backend/src/database/migrations/000_complete_schema.sql
```

**Step 3: 创建服务（systemd）**
```ini
# /etc/systemd/system/testflow-backend.service
[Unit]
Description=TestFlow Backend Service
After=network.target postgresql.service

[Service]
Type=simple
User=mind2build
WorkingDirectory=/opt/testflow
Environment="NODE_ENV=production"
Environment="DATABASE_URL=postgresql://postgres:password@localhost:5432/mind2build_db"
ExecStart=/usr/bin/pnpm --filter backend start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
# 启动服务
sudo systemctl daemon-reload
sudo systemctl enable mind2build
sudo systemctl start mind2build
sudo systemctl status mind2build
```

### 4.3 Docker 部署

**Dockerfile**:
```dockerfile
FROM node:20-slim

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY backend ./backend
COPY shared ./shared

# 构建
WORKDIR /app/backend
RUN pnpm build

# 配置
ENV NODE_ENV=production
VOLUME ["/app/workspace"]
EXPOSE 3000

# 启动命令
CMD ["node", "dist/server.js"]
```

**构建和运行**:
```bash
# 构建镜像
docker build -t testflow-backend .

# 运行
docker run -it \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e ZHIPUAI_API_KEY=your-key \
  -v $(pwd)/workspace:/app/workspace \
  -p 3000:3000 \
  testflow-backend
```

### 4.4 Kubernetes 部署

**deployment.yaml**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: testflow-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: testflow-backend
  template:
    metadata:
      labels:
        app: testflow-backend
    spec:
      containers:
      - name: backend
        image: testflow-backend:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: database-url
        - name: ZHIPUAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: llm-secrets
              key: zhipuai-key
        volumeMounts:
        - name: workspace
          mountPath: /app/workspace
      volumes:
      - name: workspace
        persistentVolumeClaim:
          claimName: testflow-workspace
```

---

## 5. 运维管理

### 5.1 日志管理

**查看日志**:
```bash
# CLI 运行时
pnpm --filter backend cli generate "Your idea" 2>&1 | tee testflow.log

# 服务日志
journalctl -u testflow-backend -f

# Docker 日志
docker logs -f testflow-backend
```

**日志配置**:
```typescript
// backend/src/utils/logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'testflow.log' }),
    new winston.transports.Console()
  ]
});

export default logger;
```

### 5.2 性能监控

**成本监控**:
```typescript
import { Team } from '@/orchestration/Team';

const team = new Team(context);
// ... 运行项目

// 检查成本
const costReport = team.context.costManager.getReport();
console.log(`Total cost: $${costReport.totalCost.toFixed(2)}`);
console.log(`Tokens: ${costReport.totalTokens}`);
console.log(`Budget remaining: $${(costReport.maxBudget - costReport.totalCost).toFixed(2)}`);
```

**性能指标**:
```bash
# 监控脚本
#!/bin/bash
while true; do
  echo "=== $(date) ==="
  ps aux | grep mind2build
  df -h | grep workspace
  free -h
  sleep 60
done
```

### 5.3 备份和恢复

**备份配置**:
```bash
# 备份配置文件
tar -czf mind2build-config-$(date +%Y%m%d).tar.gz ~/.mind2build/

# 备份工作空间
tar -czf workspace-$(date +%Y%m%d).tar.gz ./workspace/
```

**恢复**:
```bash
# 恢复配置
tar -xzf mind2build-config-20251224.tar.gz -C ~/

# 恢复工作空间
tar -xzf workspace-20251224.tar.gz
```

---

## 6. 故障排查

### 6.1 常见问题

**问题 1: 安装失败**
```bash
# 错误：pnpm install 失败
# 解决：清理并重新安装
rm -rf node_modules pnpm-lock.yaml
pnpm install

# 或单独安装后端
cd backend
rm -rf node_modules
pnpm install
```

**问题 2: API Key 无效**
```bash
# 错误：Authentication failed
# 解决：检查 API Key
echo $ZHIPUAI_API_KEY

# 重新设置
export ZHIPUAI_API_KEY="your-correct-key"

# 或修改 .env 文件
vim backend/.env
```

**问题 3: 数据库连接失败**
```bash
# 错误：Database connection failed
# 解决：检查数据库配置
echo $DATABASE_URL

# 测试连接
psql $DATABASE_URL -c "SELECT 1"

# 检查PostgreSQL服务
sudo systemctl status postgresql
```

**问题 4: 内存不足**
```bash
# 监控内存
free -h

# 解决：限制并发角色数或增加内存
# 或使用更小的模型（gpt-3.5-turbo）
```

### 6.2 调试技巧

**启用详细日志**:
```bash
export LOG_LEVEL=debug
pnpm --filter backend cli generate "Your idea"
```

**使用 TypeScript 调试**:
```typescript
import logger from '@/utils/logger';
logger.level = 'debug';

import { Team } from '@/orchestration/Team';
const team = new Team(context);
const result = await team.run("Your idea");
```

**检查依赖**:
```bash
pnpm --filter backend list
pnpm --filter backend outdated
```

### 6.3 性能优化

**优化 Token 使用**:
```bash
# 使用更经济的模型
export ZHIPUAI_MODEL="glm-4-flash"  # 而不是 glm-4

# 或在数据库配置中设置
# 通过 API 更新 llm_configs 表的 model 字段
```

**优化并发**:
```typescript
// 增加并发角色
const team = new Team(context);
team.hire([
  new Engineer(context),
  new Engineer(context),
  new Engineer(context)
]);
```

**缓存优化**:
```typescript
// 使用内存缓存避免重复调用
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 3600 });

function cachedOperation(key: string) {
  const cached = cache.get(key);
  if (cached) return cached;
  
  const result = /* 操作逻辑 */;
  cache.set(key, result);
  return result;
}
```

---

## 7. 安全建议

### 7.1 API Key 管理

- ❌ 不要将 API Key 提交到版本控制
- ✅ 使用环境变量或密钥管理服务
- ✅ 定期轮换 API Key
- ✅ 限制 API Key 权限

### 7.2 网络安全

```bash
# 使用防火墙
sudo ufw allow 22/tcp
sudo ufw enable

# 使用 HTTPS
# 配置反向代理（Nginx）
```

### 7.3 数据安全

- 定期备份配置和数据
- 加密敏感配置文件
- 限制文件访问权限

```bash
chmod 600 ~/.mind2build/config2.yaml
```

---

## 8. 升级指南

### 8.1 版本升级

```bash
# 备份当前版本
git tag v1.1.0
git push origin v1.1.0

# 拉取最新代码
git pull origin main

# 更新依赖
pnpm install

# 运行数据库迁移（如果有）
psql -U postgres -d mind2build_db -f backend/src/database/migrations/xxx_new_migration.sql

# 验证
pnpm --filter backend cli --version
```

### 8.2 配置迁移

```bash
# 备份旧配置
cp backend/.env backend/.env.bak

# 检查新的环境变量要求
cat backend/.env.example

# 更新 .env 文件
vim backend/.env

# 更新数据库配置（如果需要）
# 通过 API 或直接更新数据库表
```

---

## 9. 附录

### A. 完整配置示例

```bash
# backend/.env
# 数据库配置
DATABASE_URL="postgresql://postgres:password@localhost:5432/mind2build_db"

# LLM 配置（默认提供商）
LLM_PROVIDER="zhipuai"
ZHIPUAI_API_KEY="your-api-key"
ZHIPUAI_MODEL="glm-4-flash"
ZHIPUAI_BASE_URL="https://open.bigmodel.cn/api/paas/v4"

# 服务器配置
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# 工作空间配置
WORKSPACE_PATH="./workspace"

# 成本配置
DEFAULT_BUDGET=10.0

# 日志配置
LOG_LEVEL=info
LOG_FILE="./logs/testflow.log"
```

### B. 环境变量列表

| 变量名 | 说明 | 示例 |
|--------|------|------|
| DATABASE_URL | PostgreSQL 数据库连接字符串 | postgresql://user:pass@host:5432/db |
| LLM_PROVIDER | LLM 提供商 | zhipuai, openai, ark, deepseek, cursor |
| ZHIPUAI_API_KEY | 智谱AI API 密钥 | your-api-key |
| OPENAI_API_KEY | OpenAI API 密钥 | sk-xxx |
| ARK_API_KEY | 火山引擎 Ark API 密钥 | your-api-key |
| DEEPSEEK_API_KEY | DeepSeek API 密钥 | your-api-key |
| CURSOR_API_KEY | Cursor Agent API 密钥 | your-api-key |
| HTTP_PROXY | HTTP 代理 | http://127.0.0.1:7890 |
| HTTPS_PROXY | HTTPS 代理 | http://127.0.0.1:7890 |
| LOG_LEVEL | 日志级别 | debug/info/warn/error |
| PORT | 服务器端口 | 3000 |
| WORKSPACE_PATH | 工作空间路径 | ./workspace |

### C. 资源链接

- 项目文档: `doc/` 目录
- GitHub: [项目仓库地址]
- 问题反馈: GitHub Issues

---

**文档维护**: 持续更新  
**最后更新**: 2026-01-21  
**反馈**: 欢迎提出改进建议
