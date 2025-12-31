# mind2build 数据库设计文档

**文档版本**: v1.1  
**创建日期**: 2025-12-24  
**最后更新**: 2025-12-25  
**数据库类型**: PostgreSQL  
**主键类型**: UUID (使用 `gen_random_uuid()`)

---

## 目录

1. [概述](#1-概述)
2. [ER 图](#2-er-图)
3. [表结构设计](#3-表结构设计)
4. [索引设计](#4-索引设计)
5. [数据字典](#5-数据字典)
6. [SQL 脚本](#6-sql-脚本)

---

## 1. 概述

### 1.1 设计原则

- **可扩展性**: 支持水平扩展和分表
- **性能优化**: 合理的索引和分区策略
- **数据完整性**: 外键约束和数据验证
- **审计追踪**: 记录创建和更新时间
- **软删除**: 重要数据不物理删除

### 1.2 核心实体

| 实体 | 说明 | 优先级 |
|------|------|--------|
| users | 用户信息 | P0 |
| applications | 应用信息（组织项目） | P0 |
| projects | 项目信息 | P0 |
| teams | 团队信息 | P0 |
| roles | 角色实例 | P0 |
| messages | 消息记录 | P0 |
| actions | 行动记录 | P1 |
| documents | 生成的文档 | P1 |
| cost_records | 成本记录 | P1 |
| memories | 长期记忆 | P2 |
| embeddings | 向量嵌入 | P2 |

---

## 2. ER 图

```mermaid
erDiagram
    users ||--o{ applications : creates
    users ||--o{ projects : creates
    users ||--o{ teams : owns
    applications ||--o{ projects : contains
    projects ||--|| teams : has
    teams ||--o{ roles : contains
    projects ||--o{ messages : generates
    projects ||--o{ documents : outputs
    projects ||--o{ cost_records : tracks
    roles ||--o{ messages : sends
    roles ||--o{ actions : executes
    messages ||--o{ actions : triggers
    roles ||--o{ memories : stores
    memories ||--o{ embeddings : has
    
    users {
        uuid id PK
        string username UK
        string email UK
        string password_hash
        json config
        timestamp created_at
        timestamp updated_at
    }
    
    applications {
        uuid id PK
        uuid user_id FK
        string name
        text description
        json metadata
        timestamp created_at
        timestamp updated_at
    }
    
    projects {
        uuid id PK
        uuid user_id FK
        uuid application_id FK
        string name
        text idea
        string status
        json metadata
        timestamp created_at
        timestamp updated_at
    }
    
    teams {
        uuid id PK
        uuid project_id FK
        uuid user_id FK
        decimal investment
        string status
        json config
        json state
        timestamp created_at
        timestamp updated_at
    }
    
    roles {
        uuid id PK
        uuid team_id FK
        string name
        string profile
        text goal
        json state
        json actions_list
        json watch_actions
        timestamp created_at
        timestamp updated_at
    }
    
    messages {
        uuid id PK
        uuid project_id FK
        uuid role_id FK
        uuid message_uuid UK
        text content
        json instruct_content
        string role_type
        string cause_by
        string sent_from
        json send_to
        json metadata
        timestamp created_at
    }
    
    actions {
        uuid id PK
        uuid role_id FK
        uuid message_id FK
        string action_type
        json input_data
        json output_data
        string status
        double duration
        timestamp created_at
    }
    
    documents {
        uuid id PK
        uuid project_id FK
        string filename
        string doc_type
        text content
        string storage_path
        int version
        boolean is_deleted
        uuid parent_id FK
        timestamp created_at
    }
    
    cost_records {
        uuid id PK
        uuid project_id FK
        uuid role_id FK
        string model
        int prompt_tokens
        int completion_tokens
        int total_tokens
        double cost
        timestamp created_at
    }
```

---

## 3. 表结构设计

### 3.1 users (用户表)

**用途**: 存储用户账户信息

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    avatar_url VARCHAR(500),
    api_keys JSONB DEFAULT '{}',  -- 存储各种 LLM API Keys (加密)
    config JSONB DEFAULT '{}',     -- 用户配置
    status VARCHAR(20) DEFAULT 'active',  -- active, inactive, banned
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
```

**字段说明**:
- `id`: UUID主键，使用`gen_random_uuid()`自动生成
- `api_keys`: 加密存储的 API Keys (OpenAI, Claude 等)
- `config`: 用户偏好配置 (默认模型、预算等)
- `deleted_at`: 软删除标记

---

### 3.2 applications (应用表)

**用途**: 存储应用信息，用于组织相关项目

```sql
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_created_at ON applications(created_at DESC);
```

**字段说明**:
- `id`: UUID主键
- `user_id`: 所属用户
- `name`: 应用名称
- `description`: 应用描述
- `metadata`: 额外元数据
- `deleted_at`: 软删除标记

---

### 3.3 projects (项目表)

**用途**: 存储项目基本信息

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    idea TEXT NOT NULL,                    -- 项目需求/想法
    description TEXT,
    project_path VARCHAR(500),             -- 项目文件路径
    status VARCHAR(20) DEFAULT 'pending',  -- pending, running, completed, failed
    progress INT DEFAULT 0,                 -- 进度 0-100
    n_round INT DEFAULT 5,                  -- 计划轮数
    current_round INT DEFAULT 0,            -- 当前轮数
    investment DECIMAL(10,2) DEFAULT 10.0,          -- 预算
    total_cost DECIMAL(10,2) DEFAULT 0.0,           -- 实际花费
    metadata JSONB DEFAULT '{}',            -- 其他元数据
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_application_id ON projects(application_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
```

**字段说明**:
- `id`: UUID主键
- `application_id`: 所属应用（可选，用于组织项目）
- `status`: 
  - `pending`: 待开始
  - `running`: 运行中
  - `completed`: 已完成
  - `failed`: 失败
  - `cancelled`: 已取消
- `metadata`: 存储额外配置 (code_review, run_tests 等)

---

### 3.4 teams (团队表)

**用途**: 存储团队信息（一个项目对应一个团队）

```sql
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    investment DECIMAL(10,2) DEFAULT 10.0,
    idea TEXT NOT NULL,
    use_mgx BOOLEAN DEFAULT true,
    env_type VARCHAR(50) DEFAULT 'Environment',  -- Environment, MGXEnv
    status VARCHAR(20) DEFAULT 'idle',  -- idle, running, stopped
    config JSONB DEFAULT '{}',
    state JSONB DEFAULT '{}',           -- 序列化的团队状态
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_teams_project_id ON teams(project_id);
CREATE INDEX idx_teams_status ON teams(status);
```

---

### 3.5 roles (角色表)

**用途**: 存储角色实例信息

```sql
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    profile VARCHAR(100) NOT NULL,        -- ProductManager, Architect, Engineer
    goal TEXT,
    constraints TEXT,
    description TEXT,
    is_idle BOOLEAN DEFAULT true,
    state_index INT DEFAULT 0,
    max_react_loop INT DEFAULT 1,
    react_mode VARCHAR(20) DEFAULT 'react',  -- react, by_order, plan_and_act
    enable_memory BOOLEAN DEFAULT true,
    use_fixed_sop BOOLEAN DEFAULT false,
    tools JSONB DEFAULT '[]',              -- 工具列表
    actions_list JSONB DEFAULT '[]',            -- Action 类型列表（注意：字段名为actions_list）
    watch_actions JSONB DEFAULT '[]',      -- 订阅的 Action
    state JSONB DEFAULT '{}',              -- 序列化的角色状态
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_roles_team_id ON roles(team_id);
CREATE INDEX idx_roles_profile ON roles(profile);
CREATE INDEX idx_roles_is_idle ON roles(is_idle);
```

**字段说明**:
- `id`: UUID主键
- `profile`: 角色类型 (ProductManager, Architect, Engineer, QAEngineer, TeamLeader, Salesperson, DataAnalyst)
- `actions_list`: Action类型列表（注意：实际字段名为`actions_list`而非`actions`）
- `state`: 完整的 RoleContext 序列化数据

---

### 3.6 messages (消息表)

**用途**: 存储所有消息记录

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_uuid UUID UNIQUE NOT NULL,  -- Message.id (UUID格式)
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,       -- 发送者角色 (NULL 表示用户)
    content TEXT NOT NULL,
    instruct_content JSONB,                    -- 结构化内容
    role_type VARCHAR(50) NOT NULL,      -- system, user, assistant
    cause_by VARCHAR(100) NOT NULL,                     -- 触发的 Action 类名
    sent_from VARCHAR(100) NOT NULL,                    -- 发送者标识
    send_to JSONB NOT NULL,                -- 接收者列表
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_project_id ON messages(project_id);
CREATE INDEX idx_messages_role_id ON messages(role_id);
CREATE INDEX idx_messages_cause_by ON messages(cause_by);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
```

**字段说明**:
- `id`: UUID主键
- `message_uuid`: 对应 Message.id (UUID格式)
- `instruct_content`: 结构化的指令内容
- `cause_by`: 触发此消息的 Action 类名

---

### 3.7 actions (行动记录表)

**用途**: 记录所有 Action 的执行

```sql
CREATE TABLE actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,  -- 触发的消息
    action_type VARCHAR(100) NOT NULL,          -- WritePRD, WriteDesign, WriteCode
    input_data JSONB,                           -- 输入数据
    output_data JSONB,                          -- 输出数据
    status VARCHAR(20) DEFAULT 'pending',       -- pending, running, completed, failed
    duration DOUBLE PRECISION,                     -- 执行时长（秒）
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_actions_role_id ON actions(role_id);
CREATE INDEX idx_actions_message_id ON actions(message_id);
CREATE INDEX idx_actions_action_type ON actions(action_type);
CREATE INDEX idx_actions_status ON actions(status);
```

**字段说明**:
- `id`: UUID主键
- `action_type`: Action 类名 (WritePRD, WriteDesign, WriteCode, ExecuteSubtask等)
- `duration`: 执行时长，用于性能分析

---

### 3.8 documents (文档表)

**用途**: 存储生成的文档（支持版本管理和软删除）

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    doc_type VARCHAR(50) NOT NULL,          -- PRD, Design, Code, Test, README
    content TEXT NOT NULL,                            -- 文档内容
    storage_path VARCHAR(500),               -- 外部存储路径
    metadata JSONB DEFAULT '{}',
    version INT DEFAULT 1,                   -- 版本号
    is_deleted BOOLEAN DEFAULT FALSE,        -- 软删除标记
    deleted_at TIMESTAMP,
    parent_id UUID REFERENCES documents(id) ON DELETE SET NULL,  -- 父版本引用
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_documents_doc_type ON documents(doc_type);
CREATE INDEX idx_documents_version ON documents(version);
CREATE INDEX idx_documents_parent_id ON documents(parent_id);
CREATE INDEX idx_documents_is_deleted ON documents(is_deleted);
CREATE INDEX idx_documents_prd_version ON documents(project_id, doc_type, version) WHERE doc_type = 'prd';
```

**字段说明**:
- `id`: UUID主键
- `doc_type`: PRD, Design, Code, Test, README, Config
- `version`: 文档版本号，从1开始
- `is_deleted`: 软删除标记，用于PRD版本管理
- `parent_id`: 指向父版本，形成版本链

---

### 3.9 cost_records (成本记录表)

**用途**: 跟踪 LLM 调用成本

```sql
CREATE TABLE cost_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    model VARCHAR(50) NOT NULL,
    prompt_tokens INT NOT NULL,
    completion_tokens INT NOT NULL,
    total_tokens INT NOT NULL,
    cost DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cost_records_project_id ON cost_records(project_id);
CREATE INDEX idx_cost_records_role_id ON cost_records(role_id);
CREATE INDEX idx_cost_records_created_at ON cost_records(created_at DESC);
```

**字段说明**:
- `id`: UUID主键
- `cost`: 成本（美元）

---

### 3.10 memories (长期记忆表)

**用途**: 存储角色的长期记忆

```sql
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

CREATE INDEX idx_memories_role_id ON memories(role_id);
CREATE INDEX idx_memories_type ON memories(type);
CREATE INDEX idx_memories_expires_at ON memories(expires_at);
```

---

### 3.11 embeddings (向量嵌入表)

**用途**: 存储文本的向量嵌入（用于语义搜索）

```sql
CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    vector JSONB NOT NULL,
    model VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_embeddings_memory_id ON embeddings(memory_id);
```

**注意**: 当前实现使用JSONB存储向量，未来可考虑使用pgvector扩展

---

### 3.12 project_snapshots (项目快照表) [可选]

**用途**: 保存项目状态快照，用于恢复（当前未实现）

```sql
CREATE TABLE project_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    snapshot_name VARCHAR(200),
    snapshot_type VARCHAR(20) DEFAULT 'manual',  -- manual, auto, checkpoint
    team_state JSONB NOT NULL,                   -- 序列化的 Team 状态
    environment_state JSONB,                     -- 序列化的 Environment 状态
    roles_state JSONB,                           -- 所有角色状态
    messages_count INT,
    documents_count INT,
    total_cost DECIMAL(10,2),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_snapshots_project_id ON project_snapshots(project_id);
CREATE INDEX idx_snapshots_created_at ON project_snapshots(created_at DESC);
```

---

### 3.13 audit_logs (审计日志表) [可选]

**用途**: 记录所有重要操作（当前未实现）

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    entity_type VARCHAR(50) NOT NULL,    -- project, team, role, message
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,         -- create, update, delete, execute
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);
```

---

## 4. 索引设计

### 4.1 主要索引

| 表名 | 索引类型 | 索引字段 | 用途 |
|------|---------|---------|------|
| users | UNIQUE | username, email | 唯一性约束 |
| projects | B-tree | user_id, status | 查询优化 |
| messages | B-tree | project_id, created_at | 时间序列查询 |
| cost_records | B-tree | project_id, model | 成本统计 |
| embeddings | IVFFlat | embedding_vector | 向量相似度搜索 |

### 4.2 复合索引

```sql
-- 项目消息查询优化
CREATE INDEX idx_messages_project_time ON messages(project_id, created_at DESC);

-- 角色行动查询
CREATE INDEX idx_actions_role_status ON actions(role_id, status);

-- 成本分析
CREATE INDEX idx_cost_project_model ON cost_records(project_id, model, created_at);
```

---

## 5. 数据字典

### 5.1 状态枚举

**项目状态 (project.status)**:
- `pending`: 待开始
- `running`: 运行中
- `completed`: 已完成
- `failed`: 失败
- `cancelled`: 已取消

**角色类型 (role.profile)**:
- `ProductManager`: 产品经理
- `Architect`: 架构师
- `Engineer`: 工程师
- `QAEngineer`: QA 工程师
- `TeamLeader`: 团队领导
- `DataInterpreter`: 数据解释器

**文档类型 (document.doc_type)**:
- `PRD`: 产品需求文档
- `Design`: 设计文档
- `Code`: 源代码
- `Test`: 测试代码
- `README`: 说明文档
- `Config`: 配置文件

---

## 6. SQL 脚本

### 6.1 完整建表脚本

```sql
-- 启用必要的扩展
-- PostgreSQL 13+ 内置 gen_random_uuid()，无需 uuid-ossp 扩展

-- 创建数据库
CREATE DATABASE mind2build_db
    WITH 
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8';

\c mind2build_db;

-- 创建所有表（顺序很重要，考虑外键依赖）
-- 1. users
-- 2. applications
-- 3. projects
-- 4. teams
-- 5. roles
-- 6. messages
-- 7. actions
-- 8. documents
-- 9. cost_records
-- 10. memories
-- 11. embeddings

-- (完整 SQL 见上面各表定义)
-- 实际迁移脚本见: backend/src/database/migrations/001_initial.sql
```

### 6.2 常用查询示例

**查询项目总成本**:
```sql
SELECT 
    p.id,
    p.name,
    SUM(cr.cost) as total_cost,
    SUM(cr.total_tokens) as total_tokens
FROM projects p
LEFT JOIN cost_records cr ON p.id = cr.project_id
WHERE p.user_id = $1::uuid
GROUP BY p.id, p.name
ORDER BY total_cost DESC;
```

**查询角色消息历史**:
```sql
SELECT 
    m.*,
    r.name as role_name,
    r.profile
FROM messages m
JOIN roles r ON m.role_id = r.id
WHERE m.project_id = $1::uuid
ORDER BY m.created_at ASC
LIMIT 100;
```

**项目进度统计**:
```sql
SELECT 
    p.id,
    p.name,
    p.status,
    p.current_round,
    p.n_round,
    COUNT(DISTINCT r.id) as role_count,
    COUNT(DISTINCT m.id) as message_count,
    COUNT(DISTINCT d.id) as document_count,
    SUM(cr.cost) as total_cost
FROM projects p
LEFT JOIN teams t ON p.id = t.project_id
LEFT JOIN roles r ON t.id = r.team_id
LEFT JOIN messages m ON p.id = m.project_id
LEFT JOIN documents d ON p.id = d.project_id
LEFT JOIN cost_records cr ON p.id = cr.project_id
WHERE p.id = $1::uuid
GROUP BY p.id;
```

---

## 7. TypeScript/Node.js 模型示例

当前项目使用TypeScript + PostgreSQL，使用原生SQL查询和Repository模式。

**Repository示例**:
```typescript
// backend/src/database/repositories/ProjectRepository.ts
export class ProjectRepository {
  async create(data: CreateProjectData): Promise<Project> {
    const result = await db.query(
      `INSERT INTO projects (id, user_id, name, idea, ...)
       VALUES (gen_random_uuid(), $1, $2, $3, ...)
       RETURNING *`,
      [data.userId, data.name, data.idea, ...]
    );
    return result.rows[0];
  }
  
  async findById(id: string): Promise<Project | null> {
    const result = await db.query(
      'SELECT * FROM projects WHERE id = $1::uuid',
      [id]
    );
    return result.rows[0] || null;
  }
}
```

**注意**: 
- 所有ID字段使用UUID类型
- 使用参数化查询防止SQL注入
- 使用`gen_random_uuid()`生成UUID

---

## 8. 数据迁移策略

### 8.1 版本管理

当前项目使用SQL迁移脚本：

```bash
# 运行迁移
cd backend
pnpm db:migrate

# 初始化LLM配置
pnpm db:init-llm

# 初始化Prompt配置
pnpm db:init-prompts
```

迁移脚本位置: `backend/src/database/migrations/`

### 8.2 数据备份

```bash
# 备份
pg_dump mind2build_db > backup_$(date +%Y%m%d).sql

# 恢复
psql mind2build_db < backup_20251224.sql
```

---

## 9. 性能优化建议

### 9.1 分区策略

对于大数据量表，建议分区：

```sql
-- messages 表按月分区
CREATE TABLE messages (
    -- 字段定义...
) PARTITION BY RANGE (created_at);

CREATE TABLE messages_2025_01 PARTITION OF messages
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### 9.2 缓存策略

- 使用 Redis 缓存热点数据
- 项目列表缓存 5 分钟
- 用户配置缓存 30 分钟
- 成本统计缓存 1 小时

### 9.3 读写分离

- 主库：写操作
- 从库：读操作和统计查询
- 使用 PostgreSQL 流复制

---

## 10. 安全建议

1. **API Key 加密**: 使用 AES-256 加密存储
2. **SQL 注入防护**: 使用参数化查询
3. **访问控制**: 行级安全策略 (RLS)
4. **审计日志**: 记录所有敏感操作
5. **备份策略**: 每日全量备份 + 增量备份

---

## 附录

### A. 表空间估算

假设 1000 个活跃项目，每个项目平均：
- 消息：500 条
- 文档：20 个
- 成本记录：100 条

预估存储：
- messages: ~500MB
- documents: ~2GB (内容)
- cost_records: ~50MB
- **总计**: ~3-5GB

### B. 参考资料

- PostgreSQL 官方文档
- SQLAlchemy 文档
- pgvector 扩展文档

---

**文档维护**: 随系统演进更新  
**最后更新**: 2025-12-25

**重要变更**:
- ✅ 所有主键从BIGSERIAL改为UUID
- ✅ 添加applications表用于组织项目
- ✅ documents表支持版本管理和软删除
- ✅ roles表的actions字段实际名为actions_list
