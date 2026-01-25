-- ============================================================================
-- Mind2Build 数据库 Schema V2
-- 完全重新设计的数据库结构
-- 创建日期: 2026-01-25
-- 表数量: 18 张
-- ============================================================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. users（用户表）
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    avatar_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'active',  -- active, inactive, banned
    config JSONB DEFAULT '{}',             -- 用户偏好配置
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;

COMMENT ON TABLE users IS '用户账户表';
COMMENT ON COLUMN users.status IS '用户状态: active, inactive, banned';
COMMENT ON COLUMN users.config IS '用户偏好配置（JSON）';

-- ============================================================================
-- 2. applications（应用/业务线表）
-- ============================================================================
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

COMMENT ON TABLE applications IS '应用/业务线表，用于组织相关项目';

-- ============================================================================
-- 3. projects（项目表 - 合并原 teams 表）
-- ============================================================================
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
    
    -- 基本信息
    name VARCHAR(200) NOT NULL,
    idea TEXT NOT NULL,                      -- 项目需求/想法
    description TEXT,
    
    -- 路径和仓库
    workspace_path VARCHAR(500),             -- 工作空间路径
    git_repo_url VARCHAR(500),               -- Git 仓库 URL
    
    -- 状态和进度
    status VARCHAR(20) DEFAULT 'pending',    -- pending, running, completed, failed, cancelled
    progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    
    -- 预算和成本
    budget DECIMAL(10,2) DEFAULT 10.0,       -- 预算金额
    total_cost DECIMAL(10,2) DEFAULT 0.0,    -- 实际花费
    
    -- 团队配置（原 teams 表字段）
    team_status VARCHAR(20) DEFAULT 'idle',  -- idle, running, stopped
    team_config JSONB DEFAULT '{}',          -- 团队配置
    team_state JSONB DEFAULT '{}',           -- 团队运行时状态
    
    -- 元数据
    metadata JSONB DEFAULT '{}',
    
    -- 时间戳
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

COMMENT ON TABLE projects IS '项目表（合并原 teams 表）';
COMMENT ON COLUMN projects.status IS '项目状态: pending, running, completed, failed, cancelled';
COMMENT ON COLUMN projects.team_status IS '团队运行状态: idle, running, stopped';
COMMENT ON COLUMN projects.team_config IS '团队配置（JSON）';
COMMENT ON COLUMN projects.team_state IS '团队运行时状态（JSON）';

-- ============================================================================
-- 4. roles（角色运行实例表）
-- ============================================================================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- 角色标识
    profile VARCHAR(100) NOT NULL,           -- 角色类型：ProductManager, Architect, Engineer 等
    name VARCHAR(100) NOT NULL,              -- 角色名称
    
    -- 角色配置
    goal TEXT,
    constraints TEXT,
    description TEXT,
    
    -- 运行状态
    is_idle BOOLEAN DEFAULT true,
    react_mode VARCHAR(20) DEFAULT 'react',  -- react, by_order, plan_and_act
    
    -- Action 配置
    actions_list JSONB DEFAULT '[]',         -- 可执行的 Action 列表
    watch_actions JSONB DEFAULT '[]',        -- 订阅的 Action
    
    -- 运行时状态（序列化的 RoleContext）
    state JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(project_id, profile)
);

CREATE INDEX idx_roles_project_id ON roles(project_id);
CREATE INDEX idx_roles_profile ON roles(profile);

COMMENT ON TABLE roles IS '角色运行实例表';
COMMENT ON COLUMN roles.profile IS '角色类型: ProductManager, Architect, Engineer, QAEngineer 等';
COMMENT ON COLUMN roles.react_mode IS '反应模式: react, by_order, plan_and_act';
COMMENT ON COLUMN roles.state IS '序列化的 RoleContext 数据';

