# 数据库配置指南

**文档版本**: v1.1  
**创建日期**: 2025-12-25  
**最后更新**: 2026-01-21

---

## 目录

1. [PostgreSQL简介](#1-postgresql简介)
2. [安装PostgreSQL](#2-安装postgresql)
3. [创建数据库](#3-创建数据库)
4. [配置连接](#4-配置连接)
5. [Prisma设置](#5-prisma设置)
6. [数据迁移](#6-数据迁移)
7. [常见问题](#7-常见问题)
8. [最佳实践](#8-最佳实践)

---

## 1. PostgreSQL简介

### 1.1 为什么选择PostgreSQL

**优势**:
- ✅ **开源免费**: 完全开源，无许可费用
- ✅ **功能强大**: 支持复杂查询、事务、JSON等
- ✅ **性能优秀**: 适合读写密集型应用
- ✅ **可靠稳定**: 久经考验的企业级数据库
- ✅ **扩展性好**: 丰富的扩展和插件

**适用场景**:
- Web 应用后端存储
- 复杂的数据关系管理
- 需要 JSON 支持的应用
- 大数据量场景

### 1.2 版本要求

- **推荐版本**: PostgreSQL 14.x 或更高
- **最低版本**: PostgreSQL 12.x
- **支持平台**: Linux, macOS, Windows

---

## 2. 安装PostgreSQL

### 2.1 macOS安装

#### 方法1: 使用Homebrew（推荐）

```bash
# 安装PostgreSQL
brew install postgresql@14

# 启动服务
brew services start postgresql@14

# 验证安装
psql --version
```

#### 方法2: 使用Postgres.app

1. 下载：https://postgresapp.com/
2. 拖动到Applications文件夹
3. 启动应用
4. 配置PATH

```bash
# 添加到 ~/.zshrc 或 ~/.bash_profile
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"
```

### 2.2 Linux安装

#### Ubuntu/Debian

```bash
# 更新软件包列表
sudo apt update

# 安装PostgreSQL
sudo apt install postgresql-14 postgresql-contrib

# 启动服务
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 验证安装
psql --version
```

#### CentOS/RHEL

```bash
# 安装PostgreSQL仓库
sudo yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-8-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# 安装PostgreSQL 14
sudo yum install -y postgresql14-server postgresql14-contrib

# 初始化数据库
sudo /usr/pgsql-14/bin/postgresql-14-setup initdb

# 启动服务
sudo systemctl start postgresql-14
sudo systemctl enable postgresql-14
```

### 2.3 Windows安装

1. 下载安装程序：https://www.postgresql.org/download/windows/
2. 运行安装程序
3. 选择安装路径和组件
4. 设置超级用户密码
5. 选择端口（默认5432）
6. 完成安装

### 2.4 Docker安装（推荐用于开发）

```bash
# 拉取PostgreSQL镜像
docker pull postgres:14

# 运行容器
docker run --name mind2build-postgres \
  -e POSTGRES_PASSWORD=123456 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=ai \
  -p 5432:5432 \
  -v pgdata:/var/lib/postgresql/data \
  -d postgres:14

# 验证运行
docker ps | grep postgres
```

---

## 3. 创建数据库

### 3.1 连接到PostgreSQL

```bash
# 使用postgres用户连接
sudo -u postgres psql

# 或直接连接（如果已配置）
psql -U postgres
```

### 3.2 创建数据库

```sql
-- 创建数据库
CREATE DATABASE ai;

-- 查看数据库列表
\l

-- 切换到新数据库
\c ai

-- 创建schema（可选）
CREATE SCHEMA IF NOT EXISTS public;

-- 设置搜索路径
SET search_path TO public;
```

### 3.3 创建用户（可选）

```sql
-- 创建专用用户
CREATE USER mind2build WITH PASSWORD 'your_secure_password';

-- 授予数据库权限
GRANT ALL PRIVILEGES ON DATABASE ai TO mind2build;

-- 授予schema权限
GRANT ALL PRIVILEGES ON SCHEMA public TO mind2build;

-- 授予表权限
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mind2build;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mind2build;
```

### 3.4 配置认证（如需要）

编辑 `pg_hba.conf` 文件：

```bash
# 查找配置文件位置
psql -U postgres -c "SHOW hba_file"

# 编辑文件
sudo nano /path/to/pg_hba.conf
```

添加或修改：

```
# IPv4 local connections:
host    all             all             127.0.0.1/32            md5
```

重启PostgreSQL：

```bash
# macOS (Homebrew)
brew services restart postgresql@14

# Linux
sudo systemctl restart postgresql

# Docker
docker restart mind2build-postgres
```

---

## 4. 配置连接

### 4.1 连接字符串格式

PostgreSQL连接字符串格式：

```
postgresql://[用户名]:[密码]@[主机]:[端口]/[数据库名]?schema=[schema名]
```

### 4.2 项目配置

#### 方法1: 环境变量（推荐）

创建或编辑 `.env` 文件：

```bash
# 基本配置
DATABASE_URL="postgresql://postgres:123456@127.0.0.1:5432/ainative?schema=public"

# 连接池配置
DB_POOL_MIN=2
DB_POOL_MAX=10
```

#### 方法2: 配置文件

创建 `config/database.json`:

```json
{
  "development": {
    "url": "postgresql://postgres:123456@127.0.0.1:5432/ainative?schema=public",
    "pool": {
      "min": 2,
      "max": 10
    }
  },
  "production": {
    "url": "postgresql://user:pass@prod-host:5432/ainative?schema=public",
    "pool": {
      "min": 5,
      "max": 20
    }
  },
  "test": {
    "url": "postgresql://postgres:123456@127.0.0.1:5432/ai_test?schema=public",
    "pool": {
      "min": 1,
      "max": 5
    }
  }
}
```

### 4.3 连接参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| **用户名** | 数据库用户 | `postgres` |
| **密码** | 用户密码 | `123456` |
| **主机** | 数据库服务器地址 | `127.0.0.1` 或 `localhost` |
| **端口** | 服务端口 | `5432`（默认） |
| **数据库名** | 目标数据库 | `ai` |
| **schema** | 数据库模式 | `public`（默认） |

### 4.4 测试连接

#### 使用psql命令行

```bash
psql "postgresql://postgres:123456@127.0.0.1:5432/ainative?schema=public"
```

#### 使用Node.js测试

创建 `test-db.js`:

```javascript
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:123456@127.0.0.1:5432/ainative?schema=public'
});

async function testConnection() {
  try {
    await client.connect();
    console.log('✅ 数据库连接成功！');
    
    const result = await client.query('SELECT NOW()');
    console.log('当前时间:', result.rows[0].now);
    
    await client.end();
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
  }
}

testConnection();
```

运行测试：

```bash
node test-db.js
```

---

## 5. Prisma设置

### 5.1 安装Prisma

```bash
# 进入database目录
cd database

# 安装Prisma CLI
npm install -D prisma

# 安装Prisma Client
npm install @prisma/client
```

### 5.2 初始化Prisma

```bash
# 初始化Prisma（如果还没有）
npx prisma init

# 这将创建：
# - prisma/schema.prisma
# - .env（如果不存在）
```

### 5.3 配置Prisma Schema

编辑 `database/prisma/schema.prisma`:

```prisma
// 数据源配置
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 生成器配置
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/@prisma/client"
}

// 数据模型定义
model Project {
  id          String   @id @default(uuid())
  name        String
  description String?
  status      String   @default("active")
  teamId      String
  team        Team     @relation(fields: [teamId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([teamId])
  @@index([status])
  @@map("projects")
}

model Team {
  id        String    @id @default(uuid())
  name      String
  budget    Float     @default(0)
  projects  Project[]
  roles     Role[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  
  @@map("teams")
}

model Role {
  id       String   @id @default(uuid())
  name     String
  profile  String
  teamId   String
  team     Team     @relation(fields: [teamId], references: [id])
  messages Message[]
  
  @@index([teamId])
  @@map("roles")
}

model Message {
  id        String   @id @default(uuid())
  content   String   @db.Text
  roleId    String
  role      Role     @relation(fields: [roleId], references: [id])
  metadata  Json?
  createdAt DateTime @default(now())
  
  @@index([roleId])
  @@index([createdAt])
  @@map("messages")
}
```

### 5.4 配置环境变量

在 `database/.env` 中：

```bash
DATABASE_URL="postgresql://postgres:123456@127.0.0.1:5432/ainative?schema=public"
```

---

## 6. 数据迁移

### 6.1 创建迁移

```bash
# 创建初始迁移
npx prisma migrate dev --name init

# 创建新的迁移（修改schema后）
npx prisma migrate dev --name add_users_table
```

### 6.2 应用迁移

```bash
# 开发环境
npx prisma migrate dev

# 生产环境
npx prisma migrate deploy

# 重置数据库（警告：会删除所有数据）
npx prisma migrate reset
```

### 6.3 生成Prisma Client

```bash
# 生成客户端
npx prisma generate

# 更新客户端
npx prisma generate --watch
```

### 6.4 查看数据库

```bash
# 启动Prisma Studio（可视化界面）
npx prisma studio

# 浏览器访问：http://localhost:5555
```

### 6.5 种子数据

创建 `database/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 创建示例团队
  const team = await prisma.team.create({
    data: {
      name: 'Demo Team',
      budget: 100.0,
      projects: {
        create: [
          {
            name: 'Demo Project',
            description: 'A demo project',
            status: 'active'
          }
        ]
      }
    }
  });

  console.log('✅ 种子数据创建成功:', team);
}

main()
  .catch((e) => {
    console.error('❌ 种子数据创建失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

在 `package.json` 中添加：

```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

运行种子数据：

```bash
npx prisma db seed
```

---

## 7. 常见问题

### Q1: 连接被拒绝

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**解决方法**:
1. 检查PostgreSQL是否运行：`pg_isready`
2. 检查端口是否正确：`sudo lsof -i :5432`
3. 启动PostgreSQL服务

### Q2: 认证失败

```
Error: password authentication failed for user "postgres"
```

**解决方法**:
1. 检查用户名和密码是否正确
2. 重置密码：

```bash
# Linux
sudo -u postgres psql
ALTER USER postgres PASSWORD '123456';

# macOS
psql -U postgres
ALTER USER postgres PASSWORD '123456';
```

### Q3: 数据库不存在

```
Error: database "ai" does not exist
```

**解决方法**:
```bash
# 连接到postgres数据库
psql -U postgres

# 创建数据库
CREATE DATABASE ai;
```

### Q4: Prisma迁移失败

**解决方法**:
```bash
# 查看迁移状态
npx prisma migrate status

# 解决迁移冲突
npx prisma migrate resolve --applied 20231225000000_migration_name

# 重置并重新迁移（开发环境）
npx prisma migrate reset
npx prisma migrate dev
```

### Q5: 连接池耗尽

```
Error: Timeout while acquiring connection from pool
```

**解决方法**:
```bash
# 增加连接池大小
DB_POOL_MAX=20

# 减少连接超时时间
DB_CONNECTION_TIMEOUT=10000
```

---

## 8. 最佳实践

### 8.1 开发环境

```bash
# 使用Docker Compose
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:14
    container_name: mind2build-db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: 123456
      POSTGRES_DB: ai
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

启动：
```bash
docker-compose up -d
```

### 8.2 生产环境

**安全配置**:
```bash
# 使用强密码
DATABASE_URL="postgresql://prod_user:StrongP@ssw0rd!@db-host:5432/ainative?schema=public"

# 使用SSL
DATABASE_URL="postgresql://user:pass@host:5432/ainative?schema=public&sslmode=require"

# 限制连接数
DB_POOL_MAX=20
```

**连接池优化**:
```typescript
// database/src/client.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error']
});

export default prisma;
```

### 8.3 备份策略

```bash
# 备份数据库
pg_dump -U postgres -d ai -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# 恢复数据库
pg_restore -U postgres -d ai -c backup_20231225_120000.dump
```

自动化备份脚本：

```bash
#!/bin/bash
# database/scripts/backup.sh

BACKUP_DIR="./backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="ai_backup_${TIMESTAMP}.dump"

mkdir -p $BACKUP_DIR

pg_dump -U postgres -d ai -F c -f "$BACKUP_DIR/$FILENAME"

if [ $? -eq 0 ]; then
    echo "✅ 备份成功: $FILENAME"
    # 删除7天前的备份
    find $BACKUP_DIR -name "*.dump" -mtime +7 -delete
else
    echo "❌ 备份失败"
    exit 1
fi
```

### 8.4 性能优化

**创建索引**:
```sql
-- 为常用查询创建索引
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_roles_team_id ON roles(team_id);
```

**查询优化**:
```typescript
// 使用select选择必要字段
const projects = await prisma.project.findMany({
  select: {
    id: true,
    name: true,
    status: true
  }
});

// 使用include预加载关联
const team = await prisma.team.findUnique({
  where: { id: teamId },
  include: {
    projects: true,
    roles: true
  }
});
```

### 8.5 监控和日志

```typescript
// 添加查询日志中间件
prisma.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const after = Date.now();
  
  console.log(`Query ${params.model}.${params.action} took ${after - before}ms`);
  
  return result;
});
```

---

## 9. 参考资源

### 官方文档
- **PostgreSQL**: https://www.postgresql.org/docs/
- **Prisma**: https://www.prisma.io/docs/

### 相关文档
- [18_数据库设计_DATABASE.md](./18_数据库设计_DATABASE.md)
- [19_目录结构设计_STRUCTURE.md](./19_目录结构设计_STRUCTURE.md)
- [14_开发指南_DEVELOPMENT.md](./14_开发指南_DEVELOPMENT.md)

---

**配置完成后，你的数据库就可以正常使用了！** 🎉

**下一步**: 运行 `npx prisma migrate dev` 创建数据表