-- ============================================================================
-- 5. messages（消息记录表）
-- ============================================================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    message_uuid UUID NOT NULL UNIQUE,       -- 消息业务 UUID
    role_profile VARCHAR(100),               -- 发送者角色类型，'user' 表示用户消息
    
    -- 消息内容
    content TEXT NOT NULL,
    instruct_content JSONB,                  -- 结构化指令内容
    
    -- 消息元信息
    role_type VARCHAR(50) NOT NULL,          -- system, user, assistant
    cause_by VARCHAR(100) NOT NULL,          -- 触发此消息的 Action
    sent_from VARCHAR(100) NOT NULL,         -- 发送者标识
    send_to JSONB NOT NULL DEFAULT '[]',     -- 接收者列表
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_project_id ON messages(project_id);
CREATE INDEX idx_messages_role_profile ON messages(role_profile);
CREATE INDEX idx_messages_cause_by ON messages(cause_by);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

COMMENT ON TABLE messages IS '消息记录表';
COMMENT ON COLUMN messages.role_profile IS '发送者角色类型，user 表示用户消息';
COMMENT ON COLUMN messages.role_type IS '消息角色: system, user, assistant';
COMMENT ON COLUMN messages.cause_by IS '触发此消息的 Action 类名';

-- ============================================================================
-- 6. action_logs（行动执行日志表，原 actions 表改名）
-- ============================================================================
CREATE TABLE action_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    
    action_type VARCHAR(100) NOT NULL,       -- Action 类名
    status VARCHAR(20) DEFAULT 'pending',    -- pending, running, completed, failed
    
    input_data JSONB,                        -- 输入数据
    output_data JSONB,                       -- 输出数据
    
    duration_ms INT,                         -- 执行时长（毫秒）
    error_message TEXT,                      -- 错误信息
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_action_logs_project_id ON action_logs(project_id);
CREATE INDEX idx_action_logs_role_id ON action_logs(role_id);
CREATE INDEX idx_action_logs_action_type ON action_logs(action_type);
CREATE INDEX idx_action_logs_status ON action_logs(status);
CREATE INDEX idx_action_logs_created_at ON action_logs(created_at DESC);

COMMENT ON TABLE action_logs IS '行动执行日志表（原 actions 表）';
COMMENT ON COLUMN action_logs.action_type IS 'Action 类名: WritePRD, WriteDesign, WriteCode 等';
COMMENT ON COLUMN action_logs.status IS '执行状态: pending, running, completed, failed';
COMMENT ON COLUMN action_logs.duration_ms IS '执行时长（毫秒）';

-- ============================================================================
-- 7. documents（文档表，支持版本管理）
-- ============================================================================
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    filename VARCHAR(255) NOT NULL,
    doc_type VARCHAR(50) NOT NULL,           -- mrd, prd, design, code, test, readme, other
    content TEXT NOT NULL,
    storage_path VARCHAR(500),               -- 外部存储路径
    
    -- 版本管理
    version INT DEFAULT 1,
    parent_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_documents_doc_type ON documents(doc_type);
CREATE INDEX idx_documents_version ON documents(project_id, doc_type, version);
CREATE INDEX idx_documents_parent_id ON documents(parent_id);
CREATE INDEX idx_documents_is_deleted ON documents(is_deleted) WHERE is_deleted = FALSE;

COMMENT ON TABLE documents IS '文档表（支持版本管理）';
COMMENT ON COLUMN documents.doc_type IS '文档类型: mrd, prd, design, code, test, readme, other';
COMMENT ON COLUMN documents.version IS '版本号，从1开始';
COMMENT ON COLUMN documents.parent_id IS '父版本ID，形成版本链';

-- ============================================================================
-- 8. cost_records（LLM 调用成本记录表）
-- ============================================================================
CREATE TABLE cost_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    
    provider VARCHAR(50) NOT NULL,           -- LLM 提供商
    model VARCHAR(100) NOT NULL,             -- 模型名称
    
    prompt_tokens INT NOT NULL,
    completion_tokens INT NOT NULL,
    total_tokens INT NOT NULL,
    cost DECIMAL(10,6) NOT NULL,             -- 成本（美元）
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cost_records_project_id ON cost_records(project_id);
CREATE INDEX idx_cost_records_role_id ON cost_records(role_id);
CREATE INDEX idx_cost_records_created_at ON cost_records(created_at DESC);
CREATE INDEX idx_cost_records_provider ON cost_records(provider);

COMMENT ON TABLE cost_records IS 'LLM 调用成本记录表';
COMMENT ON COLUMN cost_records.cost IS '成本（美元），精度到小数点后6位';

-- ============================================================================
-- 9. memories（角色长期记忆表）
-- ============================================================================
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    
    memory_type VARCHAR(50) NOT NULL,        -- 记忆类型
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

CREATE INDEX idx_memories_role_id ON memories(role_id);
CREATE INDEX idx_memories_type ON memories(memory_type);
CREATE INDEX idx_memories_expires_at ON memories(expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON TABLE memories IS '角色长期记忆表';
COMMENT ON COLUMN memories.memory_type IS '记忆类型';
COMMENT ON COLUMN memories.expires_at IS '过期时间（可选）';

-- ============================================================================
-- 10. embeddings（向量嵌入表）
-- ============================================================================
CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    
    vector JSONB NOT NULL,                   -- 向量数据（未来可用 pgvector）
    model VARCHAR(100) NOT NULL,             -- 嵌入模型
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_embeddings_memory_id ON embeddings(memory_id);

COMMENT ON TABLE embeddings IS '向量嵌入表（用于语义搜索）';
COMMENT ON COLUMN embeddings.vector IS '向量数据（JSONB，未来可迁移到 pgvector）';

-- ============================================================================
-- 11. llm_configs（统一 LLM 配置表）
-- ============================================================================
CREATE TABLE llm_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 配置范围
    config_scope VARCHAR(20) NOT NULL DEFAULT 'provider',  -- provider（提供商级）, role（角色级）
    provider VARCHAR(50) NOT NULL,           -- openai, anthropic, zhipuai, ark, deepseek, cursor 等
    role_profile VARCHAR(100),               -- 角色类型（仅 config_scope='role' 时有效）
    
    -- 连接配置
    api_key TEXT,
    base_url VARCHAR(500),
    
    -- 模型配置
    model VARCHAR(100) NOT NULL,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INT DEFAULT 8000,
    
    -- Cursor Agent 专用配置
    repository VARCHAR(500),                 -- GitHub 仓库 URL
    branch_name VARCHAR(100),                -- 分支名称
    auto_create_pr BOOLEAN DEFAULT true,
    
    -- 状态
    is_active BOOLEAN DEFAULT false,         -- 是否为默认激活配置
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- 唯一约束：每个用户每个提供商（或角色）只能有一个配置
CREATE UNIQUE INDEX idx_llm_configs_unique ON llm_configs(user_id, provider, COALESCE(role_profile, ''))
    WHERE deleted_at IS NULL;

CREATE INDEX idx_llm_configs_user_id ON llm_configs(user_id);
CREATE INDEX idx_llm_configs_provider ON llm_configs(provider);
CREATE INDEX idx_llm_configs_scope ON llm_configs(config_scope);
CREATE INDEX idx_llm_configs_role ON llm_configs(role_profile) WHERE role_profile IS NOT NULL;
CREATE INDEX idx_llm_configs_active ON llm_configs(user_id, is_active) WHERE is_active = true;

COMMENT ON TABLE llm_configs IS '统一 LLM 配置表（合并原 llm_configs、llm_provider_configs、role_llm_configs）';
COMMENT ON COLUMN llm_configs.config_scope IS '配置范围: provider（提供商级默认）, role（角色专属）';
COMMENT ON COLUMN llm_configs.role_profile IS '角色类型，仅 config_scope=role 时有效';
COMMENT ON COLUMN llm_configs.is_active IS '是否为激活的默认配置';

-- ============================================================================
-- 12. prompt_configs（Prompt 模板配置表）
-- ============================================================================
CREATE TABLE prompt_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    prompt_type VARCHAR(50) NOT NULL,        -- mrd, prd, design, code, test, task
    prompt_key VARCHAR(100) NOT NULL,        -- system_prompt, template, review_prompt 等
    content TEXT NOT NULL,
    description TEXT,
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    UNIQUE(user_id, prompt_type, prompt_key)
);

CREATE INDEX idx_prompt_configs_user_id ON prompt_configs(user_id);
CREATE INDEX idx_prompt_configs_type ON prompt_configs(prompt_type);
CREATE INDEX idx_prompt_configs_active ON prompt_configs(is_active) WHERE is_active = true;

COMMENT ON TABLE prompt_configs IS 'Prompt 模板配置表';
COMMENT ON COLUMN prompt_configs.prompt_type IS '提示类型: mrd, prd, design, code, test, task';
COMMENT ON COLUMN prompt_configs.prompt_key IS '提示键: system_prompt, template, review_prompt 等';

-- ============================================================================
-- 13. knowledge_base（知识库文档表）
-- ============================================================================
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    description TEXT,
    
    tags TEXT[] DEFAULT '{}',                -- 标签数组
    metadata JSONB DEFAULT '{}',
    
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_knowledge_base_project_id ON knowledge_base(project_id);
CREATE INDEX idx_knowledge_base_tags ON knowledge_base USING GIN(tags);
CREATE INDEX idx_knowledge_base_active ON knowledge_base(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE knowledge_base IS '知识库文档表（用于 RAG 检索）';
COMMENT ON COLUMN knowledge_base.tags IS '标签数组，用于分类和过滤';

-- ============================================================================
-- 14. section_conversations（文档章节对话表）
-- ============================================================================
CREATE TABLE section_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    
    document_type VARCHAR(50) NOT NULL DEFAULT 'prd',
    section_number INT NOT NULL,
    version INT DEFAULT 1,
    
    messages JSONB NOT NULL DEFAULT '[]',    -- 对话消息数组
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(project_id, document_type, section_number, version)
);

CREATE INDEX idx_section_conversations_project_id ON section_conversations(project_id);
CREATE INDEX idx_section_conversations_document_id ON section_conversations(document_id);
CREATE INDEX idx_section_conversations_lookup ON section_conversations(project_id, document_type, section_number, version);

COMMENT ON TABLE section_conversations IS '文档章节对话表';
COMMENT ON COLUMN section_conversations.messages IS '对话消息数组（JSON）';

-- ============================================================================
-- 15. role_definitions（角色元定义表）
-- ============================================================================
CREATE TABLE role_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    profile VARCHAR(100) NOT NULL UNIQUE,    -- 角色类型标识
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    
    goal TEXT,
    constraints TEXT,
    description TEXT,
    class_name VARCHAR(100) NOT NULL,        -- 代码类名
    
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_role_definitions_profile ON role_definitions(profile);
CREATE INDEX idx_role_definitions_active ON role_definitions(is_active) WHERE is_active = true;

COMMENT ON TABLE role_definitions IS '角色元定义表（系统级角色定义）';
COMMENT ON COLUMN role_definitions.profile IS '角色类型标识（唯一）';
COMMENT ON COLUMN role_definitions.class_name IS '对应的代码类名';

-- ============================================================================
-- 16. action_definitions（Action 元定义表）
-- ============================================================================
CREATE TABLE action_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    name VARCHAR(100) NOT NULL UNIQUE,       -- Action 名称标识
    display_name VARCHAR(200),
    description TEXT,
    class_name VARCHAR(100) NOT NULL,        -- 代码类名
    category VARCHAR(50),                    -- document_writing, review, improvement
    
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_action_definitions_name ON action_definitions(name);
CREATE INDEX idx_action_definitions_category ON action_definitions(category);
CREATE INDEX idx_action_definitions_active ON action_definitions(is_active) WHERE is_active = true;

COMMENT ON TABLE action_definitions IS 'Action 元定义表（系统级 Action 定义）';
COMMENT ON COLUMN action_definitions.name IS 'Action 名称标识（唯一）';
COMMENT ON COLUMN action_definitions.category IS 'Action 分类: document_writing, review, improvement';

-- ============================================================================
-- 17. application_workflows（应用工作流配置表）
-- ============================================================================
CREATE TABLE application_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    
    name VARCHAR(200) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    
    -- 工作流配置 JSON
    -- { roles: [{ profile, name, order, actions, watch_actions }] }
    workflow_config JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_application_workflows_app_id ON application_workflows(application_id);
CREATE UNIQUE INDEX idx_application_workflows_default ON application_workflows(application_id) WHERE is_default = true;

COMMENT ON TABLE application_workflows IS '应用工作流配置表';
COMMENT ON COLUMN application_workflows.workflow_config IS '工作流配置 JSON: { roles: [{ profile, name, order, actions, watch_actions }] }';
COMMENT ON COLUMN application_workflows.is_default IS '是否为默认工作流（每个应用只能有一个）';

-- 触发器：确保每个应用只有一个默认工作流
CREATE OR REPLACE FUNCTION ensure_single_default_workflow()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE application_workflows
    SET is_default = false, updated_at = NOW()
    WHERE application_id = NEW.application_id AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_single_default_workflow
BEFORE INSERT OR UPDATE ON application_workflows
FOR EACH ROW EXECUTE FUNCTION ensure_single_default_workflow();

-- ============================================================================
-- 18. workflow_executions（工作流执行实例表）
-- ============================================================================
CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    
    -- 工作流快照（创建时固化）
    workflow_snapshot JSONB NOT NULL,
    
    -- 执行状态
    state VARCHAR(30) NOT NULL DEFAULT 'initialized',  -- initialized, running, waiting_confirmation, paused, completed, failed
    
    -- 当前位置 { roleIndex, actionIndex }
    current_position JSONB,
    
    -- 所有步骤状态数组
    steps JSONB NOT NULL DEFAULT '[]',
    
    -- 待确认信息
    pending_confirmation JSONB,
    
    -- 错误信息
    last_error JSONB,
    
    -- 执行上下文
    execution_context JSONB DEFAULT '{}',
    
    -- 乐观锁版本号
    version INT NOT NULL DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_workflow_executions_project ON workflow_executions(project_id);
CREATE INDEX idx_workflow_executions_state ON workflow_executions(state);
CREATE INDEX idx_workflow_executions_updated ON workflow_executions(updated_at DESC);

COMMENT ON TABLE workflow_executions IS '工作流执行实例表（统一状态管理）';
COMMENT ON COLUMN workflow_executions.state IS '工作流状态: initialized, running, waiting_confirmation, paused, completed, failed';
COMMENT ON COLUMN workflow_executions.workflow_snapshot IS '工作流配置快照（创建时固化）';
COMMENT ON COLUMN workflow_executions.current_position IS '当前执行位置: { roleIndex, actionIndex }';
COMMENT ON COLUMN workflow_executions.steps IS '所有步骤状态数组';
COMMENT ON COLUMN workflow_executions.version IS '乐观锁版本号（并发控制）';

-- ============================================================================
-- 插入默认用户（开发环境）
-- ============================================================================
INSERT INTO users (id, username, email, password_hash, full_name, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin',
    'admin@mind2build.com',
    '$2b$10$dummy.hash.for.development.only',
    'Admin User',
    'active'
) ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- 完成提示
-- ============================================================================
-- Schema V2 创建完成！
-- 表数量: 18
-- 主要变更:
--   1. teams 表合并到 projects
--   2. actions 表改名为 action_logs
--   3. 三个 LLM 配置表合并为 llm_configs
--   4. 删除废弃的 interactive_session_* 表
--   5. 删除冗余的 application_roles 和 application_actions 表
